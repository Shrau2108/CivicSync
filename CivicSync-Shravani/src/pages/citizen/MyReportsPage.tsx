import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search, Filter, PlusCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { fetchReportsByReporter, fetchReports } from '@/services/api';
import { formatDate } from '@/lib/utils';
import type { Report } from '@/types';

export function MyReportsPage() {
  const { user, profile } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const rpts = profile?.role === 'admin' ? await fetchReports() : await fetchReportsByReporter(user.id);
      setReports(rpts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => { load(); }, [load]);

  const filtered = reports.filter(r => {
    const matchesSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.report_id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <LoadingState message="Loading reports..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title={profile?.role === 'admin' ? 'All Reports' : 'My Reports'}
        description="View and track all your submitted reports"
        action={profile?.role !== 'admin' && <Link to="/app/citizen/report" className="btn-primary"><PlusCircle className="w-4 h-4" /> New Report</Link>}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
            placeholder="Search by title or report ID..."
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-48">
          <option value="all">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="verified">Verified</option>
          <option value="prioritized">Prioritized</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
          <option value="duplicate">Duplicate</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardBody>
          <EmptyState
            icon={<FileText className="w-8 h-8" />}
            title={reports.length === 0 ? 'No reports yet' : 'No matching reports'}
            description={reports.length === 0 ? 'Start by reporting a community issue' : 'Try adjusting your filters'}
            action={reports.length === 0 && profile?.role !== 'admin' ? <Link to="/app/citizen/report" className="btn-primary"><PlusCircle className="w-4 h-4" /> Report an Issue</Link> : undefined}
          />
        </CardBody></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <Link key={report.id} to={`/app/reports/${report.id}`}>
              <Card hoverable>
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-charcoal-400">{report.report_id}</span>
                        <StatusBadge status={report.status} />
                      </div>
                      <p className="font-medium text-charcoal-800 truncate">{report.title}</p>
                      <p className="text-sm text-charcoal-500 mt-1 line-clamp-2">{report.description}</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {report.category && <span className="text-xs text-charcoal-500">{report.category.name}</span>}
                        <span className="text-xs text-charcoal-400">{formatDate(report.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <PriorityBadge level={report.priority_level} />
                      {report.location && (
                        <span className="text-xs text-charcoal-400">{report.location.latitude.toFixed(2)}, {report.location.longitude.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
