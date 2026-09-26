import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, Search, MapPin, Clock, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { fetchAvailableTasks } from '@/services/api';
import { formatDate } from '@/lib/utils';
import type { Task } from '@/types';

export function AvailableTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const t = await fetchAvailableTasks();
      setTasks(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = tasks.filter(t => {
    const matchesSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.task_id.toLowerCase().includes(search.toLowerCase());
    const matchesPriority = priorityFilter === 'all' || t.priority_level === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  if (loading) return <LoadingState message="Loading available tasks..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Available Tasks" description="Browse and accept tasks that match your skills" />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
            placeholder="Search tasks..."
          />
        </div>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="input sm:w-48">
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardBody>
          <EmptyState
            icon={<ListChecks className="w-8 h-8" />}
            title={tasks.length === 0 ? 'No available tasks' : 'No matching tasks'}
            description={tasks.length === 0 ? 'Check back later for new task assignments' : 'Try adjusting your filters'}
          />
        </CardBody></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((task) => (
            <Link key={task.id} to={`/app/tasks/${task.id}`}>
              <Card hoverable className="h-full">
                <CardBody>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono text-charcoal-400">{task.task_id}</span>
                    <PriorityBadge level={task.priority_level} />
                  </div>
                  <p className="font-medium text-charcoal-800 mb-2">{task.title}</p>
                  {task.description && <p className="text-sm text-charcoal-500 line-clamp-2 mb-3">{task.description}</p>}
                  <div className="flex items-center gap-3 flex-wrap text-xs text-charcoal-400">
                    <StatusBadge status={task.status} />
                    {task.estimated_time_minutes && (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {task.estimated_time_minutes}m</span>
                    )}
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {task.affected_people}</span>
                    {task.report?.location && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {task.report.location.latitude.toFixed(2)}, {task.report.location.longitude.toFixed(2)}</span>
                    )}
                    <span>{formatDate(task.created_at)}</span>
                  </div>
                  {task.required_skills && task.required_skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {task.required_skills.map((skill, i) => (
                        <span key={i} className="badge bg-primary-50 text-primary-700 border border-primary-200">{skill}</span>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
