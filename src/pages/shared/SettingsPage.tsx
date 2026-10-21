import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { Save, Brain, Map, Database, CheckCircle2, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppLayout';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { fetchSystemSettings, updateSystemSetting, fetchCategories } from '@/services/api';
import { checkSupabaseConnection, getSupabaseConfig, saveSupabaseCredentials, clearSupabaseCredentials } from '@/lib/supabase';
import type { SystemSetting, ReportCategory } from '@/types';

export function SettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [categories, setCategories] = useState<ReportCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [priorityWeights, setPriorityWeights] = useState({ severity: 40, urgency: 25, affected_people: 20, waiting_time: 15 });
  const [notifChannels, setNotifChannels] = useState({ in_app: true, push: false, sms: false, email: false, whatsapp: false });

  // Supabase Backend Credentials Form
  const currentSupabase = getSupabaseConfig();
  const [sbUrl, setSbUrl] = useState(currentSupabase.isConfigured ? currentSupabase.url : '');
  const [sbKey, setSbKey] = useState(currentSupabase.isConfigured ? currentSupabase.anonKey : '');
  const [sbSaved, setSbSaved] = useState(false);
  const [sbError, setSbError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error' | 'unconfigured'>(
    currentSupabase.isConfigured ? 'checking' : 'unconfigured'
  );
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, c] = await Promise.all([fetchSystemSettings(), fetchCategories()]);
      setSettings(s);
      setCategories(c);
      const pw = s.find(x => x.key === 'priority_weights');
      if (pw) setPriorityWeights(pw.value as typeof priorityWeights);
      const nc = s.find(x => x.key === 'notification_channels');
      if (nc) setNotifChannels(nc.value as typeof notifChannels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let active = true;
    if (!currentSupabase.isConfigured) {
      setConnectionStatus('unconfigured');
      return () => { active = false; };
    }

    setConnectionStatus('checking');
    checkSupabaseConnection().then(() => {
      if (active) {
        setConnectionStatus('connected');
        setConnectionError(null);
      }
    }).catch((err: unknown) => {
      if (active) {
        setConnectionStatus('error');
        setConnectionError(err instanceof Error ? err.message : 'Could not reach the Supabase database.');
      }
    });
    return () => { active = false; };
  }, [currentSupabase.isConfigured]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateSystemSetting('priority_weights', priorityWeights);
      await updateSystemSetting('notification_channels', notifChannels);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSupabase = (e: FormEvent) => {
    e.preventDefault();
    if (!sbUrl.trim() || !sbKey.trim()) return;
    setSbError(null);
    try {
      saveSupabaseCredentials(sbUrl, sbKey);
      setSbSaved(true);
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err) {
      setSbError(err instanceof Error ? err.message : 'Could not save Supabase credentials.');
    }
  };

  const handleResetSupabase = () => {
    clearSupabaseCredentials();
    setSbUrl('');
    setSbKey('');
    window.location.reload();
  };

  if (loading) return <LoadingState message="Loading settings..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const aiSetting = settings.find(s => s.key === 'ai_integration');
  const mapSetting = settings.find(s => s.key === 'map_provider');

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Configure priority weights, notifications, integrations, and database backend"
        action={<button onClick={handleSave} disabled={saving} className="btn-primary"><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}</button>}
      />

      {saveSuccess && <div className="p-3 mb-4 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm animate-fade-in">Settings saved successfully</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Supabase Connection */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle>Supabase Backend Connection</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Connect or update your Supabase project URL and anon public key
                  </p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : connectionStatus === 'error'
                    ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-emerald-500' : connectionStatus === 'error' ? 'bg-red-500' : 'bg-amber-500'
                }`} />
                {connectionStatus === 'connected'
                  ? `Connected (${currentSupabase.source})`
                  : connectionStatus === 'checking'
                    ? 'Checking connection...'
                    : connectionStatus === 'error'
                      ? 'Database connection failed'
                      : 'Demo mode'}
              </span>
            </div>
          </CardHeader>
          <CardBody>
            {connectionError && (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {connectionError}
              </p>
            )}
            {sbSaved ? (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>Supabase credentials saved. Reloading application with live connection...</span>
              </div>
            ) : currentSupabase.source === 'env' ? (
              <p className="text-sm text-muted-foreground">
                This connection is managed by build environment variables. Update <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">VITE_SUPABASE_URL</code> and <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">VITE_SUPABASE_ANON_KEY</code> in your local <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">.env</code> or deployment settings, then restart or redeploy the app.
              </p>
            ) : (
              <form onSubmit={handleSaveSupabase} className="space-y-4">
                {sbError && <p className="text-sm text-red-700 dark:text-red-300">{sbError}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label text-xs">Supabase Project URL</label>
                    <input
                      type="url"
                      value={sbUrl}
                      onChange={(e) => setSbUrl(e.target.value)}
                      required
                      placeholder="https://xyzcompany.supabase.co"
                      className="input text-xs"
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Supabase Anon Public Key</label>
                    <input
                      type="password"
                      value={sbKey}
                      onChange={(e) => setSbKey(e.target.value)}
                      required
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                      className="input text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-muted-foreground">
                    Use only the Supabase anon/publishable key here. The service-role key must never be exposed in a browser.
                  </p>
                  <div className="flex items-center gap-2">
                    {currentSupabase.source === 'localStorage' && (
                      <button
                        type="button"
                        onClick={handleResetSupabase}
                        className="btn-ghost text-xs text-destructive hover:bg-destructive/10 inline-flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset to Default
                      </button>
                    )}
                    <button type="submit" className="btn-primary text-xs">
                      Update Supabase Credentials
                    </button>
                  </div>
                </div>
              </form>
            )}
          </CardBody>
        </Card>

        {/* Priority Weights */}
        <Card>
          <CardHeader><CardTitle>Priority Weights</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-muted-foreground">Configure the weight of each factor in priority score calculation. Weights should sum to 100.</p>
            {Object.entries(priorityWeights).map(([key, value]) => (
              <div key={key}>
                <label className="label capitalize">{key.replace(/_/g, ' ')}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={value}
                    onChange={(e) => setPriorityWeights(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setPriorityWeights(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                    className="input w-20"
                  />
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Total: {Object.values(priorityWeights).reduce((a, b) => a + b, 0)} (should be 100)</p>
          </CardBody>
        </Card>

        {/* Notification Channels */}
        <Card>
          <CardHeader><CardTitle>Notification Channels</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            {Object.entries(notifChannels).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                  {key !== 'in_app' && !value && <span className="text-xs text-muted-foreground ml-2">(requires provider setup)</span>}
                </div>
                <button
                  type="button"
                  onClick={() => setNotifChannels(prev => ({ ...prev, [key]: !value }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-primary' : 'bg-muted'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-card transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* AI Integration */}
        <Card>
          <CardHeader><CardTitle>AI Integration</CardTitle></CardHeader>
          <CardBody>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Brain className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">AI Categorization &amp; Classification</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {aiSetting?.value && (aiSetting.value as Record<string, unknown>).active
                    ? 'AI integration is active.'
                    : 'AI integration is not configured. Manual categorization is available.'}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  To enable: configure an AI provider API key in edge function secrets and set the integration status.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Map Provider */}
        <Card>
          <CardHeader><CardTitle>Map Provider</CardTitle></CardHeader>
          <CardBody>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Map className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Map Configuration</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {mapSetting?.value && (mapSetting.value as Record<string, unknown>).api_key_configured
                    ? 'Map provider is configured.'
                    : 'Map provider API key is not configured. Showing coordinates in list format.'}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  To enable live maps: configure a Google Maps or Mapbox API key.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Categories */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Report Categories</CardTitle></CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {categories.map(cat => (
                <div key={cat.id} className="p-3 rounded-lg bg-card border border-border text-center">
                  <p className="text-sm font-medium text-foreground">{cat.name}</p>
                  <span className={`text-xs ${cat.is_active ? 'text-primary' : 'text-muted-foreground'}`}>
                    {cat.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
