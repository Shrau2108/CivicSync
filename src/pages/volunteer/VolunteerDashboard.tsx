import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCheck,
  ClipboardList,
  Clock3,
  MapPin,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { fetchNotifications, fetchTasksForVolunteer, fetchVolunteerByUserId } from '@/services/api';
import { formatDate, timeAgo } from '@/lib/utils';
import type { Notification, Task, Volunteer } from '@/types';

const CLOSED_TASK_STATUSES = ['completed', 'rejected', 'cancelled', 'declined', 'reassigned'];
const ACTIVE_TASK_STATUSES = ['accepted', 'in_progress'];

function getTaskLocation(task: Task) {
  return task.report?.location?.area
    || task.report?.location?.city
    || task.report?.location?.address
    || task.category?.name
    || 'Community task';
}

function getDeadlineTime(task: Task) {
  return task.deadline ? new Date(task.deadline).getTime() : Number.POSITIVE_INFINITY;
}

export function VolunteerDashboard() {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const targetUserId = user?.id;
      if (!targetUserId) {
        setTasks([]);
        setVolunteer(null);
        setNotifications([]);
        return;
      }
      const results = await Promise.allSettled([
        fetchTasksForVolunteer(targetUserId),
        fetchVolunteerByUserId(targetUserId),
        fetchNotifications(targetUserId),
      ]);
      const t = results[0].status === 'fulfilled' ? results[0].value : [];
      const v = results[1].status === 'fulfilled' ? results[1].value : null;
      const n = results[2].status === 'fulfilled' ? results[2].value : [];
      setTasks(t);
      setVolunteer(v);
      setNotifications(n);
    } catch (err) {
      console.warn('Volunteer dashboard data load warning:', err);
      setTasks([]);
      setVolunteer(null);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const safety = setTimeout(() => {
      setLoading(false);
    }, 2500);
    load().finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [load]);

  if (loading) return <LoadingState message="Loading your dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const assignedTasks = tasks.filter((task) => {
    const assignment = task.assignments?.find((item) => item.volunteer_id === user?.id);
    return assignment && !['declined', 'cancelled', 'reassigned'].includes(assignment.status);
  });
  const activeTasks = assignedTasks.filter((task) => ACTIVE_TASK_STATUSES.includes(task.status));
  const incomingTasks = assignedTasks
    .filter((task) => task.assignments?.some((assignment) => assignment.volunteer_id === user?.id && assignment.status === 'assigned'))
    .sort((first, second) => getDeadlineTime(first) - getDeadlineTime(second));
  const completedTasks = assignedTasks.filter((task) => task.status === 'completed');
  const overdueTasks = assignedTasks.filter((task) =>
    task.deadline
    && getDeadlineTime(task) < Date.now()
    && !CLOSED_TASK_STATUSES.includes(task.status)
  ).sort((first, second) => getDeadlineTime(first) - getDeadlineTime(second));
  const upcomingTasks = assignedTasks.filter((task) => {
    const deadline = getDeadlineTime(task);
    return task.deadline
      && deadline >= Date.now()
      && deadline <= Date.now() + 48 * 60 * 60 * 1000
      && !CLOSED_TASK_STATUSES.includes(task.status);
  }).sort((first, second) => getDeadlineTime(first) - getDeadlineTime(second));
  const unreadNotifications = notifications.filter((notification) => !notification.is_read).slice(0, 3);
  const volunteerName = profile?.full_name || user?.email?.split('@')[0] || 'there';
  const rating = volunteer?.rating;
  const workloadPercent = volunteer?.max_workload
    ? Math.min(100, Math.round((volunteer.current_workload / volunteer.max_workload) * 100))
    : 0;

  const renderTask = (task: Task, detail: string) => (
    <Link key={task.id} to={`/app/tasks/${task.id}`} className="block rounded-xl border border-border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">{task.task_id}</span>
        <div className="flex items-center gap-2">
          <PriorityBadge level={task.priority_level} />
          <StatusBadge status={task.status} />
        </div>
      </div>
      <p className="mt-2 font-semibold text-foreground">{task.title}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{getTaskLocation(task)}</span>
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>{detail}</span>
        {task.deadline && <span className="font-medium">Due {formatDate(task.deadline)}</span>}
      </div>
    </Link>
  );

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-5 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-primary">Volunteer workspace</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Good to see you, {volunteerName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your assignments, deadlines, and community impact in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/app/volunteer/tasks" className="btn-secondary"><ClipboardList className="h-4 w-4" /> My Tasks</Link>
          <Link to="/app/volunteer/available" className="btn-primary">Find a Task <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </header>

      <section aria-label="Volunteer task summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Assigned', value: assignedTasks.length, detail: 'All tasks assigned to you', icon: ClipboardList, tone: 'text-sky-600 bg-sky-500/10' },
          { label: 'Active', value: activeTasks.length, detail: 'Accepted or in progress', icon: Clock3, tone: 'text-amber-600 bg-amber-500/10' },
          { label: 'Completed', value: completedTasks.length, detail: 'Finished assignments', icon: CheckCheck, tone: 'text-emerald-600 bg-emerald-500/10' },
          { label: 'Overdue', value: overdueTasks.length, detail: 'Needs your attention', icon: AlertTriangle, tone: overdueTasks.length ? 'text-red-600 bg-red-500/10' : 'text-muted-foreground bg-muted' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-soft sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{item.value}</p>
                </div>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">{item.detail}</p>
            </article>
          );
        })}
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
        <div className="min-w-0 space-y-5">
          <section className="min-w-0 rounded-xl border border-border bg-card shadow-soft">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
              <div>
                <h2 className="font-semibold text-foreground">Incoming tasks</h2>
                <p className="mt-1 text-xs text-muted-foreground">Assignments waiting for you to get started</p>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{incomingTasks.length}</span>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              {incomingTasks.length ? incomingTasks.slice(0, 3).map((task) => renderTask(task, `Assigned ${timeAgo(task.created_at)}`)) : (
                <EmptyState icon={<ClipboardList className="h-7 w-7" />} title="You're all caught up" description="New assignments will appear here." />
              )}
              {incomingTasks.length > 3 && <Link to="/app/volunteer/tasks" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">See all incoming tasks <ArrowRight className="h-4 w-4" /></Link>}
            </div>
          </section>

          <section className="min-w-0 rounded-xl border border-border bg-card shadow-soft">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
              <div>
                <h2 className="font-semibold text-foreground">Active work</h2>
                <p className="mt-1 text-xs text-muted-foreground">Accepted tasks that are underway</p>
              </div>
              <Link to="/app/volunteer/tasks" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">My tasks <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              {activeTasks.length ? activeTasks.slice(0, 4).map((task) => renderTask(task, `Updated ${timeAgo(task.updated_at)}`)) : (
                <EmptyState icon={<Clock3 className="h-7 w-7" />} title="No active work" description="Accept an incoming assignment or find a task to get started." action={<Link to="/app/volunteer/available" className="btn-primary">Browse tasks <ArrowRight className="h-4 w-4" /></Link>} />
              )}
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-5">
          <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">Volunteer rating</h2>
                <p className="mt-1 text-xs text-muted-foreground">Community feedback on your work</p>
              </div>
              <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
            </div>
            <div className="mt-5 flex items-end gap-2">
              <span className="text-4xl font-semibold tabular-nums text-foreground">{rating == null ? '—' : rating.toFixed(1)}</span>
              <span className="pb-1 text-sm text-muted-foreground">/ 5</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{volunteer?.total_ratings ?? 0} {volunteer?.total_ratings === 1 ? 'review' : 'reviews'}</p>
            <div className="mt-5 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Verification</span>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${volunteer?.is_verified ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700' : 'border-amber-500/20 bg-amber-500/10 text-amber-700'}`}>
                  {volunteer?.verification_status || 'Profile needed'}
                </span>
              </div>
              {volunteer && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Current workload</span>
                    <span>{volunteer.current_workload} / {volunteer.max_workload}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${workloadPercent}%` }} />
                  </div>
                </div>
              )}
              <Link to="/app/profile" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">View profile <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card shadow-soft">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-foreground"><CalendarClock className="h-4 w-4" /> Deadlines</h2>
                <p className="mt-1 text-xs text-muted-foreground">Overdue and due within 48 hours</p>
              </div>
              {(overdueTasks.length + upcomingTasks.length) > 0 && <span className="text-xs font-semibold text-muted-foreground">{overdueTasks.length + upcomingTasks.length}</span>}
            </div>
            <div className="divide-y divide-border px-4">
              {[...overdueTasks, ...upcomingTasks].slice(0, 4).map((task) => {
                const overdue = overdueTasks.some((item) => item.id === task.id);
                return (
                  <Link key={task.id} to={`/app/tasks/${task.id}`} className="flex items-start gap-3 py-3 hover:text-primary">
                    <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${overdue ? 'text-red-500' : 'text-amber-500'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{task.title}</span>
                      <span className={`mt-1 block text-xs ${overdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {overdue ? 'Overdue' : 'Due'} {formatDate(task.deadline!)}
                      </span>
                    </span>
                  </Link>
                );
              })}
              {!overdueTasks.length && !upcomingTasks.length && <p className="py-4 text-sm text-muted-foreground">No urgent deadlines. You're on track.</p>}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card shadow-soft">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-foreground"><Bell className="h-4 w-4" /> Alerts</h2>
                <p className="mt-1 text-xs text-muted-foreground">Unread updates for your account</p>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{unreadNotifications.length}</span>
            </div>
            <div className="divide-y divide-border px-4">
              {unreadNotifications.length ? unreadNotifications.map((notification) => (
                <Link key={notification.id} to={notification.related_task_id ? `/app/tasks/${notification.related_task_id}` : '/app/notifications'} className="block py-3 hover:text-primary">
                  <span className="block text-sm font-medium text-foreground">{notification.title}</span>
                  <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">{notification.description || 'You have a new update.'}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">{timeAgo(notification.created_at)}</span>
                </Link>
              )) : <p className="py-4 text-sm text-muted-foreground">You're up to date.</p>}
              <Link to="/app/notifications" className="flex items-center gap-1 py-3 text-sm font-medium text-primary hover:underline">View notifications <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
