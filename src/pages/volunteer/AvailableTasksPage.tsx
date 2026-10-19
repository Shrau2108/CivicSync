import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  MapPin,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { PriorityBadge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import {
  fetchAvailableVolunteerReports,
  fetchVolunteerByUserId,
  fetchVolunteerTaskRequests,
  submitVolunteerTaskRequest,
} from '@/services/api';
import { formatDate, timeAgo } from '@/lib/utils';
import type { Report, Volunteer, VolunteerTaskRequest } from '@/types';

type ViewMode = 'opportunities' | 'requests';

function getLocation(report?: Report) {
  return report?.location?.area
    || report?.location?.city
    || report?.location?.address
    || report?.category?.name
    || 'Location not provided';
}

function getRequestStatusClass(status: VolunteerTaskRequest['status']) {
  if (status === 'approved') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700';
  if (status === 'rejected') return 'border-border bg-muted text-muted-foreground';
  return 'border-amber-500/20 bg-amber-500/10 text-amber-700';
}

export function AvailableTasksPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [requests, setRequests] = useState<VolunteerTaskRequest[]>([]);
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('opportunities');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [reportList, requestList, volunteerProfile] = await Promise.all([
        fetchAvailableVolunteerReports(),
        fetchVolunteerTaskRequests(user.id),
        fetchVolunteerByUserId(user.id),
      ]);
      setReports(reportList);
      setRequests(requestList);
      setVolunteer(volunteerProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load volunteer opportunities');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const latestRequestByReport = useMemo(() => {
    const latest = new Map<string, VolunteerTaskRequest>();
    [...requests]
      .sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime())
      .forEach((request) => {
        if (!latest.has(request.report_id)) latest.set(request.report_id, request);
      });
    return latest;
  }, [requests]);

  const filteredReports = reports.filter((report) => {
    const query = search.trim().toLowerCase();
    const searchable = [report.report_id, report.title, report.description, report.category?.name, getLocation(report)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesQuery = !query || searchable.includes(query);
    const matchesPriority = priorityFilter === 'all' || report.priority_level === priorityFilter;
    return matchesQuery && matchesPriority;
  });

  const filteredRequests = requests.filter((request) => {
    const report = request.report;
    const query = search.trim().toLowerCase();
    const searchable = [report?.report_id, report?.title, report?.description, report?.category?.name, getLocation(report)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesQuery = !query || searchable.includes(query);
    const matchesPriority = priorityFilter === 'all' || report?.priority_level === priorityFilter;
    return matchesQuery && matchesPriority;
  });

  const handleSubmitRequest = async () => {
    if (!selectedReport) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const request = await submitVolunteerTaskRequest(selectedReport.id, message);
      setRequests((current) => [request, ...current]);
      setSelectedReport(null);
      setMessage('');
      setViewMode('requests');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not send your request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState message="Loading volunteer opportunities..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const isVerified = Boolean(volunteer?.is_verified && volunteer.verification_status === 'verified');

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader title="Available Tasks" description="Choose a verified community report and ask your supervisor to review your interest." />

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">Community requests ready for volunteers</h2>
            <p className="mt-1 text-sm text-muted-foreground">These reports have been reviewed. Request one and your supervisor will approve or decline it.</p>
          </div>
        </div>
        <span className="shrink-0 text-sm font-medium text-muted-foreground">{reports.length} opportunities</span>
      </section>

      {!isVerified && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-800">Your volunteer profile must be verified before you can request a task.</p>
          <Link to="/app/profile" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-amber-800 hover:underline">Review profile <ArrowRight className="h-4 w-4" /></Link>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input pl-10"
            placeholder="Search reports, categories, or locations"
            aria-label="Search opportunities"
          />
        </div>
        <select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="input sm:w-44">
          <option value="all">All priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="flex gap-1 border-b border-border" role="tablist" aria-label="Volunteer opportunities">
        <button type="button" role="tab" aria-selected={viewMode === 'opportunities'} onClick={() => setViewMode('opportunities')} className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${viewMode === 'opportunities' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          Opportunities <span className="ml-1 tabular-nums">{reports.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={viewMode === 'requests'} onClick={() => setViewMode('requests')} className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${viewMode === 'requests' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          My requests <span className="ml-1 tabular-nums">{requests.length}</span>
        </button>
      </div>

      {actionError && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{actionError}</p>}

      {viewMode === 'opportunities' ? (
        filteredReports.length ? (
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredReports.map((report) => {
              const request = latestRequestByReport.get(report.id);
              return (
                <article key={report.id} className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 shadow-soft transition-colors hover:border-primary/30 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{report.report_id}</span>
                    <PriorityBadge level={report.priority_level} />
                  </div>
                  <Link to={`/app/reports/${report.id}`} className="mt-3 block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <h2 className="text-lg font-semibold text-foreground hover:text-primary">{report.title}</h2>
                  </Link>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{report.description}</p>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{getLocation(report)}</span>
                    {report.category?.name && <span>{report.category.name}</span>}
                    <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{report.affected_people} affected</span>
                    <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />Reported {timeAgo(report.created_at)}</span>
                  </div>
                  <div className="mt-auto flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    {request?.status === 'pending' ? (
                      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${getRequestStatusClass('pending')}`}><Clock3 className="h-3.5 w-3.5" />Awaiting supervisor review</span>
                    ) : request?.status === 'approved' ? (
                      <Link to={request.task_id ? `/app/tasks/${request.task_id}` : '/app/volunteer/tasks'} className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${getRequestStatusClass('approved')}`}><CheckCircle2 className="h-3.5 w-3.5" />Approved · View task</Link>
                    ) : (
                      <Link to={`/app/reports/${report.id}`} className="text-sm font-medium text-primary hover:underline">View report details</Link>
                    )}
                    {request?.status !== 'pending' && request?.status !== 'approved' && (
                      <button type="button" onClick={() => { setSelectedReport(report); setActionError(null); }} disabled={!isVerified} className="btn-primary justify-center text-sm disabled:cursor-not-allowed disabled:opacity-50">
                        <Send className="h-4 w-4" /> {request?.status === 'rejected' ? 'Request again' : 'Request this task'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<FileText className="h-8 w-8" />} title={reports.length ? 'No matching reports' : 'No opportunities yet'} description={reports.length ? 'Try a different search or priority.' : 'Verified citizen reports will appear here when they are ready for volunteer support.'} />
        )
      ) : (
        filteredRequests.length ? (
          <div className="space-y-3">
            {filteredRequests.map((request) => {
              const report = request.report;
              if (!report) return null;
              return (
                <article key={request.id} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">{report.report_id}</p>
                    <Link to={request.task_id ? `/app/tasks/${request.task_id}` : `/app/reports/${report.id}`} className="mt-1 block font-semibold text-foreground hover:text-primary">{report.title}</Link>
                    <p className="mt-1 text-xs text-muted-foreground">Sent {formatDate(request.created_at)} · {getLocation(report)}</p>
                    {request.message && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">“{request.message}”</p>}
                  </div>
                  <span className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${getRequestStatusClass(request.status)}`}>
                    {request.status === 'approved' ? <CheckCircle2 className="h-3.5 w-3.5" /> : request.status === 'pending' ? <Clock3 className="h-3.5 w-3.5" /> : null}
                    {request.status === 'pending' ? 'Awaiting review' : request.status}
                  </span>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<Send className="h-8 w-8" />} title="No requests sent" description="Request a report that matches your skills and interests. Your supervisor will review it." action={<button type="button" onClick={() => setViewMode('opportunities')} className="btn-primary">Browse opportunities <ArrowRight className="h-4 w-4" /></button>} />
        )
      )}

      <Modal open={!!selectedReport} onClose={() => { if (!submitting) setSelectedReport(null); }} title="Request to volunteer">
        {selectedReport && (
          <form onSubmit={(event) => { event.preventDefault(); void handleSubmitRequest(); }} className="space-y-4 p-5">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="font-medium text-foreground">{selectedReport.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{selectedReport.report_id} · {getLocation(selectedReport)}</p>
            </div>
            <p className="text-sm text-muted-foreground">Your supervisor will review your interest. You’ll only be assigned this task after approval.</p>
            <label className="block text-sm font-medium text-foreground" htmlFor="volunteer-request-message">Note to supervisor <span className="font-normal text-muted-foreground">(optional)</span></label>
            <textarea id="volunteer-request-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} rows={4} className="input min-h-24 resize-y" placeholder="Share why you’re interested or any relevant experience." />
            {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button type="button" onClick={() => setSelectedReport(null)} disabled={submitting} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary"><Send className="h-4 w-4" />{submitting ? 'Sending...' : 'Send request'}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}