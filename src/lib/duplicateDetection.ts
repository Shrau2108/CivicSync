import type { Report, SimilarityType, DuplicateCandidate } from '../types';
import { haversineDistance } from './dijkstra';
import { compareImages, type ImageComparisonResult } from './visionSimilarity';
import { fetchReports, fetchReportById, createDuplicateCandidate } from '../services/api';

export interface DuplicateDetectionResult {
  candidateReportId: string;
  similarityType: SimilarityType;
  similarityScore: number;
  reasons: string[];
  explanation: string;
  distanceKm: number | null;
  categoryMatch: boolean;
  textScore: number;
  visionResult: ImageComparisonResult | null;
}

/**
 * Computes exact SHA-256 hash of a File or Blob using the Web Crypto API.
 */
export function computeFileHash(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        resolve(hashHex);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file for hash computation'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Computes token-level Jaccard word similarity between two text strings.
 * Filters out short stopwords/punctuation and returns a score from 0 to 100.
 */
export function textSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const cleanA = a.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const cleanB = b.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

  const wordsA = cleanA.split(/\s+/).filter((w) => w.length > 2);
  const wordsB = cleanB.split(/\s+/).filter((w) => w.length > 2);
  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? (intersection / union) * 100 : 0;
}

/**
 * Serializes multi-signal duplicate reasons and vision metrics into a structured string.
 * This ensures full metrics are persisted without modifying the database schema.
 */
export function serializeDetectionReasons(result: DuplicateDetectionResult): string {
  const payload = {
    explanation: result.explanation,
    distanceKm: result.distanceKm,
    categoryMatch: result.categoryMatch,
    textScore: result.textScore,
    vision: result.visionResult
      ? {
          isExactFileMatch: result.visionResult.isExactFileMatch,
          sha256A: result.visionResult.sha256A,
          sha256B: result.visionResult.sha256B,
          dHashDistance: result.visionResult.dHashDistance,
          embeddingSimilarity: result.visionResult.embeddingSimilarity,
          classification: result.visionResult.classification,
          modelError: result.visionResult.modelError,
        }
      : null,
  };
  return JSON.stringify(payload);
}

/**
 * Asynchronously performs automatic multi-signal duplicate detection for a newly submitted report.
 * Evaluates:
 * 1. Geographic distance from coordinates
 * 2. Category compatibility
 * 3. Title & description text similarity
 * 4. Evidence image comparison via visionSimilarity (SHA-256, dHash, MobileNet embeddings)
 *
 * Filters coarse candidates first to avoid unnecessary vision model inference across all reports.
 */
export async function detectDuplicatesAsync(
  newReport: {
    id?: string;
    title: string;
    description: string;
    category_id: string | null;
    latitude?: number | null;
    longitude?: number | null;
    mediaUrl?: string | null;
    file?: File | Blob | null;
  },
  existingReports: Report[]
): Promise<DuplicateDetectionResult[]> {
  const results: DuplicateDetectionResult[] = [];

  // 1. Initial Candidate Filtering
  // Only compare against active/open reports
  const activeExisting = existingReports.filter(
    (existing) =>
      existing.id !== newReport.id &&
      !['resolved', 'cancelled', 'rejected', 'duplicate'].includes(existing.status)
  );

  if (activeExisting.length === 0) return [];

  // 2. Coarse Candidate Scoring & Pruning
  // Prune candidates before running expensive neural inference
  interface CoarseCandidate {
    report: Report;
    distKm: number | null;
    sameCategory: boolean;
    textScore: number;
    coarseScore: number;
  }

  const coarseCandidates: CoarseCandidate[] = [];

  for (const existing of activeExisting) {
    let distKm: number | null = null;
    if (
      newReport.latitude != null &&
      newReport.longitude != null &&
      existing.location?.latitude != null &&
      existing.location?.longitude != null
    ) {
      distKm = haversineDistance(
        newReport.latitude,
        newReport.longitude,
        existing.location.latitude,
        existing.location.longitude
      );
    }

    const sameCategory = Boolean(
      newReport.category_id &&
      existing.category_id &&
      newReport.category_id === existing.category_id
    );

    const titleSim = textSimilarity(newReport.title, existing.title);
    const descSim = textSimilarity(newReport.description, existing.description);
    const textScore = titleSim * 0.6 + descSim * 0.4;

    // Check preliminary eligibility
    const isNearby = distKm !== null && distKm <= 3.0; // Within 3 km
    const isCategoryNearby = sameCategory && (distKm === null || distKm <= 5.0);
    const hasTextMatch = textScore >= 25;
    const hasMediaPotential = Boolean(
      (newReport.file || newReport.mediaUrl) && existing.media && existing.media.length > 0
    );

    // Skip entirely unrelated reports (e.g. 50 km away, different category, zero text match)
    if (!isNearby && !isCategoryNearby && !hasTextMatch && !hasMediaPotential) {
      continue;
    }

    let coarseScore = textScore;
    if (sameCategory) coarseScore += 25;
    if (distKm !== null) {
      if (distKm <= 0.1) coarseScore += 45;
      else if (distKm <= 0.5) coarseScore += 35;
      else if (distKm <= 1.5) coarseScore += 20;
    }

    coarseCandidates.push({
      report: existing,
      distKm,
      sameCategory,
      textScore: Math.round(textScore),
      coarseScore,
    });
  }

  // Sort by coarse score descending and limit to top 5 candidates to protect browser performance
  coarseCandidates.sort((a, b) => b.coarseScore - a.coarseScore);
  const prioritizedCandidates = coarseCandidates.slice(0, 5);

  // 3. Detailed Multi-Signal Comparison on Filtered Candidates
  const newImageSource: File | Blob | string | null =
    newReport.file || newReport.mediaUrl || null;

  for (const candidate of prioritizedCandidates) {
    const existing = candidate.report;
    const distKm = candidate.distKm;
    const sameCategory = candidate.sameCategory;
    const textScore = candidate.textScore;
    const reasons: string[] = [];

    let visionResult: ImageComparisonResult | null = null;
    const existingMediaUrl = existing.media?.[0]?.file_url || null;

    if (newImageSource && existingMediaUrl) {
      try {
        visionResult = await compareImages(newImageSource, existingMediaUrl);
      } catch (visionErr) {
        console.warn('CivicSync: Vision similarity comparison failed for candidate:', existing.report_id, visionErr);
        visionResult = null;
      }
    }

    // 4. Multi-Signal Synthesis
    let isSuspectedDuplicate = false;
    let similarityScore = 0;
    let similarityType: SimilarityType = 'text';
    let primaryExplanation = '';

    const formatDist = (d: number) => (d < 1 ? `${Math.round(d * 1000)} meters` : `${d.toFixed(2)} km`);

    // Signal A: Exact File Hash Match
    if (visionResult?.isExactFileMatch) {
      isSuspectedDuplicate = true;
      similarityScore = 100;
      similarityType = 'file_hash';
      primaryExplanation = 'Identical evidence image uploaded (exact binary SHA-256 match).';
      reasons.push('Exact binary match (identical SHA-256 image hash)');
    }
    // Signal B: Perceptual dHash Near-Identical (Hamming distance <= 5 of 64)
    else if (visionResult && visionResult.dHashDistance >= 0 && visionResult.dHashDistance <= 5) {
      isSuspectedDuplicate = true;
      similarityScore = Math.max(90, Math.round(100 - visionResult.dHashDistance * 2));
      similarityType = 'file_hash';
      primaryExplanation = `Near-identical photograph detected (perceptual difference hash distance ${visionResult.dHashDistance}/64). Likely the same image re-encoded, cropped, or resized.`;
      reasons.push(`Perceptual dHash near-identical (${visionResult.dHashDistance}/64 difference)`);
      if (distKm !== null) reasons.push(`Located ${formatDist(distKm)} apart`);
      if (sameCategory) reasons.push('Matching issue category');
    }
    // Signal C: High MobileNet Feature Embedding Similarity (>= 0.82) with geographic compatibility
    else if (
      visionResult?.embeddingSimilarity != null &&
      visionResult.embeddingSimilarity >= 0.82 &&
      (distKm === null || distKm <= 2.0)
    ) {
      isSuspectedDuplicate = true;
      const simPercent = Math.round(visionResult.embeddingSimilarity * 100);
      similarityScore = Math.round(
        visionResult.embeddingSimilarity * 70 +
        (distKm !== null ? Math.max(0, 1 - distKm / 2.0) * 30 : 20)
      );
      similarityType = 'file_hash';
      primaryExplanation = `High visual feature similarity (${simPercent}% via MobileNet v2) ${distKm !== null ? `within ${formatDist(distKm)}` : 'in report vicinity'}${sameCategory ? ' for the same category' : ''}.`;
      reasons.push(`High visual feature alignment (${simPercent}%)`);
      if (distKm !== null) reasons.push(`Geographic proximity (${formatDist(distKm)})`);
      if (sameCategory) reasons.push('Matching category');
      if (textScore > 20) reasons.push(`Text description overlap (${textScore}%)`);
    }
    // Signal D: Moderate visual similarity (>= 0.70) + close proximity (<= 800m) + category match
    else if (
      visionResult?.embeddingSimilarity != null &&
      visionResult.embeddingSimilarity >= 0.70 &&
      distKm !== null &&
      distKm <= 0.8 &&
      sameCategory
    ) {
      isSuspectedDuplicate = true;
      const simPercent = Math.round(visionResult.embeddingSimilarity * 100);
      similarityScore = Math.round(
        visionResult.embeddingSimilarity * 50 +
        Math.max(0, 1 - distKm / 0.8) * 30 +
        20
      );
      similarityType = 'file_hash';
      primaryExplanation = `Moderate visual similarity (${simPercent}%) with close proximity (${formatDist(distKm)}) in the same category.`;
      reasons.push(`Visual feature alignment (${simPercent}%)`);
      reasons.push(`Close proximity (${formatDist(distKm)})`);
      reasons.push('Matching category');
      if (textScore > 20) reasons.push(`Text description overlap (${textScore}%)`);
    }
    // Signal E: Immediate Geographic Proximity (<= 50 meters) + same category
    else if (distKm !== null && distKm <= 0.05 && sameCategory) {
      isSuspectedDuplicate = true;
      similarityScore = Math.round(Math.max(70, 95 - distKm * 500));
      similarityType = 'geographic';
      primaryExplanation = `Immediate physical proximity (${formatDist(distKm)}) reported for the same category.`;
      reasons.push(`Immediate physical proximity (${formatDist(distKm)})`);
      reasons.push('Same issue category');
      if (textScore > 20) reasons.push(`Text description overlap (${textScore}%)`);
    }
    // Signal F: Close proximity (<= 600m) + same category + moderate text similarity (>= 35%)
    else if (distKm !== null && distKm <= 0.6 && sameCategory && textScore >= 35) {
      isSuspectedDuplicate = true;
      similarityScore = Math.round(textScore * 0.5 + Math.max(0, 1 - distKm / 0.6) * 40 + 10);
      similarityType = distKm <= 0.2 ? 'geographic' : 'text';
      primaryExplanation = `Close proximity (${formatDist(distKm)}), matching category, and similar issue descriptions (${textScore}% overlap).`;
      reasons.push(`Close proximity (${formatDist(distKm)})`);
      reasons.push('Matching category');
      reasons.push(`Similar description (${textScore}% word match)`);
    }
    // Signal G: Substantial text overlap (>= 60%) + same category
    else if (sameCategory && textScore >= 60) {
      isSuspectedDuplicate = true;
      similarityScore = Math.round(textScore);
      similarityType = 'text';
      primaryExplanation = `Substantial description and title overlap (${textScore}% word match) in the same category.`;
      reasons.push(`Substantial description overlap (${textScore}%)`);
      reasons.push('Matching category');
      if (distKm !== null) reasons.push(`Located ${formatDist(distKm)} apart`);
    }

    if (isSuspectedDuplicate) {
      results.push({
        candidateReportId: existing.id,
        similarityType,
        similarityScore: Math.min(100, Math.max(1, similarityScore)),
        reasons,
        explanation: primaryExplanation,
        distanceKm: distKm !== null ? Number(distKm.toFixed(3)) : null,
        categoryMatch: sameCategory,
        textScore,
        visionResult,
      });
    }
  }

  results.sort((a, b) => b.similarityScore - a.similarityScore);
  return results;
}

/**
 * Synchronous backward-compatible duplicate detection helper.
 * Maintains backwards compatibility with existing callers.
 */
export function detectDuplicates(
  newReport: { title: string; description: string; category_id: string | null; latitude?: number; longitude?: number },
  existingReports: Report[]
): DuplicateDetectionResult[] {
  const results: DuplicateDetectionResult[] = [];
  const GEOGRAPHIC_THRESHOLD_KM = 1.0;
  const TEXT_THRESHOLD = 35;

  for (const existing of existingReports) {
    if (existing.status === 'resolved' || existing.status === 'cancelled' || existing.status === 'rejected') continue;

    const reasons: string[] = [];
    let maxScore = 0;
    let bestType: SimilarityType = 'text';

    const titleSim = textSimilarity(newReport.title, existing.title);
    const descSim = textSimilarity(newReport.description, existing.description);
    const textScore = titleSim * 0.6 + descSim * 0.4;
    const sameCategory = Boolean(
      newReport.category_id && existing.category_id && newReport.category_id === existing.category_id
    );

    let distKm: number | null = null;
    if (
      newReport.latitude != null &&
      newReport.longitude != null &&
      existing.location?.latitude != null &&
      existing.location?.longitude != null
    ) {
      distKm = haversineDistance(
        newReport.latitude,
        newReport.longitude,
        existing.location.latitude,
        existing.location.longitude
      );
    }

    if (textScore >= TEXT_THRESHOLD && sameCategory) {
      reasons.push(`Similar title/description (${textScore.toFixed(0)}% word match)`);
      reasons.push('Same category');
      maxScore = textScore;
      bestType = 'text';
    }

    if (distKm !== null && distKm < GEOGRAPHIC_THRESHOLD_KM && sameCategory) {
      const geoScore = Math.max(0, 100 - (distKm / GEOGRAPHIC_THRESHOLD_KM) * 50);
      reasons.push(`Geographic proximity (${distKm < 1 ? Math.round(distKm * 1000) + 'm' : distKm.toFixed(2) + 'km'} apart)`);
      if (geoScore > maxScore) {
        maxScore = geoScore;
        bestType = 'geographic';
      }
    }

    if (maxScore >= 45) {
      results.push({
        candidateReportId: existing.id,
        similarityType: bestType,
        similarityScore: Math.round(maxScore),
        reasons,
        explanation: reasons.join(', '),
        distanceKm: distKm,
        categoryMatch: sameCategory,
        textScore: Math.round(textScore),
        visionResult: null,
      });
    }
  }

  results.sort((a, b) => b.similarityScore - a.similarityScore);
  return results;
}

/**
 * High-level orchestration function to run automatic duplicate detection as part of the
 * citizen report submission workflow.
 *
 * Persists detected candidates using the existing data architecture and exposes them in
 * the Supervisor Duplicate Review dashboard.
 */
export async function runAutomaticDuplicateDetection(params: {
  newReportId: string;
  newReportFiles?: File[];
}): Promise<void> {
  try {
    const [newReport, allReports] = await Promise.all([
      fetchReportById(params.newReportId),
      fetchReports(),
    ]);

    if (!newReport) {
      console.warn('CivicSync Duplicate Detection: Newly created report not found:', params.newReportId);
      return;
    }

    const fileToCompare = params.newReportFiles?.[0] || null;
    const mediaUrlToCompare = newReport.media?.[0]?.file_url || null;

    const detected = await detectDuplicatesAsync(
      {
        id: newReport.id,
        title: newReport.title,
        description: newReport.description,
        category_id: newReport.category_id,
        latitude: newReport.location?.latitude,
        longitude: newReport.location?.longitude,
        mediaUrl: mediaUrlToCompare,
        file: fileToCompare,
      },
      allReports
    );

    if (detected.length === 0) return;

    for (const result of detected) {
      const serializedReasons = serializeDetectionReasons(result);
      try {
        await createDuplicateCandidate({
          report_id: newReport.id,
          candidate_report_id: result.candidateReportId,
          similarity_type: result.similarityType,
          similarity_score: result.similarityScore,
          similarity_reasons: serializedReasons,
        });
      } catch (insertErr) {
        // In Supabase mode, citizen users might encounter RLS policies that only permit supervisors to write.
        // We log the diagnostic note gracefully without interrupting the user submission workflow.
        console.warn(
          'CivicSync: Could not persist duplicate candidate record (RLS or database constraint):',
          insertErr
        );
      }
    }
  } catch (err) {
    console.warn('CivicSync: Automatic duplicate detection encountered an unexpected notice:', err);
  }
}
