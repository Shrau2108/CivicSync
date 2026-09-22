import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Star, MessageSquare, RotateCcw, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { fetchReportById, createFeedback, updateReportStatus, createAuditLog } from '@/services/api';
import { cn } from '@/lib/utils';
import type { Report } from '@/types';

export function FeedbackPage() {
  const { reportId } = useParams();
  const { user } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comments, setComments] = useState('');
  const [requestReopen, setRequestReopen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    if (!reportId) return;
    setLoading(true);
    try {
      const r = await fetchReportById(reportId);
      setReport(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !report || rating === 0) return;
    setSubmitting(true);
    try {
      await createFeedback({
        report_id: report.id,
        citizen_id: user.id,
        rating,
        comments: comments || undefined,
        request_reopen: requestReopen,
        reopen_reason: requestReopen ? reopenReason : undefined,
      });
      if (requestReopen) {
        await updateReportStatus(report.id, 'reopened');
        await createAuditLog({ action: 'request_reopen', entity_type: 'report', entity_id: report.id });
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState message="Loading report..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!report) return <ErrorState message="Report not found" />;

  if (submitted) {
    return (
      <div>
        <PageHeader title="Feedback Submitted" />
        <Card>
          <CardBody className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-primary-600" />
            </div>
            <h2 className="text-lg font-semibold text-charcoal-800 mb-2">Thank You!</h2>
            <p className="text-sm text-charcoal-500 mb-6">
              Your feedback has been recorded{requestReopen ? ' and the report has been reopened for further review' : ''}.
            </p>
            <Link to="/app/citizen/reports" className="btn-primary">Back to My Reports</Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Link to={`/app/reports/${report.id}`} className="btn-ghost text-sm mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Report
      </Link>

      <PageHeader title="Feedback & Rating" description={`Rate the resolution of: ${report.title}`} />

      <Card className="max-w-2xl">
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="label">Rating <span className="text-red-500">*</span></label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1"
                  >
                    <Star
                      className={cn(
                        'w-8 h-8 transition-colors',
                        (hoverRating || rating) >= star
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-charcoal-300'
                      )}
                    />
                  </button>
                ))}
                <span className="text-sm text-charcoal-500 ml-2">
                  {rating > 0 ? `${rating} star${rating > 1 ? 's' : ''}` : 'Click to rate'}
                </span>
              </div>
            </div>

            <div>
              <label className="label">Comments <span className="text-charcoal-400 font-normal">(optional)</span></label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="input min-h-[100px] resize-y"
                placeholder="Share your experience with the resolution..."
                maxLength={500}
              />
            </div>

            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requestReopen}
                  onChange={(e) => setRequestReopen(e.target.checked)}
                  className="w-4 h-4 rounded border-charcoal-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-amber-800 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4" />
                  Request issue reopening
                </span>
              </label>
              {requestReopen && (
                <div className="mt-3">
                  <label className="label text-amber-800">Reason for reopening</label>
                  <textarea
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    className="input min-h-[60px] resize-y"
                    placeholder="Explain why this issue needs to be reopened..."
                  />
                </div>
              )}
            </div>

            <button type="submit" disabled={rating === 0 || submitting} className="btn-primary w-full">
              <MessageSquare className="w-4 h-4" /> {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
