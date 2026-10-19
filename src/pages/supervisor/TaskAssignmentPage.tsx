import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Search, UserCheck, AlertCircle, CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Modal';
import { fetchReports, fetchVolunteers, createTask, assignTask, updateReportStatus, createNotification, createAuditLog, fetchVolunteerTaskRequests, reviewVolunteerTaskRequest } from '@/services/api';
import { formatDate } from '@/lib/utils';
import { matchVolunteersToTask } from '@/lib/volunteerMatching';
import type { Report, Volunteer, VolunteerTaskRequest } from '@/types';

export function TaskAssignmentPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [requests, setRequests] = useState<VolunteerTaskRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [assignModal, setAssignModal] = useState<Report | null>(null);
  const [selectedVolunteerId, setSelectedVolunteerId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, v, taskRequests] = await Promise.all([fetchReports(), fetchVolunteers(), fetchVolunteerTaskRequests()]);
      const pendingRequestReportIds = new Set(taskRequests.filter((request) => request.status === 'pending').map((request) => request.report_id));
      setReports(r.filter((report) => ['verified', 'prioritized'].includes(report.status) && !pendingRequestReportIds.has(report.id)));
      setVolunteers(v.filter(vol => vol.is_verified && vol.verification_status === 'verified'));
      setRequests(taskRequests.filter((request) => request.status === 'pending'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const volunteerMatches = useMemo(() => {
    if (!assignModal) return [];
    return matchVolunteersToTask(
      { required_skills: [] },
      volunteers,
      assignModal.location ? { lat: assignModal.location.latitude, lng: assignModal.location.longitude } : null
    );
  }, [assignModal, volunteers]);

  const handleAssign = async () => {
    if (!user || !assignModal || !selectedVolunteerId) return;
    setAssigning(true);
    try {
      const [latestReports, latestVolunteers] = await Promise.all([fetchReports(), fetchVolunteers()]);
      const latestReport = latestReports.find((report) => report.id === assignModal.id);
      if (!latestReport || !['verified', 'prioritized'].includes(latestReport.status) || latestReport.is_duplicate) {
        throw new Error('This report is no longer eligible for assignment. Refresh and try again.');
      }
      const latestMatch = matchVolunteersToTask(
        { required_skills: [] },
        latestVolunteers,
        latestReport.location ? { lat: latestReport.location.latitude, lng: latestReport.location.longitude } : null
      ).find((match) => match.volunteer.user_id === selectedVolunteerId);
      if (!latestMatch) throw new Error('This volunteer is no longer available or has reached workload capacity.');

      const task = await createTask({
        report_id: latestReport.id,
        title: latestReport.title,
        description: latestReport.description,
        category_id: latestReport.category_id || undefined,
        priority_level: latestReport.priority_level || undefined,
        priority_score: latestReport.priority_score || 0,
        affected_people: latestReport.affected_people,
        created_by: user.id,
      });

      await assignTask(task.id, selectedVolunteerId, user.id);
      await updateReportStatus(latestReport.id, 'assigned', user.id);
      await createNotification({
        user_id: selectedVolunteerId,
        title: 'New Task Assigned',
        description: `${task.task_id} · ${latestReport.priority_level || 'Unassigned'} priority · ${latestReport.title} · ${latestReport.category?.name || 'Uncategorized'} · ${latestReport.location?.address || latestReport.location?.area || 'Location unavailable'} · ${latestMatch.distance === null ? 'Distance unavailable' : `${latestMatch.distance.toFixed(1)} km straight-line distance`}. Open My Tasks for details and destination.`,
        category: 'task_assigned',
        related_report_id: latestReport.id,
        related_task_id: task.id,
      });
      await createAuditLog({
        action: 'assign_task',
        entity_type: 'task',
        entity_id: task.id,
        details: { volunteer_id: selectedVolunteerId, report_id: latestReport.id, match_score: latestMatch.score, distance_km: latestMatch.distance },
      });
      setAssignModal(null);
      setSelectedVolunteerId('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign task');
    } finally {
      setAssigning(false);
    }
  };

  const handleReviewRequest = async (request: VolunteerTaskRequest, approve: boolean) => {
    setReviewingRequestId(request.id);
    setError(null);
    try {
      await reviewVolunteerTaskRequest(request.id, approve);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review volunteer request');
    } finally {
      setReviewingRequestId(null);
    }
  };

  const filtered = reports.filter(r =>
    !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.report_id.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingState message="Loading assignment data..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Task Assignment"
        description="Review volunteer interest and assign verified community reports"
      />

      <section className="mb-6 rounded-xl border border-border bg-card shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-foreground"><Clock3 className="h-4 w-4 text-amber-600" /> Volunteer requests</h2>
            <p className="mt-1 text-xs text-muted-foreground">Review volunteers who asked to take on a community report.</p>
          </div>
          <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700">{requests.length} pending</span>
        </div>
        {requests.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground sm:px-5">No volunteer requests need review.</p>
        ) : (
          <div className="divide-y divide-border">
            {requests.map((request) => {
              const report = request.report;
              if (!report) return null;
              const volunteerName = request.volunteer?.full_name || request.volunteer?.email || 'Volunteer';
              return (
                <article key={request.id} className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{report.report_id}</span>
                      <PriorityBadge level={report.priority_level} />
                    </div>
                    <p className="mt-2 font-semibold text-foreground">{report.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{volunteerName} requested this assignment · {formatDate(request.created_at)}</p>
                    {request.message && <p className="mt-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">“{request.message}”</p>}
                    <Link to={`/app/reports/${report.id}`} className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">Review citizen report</Link>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button type="button" onClick={() => void handleReviewRequest(request, false)} disabled={reviewingRequestId === request.id} className="btn-secondary text-sm disabled:opacity-50">
                      <XCircle className="h-4 w-4" /> Decline
                    </button>
                    <button type="button" onClick={() => void handleReviewRequest(request, true)} disabled={reviewingRequestId === request.id} className="btn-primary text-sm disabled:opacity-50">
                      <CheckCircle2 className="h-4 w-4" /> {reviewingRequestId === request.id ? 'Reviewing...' : 'Approve & assign'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Search reports..." />
      </div>

      {filtered.length === 0 ? (
        <Card><CardBody>
          <EmptyState icon={<ClipboardCheck className="w-8 h-8" />} title="No reports to assign" description="All verified reports have been assigned" />
        </CardBody></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <Card key={report.id}>
              <CardBody>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{report.report_id}</span>
                      <StatusBadge status={report.status} />
                      <PriorityBadge level={report.priority_level} />
                    </div>
                    <p className="font-medium text-foreground">{report.title}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {report.category && <span className="text-xs text-muted-foreground">{report.category.name}</span>}
                      <span className="text-xs text-muted-foreground">{formatDate(report.created_at)}</span>
                      <span className="text-xs text-muted-foreground">{report.affected_people} affected</span>
                    </div>
                  </div>
                  <button onClick={() => setAssignModal(report)} className="btn-primary text-sm flex-shrink-0">
                    <UserCheck className="w-4 h-4" /> Assign Volunteer
                  </button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!assignModal}
        onClose={() => { setAssignModal(null); setSelectedVolunteerId(''); }}
        onConfirm={handleAssign}
        title="Assign Volunteer"
        message={assignModal ? `Select a volunteer for: ${assignModal.title}` : ''}
        confirmLabel={assigning ? 'Assigning...' : 'Assign'}
      >
        <div className="p-5">
          {volunteerMatches.length === 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              <AlertCircle className="w-4 h-4" /> No verified volunteer has an available schedule and remaining workload capacity.
            </div>
          ) : (
            <select value={selectedVolunteerId} onChange={(e) => setSelectedVolunteerId(e.target.value)} className="input">
              <option value="">Select a volunteer...</option>
              {volunteerMatches.map(match => (
                <option key={match.volunteer.id} value={match.volunteer.user_id}>
                  {match.volunteer.profile?.full_name} — {match.score}% match · {match.volunteer.current_workload}/{match.volunteer.max_workload} tasks · {match.availabilityStatus === 'schedule_unset' ? 'schedule not recorded' : 'available now'} · {match.distance === null ? 'distance unavailable' : `${match.distance.toFixed(1)} km`}
                </option>
              ))}
            </select>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}
