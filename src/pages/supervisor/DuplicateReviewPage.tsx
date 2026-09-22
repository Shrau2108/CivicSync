import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Copy, CheckCircle2, XCircle, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { fetchDuplicateCandidates, resolveDuplicateCandidate, markDuplicate, createAuditLog } from '@/services/api';
import { formatDate } from '@/lib/utils';
import type { DuplicateCandidate } from '@/types';

export function DuplicateReviewPage() {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await fetchDuplicateCandidates();
      setCandidates(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load duplicate candidates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleConfirmDuplicate = async (candidate: DuplicateCandidate) => {
    if (!user) return;
    setActionLoading(candidate.id);
    try {
      await resolveDuplicateCandidate(candidate.id, 'confirmed_duplicate', user.id);
      await markDuplicate(candidate.report_id, candidate.candidate_report_id);
      await createAuditLog({
        action: 'confirm_duplicate',
        entity_type: 'report',
        entity_id: candidate.report_id,
        details: { candidate: candidate.candidate_report_id, score: candidate.similarity_score },
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm duplicate');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkSeparate = async (candidate: DuplicateCandidate) => {
    if (!user) return;
    setActionLoading(candidate.id);
    try {
      await resolveDuplicateCandidate(candidate.id, 'marked_separate', user.id);
      await createAuditLog({
        action: 'mark_separate',
        entity_type: 'report',
        entity_id: candidate.report_id,
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as separate');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <LoadingState message="Loading duplicate candidates..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Duplicate Review"
        description="Review potential duplicate reports detected by similarity algorithms"
      />

      <div className="card p-4 mb-4 bg-amber-50 border-amber-200">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Copy className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-amber-800">Similarity Detection Methods</p>
            <p className="text-xs text-amber-700 mt-1">
              Duplicates are detected using text similarity (Jaccard index on title/description words),
              geographic proximity (Haversine distance), category matching, and file hash comparison.
              Each method is clearly labeled. Advanced computer vision similarity is a future scope feature.
            </p>
          </div>
        </div>
      </div>

      {candidates.length === 0 ? (
        <Card><CardBody>
          <EmptyState icon={<Copy className="w-8 h-8" />} title="No duplicates to review" description="All potential duplicates have been resolved" />
        </CardBody></Card>
      ) : (
        <div className="space-y-4">
          {candidates.map((candidate) => (
            <Card key={candidate.id}>
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs font-medium text-charcoal-400 uppercase mb-2">Report</p>
                    <Link to={`/app/reports/${candidate.report_id}`} className="block">
                      <div className="p-3 rounded-lg bg-charcoal-50 border border-charcoal-200 hover:border-primary-300 transition-colors">
                        <p className="font-medium text-charcoal-800 text-sm">{candidate.report?.title || 'Unknown'}</p>
                        <p className="text-xs text-charcoal-400 mt-1">{candidate.report?.report_id}</p>
                      </div>
                    </Link>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-charcoal-400 uppercase mb-2">Potential Duplicate</p>
                    <Link to={`/app/reports/${candidate.candidate_report_id}`} className="block">
                      <div className="p-3 rounded-lg bg-charcoal-50 border border-charcoal-200 hover:border-primary-300 transition-colors">
                        <p className="font-medium text-charcoal-800 text-sm">{candidate.candidateReport?.title || 'Unknown'}</p>
                        <p className="text-xs text-charcoal-400 mt-1">{candidate.candidateReport?.report_id}</p>
                      </div>
                    </Link>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <span className={`badge border ${
                    candidate.similarity_type === 'text' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    candidate.similarity_type === 'geographic' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                    candidate.similarity_type === 'file_hash' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                    'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {candidate.similarity_type.replace('_', ' ')} similarity
                  </span>
                  <span className="text-sm font-mono text-charcoal-600">Score: {candidate.similarity_score.toFixed(0)}%</span>
                  <span className="text-xs text-charcoal-400">{formatDate(candidate.created_at)}</span>
                </div>

                {candidate.similarity_reasons && (
                  <div className="p-3 rounded-lg bg-charcoal-50 border border-charcoal-200 mb-4">
                    <p className="text-xs font-medium text-charcoal-400 uppercase mb-1">Reasons</p>
                    <p className="text-sm text-charcoal-600">{candidate.similarity_reasons}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfirmDuplicate(candidate)}
                    disabled={actionLoading === candidate.id}
                    className="btn-danger text-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Confirm Duplicate
                  </button>
                  <button
                    onClick={() => handleMarkSeparate(candidate)}
                    disabled={actionLoading === candidate.id}
                    className="btn-secondary text-sm"
                  >
                    <XCircle className="w-4 h-4" /> Mark as Separate
                  </button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
