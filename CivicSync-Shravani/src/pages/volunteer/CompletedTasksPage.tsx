import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { fetchTasksForVolunteer } from '@/services/api';
import { formatDate } from '@/lib/utils';
import type { Task } from '@/types';

export function CompletedTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const t = await fetchTasksForVolunteer(user.id);
      setTasks(t.filter(task => task.status === 'completed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const filtered = tasks.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.task_id.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingState message="Loading completed tasks..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Completed Tasks" description="Your contribution history" />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-10"
          placeholder="Search completed tasks..."
        />
      </div>

      {filtered.length === 0 ? (
        <Card><CardBody>
          <EmptyState
            icon={<CheckSquare className="w-8 h-8" />}
            title={tasks.length === 0 ? 'No completed tasks' : 'No matching tasks'}
            description={tasks.length === 0 ? 'Complete a task to see it here' : 'Try a different search'}
          />
        </CardBody></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => (
            <Link key={task.id} to={`/app/tasks/${task.id}`}>
              <Card hoverable>
                <CardBody>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-charcoal-400">{task.task_id}</span>
                        <StatusBadge status={task.status} />
                      </div>
                      <p className="font-medium text-charcoal-800 truncate">{task.title}</p>
                      <p className="text-xs text-charcoal-400 mt-1">Completed {formatDate(task.updated_at)}</p>
                    </div>
                    <PriorityBadge level={task.priority_level} />
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
