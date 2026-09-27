import { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, FileText, CheckCircle2, Clock, Star } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatCard, EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { fetchReports, fetchTasks, fetchVolunteers } from '@/services/api';
import type { Report, Task, Volunteer } from '@/types';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];

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

  // Process data for charts
  const categoryCount: Record<string, number> = {};
  reports.forEach(r => {
    const cat = r.category?.name || 'Other';
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });
  const categoryData = Object.entries(categoryCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const statusCount: Record<string, number> = {};
  reports.forEach(r => {
    const s = r.status.replace(/_/g, ' ');
    statusCount[s] = (statusCount[s] || 0) + 1;
  });
  const statusData = Object.entries(statusCount).map(([name, value]) => ({ name, value }));

  // Process timeline data (reports by date)
  const dateCount: Record<string, number> = {};
  reports.forEach(r => {
    const date = new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    dateCount[date] = (dateCount[date] || 0) + 1;
  });
  const timelineData = Object.entries(dateCount).slice(0, 7).reverse().map(([date, count]) => ({ date, count }));

  const resolved = reports.filter(r => r.status === 'resolved').length;
  const completionRate = reports.length > 0 ? Math.round((resolved / reports.length) * 100) : 0;

  return (
    <div>
      <PageHeader title="Analytics Dashboard" description="Comprehensive platform insights and trends" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Reports" value={reports.length} icon={<FileText className="w-5 h-5 text-primary" />} />
        <StatCard label="Resolved Issues" value={resolved} icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} />
        <StatCard label="Resolution Rate" value={`${completionRate}%`} icon={<TrendingUp className="w-5 h-5 text-purple-500" />} />
        <StatCard label="Active Volunteers" value={volunteers.filter(v => v.is_verified).length} icon={<Star className="w-5 h-5 text-amber-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader><CardTitle>Report Volume (Last 7 Days)</CardTitle></CardHeader>
          <CardBody className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Line type="monotone" dataKey="count" name="Reports" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Reports by Category</CardTitle></CardHeader>
          <CardBody className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" fontSize={12} hide />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} width={100} />
                <Tooltip 
                  cursor={{ fill: '#1e293b' }}
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Report Status Distribution</CardTitle></CardHeader>
          <CardBody className="h-80 flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                  itemStyle={{ textTransform: 'capitalize' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', textTransform: 'capitalize' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
