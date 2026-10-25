import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Copy,
  AlertTriangle,
  ExternalLink,
  MapPin,
  Calendar,
  Tag,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  ImageIcon,
  Eye,
  Info,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/AppLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { fetchDuplicateCandidates, fetchReports, createDuplicateCandidate } from '@/services/api';
import { detectDuplicatesAsync, serializeDetectionReasons } from '@/lib/duplicateDetection';
import { haversineDistance } from '@/lib/dijkstra';
import { formatDate } from '@/lib/utils';
import type { DuplicateCandidate } from '@/types';

interface ParsedCandidateMetadata {
  explanation: string;
  distanceKm: number | null;
  categoryMatch: boolean;
  textScore: number | null;
  vision: {
    isExactFileMatch?: boolean;
    sha256A?: string | null;
    sha256B?: string | null;
    dHashDistance?: number;
    embeddingSimilarity?: number | null;
    classification?: string;
    modelError?: string | null;
  } | null;
}

function parseCandidateReasons(raw: string | null): ParsedCandidateMetadata {
  if (!raw) {
    return {
      explanation: 'Flagged by similarity detection algorithm based on shared attributes.',
      distanceKm: null,
      categoryMatch: false,
      textScore: null,
      vision: null,
    };
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        explanation: parsed.explanation || 'Flagged as potential duplicate based on multi-signal analysis.',
        distanceKm: typeof parsed.distanceKm === 'number' ? parsed.distanceKm : null,
        categoryMatch: Boolean(parsed.categoryMatch),
        textScore: typeof parsed.textScore === 'number' ? parsed.textScore : null,
        vision: parsed.vision || null,
      };
    }
  } catch {
    // raw was a plain text string
  }

  return {
    explanation: raw,
    distanceKm: null,
    categoryMatch: false,
    textScore: null,
    vision: null,
  };
}

function formatDistance(distKm: number | null): string {
  if (distKm === null || isNaN(distKm)) return 'Location distance unavailable';
  if (distKm < 0.001) return 'Same coordinates (< 1 m)';
  if (distKm < 1) return `${Math.round(distKm * 1000)} meters apart`;
  return `${distKm.toFixed(2)} km apart`;
}

function classificationLabel(classification?: string): string {
  switch (classification) {
    case 'identical_file': return 'Exact Match';
    case 'near_identical': return 'Near-Identical';
    case 'visually_similar': return 'Visually Similar';
    case 'uncertain': return 'Ambiguous Visual Overlap';
    case 'likely_different': return 'Visually Distinct';
    default: return classification ? classification.replace(/_/g, ' ') : 'Visual Analysis Available';
  }
}

export function DuplicateReviewPage() {
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      let list = await fetchDuplicateCandidates();

      // If manual refresh or list is empty, scan active reports to ensure any unrecorded candidate pairs are detected
      if (isManualRefresh) {
        try {
          const allReports = await fetchReports();
          const activeReports = allReports.filter(
            (r) => !['resolved', 'cancelled', 'rejected', 'duplicate'].includes(r.status)
          );

          // For any active report, check if another active report is a duplicate
          for (let i = 0; i < activeReports.length; i++) {
            const reportA = activeReports[i];
            const otherReports = activeReports.slice(i + 1);
            if (otherReports.length === 0) continue;

            const detected = await detectDuplicatesAsync(
              {
                id: reportA.id,
                title: reportA.title,
                description: reportA.description,
                category_id: reportA.category_id,
                latitude: reportA.location?.latitude,
                longitude: reportA.location?.longitude,
                mediaUrl: reportA.media?.[0]?.file_url,
              },
              otherReports
            );

            for (const d of detected) {
              const serialized = serializeDetectionReasons(d);
              try {
                await createDuplicateCandidate({
                  report_id: reportA.id,
                  candidate_report_id: d.candidateReportId,
                  similarity_type: d.similarityType,
                  similarity_score: d.similarityScore,
                  similarity_reasons: serialized,
                });
              } catch {
                // Ignore duplicate insertion or permission issues during scan
              }
            }
          }

          list = await fetchDuplicateCandidates();
        } catch (scanErr) {
          console.warn('CivicSync: Background duplicate scan notice:', scanErr);
        }
      }

      setCandidates(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load duplicate candidates.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState message="Loading duplicate review candidates..." />;
  if (error) return <ErrorState message={error} onRetry={() => load(false)} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Duplicate Review"
          description="Review suspected duplicate reports detected automatically via computer vision, location, and description analysis"
        />
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border border-border bg-card hover:bg-muted text-foreground transition-all duration-200 shadow-sm disabled:opacity-50"
            title="Scan active reports and refresh candidates"
          >
            <RefreshCw className={`w-4 h-4 text-primary ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Scanning...' : 'Refresh List'}
          </button>
        </div>
      </div>

      {/* Operational Informational Banner */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-foreground flex items-center gap-2">
              Automated Multi-Signal Duplicate Detection
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                Read-Only Review
              </span>
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              CivicSync automatically evaluates new reports upon citizen submission against existing active issues using a multi-signal pipeline:
              MobileNet v2 visual feature embeddings, 64-bit perceptual difference hashes (dHash), exact SHA-256 binary verification,
              geographic distance (Haversine proximity), and category compatibility.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium pt-1">
              • Read-only advisory display: Suspected reports are highlighted for situational awareness and are never automatically merged, suppressed, or deleted.
            </p>
          </div>
        </div>
      </div>

      {/* Candidates List or Empty State */}
      {candidates.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<ShieldCheck className="w-10 h-10 text-emerald-500" />}
              title="No Duplicate Reports Detected"
              description="All submitted reports currently have distinct locations, descriptions, or visual characteristics. When new reports with matching locations, descriptions, or evidence photos are submitted, they will appear here automatically."
            />
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={() => load(true)}
                disabled={refreshing}
                className="btn-secondary text-sm inline-flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Scan Active Reports Now
              </button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              Showing <strong className="text-foreground">{candidates.length}</strong> suspected duplicate candidate pair{candidates.length === 1 ? '' : 's'}
            </span>
            <span>Sorted by similarity confidence</span>
          </div>

          {candidates.map((candidate) => {
            const parsed = parseCandidateReasons(candidate.similarity_reasons);
            const reportA = candidate.report;
            const reportB = candidate.candidateReport;

            // Compute distance dynamically if not present in serialized reasons
            let computedDistanceKm = parsed.distanceKm;
            if (
              computedDistanceKm === null &&
              reportA?.location?.latitude != null &&
              reportA?.location?.longitude != null &&
              reportB?.location?.latitude != null &&
              reportB?.location?.longitude != null
            ) {
              computedDistanceKm = haversineDistance(
                reportA.location.latitude,
                reportA.location.longitude,
                reportB.location.latitude,
                reportB.location.longitude
              );
            }

            const mediaA = reportA?.media?.[0];
            const mediaB = reportB?.media?.[0];
            const hasImages = Boolean(mediaA?.file_url || mediaB?.file_url);

            return (
              <Card key={candidate.id} className="border-border hover:border-border/80 transition-shadow shadow-sm overflow-hidden">
                {/* Card Header Bar */}
                <div className="bg-muted/40 border-b border-border px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Primary Highlight Label Required */}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-xs">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      Possible Duplicate Detected
                    </span>

                    {/* Overall Similarity Score */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                      {candidate.similarity_score.toFixed(0)}% Overall Match
                    </span>

                    {/* Detection Type Badge */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs text-muted-foreground bg-background border border-border capitalize">
                      Signal: {candidate.similarity_type.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Detected: {formatDate(candidate.created_at)}
                  </div>
                </div>

                <CardBody className="p-5 space-y-5">
                  {/* Short Explanation Box Required */}
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-foreground text-sm flex items-start gap-3">
                    <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-0.5">
                        Detection Rationale
                      </p>
                      <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                        {parsed.explanation}
                      </p>
                    </div>
                  </div>

                  {/* Side-by-Side Comparison Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Report A (Original / Existing Report) */}
                    <div className="rounded-xl border border-border bg-card p-4 space-y-3.5 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Original Report
                          </span>
                          {reportA?.report_id && (
                            <Link
                              to={`/app/reports/${candidate.report_id}`}
                              className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-primary hover:underline"
                            >
                              {reportA.report_id}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </div>

                        <div>
                          <h4 className="font-semibold text-foreground text-sm sm:text-base leading-snug">
                            {reportA?.title || 'Report Title Unavailable'}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-3 leading-relaxed">
                            {reportA?.description || 'No description provided.'}
                          </p>
                        </div>

                        {/* Metadata Pills */}
                        <div className="space-y-1.5 text-xs text-muted-foreground pt-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-foreground font-medium text-[11px]">
                              <Tag className="w-3 h-3 text-muted-foreground" />
                              {reportA?.category?.name || 'Uncategorized'}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px]">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              {reportA?.created_at ? formatDate(reportA.created_at) : 'Date unavailable'}
                            </span>
                          </div>

                          <div className="flex items-start gap-1.5 pt-1 text-[11px]">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-2">
                              {reportA?.location?.address ||
                               (reportA?.location?.latitude != null ? `${reportA.location.latitude.toFixed(4)}, ${reportA.location.longitude.toFixed(4)}` : 'Location not recorded')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Evidence Image Preview */}
                      <div className="pt-2 border-t border-border/60">
                        <p className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center justify-between">
                          <span>Evidence Image</span>
                          {mediaA?.file_name && <span className="font-mono text-[10px] truncate max-w-[150px]">{mediaA.file_name}</span>}
                        </p>
                        {mediaA?.file_url ? (
                          <div className="relative group rounded-lg overflow-hidden border border-border bg-muted aspect-video flex items-center justify-center">
                            <img
                              src={mediaA.file_url}
                              alt={reportA?.title || 'Report photo'}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            <a
                              href={mediaA.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 text-xs font-semibold text-white transition-opacity"
                            >
                              <Eye className="w-4 h-4" /> View Full Image
                            </a>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground bg-muted/20">
                            <ImageIcon className="w-6 h-6 mx-auto mb-1 text-muted-foreground/60" />
                            No photo attached to this report
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Report B (Suspected Duplicate Report) */}
                    <div className="rounded-xl border border-border bg-card p-4 space-y-3.5 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Suspected Duplicate
                          </span>
                          {reportB?.report_id && (
                            <Link
                              to={`/app/reports/${candidate.candidate_report_id}`}
                              className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-primary hover:underline"
                            >
                              {reportB.report_id}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </div>

                        <div>
                          <h4 className="font-semibold text-foreground text-sm sm:text-base leading-snug">
                            {reportB?.title || 'Report Title Unavailable'}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-3 leading-relaxed">
                            {reportB?.description || 'No description provided.'}
                          </p>
                        </div>

                        {/* Metadata Pills */}
                        <div className="space-y-1.5 text-xs text-muted-foreground pt-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-foreground font-medium text-[11px]">
                              <Tag className="w-3 h-3 text-muted-foreground" />
                              {reportB?.category?.name || 'Uncategorized'}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px]">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              {reportB?.created_at ? formatDate(reportB.created_at) : 'Date unavailable'}
                            </span>
                          </div>

                          <div className="flex items-start gap-1.5 pt-1 text-[11px]">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-2">
                              {reportB?.location?.address ||
                               (reportB?.location?.latitude != null ? `${reportB.location.latitude.toFixed(4)}, ${reportB.location.longitude.toFixed(4)}` : 'Location not recorded')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Evidence Image Preview */}
                      <div className="pt-2 border-t border-border/60">
                        <p className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center justify-between">
                          <span>Evidence Image</span>
                          {mediaB?.file_name && <span className="font-mono text-[10px] truncate max-w-[150px]">{mediaB.file_name}</span>}
                        </p>
                        {mediaB?.file_url ? (
                          <div className="relative group rounded-lg overflow-hidden border border-border bg-muted aspect-video flex items-center justify-center">
                            <img
                              src={mediaB.file_url}
                              alt={reportB?.title || 'Report photo'}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            <a
                              href={mediaB.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 text-xs font-semibold text-white transition-opacity"
                            >
                              <Eye className="w-4 h-4" /> View Full Image
                            </a>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground bg-muted/20">
                            <ImageIcon className="w-6 h-6 mx-auto mb-1 text-muted-foreground/60" />
                            No photo attached to this report
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Multi-Signal Metrics & Comparison Breakdown */}
                  <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-3.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Similarity Metrics & Comparison Signals
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      {/* Signal 1: Geographic Distance */}
                      <div className="p-3 rounded-lg bg-background border border-border">
                        <span className="text-muted-foreground block text-[11px] mb-1">Geographic Distance</span>
                        <p className="font-semibold text-foreground flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          {formatDistance(computedDistanceKm)}
                        </p>
                      </div>

                      {/* Signal 2: Category Compatibility */}
                      <div className="p-3 rounded-lg bg-background border border-border">
                        <span className="text-muted-foreground block text-[11px] mb-1">Category Compatibility</span>
                        <p className="font-semibold text-foreground flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          {reportA?.category_id === reportB?.category_id && reportA?.category_id
                            ? `Matching (${reportA?.category?.name || 'Same Category'})`
                            : 'Different Categories'}
                        </p>
                      </div>

                      {/* Signal 3: Description Similarity */}
                      <div className="p-3 rounded-lg bg-background border border-border">
                        <span className="text-muted-foreground block text-[11px] mb-1">Description Word Overlap</span>
                        <p className="font-semibold text-foreground">
                          {parsed.textScore != null ? `${parsed.textScore}% Jaccard similarity` : 'Text comparison evaluated'}
                        </p>
                      </div>

                      {/* Signal 4: Overall Confidence */}
                      <div className="p-3 rounded-lg bg-background border border-border">
                        <span className="text-muted-foreground block text-[11px] mb-1">Confidence Score</span>
                        <p className="font-semibold text-foreground">
                          {candidate.similarity_score.toFixed(0)}% algorithmic match
                        </p>
                      </div>
                    </div>

                    {/* Dedicated Vision Metrics Section (When Available or Images Present) */}
                    {hasImages && (
                      <div className="mt-3 pt-3 border-t border-border/60">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-2.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>Computer Vision Similarity Metrics</span>
                          {parsed.vision?.classification && (
                            <span className="ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                              {classificationLabel(parsed.vision.classification)}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                          {/* Exact Binary Hash */}
                          <div className="p-2.5 rounded-lg bg-background/80 border border-border">
                            <span className="text-[11px] text-muted-foreground block">Exact Binary Hash (SHA-256)</span>
                            <span className="font-semibold text-foreground mt-0.5 block">
                              {parsed.vision?.isExactFileMatch
                                ? 'Identical File Match (100%)'
                                : (mediaA?.file_hash && mediaB?.file_hash && mediaA.file_hash === mediaB.file_hash)
                                  ? 'Identical SHA-256 Match'
                                  : 'Distinct File Hashes'}
                            </span>
                          </div>

                          {/* Perceptual dHash Distance */}
                          <div className="p-2.5 rounded-lg bg-background/80 border border-border">
                            <span className="text-[11px] text-muted-foreground block">Perceptual Hash (dHash)</span>
                            <span className="font-semibold text-foreground mt-0.5 block">
                              {parsed.vision?.dHashDistance != null
                                ? `Hamming Distance: ${parsed.vision.dHashDistance}/64 bits`
                                : 'Visual layout analyzed'}
                            </span>
                          </div>

                          {/* MobileNet Semantic Embedding Cosine Similarity */}
                          <div className="p-2.5 rounded-lg bg-background/80 border border-border">
                            <span className="text-[11px] text-muted-foreground block">MobileNet v2 Visual Alignment</span>
                            <span className="font-semibold text-foreground mt-0.5 block">
                              {parsed.vision?.embeddingSimilarity != null
                                ? `${Math.round(parsed.vision.embeddingSimilarity * 100)}% cosine similarity`
                                : parsed.vision?.modelError
                                  ? 'Fallback dHash used (model offline)'
                                  : 'Visual features compared'}
                            </span>
                          </div>
                        </div>

                        {parsed.vision?.modelError && (
                          <p className="text-[11px] text-muted-foreground mt-2 italic">
                            * Note: {parsed.vision.modelError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Read-Only Review Policy Notice */}
                  <div className="text-[11px] text-muted-foreground bg-background/60 rounded-lg p-2.5 border border-border/60 text-center">
                    Read-only advisory review. Both reports remain active in the system without automatic merging, suppression, or status modification.
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
