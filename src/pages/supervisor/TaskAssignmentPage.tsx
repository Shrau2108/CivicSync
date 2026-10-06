import { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardCheck, Search, UserCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Modal';
import { fetchReports, fetchVolunteers, createTask, assignTask, updateReportStatus, createNotification, createAuditLog } from '@/services/api';
import { formatDate } from '@/lib/utils';
import { matchVolunteersToTask } from '@/lib/volunteerMatching';
import type { Report, Volunteer } from '@/types';

export function TaskAssignmentPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [assignModal, setAssignModal] = useState<Report | null>(null);
  const [selectedVolunteerId, setSelectedVolunteerId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, v] = await Promise.all([fetchReports(), fetchVolunteers()]);
      setReports(r.filter(rpt => ['verified', 'prioritized'].includes(rpt.status)));
      setVolunteers(v.filter(vol => vol.is_verified && vol.verification_status === 'verified'));
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

  const filtered = reports.filter(r =>
    !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.report_id.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingState message="Loading assignment data..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Task Assignment"
        description="Assign verified reports to suitable volunteers"
      />

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
                  {match.volunteer.profile?.full_name} — {match.score}% match · {match.volunteer.current_workload}/{match.volunteer.max_workload} tasks · {match.distance === null ? 'distance unavailable' : `${match.distance.toFixed(1)} km`}
                </option>
              ))}
            </select>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}
