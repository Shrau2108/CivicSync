import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Search, CheckCircle2, XCircle, RotateCcw, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Modal';
import { fetchTasks, createVerificationRecord, updateTaskStatus, updateReportStatus, createNotification, createAuditLog } from '@/services/api';
import { formatDateTime, timeAgo } from '@/lib/utils';
import type { Task } from '@/types';

export function EvidenceVerificationPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [decisionModal, setDecisionModal] = useState<{ task: Task; decision: 'approved' | 'rejected' | 'resubmission_requested' } | null>(null);
  const [comments, setComments] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const t = await fetchTasks({ status: 'evidence_submitted' });
      setTasks(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDecision = async () => {
    if (!user || !decisionModal) return;
    setActionLoading(decisionModal.task.id);
    try {
      const { task, decision } = decisionModal;
      const beforeEvidence = task.evidence?.find(e => e.evidence_type === 'before');
      const afterEvidence = task.evidence?.find(e => e.evidence_type === 'after');
      const hashMatch = beforeEvidence?.file_hash && afterEvidence?.file_hash
        ? beforeEvidence.file_hash !== afterEvidence.file_hash
        : null;

      await createVerificationRecord({
        task_id: task.id,
        verifier_id: user.id,
        decision,
        comments: comments || undefined,
        before_hash: beforeEvidence?.file_hash || undefined,
        after_hash: afterEvidence?.file_hash || undefined,
        hash_match: hashMatch || undefined,
      });

      if (decision === 'approved') {
        await updateTaskStatus(task.id, 'completed', user.id, 'Evidence approved by supervisor');
        await updateReportStatus(task.report_id, 'resolved', user.id);
        if (task.report) {
          await createNotification({
            user_id: task.report.reporter_id,
            title: 'Issue Resolved',
            description: `Your report "${task.report.title}" has been resolved. Please provide feedback.`,
            category: 'report_resolved',
            related_report_id: task.report_id,
            related_task_id: task.id,
          });
        }
      } else if (decision === 'rejected') {
        await updateTaskStatus(task.id, 'in_progress', user.id, 'Evidence rejected, needs resubmission');
      } else {
        await updateTaskStatus(task.id, 'in_progress', user.id, 'Resubmission requested');
      }

      await createAuditLog({
        action: `evidence_${decision}`,
        entity_type: 'task',
        entity_id: task.id,
        details: { comments },
      });

      setDecisionModal(null);
      setComments('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process decision');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = tasks.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.task_id.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingState message="Loading evidence for verification..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Evidence Verification"
        description="Review before-and-after evidence submitted by volunteers"
      />

      <div className="card p-4 mb-4 bg-charcoal-50 border-charcoal-200">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-charcoal-100 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4 text-charcoal-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-charcoal-700">Verification Process</p>
            <p className="text-xs text-charcoal-500 mt-1">
              Compare before and after evidence. File integrity is checked via SHA-256 hashing.
              Hashing verifies file integrity but does not alone prove issue resolution —
              supervisor judgment is required. Tasks are not automatically marked complete.
            </p>
          </div>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Search tasks..." />
      </div>

      {filtered.length === 0 ? (
        <Card><CardBody>
          <EmptyState icon={<ShieldCheck className="w-8 h-8" />} title="No evidence to verify" description="All submitted evidence has been reviewed" />
        </CardBody></Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((task) => {
            const beforeEvidence = task.evidence?.find(e => e.evidence_type === 'before');
            const afterEvidence = task.evidence?.find(e => e.evidence_type === 'after');
            return (
              <Card key={task.id}>
                <CardBody>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div>
                      <span className="text-xs font-mono text-charcoal-400">{task.task_id}</span>
                      <p className="font-medium text-charcoal-800">{task.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <PriorityBadge level={task.priority_level} />
                      <StatusBadge status={task.status} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs font-medium text-charcoal-400 uppercase mb-2">Before</p>
                      {beforeEvidence ? (
                        <div className="rounded-lg overflow-hidden border border-charcoal-200">
                          {beforeEvidence.file_url.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                            <img src={beforeEvidence.file_url} alt="Before" className="w-full h-32 object-cover" />
                          ) : (
                            <video src={beforeEvidence.file_url} className="w-full h-32 object-cover" controls />
                          )}
                          <div className="p-2">
                            <p className="text-xs text-charcoal-500">{timeAgo(beforeEvidence.submitted_at)}</p>
                            {beforeEvidence.file_hash && <p className="text-xs text-charcoal-400 font-mono truncate">Hash: {beforeEvidence.file_hash.substring(0, 16)}...</p>}
                          </div>
                        </div>
                      ) : <p className="text-sm text-charcoal-400">No before evidence</p>}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-charcoal-400 uppercase mb-2">After</p>
                      {afterEvidence ? (
                        <div className="rounded-lg overflow-hidden border border-charcoal-200">
                          {afterEvidence.file_url.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                            <img src={afterEvidence.file_url} alt="After" className="w-full h-32 object-cover" />
                          ) : (
                            <video src={afterEvidence.file_url} className="w-full h-32 object-cover" controls />
                          )}
                          <div className="p-2">
                            <p className="text-xs text-charcoal-500">{timeAgo(afterEvidence.submitted_at)}</p>
                            {afterEvidence.file_hash && <p className="text-xs text-charcoal-400 font-mono truncate">Hash: {afterEvidence.file_hash.substring(0, 16)}...</p>}
                          </div>
                        </div>
                      ) : <p className="text-sm text-charcoal-400">No after evidence</p>}
                    </div>
                  </div>

                  {beforeEvidence?.file_hash && afterEvidence?.file_hash && (
                    <div className={`p-2 rounded-lg text-xs mb-3 ${
                      beforeEvidence.file_hash !== afterEvidence.file_hash
                        ? 'bg-primary-50 text-primary-700 border border-primary-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {beforeEvidence.file_hash !== afterEvidence.file_hash
                        ? 'File integrity verified: before and after images are different files.'
                        : 'Warning: Before and after files have the same hash. They may be identical.'}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => setDecisionModal({ task, decision: 'approved' })} disabled={actionLoading === task.id} className="btn-primary text-sm">
                      <CheckCircle2 className="w-4 h-4" /> Approve
                    </button>
                    <button onClick={() => setDecisionModal({ task, decision: 'rejected' })} disabled={actionLoading === task.id} className="btn-danger text-sm">
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                    <button onClick={() => setDecisionModal({ task, decision: 'resubmission_requested' })} disabled={actionLoading === task.id} className="btn-secondary text-sm">
                      <RotateCcw className="w-4 h-4" /> Request Resubmission
                    </button>
                    <Link to={`/app/tasks/${task.id}`} className="btn-ghost text-sm">View Details</Link>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!decisionModal}
        onClose={() => { setDecisionModal(null); setComments(''); }}
        onConfirm={handleDecision}
        title={decisionModal?.decision === 'approved' ? 'Approve Evidence' : decisionModal?.decision === 'rejected' ? 'Reject Evidence' : 'Request Resubmission'}
        message={decisionModal?.decision === 'approved'
          ? 'Approve this evidence and mark the task as completed?'
          : decisionModal?.decision === 'rejected'
          ? 'Reject this evidence? The volunteer will need to resubmit.'
          : 'Request the volunteer to resubmit evidence?'}
        confirmLabel={decisionModal?.decision === 'approved' ? 'Approve' : decisionModal?.decision === 'rejected' ? 'Reject' : 'Request'}
        danger={decisionModal?.decision === 'rejected'}
      >
        <div className="p-5">
          <label className="label">Comments <span className="text-charcoal-400 font-normal">(optional)</span></label>
          <textarea value={comments} onChange={(e) => setComments(e.target.value)} className="input min-h-[80px] resize-y" placeholder="Add your review comments..." />
        </div>
      </ConfirmDialog>
    </div>
  );
}
