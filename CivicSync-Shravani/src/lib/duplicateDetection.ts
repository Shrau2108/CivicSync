import type { Report, DuplicateCandidate, SimilarityType } from '@/types';
import { haversineDistance } from './dijkstra';

export interface DuplicateDetectionResult {
  candidateReportId: string;
  similarityType: SimilarityType;
  similarityScore: number;
  reasons: string[];
}

function textSimilarity(a: string, b: string): number {
  const wordsA = a.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const wordsB = b.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
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

export function detectDuplicates(
  newReport: { title: string; description: string; category_id: string | null; latitude?: number; longitude?: number },
  existingReports: Report[]
): DuplicateDetectionResult[] {
  const results: DuplicateDetectionResult[] = [];
  const GEOGRAPHIC_THRESHOLD_KM = 1.0;
  const TEXT_THRESHOLD = 30;

  for (const existing of existingReports) {
    if (existing.status === 'resolved' || existing.status === 'cancelled' || existing.status === 'rejected') continue;

    const reasons: string[] = [];
    let maxScore = 0;
    let bestType: SimilarityType = 'text';

    const titleSim = textSimilarity(newReport.title, existing.title);
    const descSim = textSimilarity(newReport.description, existing.description);
    const textScore = (titleSim * 0.6 + descSim * 0.4);

    if (textScore >= TEXT_THRESHOLD) {
      reasons.push(`Similar title (${titleSim.toFixed(0)}% word overlap)`);
      if (descSim > 30) reasons.push(`Similar description (${descSim.toFixed(0)}% word overlap)`);
      if (textScore > maxScore) {
        maxScore = textScore;
        bestType = 'text';
      }
    }

    if (newReport.category_id && existing.category_id && newReport.category_id === existing.category_id) {
      reasons.push('Same category');
      if (50 > maxScore) {
        maxScore = 50;
        bestType = 'category';
      }
    }

    if (newReport.latitude && newReport.longitude && existing.location) {
      const dist = haversineDistance(
        newReport.latitude,
        newReport.longitude,
        existing.location.latitude,
        existing.location.longitude
      );
      if (dist < GEOGRAPHIC_THRESHOLD_KM) {
        const geoScore = Math.max(0, 100 - (dist / GEOGRAPHIC_THRESHOLD_KM) * 50);
        reasons.push(`Geographic proximity (${dist.toFixed(2)} km apart)`);
        if (geoScore > maxScore) {
          maxScore = geoScore;
          bestType = 'geographic';
        }
      }
    }

    if (maxScore >= 30) {
      results.push({
        candidateReportId: existing.id,
        similarityType: bestType,
        similarityScore: Math.round(maxScore),
        reasons,
      });
    }
  }

  results.sort((a, b) => b.similarityScore - a.similarityScore);
  return results;
}

export function computeFileHash(file: File): Promise<string> {
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
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}
