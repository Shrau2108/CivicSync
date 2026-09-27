import { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Calendar, Users, FileText, Image as ImageIcon,
  CheckCircle2, AlertCircle, Clock, User, Tag, MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { fetchReportById, fetchFeedbackForReport } from '@/services/api';
import { supabase } from '@/lib/supabase';
import { formatDateTime, timeAgo, REPORT_STATUS_LABELS } from '@/lib/utils';
import type { Report, Feedback } from '@/types';

const STATUS_FLOW: { status: string; label: string }[] = [
  { status: 'submitted', label: 'Submitted' },
  { status: 'under_review', label: 'Under Review' },
  { status: 'verified', label: 'Verified' },
  { status: 'prioritized', label: 'Prioritized' },
  { status: 'assigned', label: 'Assigned' },
  { status: 'accepted', label: 'Accepted' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'evidence_submitted', label: 'Evidence Submitted' },
  { status: 'under_verification', label: 'Under Verification' },
  { status: 'resolved', label: 'Resolved' },
];

export function ReportDetailsPage() {
  const { id } = useParams();
  const location = useLocation();
  const { profile } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const justCreated = (location.state as { justCreated?: boolean })?.justCreated;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [rpt, fb] = await Promise.all([
        fetchReportById(id),
        fetchFeedbackForReport(id),
      ]);
      setReport(rpt);
      setFeedback(fb);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    if (!id) return;
    
    // Subscribe to realtime updates for this specific report
    const channel = supabase.channel(`report_details_${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports', filter: `id=eq.${id}` },
        () => {
          load();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'report_media', filter: `report_id=eq.${id}` },
        () => {
          load();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, id]);

  if (loading) return <LoadingState message="Loading report..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!report) return <ErrorState message="Report not found" />;

  const currentStatusIndex = STATUS_FLOW.findIndex(s => s.status === report.status);
  const isResolved = report.status === 'resolved';
  const canGiveFeedback = isResolved && profile?.id === report.reporter_id;

  return (
    <div>
      <Link to={profile?.role === 'admin' ? '/app/admin/reports' : '/app/citizen/reports'} className="btn-ghost text-sm mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Reports
      </Link>

      {justCreated && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          Your report has been submitted successfully! Report ID: <span className="font-mono font-semibold">{report.report_id}</span>
        </div>
      )}

      <PageHeader title={report.title} description={`Report ID: ${report.report_id}`} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader><CardTitle>Description</CardTitle></CardHeader>
            <CardBody>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{report.description}</p>
              {report.additional_notes && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Additional Notes</p>
                  <p className="text-sm text-muted-foreground">{report.additional_notes}</p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Media */}
          {report.media && report.media.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Evidence Media</CardTitle></CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {report.media.map((m) => (
                    <div key={m.id} className="relative group rounded-lg overflow-hidden border border-border">
                      {m.file_type === 'image' ? (
                        <img src={m.file_url} alt={m.file_name || 'Evidence'} className="w-full h-32 object-cover" />
                      ) : (
                        <video src={m.file_url} className="w-full h-32 object-cover" controls />
                      )}
                      {m.file_hash && (
                        <div className="absolute bottom-0 left-0 right-0 bg-charcoal-900/70 text-white text-xs px-2 py-1 truncate">
                          Hash: {m.file_hash.substring(0, 16)}...
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Status Timeline */}
          <Card>
            <CardHeader><CardTitle>Status Timeline</CardTitle></CardHeader>
            <CardBody>
              <div className="space-y-3">
                {STATUS_FLOW.map((step, i) => {
                  const reached = i <= currentStatusIndex;
                  const isCurrent = i === currentStatusIndex;
                  return (
                    <div key={step.status} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        reached ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                      }`}>
                        {reached ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${reached ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                          {step.label}
                        </p>
                        {isCurrent && <p className="text-xs text-primary">Current status</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {report.status === 'rejected' && (
                <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-red-200 text-red-700 text-sm">
                  This report was rejected. Please contact support if you believe this is an error.
                </div>
              )}
              {report.status === 'duplicate' && (
                <div className="mt-4 p-3 rounded-lg bg-background border border-border text-muted-foreground text-sm">
                  This report was marked as a duplicate.
                </div>
              )}
            </CardBody>
          </Card>

          {/* Feedback */}
          {feedback.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Feedback</CardTitle></CardHeader>
              <CardBody>
                <div className="space-y-3">
                  {feedback.map((fb) => (
                    <div key={fb.id} className="p-3 rounded-lg bg-background border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex">
                          {[1,2,3,4,5].map(i => (
                            <span key={i} className={i <= fb.rating ? 'text-amber-400' : 'text-charcoal-200'}>★</span>
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">{timeAgo(fb.created_at)}</span>
                      </div>
                      {fb.comments && <p className="text-sm text-muted-foreground">{fb.comments}</p>}
                      {fb.request_reopen && (
                        <p className="text-xs text-amber-600 mt-1">Reopen requested: {fb.reopen_reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Report Details</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <StatusBadge status={report.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Priority</span>
                <PriorityBadge level={report.priority_level} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Severity</span>
                <span className="text-sm text-muted-foreground capitalize">{report.severity || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Category</span>
                <span className="text-sm text-muted-foreground">{report.category?.name || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Affected People</span>
                <span className="text-sm text-muted-foreground">{report.affected_people}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Submitted</span>
                <span className="text-sm text-muted-foreground">{formatDateTime(report.created_at)}</span>
              </div>
              {report.resolved_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Resolved</span>
                  <span className="text-sm text-muted-foreground">{formatDateTime(report.resolved_at)}</span>
                </div>
              )}
            </CardBody>
          </Card>

          {report.location && (
            <Card>
              <CardHeader><CardTitle>Location</CardTitle></CardHeader>
              <CardBody className="space-y-2">
                {report.location.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span className="text-sm text-muted-foreground">{report.location.address}</span>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <span className="text-sm text-muted-foreground font-mono">
                    {report.location.latitude.toFixed(4)}, {report.location.longitude.toFixed(4)}
                  </span>
                </div>
                {report.location.city && <p className="text-sm text-muted-foreground">{report.location.city}</p>}
              </CardBody>
            </Card>
          )}

          {canGiveFeedback && (
            <Link to={`/app/feedback/${report.id}`} className="btn-primary w-full">
              <MessageSquare className="w-4 h-4" /> Give Feedback
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
