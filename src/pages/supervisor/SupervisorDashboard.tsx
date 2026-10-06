import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowRight, ArrowUpRight, Clock3, Inbox, MapPin, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { CommunityMap } from '@/pages/shared/MapDashboardPage';
import { fetchReports, fetchTasks, fetchVolunteers } from '@/services/api';
import { formatDate } from '@/lib/utils';
import type { Report, Task, Volunteer } from '@/types';

function priorityClasses(priority: Report['priority_level'] | Task['priority_level']) {
  switch (priority) {
    case 'critical': return 'border-red-400/30 bg-red-400/10 text-red-300';
    case 'high': return 'border-orange-400/30 bg-orange-400/10 text-orange-300';
    case 'medium': return 'border-blue-400/30 bg-blue-400/10 text-blue-300';
    case 'low': return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300';
    default: return 'border-slate-600 bg-slate-800 text-slate-300';
  }
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function SupervisorDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, t, v] = await Promise.all([fetchReports(), fetchTasks(), fetchVolunteers()]);
      setReports(r);
      setTasks(t);
      setVolunteers(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState message="Loading operations dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const incoming = reports.filter(r => r.status === 'submitted' || r.status === 'under_review');
  const critical = reports.filter(r => r.priority_level === 'critical' && !['resolved','cancelled','rejected','duplicate'].includes(r.status));
  const pendingVerification = tasks.filter(t => t.status === 'evidence_submitted' || t.status === 'under_verification');
  const unassigned = reports.filter(r => r.status === 'verified' || r.status === 'prioritized');
  const activeTasks = tasks.filter(t => ['accepted','in_progress'].includes(t.status));
  const availableVolunteers = volunteers.filter(v => v.is_verified && v.current_workload < v.max_workload);
  const kpis = [
    { label: 'Incoming Reports', value: incoming.length, detail: 'Submitted or under review', icon: Inbox, tone: 'text-sky-300', iconTone: 'bg-sky-400/10' },
    { label: 'Critical Issues', value: critical.length, detail: 'Unresolved critical reports', icon: AlertTriangle, tone: 'text-red-300', iconTone: 'bg-red-400/10' },
    { label: 'Pending Verification', value: pendingVerification.length, detail: 'Evidence submitted or in review', icon: ShieldCheck, tone: 'text-amber-300', iconTone: 'bg-amber-400/10' },
    { label: 'Available Volunteers', value: availableVolunteers.length, detail: 'Verified with workload capacity', icon: UserCheck, tone: 'text-emerald-300', iconTone: 'bg-emerald-400/10' },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <header className="rounded-2xl border border-slate-700/70 bg-slate-950 px-5 py-5 shadow-soft sm:px-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">CivicSync Operations</p>
            <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">Operations Dashboard</h1>
            <p className="mt-1 text-sm text-slate-400">Monitor reports, tasks, and volunteer activity</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/app/supervisor/priority" className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-sky-400/50 hover:text-white">
              Priority Queue <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link to="/app/supervisor/verification" className="inline-flex items-center gap-2 rounded-lg bg-sky-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300">
              Review Evidence <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <section aria-label="Operations overview" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article key={kpi.label} className="min-w-0 rounded-2xl border border-slate-700/70 bg-slate-900/90 p-4 shadow-soft sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-400">{kpi.label}</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums text-white">{kpi.value}</p>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kpi.iconTone} ${kpi.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 border-t border-slate-800 pt-3 text-xs text-slate-400">{kpi.detail}</p>
            </article>
          );
        })}
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-5">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950 shadow-soft">
          <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-white">Priority Queue / Live Issues</h2>
                <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">{incoming.length} incoming</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">Reports currently submitted or under review</p>
            </div>
            <Link to="/app/supervisor/incoming" className="inline-flex items-center gap-1 text-sm font-medium text-sky-300 hover:text-sky-200">
              View incoming <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {incoming.length === 0 ? (
            <div className="px-4 py-3 text-slate-200">
              <EmptyState icon={<Inbox className="h-7 w-7" />} title="No incoming reports" />
            </div>
          ) : (
            <div role="table" aria-label="Incoming reports" className="min-w-0">
              <div role="row" className="hidden grid-cols-[100px_minmax(140px,1.4fr)_minmax(90px,0.8fr)_minmax(120px,1fr)_100px_90px_110px] gap-3 bg-slate-900/70 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 lg:grid lg:px-5">
                <span>Report ID</span><span>Issue</span><span>Category</span><span>Location</span><span>Priority</span><span>Reported</span><span>Status</span>
              </div>
              <div className="divide-y divide-slate-800">
                {incoming.slice(0, 5).map((report) => {
                  const location = report.location?.address || report.location?.area || report.location?.city || 'Location unavailable';
                  const priority = report.priority_level;
                  return (
                    <Link key={report.id} to={`/app/reports/${report.id}`} role="row" className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition hover:bg-slate-900/70 lg:grid-cols-[100px_minmax(140px,1.4fr)_minmax(90px,0.8fr)_minmax(120px,1fr)_100px_90px_110px] lg:px-5">
                      <div className="min-w-0 lg:hidden">
                        <p className="font-mono text-[10px] text-slate-500">{report.report_id}</p>
                        <p className="mt-1 truncate text-sm font-medium text-white">{report.title}</p>
                        <p className="mt-1 truncate text-xs text-slate-400">{report.category?.name || 'Uncategorized'} · {location}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{formatDate(report.created_at)} · {statusLabel(report.status)}</p>
                      </div>
                      <span className="hidden truncate font-mono text-xs text-slate-400 lg:block">{report.report_id}</span>
                      <span className="hidden truncate text-sm font-medium text-white lg:block">{report.title}</span>
                      <span className="hidden truncate text-xs text-slate-400 lg:block">{report.category?.name || 'Uncategorized'}</span>
                      <span className="hidden truncate text-xs text-slate-400 lg:block">{location}</span>
                      <span className={`inline-flex items-center justify-center rounded-full border px-2 py-1 text-[10px] font-semibold ${priorityClasses(priority)}`}>{priority || 'Unassigned'}</span>
                      <span className="hidden text-xs text-slate-400 lg:block">{formatDate(report.created_at)}</span>
                      <span className="hidden lg:block"><span className="inline-flex rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-300">{statusLabel(report.status)}</span></span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Operations Map</h2>
              <p className="text-xs text-muted-foreground">Live report locations</p>
            </div>
            <Link to="/app/map" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:text-primary/80">
              View Full Map <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <CommunityMap compact />
        </div>
      </section>

      <section aria-label="Operations details" className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <div className="min-w-0 rounded-2xl border border-slate-700/70 bg-slate-950 p-4 shadow-soft sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Volunteer Availability</h2>
              <p className="mt-1 text-xs text-slate-400">Verified volunteers with remaining capacity</p>
            </div>
            <Link to="/app/supervisor/matching" aria-label="View volunteer matching" className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-sky-400/40 hover:text-white">
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4 flex items-baseline gap-2 border-b border-slate-800 pb-3">
            <span className="text-2xl font-semibold tabular-nums text-emerald-300">{availableVolunteers.length}</span>
            <span className="text-xs text-slate-400">available of {volunteers.length} volunteers</span>
          </div>
          {availableVolunteers.length === 0 ? (
            <p className="py-5 text-sm text-slate-400">No verified volunteers currently have capacity.</p>
          ) : (
            <div className="mt-2 divide-y divide-slate-800">
              {availableVolunteers.slice(0, 4).map((volunteer) => {
                const name = volunteer.profile?.full_name || 'Volunteer';
                const initials = name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
                const capacity = Math.min(100, Math.round((volunteer.current_workload / Math.max(volunteer.max_workload, 1)) * 100));
                return (
                  <div key={volunteer.id} className="flex items-center gap-3 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-xs font-semibold text-emerald-300">{initials}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-100">{name}</p>
                        <span className="shrink-0 text-[10px] text-emerald-300">Available</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${capacity}%` }} />
                        </div>
                        <span className="text-[10px] tabular-nums text-slate-500">{volunteer.current_workload}/{volunteer.max_workload}</span>
                      </div>
                      {volunteer.service_area && <p className="mt-1 truncate text-[10px] text-slate-500">{volunteer.service_area}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-700/70 bg-slate-950 p-4 shadow-soft sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Pending Verification</h2>
              <p className="mt-1 text-xs text-slate-400">Volunteer evidence awaiting review</p>
            </div>
            <Link to="/app/supervisor/verification" aria-label="Review pending evidence" className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-sky-400/40 hover:text-white">
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          {pendingVerification.length === 0 ? (
            <p className="py-5 text-sm text-slate-400">No pending verifications.</p>
          ) : (
            <div className="mt-3 divide-y divide-slate-800">
              {pendingVerification.slice(0, 4).map((task) => (
                <Link key={task.id} to={`/app/tasks/${task.id}`} className="block rounded-lg py-3 transition hover:bg-slate-900/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] text-slate-500">{task.task_id}</p>
                      <p className="mt-1 truncate text-sm font-medium text-slate-100">{task.title}</p>
                      <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-slate-400">
                        <MapPin className="h-3 w-3 shrink-0" />{task.report?.location?.address || task.report?.location?.area || 'Location unavailable'}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${priorityClasses(task.priority_level)}`}>{task.priority_level || 'Unassigned'}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500">Updated {formatDate(task.updated_at)}</span>
                    <span className="text-[10px] font-medium text-sky-300">Review details</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <Link to="/app/supervisor/verification" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-300 hover:text-sky-200">Open verification queue <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>

        <div className="min-w-0 rounded-2xl border border-slate-700/70 bg-slate-950 p-4 shadow-soft sm:p-5 md:col-span-2 xl:col-span-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Response Performance</h2>
              <p className="mt-1 text-xs text-slate-400">Current workload indicators</p>
            </div>
            <Activity className="h-5 w-5 text-sky-300" />
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-400/10 text-sky-300"><Clock3 className="h-4 w-4" /></div>
                <div><p className="text-sm font-medium text-slate-200">Active Tasks</p><p className="text-[10px] text-slate-500">Accepted or in progress</p></div>
              </div>
              <span className="text-xl font-semibold tabular-nums text-white">{activeTasks.length}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300"><Users className="h-4 w-4" /></div>
                <div><p className="text-sm font-medium text-slate-200">Awaiting Assignment</p><p className="text-[10px] text-slate-500">Verified or prioritized reports</p></div>
              </div>
              <span className="text-xl font-semibold tabular-nums text-white">{unassigned.length}</span>
            </div>
          </div>
          <Link to="/app/analytics" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-sky-300 hover:text-sky-200">Open analytics <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      </section>
    </div>
  );
}
