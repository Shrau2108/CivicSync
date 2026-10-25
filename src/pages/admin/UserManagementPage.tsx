import { useCallback, useEffect, useState } from 'react';
import {
  BriefcaseBusiness,
  CheckCircle2,
  Crown,
  Eye,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  X,
  Star,
  Award,
  Check,
  Ban,
  Loader2,
  BarChart3,
  UserMinus,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { RoleBadge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import {
  createAuditLog,
  fetchAllProfiles,
  fetchVolunteerByUserId,
  inviteAdminUser,
  updateProfile,
  updateUserActiveStatus,
  revokeVolunteerAccess,
  grantVolunteerAccess,
  revokeAnalystAccess,
} from '@/services/api';
import { formatDate } from '@/lib/utils';
import type { Profile, UserRole, Volunteer } from '@/types';

const roleOptions: { role: UserRole; label: string; description: string; icon: typeof Users }[] = [
  { role: 'citizen', label: 'Citizen', description: 'Submit reports and follow local issues.', icon: Users },
  { role: 'volunteer', label: 'Volunteer', description: 'Request assignments and complete community tasks.', icon: BriefcaseBusiness },
  { role: 'supervisor', label: 'Supervisor', description: 'Review reports, assignments, and submitted evidence.', icon: ShieldCheck },
  { role: 'analyst', label: 'Analyst', description: 'Analyze incident patterns, metrics, and spatial reports.', icon: BarChart3 },
  { role: 'admin', label: 'Administrator', description: 'Manage users, settings, and all operations.', icon: Crown },
];

const initialInvite = { fullName: '', email: '', phone: '', role: 'volunteer' as UserRole };

export function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

  // Invitation state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState(initialInvite);
  const [inviting, setInviting] = useState(false);

  // Role modification state
  const [roleModal, setRoleModal] = useState<Profile | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('citizen');
  const [savingRole, setSavingRole] = useState(false);

  // User inspection state
  const [inspectUser, setInspectUser] = useState<Profile | null>(null);
  const [inspectVolunteer, setInspectVolunteer] = useState<Volunteer | null>(null);
  const [loadingVolunteer, setLoadingVolunteer] = useState(false);

  // Status toggle confirmation
  const [statusConfirmUser, setStatusConfirmUser] = useState<Profile | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Revoke volunteer confirmation
  const [revokeVolunteerModal, setRevokeVolunteerModal] = useState<Profile | null>(null);
  const [revokingVolunteer, setRevokingVolunteer] = useState(false);

  // Revoke analyst confirmation
  const [revokeAnalystModal, setRevokeAnalystModal] = useState<Profile | null>(null);
  const [revokingAnalyst, setRevokingAnalyst] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfiles(await fetchAllProfiles());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Load volunteer details when inspecting a user
  useEffect(() => {
    if (!inspectUser) {
      setInspectVolunteer(null);
      return;
    }
    if (inspectUser.role === 'volunteer') {
      let isMounted = true;
      setLoadingVolunteer(true);
      fetchVolunteerByUserId(inspectUser.id)
        .then((vol) => {
          if (isMounted) setInspectVolunteer(vol);
        })
        .catch((err) => {
          console.warn('Could not fetch volunteer details for user:', err);
        })
        .finally(() => {
          if (isMounted) setLoadingVolunteer(false);
        });
      return () => {
        isMounted = false;
      };
    } else {
      setInspectVolunteer(null);
      setLoadingVolunteer(false);
    }
  }, [inspectUser]);

  const roleCounts = roleOptions.map((item) => ({
    ...item,
    count: profiles.filter((profile) => profile.role === item.role).length,
  }));

  const filteredProfiles = profiles.filter((profile) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      `${profile.full_name} ${profile.email} ${profile.phone || ''} ${profile.city || ''} ${profile.area || ''}`
        .toLowerCase()
        .includes(query);
    return matchesSearch && (roleFilter === 'all' || profile.role === roleFilter);
  });

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);
    setSuccess(null);
    setInviting(true);
    try {
      const profile = await inviteAdminUser({
        fullName: invite.fullName,
        email: invite.email,
        phone: invite.phone || undefined,
        role: invite.role,
      });
      setProfiles((current) => [profile, ...current.filter((item) => item.id !== profile.id)]);
      setSuccess(`Invitation created successfully for ${profile.email} with the ${profile.role} role.`);
      setInvite(initialInvite);
      setInviteOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not create the user invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async () => {
    if (!currentUser || !roleModal) return;
    setSavingRole(true);
    setActionError(null);
    setSuccess(null);
    try {
      await updateProfile(roleModal.id, { role: newRole });
      setProfiles((current) =>
        current.map((profile) => (profile.id === roleModal.id ? { ...profile, role: newRole } : profile))
      );
      if (inspectUser && inspectUser.id === roleModal.id) {
        setInspectUser({ ...inspectUser, role: newRole });
      }
      try {
        await createAuditLog({
          action: 'change_user_role',
          entity_type: 'profile',
          entity_id: roleModal.id,
          details: {
            target_name: roleModal.full_name,
            target_email: roleModal.email,
            from: roleModal.role,
            to: newRole,
          },
        });
      } catch (auditError) {
        console.error('Role updated but its audit event could not be saved.', auditError);
      }
      setSuccess(`${roleModal.full_name}'s role is now ${newRole}.`);
      setRoleModal(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setSavingRole(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!statusConfirmUser) return;
    const target = statusConfirmUser;
    const nextStatus = !target.is_active;
    setUpdatingStatus(true);
    setActionError(null);
    setSuccess(null);
    try {
      await updateUserActiveStatus(target.id, nextStatus);
      setProfiles((current) =>
        current.map((p) => (p.id === target.id ? { ...p, is_active: nextStatus } : p))
      );
      if (inspectUser && inspectUser.id === target.id) {
        setInspectUser({ ...inspectUser, is_active: nextStatus });
      }
      try {
        await createAuditLog({
          action: nextStatus ? 'activate_user' : 'deactivate_user',
          entity_type: 'profile',
          entity_id: target.id,
          details: {
            target_name: target.full_name,
            target_email: target.email,
            target_role: target.role,
            is_active: nextStatus,
          },
        });
      } catch (auditErr) {
        console.warn('Status audit log save error:', auditErr);
      }
      setSuccess(`Account for ${target.full_name} is now ${nextStatus ? 'active' : 'deactivated'}.`);
      setStatusConfirmUser(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update account status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleConfirmRevokeVolunteer = async () => {
    if (!revokeVolunteerModal) return;
    const target = revokeVolunteerModal;
    setRevokingVolunteer(true);
    setActionError(null);
    setSuccess(null);
    try {
      await revokeVolunteerAccess(target.id, inspectVolunteer?.id);
      setProfiles((current) =>
        current.map((p) => (p.id === target.id ? { ...p, role: 'citizen' } : p))
      );
      if (inspectUser && inspectUser.id === target.id) {
        setInspectUser({ ...inspectUser, role: 'citizen' });
      }
      setSuccess(`Volunteer access revoked for ${target.full_name}. Role has been changed to Citizen.`);
      setRevokeVolunteerModal(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to revoke volunteer access');
    } finally {
      setRevokingVolunteer(false);
    }
  };

  const handleConfirmRevokeAnalyst = async () => {
    if (!revokeAnalystModal) return;
    const target = revokeAnalystModal;
    setRevokingAnalyst(true);
    setActionError(null);
    setSuccess(null);
    try {
      await revokeAnalystAccess(target.id);
      setProfiles((current) =>
        current.map((p) => (p.id === target.id ? { ...p, role: 'citizen' } : p))
      );
      if (inspectUser && inspectUser.id === target.id) {
        setInspectUser({ ...inspectUser, role: 'citizen' });
      }
      setSuccess(`Analyst access revoked for ${target.full_name}. Role has been changed to Citizen.`);
      setRevokeAnalystModal(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to revoke analyst access');
    } finally {
      setRevokingAnalyst(false);
    }
  };

  const handleGrantVolunteer = async (target: Profile) => {
    setActionError(null);
    setSuccess(null);
    try {
      await grantVolunteerAccess(target.id, inspectVolunteer?.id);
      setProfiles((current) =>
        current.map((p) => (p.id === target.id ? { ...p, role: 'volunteer' } : p))
      );
      if (inspectUser && inspectUser.id === target.id) {
        setInspectUser({ ...inspectUser, role: 'volunteer' });
      }
      setSuccess(`Volunteer access granted and verified for ${target.full_name}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to grant volunteer access');
    }
  };

  if (loading) return <LoadingState message="Loading user directory..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="min-w-0 space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950 px-5 py-6 shadow-soft sm:px-7">
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-sky-300">CivicSync administration</p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">People &amp; access</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Create invited volunteer, supervisor, and citizen accounts, inspect profiles, and manage access roles.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setActionError(null);
              setInviteOpen(true);
            }}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-300"
          >
            <UserPlus className="h-4 w-4" /> Invite a person
          </button>
        </div>
      </header>

      {actionError && (
        <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-800"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </p>
      )}

      <section aria-label="Users by role" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {roleCounts.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.role}
              type="button"
              onClick={() => setRoleFilter(roleFilter === item.role ? 'all' : item.role)}
              className={`min-w-0 rounded-xl border bg-card p-4 text-left shadow-soft transition-colors hover:border-primary/40 ${
                roleFilter === item.role ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-muted-foreground">{item.label}s</span>
                <Icon className="h-4 w-4 shrink-0 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{item.count}</p>
            </button>
          );
        })}
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-semibold text-foreground">User directory</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {filteredProfiles.length} of {profiles.length} profiles
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:w-[min(100%,32rem)] sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="input pl-10"
                placeholder="Search people by name, email, phone, city..."
                aria-label="Search users"
              />
            </label>
            <select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as UserRole | 'all')}
              className="input sm:w-40"
            >
              <option value="all">All roles</option>
              {roleOptions.map((item) => (
                <option key={item.role} value={item.role}>
                  {item.label}s
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredProfiles.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title={profiles.length ? 'No people match these filters' : 'No profiles yet'}
            description={
              profiles.length
                ? 'Clear the search or choose another role.'
                : 'Invite a person to create the first profile.'
            }
          />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(180px,1fr)_120px_110px_180px] gap-4 border-b border-border bg-muted/30 px-5 py-3 text-[11px] font-semibold uppercase text-muted-foreground lg:grid">
              <span>Person</span>
              <span>Contact &amp; Location</span>
              <span>Role</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-border">
              {filteredProfiles.map((profile) => {
                const initials =
                  profile.full_name
                    .trim()
                    .split(/\s+/)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || '?';
                return (
                  <article
                    key={profile.id}
                    className="grid min-w-0 grid-cols-1 gap-3 px-4 py-4 transition-colors hover:bg-muted/20 lg:grid-cols-[minmax(0,1.4fr)_minmax(180px,1fr)_120px_110px_180px] lg:items-center lg:gap-4 lg:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sky-400/20 bg-sky-400/10 text-xs font-semibold text-sky-700">
                        {initials}
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {profile.full_name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          ID · {profile.id.slice(0, 8)}
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 space-y-1 pl-[52px] lg:pl-0">
                      <span className="flex min-w-0 items-center gap-1.5 truncate text-sm text-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {profile.email}
                      </span>
                      {profile.phone && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          {profile.phone}
                        </span>
                      )}
                      {(profile.city || profile.area) && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          {[profile.area, profile.city].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>

                    <div className="pl-[52px] lg:pl-0">
                      <RoleBadge role={profile.role} />
                    </div>

                    <div className="flex items-center gap-1.5 pl-[52px] lg:pl-0">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                          profile.is_active
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            profile.is_active ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        {profile.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pl-[52px] lg:justify-end lg:pl-0">
                      <button
                        type="button"
                        onClick={() => setInspectUser(profile)}
                        className="btn-secondary px-2.5 py-1.5 text-xs"
                        title="Inspect person's profile and details"
                      >
                        <Eye className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" /> Details
                      </button>

                      {profile.id !== currentUser?.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setRoleModal(profile);
                            setNewRole(profile.role);
                          }}
                          className="btn-secondary px-2.5 py-1.5 text-xs"
                          aria-label={`Change role for ${profile.full_name}`}
                          title="Change user role"
                        >
                          <UserCog className="h-3.5 w-3.5" /> Role
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Profile Inspection Modal */}
      <Modal
        open={!!inspectUser}
        onClose={() => setInspectUser(null)}
        title="Person Profile Details"
        size="lg"
      >
        {inspectUser && (
          <div className="space-y-6 p-6">
            {/* Header info */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-sky-400/30 bg-sky-400/15 text-lg font-bold text-sky-600 dark:text-sky-400">
                  {inspectUser.full_name
                    .trim()
                    .split(/\s+/)
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || '?'}
                </span>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{inspectUser.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{inspectUser.email}</p>
                  <p className="mt-1 font-mono text-xs text-slate-400">ID: {inspectUser.id}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RoleBadge role={inspectUser.role} />
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                    inspectUser.is_active
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      inspectUser.is_active ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  {inspectUser.is_active ? 'Active Account' : 'Inactive Account'}
                </span>
              </div>
            </div>

            {/* Profile fields grid */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Profile Information
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-xl border border-border bg-muted/20 p-4">
                <div>
                  <span className="block text-xs font-medium text-muted-foreground">Full Name</span>
                  <span className="mt-0.5 block text-sm font-semibold text-foreground">
                    {inspectUser.full_name}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-muted-foreground">Email Address</span>
                  <span className="mt-0.5 block text-sm font-semibold text-foreground">
                    {inspectUser.email}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-muted-foreground">Phone Number</span>
                  <span className="mt-0.5 block text-sm font-semibold text-foreground">
                    {inspectUser.phone || 'Not provided'}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-muted-foreground">City &amp; Area</span>
                  <span className="mt-0.5 block text-sm font-semibold text-foreground">
                    {[inspectUser.area, inspectUser.city].filter(Boolean).join(', ') || 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-muted-foreground">Registered Date</span>
                  <span className="mt-0.5 block text-sm text-foreground">
                    {formatDate(inspectUser.created_at)}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-muted-foreground">Last Profile Update</span>
                  <span className="mt-0.5 block text-sm text-foreground">
                    {formatDate(inspectUser.updated_at)}
                  </span>
                </div>
              </div>
            </div>

            {/* Notification preferences */}
            {inspectUser.notification_preferences && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Notification Preferences
                </h4>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium border ${
                      inspectUser.notification_preferences.email_alerts
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'border-border bg-muted text-muted-foreground'
                    }`}
                  >
                    {inspectUser.notification_preferences.email_alerts ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    Email Alerts
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium border ${
                      inspectUser.notification_preferences.report_updates
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'border-border bg-muted text-muted-foreground'
                    }`}
                  >
                    {inspectUser.notification_preferences.report_updates ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    Report Updates
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium border ${
                      inspectUser.notification_preferences.community_announcements
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'border-border bg-muted text-muted-foreground'
                    }`}
                  >
                    {inspectUser.notification_preferences.community_announcements ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    Community Announcements
                  </span>
                </div>
              </div>
            )}

            {/* Volunteer Specific Details */}
            {inspectUser.role === 'volunteer' && (
              <div className="space-y-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-sky-700 dark:text-sky-300">
                    <Award className="h-4 w-4" /> Volunteer Specific Record
                  </h4>
                  {loadingVolunteer && <Loader2 className="h-4 w-4 animate-spin text-sky-500" />}
                </div>

                {inspectVolunteer ? (
                  <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-lg border border-border bg-card p-3">
                        <span className="block text-xs text-muted-foreground">Verification</span>
                        <span className="mt-1 block font-semibold capitalize text-foreground">
                          {inspectVolunteer.verification_status}
                        </span>
                      </div>
                      <div className="rounded-lg border border-border bg-card p-3">
                        <span className="block text-xs text-muted-foreground">Workload</span>
                        <span className="mt-1 block font-semibold text-foreground">
                          {inspectVolunteer.current_workload} / {inspectVolunteer.max_workload} tasks
                        </span>
                      </div>
                      <div className="rounded-lg border border-border bg-card p-3">
                        <span className="block text-xs text-muted-foreground">Completed</span>
                        <span className="mt-1 block font-semibold text-foreground">
                          {inspectVolunteer.completed_tasks} tasks
                        </span>
                      </div>
                      <div className="rounded-lg border border-border bg-card p-3">
                        <span className="block text-xs text-muted-foreground">Rating</span>
                        <span className="mt-1 flex items-center gap-1 font-semibold text-foreground">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {inspectVolunteer.rating?.toFixed(1) || '5.0'} ({inspectVolunteer.total_ratings || 0})
                        </span>
                      </div>
                    </div>

                    {inspectVolunteer.service_area && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Service Area: </span>
                        <span className="font-semibold text-foreground">{inspectVolunteer.service_area}</span>
                      </div>
                    )}

                    {inspectVolunteer.bio && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Bio: </span>
                        <p className="mt-1 rounded-md border border-border bg-card p-2 text-xs text-muted-foreground">
                          {inspectVolunteer.bio}
                        </p>
                      </div>
                    )}

                    {inspectVolunteer.skills && inspectVolunteer.skills.length > 0 && (
                      <div>
                        <span className="block text-xs font-medium text-muted-foreground mb-1.5">Skills:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {inspectVolunteer.skills.map((s) => (
                            <span
                              key={s.id}
                              className="rounded-md border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-xs font-medium text-sky-800 dark:text-sky-300"
                            >
                              {s.skill} ({s.proficiency})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {inspectVolunteer.availability && inspectVolunteer.availability.length > 0 && (
                      <div>
                        <span className="block text-xs font-medium text-muted-foreground mb-1.5">
                          Availability:
                        </span>
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 text-xs">
                          {inspectVolunteer.availability.map((avail) => (
                            <div key={avail.id} className="rounded border border-border bg-card p-1.5">
                              <span className="font-semibold uppercase text-foreground">{avail.day_of_week}</span>
                              <span className="block text-muted-foreground">
                                {avail.start_time} - {avail.end_time}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {loadingVolunteer
                      ? 'Fetching volunteer details...'
                      : 'No additional volunteer record registered for this account.'}
                  </p>
                )}
              </div>
            )}

            {/* Administrator action footer inside inspection modal */}
            {inspectUser.id !== currentUser?.id && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRoleModal(inspectUser);
                      setNewRole(inspectUser.role);
                    }}
                    className="btn-secondary text-xs"
                  >
                    <UserCog className="h-3.5 w-3.5" /> Modify Role
                  </button>

                  {inspectUser.role === 'volunteer' && (
                    <button
                      type="button"
                      onClick={() => setRevokeVolunteerModal(inspectUser)}
                      className="btn-secondary text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-500/20"
                      title="Revoke volunteer access and demote to Citizen"
                    >
                      <UserMinus className="h-3.5 w-3.5" /> Revoke Volunteer Access
                    </button>
                  )}

                  {inspectUser.role === 'analyst' && (
                    <button
                      type="button"
                      onClick={() => setRevokeAnalystModal(inspectUser)}
                      className="btn-secondary text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-500/20"
                      title="Revoke analyst access and demote to Citizen"
                    >
                      <UserMinus className="h-3.5 w-3.5" /> Revoke Analyst Access
                    </button>
                  )}

                  {inspectUser.role === 'citizen' && inspectVolunteer && (
                    <button
                      type="button"
                      onClick={() => handleGrantVolunteer(inspectUser)}
                      className="btn-secondary text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/20"
                      title="Grant volunteer access and verify volunteer profile"
                    >
                      <Award className="h-3.5 w-3.5" /> Grant Volunteer Access
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setStatusConfirmUser(inspectUser)}
                    className={`btn-secondary text-xs ${
                      inspectUser.is_active ? 'text-rose-600 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-700'
                    }`}
                  >
                    {inspectUser.is_active ? (
                      <>
                        <Ban className="h-3.5 w-3.5" /> Deactivate Account
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-3.5 w-3.5" /> Activate Account
                      </>
                    )}
                  </button>
                </div>
                <button type="button" onClick={() => setInspectUser(null)} className="btn-secondary text-xs">
                  Close
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Invite user modal */}
      <Modal
        open={inviteOpen}
        onClose={() => {
          if (!inviting) {
            setInviteOpen(false);
            setActionError(null);
          }
        }}
        title="Invite a New Person"
        size="md"
      >
        <form onSubmit={handleInvite} className="space-y-5 p-5">
          <p className="text-sm text-muted-foreground">
            Create and invite an account for a volunteer, supervisor, citizen, or administrator.
            The account is pre-provisioned with the selected role immediately.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="label">Full name</span>
              <input
                autoFocus
                required
                minLength={2}
                maxLength={100}
                value={invite.fullName}
                onChange={(event) => setInvite((current) => ({ ...current, fullName: event.target.value }))}
                className="input"
                autoComplete="name"
                placeholder="e.g. Priya Sharma"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">Email address</span>
              <input
                required
                type="email"
                maxLength={254}
                value={invite.email}
                onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))}
                className="input"
                autoComplete="email"
                placeholder="priya.sharma@example.com"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">
                Phone <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <input
                type="tel"
                maxLength={32}
                value={invite.phone}
                onChange={(event) => setInvite((current) => ({ ...current, phone: event.target.value }))}
                className="input"
                autoComplete="tel"
                placeholder="+91 98765 43210"
              />
            </label>
          </div>

          <fieldset>
            <legend className="label mb-2">Select Account Role</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {roleOptions.map((option) => {
                const Icon = option.icon;
                const selected = invite.role === option.role;
                return (
                  <label
                    key={option.role}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      selected
                        ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={option.role}
                      checked={selected}
                      onChange={() => setInvite((current) => ({ ...current, role: option.role }))}
                      className="sr-only"
                    />
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {invite.role === 'admin' && (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
              Administrator access grants sensitive permissions including user creation and system configuration.
            </p>
          )}

          {actionError && (
            <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {actionError}
            </p>
          )}

          <div className="flex flex-col-reverse justify-end gap-2 border-t border-border pt-4 sm:flex-row">
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              disabled={inviting}
              className="btn-secondary"
            >
              <X className="h-4 w-4" /> Cancel
            </button>
            <button
              type="submit"
              disabled={inviting}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mail className="h-4 w-4" />
              {inviting ? 'Creating invitation...' : 'Create Account & Send Invite'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Role Change Modal */}
      <ConfirmDialog
        open={!!roleModal}
        onClose={() => setRoleModal(null)}
        onConfirm={handleRoleChange}
        title="Update Access Role"
        message={roleModal ? `Select the CivicSync access level for ${roleModal.full_name}.` : ''}
        confirmLabel={savingRole ? 'Saving...' : 'Save role'}
      >
        <div className="p-5">
          <label className="label" htmlFor="managed-user-role">
            Role
          </label>
          <select
            id="managed-user-role"
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as UserRole)}
            className="input"
          >
            {roleOptions.map((option) => (
              <option key={option.role} value={option.role}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">
            Role changes take effect immediately on the user’s next request.
          </p>
        </div>
      </ConfirmDialog>

      {/* Account Activation/Deactivation Dialog */}
      <ConfirmDialog
        open={!!statusConfirmUser}
        onClose={() => setStatusConfirmUser(null)}
        onConfirm={handleToggleStatus}
        title={statusConfirmUser?.is_active ? 'Deactivate Account' : 'Activate Account'}
        message={
          statusConfirmUser
            ? statusConfirmUser.is_active
              ? `Are you sure you want to deactivate ${statusConfirmUser.full_name}'s account? They will lose access to administrative functions until reactivated.`
              : `Are you sure you want to reactivate ${statusConfirmUser.full_name}'s account?`
            : ''
        }
        confirmLabel={updatingStatus ? 'Updating...' : statusConfirmUser?.is_active ? 'Deactivate' : 'Activate'}
        danger={statusConfirmUser?.is_active}
      />

      {/* Revoke Volunteer Confirmation Dialog */}
      <ConfirmDialog
        open={!!revokeVolunteerModal}
        onClose={() => setRevokeVolunteerModal(null)}
        onConfirm={handleConfirmRevokeVolunteer}
        title="Revoke Volunteer Access"
        message={
          revokeVolunteerModal
            ? `Revoke volunteer privileges for ${revokeVolunteerModal.full_name}? Their role will be changed to Citizen and they will no longer be eligible to accept or perform tasks. Their past completed tasks remain safe.`
            : ''
        }
        confirmLabel={revokingVolunteer ? 'Revoking...' : 'Revoke Volunteer Access'}
        danger={true}
      />

      {/* Revoke Analyst Confirmation Dialog */}
      <ConfirmDialog
        open={!!revokeAnalystModal}
        onClose={() => setRevokeAnalystModal(null)}
        onConfirm={handleConfirmRevokeAnalyst}
        title="Revoke Analyst Access"
        message={
          revokeAnalystModal
            ? `Revoke analyst privileges for ${revokeAnalystModal.full_name}? Their role will be changed to Citizen and they will lose access to administrative analytics.`
            : ''
        }
        confirmLabel={revokingAnalyst ? 'Revoking...' : 'Revoke Analyst Access'}
        danger={true}
      />
    </div>
  );
}