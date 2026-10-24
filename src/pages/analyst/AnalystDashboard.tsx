
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  FileText,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  MapPin,
  RefreshCw,
  Search,
  Download,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { PageHeader } from '@/components/layout/AppLayout';
import {
  StatCard,
  LoadingState,
  ErrorState,
  EmptyState,
} from '@/components/ui/States';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import {
  fetchReports,
  fetchCategories,
  updateReportPriority,
  verifyReportAsAnalyst,
} from '@/services/api';
import type { Report, ReportCategory } from '@/types';

const terminalStatuses = [
  'resolved',
  'rejected',
  'duplicate',
  'cancelled',
];

const statuses = [
  'submitted',
  'under_review',
  'verified',
  'prioritized',
  'assigned',
  'accepted',
  'in_progress',
  'evidence_submitted',
  'under_verification',
  'resolved',
  'rejected',
  'duplicate',
  'reopened',
  'cancelled',
];

const priorities = ['critical', 'high', 'medium', 'low'];

const priorityScores: Record<string, number> = {
  critical: 100,
  high: 80,
  medium: 55,
  low: 30,
};

// Normalize database values before comparing them.
function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function prettyLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// A rule-based suggestion only; the analyst makes the final decision.
function suggestComplaintPriority(report: Report): string {
  const text = normalize(
    `${report.title ?? ''} ${report.description ?? ''}`
  );

  const criticalKeywords = [
    'exposed electrical wire',
    'live wire',
    'electrocution',
    'open manhole',
    'gas leak',
    'building collapse',
    'immediate danger',
    'life-threatening',
  ];

  const highKeywords = [
    'severe flooding',
    'major water leak',
    'large pothole',
    'road blocked',
    'fallen tree',
    'sewage overflow',
    'accident risk',
    'serious hazard',
    'severe damage',
  ];

  const mediumKeywords = [
    'broken streetlight',
    'damaged footpath',
    'garbage accumulation',
    'drain blockage',
    'damaged road',
    'water leakage',
    'minor flooding',
  ];

  if (criticalKeywords.some((word) => text.includes(word))) {
    return 'critical';
  }

  if (highKeywords.some((word) => text.includes(word))) {
    return 'high';
  }

  if (mediumKeywords.some((word) => text.includes(word))) {
    return 'medium';
  }

  return 'low';
}

function escapeCSV(value: unknown): string {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCSV(
  reports: Report[],
  categories: ReportCategory[],
  filename: string
) {
  const headers = [
    'Report ID',
    'Title',
    'Description',
    'Category',
    'Location',
    'Status',
    'Priority',
    'Priority Score',
    'Created At',
    'Resolved At',
  ];

  const rows = reports.map((report) => [
    report.report_id || report.id,
    report.title,
    report.description,
    report.category?.name ||
      categories.find((category) => category.id === report.category_id)?.name ||
      'Uncategorized',
    report.location?.area ||
      report.location?.address ||
      'Not provided',
    report.status,
    report.priority_level || 'unassigned',
    report.priority_score ?? '',
    report.created_at,
    report.resolved_at || '',
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCSV).join(','))
    .join('\r\n');

  const blob = new Blob(['\uFEFF', csv], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Keep the object URL alive briefly for Chrome to start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AnalystDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [categories, setCategories] = useState<ReportCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [priorityDrafts, setPriorityDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);

    try {
      const [reportData, categoryData] = await Promise.all([
        fetchReports(),
        fetchCategories(),
      ]);

      setReports(reportData);
      setCategories(categoryData);
      setError(null);
    } catch (err) {
      if (!background) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load complaint analytics.'
        );
      }
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const timer = window.setInterval(() => {
      void load(true);
    }, 30000);

    return () => window.clearInterval(timer);
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);

    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  };

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  const categoryName = (report: Report) =>
    report.category?.name ||
    categoryNames.get(report.category_id || '') ||
    'Uncategorized';

  // FIX: normalize stored and selected priorities before comparison.
  // High matches only high, not low, medium, or critical.
  const filteredReports = useMemo(() => {
    const term = normalize(search);
    const selectedPriority = normalize(priorityFilter);
    const selectedStatus = normalize(statusFilter);

    return reports.filter((report) => {
      const matchesSearch =
        !term ||
        [
          report.title,
          report.report_id,
          report.id,
          report.description,
          report.location?.area,
          report.location?.address,
        ].some((value) => normalize(value).includes(term));

      const matchesStatus =
        selectedStatus === 'all' ||
        normalize(report.status) === selectedStatus;

      const matchesPriority =
        selectedPriority === 'all' ||
        normalize(report.priority_level) === selectedPriority;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [reports, search, statusFilter, priorityFilter]);

  const highCriticalFilteredReports = useMemo(
    () =>
      filteredReports.filter((report) =>
        ['high', 'critical'].includes(normalize(report.priority_level))
      ),
    [filteredReports]
  );

  const exportAllComplaints = async () => {
    try {
      setMessage('Preparing all complaints...');
      const allReports = await fetchReports();

      downloadCSV(
        allReports,
        categories,
        `civicsync-all-complaints-${new Date().toISOString().slice(0, 10)}.csv`
      );

      setMessage(`Exported ${allReports.length} complaint(s).`);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : 'Unable to export complaints.'
      );
    }
  };

  const exportFilteredComplaints = () => {
    downloadCSV(
      highCriticalFilteredReports,
      categories,
      `civicsync-high-critical-complaints-${new Date().toISOString().slice(0, 10)}.csv`
    );

    setMessage(`Exported ${highCriticalFilteredReports.length} high/critical complaint(s).`);
  };

  const savePriority = async (report: Report) => {
    const priority = priorityDrafts[report.id];

    if (!priority || !priorities.includes(priority)) return;

    setSavingId(report.id);
    setMessage('');

    try {
      await updateReportPriority(
        report.id,
        priority,
        priorityScores[priority],
        priority
      );

      setReports((current) =>
        current.map((item) =>
          item.id === report.id
            ? {
                ...item,
                priority_level: priority as Report['priority_level'],
                priority_score: priorityScores[priority],
              }
            : item
        )
      );

      setPriorityDrafts((current) => {
        const next = { ...current };
        delete next[report.id];
        return next;
      });

      setMessage('Complaint priority updated successfully.');
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : 'Could not save the priority. Please try again.'
      );
    } finally {
      setSavingId(null);
    }
  };

  const verifyReport = async (report: Report) => {
    setVerifyingId(report.id);
    setMessage('');

    try {
      const result = await verifyReportAsAnalyst(report.id);
      await load(true);
      setMessage(
        result.demo
          ? 'Report verified in demo mode. Live supervisor notifications require Supabase.'
          : `Report verified and ${result.notifiedSupervisors} supervisor(s) notified.`
      );
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : 'Could not verify the report. Please try again.'
      );
    } finally {
      setVerifyingId(null);
    }
  };

  if (loading) {
    return <LoadingState message="Loading civic insights..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  const resolvedReports = reports.filter(
    (report) => normalize(report.status) === 'resolved'
  );

  const openReports = reports.filter(
    (report) => !terminalStatuses.includes(normalize(report.status))
  );

  const highPriority = reports.filter((report) =>
    ['high', 'critical'].includes(normalize(report.priority_level))
  );

  const resolutionRate = reports.length
    ? Math.round((resolvedReports.length / reports.length) * 100)
    : 0;

  const categoryCounts = new Map<string, number>();

  reports.forEach((report) => {
    const name = categoryName(report);
    categoryCounts.set(name, (categoryCounts.get(name) || 0) + 1);
  });

  const categoryData = Array.from(
    categoryCounts,
    ([name, count]) => ({ name, count })
  )
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const priorityData = priorities.map((priority) => ({
    priority: prettyLabel(priority),
    count: reports.filter(
      (report) => normalize(report.priority_level) === priority
    ).length,
  }));

  const areaCounts = new Map<string, number>();

  reports.forEach((report) => {
    const area =
      report.location?.area ||
      report.location?.address ||
      'Location not provided';

    areaCounts.set(area, (areaCounts.get(area) || 0) + 1);
  });

  const hotspots = Array.from(
    areaCounts,
    ([area, count]) => ({ area, count })
  )
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const resolvedWithDates = resolvedReports.filter(
    (report) => report.resolved_at
  );

  const averageResolutionDays = resolvedWithDates.length
    ? (
        resolvedWithDates.reduce((total, report) => {
          const days =
            (new Date(report.resolved_at!).getTime() -
              new Date(report.created_at).getTime()) /
            (1000 * 60 * 60 * 24);

          return total + Math.max(0, days);
        }, 0) / resolvedWithDates.length
      ).toFixed(1)
    : null;

  const recommendations: string[] = [];

  if (highPriority.length) {
    recommendations.push(
      `${highPriority.length} high or critical complaint(s) may need attention.`
    );
  }

  if (categoryData[0]) {
    recommendations.push(
      `Review resource allocation for ${categoryData[0].name}, the most reported category.`
    );
  }

  if (hotspots[0] && hotspots[0].area !== 'Location not provided') {
    recommendations.push(`Review recurring issues around ${hotspots[0].area}.`);
  }

  if (openReports.length) {
    recommendations.push(
      `${openReports.length} complaint(s) remain unresolved.`
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Civic Insights"
        description="Analyse complaint trends, priorities, hotspots, and resolution performance."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Analyst dashboard · Automatically refreshes every 30 seconds
        </p>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh reports'}
        </button>
      </div>

      {message && (
        <p role="status" className="rounded-lg border p-3 text-sm">
          {message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Total Complaints"
          value={reports.length}
          icon={<FileText className="h-5 w-5 text-primary" />}
        />
        <StatCard
          label="Resolved"
          value={resolvedReports.length}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
        />
        <StatCard
          label="Resolution Rate"
          value={`${resolutionRate}%`}
          icon={<BarChart3 className="h-5 w-5 text-purple-500" />}
        />
        <StatCard
          label="High / Critical"
          value={highPriority.length}
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Complaints by Category</CardTitle>
          </CardHeader>
          <CardBody className="h-80">
            {categoryData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={110} />
                  <Tooltip />
                  <Bar dataKey="count" name="Complaints" fill="#0d9488" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={<BarChart3 className="h-8 w-8" />}
                title="No category data"
                description="Category insights appear when complaints are available."
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Priority Distribution</CardTitle>
          </CardHeader>
          <CardBody className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="priority" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Complaints" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location Hotspots</CardTitle>
          </CardHeader>
          <CardBody>
            {hotspots.length ? (
              <div className="space-y-3">
                {hotspots.map((item) => (
                  <div
                    key={item.area}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate text-sm">{item.area}</span>
                    </div>
                    <span className="text-sm font-semibold">
                      {item.count} complaint(s)
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No location data is available yet.
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resolution Performance</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="flex items-center gap-2 text-sm">
                <Clock3 className="h-4 w-4 text-primary" />
                Unresolved complaints
              </span>
              <strong>{openReports.length}</strong>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">Average resolution time</span>
              <strong>
                {averageResolutionDays === null
                  ? 'Not available'
                  : `${averageResolutionDays} days`}
              </strong>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Suggested Areas of Attention</CardTitle>
        </CardHeader>
        <CardBody>
          {recommendations.length ? (
            <ul className="list-disc space-y-2 pl-5 text-sm">
              {recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              More complaint data will help identify trends and priorities.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Complaints</CardTitle>
          <p className="text-sm text-muted-foreground">
            Suggested priorities are rule-based. Review the suggestion before saving a priority.
          </p>
        </CardHeader>

        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void exportAllComplaints()}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
            >
              <Download className="h-4 w-4" />
              Export All Complaints
            </button>

            <button
              type="button"
              onClick={exportFilteredComplaints}
              disabled={highCriticalFilteredReports.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export High / Critical ({highCriticalFilteredReports.length})
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, ID, or location"
                aria-label="Search complaints"
                className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="all">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {prettyLabel(status)}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              aria-label="Filter by priority"
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="all">All priorities</option>
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {prettyLabel(priority)}
                </option>
              ))}
            </select>
          </div>

          <p className="text-sm text-muted-foreground">
            Showing {filteredReports.length} of {reports.length} complaint(s)
          </p>

          {filteredReports.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-3 py-3">Complaint</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Location</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Current Priority</th>
                    <th className="px-3 py-3">Suggested Priority</th>
                    <th className="px-3 py-3">Review / Save</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredReports.map((report) => {
                    const suggested = suggestComplaintPriority(report);
                    const currentPriority =
                      normalize(report.priority_level) || 'unassigned';
                    const draft =
                      priorityDrafts[report.id] ??
                      (priorities.includes(currentPriority)
                        ? currentPriority
                        : suggested);
                    const canVerify = ['submitted', 'under_review'].includes(
                      normalize(report.status)
                    );

                    return (
                      <tr
                        key={report.id}
                        className="border-b last:border-0 hover:bg-muted/40"
                      >
                        <td className="px-3 py-3">
                          <p className="font-medium">{report.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {report.report_id || report.id}
                          </p>
                        </td>

                        <td className="px-3 py-3">{categoryName(report)}</td>

                        <td className="px-3 py-3">
                          {report.location?.area ||
                            report.location?.address ||
                            'Not provided'}
                        </td>

                        <td className="px-3 py-3">
                          {prettyLabel(report.status)}
                        </td>

                        <td className="px-3 py-3">
                          {prettyLabel(currentPriority)}
                        </td>

                        <td className="px-3 py-3">
                          <span className="font-medium">
                            {prettyLabel(suggested)}
                          </span>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Review before saving
                          </p>
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-2">
                            {canVerify && (
                              <button
                                type="button"
                                onClick={() => void verifyReport(report)}
                                disabled={verifyingId === report.id}
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-600 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                {verifyingId === report.id
                                  ? 'Verifying...'
                                  : 'Verify & notify supervisor'}
                              </button>
                            )}
                            <select
                              value={draft}
                              onChange={(event) =>
                                setPriorityDrafts((current) => ({
                                  ...current,
                                  [report.id]: event.target.value,
                                }))
                              }
                              aria-label={`Choose priority for ${report.title}`}
                              className="rounded-lg border bg-background px-2 py-2"
                            >
                              {priorities.map((priority) => (
                                <option key={priority} value={priority}>
                                  {prettyLabel(priority)}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => void savePriority(report)}
                              disabled={
                                savingId === report.id ||
                                draft === currentPriority
                              }
                              className="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
                            >
                              {savingId === report.id
                                ? 'Saving...'
                                : 'Save Priority'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={<Search className="h-8 w-8" />}
              title="No matching complaints"
              description="Try changing your search or filters. If High is selected, only High priority complaints will appear."
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
