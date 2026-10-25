import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User, Mail, Phone, MapPin, Building2, Bell, BarChart3, Shield,
  Lock, Download, Clock, ChevronRight, Save, Check, CheckCircle2,
  AlertCircle, X, Loader2, Edit3, FileText, Plus, Star, ArrowRight,
  Eye, EyeOff
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import {
  updateProfile,
  fetchReportsByReporter,
  fetchVolunteerByUserId,
  updateVolunteer,
  addVolunteerSkill,
  removeVolunteerSkill
} from '@/services/api';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import type { Report, Volunteer, NotificationPreferences } from '@/types';

export function ProfilePage() {
  const { user, profile, refreshProfile, updateProfileLocally, demoMode } = useAuth();
  const navigate = useNavigate();

  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');

  // Notification preference states
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [reportUpdates, setReportUpdates] = useState(true);
  const [communityAnnouncements, setCommunityAnnouncements] = useState(true);

  // Status & loading states
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Reports & volunteer data
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [bio, setBio] = useState('');
  const [newSkill, setNewSkill] = useState('');
  const [newProficiency, setNewProficiency] = useState('intermediate');

  // Modals
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);

  const [downloadingData, setDownloadingData] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const fullNameInputRef = useRef<HTMLInputElement>(null);
  const accountInfoCardRef = useRef<HTMLDivElement>(null);

  // Load profile and reports
  const load = useCallback(async () => {
    if (!user) return;
    try {
      if (profile?.role === 'volunteer') {
        const v = await fetchVolunteerByUserId(user.id);
        setVolunteer(v);
        if (v?.bio) setBio(v.bio);
        if (v?.service_area && !profile?.area) setArea(v.service_area);
      }

      setFullName(profile?.full_name || '');
      setPhone(profile?.phone || '');
      setCity(profile?.city || '');
      setArea(profile?.area || '');

      const prefs = profile?.notification_preferences;
      if (prefs) {
        setEmailAlerts(prefs.email_alerts ?? true);
        setReportUpdates(prefs.report_updates ?? true);
        setCommunityAnnouncements(prefs.community_announcements ?? true);
      }
    } catch (err) {
      console.error('Failed to load profile details', err);
    }
  }, [user, profile]);

  const loadReports = useCallback(async () => {
    if (!user) return;
    setReportsLoading(true);
    setReportsError(null);
    try {
      const data = await fetchReportsByReporter(user.id);
      setReports(data || []);
    } catch (err) {
      setReportsError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setReportsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
    loadReports();
  }, [load, loadReports]);

  // Handle Save Profile & Preferences
  const handleSaveProfile = async (customPrefs?: NotificationPreferences) => {
    if (!user) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const prefsToSave: NotificationPreferences = customPrefs || {
      email_alerts: emailAlerts,
      report_updates: reportUpdates,
      community_announcements: communityAnnouncements,
    };

    const updates = {
      full_name: fullName.trim() || profile?.full_name || (profile?.role === 'volunteer' ? 'Demo Volunteer' : 'Citizen'),
      phone: phone.trim() || null,
      city: city.trim() || null,
      area: area.trim() || null,
      notification_preferences: prefsToSave,
    };

    try {
      await updateProfile(user.id, updates);
      if (profile?.role === 'volunteer') {
        if (volunteer) {
          await updateVolunteer(volunteer.id, {
            service_area: area.trim() || null,
            bio: bio.trim() || null,
          });
        }
      }
      if (typeof updateProfileLocally === 'function') {
        updateProfileLocally(updates);
      }
      await refreshProfile();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  // Preference toggle handler
  const handleTogglePreference = async (key: 'email' | 'status' | 'announcements') => {
    let nextEmail = emailAlerts;
    let nextStatus = reportUpdates;
    let nextAnnouncements = communityAnnouncements;

    if (key === 'email') {
      nextEmail = !emailAlerts;
      setEmailAlerts(nextEmail);
    } else if (key === 'status') {
      nextStatus = !reportUpdates;
      setReportUpdates(nextStatus);
    } else {
      nextAnnouncements = !communityAnnouncements;
      setCommunityAnnouncements(nextAnnouncements);
    }

    const updatedPrefs: NotificationPreferences = {
      email_alerts: nextEmail,
      report_updates: nextStatus,
      community_announcements: nextAnnouncements,
    };

    if (user) {
      try {
        if (typeof updateProfileLocally === 'function') {
          updateProfileLocally({ notification_preferences: updatedPrefs });
        }
        await updateProfile(user.id, {
          notification_preferences: updatedPrefs,
        });
        await refreshProfile();
      } catch (err) {
        console.error('Failed to auto-save preference', err);
      }
    }
  };

  // Handle Focus on Edit Profile action
  const handleEditClick = () => {
    accountInfoCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      fullNameInputRef.current?.focus();
    }, 300);
  };

  // Handle Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      if (demoMode) {
        // In demo mode, simulate successful update
        await new Promise(res => setTimeout(res, 600));
      } else {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      }
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPasswordSuccess(false);
        setShowPasswordModal(false);
      }, 2000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setPasswordSaving(false);
    }
  };

  // Handle Change Email
  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(false);

    if (!newEmail || !newEmail.includes('@')) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setEmailSaving(true);
    try {
      if (demoMode) {
        if (user) {
          await updateProfile(user.id, { email: newEmail });
          await refreshProfile();
        }
      } else {
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) throw error;
      }
      setEmailSuccess(true);
      setTimeout(() => {
        setEmailSuccess(false);
        setShowEmailModal(false);
        setNewEmail('');
      }, 2500);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to update email');
    } finally {
      setEmailSaving(false);
    }
  };

  // Handle Download My Data
  const handleDownloadMyData = async () => {
    setDownloadingData(true);
    try {
      const citizenData = {
        exported_at: new Date().toISOString(),
        profile: {
          id: user?.id,
          full_name: profile?.full_name,
          email: profile?.email,
          phone: profile?.phone,
          city: profile?.city,
          area: profile?.area,
          role: profile?.role,
          created_at: profile?.created_at,
          notification_preferences: {
            email_alerts: emailAlerts,
            report_updates: reportUpdates,
            community_announcements: communityAnnouncements,
          },
        },
        reports: reports.map(r => ({
          report_id: r.report_id,
          title: r.title,
          description: r.description,
          category: r.category?.name,
          status: r.status,
          severity: r.severity,
          urgency: r.urgency,
          priority_level: r.priority_level,
          location: r.location ? {
            address: r.location.address,
            city: r.location.city,
            area: r.location.area,
            latitude: r.location.latitude,
            longitude: r.location.longitude,
          } : null,
          created_at: r.created_at,
          resolved_at: r.resolved_at,
        })),
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(citizenData, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `civicsync-my-data-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setDownloadNotice('Your data export has been downloaded.');
      setTimeout(() => setDownloadNotice(null), 4000);
    } catch (err) {
      console.error('Failed to download data', err);
    } finally {
      setDownloadingData(false);
    }
  };

  // Volunteer skill handlers
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

  // Real statistics for Community Impact
  const totalReportsCount = reports.length;
  const resolvedCount = reports.filter(r => r.status === 'resolved').length;
  const inProgressCount = reports.filter(r =>
    ['in_progress', 'assigned', 'accepted', 'under_verification', 'evidence_submitted', 'under_review'].includes(r.status)
  ).length;

  // Status badge styling helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
          </span>
        );
      case 'in_progress':
      case 'assigned':
      case 'accepted':
      case 'under_verification':
      case 'evidence_submitted':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-950/60 border border-amber-500/40 text-amber-400">
            <Clock className="w-3.5 h-3.5" /> In Progress
          </span>
        );
      case 'submitted':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-950/60 border border-blue-500/40 text-blue-400">
            <FileText className="w-3.5 h-3.5" /> Submitted
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Page Title & Subtitle */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Profile</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your account and community activity</p>
      </div>

      {/* Global Success / Notice Banners */}
      {downloadNotice && (
        <div className="p-3.5 rounded-xl bg-blue-950/60 border border-blue-500/30 text-blue-300 text-sm flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
            <span>{downloadNotice}</span>
          </div>
          <button onClick={() => setDownloadNotice(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Profile Header Card */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0b1329]/90 backdrop-blur-md p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-600/25 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-2xl flex-shrink-0 shadow-inner">
            {profile?.full_name?.charAt(0).toUpperCase() || 'D'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-white tracking-tight truncate">
                {profile?.full_name || 'Demo Citizen'}
              </h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#0f2444] text-cyan-300 border border-cyan-800/60 capitalize">
                {profile?.role || 'Citizen'}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5 truncate">{profile?.email || 'citizen@demo.local'}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleEditClick}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-700/80 bg-slate-800/60 hover:bg-slate-800 text-slate-200 hover:text-white transition-all shadow-sm self-start sm:self-center"
        >
          <Edit3 className="w-4 h-4 text-slate-300" />
          <span>Edit profile</span>
        </button>
      </div>

      {/* Main Grid: Left Column (Account Info & Preferences) + Right Column (Impact & Security) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* 2. Account Information Card */}
          <div
            ref={accountInfoCardRef}
            className="rounded-2xl border border-slate-800/90 bg-[#0b1329]/90 backdrop-blur-md p-6 shadow-xl space-y-5"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Account Information</h3>
                <p className="text-xs text-slate-400 mt-0.5">Update your personal details and location information</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Full Name */}
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    ref={fullNameInputRef}
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-slate-800/90 bg-[#060b18]/80 pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 focus:outline-none transition-all"
                    placeholder="Enter full name"
                  />
                </div>
              </div>

              {/* Email (Read-only Account Information + Change Email Action) */}
              <div className="sm:col-span-1">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">Email</label>
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(true)}
                    className="text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Change
                  </button>
                </div>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    readOnly
                    className="w-full rounded-xl border border-slate-800/60 bg-[#060b18]/50 pl-10 pr-3.5 py-2.5 text-sm text-slate-400 cursor-not-allowed focus:outline-none"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-800/90 bg-[#060b18]/80 pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 focus:outline-none transition-all"
                    placeholder="Add phone number"
                  />
                </div>
              </div>

              {/* City */}
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">City</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-xl border border-slate-800/90 bg-[#060b18]/80 pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 focus:outline-none transition-all"
                    placeholder="Enter city"
                  />
                </div>
              </div>

              {/* Area / Ward */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {profile?.role === 'volunteer' ? 'Service Area / Ward' : 'Area / Ward'}
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full rounded-xl border border-slate-800/90 bg-[#060b18]/80 pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 focus:outline-none transition-all"
                    placeholder="Enter area or ward name (e.g., Central Ward)"
                  />
                </div>
              </div>

              {/* Volunteer Bio (volunteer role only) */}
              {profile?.role === 'volunteer' && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Volunteer Bio & Background</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-slate-800/90 bg-[#060b18]/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 focus:outline-none transition-all resize-none"
                    placeholder="Describe your volunteer background, specializations, or community goals..."
                  />
                </div>
              )}
            </div>

            {/* Error / Success Feedback */}
            {saveError && (
              <div className="p-3 rounded-xl bg-destructive/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
            {saveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>Changes saved successfully</span>
              </div>
            )}

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleSaveProfile()}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 transition-all shadow-md shadow-blue-600/30"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>

          {/* 4. Account Preferences Card */}
          <div className="rounded-2xl border border-slate-800/90 bg-[#0b1329]/90 backdrop-blur-md p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Account Preferences</h3>
                <p className="text-xs text-slate-400 mt-0.5">Choose what notifications you want to receive</p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              {/* Email alerts */}
              <button
                type="button"
                onClick={() => handleTogglePreference('email')}
                className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-slate-800/40 border border-transparent hover:border-slate-800 text-left transition-colors cursor-pointer group"
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors border ${
                  emailAlerts
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-[#060b18] border-slate-700 text-transparent'
                }`}>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">Email alerts</p>
                  <p className="text-xs text-slate-400 mt-0.5">Important updates about your reports and account</p>
                </div>
              </button>

              {/* Report status updates */}
              <button
                type="button"
                onClick={() => handleTogglePreference('status')}
                className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-slate-800/40 border border-transparent hover:border-slate-800 text-left transition-colors cursor-pointer group"
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors border ${
                  reportUpdates
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-[#060b18] border-slate-700 text-transparent'
                }`}>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">Report status updates</p>
                  <p className="text-xs text-slate-400 mt-0.5">Get notified when your reported issues are updated</p>
                </div>
              </button>

              {/* Community announcements */}
              <button
                type="button"
                onClick={() => handleTogglePreference('announcements')}
                className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-slate-800/40 border border-transparent hover:border-slate-800 text-left transition-colors cursor-pointer group"
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors border ${
                  communityAnnouncements
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-[#060b18] border-slate-700 text-transparent'
                }`}>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">Community announcements</p>
                  <p className="text-xs text-slate-400 mt-0.5">Receive news and updates from your local community</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* 3. Community Impact Card */}
          <div className="rounded-2xl border border-slate-800/90 bg-[#0b1329]/90 backdrop-blur-md p-6 shadow-xl space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Community Impact</h3>
                <p className="text-xs text-slate-400 mt-0.5">Your contributions to a cleaner, safer community</p>
              </div>
            </div>

            {/* Stat tiles computed strictly from citizen's real reports */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Tile 1: Reports Submitted */}
              <div className="rounded-xl border border-slate-800/80 bg-[#060b18]/60 p-4 flex flex-col justify-between">
                <div className="w-9 h-9 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-3">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white tracking-tight">{totalReportsCount}</p>
                  <p className="text-xs font-medium text-white mt-0.5">Reports Submitted</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Issues you have reported</p>
                </div>
              </div>

              {/* Tile 2: Resolved */}
              <div className="rounded-xl border border-slate-800/80 bg-[#060b18]/60 p-4 flex flex-col justify-between">
                <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white tracking-tight">{resolvedCount}</p>
                  <p className="text-xs font-medium text-white mt-0.5">Resolved</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Issues marked as resolved</p>
                </div>
              </div>

              {/* Tile 3: In Progress */}
              <div className="rounded-xl border border-slate-800/80 bg-[#060b18]/60 p-4 flex flex-col justify-between">
                <div className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-3">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white tracking-tight">{inProgressCount}</p>
                  <p className="text-xs font-medium text-white mt-0.5">In Progress</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Issues currently in progress</p>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Privacy & Security Card */}
          <div className="rounded-2xl border border-slate-800/90 bg-[#0b1329]/90 backdrop-blur-md p-6 shadow-xl space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Privacy & Security</h3>
                <p className="text-xs text-slate-400 mt-0.5">Manage your account security and data</p>
              </div>
            </div>

            <div className="space-y-4 pt-1">
              {/* Change Password row */}
              <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-slate-800/60 bg-[#060b18]/40">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center flex-shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Change Password</p>
                    <p className="text-xs text-slate-400 mt-0.5">Update your password regularly</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(true)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium transition-all shadow-sm flex-shrink-0"
                >
                  Change Password
                </button>
              </div>

              {/* Download My Data row */}
              <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-slate-800/60 bg-[#060b18]/40">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center flex-shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Download My Data</p>
                    <p className="text-xs text-slate-400 mt-0.5">Get a copy of your account data</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadMyData}
                  disabled={downloadingData}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium transition-all shadow-sm flex-shrink-0 disabled:opacity-50"
                >
                  {downloadingData ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>{downloadingData ? 'Exporting...' : 'Download'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Recent Activity Section */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0b1329]/90 backdrop-blur-md p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Recent Activity</h3>
              <p className="text-xs text-slate-400 mt-0.5">Your latest reports and community engagement</p>
            </div>
          </div>

          <Link
            to="/app/citizen/reports"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            <span>View all activity</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Content States: Loading, Error, Empty, List */}
        {reportsLoading ? (
          <div className="py-8">
            <LoadingState message="Loading recent activity..." />
          </div>
        ) : reportsError ? (
          <div className="py-4">
            <ErrorState message={reportsError} onRetry={loadReports} />
          </div>
        ) : reports.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-800 rounded-xl p-6">
            <EmptyState
              icon={<FileText className="w-8 h-8 text-slate-500" />}
              title="No reports submitted yet"
              description="When you report civic issues in your neighborhood, they will appear here."
              action={
                <Link to="/app/citizen/report" className="btn-primary text-xs mt-3">
                  <Plus className="w-3.5 h-3.5" /> Report an Issue
                </Link>
              }
            />
          </div>
        ) : (
          <div className="space-y-2.5 pt-1">
            {reports.slice(0, 5).map((report) => (
              <div
                key={report.id}
                onClick={() => navigate(`/app/reports/${report.id}`)}
                className="group flex items-center justify-between p-3.5 rounded-xl border border-slate-800/60 bg-[#060b18]/40 hover:bg-slate-800/50 hover:border-slate-700/80 transition-all cursor-pointer gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Thumbnail / Icon */}
                  <div className="w-14 h-12 rounded-lg overflow-hidden bg-slate-800 border border-slate-700/80 flex items-center justify-center flex-shrink-0">
                    {report.media && report.media.length > 0 && report.media[0].file_type === 'image' ? (
                      <img
                        src={report.media[0].file_url}
                        alt={report.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-slate-400">
                        <FileText className="w-5 h-5 text-blue-400" />
                      </div>
                    )}
                  </div>

                  {/* Title & Metadata */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors truncate">
                      {report.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                      <div className="flex items-center gap-1 truncate max-w-[220px] sm:max-w-xs">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span className="truncate">
                          {report.location?.area || report.location?.city || report.location?.address || 'Community Area'}
                        </span>
                      </div>
                      <span className="text-slate-600">&bull;</span>
                      <span className="flex-shrink-0">{formatDate(report.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Status Badge + Arrow */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {getStatusBadge(report.status)}
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Volunteer Skills Section (only displayed if volunteer role to keep existing capabilities intact) */}
      {profile?.role === 'volunteer' && (
        <div className="rounded-2xl border border-slate-800/90 bg-[#0b1329]/90 backdrop-blur-md p-6 shadow-xl space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Star className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Volunteer Skills & Service</h3>
              <p className="text-xs text-slate-400 mt-0.5">Manage skills used for matching with community tasks</p>
            </div>
          </div>

          <div className="space-y-4 pt-1">
            {volunteer?.skills && volunteer.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {volunteer.skills.map(s => (
                  <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#060b18] border border-slate-800">
                    <span className="text-sm text-slate-300">{s.skill}</span>
                    <span className="text-xs text-slate-500 capitalize">({s.proficiency})</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(s.id)}
                      className="text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No skills added yet.</p>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                className="input flex-1 bg-[#060b18] border-slate-800"
                placeholder="e.g., Electrical, Plumbing, First Aid, Waste Management"
              />
              <select
                value={newProficiency}
                onChange={(e) => setNewProficiency(e.target.value)}
                className="input sm:w-40 bg-[#060b18] border-slate-800 text-white"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
              </select>
              <button
                type="button"
                onClick={handleAddSkill}
                disabled={!newSkill.trim()}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" /> Add Skill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0b1329] p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => { setShowPasswordModal(false); setPasswordError(null); }}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Change Password</h3>
                <p className="text-xs text-slate-400">Update your account login password</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showPasswordText ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-800 bg-[#060b18] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none pr-10"
                    placeholder="Enter at least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordText(!showPasswordText)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Confirm New Password</label>
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-800 bg-[#060b18] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  placeholder="Re-enter your new password"
                />
              </div>

              {passwordError && (
                <div className="p-3 rounded-xl bg-destructive/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>Password updated successfully!</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="btn-primary text-xs"
                >
                  {passwordSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{passwordSaving ? 'Updating...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0b1329] p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => { setShowEmailModal(false); setEmailError(null); }}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Change Email Address</h3>
                <p className="text-xs text-slate-400">Current email: {profile?.email}</p>
              </div>
            </div>

            <form onSubmit={handleChangeEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">New Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-800 bg-[#060b18] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  placeholder="Enter new email address"
                />
              </div>

              {emailError && (
                <div className="p-3 rounded-xl bg-destructive/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{emailError}</span>
                </div>
              )}

              {emailSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>
                    {demoMode
                      ? 'Email updated successfully!'
                      : 'Confirmation email sent. Please check your inbox to confirm the change.'}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emailSaving}
                  className="btn-primary text-xs"
                >
                  {emailSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{emailSaving ? 'Sending...' : 'Update Email'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
