import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Wrench,
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
  fetchReports,
  fetchTasks,
  fetchVolunteers,
} from '@/services/api';
import { MaxHeap, calculateReportPriority } from '@/lib/priorityQueue';
import {
  isVolunteerEligibleForTask,
  matchVolunteersToTask,
} from '@/lib/volunteerMatching';
import { CommunityMap, type CommunityMapVolunteerMarker } from '@/pages/shared/MapDashboardPage';
import type { Report, Task, Volunteer, VolunteerMatchResult } from '@/types';

type AvailabilityFilter = 'all' | 'available';
type WorkloadFilter = 'all' | 'low' | 'medium' | 'high';

function taskCanBeMatched(report: Report, task?: Task): boolean {
  if (report.is_duplicate) return false;
  const hasActiveAssignment = task?.assignments?.some((assignment) =>
    ['assigned', 'accepted'].includes(assignment.status)
  );
  if (hasActiveAssignment) return false;

  if (['verified', 'prioritized'].includes(report.status)) {
    return !task || ['assigned', 'declined', 'reassigned'].includes(task.status);
  }
  return report.status === 'assigned' && Boolean(task) && ['assigned', 'declined', 'reassigned'].includes(task!.status);
}

function getReportAddress(report: Report): string {
  return report.location?.address || report.location?.area || report.location?.city || 'Location unavailable';
}

function getWaitLabel(createdAt: string): string {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return 'Waiting time unavailable';
  const minutes = Math.max(0, Math.floor((Date.now() - created) / 60000));
  if (minutes < 60) return `${minutes}m waiting`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ${minutes % 60}m waiting` : `${Math.floor(hours / 24)}d ${hours % 24}h waiting`;
}

function capacityPercent(volunteer: Volunteer): number {
  if (volunteer.max_workload <= 0) return 0;
  return Math.max(0, Math.min(100, ((volunteer.max_workload - volunteer.current_workload) / volunteer.max_workload) * 100));
}

function getMatchTone(score: number): string {
  if (score >= 80) return 'text-emerald-300';
  if (score >= 60) return 'text-sky-300';
  return 'text-amber-300';
}

export function VolunteerMatchingPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedReportId = searchParams.get('reportId') || '';
  const [reports, setReports] = useState<Report[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assigningVolunteerId, setAssigningVolunteerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [evaluatedAt, setEvaluatedAt] = useState(Date.now());
  const [search, setSearch] = useState('');
  const [skillFilter, setSkillFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all');
  const [distanceFilter, setDistanceFilter] = useState<'all' | '1' | '5' | '10'>('all');
  const [workloadFilter, setWorkloadFilter] = useState<WorkloadFilter>('all');

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [reportList, taskList, volunteerList] = await Promise.all([
        fetchReports(),
        fetchTasks(),
        fetchVolunteers(),
      ]);
      setReports(reportList);
      setTasks(taskList);
      setVolunteers(volunteerList);
      setEvaluatedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load volunteer matching data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
    const interval = window.setInterval(() => { void load(); }, 30000);
    return () => window.clearInterval(interval);
  }, [load]);

  const tasksByReport = useMemo(() => new Map(tasks.map((task) => [task.report_id, task])), [tasks]);
  const matchingEntries = useMemo(() => {
    const candidates = reports.filter((report) => taskCanBeMatched(report, tasksByReport.get(report.id)));
    const heap = new MaxHeap();
    heap.buildHeap(candidates, evaluatedAt);
    return heap.toPriorityArray();
  }, [evaluatedAt, reports, tasksByReport]);
  const matchingReports = matchingEntries.map((entry) => entry.data);

  useEffect(() => {
    if (!matchingReports.some((report) => report.id === selectedReportId)) {
      const requested = matchingReports.find((report) => report.id === requestedReportId);
      setSelectedReportId(requested?.id || matchingReports[0]?.id || '');
    }
  }, [matchingReports, requestedReportId, selectedReportId]);

  const selectedReport = matchingReports.find((report) => report.id === selectedReportId);
  const selectedTask = selectedReport ? tasksByReport.get(selectedReport.id) : undefined;
  const requiredSkills = useMemo(() => selectedTask?.required_skills || [], [selectedTask?.required_skills]);
  const reportLocation = selectedReport?.location;
  const matches = useMemo<VolunteerMatchResult[]>(() => {
    if (!selectedReport) return [];
    return matchVolunteersToTask(
      { required_skills: requiredSkills },
      volunteers,
      reportLocation ? { lat: reportLocation.latitude, lng: reportLocation.longitude } : null,
      new Date(evaluatedAt)
    );
  }, [evaluatedAt, requiredSkills, reportLocation, selectedReport, volunteers]);

  const verifiedVolunteers = volunteers.filter((volunteer) =>
    volunteer.is_verified && volunteer.verification_status === 'verified'
  );
  const availableVolunteers = verifiedVolunteers.filter((volunteer) =>
    isVolunteerEligibleForTask(volunteer, [], new Date(evaluatedAt))
  );
  const busyVolunteers = verifiedVolunteers.filter((volunteer) =>
    !isVolunteerEligibleForTask(volunteer, [], new Date(evaluatedAt))
  );
  const activeAssignments = tasks.reduce((count, task) =>
    count + (task.assignments || []).filter((assignment) => ['assigned', 'accepted'].includes(assignment.status)).length,
  0);
  const averageWorkload = verifiedVolunteers.length > 0
    ? Math.round(verifiedVolunteers.reduce((total, volunteer) => total + (100 - capacityPercent(volunteer)), 0) / verifiedVolunteers.length)
    : 0;

  const skillOptions = Array.from(new Set(volunteers.flatMap((volunteer) =>
    (volunteer.skills || []).map((skill) => skill.skill)
  ))).sort((a, b) => a.localeCompare(b));

  const visibleMatches = useMemo(() => matches.filter((match) => {
      const volunteerName = match.volunteer.profile?.full_name || '';
      const volunteerArea = match.volunteer.service_area || '';
      const skillText = (match.volunteer.skills || []).map((skill) => skill.skill).join(' ');
      const matchesSearch = !search.trim() || `${volunteerName} ${volunteerArea} ${skillText}`.toLowerCase().includes(search.trim().toLowerCase());
      const matchesSkill = skillFilter === 'all' || (match.volunteer.skills || []).some((skill) => skill.skill === skillFilter);
      const matchesAvailability = availabilityFilter === 'all' || match.availabilityStatus === availabilityFilter;
      const matchesDistance = distanceFilter === 'all' || (match.distance !== null && match.distance <= Number(distanceFilter));
      const workloadRatio = match.volunteer.max_workload > 0 ? match.volunteer.current_workload / match.volunteer.max_workload : 1;
      const matchesWorkload = workloadFilter === 'all' ||
        (workloadFilter === 'low' && workloadRatio <= 1 / 3) ||
        (workloadFilter === 'medium' && workloadRatio > 1 / 3 && workloadRatio <= 2 / 3) ||
        (workloadFilter === 'high' && workloadRatio > 2 / 3);
      return matchesSearch && matchesSkill && matchesAvailability && matchesDistance && matchesWorkload;
    }), [availabilityFilter, distanceFilter, matches, search, skillFilter, workloadFilter]);
  const volunteerMapMarkers = useMemo<CommunityMapVolunteerMarker[]>(() => visibleMatches.flatMap((match) => {
    if (match.volunteer.latitude === null || match.volunteer.longitude === null) return [];
    return [{
      id: match.volunteer.id,
      name: match.volunteer.profile?.full_name || 'Volunteer',
      latitude: match.volunteer.latitude,
      longitude: match.volunteer.longitude,
      score: match.score,
    }];
  }), [visibleMatches]);

  const handleAssign = async (volunteerId: string) => {
    if (!user || !selectedReport) return;
    setAssigningVolunteerId(volunteerId);
    setError(null);
    setNotice(null);
    try {
      const [latestReports, latestTasks, latestVolunteers] = await Promise.all([
        fetchReports(),
        fetchTasks(),
        fetchVolunteers(),
      ]);
      const latestReport = latestReports.find((report) => report.id === selectedReport.id);
      if (!latestReport || latestReport.is_duplicate) throw new Error('This report is no longer eligible for assignment. Refresh matching and try again.');

      const latestTask = latestTasks.find((task) => task.report_id === latestReport.id);
      if (!taskCanBeMatched(latestReport, latestTask)) throw new Error('This report already has an active assignment or is no longer ready. Refresh matching.');

      let task = latestTask;
      if (!task) {
        const calculated = calculateReportPriority(latestReport, Date.now());
        try {
          task = await createTask({
            report_id: latestReport.id,
            title: latestReport.title,
            description: latestReport.description,
            category_id: latestReport.category_id || undefined,
            priority_level: calculated.level,
            priority_score: calculated.score,
            required_skills: [],
            affected_people: latestReport.affected_people,
            created_by: user.id,
          });
        } catch (createError) {
          const refreshedTasks = await fetchTasks();
          const racedTask = refreshedTasks.find((item) => item.report_id === latestReport.id);
          if (!racedTask || !taskCanBeMatched(latestReport, racedTask)) throw createError;
          task = racedTask;
        }
      }

      const freshMatch = matchVolunteersToTask(
        task,
        latestVolunteers,
        latestReport.location ? { lat: latestReport.location.latitude, lng: latestReport.location.longitude } : null
      ).find((match) => match.volunteer.user_id === volunteerId);
      if (!freshMatch) throw new Error('This volunteer is no longer eligible. Matching was recalculated; choose another recommendation.');

      await assignTask(task.id, volunteerId, user.id);
      const locationLabel = getReportAddress(latestReport);
      const distanceLabel = freshMatch.distance === null
        ? 'Distance unavailable'
        : `${freshMatch.distance.toFixed(1)} km straight-line distance`;
      const deadlineLabel = task.deadline ? ` · Deadline ${new Date(task.deadline).toLocaleString()}` : '';
      await createNotification({
        user_id: volunteerId,
        title: 'New Task Assigned',
        description: `${task.task_id} · ${task.priority_level || 'Unassigned'} priority · ${latestReport.title} · ${latestReport.category?.name || 'Uncategorized'} · ${locationLabel} · ${distanceLabel}${deadlineLabel}. Open My Tasks for full details and destination.`,
        category: 'task_assigned',
        related_report_id: latestReport.id,
        related_task_id: task.id,
      });
      await createAuditLog({
        action: 'assign_matched_task',
        entity_type: 'task',
        entity_id: task.id,
        details: {
          report_id: latestReport.id,
          volunteer_id: volunteerId,
          match_score: freshMatch.score,
          skill_match: freshMatch.skillMatch,
          distance_km: freshMatch.distance,
          workload: freshMatch.volunteer.current_workload,
          availability: freshMatch.availabilityStatus,
        },
      });
      setNotice(`${task.task_id} was assigned to ${freshMatch.volunteer.profile?.full_name || 'the selected volunteer'}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign task');
    } finally {
      setAssigningVolunteerId(null);
    }
  };

  if (loading) return <LoadingState message="Loading reports and volunteer availability..." />;
  if (error && reports.length === 0) return <ErrorState message={error} onRetry={() => load(true)} />;

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title="Volunteer Matching" description="Find the best available volunteer for each priority task" />

      {error && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

      <section aria-label="Volunteer matching summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Eligible Volunteers', value: availableVolunteers.length, detail: 'Verified with capacity', icon: Users, tone: 'text-emerald-300', surface: 'bg-emerald-400/10' },
          { label: 'Unavailable / Unknown', value: busyVolunteers.length, detail: 'At capacity, off schedule, or schedule missing', icon: Activity, tone: 'text-amber-300', surface: 'bg-amber-400/10' },
          { label: 'Active Assignments', value: activeAssignments, detail: 'Assigned or accepted', icon: CheckCircle2, tone: 'text-sky-300', surface: 'bg-sky-400/10' },
          { label: 'Average Workload', value: `${averageWorkload}%`, detail: 'Capacity currently used', icon: Clock3, tone: 'text-violet-300', surface: 'bg-violet-400/10' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="rounded-xl border border-slate-700/70 bg-slate-950 p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-medium text-slate-400">{item.label}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-white">{item.value}</p></div>
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.surface} ${item.tone}`}><Icon className="h-4 w-4" /></span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">{item.detail}</p>
            </article>
          );
        })}
      </section>

      {matchingReports.length === 0 ? (
        <section className="rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-soft">
          <EmptyState
            icon={<ShieldCheck className="h-8 w-8" />}
            title="No tasks currently require volunteer assignment"
            description="Verified and prioritized reports appear here until assigned. Reports awaiting supervisor verification remain in Incoming Reports."
            action={<Link to="/app/supervisor/priority" className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:border-sky-400/40">Open Priority Queue <ArrowRight className="h-4 w-4" /></Link>}
          />
        </section>
      ) : (
        <>
          <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="min-w-0 rounded-2xl border border-slate-700/70 bg-slate-950 p-4 shadow-soft sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-300">Select Priority Issue</p><h2 className="mt-1 text-base font-semibold text-white">Matching work queue</h2></div>
                <button type="button" onClick={() => void load()} disabled={refreshing} aria-label="Refresh matching data" className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></button>
              </div>
              <label htmlFor="matching-report" className="mt-4 block text-xs font-medium text-slate-300">Verified or reassignable report</label>
              <select id="matching-report" value={selectedReportId} onChange={(event) => setSelectedReportId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-slate-100 focus:border-sky-400 focus:outline-none">
                {matchingEntries.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.level.toUpperCase()} · {entry.data.report_id} · {entry.data.title}</option>
                ))}
              </select>

              {selectedReport && matchingEntries.find((entry) => entry.id === selectedReport.id) && (() => {
                const entry = matchingEntries.find((item) => item.id === selectedReport.id)!;
                const isReassignment = selectedReport.status === 'assigned';
                const mapUrl = reportLocation
                  ? `https://www.google.com/maps/dir/?api=1&destination=${reportLocation.latitude},${reportLocation.longitude}`
                  : null;
                return (
                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex flex-wrap items-center gap-2"><PriorityBadge level={entry.level} /><StatusBadge status={selectedReport.status} />{isReassignment && <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] font-medium text-amber-200">Reassignment</span>}</div>
                    <h3 className="mt-3 text-lg font-semibold text-white">{selectedReport.title}</h3>
                    <p className="mt-1 font-mono text-xs text-slate-400">{selectedReport.report_id}</p>
                    {selectedReport.description && <p className="mt-3 line-clamp-3 text-sm text-slate-300">{selectedReport.description}</p>}
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div><p className="text-slate-500">Category</p><p className="mt-1 text-slate-200">{selectedReport.category?.name || 'Uncategorized'}</p></div>
                      <div><p className="text-slate-500">Priority score</p><p className="mt-1 font-semibold tabular-nums text-white">{entry.score.toFixed(2)} / 100</p></div>
                      <div><p className="text-slate-500">Affected people</p><p className="mt-1 text-slate-200">{selectedReport.affected_people}</p></div>
                      <div><p className="text-slate-500">Waiting time</p><p className="mt-1 text-slate-200">{getWaitLabel(selectedReport.created_at)}</p></div>
                      <div className="col-span-2"><p className="text-slate-500">Location</p><p className="mt-1 flex items-start gap-1.5 text-slate-200"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" />{getReportAddress(selectedReport)}</p>{reportLocation && <p className="mt-1 pl-5 font-mono text-[10px] text-slate-500">{reportLocation.latitude.toFixed(5)}, {reportLocation.longitude.toFixed(5)}</p>}</div>
                    </div>
                    <div className="mt-4 border-t border-slate-800 pt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Required skills stored on task</p>
                      <p className="mt-1 text-xs text-slate-300">{requiredSkills.length ? requiredSkills.join(', ') : 'None recorded; skill fit is neutral until the task defines requirements.'}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link to={`/app/reports/${selectedReport.id}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40">Report details <ArrowUpRight className="h-3.5 w-3.5" /></Link>
                      <Link to="/app/map" className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40">Community Map <ArrowUpRight className="h-3.5 w-3.5" /></Link>
                      {mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40">Open destination in Maps <ArrowUpRight className="h-3.5 w-3.5" /></a>}
                    </div>
                    <p className="mt-3 text-[10px] text-slate-500">Volunteer distance is a straight-line Haversine estimate. No road-network graph is stored, so Dijkstra routing is not claimed.</p>
                  </div>
                );
              })()}
            </div>

            <div className="min-w-0 rounded-2xl border border-slate-700/70 bg-slate-950 p-4 shadow-soft sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-300">Matching Engine</p><h2 className="mt-1 text-base font-semibold text-white">Recommended Volunteers</h2><p className="mt-1 text-xs text-slate-400">Skills 40% · Workload 25% · Availability 15% · Distance 20%</p></div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Live data</span>
              </div>

              <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="relative min-w-0 sm:col-span-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input aria-label="Search volunteers" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, skill, or service area" className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" /></div>
                <select aria-label="Filter by volunteer skill" value={skillFilter} onChange={(event) => setSkillFilter(event.target.value)} className="h-10 min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200"><option value="all">All recorded skills</option>{skillOptions.map((skill) => <option key={skill} value={skill}>{skill}</option>)}</select>
                <select aria-label="Filter by availability" value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value as AvailabilityFilter)} className="h-10 min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200"><option value="all">All eligible schedules</option><option value="available">Available now</option></select>
                <select aria-label="Filter by maximum distance" value={distanceFilter} onChange={(event) => setDistanceFilter(event.target.value as 'all' | '1' | '5' | '10')} className="h-10 min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200"><option value="all">Any distance</option><option value="1">Within 1 km</option><option value="5">Within 5 km</option><option value="10">Within 10 km</option></select>
                <select aria-label="Filter by workload" value={workloadFilter} onChange={(event) => setWorkloadFilter(event.target.value as WorkloadFilter)} className="h-10 min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200"><option value="all">Any workload</option><option value="low">Low workload</option><option value="medium">Medium workload</option><option value="high">High workload</option></select>
              </div>

              {matches.length === 0 ? (
                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <EmptyState
                    icon={<Users className="h-7 w-7" />}
                    title={requiredSkills.length ? 'No volunteers with all required skills are eligible' : 'No suitable volunteers currently available'}
                    description={`Verified volunteers: ${verifiedVolunteers.length}. At capacity, off schedule, or without a recorded availability window: ${busyVolunteers.length}. ${reportLocation ? 'Location coordinates are available for distance matching.' : 'Location data unavailable; distance-based matching cannot be calculated.'}`}
                  />
                </div>
              ) : visibleMatches.length === 0 ? (
                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-center text-sm text-slate-400">No eligible volunteer matches the current display filters.</div>
              ) : (
                <div className="mt-4 space-y-3">
                  {visibleMatches.map((match) => {
                    const rank = matches.findIndex((entry) => entry.volunteer.id === match.volunteer.id) + 1;
                    const initials = (match.volunteer.profile?.full_name || 'Volunteer').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
                    const mapDirections = reportLocation && match.volunteer.latitude !== null && match.volunteer.longitude !== null
                      ? `https://www.google.com/maps/dir/?api=1&origin=${match.volunteer.latitude},${match.volunteer.longitude}&destination=${reportLocation.latitude},${reportLocation.longitude}`
                      : null;
                    return (
                      <article key={match.volunteer.id} className={`rounded-xl border p-4 ${rank === 1 ? 'border-sky-400/40 bg-sky-400/5 shadow-[0_0_0_1px_rgba(56,189,248,0.08)]' : 'border-slate-800 bg-slate-900/40'}`}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${rank === 1 ? 'bg-sky-400/15 text-sky-200' : 'bg-slate-800 text-slate-300'}`}>{initials}</div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">#{rank}</span>
                                <h3 className="truncate text-sm font-semibold text-white">{match.volunteer.profile?.full_name || 'Volunteer'}</h3>
                                {rank === 1 && <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[9px] font-semibold text-sky-200">Best Match</span>}
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300"><ShieldCheck className="h-3 w-3" />Verified</span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-400">
                                <span className="inline-flex items-center gap-1"><Wrench className="h-3 w-3 text-violet-300" />{requiredSkills.length ? `${match.skillMatch.toFixed(0)}% skill match` : 'No task skills recorded'}</span>
                                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-sky-300" />{match.distance === null ? 'Distance unavailable' : `${match.distance.toFixed(1)} km straight-line`}</span>
                                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-300" />{match.availabilityStatus === 'available' ? 'Available now' : 'Schedule not recorded'}</span>
                                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3 text-amber-300" />{match.volunteer.current_workload}/{match.volunteer.max_workload} active tasks</span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {(match.volunteer.skills || []).length > 0
                                  ? match.volunteer.skills?.map((skill) => <span key={skill.id} className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-300">{skill.skill}</span>)
                                  : <span className="text-[10px] text-slate-500">No skills recorded</span>}
                              </div>
                              <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4">
                                <div><p className="text-slate-500">Skill · 40%</p><p className="mt-1 tabular-nums text-slate-200">{match.skillMatch.toFixed(0)}%</p></div>
                                <div><p className="text-slate-500">Workload · 25%</p><p className="mt-1 tabular-nums text-slate-200">{match.workloadScore.toFixed(0)}% capacity</p></div>
                                <div><p className="text-slate-500">Availability · 15%</p><p className="mt-1 tabular-nums text-slate-200">{match.availabilityScore}%</p></div>
                                <div><p className="text-slate-500">Distance · 20%</p><p className="mt-1 tabular-nums text-slate-200">{match.distanceScore === null ? 'Not scored' : `${match.distanceScore.toFixed(0)}%`}</p></div>
                              </div>
                              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-sky-400" style={{ width: `${match.score}%` }} /></div>
                              <p className={`mt-2 text-xs font-semibold ${getMatchTone(match.score)}`}>Match score {match.score.toFixed(1)}%</p>
                              <ul className="mt-2 space-y-1 text-[10px] text-slate-500">{match.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
                            {mapDirections && <a href={mapDirections} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/40"><MapPin className="h-3.5 w-3.5" />Directions</a>}
                            <button type="button" onClick={() => void handleAssign(match.volunteer.user_id)} disabled={assigningVolunteerId !== null} className="inline-flex items-center justify-center gap-1 rounded-lg bg-sky-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-300 disabled:cursor-wait disabled:opacity-60">{assigningVolunteerId === match.volunteer.user_id ? 'Assigning…' : 'Assign Task'} <ArrowRight className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {selectedReport && (
            <section aria-label="Issue and volunteer locations" className="min-w-0 space-y-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Issue and Volunteer Locations</h2>
                <p className="text-xs text-muted-foreground">Purple pins are eligible volunteers with coordinates; issue pins use the Community Map’s existing priority markers.</p>
              </div>
              <CommunityMap compact focusReportId={selectedReport.id} volunteerMarkers={volunteerMapMarkers} />
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-[11px] text-slate-500">
            <span>Match score is separate from issue priority. Priority Heap selects the report; this engine ranks verified, available volunteers.</span>
            <Link to="/app/supervisor/priority" className="inline-flex items-center gap-1 font-medium text-sky-300 hover:text-sky-200">Back to Priority Queue <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </>
      )}
    </div>
  );
}