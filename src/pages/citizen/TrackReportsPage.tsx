import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Search, PlusCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { fetchReportsByReporter } from '@/services/api';
import { formatDate } from '@/lib/utils';
import type { Report } from '@/types';

export function TrackReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const rpts = await fetchReportsByReporter(user.id);
      setReports(rpts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const filtered = reports.filter(r =>
    !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.report_id.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingState message="Loading reports..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Track Reports"
        description="Monitor the progress of all your submitted reports"
        action={<Link to="/app/citizen/report" className="btn-primary"><PlusCircle className="w-4 h-4" /> New Report</Link>}
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-10"
          placeholder="Search by title or report ID..."
        />
      </div>

      {filtered.length === 0 ? (
        <Card><CardBody>
          <EmptyState
            icon={<ClipboardList className="w-8 h-8" />}
            title={reports.length === 0 ? 'No reports to track' : 'No matching reports'}
            description={reports.length === 0 ? 'Submit a report to start tracking its progress' : 'Try a different search'}
          />
        </CardBody></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <Link key={report.id} to={`/app/reports/${report.id}`}>
              <Card hoverable>
                <CardBody>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-charcoal-400">{report.report_id}</span>
                        <StatusBadge status={report.status} />
                      </div>
                      <p className="font-medium text-charcoal-800 truncate">{report.title}</p>
                      <p className="text-xs text-charcoal-400 mt-1">Submitted {formatDate(report.created_at)}</p>
                    </div>
                    <PriorityBadge level={report.priority_level} />
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
