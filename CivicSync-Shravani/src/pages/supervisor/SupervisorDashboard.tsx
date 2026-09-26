import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, AlertTriangle, Clock, ListChecks, ShieldCheck, CheckSquare, UserCheck, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatCard, EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { fetchReports, fetchTasks, fetchVolunteers } from '@/services/api';
import { formatDate } from '@/lib/utils';
import type { Report, Task, Volunteer } from '@/types';

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

  return (
    <div>
      <PageHeader title="Operations Dashboard" description="Monitor reports, tasks, and volunteer activity" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Incoming Reports" value={incoming.length} icon={<Inbox className="w-5 h-5" />} color="primary" />
        <StatCard label="Critical" value={critical.length} icon={<AlertTriangle className="w-5 h-5" />} color="red" />
        <StatCard label="Pending Verification" value={pendingVerification.length} icon={<ShieldCheck className="w-5 h-5" />} color="amber" />
        <StatCard label="Available Volunteers" value={availableVolunteers.length} icon={<UserCheck className="w-5 h-5" />} color="teal" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-charcoal-800">Incoming Reports</h2>
            <Link to="/app/supervisor/incoming" className="text-sm text-primary-600 hover:text-primary-700">View All</Link>
          </div>
          {incoming.length === 0 ? (
            <Card><CardBody><EmptyState icon={<Inbox className="w-8 h-8" />} title="No incoming reports" /></CardBody></Card>
          ) : (
            <div className="space-y-3">
              {incoming.slice(0, 5).map((report) => (
                <Link key={report.id} to={`/app/reports/${report.id}`}>
                  <Card hoverable>
                    <CardBody>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-mono text-charcoal-400">{report.report_id}</span>
                        <StatusBadge status={report.status} />
                      </div>
                      <p className="font-medium text-charcoal-800 truncate">{report.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {report.category && <span className="text-xs text-charcoal-500">{report.category.name}</span>}
                        <span className="text-xs text-charcoal-400">{formatDate(report.created_at)}</span>
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-charcoal-800">Pending Verification</h2>
            <Link to="/app/supervisor/verification" className="text-sm text-primary-600 hover:text-primary-700">View All</Link>
          </div>
          {pendingVerification.length === 0 ? (
            <Card><CardBody><EmptyState icon={<ShieldCheck className="w-8 h-8" />} title="No pending verifications" /></CardBody></Card>
          ) : (
            <div className="space-y-3">
              {pendingVerification.slice(0, 5).map((task) => (
                <Link key={task.id} to={`/app/tasks/${task.id}`}>
                  <Card hoverable>
                    <CardBody>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-mono text-charcoal-400">{task.task_id}</span>
                        <StatusBadge status={task.status} />
                      </div>
                      <p className="font-medium text-charcoal-800 truncate">{task.title}</p>
                      <p className="text-xs text-charcoal-400 mt-1">{formatDate(task.updated_at)}</p>
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
