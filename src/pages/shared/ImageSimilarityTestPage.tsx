import { useState, useRef, useCallback } from 'react';
import {
  Upload, Sparkles, RefreshCw, X, AlertTriangle, CheckCircle2,
  Sliders, Copy, Download, Info, Zap, ShieldAlert,
  ArrowRight, FileCode, Check
} from 'lucide-react';
import { PageHeader } from '@/components/layout/AppLayout';
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import {
  compareImages,
  DEFAULT_PROVISIONAL_THRESHOLDS,
  type ImageComparisonResult,
  type SimilarityThresholds,
  type VisualClassification,
} from '@/lib/visionSimilarity';
import { cn } from '@/lib/utils';

interface ImageSlotState {
  file: File | Blob | null;
  name: string;
  previewUrl: string | null;
  sizeBytes: number;
  width: number | null;
  height: number | null;
}

const EMPTY_SLOT: ImageSlotState = {
  file: null,
  name: '',
  previewUrl: null,
  sizeBytes: 0,
  width: null,
  height: null,
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function ImageSimilarityTestPage() {
  const [slotA, setSlotA] = useState<ImageSlotState>(EMPTY_SLOT);
  const [slotB, setSlotB] = useState<ImageSlotState>(EMPTY_SLOT);
  const [thresholds, setThresholds] = useState<SimilarityThresholds>(DEFAULT_PROVISIONAL_THRESHOLDS);
  const [showThresholdSettings, setShowThresholdSettings] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonStep, setComparisonStep] = useState<string>('');
  const [result, setResult] = useState<ImageComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  const fileInputRefA = useRef<HTMLInputElement | null>(null);
  const fileInputRefB = useRef<HTMLInputElement | null>(null);

  const handleFileChange = useCallback((file: File, slot: 'A' | 'B') => {
    setError(null);
    setResult(null);

    const previewUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const state: ImageSlotState = {
        file,
        name: file.name,
        previewUrl,
        sizeBytes: file.size,
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
      if (slot === 'A') {
        if (slotA.previewUrl) URL.revokeObjectURL(slotA.previewUrl);
        setSlotA(state);
      } else {
        if (slotB.previewUrl) URL.revokeObjectURL(slotB.previewUrl);
        setSlotB(state);
      }
    };
    img.onerror = () => {
      setError(`Failed to decode image "${file.name}". Ensure it is a valid JPEG, PNG, or WebP.`);
      URL.revokeObjectURL(previewUrl);
    };
    img.src = previewUrl;
  }, [slotA.previewUrl, slotB.previewUrl]);

  const handleClearSlot = useCallback((slot: 'A' | 'B') => {
    setResult(null);
    setError(null);
    if (slot === 'A') {
      if (slotA.previewUrl) URL.revokeObjectURL(slotA.previewUrl);
      setSlotA(EMPTY_SLOT);
      if (fileInputRefA.current) fileInputRefA.current.value = '';
    } else {
      if (slotB.previewUrl) URL.revokeObjectURL(slotB.previewUrl);
      setSlotB(EMPTY_SLOT);
      if (fileInputRefB.current) fileInputRefB.current.value = '';
    }
  }, [slotA.previewUrl, slotB.previewUrl]);

  const handleClearAll = useCallback(() => {
    handleClearSlot('A');
    handleClearSlot('B');
  }, [handleClearSlot]);

  // Synthetic Test Scenario Generator (Canvas-based)
  const loadSyntheticScenario = useCallback(async (scenarioId: number) => {
    setError(null);
    setResult(null);

    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw baseline civic pothole / road texture
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 320, 240);
    // Draw simulated asphalt texture
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1e293b' : '#475569';
      ctx.fillRect(Math.random() * 320, Math.random() * 240, 2, 2);
    }
    // Draw simulated pothole
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(160, 120, 70, 45, Math.PI / 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#64748b';
    ctx.stroke();

    const baseBlob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
    const baseFile = new File([baseBlob], 'pothole_reference.png', { type: 'image/png' });

    if (scenarioId === 1) {
      // Scenario 1: Exact Same File
      handleFileChange(baseFile, 'A');
      handleFileChange(baseFile, 'B');
    } else if (scenarioId === 2) {
      // Scenario 2: Renamed Exact File
      const renamedFile = new File([baseBlob], 'pothole_renamed_copy.png', { type: 'image/png' });
      handleFileChange(baseFile, 'A');
      handleFileChange(renamedFile, 'B');
    } else if (scenarioId === 3) {
      // Scenario 3: Resized / Re-compressed (JPEG 0.4 at half size)
      const canvasB = document.createElement('canvas');
      canvasB.width = 160;
      canvasB.height = 120;
      const ctxB = canvasB.getContext('2d');
      if (ctxB) {
        ctxB.drawImage(canvas, 0, 0, 160, 120);
        const compBlob: Blob = await new Promise((res) => canvasB.toBlob((b) => res(b!), 'image/jpeg', 0.4));
        const compFile = new File([compBlob], 'pothole_resized_compressed.jpg', { type: 'image/jpeg' });
        handleFileChange(baseFile, 'A');
        handleFileChange(compFile, 'B');
      }
    } else if (scenarioId === 4) {
      // Scenario 4: Cropped & Brightened
      const canvasB = document.createElement('canvas');
      canvasB.width = 280;
      canvasB.height = 200;
      const ctxB = canvasB.getContext('2d');
      if (ctxB) {
        ctxB.filter = 'brightness(1.25)';
        ctxB.drawImage(canvas, 20, 20, 280, 200, 0, 0, 280, 200);
        const cropBlob: Blob = await new Promise((res) => canvasB.toBlob((b) => res(b!), 'image/png'));
        const cropFile = new File([cropBlob], 'pothole_cropped_bright.png', { type: 'image/png' });
        handleFileChange(baseFile, 'A');
        handleFileChange(cropFile, 'B');
      }
    } else if (scenarioId === 5) {
      // Scenario 5: Different Pothole in Same Category
      const canvasB = document.createElement('canvas');
      canvasB.width = 320;
      canvasB.height = 240;
      const ctxB = canvasB.getContext('2d');
      if (ctxB) {
        ctxB.fillStyle = '#475569';
        ctxB.fillRect(0, 0, 320, 240);
        ctxB.fillStyle = '#1e293b';
        ctxB.beginPath();
        // Circular pothole at corner
        ctxB.arc(80, 70, 50, 0, Math.PI * 2);
        ctxB.fill();
        const diffPotholeBlob: Blob = await new Promise((res) => canvasB.toBlob((b) => res(b!), 'image/png'));
        const diffPotholeFile = new File([diffPotholeBlob], 'different_pothole.png', { type: 'image/png' });
        handleFileChange(baseFile, 'A');
        handleFileChange(diffPotholeFile, 'B');
      }
    } else if (scenarioId === 7) {
      // Scenario 7: Completely Unrelated Image (Garbage / Bright Green Park)
      const canvasB = document.createElement('canvas');
      canvasB.width = 320;
      canvasB.height = 240;
      const ctxB = canvasB.getContext('2d');
      if (ctxB) {
        ctxB.fillStyle = '#10b981';
        ctxB.fillRect(0, 0, 320, 240);
        ctxB.fillStyle = '#f59e0b';
        ctxB.fillRect(50, 50, 100, 100);
        const unrelatedBlob: Blob = await new Promise((res) => canvasB.toBlob((b) => res(b!), 'image/png'));
        const unrelatedFile = new File([unrelatedBlob], 'unrelated_park.png', { type: 'image/png' });
        handleFileChange(baseFile, 'A');
        handleFileChange(unrelatedFile, 'B');
      }
    } else if (scenarioId === 8) {
      // Scenario 8: Invalid / Corrupt input
      const invalidBlob = new Blob(['Not a valid image binary payload'], { type: 'text/plain' });
      const invalidFile = new File([invalidBlob], 'corrupt_image.jpg', { type: 'image/jpeg' });
      handleFileChange(baseFile, 'A');
      handleFileChange(invalidFile, 'B');
    }
  }, [handleFileChange]);

  const runComparison = async () => {
    if (!slotA.file || !slotB.file) {
      setError('Please provide two images before initiating comparison.');
      return;
    }

    setIsComparing(true);
    setError(null);
    setResult(null);
    setComparisonStep('Initializing vision engine...');

    try {
      setComparisonStep('Evaluating SHA-256 and computing 64-bit dHash...');
      const res = await compareImages(slotA.file, slotB.file, thresholds);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected failure during image similarity evaluation.');
    } finally {
      setIsComparing(false);
      setComparisonStep('');
    }
  };

  const copyJsonResult = () => {
    if (!result) return;
    const jsonStr = JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const downloadJsonResult = () => {
    if (!result) return;
    const jsonStr = JSON.stringify(result, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `civicsync-vision-comparison-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getClassificationBadge = (classification: VisualClassification) => {
    switch (classification) {
      case 'identical_file':
        return <span className="badge bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Identical File (Exact Match)</span>;
      case 'near_identical':
        return <span className="badge bg-cyan-500/15 text-cyan-400 border-cyan-500/30">Near-Identical (Perceptual Match)</span>;
      case 'visually_similar':
        return <span className="badge bg-blue-500/15 text-blue-400 border-blue-500/30">Visually Similar (High Feature Overlap)</span>;
      case 'uncertain':
        return <span className="badge bg-amber-500/15 text-amber-400 border-amber-500/30">Uncertain (Requires Supervisor Review)</span>;
      case 'likely_different':
      default:
        return <span className="badge bg-slate-500/15 text-slate-400 border-slate-500/30">Likely Different</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      <PageHeader
        title="Vision Similarity Test Bench"
        description="Isolated evaluation environment for CivicSync's multi-tier image similarity engine"
      />

      {/* Honest Interpretation Warning */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-300">Provisional Evaluation Notice</p>
          <p className="text-xs leading-relaxed text-amber-200/90">
            Image similarity is one signal among many and does <strong>not</strong> establish that two reports represent the same physical civic issue.
            Two different potholes or garbage piles can score high visual similarity despite being miles apart.
            CivicSync combines vision similarity with geographic proximity (Haversine), category matching, and supervisor review.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-red-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:bg-white/10 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Synthetic Scenario Shortcuts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <CardTitle>Quick Synthetic Evaluation Scenarios</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">Click to load pre-configured test patterns</span>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => loadSyntheticScenario(1)}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              1. Same File
            </button>
            <button
              onClick={() => loadSyntheticScenario(2)}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              2. Renamed File
            </button>
            <button
              onClick={() => loadSyntheticScenario(3)}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              3. Resized / Compressed
            </button>
            <button
              onClick={() => loadSyntheticScenario(4)}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              4. Cropped & Brightened
            </button>
            <button
              onClick={() => loadSyntheticScenario(5)}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              5. Similar Category
            </button>
            <button
              onClick={() => loadSyntheticScenario(7)}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              7. Unrelated Images
            </button>
            <button
              onClick={() => loadSyntheticScenario(8)}
              className="btn-secondary text-xs py-1.5 px-3 text-red-400 hover:text-red-300"
            >
              8. Corrupt File Test
            </button>
          </div>
        </CardBody>
      </Card>

      {/* Upload & Preview Slots */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Slot A */}
        <Card className="relative overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                  A
                </span>
                <CardTitle>Image A (Reference)</CardTitle>
              </div>
              {slotA.file && (
                <button
                  onClick={() => handleClearSlot('A')}
                  className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Remove
                </button>
              )}
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            {slotA.previewUrl ? (
              <div className="space-y-3">
                <div className="w-full h-64 bg-slate-950/60 rounded-xl overflow-hidden flex items-center justify-center border border-border">
                  <img src={slotA.previewUrl} alt="Preview A" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border">
                  <div><span className="font-medium text-foreground">Filename:</span> <span className="truncate block">{slotA.name}</span></div>
                  <div><span className="font-medium text-foreground">Size:</span> {formatBytes(slotA.sizeBytes)}</div>
                  <div><span className="font-medium text-foreground">Dimensions:</span> {slotA.width} × {slotA.height} px</div>
                  <div><span className="font-medium text-foreground">Type:</span> {slotA.file?.type || 'Image'}</div>
                </div>
              </div>
            ) : (
              <label className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors flex flex-col items-center justify-center min-h-[256px]">
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <span className="text-sm font-medium text-foreground">Upload Image A</span>
                <span className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP up to 10MB</span>
                <input
                  ref={fileInputRefA}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0], 'A')}
                  className="hidden"
                />
              </label>
            )}
          </CardBody>
        </Card>

        {/* Slot B */}
        <Card className="relative overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold flex items-center justify-center">
                  B
                </span>
                <CardTitle>Image B (Candidate)</CardTitle>
              </div>
              {slotB.file && (
                <button
                  onClick={() => handleClearSlot('B')}
                  className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Remove
                </button>
              )}
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            {slotB.previewUrl ? (
              <div className="space-y-3">
                <div className="w-full h-64 bg-slate-950/60 rounded-xl overflow-hidden flex items-center justify-center border border-border">
                  <img src={slotB.previewUrl} alt="Preview B" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border">
                  <div><span className="font-medium text-foreground">Filename:</span> <span className="truncate block">{slotB.name}</span></div>
                  <div><span className="font-medium text-foreground">Size:</span> {formatBytes(slotB.sizeBytes)}</div>
                  <div><span className="font-medium text-foreground">Dimensions:</span> {slotB.width} × {slotB.height} px</div>
                  <div><span className="font-medium text-foreground">Type:</span> {slotB.file?.type || 'Image'}</div>
                </div>
              </div>
            ) : (
              <label className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-cyan-500/50 transition-colors flex flex-col items-center justify-center min-h-[256px]">
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <span className="text-sm font-medium text-foreground">Upload Image B</span>
                <span className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP up to 10MB</span>
                <input
                  ref={fileInputRefB}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0], 'B')}
                  className="hidden"
                />
              </label>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Control Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={runComparison}
            disabled={!slotA.file || !slotB.file || isComparing}
            className="btn-primary"
          >
            {isComparing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{comparisonStep || 'Evaluating...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Compare Images</span>
              </>
            )}
          </button>
          <button
            onClick={handleClearAll}
            disabled={(!slotA.file && !slotB.file) || isComparing}
            className="btn-secondary"
          >
            Clear Both
          </button>
        </div>

        <button
          onClick={() => setShowThresholdSettings((v) => !v)}
          className="btn-ghost text-xs flex items-center gap-1.5"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{showThresholdSettings ? 'Hide Threshold Settings' : 'Configure Provisional Thresholds'}</span>
        </button>
      </div>

      {/* Threshold Configuration Drawer */}
      {showThresholdSettings && (
        <Card className="border-cyan-500/30 bg-slate-900/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Configurable Provisional Thresholds</CardTitle>
                <CardDescription className="text-xs">Adjust sensitivity for experimental evaluation</CardDescription>
              </div>
              <button
                onClick={() => setThresholds(DEFAULT_PROVISIONAL_THRESHOLDS)}
                className="text-xs text-cyan-400 hover:underline"
              >
                Reset to Defaults
              </button>
            </div>
          </CardHeader>
          <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Max dHash Distance (Near-Identical): <span className="text-cyan-400 font-mono">{thresholds.maxDHashDistanceNearIdentical}</span> / 64
              </label>
              <input
                type="range"
                min="0"
                max="20"
                value={thresholds.maxDHashDistanceNearIdentical}
                onChange={(e) => setThresholds((t) => ({ ...t, maxDHashDistanceNearIdentical: parseInt(e.target.value) }))}
                className="w-full accent-cyan-500"
              />
              <span className="text-[11px] text-muted-foreground block mt-1">Lower = stricter perceptual match</span>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Min Cosine (Visually Similar): <span className="text-cyan-400 font-mono">{thresholds.minCosineVisuallySimilar}</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.01"
                value={thresholds.minCosineVisuallySimilar}
                onChange={(e) => setThresholds((t) => ({ ...t, minCosineVisuallySimilar: parseFloat(e.target.value) }))}
                className="w-full accent-cyan-500"
              />
              <span className="text-[11px] text-muted-foreground block mt-1">Provisional feature overlap cutoff</span>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Min Cosine (Uncertain Review): <span className="text-cyan-400 font-mono">{thresholds.minCosineUncertain}</span>
              </label>
              <input
                type="range"
                min="0.4"
                max="0.8"
                step="0.01"
                value={thresholds.minCosineUncertain}
                onChange={(e) => setThresholds((t) => ({ ...t, minCosineUncertain: parseFloat(e.target.value) }))}
                className="w-full accent-cyan-500"
              />
              <span className="text-[11px] text-muted-foreground block mt-1">Below this is classified as likely different</span>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Comparison Results Card */}
      {result && (
        <Card className="border-cyan-500/40 bg-card overflow-hidden">
          <CardHeader className="bg-slate-950/40 border-b border-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">Comparison Verdict</h3>
                  {getClassificationBadge(result.classification)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Inference completed in {result.inferenceTimeMs} ms</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyJsonResult}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
                </button>
                <button
                  onClick={downloadJsonResult}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-6">
            {/* Primary Explanation */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-sm text-foreground">
              <span className="font-medium text-cyan-400">Analysis Summary:</span> {result.summaryExplanation}
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Metric 1: SHA-256 Binary Match */}
              <div className="p-4 rounded-xl bg-card border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase font-semibold">1. Exact File Hash</span>
                  {result.isExactFileMatch ? (
                    <span className="badge bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">MATCH</span>
                  ) : (
                    <span className="badge bg-slate-500/20 text-slate-400 border-slate-500/30 text-[10px]">DIFFERENT</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {result.isExactFileMatch ? 'Exact Byte Match' : 'Distinct Files'}
                </p>
                <div className="text-[10px] font-mono text-muted-foreground truncate space-y-0.5">
                  <div title={result.sha256A || ''}>A: {result.sha256A ? result.sha256A.slice(0, 16) + '...' : 'N/A'}</div>
                  <div title={result.sha256B || ''}>B: {result.sha256B ? result.sha256B.slice(0, 16) + '...' : 'N/A'}</div>
                </div>
              </div>

              {/* Metric 2: Perceptual dHash */}
              <div className="p-4 rounded-xl bg-card border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase font-semibold">2. dHash Distance</span>
                  <span className={cn(
                    'badge text-[10px]',
                    result.dHashDistance <= thresholds.maxDHashDistanceNearIdentical
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                      : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                  )}>
                    {result.dHashDistance} / 64 bits
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {result.dHashDistance <= thresholds.maxDHashDistanceNearIdentical ? 'Near-Identical' : 'Structural Variance'}
                </p>
                <div className="text-[10px] font-mono text-muted-foreground truncate space-y-0.5">
                  <div>Hash A: {result.dHashA}</div>
                  <div>Hash B: {result.dHashB}</div>
                </div>
              </div>

              {/* Metric 3: MobileNet Cosine Similarity */}
              <div className="p-4 rounded-xl bg-card border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase font-semibold">3. Embedding Cosine</span>
                  {result.embeddingSimilarity !== null ? (
                    <span className="font-mono text-xs text-cyan-400 font-bold">
                      {result.embeddingSimilarity.toFixed(4)}
                    </span>
                  ) : (
                    <span className="badge bg-destructive/20 text-destructive text-[10px]">FAILED</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {result.embeddingSimilarity !== null
                    ? `${(result.embeddingSimilarity * 100).toFixed(1)}% Alignment`
                    : 'Model Error'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  1024-dim MobileNet v2 bottleneck vector cosine metric.
                </p>
              </div>

              {/* Metric 4: Latency & Model Status */}
              <div className="p-4 rounded-xl bg-card border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase font-semibold">4. Engine Status</span>
                  <span className="badge bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">ACTIVE</span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {result.inferenceTimeMs} ms Latency
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {result.modelError ? `Warning: ${result.modelError}` : 'Client WebGL Acceleration'}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 8-Point Test Evaluation Protocol Documentation */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400" />
            <CardTitle>CivicSync 8-Scenario Evaluation Protocol</CardTitle>
          </div>
          <CardDescription>
            Documented test scenarios for evaluating precision, recall, and boundaries of vision similarity
          </CardDescription>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Scenario</th>
                  <th className="p-3">Expected SHA-256</th>
                  <th className="p-3">Expected dHash</th>
                  <th className="p-3">Expected Cosine</th>
                  <th className="p-3">Honest Architectural Interpretation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                <tr className="hover:bg-muted/20">
                  <td className="p-3 font-bold">1</td>
                  <td className="p-3 font-medium">Exact file match</td>
                  <td className="p-3 text-emerald-400">Match (100%)</td>
                  <td className="p-3">Distance = 0</td>
                  <td className="p-3">1.0000</td>
                  <td className="p-3 text-muted-foreground">Identical file upload; zero ambiguity.</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="p-3 font-bold">2</td>
                  <td className="p-3 font-medium">Same image, renamed</td>
                  <td className="p-3 text-emerald-400">Match (100%)</td>
                  <td className="p-3">Distance = 0</td>
                  <td className="p-3">1.0000</td>
                  <td className="p-3 text-muted-foreground">Byte hash is filename-independent.</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="p-3 font-bold">3</td>
                  <td className="p-3 font-medium">Resized or compressed</td>
                  <td className="p-3 text-slate-400">Mismatch</td>
                  <td className="p-3 text-cyan-400">Distance ≤ 5</td>
                  <td className="p-3">&gt; 0.92</td>
                  <td className="p-3 text-muted-foreground">Perceptual hash & embeddings remain highly stable under compression.</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="p-3 font-bold">4</td>
                  <td className="p-3 font-medium">Cropped or lighting changes</td>
                  <td className="p-3 text-slate-400">Mismatch</td>
                  <td className="p-3">Distance 4 – 15</td>
                  <td className="p-3">&gt; 0.80</td>
                  <td className="p-3 text-muted-foreground">Embeddings capture invariant features; dHash distance increases slightly.</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="p-3 font-bold">5</td>
                  <td className="p-3 font-medium">Two different potholes</td>
                  <td className="p-3 text-slate-400">Mismatch</td>
                  <td className="p-3">Distance &gt; 12</td>
                  <td className="p-3">0.65 – 0.85</td>
                  <td className="p-3 text-amber-400">⚠️ Risk of visual false positive; must be separated by GPS distance (&gt;100m).</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="p-3 font-bold">6</td>
                  <td className="p-3 font-medium">Visually similar different issues</td>
                  <td className="p-3 text-slate-400">Mismatch</td>
                  <td className="p-3">Distance &gt; 15</td>
                  <td className="p-3">0.60 – 0.80</td>
                  <td className="p-3 text-amber-400">⚠️ Category matching and text descriptions prevent false duplicate merging.</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="p-3 font-bold">7</td>
                  <td className="p-3 font-medium">Two unrelated images</td>
                  <td className="p-3 text-slate-400">Mismatch</td>
                  <td className="p-3">Distance &gt; 25</td>
                  <td className="p-3">&lt; 0.65</td>
                  <td className="p-3 text-muted-foreground">Orthogonal feature representations; classified as likely different.</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="p-3 font-bold">8</td>
                  <td className="p-3 font-medium">Corrupt / unsupported file</td>
                  <td className="p-3 text-destructive">N/A</td>
                  <td className="p-3 text-destructive">N/A</td>
                  <td className="p-3 text-destructive">N/A</td>
                  <td className="p-3 text-muted-foreground">Catches decoding error cleanly without crashing UI state.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
