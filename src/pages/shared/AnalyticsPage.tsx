import { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, FileText, CheckCircle2, Clock, Star } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatCard, EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { fetchReports, fetchTasks, fetchVolunteers } from '@/services/api';
import type { Report, Task, Volunteer } from '@/types';

export function AnalyticsPage() {
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
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState message="Loading analytics..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  if (reports.length === 0 && tasks.length === 0) {
    return (
      <div>
        <PageHeader title="Analytics" description="Insights and trends across the platform" />
        <Card><CardBody>
          <EmptyState icon={<BarChart3 className="w-8 h-8" />} title="No data available" description="Analytics will appear once reports and tasks are created" />
        </CardBody></Card>
      </div>
    );
  }

  const byCategory: Record<string, number> = {};
  reports.forEach(r => {
    const cat = r.category?.name || 'Uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  });

  const byPriority: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  reports.forEach(r => {
    if (r.priority_level) byPriority[r.priority_level]++;
  });

  const byStatus: Record<string, number> = {};
  reports.forEach(r => {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  });

  const resolved = reports.filter(r => r.status === 'resolved').length;
  const unresolved = reports.length - resolved;
  const completionRate = reports.length > 0 ? Math.round((resolved / reports.length) * 100) : 0;

  const maxCategory = Math.max(...Object.values(byCategory), 1);
  const maxPriority = Math.max(...Object.values(byPriority), 1);

  return (
    <div>
      <PageHeader title="Analytics" description="Insights and trends across the platform" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Reports" value={reports.length} icon={<FileText className="w-5 h-5" />} color="primary" />
        <StatCard label="Resolved" value={resolved} icon={<CheckCircle2 className="w-5 h-5" />} color="teal" />
        <StatCard label="Completion Rate" value={`${completionRate}%`} icon={<TrendingUp className="w-5 h-5" />} color="navy" />
        <StatCard label="Active Volunteers" value={volunteers.filter(v => v.is_verified).length} icon={<Star className="w-5 h-5" />} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Category */}
        <Card>
          <CardHeader><CardTitle>Reports by Category</CardTitle></CardHeader>
          <CardBody>
            <div className="space-y-3">
              {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-charcoal-600">{cat}</span>
                    <span className="text-sm font-medium text-charcoal-800">{count}</span>
                  </div>
                  <div className="w-full bg-charcoal-100 rounded-full h-2">
                    <div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${(count / maxCategory) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* By Priority */}
        <Card>
          <CardHeader><CardTitle>Reports by Priority</CardTitle></CardHeader>
          <CardBody>
            <div className="space-y-3">
              {Object.entries(byPriority).map(([prio, count]) => (
                <div key={prio}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-charcoal-600 capitalize">{prio}</span>
                    <span className="text-sm font-medium text-charcoal-800">{count}</span>
                  </div>
                  <div className="w-full bg-charcoal-100 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${
                      prio === 'critical' ? 'bg-red-500' :
                      prio === 'high' ? 'bg-orange-500' :
                      prio === 'medium' ? 'bg-amber-500' :
                      'bg-primary-500'
                    }`} style={{ width: `${(count / maxPriority) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* By Status */}
        <Card>
          <CardHeader><CardTitle>Reports by Status</CardTitle></CardHeader>
          <CardBody>
            <div className="space-y-2">
              {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between py-1.5 border-b border-charcoal-100 last:border-0">
                  <span className="text-sm text-charcoal-600 capitalize">{status.replace(/_/g, ' ')}</span>
                  <span className="text-sm font-medium text-charcoal-800">{count}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Resolved vs Unresolved */}
        <Card>
          <CardHeader><CardTitle>Resolved vs Unresolved</CardTitle></CardHeader>
          <CardBody>
            <div className="flex items-center justify-center mb-4">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                  <circle
                    cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="10"
                    strokeDasharray={`${2 * Math.PI * 40 * (completionRate / 100)} ${2 * Math.PI * 40}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-charcoal-800">{completionRate}%</span>
                </div>
              </div>
            </div>
            <div className="flex justify-around">
              <div className="text-center">
                <p className="text-lg font-bold text-primary-600">{resolved}</p>
                <p className="text-xs text-charcoal-500">Resolved</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-charcoal-600">{unresolved}</p>
                <p className="text-xs text-charcoal-500">Unresolved</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
