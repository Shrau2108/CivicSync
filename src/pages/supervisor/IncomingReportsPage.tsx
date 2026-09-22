import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Search, CheckCircle2, XCircle, Copy, Eye } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Modal';
import { fetchReports, updateReportStatus, createNotification, createAuditLog, createDuplicateCandidate, fetchCategories } from '@/services/api';
import { detectDuplicates as detectDups } from '@/lib/duplicateDetection';
import { formatDate } from '@/lib/utils';
import type { Report, ReportCategory } from '@/types';

export function IncomingReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [categories, setCategories] = useState<ReportCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<Report | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, c] = await Promise.all([fetchReports(), fetchCategories()]);
      setReports(r.filter(rpt => rpt.status === 'submitted' || rpt.status === 'under_review'));
      setCategories(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleVerify = async (report: Report) => {
    if (!user) return;
    setActionLoading(report.id);
    try {
      await updateReportStatus(report.id, 'verified', user.id);
      await createNotification({
        user_id: report.reporter_id,
        title: 'Report Verified',
        description: `Your report "${report.title}" has been verified by a supervisor.`,
        category: 'report_reviewed',
        related_report_id: report.id,
      });
      await createAuditLog({ action: 'verify_report', entity_type: 'report', entity_id: report.id });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify report');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!user || !rejectModal) return;
    setActionLoading(rejectModal.id);
    try {
      await updateReportStatus(rejectModal.id, 'rejected', user.id);
      await createNotification({
        user_id: rejectModal.reporter_id,
        title: 'Report Rejected',
        description: `Your report "${rejectModal.title}" was rejected. Please review and resubmit if needed.`,
        category: 'report_reviewed',
        related_report_id: rejectModal.id,
      });
      await createAuditLog({ action: 'reject_report', entity_type: 'report', entity_id: rejectModal.id });
      setRejectModal(null);
      load();
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
      const results = detectDups(
        {
          title: report.title,
          description: report.description,
          category_id: report.category_id,
          latitude: report.location?.latitude,
          longitude: report.location?.longitude,
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
            similarity_reasons: result.reasons.join('; '),
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
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
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-charcoal-400">{report.report_id}</span>
                      <StatusBadge status={report.status} />
                      <PriorityBadge level={report.priority_level} />
                    </div>
                    <p className="font-medium text-charcoal-800">{report.title}</p>
                    <p className="text-sm text-charcoal-500 mt-1 line-clamp-2">{report.description}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {report.category && <span className="text-xs text-charcoal-500">{report.category.name}</span>}
                      <span className="text-xs text-charcoal-400">{formatDate(report.created_at)}</span>
                      {report.location && <span className="text-xs text-charcoal-400">{report.location.latitude.toFixed(2)}, {report.location.longitude.toFixed(2)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                    <Link to={`/app/reports/${report.id}`} className="btn-secondary text-sm">
                      <Eye className="w-4 h-4" /> View
                    </Link>
                    <button onClick={() => handleCheckDuplicates(report)} disabled={actionLoading === report.id} className="btn-secondary text-sm">
                      <Copy className="w-4 h-4" /> Check Duplicates
                    </button>
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
