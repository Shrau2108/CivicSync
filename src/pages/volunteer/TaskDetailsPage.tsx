import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Clock, Users, FileText, Tag, Calendar,
  CheckCircle2, XCircle, Upload, Loader2, AlertCircle, Image as ImageIcon,
  MessageSquare, History,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Modal';
import {
  fetchTaskById, acceptTask, declineTask, updateTaskStatus,
  uploadEvidence, createNotification,
} from '@/services/api';
import { formatDateTime, timeAgo } from '@/lib/utils';
import type { Task, Evidence } from '@/types';

const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function TaskDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [evidenceType, setEvidenceType] = useState<'before' | 'after'>('before');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const t = await fetchTaskById(id);
      setTask(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleAccept = async () => {
    if (!user || !id) return;
    setAccepting(true);
    setAcceptError(null);
    const result = await acceptTask(id, user.id);
    setAccepting(false);
    if (result.success) {
      load();
    } else {
      setAcceptError(result.error || 'Failed to accept task');
    }
  };

  const handleDecline = async () => {
    if (!user || !id) return;
    try {
      await declineTask(id, user.id, declineReason);
      setShowDeclineModal(false);
      navigate('/app/volunteer/available');
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : 'Failed to decline task');
    }
  };

  const handleEvidenceUpload = async () => {
    if (!user || !task || !evidenceFile) return;
    setUploadingEvidence(true);
    setEvidenceError(null);
    try {
      await uploadEvidence(task.id, user.id, evidenceFile, evidenceType, evidenceNotes || undefined);
      if (evidenceType === 'after') {
        await updateTaskStatus(task.id, 'evidence_submitted', user.id, 'Evidence submitted by volunteer');
        if (task.report) {
          await createNotification({
            user_id: task.report.reporter_id,
            title: 'Evidence Submitted',
            description: `Evidence has been submitted for task: ${task.title}`,
            category: 'evidence_submitted',
            related_report_id: task.report_id,
            related_task_id: task.id,
          });
        }
      }
      setEvidenceFile(null);
      setEvidenceNotes('');
      load();
    } catch (err) {
      setEvidenceError(err instanceof Error ? err.message : 'Failed to upload evidence');
    } finally {
      setUploadingEvidence(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ACCEPTED_FILE_TYPES.includes(f.type)) {
      setEvidenceError('Unsupported file type. Use JPEG, PNG, WebP, or MP4.');
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setEvidenceError('File exceeds 10MB limit.');
      return;
    }
    setEvidenceError(null);
    setEvidenceFile(f);
  };

  const handleStartWork = async () => {
    if (!user || !task) return;
    await updateTaskStatus(task.id, 'in_progress', user.id, 'Work started by volunteer');
    load();
  };

  if (loading) return <LoadingState message="Loading task..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!task) return <ErrorState message="Task not found" />;

  const myAssignment = task.assignments?.find(a => a.volunteer_id === user?.id);
  const canAccept = myAssignment?.status === 'assigned';
  const canDecline = myAssignment?.status === 'assigned';
  const canStartWork = task.status === 'accepted' && myAssignment?.status === 'accepted';
  const canUploadEvidence = task.status === 'in_progress' || task.status === 'accepted';
  const beforeEvidence = task.evidence?.filter(e => e.evidence_type === 'before') || [];
  const afterEvidence = task.evidence?.filter(e => e.evidence_type === 'after') || [];

  return (
    <div>
      <Link to={profile?.role === 'admin' ? '/app/admin/tasks' : '/app/volunteer/tasks'} className="btn-ghost text-sm mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Tasks
      </Link>

      <PageHeader title={task.title} description={`Task ID: ${task.task_id}`} />

      {acceptError && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm animate-fade-in">
          <AlertCircle className="w-4 h-4" /> {acceptError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Task Details</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              {task.description && <p className="text-sm text-charcoal-700">{task.description}</p>}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="flex items-center gap-2 text-sm text-charcoal-600">
                  <Clock className="w-4 h-4 text-charcoal-400" />
                  {task.estimated_time_minutes ? `${task.estimated_time_minutes} min` : 'No estimate'}
                </div>
                <div className="flex items-center gap-2 text-sm text-charcoal-600">
                  <Users className="w-4 h-4 text-charcoal-400" />
                  {task.affected_people} affected
                </div>
                <div className="flex items-center gap-2 text-sm text-charcoal-600">
                  <Calendar className="w-4 h-4 text-charcoal-400" />
                  {formatDateTime(task.created_at)}
                </div>
                {task.deadline && (
                  <div className="flex items-center gap-2 text-sm text-charcoal-600">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    Due: {formatDateTime(task.deadline)}
                  </div>
                )}
              </div>
              {task.required_skills && task.required_skills.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-medium text-charcoal-400 uppercase mb-2">Required Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {task.required_skills.map((s, i) => (
                      <span key={i} className="badge bg-primary-50 text-primary-700 border border-primary-200">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {task.notes && (
                <div className="pt-2 border-t border-charcoal-100">
                  <p className="text-xs font-medium text-charcoal-400 uppercase mb-1">Notes</p>
                  <p className="text-sm text-charcoal-600">{task.notes}</p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Evidence Upload */}
          {canUploadEvidence && (
            <Card>
              <CardHeader><CardTitle>Upload Evidence</CardTitle></CardHeader>
              <CardBody className="space-y-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEvidenceType('before')}
                    className={`btn text-sm ${evidenceType === 'before' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    Before
                  </button>
                  <button
                    type="button"
                    onClick={() => setEvidenceType('after')}
                    className={`btn text-sm ${evidenceType === 'after' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    After
                  </button>
                </div>

                <label className="block">
                  <div className="border-2 border-dashed border-charcoal-200 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 transition-colors">
                    <Upload className="w-6 h-6 text-charcoal-400 mx-auto mb-2" />
                    <p className="text-sm text-charcoal-600">
                      {evidenceFile ? evidenceFile.name : 'Click to select a file'}
                    </p>
                    <p className="text-xs text-charcoal-400 mt-1">JPEG, PNG, WebP, MP4 up to 10MB</p>
                  </div>
                  <input type="file" accept={ACCEPTED_FILE_TYPES.join(',')} onChange={handleFileSelect} className="hidden" />
                </label>

                <div>
                  <label className="label">Notes <span className="text-charcoal-400 font-normal">(optional)</span></label>
                  <textarea
                    value={evidenceNotes}
                    onChange={(e) => setEvidenceNotes(e.target.value)}
                    className="input min-h-[60px] resize-y"
                    placeholder="Add notes about this evidence..."
                  />
                </div>

                {evidenceError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{evidenceError}</div>
                )}

                <button
                  type="button"
                  onClick={handleEvidenceUpload}
                  disabled={!evidenceFile || uploadingEvidence}
                  className="btn-primary w-full"
                >
                  {uploadingEvidence ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploadingEvidence ? 'Uploading...' : `Upload ${evidenceType === 'before' ? 'Before' : 'After'} Evidence`}
                </button>
              </CardBody>
            </Card>
          )}

          {/* Evidence Gallery */}
          {(beforeEvidence.length > 0 || afterEvidence.length > 0) && (
            <Card>
              <CardHeader><CardTitle>Submitted Evidence</CardTitle></CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-charcoal-400 uppercase mb-2">Before</p>
                    <div className="space-y-2">
                      {beforeEvidence.length === 0 ? (
                        <p className="text-sm text-charcoal-400">No before evidence</p>
                      ) : beforeEvidence.map((e) => (
                        <EvidenceCard key={e.id} evidence={e} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-charcoal-400 uppercase mb-2">After</p>
                    <div className="space-y-2">
                      {afterEvidence.length === 0 ? (
                        <p className="text-sm text-charcoal-400">No after evidence</p>
                      ) : afterEvidence.map((e) => (
                        <EvidenceCard key={e.id} evidence={e} />
                      ))}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Task History */}
          {task.history && task.history.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Task History</CardTitle></CardHeader>
              <CardBody>
                <div className="space-y-3">
                  {task.history.map((h) => (
                    <div key={h.id} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-charcoal-100 flex items-center justify-center flex-shrink-0">
                        <History className="w-3.5 h-3.5 text-charcoal-500" />
                      </div>
                      <div>
                        <p className="text-sm text-charcoal-700">
                          {h.from_status ? `${h.from_status} → ${h.to_status}` : `→ ${h.to_status}`}
                        </p>
                        {h.reason && <p className="text-xs text-charcoal-500">{h.reason}</p>}
                        <p className="text-xs text-charcoal-400">{timeAgo(h.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Status</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-charcoal-500">Task Status</span>
                <StatusBadge status={task.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-charcoal-500">Priority</span>
                <PriorityBadge level={task.priority_level} />
              </div>
              {task.report && (
                <Link to={`/app/reports/${task.report_id}`} className="btn-secondary w-full text-sm">
                  <FileText className="w-4 h-4" /> View Report
                </Link>
              )}
            </CardBody>
          </Card>

          {/* Actions */}
          <div className="space-y-2">
            {canAccept && (
              <>
                <button onClick={handleAccept} disabled={accepting} className="btn-primary w-full">
                  {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {accepting ? 'Accepting...' : 'Accept Task'}
                </button>
                <button onClick={() => setShowDeclineModal(true)} disabled={accepting} className="btn-danger w-full">
                  <XCircle className="w-4 h-4" /> Decline
                </button>
              </>
            )}
            {canStartWork && (
              <button onClick={handleStartWork} className="btn-primary w-full">
                <CheckCircle2 className="w-4 h-4" /> Start Working
              </button>
            )}
          </div>

          {task.report?.location && (
            <Card>
              <CardHeader><CardTitle>Location</CardTitle></CardHeader>
              <CardBody>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-charcoal-400 mt-0.5" />
                  <div>
                    {task.report.location.address && <p className="text-sm text-charcoal-700">{task.report.location.address}</p>}
                    <p className="text-sm text-charcoal-500 font-mono">
                      {task.report.location.latitude.toFixed(4)}, {task.report.location.longitude.toFixed(4)}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showDeclineModal}
        onClose={() => setShowDeclineModal(false)}
        onConfirm={handleDecline}
        title="Decline Task"
        message="Are you sure you want to decline this task? Please provide a reason."
        confirmLabel="Decline"
        danger
      />
    </div>
  );
}

function EvidenceCard({ evidence }: { evidence: Evidence }) {
  return (
    <div className="rounded-lg overflow-hidden border border-charcoal-200">
      {evidence.file_url.match(/\.(jpg|jpeg|png|webp)$/i) ? (
        <img src={evidence.file_url} alt={evidence.file_name || 'Evidence'} className="w-full h-24 object-cover" />
      ) : (
        <video src={evidence.file_url} className="w-full h-24 object-cover" controls />
      )}
      <div className="p-2">
        <p className="text-xs text-charcoal-500 truncate">{evidence.file_name}</p>
        <p className="text-xs text-charcoal-400">{timeAgo(evidence.submitted_at)}</p>
        {evidence.notes && <p className="text-xs text-charcoal-600 mt-1">{evidence.notes}</p>}
      </div>
    </div>
  );
}
