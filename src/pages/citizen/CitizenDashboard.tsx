import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { LoadingState, ErrorState } from '@/components/ui/States';
import {
  fetchReportsByReporter,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/services/api';
import { formatDate, timeAgo } from '@/lib/utils';
import type { Notification, Report } from '@/types';

const statusProgress: Record<string, number> = {
  submitted: 20,
  under_review: 35,
  verified: 55,
  prioritized: 50,
  assigned: 50,
  accepted: 60,
  in_progress: 70,
  evidence_submitted: 80,
  under_verification: 85,
  resolved: 100,
  completed: 100,
  rejected: 0,
  duplicate: 0,
  reopened: 30,
  cancelled: 0,
  declined: 0,
  reassigned: 50,
};

const sixMonthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

function getAreaLabel(report: Report): string {
  return report.location?.area || report.location?.city || report.category?.name || 'Community';
}

function getReportMatchingScore(report: Report, query: string): number {
  const haystack = [
    report.title,
    report.description,
    report.category?.name ?? '',
    report.location?.address ?? '',
    report.location?.area ?? '',
    report.location?.city ?? '',
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query.toLowerCase()) ? 1 : 0;
}

export function CitizenDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | string>('all');
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [reportList, notificationList] = await Promise.all([
        fetchReportsByReporter(user.id),
        fetchNotifications(user.id),
      ]);
      setReports(reportList);
      setNotifications(notificationList.slice(0, 6));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const unreadNotifications = notifications.filter((item) => !item.is_read);

  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [reports]
  );

  const filteredReports = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return sortedReports.filter((report) => {
      const matchesQuery = !normalizedQuery || getReportMatchingScore(report, normalizedQuery) > 0;
      const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || report.priority_level === priorityFilter;
      return matchesQuery && matchesStatus && matchesPriority;
    });
  }, [sortedReports, searchQuery, statusFilter, priorityFilter]);

  const totalReports = reports.length;
  const activeReports = reports.filter((report) => !['resolved', 'cancelled', 'rejected', 'duplicate'].includes(report.status)).length;
  const resolvedReports = reports.filter((report) => report.status === 'resolved').length;
  const pendingActions = reports.filter((report) => ['submitted', 'under_review', 'assigned', 'in_progress', 'accepted', 'reopened', 'under_verification'].includes(report.status)).length;

  const changeRate = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const statCards = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const previousMonth = (currentMonth + 11) % 12;

    const monthValue = (targetMonth: number) =>
      reports.filter((report) => new Date(report.created_at).getMonth() === targetMonth).length;

    const totalPrevious = monthValue(previousMonth);
    const activePrevious = reports.filter((report) => {
      const createdMonth = new Date(report.created_at).getMonth();
      return createdMonth === previousMonth && !['resolved', 'cancelled', 'rejected', 'duplicate'].includes(report.status);
    }).length;
    const resolvedPrevious = reports.filter((report) => new Date(report.created_at).getMonth() === previousMonth && report.status === 'resolved').length;
    const pendingPrevious = reports.filter((report) => {
      const createdMonth = new Date(report.created_at).getMonth();
      return createdMonth === previousMonth && ['submitted', 'under_review', 'assigned', 'in_progress', 'accepted', 'reopened', 'under_verification'].includes(report.status);
    }).length;

    return [
      { label: 'Total Reports', value: totalReports, icon: FileText, color: 'primary', trend: `${changeRate(totalReports, totalPrevious) >= 0 ? '↑' : '↓'} ${Math.abs(changeRate(totalReports, totalPrevious))}%`, trendUp: changeRate(totalReports, totalPrevious) >= 0 },
      { label: 'Active Reports', value: activeReports, icon: Clock3, color: 'amber', trend: `${changeRate(activeReports, activePrevious) >= 0 ? '↑' : '↓'} ${Math.abs(changeRate(activeReports, activePrevious))}%`, trendUp: changeRate(activeReports, activePrevious) >= 0 },
      { label: 'Resolved Reports', value: resolvedReports, icon: CheckCheck, color: 'teal', trend: `${changeRate(resolvedReports, resolvedPrevious) >= 0 ? '↑' : '↓'} ${Math.abs(changeRate(resolvedReports, resolvedPrevious))}%`, trendUp: changeRate(resolvedReports, resolvedPrevious) >= 0 },
      { label: 'Pending Actions', value: pendingActions, icon: AlertTriangle, color: 'red', trend: `${changeRate(pendingActions, pendingPrevious) >= 0 ? '↑' : '↓'} ${Math.abs(changeRate(pendingActions, pendingPrevious))}%`, trendUp: changeRate(pendingActions, pendingPrevious) <= 0 },
    ];
  }, [activeReports, pendingActions, reports, resolvedReports, totalReports]);

  const activities = useMemo(() => {
    const reportActivities = reports.slice(0, 4).map((report) => ({
      id: `${report.id}-activity`,
      title: report.status === 'resolved' ? 'Issue resolved' : report.status === 'assigned' ? 'Issue assigned to municipal team' : report.status === 'submitted' ? 'New report submitted' : 'Issue status updated',
      description: `${getAreaLabel(report)} • ${report.title}`,
      timestamp: timeAgo(report.updated_at || report.created_at),
      status: report.status,
    }));

    const notificationActivities = notifications.slice(0, 3).map((notification) => ({
      id: notification.id,
      title: notification.title,
      description: notification.description || 'New update from the community team',
      timestamp: timeAgo(notification.created_at),
      status: notification.is_read ? 'read' : 'unread',
    }));

    return [...reportActivities, ...notificationActivities].slice(0, 4);
  }, [notifications, reports]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    reports.forEach((report) => {
      const key = report.category?.name || 'Uncategorized';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [reports]);

  const impactData = useMemo(() => {
    const currentDate = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - 5 + index, 1);
      return { label: sixMonthLabels[index], monthIndex: date.getMonth(), year: date.getFullYear() };
    });

    return months.map(({ label, monthIndex, year }) => {
      const reported = reports.filter((report) => {
        const created = new Date(report.created_at);
        return created.getMonth() === monthIndex && created.getFullYear() === year;
      }).length;

      const resolved = reports.filter((report) => {
        if (!report.resolved_at) return false;
        const resolvedDate = new Date(report.resolved_at);
        return resolvedDate.getMonth() === monthIndex && resolvedDate.getFullYear() === year;
      }).length;

      return { name: label, reported, resolved };
    });
  }, [reports]);

  const resolvedDays = useMemo(() => {
    const completedReports = reports.filter((report) => report.status === 'resolved' && report.created_at && report.resolved_at);
    if (!completedReports.length) return 0;

    const total = completedReports.reduce((sum, report) => {
      const start = new Date(report.created_at).getTime();
      const end = new Date(report.resolved_at ?? report.created_at).getTime();
      return sum + (end - start) / (1000 * 60 * 60 * 24);
    }, 0);

    return Number((total / completedReports.length).toFixed(1));
  }, [reports]);

  const activeCitizens = Math.max(12, new Set(reports.map((report) => report.reporter_id)).size + 10);
  const mapReports = (filteredReports.length ? filteredReports : reports).slice(0, 5);

  const handleMarkRead = async (notificationId: string) => {
    await markNotificationRead(notificationId);
    setNotifications((current) => current.map((notification) =>
      notification.id === notificationId ? { ...notification, is_read: true } : notification
    ));
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllNotificationsRead(user.id);
    setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
  };

  if (loading) return <LoadingState message="Loading your dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-[28px] border border-border bg-[radial-gradient(120%_120%_at_0%_0%,rgba(59,130,246,0.2),transparent_30%),linear-gradient(135deg,#0f172a,#111827_40%,#0b1120)] p-5 sm:p-6 shadow-soft">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,118,110,0.08),transparent_35%,rgba(59,130,246,0.16))]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-cyan-200">Good afternoon, {profile?.full_name || 'Demo Citizen'} 👋</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Make your <span className="text-cyan-400">community</span> better.
            </h1>
            <p className="mt-3 max-w-xl text-sm text-slate-300 sm:text-base">
              Report local issues, track their progress, and help build stronger, safer and more livable neighborhoods.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link to="/app/citizen/report" className="btn-primary px-5 py-3 text-sm font-semibold shadow-lg shadow-cyan-500/20">
                Report an Issue <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/app/citizen/reports" className="btn-secondary border border-slate-600 bg-slate-900/40 text-slate-100 hover:bg-slate-800/70">
                View My Reports
              </Link>
            </div>
          </div>

          <div className="relative hidden xl:block w-full max-w-[420px]">
            <div className="rounded-[26px] border border-slate-700/60 bg-slate-900/70 p-5 shadow-elevated backdrop-blur-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Community pulse</p>
                  <p className="mt-1 text-lg font-semibold text-white">This week</p>
                </div>
                <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300">
                  +18% impact
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Issues reported', value: `${totalReports}` },
                  { label: 'Active cases', value: `${activeReports}` },
                  { label: 'Resolved this month', value: `${resolvedReports}` },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-700/70 bg-slate-950/60 px-3 py-2.5">
                    <span className="text-sm text-slate-300">{item.label}</span>
                    <span className="text-lg font-semibold text-white">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2.5">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">Area focus</p>
                  <p className="mt-1 text-sm font-medium text-cyan-100">Sector 7 • Community Park</p>
                </div>
                <div className="rounded-full bg-cyan-400/15 p-2 text-cyan-300"><MapPin className="w-4 h-4" /></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} hoverable className="group border-border/80 bg-card/90 transition-all duration-200 hover:-translate-y-1">
              <CardBody className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                    <p className="mt-2 text-3xl font-bold text-foreground">{card.value}</p>
                    <p className={card.trendUp ? 'mt-2 text-xs font-medium text-emerald-500' : 'mt-2 text-xs font-medium text-amber-500'}>
                      {card.trend} vs last month
                    </p>
                  </div>
                  <div className={`${card.color === 'primary' ? 'bg-primary/10 text-primary' : card.color === 'amber' ? 'bg-amber-500/10 text-amber-500' : card.color === 'teal' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'} flex h-11 w-11 items-center justify-center rounded-xl`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={card.color === 'primary' ? 'h-full rounded-full bg-primary' : card.color === 'amber' ? 'h-full rounded-full bg-amber-500' : card.color === 'teal' ? 'h-full rounded-full bg-emerald-500' : 'h-full rounded-full bg-red-500'}
                    style={{ width: `${Math.min(100, Math.max(15, (card.value / Math.max(totalReports || 1, 4)) * 100))}%` }}
                  />
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
        <div className="space-y-6 min-w-0">
          <section className="space-y-4 min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Recent Reports</h2>
                <p className="text-sm text-muted-foreground">Issue history and resolution progress</p>
              </div>
              <Link to="/app/citizen/reports" className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80">
                View all reports <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/20">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="relative w-full max-w-md">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      ref={searchRef}
                      name="report-search"
                      aria-label="Search reports"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="input pl-10 pr-20"
                      placeholder="Search issues, locations, or keywords..."
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Ctrl K
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <select
                      value={statusFilter}
                      aria-label="Filter reports by status"
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="input min-w-[140px] py-2 text-sm"
                    >
                      <option value="all">All statuses</option>
                      <option value="submitted">Submitted</option>
                      <option value="under_review">Under Review</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                    <select
                      value={priorityFilter}
                      aria-label="Filter reports by priority"
                      onChange={(event) => setPriorityFilter(event.target.value)}
                      className="input min-w-[140px] py-2 text-sm"
                    >
                      <option value="all">All priorities</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
              </CardHeader>

              {filteredReports.length === 0 ? (
                <CardBody className="flex min-h-[280px] items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <FileText className="h-6 w-6" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground">No reports match your filters</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Try a different keyword or reset your filters.</p>
                  </div>
                </CardBody>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full table-auto border-collapse">
                    <thead className="bg-muted/20 text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">#</th>
                        <th className="px-4 py-3 font-medium">Issue Title</th>
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 font-medium">Location</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Priority</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Progress</th>
                        <th className="px-4 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReports.slice(0, 5).map((report, index) => (
                        <tr
                          key={report.id}
                          className="border-t border-border transition-colors hover:bg-muted/20"
                          onClick={() => navigate(`/app/reports/${report.id}`)}
                        >
                          <td className="px-4 py-3 text-sm text-muted-foreground">{index + 1}</td>
                          <td className="px-4 py-3">
                            <div className="min-w-[180px]">
                              <p className="font-medium text-foreground">{report.title}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{report.category?.name || 'Uncategorized'}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{getAreaLabel(report)}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(report.created_at)}</td>
                          <td className="px-4 py-3"><PriorityBadge level={report.priority_level} /></td>
                          <td className="px-4 py-3"><StatusBadge status={report.status} /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 min-w-[120px]">
                              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${statusProgress[report.status] ?? 20}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-muted-foreground">{statusProgress[report.status] ?? 20}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button type="button" onClick={() => navigate(`/app/reports/${report.id}`)} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80">
                              View <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </section>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border bg-muted/20">
              <CardTitle>Community Impact</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Active Citizens</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{activeCitizens}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Issues Reported</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{totalReports}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Issues Resolved</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{resolvedReports}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Avg. Resolution</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{resolvedDays || '2.8'} days</p>
                </div>
              </div>

              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={impactData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="reportedFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="resolvedFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.15)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 12, color: '#e2e8f0' }}
                    />
                    <Area type="monotone" dataKey="reported" stroke="#38bdf8" fill="url(#reportedFill)" strokeWidth={2} />
                    <Area type="monotone" dataKey="resolved" stroke="#34d399" fill="url(#resolvedFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        </div>

        <aside className="min-w-0">
          <Card className="overflow-hidden">
            <CardHeader className="flex items-center justify-between border-b border-border bg-muted/20">
              <div>
                <CardTitle>Community Activity</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Recent updates from your area</p>
              </div>
              <Link to="/app/notifications" className="text-xs font-medium text-primary hover:text-primary/80">See all</Link>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-border">
                {activities.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-4">
                    <div className={`${item.status === 'resolved' || item.status === 'read' ? 'bg-emerald-500/10 text-emerald-500' : item.status === 'submitted' || item.status === 'unread' ? 'bg-cyan-500/10 text-cyan-500' : 'bg-amber-500/10 text-amber-500'} mt-0.5 flex h-8 w-8 items-center justify-center rounded-full`}>
                      {item.status === 'resolved' ? <ShieldCheck className="h-4 w-4" /> : item.status === 'submitted' || item.status === 'unread' ? <Sparkles className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{item.timestamp}</span>
                        <span>•</span>
                        <span className="capitalize">{item.status.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border bg-muted/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Top Issue Categories</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Most reported civic concerns in your area</p>
              </div>
              <span className="rounded-full border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground">
                {categoryCounts.length} categories
              </span>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            {categoryCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No issue categories available yet.</p>
            ) : (
              categoryCounts.map((category, index) => {
                const percent = (category.count / Math.max(...categoryCounts.map((item) => item.count), 1)) * 100;
                return (
                  <div key={category.name} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                          {index + 1}
                        </span>
                        <span className="font-medium text-foreground">{category.name}</span>
                      </div>
                      <span className="font-semibold text-foreground">{category.count}</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex items-center justify-between border-b border-border bg-muted/20">
            <div>
              <CardTitle>Community Map</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Explore and see reported issues in your area</p>
            </div>
            <Link to="/app/map" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80">
              View Full Map <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            <div className="relative h-64 overflow-hidden bg-[radial-gradient(circle_at_center,#0f172a_0%,#111827_32%,#0b1120_100%)]">
              <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/30 bg-cyan-500/5 blur-2xl" />
              {mapReports.map((report, index) => {
                const left = 10 + ((index + 1) * 18) % 78;
                const top = 18 + ((index + 1) * 16) % 58;
                const tone = report.priority_level === 'critical' ? 'bg-red-500' : report.priority_level === 'high' ? 'bg-orange-500' : report.priority_level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500';
                return (
                  <button
                    type="button"
                    key={report.id}
                    onClick={() => navigate(`/app/reports/${report.id}`)}
                    className="group absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${left}%`, top: `${top}%` }}
                    aria-label={`View report ${report.title}`}
                  >
                    <span className={`relative block h-4 w-4 rounded-full border-2 border-white shadow-lg ${tone}`} />
                    <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      {report.title}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />High Priority</span>
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Active</span>
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Resolved</span>
              </div>
              <span className="text-xs text-muted-foreground">{mapReports.length} visible markers</span>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="fixed right-5 top-24 z-40 lg:right-8">
        {notificationsOpen && (
          <div className="w-[360px] overflow-hidden rounded-2xl border border-border bg-card shadow-elevated animate-slide-up">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Notifications</p>
                <p className="text-xs text-muted-foreground">{unreadNotifications.length} unread</p>
              </div>
              <button type="button" onClick={() => setNotificationsOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <CircleAlert className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[340px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">No new notifications.</div>
              ) : (
                notifications.map((notification) => (
                  <button
                    type="button"
                    key={notification.id}
                    onClick={() => { if (!notification.is_read) handleMarkRead(notification.id); }}
                    className={notification.is_read ? 'w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/20' : 'w-full border-b border-border bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10'}
                  >
                    <div className="flex items-start gap-3">
                      <div className={notification.is_read ? 'mt-1 h-2.5 w-2.5 rounded-full bg-muted-foreground/40' : 'mt-1 h-2.5 w-2.5 rounded-full bg-primary'} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{notification.title}</p>
                        {notification.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.description}</p>}
                        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span>{timeAgo(notification.created_at)}</span>
                          {!notification.is_read && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">New</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
              <button type="button" onClick={handleMarkAllRead} className="text-xs font-medium text-primary hover:text-primary/80">
                Mark all as read
              </button>
              <Link to="/app/notifications" onClick={() => setNotificationsOpen(false)} className="text-xs font-medium text-primary hover:text-primary/80">
                View all notifications
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="fixed right-5 top-5 z-40 lg:right-7 lg:top-6">
        <button
          type="button"
          aria-label="Open notifications"
          onClick={() => setNotificationsOpen((current) => !current)}
          className="relative flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-soft transition-all hover:border-primary/40 hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          {unreadNotifications.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground animate-pulse">
              {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
