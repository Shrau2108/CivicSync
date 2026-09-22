import { useState, useEffect, useCallback } from 'react';
import { User, Mail, Phone, Save, MapPin, Plus, X, Star } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { RoleBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { updateProfile, fetchVolunteerByUserId, createVolunteer, updateVolunteer, addVolunteerSkill, removeVolunteerSkill } from '@/services/api';
import type { Volunteer } from '@/types';

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [newSkill, setNewSkill] = useState('');
  const [newProficiency, setNewProficiency] = useState('intermediate');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (profile?.role === 'volunteer') {
        const v = await fetchVolunteerByUserId(user.id);
        setVolunteer(v);
      }
      setFullName(profile?.full_name || '');
      setPhone(profile?.phone || '');
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => { load(); }, [load]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await updateProfile(user.id, { full_name: fullName, phone });
      await refreshProfile();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSkill = async () => {
    if (!volunteer || !newSkill.trim()) return;
    try {
      await addVolunteerSkill(volunteer.id, newSkill.trim(), newProficiency);
      setNewSkill('');
      load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to add skill');
    }
  };

  const handleRemoveSkill = async (skillId: string) => {
    try {
      await removeVolunteerSkill(skillId);
      load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to remove skill');
    }
  };

  if (loading) return <LoadingState message="Loading profile..." />;

  return (
    <div>
      <PageHeader title="Profile" description="Manage your account information" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Account Information</CardTitle></CardHeader>
            <CardBody className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input pl-10" />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
                  <input type="email" value={profile?.email || ''} disabled className="input pl-10 bg-charcoal-50" />
                </div>
              </div>
              <div>
                <label className="label">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input pl-10" placeholder="Add phone number" />
                </div>
              </div>

              {saveError && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{saveError}</div>}
              {saveSuccess && <div className="p-3 rounded-lg bg-primary-50 border border-primary-200 text-primary-700 text-sm">Profile saved successfully</div>}

              <button onClick={handleSaveProfile} disabled={saving} className="btn-primary">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </CardBody>
          </Card>

          {profile?.role === 'volunteer' && (
            <Card>
              <CardHeader><CardTitle>Volunteer Skills</CardTitle></CardHeader>
              <CardBody className="space-y-4">
                {volunteer?.skills && volunteer.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {volunteer.skills.map(s => (
                      <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-charcoal-50 border border-charcoal-200">
                        <span className="text-sm text-charcoal-700">{s.skill}</span>
                        <span className="text-xs text-charcoal-400 capitalize">({s.proficiency})</span>
                        <button onClick={() => handleRemoveSkill(s.id)} className="text-charcoal-400 hover:text-red-500">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-charcoal-400">No skills added yet</p>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <input type="text" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} className="input flex-1" placeholder="e.g., Plumbing, Electrical, First Aid" />
                  <select value={newProficiency} onChange={(e) => setNewProficiency(e.target.value)} className="input sm:w-40">
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="expert">Expert</option>
                  </select>
                  <button onClick={handleAddSkill} disabled={!newSkill.trim()} className="btn-primary">
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        <div>
          <Card>
            <CardHeader><CardTitle>Profile Summary</CardTitle></CardHeader>
            <CardBody className="text-center">
              <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-2xl mx-auto mb-3">
                {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <p className="font-semibold text-charcoal-800">{profile?.full_name}</p>
              <p className="text-sm text-charcoal-500">{profile?.email}</p>
              <div className="mt-2"><RoleBadge role={profile?.role || 'citizen'} /></div>
              {volunteer && (
                <div className="mt-4 pt-4 border-t border-charcoal-100 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-charcoal-500">Status</span>
                    <span className={volunteer.is_verified ? 'text-primary-600 font-medium' : 'text-amber-600 font-medium'}>
                      {volunteer.verification_status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-charcoal-500">Workload</span>
                    <span className="text-charcoal-700">{volunteer.current_workload}/{volunteer.max_workload}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-charcoal-500">Completed</span>
                    <span className="text-charcoal-700">{volunteer.completed_tasks}</span>
                  </div>
                  {volunteer.rating && (
                    <div className="flex items-center justify-between">
                      <span className="text-charcoal-500">Rating</span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400" />
                        <span className="text-charcoal-700">{volunteer.rating.toFixed(1)}</span>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
