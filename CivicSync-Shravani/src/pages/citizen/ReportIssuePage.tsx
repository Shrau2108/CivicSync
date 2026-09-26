import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, MapPin, FileText, CheckCircle2, ArrowRight, ArrowLeft, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { fetchCategories, createReport, createReportLocation, uploadReportMedia } from '@/services/api';
import { cn } from '@/lib/utils';
import type { ReportCategory } from '@/types';

const CATEGORIES = [
  { name: 'Garbage', icon: 'Trash2' }, { name: 'Road Damage', icon: 'Construction' },
  { name: 'Streetlight', icon: 'Lightbulb' }, { name: 'Water Leakage', icon: 'Droplets' },
  { name: 'Medical', icon: 'Stethoscope' }, { name: 'Flood Relief', icon: 'Waves' },
  { name: 'Education', icon: 'GraduationCap' }, { name: 'Food', icon: 'UtensilsCrossed' },
  { name: 'Shelter', icon: 'Home' }, { name: 'Other', icon: 'CircleHelp' },
];

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low', desc: 'Minor inconvenience' },
  { value: 'medium', label: 'Medium', desc: 'Moderate impact' },
  { value: 'high', label: 'High', desc: 'Significant impact' },
  { value: 'critical', label: 'Critical', desc: 'Urgent safety concern' },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];

export function ReportIssuePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<ReportCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [affectedPeople, setAffectedPeople] = useState(1);
  const [additionalNotes, setAdditionalNotes] = useState('');

  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  const [files, setFiles] = useState<File[]>([]);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await fetchCategories();
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const getCurrentLocation = () => {
    setGettingLocation(true);
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser. Please enter coordinates manually.');
      setGettingLocation(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setGettingLocation(false);
      },
      (err) => {
        setLocationError(`Location access denied: ${err.message}. Please enter coordinates manually.`);
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid: File[] = [];
    for (const f of selected) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        setError(`File "${f.name}" is not a supported type. Use JPEG, PNG, WebP, MP4, or MOV.`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        setError(`File "${f.name}" exceeds 10MB limit.`);
        continue;
      }
      valid.push(f);
    }
    setError(null);
    setFiles(prev => [...prev, ...valid]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const canProceedStep1 = title.trim().length >= 5 && description.trim().length >= 10 && categoryId;
  const canProceedStep2 = latitude !== null && longitude !== null;

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    setError(null);
    setUploadProgress(0);
    try {
      const report = await createReport({
        title: title.trim(),
        description: description.trim(),
        category_id: categoryId,
        severity,
        affected_people: affectedPeople,
        additional_notes: additionalNotes.trim() || undefined,
        reporter_id: user.id,
      });

      await createReportLocation({
        report_id: report.id,
        address: address.trim() || undefined,
        latitude: latitude!,
        longitude: longitude!,
      });

      for (let i = 0; i < files.length; i++) {
        setUploadProgress(Math.round(((i / files.length) * 100)));
        await uploadReportMedia(report.id, files[i], user.id);
      }
      setUploadProgress(100);

      navigate(`/app/reports/${report.id}`, { state: { justCreated: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Report an Issue" description="Help your community by reporting civic problems" />

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
              step >= s ? 'bg-primary-600 text-white' : 'bg-charcoal-100 text-charcoal-400'
            )}>
              {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
            </div>
            <span className={cn('text-xs font-medium hidden sm:block', step >= s ? 'text-charcoal-700' : 'text-charcoal-400')}>
              {['Information', 'Location', 'Evidence', 'Review'][s - 1]}
            </span>
            {s < 4 && <div className={cn('h-px flex-1', step > s ? 'bg-primary-400' : 'bg-charcoal-200')} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm animate-fade-in">
          {error}
        </div>
      )}

      {/* Step 1: Issue Information */}
      {step === 1 && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Issue Information</CardTitle>
            <CardDescription>Describe the problem you want to report</CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <label className="label">Issue Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
                placeholder="e.g., Pothole on Main Street near the park"
                maxLength={120}
              />
              <p className="text-xs text-charcoal-400 mt-1">{title.length}/120 characters</p>
            </div>

            <div>
              <label className="label">Description <span className="text-red-500">*</span></label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input min-h-[100px] resize-y"
                placeholder="Provide a detailed description of the issue..."
                maxLength={2000}
              />
              <p className="text-xs text-charcoal-400 mt-1">{description.length}/2000 characters</p>
            </div>

            <div>
              <label className="label">Category <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={cn(
                      'p-3 rounded-lg border-2 text-center transition-all',
                      categoryId === cat.id ? 'border-primary-500 bg-primary-50' : 'border-charcoal-200 hover:border-charcoal-300'
                    )}
                  >
                    <p className={cn('text-sm font-medium', categoryId === cat.id ? 'text-primary-700' : 'text-charcoal-700')}>
                      {cat.name}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Severity</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SEVERITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSeverity(opt.value)}
                    className={cn(
                      'p-3 rounded-lg border-2 text-left transition-all',
                      severity === opt.value ? 'border-primary-500 bg-primary-50' : 'border-charcoal-200 hover:border-charcoal-300'
                    )}
                  >
                    <p className={cn('text-sm font-medium', severity === opt.value ? 'text-primary-700' : 'text-charcoal-700')}>{opt.label}</p>
                    <p className="text-xs text-charcoal-500">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Number of Affected People</label>
                <input
                  type="number"
                  value={affectedPeople}
                  onChange={(e) => setAffectedPeople(Math.max(1, parseInt(e.target.value) || 1))}
                  className="input"
                  min={1}
                />
              </div>
              <div>
                <label className="label">Additional Notes</label>
                <input
                  type="text"
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  className="input"
                  placeholder="Any extra context..."
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!canProceedStep1}
                onClick={() => setStep(2)}
                className="btn-primary"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Step 2: Location */}
      {step === 2 && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Location</CardTitle>
            <CardDescription>Where is the issue located?</CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <button type="button" onClick={getCurrentLocation} disabled={gettingLocation} className="btn-secondary w-full sm:w-auto">
              {gettingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              {gettingLocation ? 'Getting location...' : 'Use Current Location'}
            </button>

            {locationError && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                {locationError}
              </div>
            )}

            <div>
              <label className="label">Address <span className="text-charcoal-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input"
                placeholder="e.g., 123 Main Street, Downtown"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Latitude <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  step="any"
                  value={latitude ?? ''}
                  onChange={(e) => setLatitude(parseFloat(e.target.value) || null)}
                  className="input"
                  placeholder="e.g., 40.7128"
                />
              </div>
              <div>
                <label className="label">Longitude <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  step="any"
                  value={longitude ?? ''}
                  onChange={(e) => setLongitude(parseFloat(e.target.value) || null)}
                  className="input"
                  placeholder="e.g., -74.0060"
                />
              </div>
            </div>

            {latitude !== null && longitude !== null && (
              <div className="p-3 rounded-lg bg-primary-50 border border-primary-200 text-primary-700 text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Location set: {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </div>
            )}

            <div className="flex justify-between">
              <button type="button" onClick={() => setStep(1)} className="btn-secondary">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button type="button" disabled={!canProceedStep2} onClick={() => setStep(3)} className="btn-primary">
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Step 3: Evidence */}
      {step === 3 && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Evidence</CardTitle>
            <CardDescription>Upload photos or videos of the issue (optional but recommended)</CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <label className="block">
              <div className="border-2 border-dashed border-charcoal-200 rounded-lg p-8 text-center cursor-pointer hover:border-primary-400 transition-colors">
                <Upload className="w-8 h-8 text-charcoal-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-charcoal-600">Click to upload files</p>
                <p className="text-xs text-charcoal-400 mt-1">JPEG, PNG, WebP, MP4, MOV up to 10MB each</p>
              </div>
              <input type="file" multiple accept={ACCEPTED_TYPES.join(',')} onChange={handleFileSelect} className="hidden" />
            </label>

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-charcoal-50 border border-charcoal-200">
                    <div className="w-10 h-10 rounded-lg bg-charcoal-100 flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-5 h-5 text-charcoal-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-charcoal-700 truncate">{file.name}</p>
                      <p className="text-xs text-charcoal-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button type="button" onClick={() => removeFile(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-charcoal-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <button type="button" onClick={() => setStep(2)} className="btn-secondary">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button type="button" onClick={() => setStep(4)} className="btn-primary">
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Step 4: Review & Submit */}
      {step === 4 && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Review & Submit</CardTitle>
            <CardDescription>Please review your report before submitting</CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-charcoal-400 uppercase tracking-wide">Title</p>
                <p className="text-sm text-charcoal-700 mt-1">{title}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-charcoal-400 uppercase tracking-wide">Category</p>
                <p className="text-sm text-charcoal-700 mt-1">{categories.find(c => c.id === categoryId)?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-charcoal-400 uppercase tracking-wide">Severity</p>
                <p className="text-sm text-charcoal-700 mt-1 capitalize">{severity}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-charcoal-400 uppercase tracking-wide">Affected People</p>
                <p className="text-sm text-charcoal-700 mt-1">{affectedPeople}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium text-charcoal-400 uppercase tracking-wide">Description</p>
                <p className="text-sm text-charcoal-700 mt-1">{description}</p>
              </div>
              {address && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-charcoal-400 uppercase tracking-wide">Address</p>
                  <p className="text-sm text-charcoal-700 mt-1">{address}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-charcoal-400 uppercase tracking-wide">Coordinates</p>
                <p className="text-sm text-charcoal-700 mt-1">{latitude?.toFixed(4)}, {longitude?.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-charcoal-400 uppercase tracking-wide">Evidence Files</p>
                <p className="text-sm text-charcoal-700 mt-1">{files.length} file(s)</p>
              </div>
            </div>

            {submitting && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-charcoal-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting your report...
                </div>
                <div className="w-full bg-charcoal-100 rounded-full h-2">
                  <div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <button type="button" onClick={() => setStep(3)} disabled={submitting} className="btn-secondary">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button type="button" onClick={handleSubmit} disabled={submitting} className="btn-primary">
                {submitting ? 'Submitting...' : 'Submit Report'}
                {!submitting && <CheckCircle2 className="w-4 h-4" />}
              </button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
