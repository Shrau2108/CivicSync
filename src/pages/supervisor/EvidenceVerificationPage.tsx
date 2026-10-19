import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Search, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Modal';
import { fetchTasks, createVerificationRecord, updateTaskStatus, updateReportStatus, createNotification, createAuditLog } from '@/services/api';
import { timeAgo } from '@/lib/utils';
import type { Evidence, Task } from '@/types';

function latestEvidence(task: Task, evidenceType: Evidence['evidence_type']) {
  return (task.evidence || [])
    .filter((evidence) => evidence.evidence_type === evidenceType)
    .sort((first, second) => new Date(second.submitted_at).getTime() - new Date(first.submitted_at).getTime())[0];
}

export function EvidenceVerificationPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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
    setActionError(null);
    try {
      const { task, decision } = decisionModal;
      const beforeEvidence = latestEvidence(task, 'before');
      const afterEvidence = latestEvidence(task, 'after');
      const hashMatch = beforeEvidence?.file_hash && afterEvidence?.file_hash
        ? beforeEvidence.file_hash === afterEvidence.file_hash
        : null;

      await createVerificationRecord({
        task_id: task.id,
        verifier_id: user.id,
        decision,
        comments: comments || undefined,
        before_hash: beforeEvidence?.file_hash || undefined,
        after_hash: afterEvidence?.file_hash || undefined,
        hash_match: hashMatch ?? undefined,
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
      setActionError(err instanceof Error ? err.message : 'Failed to process decision');
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

      {actionError && <p role="alert" className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{actionError}</p>}

      <div className="card p-4 mb-4 bg-background border-border">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Verification Process</p>
            <p className="text-xs text-muted-foreground mt-1">
              Compare before and after evidence. File integrity is checked via SHA-256 hashing.
              Hashing verifies file integrity but does not alone prove issue resolution —
              supervisor judgment is required. Tasks are not automatically marked complete.
            </p>
          </div>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Search tasks..." />
      </div>

      {filtered.length === 0 ? (
        <Card><CardBody>
          <EmptyState icon={<ShieldCheck className="w-8 h-8" />} title="No evidence to verify" description="All submitted evidence has been reviewed" />
        </CardBody></Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((task) => {
            const beforeEvidence = latestEvidence(task, 'before');
            const afterEvidence = latestEvidence(task, 'after');
            return (
              <Card key={task.id}>
                <CardBody>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div>
                      <span className="text-xs font-mono text-muted-foreground">{task.task_id}</span>
                      <p className="font-medium text-foreground">{task.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <PriorityBadge level={task.priority_level} />
                      <StatusBadge status={task.status} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Before</p>
                      {beforeEvidence ? (
                        <EvidencePreview evidence={beforeEvidence} label="Before" />
                      ) : <p className="text-sm text-muted-foreground">No before evidence</p>}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase mb-2">After</p>
                      {afterEvidence ? (
                        <EvidencePreview evidence={afterEvidence} label="After" />
                      ) : <p className="text-sm text-muted-foreground">No after evidence</p>}
                    </div>
                  </div>

                  {beforeEvidence?.file_hash && afterEvidence?.file_hash && (
                    <div className={`p-2 rounded-lg text-xs mb-3 ${
                      beforeEvidence.file_hash !== afterEvidence.file_hash
                        ? 'bg-primary/10 text-primary border border-primary/20'
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
          <label className="label">Comments <span className="text-muted-foreground font-normal">(optional)</span></label>
          <textarea value={comments} onChange={(e) => setComments(e.target.value)} className="input min-h-[80px] resize-y" placeholder="Add your review comments..." />
        </div>
      </ConfirmDialog>
    </div>
  );
}

function EvidencePreview({ evidence, label }: { evidence: Evidence; label: string }) {
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const fileName = evidence.file_name || 'Evidence file';
  const isImage = /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(fileName)
    || evidence.file_url.startsWith('data:image/');

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
      {previewUnavailable ? (
        <div role="status" className="flex min-h-40 items-center justify-center bg-muted/40 px-4 text-center text-sm text-muted-foreground">
          Preview unavailable. Ask the volunteer to upload this evidence again.
        </div>
      ) : isImage ? (
        <a href={evidence.file_url} target="_blank" rel="noreferrer" aria-label={`Open ${label.toLowerCase()} evidence image`}>
          <img onError={() => setPreviewUnavailable(true)} src={evidence.file_url} alt={`${label} evidence`} className="max-h-[360px] min-h-48 w-full bg-black/5 object-contain" />
        </a>
      ) : (
        <video onError={() => setPreviewUnavailable(true)} src={evidence.file_url} className="max-h-[360px] min-h-48 w-full bg-black object-contain" controls preload="metadata" />
      )}
      <div className="space-y-1 border-t border-border p-3">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate text-xs font-medium text-foreground" title={fileName}>{fileName}</p>
          <p className="shrink-0 text-xs text-muted-foreground">{timeAgo(evidence.submitted_at)}</p>
        </div>
        {evidence.notes && <p className="text-sm text-muted-foreground">{evidence.notes}</p>}
        {evidence.file_hash && <p className="truncate font-mono text-[11px] text-muted-foreground">SHA-256: {evidence.file_hash}</p>}
        {!isImage && <a href={evidence.file_url} target="_blank" rel="noreferrer" className="inline-flex text-xs font-medium text-primary hover:underline">Open video in new tab</a>}
      </div>
    </div>
  );
}
