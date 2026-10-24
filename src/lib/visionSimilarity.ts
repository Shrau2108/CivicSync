/**
 * CivicSync Vision Similarity Engine
 *
 * Implements a multi-tier visual comparison pipeline for civic issue photographs:
 * 1. Exact Binary Hash (SHA-256) - Instant check for identical image files.
 * 2. Perceptual Difference Hash (dHash 64-bit) - Fast structural comparison resilient
 *    to minor compression, format re-encoding, and scaling.
 * 3. Pretrained Vision Model Feature Embeddings (MobileNet v2 via TensorFlow.js) -
 *    Extracts 1024-dimensional visual representations for semantic feature comparison.
 * 4. Cosine Similarity & Provisional Multi-Signal Classification.
 *
 * Note on Thresholds:
 * All classification thresholds are explicitly marked PROVISIONAL and must be calibrated
 * against representative civic issue datasets before automated deployment.
 */

import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';

/**
 * Provisional thresholds for visual comparison.
 * Configurable via options; labeled provisional until benchmarked.
 */
export interface SimilarityThresholds {
  /** Maximum Hamming distance (out of 64) to be considered near-identical */
  maxDHashDistanceNearIdentical: number;
  /** Minimum cosine similarity for visually similar categorization */
  minCosineVisuallySimilar: number;
  /** Minimum cosine similarity for uncertain / needs human review */
  minCosineUncertain: number;
}

export const DEFAULT_PROVISIONAL_THRESHOLDS: SimilarityThresholds = {
  maxDHashDistanceNearIdentical: 5,   // <= 5 out of 64 bits (~92% perceptual match)
  minCosineVisuallySimilar: 0.82,    // Provisional: high visual feature alignment
  minCosineUncertain: 0.68,          // Provisional: moderate alignment, requires review
};

export type VisualClassification =
  | 'identical_file'
  | 'near_identical'
  | 'visually_similar'
  | 'uncertain'
  | 'likely_different';

export interface ImageComparisonResult {
  isExactFileMatch: boolean;
  sha256A: string | null;
  sha256B: string | null;
  dHashA: string;
  dHashB: string;
  dHashDistance: number;
  embeddingSimilarity: number | null;
  classification: VisualClassification;
  confidenceScore: number; // 0 to 100
  inferenceTimeMs: number;
  modelError: string | null;
  provisionalThresholds: SimilarityThresholds;
  summaryExplanation: string;
}

// Singleton reference for lazily loaded MobileNet model
let mobileNetPromise: Promise<mobilenet.MobileNet> | null = null;

/**
 * Lazily loads and caches the MobileNet v2 feature extractor.
 * Reuses the model instance across inferences.
 */
export async function getOrLoadMobileNetModel(): Promise<mobilenet.MobileNet> {
  if (!mobileNetPromise) {
    mobileNetPromise = (async () => {
      await tf.ready();
      return await mobilenet.load({
        version: 2,
        alpha: 1.0,
      });
    })().catch((err) => {
      mobileNetPromise = null;
      throw err;
    });
  }
  return mobileNetPromise;
}

/**
 * Computes exact SHA-256 hash of a Blob / File using Web Crypto API.
 */
export async function computeSha256(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Loads an HTMLImageElement from a Blob, File, or URL and returns a cleanup handler.
 */
export function loadImageElement(source: Blob | string): Promise<{ img: HTMLImageElement; cleanup: () => void }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let objectUrl: string | null = null;

    if (typeof source === 'string') {
      img.src = source;
    } else {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    }

    const cleanup = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      img.src = '';
    };

    img.onload = () => resolve({ img, cleanup });
    img.onerror = () => {
      cleanup();
      reject(new Error('Failed to load image. File may be corrupt, unsupported, or blocked by CORS.'));
    };
  });
}

/**
 * Computes a 64-bit Perceptual Difference Hash (dHash) using an HTMLCanvasElement.
 * Resizes the image to 9 columns x 8 rows in grayscale and compares adjacent horizontal gradients.
 */
export function computeDHash(imageElement: CanvasImageSource): string {
  const canvas = document.createElement('canvas');
  canvas.width = 9;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('HTML5 Canvas 2D context not available');

  ctx.drawImage(imageElement, 0, 0, 9, 8);
  const data = ctx.getImageData(0, 0, 9, 8).data;

  // Compute grayscale luminance for each of the 9x8 pixels
  const gray: number[][] = [];
  for (let y = 0; y < 8; y++) {
    const row: number[] = [];
    for (let x = 0; x < 9; x++) {
      const idx = (y * 9 + x) * 4;
      // Standard Rec. 601 luma coefficients
      const lum = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
      row.push(lum);
    }
    gray.push(row);
  }

  // 8 rows x 8 horizontal comparisons = 64 bits
  let bits = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits += gray[y][x] < gray[y][x + 1] ? '1' : '0';
    }
  }

  // Convert binary string to 16 hex characters
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    const nibble = parseInt(bits.substring(i, i + 4), 2);
    hex += nibble.toString(16);
  }
  return hex;
}

/**
 * Computes the Hamming distance (number of differing bits) between two 16-character hex dHashes.
 * Returns a value between 0 (identical structure) and 64 (completely inverted).
 */
export function computeHammingDistance(hashA: string, hashB: string): number {
  if (hashA.length !== hashB.length) return -1;
  let distance = 0;
  for (let i = 0; i < hashA.length; i++) {
    let xor = parseInt(hashA[i], 16) ^ parseInt(hashB[i], 16);
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

/**
 * Extracts a normalized 1024-dimensional feature embedding vector using MobileNet v2.
 * Intermediate tensors are automatically disposed via tf.tidy() and tf.dispose().
 */
export async function extractImageEmbedding(
  imageSource: Blob | HTMLImageElement | string
): Promise<Float32Array> {
  const model = await getOrLoadMobileNetModel();
  let imgElement: HTMLImageElement;
  let cleanup: (() => void) | null = null;

  if (typeof imageSource === 'string' || imageSource instanceof Blob) {
    const loaded = await loadImageElement(imageSource);
    imgElement = loaded.img;
    cleanup = loaded.cleanup;
  } else {
    imgElement = imageSource;
  }

  try {
    const embeddingTensor = tf.tidy(() => {
      // mobilenet.infer(element, embedding = true) yields the 1024-dim bottleneck tensor
      const bottleneck = model.infer(imgElement, true);
      // L2 normalize the embedding vector
      const norm = tf.norm(bottleneck, 'euclidean', -1, true);
      return tf.div(bottleneck, tf.maximum(norm, 1e-12));
    });

    const data = await embeddingTensor.data();
    embeddingTensor.dispose();
    return new Float32Array(data);
  } finally {
    if (cleanup) cleanup();
  }
}

/**
 * Computes Cosine Similarity between two numeric vectors.
 * Returns a score between -1.0 and 1.0 (clamped between 0.0 and 1.0 for image embeddings).
 */
export function computeCosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  const similarity = dotProduct / denominator;
  return Math.max(0, Math.min(1, similarity));
}

/**
 * Performs a comprehensive visual similarity comparison between two images.
 * Evaluates exact SHA-256 binary hash, 64-bit dHash Hamming distance, and MobileNet visual embedding cosine similarity.
 */
export async function compareImages(
  imageA: Blob | string,
  imageB: Blob | string,
  thresholds: SimilarityThresholds = DEFAULT_PROVISIONAL_THRESHOLDS
): Promise<ImageComparisonResult> {
  const startTime = performance.now();

  // 1. Exact Binary Hash Check (if Blobs)
  let sha256A: string | null = null;
  let sha256B: string | null = null;
  let isExactFileMatch = false;

  if (imageA instanceof Blob && imageB instanceof Blob) {
    [sha256A, sha256B] = await Promise.all([computeSha256(imageA), computeSha256(imageB)]);
    isExactFileMatch = Boolean(sha256A && sha256B && sha256A === sha256B);
  }

  if (isExactFileMatch) {
    const dHash = '0000000000000000';
    return {
      isExactFileMatch: true,
      sha256A,
      sha256B,
      dHashA: dHash,
      dHashB: dHash,
      dHashDistance: 0,
      embeddingSimilarity: 1.0,
      classification: 'identical_file',
      confidenceScore: 100,
      inferenceTimeMs: Math.round(performance.now() - startTime),
      modelError: null,
      provisionalThresholds: thresholds,
      summaryExplanation: 'Files are bit-for-bit identical (SHA-256 hash match).',
    };
  }

  // 2. Load images for canvas dHash and tensor inference
  const [loadedA, loadedB] = await Promise.all([
    loadImageElement(imageA),
    loadImageElement(imageB),
  ]);

  let dHashA = '';
  let dHashB = '';
  let dHashDistance = 64;

  try {
    dHashA = computeDHash(loadedA.img);
    dHashB = computeDHash(loadedB.img);
    dHashDistance = computeHammingDistance(dHashA, dHashB);
  } catch (err) {
    console.warn('CivicSync: Failed to compute perceptual dHash', err);
  }

  // 3. MobileNet Embedding Extraction
  let embeddingSimilarity: number | null = null;
  let modelError: string | null = null;

  try {
    const [embA, embB] = await Promise.all([
      extractImageEmbedding(loadedA.img),
      extractImageEmbedding(loadedB.img),
    ]);
    embeddingSimilarity = computeCosineSimilarity(embA, embB);
  } catch (err) {
    modelError = err instanceof Error ? err.message : 'Failed to generate visual embeddings via MobileNet.';
    console.error('CivicSync Vision Model Inference Error:', err);
  } finally {
    loadedA.cleanup();
    loadedB.cleanup();
  }

  const inferenceTimeMs = Math.round(performance.now() - startTime);

  // 4. Multi-Signal Synthesis
  let classification: VisualClassification = 'likely_different';
  let confidenceScore = 0;
  let explanation = '';

  const isDHashNearIdentical = dHashDistance >= 0 && dHashDistance <= thresholds.maxDHashDistanceNearIdentical;

  if (isDHashNearIdentical) {
    classification = 'near_identical';
    confidenceScore = Math.max(90, Math.round(100 - (dHashDistance / 64) * 100));
    explanation = `Perceptual difference hash indicates near-identical visual layout (Hamming distance ${dHashDistance}/64). Likely the same image resized, cropped, or re-compressed.`;
  } else if (embeddingSimilarity !== null) {
    const simPercent = Math.round(embeddingSimilarity * 100);

    if (embeddingSimilarity >= thresholds.minCosineVisuallySimilar) {
      classification = 'visually_similar';
      confidenceScore = simPercent;
      explanation = `High visual embedding similarity (${simPercent}%). The images share prominent visual features, but may be taken from different perspectives or depict different instances of the same issue type.`;
    } else if (embeddingSimilarity >= thresholds.minCosineUncertain) {
      classification = 'uncertain';
      confidenceScore = simPercent;
      explanation = `Moderate visual embedding similarity (${simPercent}%). Ambiguous visual overlap; supervisor review recommended before confirming duplicate status.`;
    } else {
      classification = 'likely_different';
      confidenceScore = simPercent;
      explanation = `Low visual embedding similarity (${simPercent}%). The photographs appear visually distinct.`;
    }
  } else {
    // Model fallback when inference failed
    confidenceScore = dHashDistance >= 0 ? Math.max(0, Math.round(100 - (dHashDistance / 64) * 100)) : 0;
    classification = isDHashNearIdentical ? 'near_identical' : 'likely_different';
    explanation = `Perceptual dHash distance: ${dHashDistance}/64. Embedding inference was unavailable (${modelError}).`;
  }

  return {
    isExactFileMatch: false,
    sha256A,
    sha256B,
    dHashA,
    dHashB,
    dHashDistance,
    embeddingSimilarity,
    classification,
    confidenceScore,
    inferenceTimeMs,
    modelError,
    provisionalThresholds: thresholds,
    summaryExplanation: explanation,
  };
}
