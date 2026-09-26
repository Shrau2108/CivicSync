import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpDown, Search, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { fetchReports } from '@/services/api';
import { formatDate } from '@/lib/utils';
import { buildPriorityQueue } from '@/lib/priorityQueue';
import type { Report } from '@/types';

export function PriorityQueuePage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchReports();
      const queueable = r.filter(rpt =>
        ['verified', 'prioritized', 'assigned'].includes(rpt.status)
      );
      setReports(queueable);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load priority queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const heap = buildPriorityQueue(reports);
  const sorted = heap.toSortedArray();

  const filtered = sorted.filter(item =>
    !search || item.data.title.toLowerCase().includes(search.toLowerCase()) || item.data.report_id.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingState message="Loading priority queue..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Priority Queue"
        description="Reports sorted by priority score using a max-heap data structure"
      />

      <div className="card p-4 mb-4 bg-navy-50 border-navy-200">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center flex-shrink-0">
            <ArrowUpDown className="w-4 h-4 text-navy-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-navy-800">Max-Heap Priority Queue</p>
            <p className="text-xs text-navy-600 mt-1">
              Reports are sorted by priority score. The max-heap ensures O(log n) insertion and O(log n) extraction.
              Scores are calculated from severity (40%), urgency (25%), affected people (20%), and waiting time (15%).
              Weights are configurable in system settings.
            </p>
          </div>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Search queue..." />
      </div>

      {filtered.length === 0 ? (
        <Card><CardBody>
          <EmptyState icon={<ArrowUpDown className="w-8 h-8" />} title="Queue is empty" description="No reports awaiting prioritization" />
        </CardBody></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item, index) => (
            <Link key={item.data.id} to={`/app/reports/${item.data.id}`}>
              <Card hoverable>
                <CardBody>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                      index === 0 ? 'bg-red-100 text-red-600' : 'bg-charcoal-100 text-charcoal-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-charcoal-400">{item.data.report_id}</span>
                        <StatusBadge status={item.data.status} />
                      </div>
                      <p className="font-medium text-charcoal-800 truncate">{item.data.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {item.data.category && <span className="text-xs text-charcoal-500">{item.data.category.name}</span>}
                        <span className="text-xs text-charcoal-400">{formatDate(item.data.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <PriorityBadge level={item.data.priority_level} />
                      <span className="text-xs font-mono text-charcoal-500">Score: {item.score}</span>
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
