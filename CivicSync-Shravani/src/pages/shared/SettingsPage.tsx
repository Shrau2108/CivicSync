import { useState, useEffect, useCallback } from 'react';
import { Settings, Save, Brain, Map, Bell } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppLayout';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { fetchSystemSettings, updateSystemSetting, fetchCategories } from '@/services/api';
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

  if (loading) return <LoadingState message="Loading settings..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const aiSetting = settings.find(s => s.key === 'ai_integration');
  const mapSetting = settings.find(s => s.key === 'map_provider');

  return (
    <div>
      <PageHeader
        title="System Settings"
        description="Configure priority weights, notifications, and integrations"
        action={<button onClick={handleSave} disabled={saving} className="btn-primary"><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}</button>}
      />

      {saveSuccess && <div className="p-3 mb-4 rounded-lg bg-primary-50 border border-primary-200 text-primary-700 text-sm animate-fade-in">Settings saved successfully</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Weights */}
        <Card>
          <CardHeader><CardTitle>Priority Weights</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-charcoal-500">Configure the weight of each factor in priority score calculation. Weights should sum to 100.</p>
            {Object.entries(priorityWeights).map(([key, value]) => (
              <div key={key}>
                <label className="label capitalize">{key.replace(/_/g, ' ')}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={value}
                    onChange={(e) => setPriorityWeights(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
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
            <p className="text-xs text-charcoal-400">Total: {Object.values(priorityWeights).reduce((a, b) => a + b, 0)} (should be 100)</p>
          </CardBody>
        </Card>

        {/* Notification Channels */}
        <Card>
          <CardHeader><CardTitle>Notification Channels</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            {Object.entries(notifChannels).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-charcoal-700 capitalize">{key.replace(/_/g, ' ')}</span>
                  {key !== 'in_app' && !value && <span className="text-xs text-charcoal-400 ml-2">(requires provider setup)</span>}
                </div>
                <button
                  onClick={() => setNotifChannels(prev => ({ ...prev, [key]: !value }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-primary-600' : 'bg-charcoal-200'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
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
              <div className="w-10 h-10 rounded-lg bg-charcoal-100 flex items-center justify-center flex-shrink-0">
                <Brain className="w-5 h-5 text-charcoal-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-charcoal-700">AI Categorization & Classification</p>
                <p className="text-xs text-charcoal-500 mt-1">
                  {aiSetting?.value && (aiSetting.value as Record<string, unknown>).active
                    ? 'AI integration is active.'
                    : 'AI integration is not configured. Manual categorization is available.'}
                </p>
                <p className="text-xs text-charcoal-400 mt-2">
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
              <div className="w-10 h-10 rounded-lg bg-charcoal-100 flex items-center justify-center flex-shrink-0">
                <Map className="w-5 h-5 text-charcoal-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-charcoal-700">Map Configuration</p>
                <p className="text-xs text-charcoal-500 mt-1">
                  {mapSetting?.value && (mapSetting.value as Record<string, unknown>).api_key_configured
                    ? 'Map provider is configured.'
                    : 'Map provider API key is not configured. Showing coordinates in list format.'}
                </p>
                <p className="text-xs text-charcoal-400 mt-2">
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
                <div key={cat.id} className="p-3 rounded-lg bg-charcoal-50 border border-charcoal-200 text-center">
                  <p className="text-sm font-medium text-charcoal-700">{cat.name}</p>
                  <span className={`text-xs ${cat.is_active ? 'text-primary-600' : 'text-charcoal-400'}`}>
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
