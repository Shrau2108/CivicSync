import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Search, CheckCircle2, XCircle, Copy, Eye, Play } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Modal';
import { fetchReports, reviewReport, createDuplicateCandidate } from '@/services/api';
import { detectDuplicatesAsync, serializeDetectionReasons } from '@/lib/duplicateDetection';
import { formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Report } from '@/types';

export function IncomingReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<Report | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchReports();
      setReports(r.filter(rpt => rpt.status === 'submitted' || rpt.status === 'under_review'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const channel = supabase.channel('incoming_reports_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const handleVerify = async (report: Report) => {
    if (!user) return;
    setActionLoading(report.id);
    try {
      await reviewReport(report.id, 'verified', user.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify report');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartReview = async (report: Report) => {
    if (!user) return;
    setActionLoading(report.id);
    try {
      await reviewReport(report.id, 'under_review', user.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start report review');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!user || !rejectModal) return;
    setActionLoading(rejectModal.id);
    try {
      await reviewReport(rejectModal.id, 'rejected', user.id);
      setRejectModal(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject report');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckDuplicates = async (report: Report) => {
    if (!user) return;
    setActionLoading(report.id);
    try {
      const allReports = await fetchReports();
      const otherReports = allReports.filter(r => r.id !== report.id && !['resolved','cancelled','rejected','duplicate'].includes(r.status));
      const results = await detectDuplicatesAsync(
        {
          id: report.id,
          title: report.title,
          description: report.description,
          category_id: report.category_id,
          latitude: report.location?.latitude,
          longitude: report.location?.longitude,
          mediaUrl: report.media?.[0]?.file_url,
        },
        otherReports
      );
      if (results.length > 0) {
        for (const result of results) {
          await createDuplicateCandidate({
            report_id: report.id,
            candidate_report_id: result.candidateReportId,
            similarity_type: result.similarityType,
            similarity_score: result.similarityScore,
            similarity_reasons: serializeDetectionReasons(result),
          });
        }
        alert(`Found ${results.length} potential duplicate(s). Check the Duplicate Review page.`);
      } else {
        alert('No potential duplicates found.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check duplicates');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = reports.filter(r =>
    !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.report_id.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingState message="Loading incoming reports..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Incoming Reports" description="Review and verify newly submitted reports" />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Search reports..." />
      </div>

      {filtered.length === 0 ? (
        <Card><CardBody>
          <EmptyState icon={<Inbox className="w-8 h-8" />} title="No incoming reports" description="All reports have been reviewed" />
        </CardBody></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <Card key={report.id}>
              <CardBody>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Media Thumbnail Preview */}
                  {report.media && report.media.length > 0 && (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-900 border border-border flex-shrink-0 relative shadow-sm">
                      {(() => {
                        const firstMedia = report.media[0];
                        const isVid = firstMedia.file_type === 'video' || !!firstMedia.file_name?.match(/\.(mp4|mov|webm|ogg|m4v)$/i) || firstMedia.file_url.startsWith('data:video/');
                        if (isVid) {
                          return (
                            <div className="w-full h-full bg-black/60 flex items-center justify-center relative">
                              <video src={firstMedia.file_url} className="w-full h-full object-cover" preload="metadata" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <Play className="w-5 h-5 text-white fill-white/90 drop-shadow" />
                              </div>
                            </div>
                          );
                        }
                        return (
                          <img src={firstMedia.file_url} alt="" className="w-full h-full object-cover" />
                        );
                      })()}
                      {report.media.length > 1 && (
                        <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] text-white px-1.5 py-0.2 rounded font-mono font-medium">
                          +{report.media.length - 1}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{report.report_id}</span>
                      <StatusBadge status={report.status} />
                      <PriorityBadge level={report.priority_level} />
                    </div>
                    <p className="font-medium text-foreground">{report.title}</p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{report.description}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {report.category && <span className="text-xs text-muted-foreground">{report.category.name}</span>}
                      <span className="text-xs text-muted-foreground">{formatDate(report.created_at)}</span>
                      {report.location && <span className="text-xs text-muted-foreground">{report.location.latitude.toFixed(2)}, {report.location.longitude.toFixed(2)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                    <Link to={`/app/reports/${report.id}`} className="btn-secondary text-sm">
                      <Eye className="w-4 h-4" /> View
                    </Link>
                    <button onClick={() => handleCheckDuplicates(report)} disabled={actionLoading === report.id} className="btn-secondary text-sm">
                      <Copy className="w-4 h-4" /> Check Duplicates
                    </button>
                    {report.status === 'submitted' && (
                      <button onClick={() => handleStartReview(report)} disabled={actionLoading === report.id} className="btn-secondary text-sm">
                        {actionLoading === report.id ? 'Starting...' : 'Start Review'}
                      </button>
                    )}
                    <button onClick={() => handleVerify(report)} disabled={actionLoading === report.id} className="btn-primary text-sm">
                      <CheckCircle2 className="w-4 h-4" /> Verify
                    </button>
                    <button onClick={() => setRejectModal(report)} disabled={actionLoading === report.id} className="btn-danger text-sm">
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!rejectModal}
        onClose={() => setRejectModal(null)}
        onConfirm={handleReject}
        title="Reject Report"
        message={`Are you sure you want to reject "${rejectModal?.title}"? The reporter will be notified.`}
        confirmLabel="Reject"
        danger
      />
    </div>
  );
}
