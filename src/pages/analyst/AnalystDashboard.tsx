import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3, FileText, CheckCircle2, Clock3, AlertTriangle, MapPin,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatCard, LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { fetchReports, fetchCategories } from '@/services/api';
import type { Report, ReportCategory } from '@/types';

export function AnalystDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [categories, setCategories] = useState<ReportCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportData, categoryData] = await Promise.all([
        fetchReports(),
        fetchCategories(),
      ]);
      setReports(reportData);
      setCategories(categoryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load report analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <LoadingState message="Loading civic insights..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const resolvedReports = reports.filter((report) => report.status === 'resolved');
  const openReports = reports.filter(
    (report) => !['resolved', 'rejected', 'duplicate', 'cancelled'].includes(report.status),
  );
  const highPriority = reports.filter(
    (report) => ['critical', 'high'].includes(report.priority_level || ''),
  );
  const resolutionRate = reports.length
    ? Math.round((resolvedReports.length / reports.length) * 100)
    : 0;

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const categoryCounts = new Map<string, number>();
  reports.forEach((report) => {
    const name = report.category?.name
      || categoryNames.get(report.category_id || '')
      || 'Uncategorized';
    categoryCounts.set(name, (categoryCounts.get(name) || 0) + 1);
  });
  const categoryData = Array.from(categoryCounts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const priorityCounts = ['critical', 'high', 'medium', 'low'].map((priority) => ({
    priority: priority.charAt(0).toUpperCase() + priority.slice(1),
    count: reports.filter((report) => report.priority_level === priority).length,
  }));

  const areaCounts = new Map<string, number>();
  reports.forEach((report) => {
    const area = report.location?.area || report.location?.address || 'Location not provided';
    areaCounts.set(area, (areaCounts.get(area) || 0) + 1);
  });
  const hotspots = Array.from(areaCounts, ([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const resolvedWithDates = resolvedReports.filter((report) => report.resolved_at);
  const averageResolutionDays = resolvedWithDates.length
    ? (
        resolvedWithDates.reduce((total, report) => {
          const days = (new Date(report.resolved_at!).getTime() - new Date(report.created_at).getTime())
            / (1000 * 60 * 60 * 24);
          return total + Math.max(0, days);
        }, 0) / resolvedWithDates.length
      ).toFixed(1)
    : null;

  const recommendations: string[] = [];
  if (highPriority.length > 0) {
    recommendations.push(`${highPriority.length} high or critical priority report(s) may need attention.`);
  }
  if (categoryData[0]) {
    recommendations.push(`Review resource allocation for ${categoryData[0].name}, the most reported category.`);
  }
  if (hotspots[0] && hotspots[0].area !== 'Location not provided') {
    recommendations.push(`Review recurring issues around ${hotspots[0].area}.`);
  }
  if (openReports.length > 0) {
    recommendations.push(`${openReports.length} report(s) remain unresolved; monitor their progress.`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Civic Insights"
        description="Read-only analysis of complaint trends, priorities, hotspots, and resolution performance."
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total Reports" value={reports.length} icon={<FileText className="h-5 w-5 text-primary" />} />
        <StatCard label="Resolved" value={resolvedReports.length} icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} />
        <StatCard label="Resolution Rate" value={`${resolutionRate}%`} icon={<BarChart3 className="h-5 w-5 text-purple-500" />} />
        <StatCard label="High / Critical" value={highPriority.length} icon={<AlertTriangle className="h-5 w-5 text-amber-500" />} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Reports by Category</CardTitle></CardHeader>
          <CardBody className="h-80">
            {categoryData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ left: 12, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Reports" fill="#0d9488" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState icon={<BarChart3 className="h-8 w-8" />} title="No category data" description="Category insights appear when reports are available." />}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Priority Distribution</CardTitle></CardHeader>
          <CardBody className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityCounts}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="priority" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Reports" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Location Hotspots</CardTitle></CardHeader>
          <CardBody>
            {hotspots.length ? (
              <div className="space-y-3">
                {hotspots.map((item) => (
                  <div key={item.area} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate text-sm">{item.area}</span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">{item.count} report(s)</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No location data is available yet.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Resolution Performance</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4 text-primary" />Unresolved reports</span>
              <strong>{openReports.length}</strong>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">Average resolution time</span>
              <strong>{averageResolutionDays === null ? 'Not available' : `${averageResolutionDays} days`}</strong>
            </div>
            <p className="text-xs text-muted-foreground">
              Average time uses resolved reports with recorded creation and resolution dates.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Suggested Areas of Attention</CardTitle></CardHeader>
        <CardBody>
          {recommendations.length ? (
            <ul className="list-disc space-y-2 pl-5 text-sm">
              {recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No recommendations yet. More complaint data will help identify trends.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
