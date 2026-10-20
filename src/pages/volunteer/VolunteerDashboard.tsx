
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ListChecks,
  ClipboardList,
  CheckSquare,
  Clock,
  TrendingUp,
  MapPin,
  Search,
  ArrowRight,
  HandHeart,
  CalendarDays,
  Users,
  RefreshCw,
  Star,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { fetchTasksForVolunteer, fetchVolunteerByUserId } from '@/services/api';
import { formatDate } from '@/lib/utils';
import type { Task, Volunteer } from '@/types';

type TaskFilter = 'active' | 'available' | 'completed' | 'all';

const filters: { label: string; value: TaskFilter }[] = [
  { label: 'Active', value: 'active' },
  { label: 'Available', value: 'available' },
  { label: 'Completed', value: 'completed' },
  { label: 'All tasks', value: 'all' },
];

function MetricCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Card hoverable>
      <CardBody>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
              {value}
            </p>
          </div>
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accent}`}>
            {icon}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export function VolunteerDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('active');

  const load = useCallback(async () => {
    if (!user) {
      setTasks([]);
      setVolunteer(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [taskData, volunteerData] = await Promise.all([
        fetchTasksForVolunteer(user.id),
        fetchVolunteerByUserId(user.id),
      ]);

      setTasks(taskData);
      setVolunteer(volunteerData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeTasks = useMemo(
    () => tasks.filter(task => ['accepted', 'in_progress'].includes(task.status)),
    [tasks],
  );

  const completedTasks = useMemo(
    () => tasks.filter(task => task.status === 'completed'),
    [tasks],
  );

  const availableTasks = useMemo(
    () => tasks.filter(task => task.status === 'assigned'),
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    const base =
      taskFilter === 'active'
        ? activeTasks
        : taskFilter === 'available'
          ? availableTasks
          : taskFilter === 'completed'
            ? completedTasks
            : tasks;

    const normalizedQuery = query.trim().toLowerCase();

    return base.filter(task =>
      `${task.title} ${task.task_id}`.toLowerCase().includes(normalizedQuery),
    );
  }, [taskFilter, query, tasks, activeTasks, availableTasks, completedTasks]);

  if (loading) {
    return <LoadingState message="Loading your dashboard..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  const firstName = user?.email?.split('@')[0] || 'Volunteer';
  const workload = volunteer?.max_workload
    ? Math.min(
        100,
        Math.max(0, (volunteer.current_workload / volunteer.max_workload) * 100),
      )
    : 0;

  return (
    <div className="space-y-7 pb-8">
      <PageHeader
        title="Volunteer Dashboard"
        description="Your time and effort help make our community better."
        action={
          <Link
            to="/app/volunteer/available"
            className="btn-primary inline-flex items-center gap-2"
          >
            <ListChecks className="h-4 w-4" />
            Browse Tasks
          </Link>
        }
      />

      {/* Welcome banner: matches the main CivicSync navy-and-gold theme */}
      <section className="relative isolate overflow-hidden rounded-2xl bg-[#0B1222] p-6 text-white shadow-lg sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-16 h-64 w-64 rounded-full border-[35px] border-white/[0.04]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[-90px] right-32 h-52 w-52 rounded-full bg-[#F9B735]/10 blur-2xl"
        />

        <div className="relative max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#F9B735]/40 bg-[#F9B735]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#F9B735]">
            <HandHeart className="h-4 w-4" />
            Your community. Your impact.
          </div>

          <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
            Welcome back, {firstName}!
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
            Every task you complete brings your neighbourhood one step closer
            to being safer, cleaner, and better for everyone.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/app/volunteer/available"
              className="inline-flex items-center gap-2 rounded-xl bg-[#F9B735] px-5 py-3 text-sm font-bold text-[#111827] transition hover:bg-[#ffc957]"
            >
              Find a task
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to="/app/profile"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              View my profile
            </Link>
          </div>
        </div>
      </section>

      {/* Volunteer statistics */}
      <section aria-label="Volunteer statistics">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-6 w-1 rounded-full bg-[#F9B735]" />
          <h2 className="text-lg font-bold text-foreground">Your contribution</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Available tasks"
            value={availableTasks.length}
            icon={<Clock className="h-5 w-5" />}
            accent="bg-amber-100 text-amber-800"
          />
          <MetricCard
            label="Active tasks"
            value={activeTasks.length}
            icon={<ClipboardList className="h-5 w-5" />}
            accent="bg-blue-100 text-blue-800"
          />
          <MetricCard
            label="Tasks completed"
            value={completedTasks.length}
            icon={<CheckSquare className="h-5 w-5" />}
            accent="bg-emerald-100 text-emerald-800"
          />
          <MetricCard
            label="Volunteer rating"
            value={volunteer?.rating != null ? volunteer.rating.toFixed(1) : '—'}
            icon={<Star className="h-5 w-5" />}
            accent="bg-[#F9B735]/20 text-amber-800"
          />
        </div>
      </section>

      {/* Tasks and volunteer profile */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">Your tasks</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep track of your community work.
              </p>
            </div>

            <Link
              to="/app/volunteer/available"
              className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 transition hover:text-amber-900"
            >
              Explore tasks <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-amber-400">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search by task title or ID..."
              aria-label="Search tasks"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Filter tasks">
            {filters.map(filter => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setTaskFilter(filter.value)}
                aria-pressed={taskFilter === filter.value}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  taskFilter === filter.value
                    ? 'border-[#0B1222] bg-[#0B1222] text-white'
                    : 'border-border bg-background text-muted-foreground hover:border-amber-400 hover:text-foreground'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{filteredTasks.length} task{filteredTasks.length === 1 ? '' : 's'}</span>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setTaskFilter('active');
              }}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <RefreshCw className="h-3 w-3" />
              Reset filters
            </button>
          </div>

          {filteredTasks.length === 0 ? (
            <Card>
              <CardBody>
                <div className="flex flex-col items-center px-4 py-10 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
                    <ClipboardList className="h-7 w-7" />
                  </div>
                  <h3 className="font-semibold text-foreground">
                    {query
                      ? 'No matching tasks'
                      : taskFilter === 'active'
                        ? 'No active tasks yet'
                        : taskFilter === 'available'
                          ? 'No available tasks right now'
                          : taskFilter === 'completed'
                            ? 'Your completed tasks will appear here'
                            : 'No tasks found'}
                  </h3>
                  <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                    {query
                      ? 'Try another task name or ID, or reset your filters.'
                      : 'Explore available opportunities to make a difference in your community.'}
                  </p>
                  <Link
                    to="/app/volunteer/available"
                    className="btn-primary mt-5 inline-flex items-center gap-2"
                  >
                    <ListChecks className="h-4 w-4" />
                    Browse available tasks
                  </Link>
                </div>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map(task => (
                <Link
                  key={task.id}
                  to={`/app/tasks/${task.id}`}
                  className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <Card hoverable>
                    <CardBody>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {task.task_id}
                        </span>
                        <StatusBadge status={task.status} />
                      </div>

                      <div className="mt-3 flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-foreground transition group-hover:text-amber-700">
                          {task.title}
                        </h3>
                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-amber-700" />
                      </div>

                      {task.report?.location && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {task.report.location.latitude.toFixed(2)},{' '}
                            {task.report.location.longitude.toFixed(2)}
                          </span>
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <PriorityBadge level={task.priority_level} />
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(task.created_at)}
                        </span>
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Volunteer profile */}
        <aside className="min-w-0">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-foreground">Your volunteer profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your skills and service progress.
            </p>
          </div>

          {volunteer ? (
            <Card>
              <CardBody>
                <div className="flex items-center gap-3 border-b border-border pb-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0B1222] text-[#F9B735]">
                    <HandHeart className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold text-foreground">{firstName}</h3>
                    <p className="text-sm text-muted-foreground">Community volunteer</p>
                  </div>
                  <div
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      volunteer.is_verified
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                    }`}
                  >
                    {volunteer.verification_status}
                  </div>
                </div>

                <div className="space-y-5 py-5">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm text-muted-foreground">Task workload</span>
                      <span className="text-sm font-semibold text-foreground">
                        {volunteer.current_workload} / {volunteer.max_workload}
                      </span>
                    </div>
                    <div
                      className="h-2.5 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-label="Current task workload"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={workload}
                    >
                      <div
                        className="h-full rounded-full bg-[#F9B735] transition-all"
                        style={{ width: `${workload}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-muted/60 p-3">
                      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                        <CheckSquare className="h-4 w-4" />
                        <span className="text-xs">Completed</span>
                      </div>
                      <p className="text-xl font-bold text-foreground">
                        {volunteer.completed_tasks}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/60 p-3">
                      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span className="text-xs">Service area</span>
                      </div>
                      <p className="break-words text-sm font-semibold text-foreground">
                        {volunteer.service_area || 'Not set'}
                      </p>
                    </div>
                  </div>

                  {volunteer.skills && volunteer.skills.length > 0 ? (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-foreground">
                        Your skills
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {volunteer.skills.map(skill => (
                          <span
                            key={skill.id}
                            className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900"
                          >
                            {skill.skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Add your skills to help supervisors match you with suitable tasks.
                    </p>
                  )}
                </div>

                <Link
                  to="/app/profile"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground transition hover:border-amber-400 hover:bg-amber-50 hover:text-amber-900"
                >
                  Edit volunteer profile
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody>
                <div className="py-6 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
                    <HandHeart className="h-7 w-7" />
                  </div>
                  <h3 className="font-semibold text-foreground">
                    Complete your volunteer profile
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Set up your profile to help supervisors find the right opportunities for you.
                  </p>
                  <Link to="/app/profile" className="btn-primary mt-5 inline-flex">
                    Set up profile
                  </Link>
                </div>
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
