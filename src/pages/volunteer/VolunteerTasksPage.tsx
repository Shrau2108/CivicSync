import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCheck,
  ClipboardList,
  Clock3,
  MapPin,
  Search,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { fetchTasksForVolunteer, fetchTasks } from '@/services/api';
import { formatDate, timeAgo } from '@/lib/utils';
import type { Task } from '@/types';

type TaskView = 'active' | 'acceptance' | 'progress' | 'review';

const ACTIVE_STATUSES = ['assigned', 'accepted', 'in_progress', 'evidence_submitted', 'under_verification'];

function getTaskLocation(task: Task) {
  return task.report?.location?.area
    || task.report?.location?.city
    || task.report?.location?.address
    || task.category?.name
    || 'Location not provided';
}

function getNextStep(task: Task) {
  if (task.status === 'assigned') return 'Review and accept this assignment';
  if (task.status === 'accepted') return 'Start the task when you are ready';
  if (task.status === 'in_progress') return 'Continue work and upload evidence';
  if (task.status === 'evidence_submitted' || task.status === 'under_verification') return 'Evidence is with your supervisor';
  if (task.status === 'completed') return 'Task completed';
  return 'Open task details';
}

function getDeadlineTime(task: Task) {
  return task.deadline ? new Date(task.deadline).getTime() : Number.POSITIVE_INFINITY;
}

export function VolunteerTasksPage() {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [taskView, setTaskView] = useState<TaskView>('active');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const t = profile?.role === 'admin' ? await fetchTasks() : await fetchTasksForVolunteer(user.id);
      setTasks(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => { load(); }, [load]);

  const isAdmin = profile?.role === 'admin';
  const activeTasks = tasks.filter((task) => ACTIVE_STATUSES.includes(task.status));
  const acceptanceTasks = activeTasks.filter((task) => task.status === 'assigned');
  const progressTasks = activeTasks.filter((task) => ['accepted', 'in_progress'].includes(task.status));
  const reviewTasks = activeTasks.filter((task) => ['evidence_submitted', 'under_verification'].includes(task.status));
  const overdueTasks = activeTasks.filter((task) => task.deadline && getDeadlineTime(task) < Date.now());

  const filtered = useMemo(() => {
    const visibleTasks = isAdmin
      ? tasks
      : taskView === 'acceptance'
        ? acceptanceTasks
        : taskView === 'progress'
          ? progressTasks
          : taskView === 'review'
            ? reviewTasks
            : activeTasks;
    const query = search.trim().toLowerCase();
    return visibleTasks
      .filter((task) => {
        const searchText = [task.title, task.task_id, task.report?.report_id, task.category?.name, getTaskLocation(task)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return !query || searchText.includes(query);
      })
      .sort((first, second) => {
        const firstOverdue = Boolean(first.deadline && getDeadlineTime(first) < Date.now());
        const secondOverdue = Boolean(second.deadline && getDeadlineTime(second) < Date.now());
        if (firstOverdue !== secondOverdue) return firstOverdue ? -1 : 1;
        return getDeadlineTime(first) - getDeadlineTime(second);
      });
  }, [acceptanceTasks, activeTasks, isAdmin, progressTasks, reviewTasks, search, taskView, tasks]);

  if (loading) return <LoadingState message="Loading tasks..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title={isAdmin ? 'All Tasks' : 'My Tasks'}
        description={isAdmin ? 'Review assignments across the volunteer team' : 'Your assignments, next steps, and deadlines'}
        action={!isAdmin && <Link to="/app/volunteer/available" className="btn-primary"><ClipboardList className="h-4 w-4" /> Find a Task</Link>}
      />

      {!isAdmin && (
        <section aria-label="Task workload summary" className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: 'Needs acceptance', value: acceptanceTasks.length, icon: UserRoundCheck, tone: 'text-sky-700 bg-sky-500/10' },
            { label: 'In progress', value: progressTasks.length, icon: Clock3, tone: 'text-amber-700 bg-amber-500/10' },
            { label: 'Awaiting review', value: reviewTasks.length, icon: ShieldCheck, tone: 'text-primary bg-primary/10' },
            { label: 'Overdue', value: overdueTasks.length, icon: AlertTriangle, tone: overdueTasks.length ? 'text-red-700 bg-red-500/10' : 'text-muted-foreground bg-muted' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="rounded-xl border border-border bg-card p-4 shadow-soft">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.tone}`}><Icon className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{item.value}</p>
              </article>
            );
          })}
        </section>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-10"
          placeholder={isAdmin ? 'Search all tasks...' : 'Search your tasks...'}
          aria-label={isAdmin ? 'Search all tasks' : 'Search your tasks'}
        />
      </div>

      {!isAdmin && (
        <div className="mb-4 flex flex-wrap gap-1 border-b border-border" role="tablist" aria-label="Filter my tasks">
          {[
            { id: 'active' as const, label: 'All active', count: activeTasks.length },
            { id: 'acceptance' as const, label: 'Needs acceptance', count: acceptanceTasks.length },
            { id: 'progress' as const, label: 'In progress', count: progressTasks.length },
            { id: 'review' as const, label: 'Awaiting review', count: reviewTasks.length },
          ].map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={taskView === tab.id} onClick={() => setTaskView(tab.id)} className={`border-b-2 px-3 py-3 text-sm font-medium transition-colors ${taskView === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {tab.label} <span className="ml-1 tabular-nums">{tab.count}</span>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card><CardBody>
          <EmptyState
            icon={<ClipboardList className="w-8 h-8" />}
            title={tasks.length === 0 ? 'No tasks assigned yet' : 'No tasks in this view'}
            description={tasks.length === 0 ? 'Approved assignments will appear here. Browse verified community reports to request a task.' : search ? 'Try a different search.' : 'Choose another task status to review your assignments.'}
            action={!isAdmin && <Link to="/app/volunteer/available" className="btn-primary"><ClipboardList className="h-4 w-4" /> Browse opportunities</Link>}
          />
        </CardBody></Card>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
          {filtered.map((task) => {
            const isOverdue = Boolean(task.deadline && getDeadlineTime(task) < Date.now());
            return (
              <article key={task.id} className={`min-w-0 rounded-xl border bg-card p-4 shadow-soft sm:p-5 ${isOverdue ? 'border-red-500/30' : 'border-border'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{task.task_id}</span>
                      {task.report?.report_id && <span className="text-xs text-muted-foreground">· {task.report.report_id}</span>}
                    </div>
                    <Link to={`/app/tasks/${task.id}`} className="mt-2 block text-base font-semibold text-foreground hover:text-primary">{task.title}</Link>
                  </div>
                  <PriorityBadge level={task.priority_level} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={task.status} />
                  {task.category?.name && <span className="text-xs text-muted-foreground">{task.category.name}</span>}
                </div>

                {task.description && <p className="mt-3 line-clamp-2 text-sm leading-5 text-muted-foreground">{task.description}</p>}

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{getTaskLocation(task)}</span>
                  {task.estimated_time_minutes && <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{task.estimated_time_minutes} min</span>}
                  <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{task.affected_people} affected</span>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className={`flex items-center gap-1.5 text-xs ${isOverdue ? 'font-semibold text-red-600' : 'text-muted-foreground'}`}>
                    {isOverdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                    {task.deadline ? `${isOverdue ? 'Overdue' : 'Due'} ${formatDate(task.deadline)}` : `Assigned ${timeAgo(task.created_at)}`}
                  </div>
                  <Link to={`/app/tasks/${task.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                    {getNextStep(task)} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                {task.status === 'evidence_submitted' || task.status === 'under_verification' ? (
                  <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-primary"><CheckCheck className="h-3.5 w-3.5" />Your evidence is submitted and awaiting supervisor review.</p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
