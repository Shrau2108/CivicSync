import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FileText, CheckCircle2, Clock, PlusCircle, Bell, MapPin } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatCard, EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { fetchReportsByReporter, fetchNotifications } from '@/services/api';
import { formatDate, timeAgo } from '@/lib/utils';
import type { Report, Notification } from '@/types';

export function CitizenDashboard() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [rpts, notifs] = await Promise.all([
        fetchReportsByReporter(user.id),
        fetchNotifications(user.id),
      ]);
      setReports(rpts);
      setNotifications(notifs.slice(0, 5));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const totalReports = reports.length;
  const activeReports = reports.filter(r => !['resolved', 'cancelled', 'rejected', 'duplicate'].includes(r.status)).length;
  const resolvedReports = reports.filter(r => r.status === 'resolved').length;
  const unreadNotifs = notifications.filter(n => !n.is_read).length;

  if (loading) return <LoadingState message="Loading your dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Welcome back"
        description="Track your community reports and their resolution progress"
        action={<Link to="/app/citizen/report" className="btn-primary"><PlusCircle className="w-4 h-4" /> Report an Issue</Link>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Reports" value={totalReports} icon={<FileText className="w-5 h-5" />} color="primary" />
        <StatCard label="Active" value={activeReports} icon={<Clock className="w-5 h-5" />} color="amber" />
        <StatCard label="Resolved" value={resolvedReports} icon={<CheckCircle2 className="w-5 h-5" />} color="teal" />
        <StatCard label="Unread Notifications" value={unreadNotifs} icon={<Bell className="w-5 h-5" />} color="navy" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="text-base font-semibold text-charcoal-800 mb-3">Recent Reports</h2>
          {reports.length === 0 ? (
            <Card><CardBody>
              <EmptyState
                icon={<FileText className="w-8 h-8" />}
                title="No reports yet"
                description="Start reporting community issues to track their progress"
                action={<Link to="/app/citizen/report" className="btn-primary"><PlusCircle className="w-4 h-4" /> Report an Issue</Link>}
              />
            </CardBody></Card>
          ) : (
            <div className="space-y-3">
              {reports.slice(0, 5).map((report) => (
                <Link key={report.id} to={`/app/reports/${report.id}`}>
                  <Card hoverable>
                    <CardBody className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-charcoal-800 truncate">{report.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <StatusBadge status={report.status} />
                          {report.category && <span className="text-xs text-charcoal-500">{report.category.name}</span>}
                          <span className="text-xs text-charcoal-400">{formatDate(report.created_at)}</span>
                        </div>
                      </div>
                      <PriorityBadge level={report.priority_level} />
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-base font-semibold text-charcoal-800 mb-3">Recent Notifications</h2>
          {notifications.length === 0 ? (
            <Card><CardBody>
              <EmptyState icon={<Bell className="w-8 h-8" />} title="No notifications" />
            </CardBody></Card>
          ) : (
            <Card>
              <div className="divide-y divide-charcoal-100">
                {notifications.map((notif) => (
                  <div key={notif.id} className={`p-4 ${!notif.is_read ? 'bg-primary-50/50' : ''}`}>
                    <div className="flex items-start gap-2">
                      {!notif.is_read && <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-charcoal-700">{notif.title}</p>
                        {notif.description && <p className="text-xs text-charcoal-500 mt-0.5">{notif.description}</p>}
                        <p className="text-xs text-charcoal-400 mt-1">{timeAgo(notif.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Link to="/app/notifications" className="btn-ghost w-full mt-3 text-sm">View All Notifications</Link>
        </div>
      </div>
    </div>
  );
}
