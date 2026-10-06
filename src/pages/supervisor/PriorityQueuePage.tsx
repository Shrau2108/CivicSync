import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Inbox,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  UserCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge';
import {
  assignTask,
  createAuditLog,
  createNotification,
  createTask,
  fetchCategories,
  fetchReports,
  fetchTasks,
  fetchVolunteers,
  updateReportPriority,
  updateReportStatus,
  updateTaskStatus,
} from '@/services/api';
import { buildPriorityQueue, calculateReportPriority, DEFAULT_WEIGHTS } from '@/lib/priorityQueue';
import { matchVolunteersToTask } from '@/lib/volunteerMatching';
import type { PriorityLevel, Report, Task, Volunteer } from '@/types';

const PRIORITIES: PriorityLevel[] = ['critical', 'high', 'medium', 'low'];
type StatusFilter = 'all' | 'verified' | 'prioritized' | 'assigned' | 'in_progress' | 'resolved';

function getPriorityClasses(priority: PriorityLevel | null) {
  switch (priority) {
    case 'critical': return 'border-red-400/30 bg-red-400/10 text-red-300';
    case 'high': return 'border-orange-400/30 bg-orange-400/10 text-orange-300';
    case 'medium': return 'border-blue-400/30 bg-blue-400/10 text-blue-300';
    case 'low': return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300';
    default: return 'border-slate-700 bg-slate-900 text-slate-400';
  }
}

function getReportLocation(report: Report): string {
  return report.location?.address || report.location?.area || report.location?.city || 'Location unavailable';
}

function getElapsedTime(hours: number): string {
  const minutes = Math.floor(hours * 60);
  if (minutes < 60) return `${minutes}m`;
  const days = Math.floor(minutes / 1440);
  const remainingHours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = minutes % 60;
  if (days > 0) return `${days}d ${remainingHours}h`;
  return `${remainingHours}h ${remainingMinutes}m`;
}

function isReusableTask(task: Task): boolean {
  const hasActiveAssignment = task.assignments?.some((assignment) =>
    ['assigned', 'accepted'].includes(assignment.status)
  );
  return ['assigned', 'declined', 'reassigned'].includes(task.status) && !hasActiveAssignment;
}

export function PriorityQueuePage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [prioritySaving, setPrioritySaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluatedAt, setEvaluatedAt] = useState(Date.now());
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | PriorityLevel>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [selectedVolunteerId, setSelectedVolunteerId] = useState('');

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [reportList, taskList, volunteerList, categoryList] = await Promise.all([
        fetchReports(),
        fetchTasks(),
        fetchVolunteers(),
        fetchCategories(),
      ]);
      setReports(reportList);
      setTasks(taskList);
      setVolunteers(volunteerList);
      setCategories(categoryList.map(({ id, name }) => ({ id, name })));
      setEvaluatedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load priority queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
    const refreshInterval = window.setInterval(() => { void load(); }, 30000);
    return () => window.clearInterval(refreshInterval);
  }, [load]);

  const eligibleReports = useMemo(() => {
    const taskByReport = new Map(tasks.map((task) => [task.report_id, task]));
    return reports.filter((report) => {
      if (!['verified', 'prioritized'].includes(report.status) || report.is_duplicate) return false;
      const task = taskByReport.get(report.id);
      return !task || isReusableTask(task);
    });
  }, [reports, tasks]);

  const heap = useMemo(
    () => buildPriorityQueue(eligibleReports, evaluatedAt),
    [eligibleReports, evaluatedAt]
  );
  const queueEntries = heap.toPriorityArray();
  const nextEntry = heap.peek();
  const isLifecycleView = ['assigned', 'in_progress', 'resolved'].includes(statusFilter);
  const lifecycleEntries = useMemo(() => {
    if (statusFilter === 'assigned') return reports.filter((report) => report.status === 'assigned').map((report) => calculateReportPriority(report, evaluatedAt));
    if (statusFilter === 'in_progress') return reports.filter((report) => ['accepted', 'in_progress', 'evidence_submitted', 'under_verification'].includes(report.status)).map((report) => calculateReportPriority(report, evaluatedAt));
    if (statusFilter === 'resolved') return reports.filter((report) => report.status === 'resolved').map((report) => calculateReportPriority(report, evaluatedAt));
    return [];
  }, [evaluatedAt, reports, statusFilter]);
  const displayedEntries = isLifecycleView ? lifecycleEntries : queueEntries;
  const awaitingVerification = reports.filter((report) =>
    ['submitted', 'under_review'].includes(report.status)
  ).length;
  const taskByReport = useMemo(() => new Map(tasks.map((task) => [task.report_id, task])), [tasks]);
  const nextTask = nextEntry ? taskByReport.get(nextEntry.id) : undefined;
  const matches = useMemo(() => {
    if (!nextEntry) return [];
    const location = nextEntry.data.location;
    return matchVolunteersToTask(
      { required_skills: nextTask?.required_skills || [] },
      volunteers,
      location ? { lat: location.latitude, lng: location.longitude } : null,
      new Date(evaluatedAt)
    );
  }, [evaluatedAt, nextEntry, nextTask?.required_skills, volunteers]);
  const selectedMatch = matches.find((match) => match.volunteer.user_id === selectedVolunteerId);

  useEffect(() => {
    if (!matches.some((match) => match.volunteer.user_id === selectedVolunteerId)) {
      setSelectedVolunteerId(matches[0]?.volunteer.user_id || '');
    }
  }, [matches, selectedVolunteerId]);

  const priorityCounts = PRIORITIES.reduce<Record<PriorityLevel, number>>((counts, level) => {
    counts[level] = queueEntries.filter((entry) => entry.level === level).length;
    return counts;
  }, { critical: 0, high: 0, medium: 0, low: 0 });

  const filteredEntries = displayedEntries.filter((entry) => {
    const location = getReportLocation(entry.data);
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      entry.data.report_id,
      entry.data.title,
      entry.data.category?.name,
      location,
    ].filter(Boolean).join(' ').toLowerCase().includes(query);
    const matchesPriority = priorityFilter === 'all' || entry.level === priorityFilter;
    const matchesStatus = isLifecycleView || statusFilter === 'all' || entry.data.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || entry.data.category?.name === categoryFilter;
    return matchesSearch && matchesPriority && matchesStatus && matchesCategory;
  });

  const handleUrgencyChange = async (urgency: PriorityLevel) => {
    if (!nextEntry || urgency === nextEntry.data.urgency) return;
    setPrioritySaving(true);
    setError(null);
    const now = Date.now();
    const updatedReport = { ...nextEntry.data, urgency };
    const score = buildPriorityQueue([updatedReport], now).peek();
    if (!score) {
      setPrioritySaving(false);
      return;
    }
    try {
      await updateReportPriority(updatedReport.id, score.level, score.score, urgency);
      heap.updatePriority({ ...updatedReport, priority_level: score.level, priority_score: score.score }, now);
      setReports((current) => current.map((report) => report.id === updatedReport.id
        ? { ...report, urgency, priority_level: score.level, priority_score: score.score }
        : report
      ));
      setEvaluatedAt(now);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update report urgency');
    } finally {
      setPrioritySaving(false);
    }
  };

  const handleAssignHighestPriority = async () => {
    const max = heap.peek();
    if (!user || !max || !nextEntry || max.id !== nextEntry.id || !selectedMatch) return;

    setAssigning(true);
    setError(null);
    try {
      const refreshedTasks = await fetchTasks();
      let task = refreshedTasks.find((item) => item.report_id === max.id);
      if (task && !isReusableTask(task)) {
        throw new Error('This report already has an active or completed task. Refresh the queue to see the latest work state.');
      }

      if (!task) {
        try {
          task = await createTask({
            report_id: max.data.id,
            title: max.data.title,
            description: max.data.description,
            category_id: max.data.category_id || undefined,
            priority_level: max.level,
            priority_score: max.score,
            required_skills: [],
            affected_people: max.data.affected_people,
            created_by: user.id,
          });
        } catch (createError) {
          const latestTasks = await fetchTasks();
          const existingTask = latestTasks.find((item) => item.report_id === max.id);
          if (!existingTask || !isReusableTask(existingTask)) throw createError;
          task = existingTask;
        }
      }

      if (task.status !== 'assigned') {
        await updateTaskStatus(task.id, 'assigned', user.id, 'Assigned from the highest-priority queue position');
      }
      await assignTask(task.id, selectedMatch.volunteer.user_id, user.id);
      await updateReportStatus(max.data.id, 'assigned', user.id);
      await createNotification({
        user_id: selectedMatch.volunteer.user_id,
        title: 'New Task Assigned',
        description: `You have been assigned: ${max.data.title}`,
        category: 'task_assigned',
        related_report_id: max.data.id,
        related_task_id: task.id,
      });
      await createAuditLog({
        action: 'assign_highest_priority_task',
        entity_type: 'task',
        entity_id: task.id,
        details: {
          report_id: max.data.id,
          priority_score: max.score,
          volunteer_id: selectedMatch.volunteer.user_id,
        },
      });

      const extracted = heap.extractMax();
      if (!extracted || extracted.id !== max.id) {
        throw new Error('The queue root changed unexpectedly. Refresh and retry.');
      }
      setAssignmentOpen(false);
      setSelectedVolunteerId('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign the highest-priority task');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) return <LoadingState message="Building the priority queue..." />;
  if (error && reports.length === 0) return <ErrorState message={error} onRetry={() => load(true)} />;

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title="Priority Queue" description="Reports sorted by priority score using a max-heap data structure" />

      {error && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      <section aria-label="Priority totals" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <article className="rounded-xl border border-slate-700 bg-slate-950 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Pending</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{queueEntries.length}</p>
          <p className="mt-1 text-[11px] text-slate-500">Verified, awaiting assignment</p>
        </article>
        {PRIORITIES.map((level) => (
          <article key={level} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{level} Priority</p>
            <p className={`mt-2 text-2xl font-semibold tabular-nums ${getPriorityClasses(level).split(' ')[2]}`}>{priorityCounts[level]}</p>
            <p className="mt-1 text-[11px] text-slate-500">Ready in the max-heap</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-sky-400/25 bg-slate-950 shadow-soft">
        <div className="flex flex-col gap-5 border-b border-slate-800 bg-gradient-to-r from-sky-950/50 to-slate-950 p-5 lg:flex-row lg:items-start lg:justify-between sm:p-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">Next Task to Assign</p>
              {nextEntry && <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-[10px] font-semibold text-sky-200">Selected from Max-Heap Root</span>}
            </div>
            {nextEntry ? (
              <>
                <h2 className="mt-3 text-xl font-semibold text-white sm:text-2xl">{nextEntry.data.title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
                  <span className="font-mono text-slate-300">{nextEntry.data.report_id}</span>
                  <span>{nextEntry.data.category?.name || 'Uncategorized'}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{getReportLocation(nextEntry.data)}</span>
                  <span>{nextEntry.data.affected_people} affected</span>
                  <span>{getElapsedTime(nextEntry.waitingTimeHours)} waiting</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${getPriorityClasses(nextEntry.level)}`}>{nextEntry.level} priority</span>
                  <StatusBadge status={nextEntry.data.status} />
                  <span className="text-sm font-semibold tabular-nums text-white">Score {nextEntry.score.toFixed(2)} / 100</span>
                </div>
              </>
            ) : (
              <div className="mt-4">
                <h2 className="text-xl font-semibold text-white">No reports currently awaiting assignment</h2>
                <p className="mt-2 text-sm text-slate-400">
                  {awaitingVerification > 0
                    ? `${awaitingVerification} report${awaitingVerification === 1 ? ' is' : 's are'} awaiting supervisor verification.`
                    : 'Verified, unresolved reports will appear here after review.'}
                </p>
                {awaitingVerification > 0 && (
                  <Link to="/app/supervisor/incoming" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-sky-300 hover:text-sky-200">
                    Review incoming reports <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={() => load()} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:border-slate-500 disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button type="button" onClick={() => setAssignmentOpen((open) => !open)} disabled={!nextEntry} className="inline-flex items-center gap-2 rounded-lg bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-50">
              <UserCheck className="h-4 w-4" /> Assign Highest Priority Task
            </button>
          </div>
        </div>

        {nextEntry && (
          <div className="grid min-w-0 gap-5 p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(250px,0.8fr)] sm:p-6">
            <div>
              <h3 className="text-sm font-semibold text-white">Priority Score Breakdown</h3>
              <p className="mt-1 text-xs text-slate-400">Weighted normalized factors; waiting time is recalculated when the queue refreshes.</p>
              <div className="mt-4 space-y-3">
                {([
                  ['Severity', nextEntry.factors.severity, DEFAULT_WEIGHTS.severity],
                  ['Urgency', nextEntry.factors.urgency, DEFAULT_WEIGHTS.urgency],
                  ['Affected People', nextEntry.factors.affectedPeople, DEFAULT_WEIGHTS.affectedPeople],
                  ['Waiting Time', nextEntry.factors.waitingTime, DEFAULT_WEIGHTS.waitingTime],
                ] as const).map(([label, factor, weight]) => (
                  <div key={label} className="grid grid-cols-[minmax(100px,1fr)_auto_auto] items-center gap-3 text-xs">
                    <span className="text-slate-300">{label}</span>
                    <span className="tabular-nums text-slate-400">{factor.toFixed(1)} × {weight}%</span>
                    <span className="w-14 text-right font-semibold tabular-nums text-white">{(factor * weight / 100).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-sm font-semibold text-white">
                  <span>Total weighted score</span><span className="tabular-nums">{nextEntry.score.toFixed(2)} / 100</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-100">Supervisor urgency</p>
                  <p className="mt-1 text-xs text-slate-400">Changing urgency recalculates and re-heaps this report.</p>
                </div>
                <ShieldAlert className="h-5 w-5 shrink-0 text-amber-300" />
              </div>
              <label htmlFor="report-urgency" className="mt-4 block text-xs font-medium text-slate-300">Urgency</label>
              <select id="report-urgency" value={nextEntry.data.urgency} disabled={prioritySaving} onChange={(event) => void handleUrgencyChange(event.target.value as PriorityLevel)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm capitalize text-slate-100 focus:border-sky-400 focus:outline-none">
                {PRIORITIES.slice().reverse().map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
              {nextTask?.required_skills?.length ? (
                <p className="mt-3 text-xs text-slate-400">Task skills: {nextTask.required_skills.join(', ')}</p>
              ) : (
                <p className="mt-3 text-xs text-slate-500">No specific task skills are stored for this report.</p>
              )}
            </div>
          </div>
        )}
      </section>

      {assignmentOpen && nextEntry && (
        <section aria-label="Assign highest priority task" className="rounded-2xl border border-emerald-400/25 bg-slate-950 p-5 shadow-soft sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">Volunteer matching</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Assign {nextEntry.data.report_id}</h2>
              <p className="mt-1 text-sm text-slate-400">Candidates use the existing verified-volunteer, workload, availability, skills, and distance matching logic.</p>
            </div>
            <Link to="/app/supervisor/matching" className="inline-flex items-center gap-1 text-sm font-medium text-sky-300 hover:text-sky-200">Open matching <ArrowUpRight className="h-4 w-4" /></Link>
          </div>

          {matches.length === 0 ? (
            <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">
              No verified volunteer with capacity and a current availability match is available for this task.
            </div>
          ) : (
            <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
              <div>
                <label htmlFor="matched-volunteer" className="block text-xs font-medium text-slate-300">Recommended volunteer</label>
                <select id="matched-volunteer" value={selectedVolunteerId} onChange={(event) => setSelectedVolunteerId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-slate-100">
                  {matches.map((match) => (
                    <option key={match.volunteer.id} value={match.volunteer.user_id}>
                      {match.volunteer.profile?.full_name || 'Volunteer'} · Match {match.score} · {match.distance === null ? 'distance unavailable' : `${match.distance.toFixed(1)} km`}
                    </option>
                  ))}
                </select>
                {selectedMatch && (
                  <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300"><Users className="h-5 w-5" /></div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{selectedMatch.volunteer.profile?.full_name || 'Volunteer'}</p>
                        <p className="text-xs text-slate-400">Best available match · {selectedMatch.score} points</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div><p className="text-slate-500">Distance</p><p className="mt-1 text-slate-200">{selectedMatch.distance === null ? 'Not available' : `${selectedMatch.distance.toFixed(1)} km`}</p></div>
                      <div><p className="text-slate-500">Workload</p><p className="mt-1 text-slate-200">{selectedMatch.volunteer.current_workload}/{selectedMatch.volunteer.max_workload}</p></div>
                      <div><p className="text-slate-500">Availability</p><p className="mt-1 text-emerald-300">Available now</p></div>
                      <div><p className="text-slate-500">Skills</p><p className="mt-1 text-slate-200">{selectedMatch.skillMatch > 0 && nextTask?.required_skills?.length ? `${selectedMatch.skillMatch.toFixed(0)}% match` : 'No required skills stored'}</p></div>
                    </div>
                    <ul className="mt-3 space-y-1 border-t border-slate-800 pt-3 text-xs text-slate-400">
                      {selectedMatch.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-end gap-2">
                <p className="text-xs text-slate-400">The task will be created or resumed for the max-heap root, then assigned using the selected existing volunteer record.</p>
                <button type="button" onClick={() => void handleAssignHighestPriority()} disabled={!selectedMatch || assigning} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">
                  <CheckCircle2 className="h-4 w-4" /> {assigning ? 'Assigning task...' : 'Assign Task'}
                </button>
                <button type="button" onClick={() => setAssignmentOpen(false)} disabled={assigning} className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-900">Cancel</button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-soft">
        <div className="flex flex-col gap-4 border-b border-slate-800 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2"><Inbox className="h-4 w-4 text-sky-300" /><h2 className="text-base font-semibold text-white">{isLifecycleView ? `${statusFilter === 'in_progress' ? 'In Progress' : statusFilter[0].toUpperCase() + statusFilter.slice(1)} Reports` : 'Priority Queue'}</h2></div>
              <p className="mt-1 text-xs text-slate-400">{isLifecycleView ? 'These reports are outside the assignable heap and cannot be assigned from this view.' : 'Highest score stays at the heap root. Filters only affect this view, not heap order.'}</p>
            </div>
            <span className="text-xs text-slate-400">{filteredEntries.length} of {displayedEntries.length} {isLifecycleView ? 'reports outside the heap' : 'ready reports'}</span>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1.4fr)_repeat(3,minmax(130px,1fr))]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search priority queue" placeholder="Search reports or locations" className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
            </div>
            <label className="relative min-w-0">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as 'all' | PriorityLevel)} aria-label="Filter by priority" className="h-10 w-full appearance-none rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-3 text-sm capitalize text-slate-100 focus:border-sky-400 focus:outline-none">
                <option value="all">All priorities</option>{PRIORITIES.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </label>
            <label className="min-w-0">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} aria-label="Filter by queue status" className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus:border-sky-400 focus:outline-none">
                <option value="all">All awaiting assignment</option>
                <option value="verified">Verified</option>
                <option value="prioritized">Prioritized</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
            <label className="min-w-0">
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category" className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus:border-sky-400 focus:outline-none">
                <option value="all">All categories</option>{categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
              </select>
            </label>
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="px-4 py-2 text-slate-100">
            <EmptyState icon={<AlertTriangle className="h-7 w-7" />} title={displayedEntries.length ? 'No reports match these filters' : isLifecycleView ? `No ${statusFilter === 'in_progress' ? 'in progress' : statusFilter} reports` : 'No reports currently awaiting assignment'} description={displayedEntries.length ? 'Change or clear a filter to see reports.' : isLifecycleView ? 'Reports in this state are not eligible for the active priority heap.' : awaitingVerification ? `${awaitingVerification} report${awaitingVerification === 1 ? ' is' : 's are'} awaiting verification and will enter the heap after review.` : 'Reports enter the heap after supervisor verification.'} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div role="table" aria-label="Max-heap priority queue" className="min-w-[1180px]">
              <div role="row" className="grid grid-cols-[52px_112px_minmax(190px,1.5fr)_120px_minmax(160px,1.1fr)_100px_100px_110px_112px_92px_110px] items-center gap-3 bg-slate-900/70 px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <span>Rank</span><span>Report ID</span><span>Issue</span><span>Category</span><span>Location</span><span>Severity</span><span>Urgency</span><span>Affected</span><span>Waiting</span><span>Score</span><span>Status / Action</span>
              </div>
              <div className="divide-y divide-slate-800">
                {filteredEntries.map((entry) => {
                  const rank = queueEntries.findIndex((item) => item.id === entry.id) + 1;
                  return (
                    <div key={entry.id} role="row" className={`grid grid-cols-[52px_112px_minmax(190px,1.5fr)_120px_minmax(160px,1.1fr)_100px_100px_110px_112px_92px_110px] items-center gap-3 px-4 py-3 text-xs ${entry.id === nextEntry?.id ? 'bg-sky-400/5' : 'hover:bg-slate-900/40'}`}>
                      <span className={`font-semibold tabular-nums ${rank === 1 && !isLifecycleView ? 'text-sky-300' : 'text-slate-500'}`}>{isLifecycleView ? '—' : `#${rank}`}</span>
                      <span className="truncate font-mono text-slate-300">{entry.data.report_id}</span>
                      <Link to={`/app/reports/${entry.data.id}`} className="truncate font-medium text-slate-100 hover:text-sky-300">{entry.data.title}</Link>
                      <span className="truncate text-slate-400">{entry.data.category?.name || 'Uncategorized'}</span>
                      <span className="truncate text-slate-400" title={getReportLocation(entry.data)}>{getReportLocation(entry.data)}</span>
                      <span className="capitalize text-slate-300">{entry.data.severity || 'Not set'}</span>
                      <span className="capitalize text-slate-300">{entry.data.urgency}</span>
                      <span className="tabular-nums text-slate-300">{entry.data.affected_people}</span>
                      <span className="tabular-nums text-slate-300">{getElapsedTime(entry.waitingTimeHours)}</span>
                      <span className="font-semibold tabular-nums text-white">{entry.score.toFixed(2)}</span>
                      <div className="flex items-center gap-2"><PriorityBadge level={entry.level} /><StatusBadge status={entry.data.status} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />Waiting time refreshes with the queue, every 30 seconds.</span>
        <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Only verified or prioritized, unresolved reports enter the heap.</span>
      </div>
    </div>
  );
}