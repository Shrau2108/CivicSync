
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
  ShieldCheck,
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
} from '@/services/api';
import type { Report, ReportCategory } from '@/types';

type Priority = 'low' | 'medium' | 'high' | 'critical';

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

const priorityScores: Record<Priority, number> = {
  low: 25,
  medium: 50,
  high: 75,
  critical: 100,
};

function prettyLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter =>
    letter.toUpperCase()
  );
}

/**
 * Suggests a priority using basic keyword rules.
 * This is a recommendation for Analyst review, not an automatic
 * final decision.
 */
function suggestComplaintPriority(report: Report): Priority {
  const text = [
    report.title,
    report.description,
    report.category?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const criticalPatterns = [
    /\bexposed (electrical |electric )?wire(s)?\b/,
    /\blive wire(s)?\b/,
    /\belectrocution\b/,
    /\bopen manhole\b/,
    /\bgas leak\b/,
    /\bbuilding collapse\b/,
    /\bimmediate danger\b/,
    /\blife[- ]threatening\b/,
  ];

  if (criticalPatterns.some(pattern => pattern.test(text))) {
    return 'critical';
  }

  const highPatterns = [
    /\bsevere flooding\b/,
    /\bmajor water leak(age)?\b/,
    /\blarge pothole\b/,
    /\broad blocked\b/,
    /\bfallen tree\b/,
    /\bsewage overflow\b/,
    /\baccident risk\b/,
    /\bserious hazard\b/,
    /\bsevere damage\b/,
  ];

  if (highPatterns.some(pattern => pattern.test(text))) {
    return 'high';
  }

  const mediumPatterns = [
    /\bbroken streetlight\b/,
    /\bdamaged footpath\b/,
    /\bgarbage accumulation\b/,
    /\bdrain blockage\b/,
    /\bdamaged road\b/,
    /\bwater leakage\b/,
    /\bminor flooding\b/,
  ];

  if (mediumPatterns.some(pattern => pattern.test(text))) {
    return 'medium';
  }

  // Unknown issues need Analyst review; Low is only a provisional suggestion.
  return 'low';
}

function priorityClass(priority: string) {
  switch (priority.toLowerCase()) {
    case 'critical':
      return 'bg-red-100 text-red-800';
    case 'high':
      return 'bg-orange-100 text-orange-800';
    case 'medium':
      return 'bg-amber-100 text-amber-800';
    case 'low':
      return 'bg-emerald-100 text-emerald-800';
    default:
      return 'bg-muted text-muted-foreground';
  }
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
  const [priorityDrafts, setPriorityDrafts] = useState<
    Record<string, Priority>
  >({});
  const [savingPriorityId, setSavingPriorityId] = useState<string | null>(
    null
  );
  const [priorityMessage, setPriorityMessage] = useState('');
  const [exportingAll, setExportingAll] = useState(false);

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
            : 'Unable to load report analytics.'
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
    () => new Map(categories.map(category => [category.id, category.name])),
    [categories]
  );

  const categoryName = (report: Report) =>
    report.category?.name ||
    categoryNames.get(report.category_id || '') ||
    'Uncategorized';

  const filteredReports = useMemo(() => {
    const term = search.trim().toLowerCase();

    return reports.filter(report => {
      const matchesSearch =
        !term ||
        [
          report.title,
          report.report_id,
          report.id,
          report.description,
          report.location?.area,
          report.location?.address,
        ].some(value => value?.toLowerCase().includes(term));

      const matchesStatus =
        statusFilter === 'all' || report.status === statusFilter;

      const matchesPriority =
        priorityFilter === 'all' ||
        (report.priority_level || '').toLowerCase() === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [reports, search, statusFilter, priorityFilter]);

  const highCriticalFilteredReports = useMemo(
    () =>
      filteredReports.filter(report =>
        ['high', 'critical'].includes(
          (report.priority_level || '').trim().toLowerCase()
        )
      ),
    [filteredReports]
  );

  /**
   * Exports the supplied complaint list as an Excel-compatible CSV file.
   */
  const downloadCSV = (
    complaints: Report[],
    filename: string
  ) => {
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

    const escapeCSV = (value: unknown) => {
      const text = String(value ?? '');
      return `"${text.replace(/"/g, '""')}"`;
    };

    const rows = complaints.map(report => [
      report.report_id || report.id,
      report.title,
      report.description,
      categoryName(report),
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
      .map(row => row.map(escapeCSV).join(','))
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

    // Delay cleanup so the browser can begin the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportFilteredComplaints = () => {
    downloadCSV(
      highCriticalFilteredReports,
      `civicsync-high-critical-complaints-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`
    );
  };

  /**
   * Fetches the reports again, without dashboard filters, before exporting.
   * This includes all records returned by fetchReports().
   */
  const exportAllComplaints = async () => {
    setExportingAll(true);
    setPriorityMessage('');

    try {
      const allReports = await fetchReports();

      downloadCSV(
        allReports,
        `civicsync-all-complaints-${new Date()
          .toISOString()
          .slice(0, 10)}.csv`
      );
    } catch (err) {
      setPriorityMessage(
        err instanceof Error
          ? `Export failed: ${err.message}`
          : 'Unable to export all complaints. Please try again.'
      );
    } finally {
      setExportingAll(false);
    }
  };

  const saveAnalystPriority = async (
    reportId: string,
    priority: Priority
  ) => {
    setSavingPriorityId(reportId);
    setPriorityMessage('');

    try {
      await updateReportPriority(
        reportId,
        priority,
        priorityScores[priority],
        priority
      );

      setReports(previous =>
        previous.map(report =>
          report.id === reportId
            ? {
                ...report,
                priority_level: priority,
                priority_score: priorityScores[priority],
              }
            : report
        )
      );

      setPriorityDrafts(previous => {
        const updated = { ...previous };
        delete updated[reportId];
        return updated;
      });

      setPriorityMessage(
        `Priority saved for complaint ${reportId}.`
      );
    } catch (err) {
      setPriorityMessage(
        err instanceof Error
          ? `Could not save priority: ${err.message}`
          : 'Could not save priority. Please try again.'
      );
    } finally {
      setSavingPriorityId(null);
    }
  };

  if (loading) {
    return <LoadingState message="Loading civic insights..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  const resolvedReports = reports.filter(
    report => report.status === 'resolved'
  );

  const openReports = reports.filter(
    report => !terminalStatuses.includes(report.status)
  );

  const highPriority = reports.filter(report =>
    ['critical', 'high'].includes(
      (report.priority_level || '').toLowerCase()
    )
  );

  const resolutionRate = reports.length
    ? Math.round((resolvedReports.length / reports.length) * 100)
    : 0;

  const categoryCounts = new Map<string, number>();

  reports.forEach(report => {
    const name = categoryName(report);
    categoryCounts.set(name, (categoryCounts.get(name) || 0) + 1);
  });

  const categoryData = Array.from(
    categoryCounts,
    ([name, count]) => ({ name, count })
  )
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const priorityCounts = ['critical', 'high', 'medium', 'low'].map(
    priority => ({
      priority: prettyLabel(priority),
      count: reports.filter(
        report =>
          (report.priority_level || '').toLowerCase() === priority
      ).length,
    })
  );

  const areaCounts = new Map<string, number>();

  reports.forEach(report => {
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
    report => report.resolved_at
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
      `${highPriority.length} high or critical priority report(s) may need attention.`
    );
  }

  if (categoryData[0]) {
    recommendations.push(
      `Review resource allocation for ${categoryData[0].name}, the most reported category.`
    );
  }

  if (hotspots[0] && hotspots[0].area !== 'Location not provided') {
    recommendations.push(
      `Review recurring issues around ${hotspots[0].area}.`
    );
  }

  if (openReports.length) {
    recommendations.push(
      `${openReports.length} report(s) remain unresolved; monitor their progress.`
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
          Analyst view · Automatically refreshes every 30 seconds
        </p>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
          />
          {refreshing ? 'Refreshing...' : 'Refresh reports'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Total Reports"
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
            <CardTitle>Reports by Category</CardTitle>
          </CardHeader>
          <CardBody className="h-80">
            {categoryData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryData}
                  layout="vertical"
                  margin={{ left: 12, right: 16 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={110}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Reports"
                    fill="#0d9488"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={<BarChart3 className="h-8 w-8" />}
                title="No category data"
                description="Category insights appear when reports are available."
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
              <BarChart data={priorityCounts}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis dataKey="priority" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  name="Reports"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                />
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
                {hotspots.map(item => (
                  <div
                    key={item.area}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate text-sm">
                        {item.area}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">
                      {item.count} report(s)
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
                Unresolved reports
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

            <p className="text-xs text-muted-foreground">
              Average time uses resolved reports with recorded creation
              and resolution dates.
            </p>
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
              {recommendations.map(recommendation => (
                <li key={recommendation}>{recommendation}</li>
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
          <CardTitle>Complaint Data Export</CardTitle>
          <p className="text-sm text-muted-foreground">
            Export all complaints regardless of filters, or export only high
            and critical priority complaints matching your current filters.
          </p>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void exportAllComplaints()}
            disabled={exportingAll}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exportingAll ? 'Exporting all...' : 'Export All Complaints'}
          </button>

          <button
            type="button"
            onClick={exportFilteredComplaints}
            disabled={highCriticalFilteredReports.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export High / Critical ({highCriticalFilteredReports.length})
          </button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Complaints & Priority Review</CardTitle>
          <p className="text-sm text-muted-foreground">
            The system suggests a priority from complaint text. The Analyst
            reviews the suggestion and saves the final priority.
          </p>
        </CardHeader>

        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search title, ID, or location"
                aria-label="Search complaints"
                className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm"
              />
            </div>

            <select
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="all">All statuses</option>
              {statuses.map(status => (
                <option key={status} value={status}>
                  {prettyLabel(status)}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={event => setPriorityFilter(event.target.value)}
              aria-label="Filter by priority"
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <option value="all">All priorities</option>
              {['critical', 'high', 'medium', 'low'].map(priority => (
                <option key={priority} value={priority}>
                  {prettyLabel(priority)}
                </option>
              ))}
            </select>
          </div>

          <p className="text-sm text-muted-foreground">
            Showing {filteredReports.length} of {reports.length} loaded
            complaint(s).
          </p>

          {priorityMessage && (
            <p role="status" className="rounded-lg border p-3 text-sm">
              {priorityMessage}
            </p>
          )}

          {filteredReports.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-3 py-3 font-medium">Complaint</th>
                    <th className="px-3 py-3 font-medium">Category</th>
                    <th className="px-3 py-3 font-medium">Location</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Current</th>
                    <th className="px-3 py-3 font-medium">Suggested</th>
                    <th className="px-3 py-3 font-medium">Analyst decision</th>
                    <th className="px-3 py-3 font-medium">Submitted</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredReports.map(report => {
                    const suggested = suggestComplaintPriority(report);

                    const currentPriority = (
                      report.priority_level || ''
                    ).toLowerCase();

                    const draft =
                      priorityDrafts[report.id] ||
                      (['low', 'medium', 'high', 'critical'].includes(
                        currentPriority
                      )
                        ? (currentPriority as Priority)
                        : suggested);

                    return (
                      <tr
                        key={report.id}
                        className="border-b last:border-0 hover:bg-muted/40"
                      >
                        <td className="px-3 py-3">
                          <p className="font-medium">
                            {report.title || 'Untitled complaint'}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {report.report_id || report.id}
                          </p>
                          {report.description && (
                            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                              {report.description}
                            </p>
                          )}
                        </td>

                        <td className="px-3 py-3">
                          {categoryName(report)}
                        </td>

                        <td className="px-3 py-3">
                          {report.location?.area ||
                            report.location?.address ||
                            'Not provided'}
                        </td>

                        <td className="px-3 py-3">
                          {prettyLabel(report.status)}
                        </td>

                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${priorityClass(
                              currentPriority
                            )}`}
                          >
                            {prettyLabel(currentPriority || 'unassigned')}
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${priorityClass(
                              suggested
                            )}`}
                          >
                            {prettyLabel(suggested)}
                          </span>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Rule-based suggestion
                          </p>
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-2">
                            <select
                              value={draft}
                              aria-label={`Analyst priority for ${report.title}`}
                              onChange={event =>
                                setPriorityDrafts(previous => ({
                                  ...previous,
                                  [report.id]: event.target.value as Priority,
                                }))
                              }
                              className="rounded-lg border bg-background px-2 py-2 text-sm"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="critical">Critical</option>
                            </select>

                            <button
                              type="button"
                              disabled={savingPriorityId === report.id}
                              onClick={() =>
                                void saveAnalystPriority(report.id, draft)
                              }
                              className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              {savingPriorityId === report.id
                                ? 'Saving...'
                                : 'Save Priority'}
                            </button>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-3 py-3">
                          {new Date(
                            report.created_at
                          ).toLocaleDateString()}
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
              description="Try changing the search text or filters."
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
