import { useState, useEffect, useCallback } from 'react';
import { ScrollText, Search, Activity } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { fetchAuditLogs } from '@/services/api';
import { formatDateTime, timeAgo } from '@/lib/utils';
import type { AuditLog } from '@/types';

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const l = await fetchAuditLogs(100);
      setLogs(l);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = logs.filter(l =>
    !search || l.action.toLowerCase().includes(search.toLowerCase()) || l.actor?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingState message="Loading audit logs..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Audit Logs" description="System-wide activity trail" />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Search by action or user..." />
      </div>

      {filtered.length === 0 ? (
        <Card><CardBody>
          <EmptyState icon={<ScrollText className="w-8 h-8" />} title="No audit logs" description="System actions will be recorded here" />
        </CardBody></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-charcoal-100">
                  <th className="text-left text-xs font-medium text-charcoal-500 uppercase px-4 py-3">Actor</th>
                  <th className="text-left text-xs font-medium text-charcoal-500 uppercase px-4 py-3">Action</th>
                  <th className="text-left text-xs font-medium text-charcoal-500 uppercase px-4 py-3 hidden sm:table-cell">Entity</th>
                  <th className="text-left text-xs font-medium text-charcoal-500 uppercase px-4 py-3 hidden sm:table-cell">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-100">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-charcoal-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-charcoal-100 flex items-center justify-center flex-shrink-0">
                          <Activity className="w-3.5 h-3.5 text-charcoal-500" />
                        </div>
                        <span className="text-sm text-charcoal-700">{log.actor?.full_name || 'System'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-charcoal-700">{log.action.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-charcoal-500 hidden sm:table-cell">
                      {log.entity_type} {log.entity_id && `(${log.entity_id.substring(0, 8)}...)`}
                    </td>
                    <td className="px-4 py-3 text-sm text-charcoal-400 hidden sm:table-cell">
                      <span title={formatDateTime(log.created_at)}>{timeAgo(log.created_at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
