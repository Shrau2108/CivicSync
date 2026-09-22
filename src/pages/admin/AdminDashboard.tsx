import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, FileText, ClipboardList, CheckSquare, AlertTriangle, Clock, TrendingUp, Activity } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatCard, LoadingState, ErrorState } from '@/components/ui/States';
import { Card, CardBody } from '@/components/ui/Card';
import { fetchAllProfiles, fetchReports, fetchTasks, fetchVolunteers, fetchAuditLogs } from '@/services/api';
import { formatDate, timeAgo } from '@/lib/utils';
import type { Profile, Report, Task, Volunteer, AuditLog } from '@/types';

export function AdminDashboard() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, r, t, v, a] = await Promise.all([
        fetchAllProfiles(), fetchReports(), fetchTasks(), fetchVolunteers(), fetchAuditLogs(10),
      ]);
      setProfiles(p);
      setReports(r);
      setTasks(t);
      setVolunteers(v);
      setAuditLogs(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState message="Loading admin dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const totalUsers = profiles.length;
  const activeCases = reports.filter(r => !['resolved','cancelled','rejected','duplicate'].includes(r.status)).length;
  const resolvedCases = reports.filter(r => r.status === 'resolved').length;
  const criticalCases = reports.filter(r => r.priority_level === 'critical' && !['resolved','cancelled','rejected','duplicate'].includes(r.status)).length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const verifiedVolunteers = volunteers.filter(v => v.is_verified).length;

  const roleDistribution = {
    citizen: profiles.filter(p => p.role === 'citizen').length,
    volunteer: profiles.filter(p => p.role === 'volunteer').length,
    supervisor: profiles.filter(p => p.role === 'supervisor').length,
    admin: profiles.filter(p => p.role === 'admin').length,
  };

  return (
    <div>
      <PageHeader title="Admin Dashboard" description="System overview and management" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Users" value={totalUsers} icon={<Users className="w-5 h-5" />} color="primary" />
        <StatCard label="Total Reports" value={reports.length} icon={<FileText className="w-5 h-5" />} color="navy" />
        <StatCard label="Active Cases" value={activeCases} icon={<AlertTriangle className="w-5 h-5" />} color="amber" />
        <StatCard label="Resolved" value={resolvedCases} icon={<CheckSquare className="w-5 h-5" />} color="teal" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Critical Cases" value={criticalCases} icon={<AlertTriangle className="w-5 h-5" />} color="red" />
        <StatCard label="Completed Tasks" value={completedTasks} icon={<CheckSquare className="w-5 h-5" />} color="teal" />
        <StatCard label="Verified Volunteers" value={verifiedVolunteers} icon={<Users className="w-5 h-5" />} color="primary" />
        <StatCard label="Total Tasks" value={tasks.length} icon={<ClipboardList className="w-5 h-5" />} color="navy" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <h2 className="text-base font-semibold text-charcoal-800 mb-3">Role Distribution</h2>
          <Card>
            <CardBody className="space-y-3">
              {Object.entries(roleDistribution).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between">
                  <span className="text-sm text-charcoal-600 capitalize">{role}</span>
                  <span className="text-sm font-medium text-charcoal-800">{count}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-charcoal-800">Recent Activity</h2>
            <Link to="/app/audit" className="text-sm text-primary-600 hover:text-primary-700">View All</Link>
          </div>
          {auditLogs.length === 0 ? (
            <Card><CardBody><p className="text-sm text-charcoal-400 text-center py-4">No recent activity</p></CardBody></Card>
          ) : (
            <Card>
              <div className="divide-y divide-charcoal-100">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-charcoal-100 flex items-center justify-center flex-shrink-0">
                      <Activity className="w-4 h-4 text-charcoal-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-charcoal-700">
                        <span className="font-medium">{log.actor?.full_name || 'System'}</span>
                        {' '}<span className="text-charcoal-500">{log.action.replace(/_/g, ' ')}</span>
                      </p>
                      <p className="text-xs text-charcoal-400">{timeAgo(log.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
