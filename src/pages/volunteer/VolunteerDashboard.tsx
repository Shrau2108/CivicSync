import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, ClipboardList, CheckSquare, Clock, TrendingUp, MapPin } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatCard, EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { fetchTasksForVolunteer, fetchVolunteerByUserId } from '@/services/api';
import { formatDate } from '@/lib/utils';
import type { Task, Volunteer } from '@/types';

export function VolunteerDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [t, v] = await Promise.all([
        fetchTasksForVolunteer(user.id),
        fetchVolunteerByUserId(user.id),
      ]);
      setTasks(t);
      setVolunteer(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState message="Loading your dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const activeTasks = tasks.filter(t => ['accepted', 'in_progress'].includes(t.status));
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const assignedTasks = tasks.filter(t => t.status === 'assigned');

  return (
    <div>
      <PageHeader
        title="Volunteer Overview"
        description="Your tasks, contributions, and available opportunities"
        action={<Link to="/app/volunteer/available" className="btn-primary"><ListChecks className="w-4 h-4" /> Browse Tasks</Link>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Available" value={assignedTasks.length} icon={<Clock className="w-5 h-5" />} color="amber" />
        <StatCard label="Active" value={activeTasks.length} icon={<ClipboardList className="w-5 h-5" />} color="primary" />
        <StatCard label="Completed" value={completedTasks.length} icon={<CheckSquare className="w-5 h-5" />} color="teal" />
        <StatCard label="Rating" value={volunteer?.rating?.toFixed(1) || '—'} icon={<TrendingUp className="w-5 h-5" />} color="navy" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-base font-semibold text-charcoal-800 mb-3">Active Tasks</h2>
          {activeTasks.length === 0 ? (
            <Card><CardBody>
              <EmptyState
                icon={<ClipboardList className="w-8 h-8" />}
                title="No active tasks"
                description="Browse available tasks to accept one"
                action={<Link to="/app/volunteer/available" className="btn-primary"><ListChecks className="w-4 h-4" /> Browse Tasks</Link>}
              />
            </CardBody></Card>
          ) : (
            <div className="space-y-3">
              {activeTasks.map((task) => (
                <Link key={task.id} to={`/app/tasks/${task.id}`}>
                  <Card hoverable>
                    <CardBody>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-mono text-charcoal-400">{task.task_id}</span>
                        <StatusBadge status={task.status} />
                      </div>
                      <p className="font-medium text-charcoal-800 truncate">{task.title}</p>
                      {task.report?.location && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-charcoal-400">
                          <MapPin className="w-3 h-3" />
                          {task.report.location.latitude.toFixed(2)}, {task.report.location.longitude.toFixed(2)}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <PriorityBadge level={task.priority_level} />
                        <span className="text-xs text-charcoal-400">{formatDate(task.created_at)}</span>
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-base font-semibold text-charcoal-800 mb-3">Your Profile</h2>
          {volunteer ? (
            <Card>
              <CardBody className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-charcoal-500">Verification Status</span>
                  <span className={`badge border ${volunteer.is_verified ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    {volunteer.verification_status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-charcoal-500">Workload</span>
                  <span className="text-sm text-charcoal-700">{volunteer.current_workload} / {volunteer.max_workload}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-charcoal-500">Completed Tasks</span>
                  <span className="text-sm text-charcoal-700">{volunteer.completed_tasks}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-charcoal-500">Service Area</span>
                  <span className="text-sm text-charcoal-700">{volunteer.service_area || '—'}</span>
                </div>
                {volunteer.skills && volunteer.skills.length > 0 && (
                  <div>
                    <p className="text-sm text-charcoal-500 mb-1">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {volunteer.skills.map(s => (
                        <span key={s.id} className="badge bg-charcoal-100 text-charcoal-700 border border-charcoal-200">{s.skill}</span>
                      ))}
                    </div>
                  </div>
                )}
                <Link to="/app/profile" className="btn-secondary w-full text-sm">Edit Profile</Link>
              </CardBody>
            </Card>
          ) : (
            <Card><CardBody>
              <EmptyState
                icon={<ClipboardList className="w-8 h-8" />}
                title="No volunteer profile"
                description="Complete your volunteer profile to start accepting tasks"
                action={<Link to="/app/profile" className="btn-primary">Set Up Profile</Link>}
              />
            </CardBody></Card>
          )}
        </div>
      </div>
    </div>
  );
}
