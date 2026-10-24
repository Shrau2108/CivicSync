import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  Users,
  UserCheck,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { fetchAllAuditLogs, fetchAllProfiles, fetchAllReports, fetchAllTasks, fetchVolunteers } from '@/services/api';
import { timeAgo } from '@/lib/utils';
import type { AuditLog, Profile, Report, Task, Volunteer } from '@/types';

const ROLE_COLORS: Record<string, string> = {
  citizen: '#73a8ff',
  volunteer: '#40d5c1',
  supervisor: '#ffc66d',
  admin: '#ee8aa7',
};
const TERMINAL_TASK_STATUSES = ['completed', 'rejected', 'cancelled', 'declined', 'reassigned'];
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'short' });

interface MonthlyMetric {
  month: string;
  reports: number;
  reportsResolved: number;
  tasks: number;
  tasksCompleted: number;
  evidence: number;
}

function getDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDurationDays(start: string, end: string | null) {
  const startDate = getDate(start);
  const endDate = getDate(end);
  if (!startDate || !endDate || endDate < startDate) return null;
  return (endDate.getTime() - startDate.getTime()) / 86_400_000;
}

function formatMetric(value: number, digits = 0) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);
}

function getMonthlyMetrics(reports: Report[], tasks: Task[], year: number): MonthlyMetric[] {
  const months = Array.from({ length: 12 }, (_, monthIndex) => ({
    monthIndex,
    month: monthFormatter.format(new Date(year, monthIndex, 1)),
    reports: 0,
    reportsResolved: 0,
    tasks: 0,
    tasksCompleted: 0,
    evidence: 0,
  }));

  reports.forEach((report) => {
    const createdAt = getDate(report.created_at);
    if (createdAt?.getFullYear() === year) months[createdAt.getMonth()].reports += 1;
    const resolvedAt = getDate(report.resolved_at) || (report.status === 'resolved' ? getDate(report.updated_at) : null);
    if (resolvedAt?.getFullYear() === year) months[resolvedAt.getMonth()].reportsResolved += 1;
  });

  tasks.forEach((task) => {
    const createdAt = getDate(task.created_at);
    if (createdAt?.getFullYear() === year) months[createdAt.getMonth()].tasks += 1;
    if (task.status === 'completed') {
      const completedAt = getDate(task.updated_at);
      if (completedAt?.getFullYear() === year) months[completedAt.getMonth()].tasksCompleted += 1;
    }
    (task.evidence || []).forEach((evidence) => {
      const submittedAt = getDate(evidence.submitted_at);
      if (submittedAt?.getFullYear() === year) months[submittedAt.getMonth()].evidence += 1;
    });
  });

  return months;
}

function getRolePerformance(profiles: Profile[], reports: Report[], tasks: Task[], auditLogs: AuditLog[]) {
  const roles = ['citizen', 'volunteer', 'supervisor', 'admin'] as const;
  return roles.map((role) => {
    const members = profiles.filter((profile) => profile.role === role);
    const memberIds = new Set(members.map((member) => member.id));
    const roleReports = role === 'citizen' ? reports.filter((report) => memberIds.has(report.reporter_id)) : [];
    const roleTasks = role === 'volunteer'
      ? tasks.filter((task) => task.assignments?.some((assignment) => memberIds.has(assignment.volunteer_id)))
      : [];
    const roleAudit = auditLogs.filter((log) => log.actor_id && memberIds.has(log.actor_id));
    const resolvedReports = roleReports.filter((report) => report.status === 'resolved').length;
    const completedTasks = roleTasks.filter((task) => task.status === 'completed').length;
    const completedAssignments = roleTasks.reduce((count, task) => count + (task.assignments || []).filter((assignment) => memberIds.has(assignment.volunteer_id) && assignment.status === 'completed').length, 0);
    const reviewActions = roleAudit.filter((log) => /review|verify|evidence|assign|approve|reject/i.test(log.action)).length;

    return {
      role,
      users: members.length,
      activeUsers: members.filter((member) => member.is_active).length,
      reportsSubmitted: roleReports.length,
      reportsResolved: resolvedReports,
      assignments: roleTasks.length,
      tasksCompleted: Math.max(completedTasks, completedAssignments),
      reviewActions,
      auditActions: roleAudit.length,
    };
  });
}

export function AdminDashboard() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        fetchAllProfiles(),
        fetchAllReports(),
        fetchAllTasks(),
        fetchVolunteers(),
        fetchAllAuditLogs(),
      ]);

      const profileData = results[0].status === 'fulfilled' ? results[0].value : [];
      const reportData = results[1].status === 'fulfilled' ? results[1].value : [];
      const taskData = results[2].status === 'fulfilled' ? results[2].value : [];
      const volunteerData = results[3].status === 'fulfilled' ? results[3].value : [];
      const auditData = results[4].status === 'fulfilled' ? results[4].value : [];

      setProfiles(profileData);
      setReports(reportData);
      setTasks(taskData);
      setVolunteers(volunteerData);
      setAuditLogs(auditData);
    } catch (err) {
      console.warn('Failed to load live admin data:', err);
      setError(null); // Do not block admin UI with an error screen, allow dashboard to render with available data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const safety = setTimeout(() => {
      setLoading(false);
    }, 2500);
    load().finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [load]);

  if (loading) return <LoadingState message="Loading administration insights..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const availableYears = [...new Set([
    new Date().getFullYear(),
    ...reports.flatMap((report) => [getDate(report.created_at)?.getFullYear(), getDate(report.resolved_at)?.getFullYear()]),
    ...tasks.flatMap((task) => [getDate(task.created_at)?.getFullYear(), task.status === 'completed' ? getDate(task.updated_at)?.getFullYear() : undefined]),
    ...auditLogs.map((log) => getDate(log.created_at)?.getFullYear()),
  ].filter((year): year is number => typeof year === 'number'))].sort((first, second) => second - first);
  const monthlyMetrics = getMonthlyMetrics(reports, tasks, selectedYear);
  const rolePerformance = getRolePerformance(profiles, reports, tasks, auditLogs);
  const roleDistribution = rolePerformance.map((item) => ({ name: item.role, value: item.users, fill: ROLE_COLORS[item.role] }));
  const activeReports = reports.filter((report) => !['resolved', 'cancelled', 'rejected', 'duplicate'].includes(report.status));
  const resolvedReports = reports.filter((report) => report.status === 'resolved');
  const completedTasks = tasks.filter((task) => task.status === 'completed');
  const overdueTasks = tasks.filter((task) => task.deadline && new Date(task.deadline) < new Date() && !TERMINAL_TASK_STATUSES.includes(task.status));
  const currentYearResolved = monthlyMetrics.reduce((total, month) => total + month.reportsResolved, 0);
  const currentYearTasksCompleted = monthlyMetrics.reduce((total, month) => total + month.tasksCompleted, 0);
  const averageResolutionDays = resolvedReports
    .map((report) => getDurationDays(report.created_at, report.resolved_at || report.updated_at))
    .filter((duration): duration is number => duration !== null);
  const meanResolutionDays = averageResolutionDays.length
    ? averageResolutionDays.reduce((sum, duration) => sum + duration, 0) / averageResolutionDays.length
    : 0;
  const resolutionRate = reports.length ? (resolvedReports.length / reports.length) * 100 : 0;
  const pendingReports = reports.filter((report) => ['submitted', 'under_review'].includes(report.status)).length;
  const pendingEvidence = tasks.filter((task) => task.status === 'evidence_submitted').length;

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'CivicSync Administration';
      workbook.created = new Date();
      const addSheet = (name: string, rows: Record<string, string | number | boolean>[]) => {
        const sheet = workbook.addWorksheet(name);
        const headers = rows.length ? Object.keys(rows[0]) : ['Note'];
        sheet.columns = headers.map((header) => ({ header, key: header, width: Math.min(Math.max(header.length + 4, 16), 38) }));
        sheet.addRows(rows.length ? rows : [{ Note: 'No records for this selection' }]);
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17263D' } };
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
        sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + headers.length)}1` };
        return sheet;
      };
      const summaryRows = [
        { Metric: 'Report year', Value: selectedYear },
        { Metric: 'Generated at', Value: new Date().toISOString() },
        { Metric: 'Total users', Value: profiles.length },
        { Metric: 'Total reports', Value: reports.length },
        { Metric: 'Active reports', Value: activeReports.length },
        { Metric: 'Resolved reports', Value: resolvedReports.length },
        { Metric: 'All-time resolution rate (%)', Value: Number(resolutionRate.toFixed(1)) },
        { Metric: 'Average resolution days', Value: Number(meanResolutionDays.toFixed(1)) },
        { Metric: 'Completed tasks', Value: completedTasks.length },
        { Metric: 'Overdue active tasks', Value: overdueTasks.length },
        { Metric: 'Pending report reviews', Value: pendingReports },
        { Metric: 'Pending evidence reviews', Value: pendingEvidence },
      ];
      addSheet('Executive Summary', summaryRows);
      addSheet('Monthly Usage', monthlyMetrics.map((month) => ({ Year: selectedYear, ...month })));
      addSheet('Role Performance', rolePerformance);
      addSheet('User Directory', profiles.map((profile) => ({
        ID: profile.id,
        Name: profile.full_name,
        Email: profile.email,
        Phone: profile.phone || '',
        Role: profile.role,
        Active: profile.is_active,
        Created: profile.created_at,
      })));
      addSheet('Reports', reports.map((report) => ({
        ID: report.report_id,
        Title: report.title,
        Status: report.status,
        Priority: report.priority_level || '',
        Category: report.category?.name || '',
        Reporter: report.reporter?.full_name || profiles.find((profile) => profile.id === report.reporter_id)?.full_name || report.reporter_id,
        Created: report.created_at,
        Resolved: report.resolved_at || '',
        Updated: report.updated_at,
      })));
      addSheet('Tasks', tasks.map((task) => ({
        ID: task.task_id,
        Title: task.title,
        Status: task.status,
        Priority: task.priority_level || '',
        Report: task.report?.report_id || task.report_id,
        Volunteers: (task.assignments || []).map((assignment) => assignment.volunteer?.full_name || assignment.volunteer_id).join(', '),
        Assigned: task.created_at,
        Deadline: task.deadline || '',
        Updated: task.updated_at,
        Completed: task.status === 'completed' ? task.updated_at : '',
      })));
      addSheet('Evidence', tasks.flatMap((task) => (task.evidence || []).map((evidence) => ({
        Task: task.task_id,
        Type: evidence.evidence_type,
        File: evidence.file_name || '',
        Volunteer: profiles.find((profile) => profile.id === evidence.volunteer_id)?.full_name || evidence.volunteer_id,
        Submitted: evidence.submitted_at,
        Notes: evidence.notes || '',
        FileURL: evidence.file_url,
      }))));
      addSheet('Audit Log', auditLogs.map((log) => ({
        Timestamp: log.created_at,
        Actor: log.actor?.full_name || profiles.find((profile) => profile.id === log.actor_id)?.full_name || 'System',
        Role: profiles.find((profile) => profile.id === log.actor_id)?.role || '',
        Action: log.action,
        Entity: log.entity_type,
        EntityID: log.entity_id || '',
        Details: log.details ? JSON.stringify(log.details) : '',
      })));

      const dateStamp = new Date().toISOString().slice(0, 10);
      const buffer = await workbook.xlsx.writeBuffer();
      const workbookBlob = new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const downloadUrl = URL.createObjectURL(workbookBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = `civicsync-admin-integrity-${selectedYear}-${dateStamp}.xlsx`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Could not generate the XLSX workbook');
    } finally {
      setExporting(false);
    }
  };

  const kpis = [
    { label: 'Active cases', value: activeReports.length, detail: `${pendingReports} awaiting first review`, icon: FileText, tone: 'text-sky-300 bg-sky-400/10' },
    { label: 'Resolved reports', value: currentYearResolved, detail: `${formatMetric(resolutionRate, 1)}% all-time resolution`, icon: CheckCircle2, tone: 'text-emerald-300 bg-emerald-400/10' },
    { label: 'Tasks completed', value: currentYearTasksCompleted, detail: `${completedTasks.length} all-time completions`, icon: ShieldCheck, tone: 'text-teal-300 bg-teal-400/10' },
    { label: 'Overdue tasks', value: overdueTasks.length, detail: `${pendingEvidence} evidence reviews pending`, icon: AlertTriangle, tone: overdueTasks.length ? 'text-rose-300 bg-rose-400/10' : 'text-amber-300 bg-amber-400/10' },
    { label: 'Accounts', value: profiles.length, detail: `${profiles.filter((profile) => profile.is_active).length} active profiles`, icon: Users, tone: 'text-violet-300 bg-violet-400/10' },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950 px-5 py-6 shadow-soft sm:px-7">
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-sky-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> CivicSync · Executive control</p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Platform performance</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">Service delivery, role accountability, and operational integrity in one view.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="sr-only" htmlFor="report-year">Reporting year</label>
            <select id="report-year" value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 focus:border-sky-400 focus:outline-none">
              {availableYears.map((year) => <option key={year} value={year}>{year} report year</option>)}
            </select>
            <button type="button" onClick={() => void handleExport()} disabled={exporting} className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-wait disabled:opacity-60">
              {exporting ? <Activity className="h-4 w-4 animate-pulse" /> : <FileSpreadsheet className="h-4 w-4" />}
              {exporting ? 'Preparing workbook…' : 'Export XLSX'}
            </button>
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-800 pt-4 text-xs text-slate-400">
          <span>Average resolution <strong className="ml-1 font-semibold text-slate-100">{formatMetric(meanResolutionDays, 1)} days</strong></span>
          <span>Verified volunteers <strong className="ml-1 font-semibold text-slate-100">{volunteers.filter((volunteer) => volunteer.is_verified && volunteer.verification_status === 'verified').length}</strong></span>
          <span>Audit events <strong className="ml-1 font-semibold text-slate-100">{auditLogs.length}</strong></span>
        </div>
      </header>

      {exportError && <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-700">{exportError}</p>}

      <section aria-label="Performance indicators" className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-soft sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground sm:text-sm">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">{item.value}</p>
                </div>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.tone}`}><Icon className="h-4 w-4" /></span>
              </div>
              <p className="mt-3 truncate border-t border-border pt-3 text-[11px] text-muted-foreground sm:text-xs">{item.detail}</p>
            </article>
          );
        })}
      </section>

      <section aria-label="Monthly service usage" className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
        <div className="min-w-0 rounded-xl border border-border bg-card shadow-soft">
          <div className="flex flex-col gap-1 border-b border-border px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
            <div>
              <h2 className="font-semibold text-foreground">Monthly service delivery</h2>
              <p className="mt-1 text-xs text-muted-foreground">Reports submitted and resolved, tasks completed, and evidence filed · {selectedYear}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" />Reports</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-400" />Resolved</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Tasks completed</span>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{monthlyMetrics.reduce((sum, month) => sum + month.reports, 0)} reports this year</span>
          </div>
          <div className="h-[300px] min-w-0 p-3 sm:h-[350px] sm:p-5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyMetrics} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="reportsGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#69a9ff" stopOpacity={0.3} /><stop offset="95%" stopColor="#69a9ff" stopOpacity={0} /></linearGradient>
                  <linearGradient id="resolvedGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4bd3bd" stopOpacity={0.25} /><stop offset="95%" stopColor="#4bd3bd" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="#263247" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="month" stroke="#8c9ab0" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis allowDecimals={false} stroke="#8c9ab0" tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip contentStyle={{ background: '#101827', border: '1px solid #31415a', borderRadius: 10, color: '#f2f6fc' }} />
                <Area type="monotone" dataKey="reports" name="Reports" stroke="#69a9ff" fill="url(#reportsGradient)" strokeWidth={2} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="reportsResolved" name="Reports resolved" stroke="#4bd3bd" fill="url(#resolvedGradient)" strokeWidth={2} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="tasksCompleted" name="Tasks completed" stroke="#ffc66d" fill="transparent" strokeWidth={2} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-border bg-card shadow-soft">
          <div className="border-b border-border px-4 py-4 sm:px-5">
            <h2 className="font-semibold text-foreground">Role distribution</h2>
            <p className="mt-1 text-xs text-muted-foreground">Active and inactive accounts by access role</p>
          </div>
          <div className="h-[240px] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={roleDistribution} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={3} stroke="none">
                  {roleDistribution.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#101827', border: '1px solid #31415a', borderRadius: 10, color: '#f2f6fc' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 border-t border-border px-4 py-4 sm:px-5">
            {roleDistribution.map((role) => (
              <div key={role.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 capitalize text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: role.fill }} />{role.name}</span>
                <span className="font-semibold tabular-nums text-foreground">{role.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
          <div>
            <h2 className="font-semibold text-foreground">Role performance &amp; accountability</h2>
            <p className="mt-1 text-xs text-muted-foreground">Output and recorded administrative activity by application role</p>
          </div>
          <span className="text-xs text-muted-foreground">{auditLogs.length} recorded audit events</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-muted/30 text-[10px] font-semibold uppercase text-muted-foreground">
              <tr><th className="px-5 py-3">Role</th><th className="px-4 py-3">Users</th><th className="px-4 py-3">Reports</th><th className="px-4 py-3">Assignments</th><th className="px-4 py-3">Completed</th><th className="px-4 py-3">Review actions</th><th className="px-5 py-3">Audit events</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rolePerformance.map((row) => (
                <tr key={row.role} className="transition-colors hover:bg-muted/20">
                  <td className="px-5 py-4"><span className="flex items-center gap-2 capitalize font-semibold text-foreground"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: ROLE_COLORS[row.role] }} />{row.role}</span></td>
                  <td className="px-4 py-4 text-sm tabular-nums text-foreground">{row.activeUsers}<span className="text-muted-foreground">/{row.users}</span></td>
                  <td className="px-4 py-4 text-sm tabular-nums text-foreground">{row.reportsSubmitted}{row.reportsResolved > 0 && <span className="ml-1 text-xs text-muted-foreground">· {row.reportsResolved} resolved</span>}</td>
                  <td className="px-4 py-4 text-sm tabular-nums text-foreground">{row.assignments}</td>
                  <td className="px-4 py-4 text-sm tabular-nums text-foreground">{row.tasksCompleted}</td>
                  <td className="px-4 py-4 text-sm tabular-nums text-foreground">{row.reviewActions}</td>
                  <td className="px-5 py-4 text-sm tabular-nums text-muted-foreground">{row.auditActions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="min-w-0 rounded-xl border border-border bg-card shadow-soft">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
            <div><h2 className="font-semibold text-foreground">Monthly usage</h2><p className="mt-1 text-xs text-muted-foreground">Completion and resolution ledger · {selectedYear}</p></div>
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <div className="h-[260px] p-3 sm:p-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyMetrics} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#263247" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="month" stroke="#8c9ab0" tickLine={false} axisLine={false} fontSize={10} />
                <YAxis allowDecimals={false} stroke="#8c9ab0" tickLine={false} axisLine={false} fontSize={10} />
                <Tooltip contentStyle={{ background: '#101827', border: '1px solid #31415a', borderRadius: 10, color: '#f2f6fc' }} />
                <Bar dataKey="reportsResolved" name="Reports resolved" fill="#4bd3bd" radius={[4, 4, 0, 0]} />
                <Bar dataKey="tasksCompleted" name="Tasks completed" fill="#ffc66d" radius={[4, 4, 0, 0]} />
                <Bar dataKey="evidence" name="Evidence files" fill="#9b91ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-border bg-card shadow-soft">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
            <div><h2 className="font-semibold text-foreground">Integrity &amp; follow-up</h2><p className="mt-1 text-xs text-muted-foreground">Items that may need administrator attention</p></div>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="divide-y divide-border">
            {[
              { label: 'Reports awaiting review', value: pendingReports, to: '/app/supervisor/incoming', icon: FileText, tone: 'text-sky-700' },
              { label: 'Evidence awaiting verification', value: pendingEvidence, to: '/app/admin/verification', icon: ShieldCheck, tone: 'text-amber-700' },
              { label: 'Overdue active tasks', value: overdueTasks.length, to: '/app/admin/tasks', icon: Clock3, tone: overdueTasks.length ? 'text-rose-700' : 'text-emerald-700' },
              { label: 'Active volunteers', value: volunteers.filter((volunteer) => volunteer.is_verified && volunteer.verification_status === 'verified').length, to: '/app/admin/volunteers', icon: UserCheck, tone: 'text-teal-700' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.label} to={item.to} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/20 sm:px-5">
                  <Icon className={`h-4 w-4 shrink-0 ${item.tone}`} />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.label}</span>
                  <span className="font-semibold tabular-nums text-foreground">{item.value}</span>
                  {item.value > 0 ? <ArrowUpRight className="h-4 w-4 text-muted-foreground" /> : <ArrowDownRight className="h-4 w-4 text-muted-foreground" />}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div><h2 className="font-semibold text-foreground">Recent audit trail</h2><p className="mt-1 text-xs text-muted-foreground">Timestamped actions across all roles</p></div>
          <Link to="/app/audit" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">Full log <ArrowRight className="h-4 w-4" /></Link>
        </div>
        {auditLogs.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-5"><Activity className="h-4 w-4" />No audit events are available for this project yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {auditLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_140px_100px] sm:items-center sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{log.actor?.full_name || 'System'} <span className="font-normal text-muted-foreground">{log.action.replace(/_/g, ' ')}</span></p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{log.entity_type}{log.entity_id ? ` · ${log.entity_id}` : ''}</p>
                </div>
                <span className="hidden text-xs capitalize text-muted-foreground sm:block">{log.actor?.role || 'system'}</span>
                <span className="text-right text-xs text-muted-foreground">{timeAgo(log.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}