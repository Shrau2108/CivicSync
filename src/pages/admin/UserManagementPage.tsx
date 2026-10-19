import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Crown, Mail, Phone, Search, ShieldCheck, UserCog, UserPlus, Users, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { RoleBadge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { adminInvitesAvailable, createAuditLog, fetchAllProfiles, inviteAdminUser, updateProfile } from '@/services/api';
import { formatDate } from '@/lib/utils';
import type { Profile, UserRole } from '@/types';

const roleOptions: { role: UserRole; label: string; description: string; icon: typeof Users }[] = [
  { role: 'citizen', label: 'Citizen', description: 'Submit reports and follow local issues.', icon: Users },
  { role: 'volunteer', label: 'Volunteer', description: 'Request assignments and complete community tasks.', icon: BriefcaseBusiness },
  { role: 'supervisor', label: 'Supervisor', description: 'Review reports, assignments, and submitted evidence.', icon: ShieldCheck },
  { role: 'admin', label: 'Administrator', description: 'Manage users, settings, and all operations.', icon: Crown },
];

const initialInvite = { fullName: '', email: '', phone: '', role: 'citizen' as UserRole };

export function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState(initialInvite);
  const [inviting, setInviting] = useState(false);
  const [roleModal, setRoleModal] = useState<Profile | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('citizen');
  const [savingRole, setSavingRole] = useState(false);

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

  const roleCounts = roleOptions.map((item) => ({
    ...item,
    count: profiles.filter((profile) => profile.role === item.role).length,
  }));
  const filteredProfiles = profiles.filter((profile) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${profile.full_name} ${profile.email} ${profile.phone || ''}`.toLowerCase().includes(query);
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
      setSuccess(`Invitation sent to ${profile.email} with the ${profile.role} role.`);
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
      setProfiles((current) => current.map((profile) => profile.id === roleModal.id ? { ...profile, role: newRole } : profile));
      try {
        await createAuditLog({
          action: 'change_user_role',
          entity_type: 'profile',
          entity_id: roleModal.id,
          details: { from: roleModal.role, to: newRole },
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

  if (loading) return <LoadingState message="Loading user directory..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="min-w-0 space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950 px-5 py-6 shadow-soft sm:px-7">
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-sky-300">CivicSync administration</p>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">People &amp; access</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">Create invited profiles, assign a role, and keep access aligned with each person’s responsibilities.</p>
          </div>
          <button type="button" onClick={() => { setActionError(null); setInviteOpen(true); }} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-300">
            <UserPlus className="h-4 w-4" /> Invite a person
          </button>
        </div>
      </header>

      {!adminInvitesAvailable() && (
        <div role="status" className="flex flex-col gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-800">Account creation and role changes require a connected Supabase project. Deploy the secure admin-invite-user function to enable invitations.</p>
          <button type="button" onClick={() => setInviteOpen(true)} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-amber-900 hover:underline">Preview form <ArrowRight className="h-4 w-4" /></button>
        </div>
      )}

      {actionError && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{actionError}</p>}
      {success && <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" />{success}</p>}

      <section aria-label="Users by role" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {roleCounts.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.role} type="button" onClick={() => setRoleFilter(roleFilter === item.role ? 'all' : item.role)} className={`min-w-0 rounded-xl border bg-card p-4 text-left shadow-soft transition-colors hover:border-primary/40 ${roleFilter === item.role ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border'}`}>
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
            <p className="mt-1 text-xs text-muted-foreground">{filteredProfiles.length} of {profiles.length} profiles</p>
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:w-[min(100%,32rem)] sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="input pl-10" placeholder="Search people..." aria-label="Search users" />
            </label>
            <select aria-label="Filter by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as UserRole | 'all')} className="input sm:w-40">
              <option value="all">All roles</option>
              {roleOptions.map((item) => <option key={item.role} value={item.role}>{item.label}s</option>)}
            </select>
          </div>
        </div>

        {filteredProfiles.length === 0 ? (
          <EmptyState icon={<Users className="h-8 w-8" />} title={profiles.length ? 'No people match these filters' : 'No profiles yet'} description={profiles.length ? 'Clear the search or choose another role.' : 'Invite a person to create the first profile.'} />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(180px,1fr)_140px_130px_120px] gap-4 border-b border-border bg-muted/30 px-5 py-3 text-[11px] font-semibold uppercase text-muted-foreground lg:grid">
              <span>Person</span><span>Contact</span><span>Role</span><span>Joined</span><span className="text-right">Access</span>
            </div>
            <div className="divide-y divide-border">
              {filteredProfiles.map((profile) => {
                const initials = profile.full_name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || '?';
                return (
                  <article key={profile.id} className="grid min-w-0 grid-cols-1 gap-3 px-4 py-4 transition-colors hover:bg-muted/20 lg:grid-cols-[minmax(0,1.5fr)_minmax(180px,1fr)_140px_130px_120px] lg:items-center lg:gap-4 lg:px-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sky-400/20 bg-sky-400/10 text-xs font-semibold text-sky-700">{initials}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">{profile.full_name}</span>
                        <span className="block truncate text-xs text-muted-foreground">ID · {profile.id.slice(0, 8)}</span>
                      </span>
                    </div>
                    <div className="min-w-0 space-y-1 pl-[52px] lg:pl-0">
                      <span className="flex min-w-0 items-center gap-1.5 truncate text-sm text-foreground"><Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />{profile.email}</span>
                      {profile.phone && <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="h-3.5 w-3.5" />{profile.phone}</span>}
                    </div>
                    <div className="pl-[52px] lg:pl-0"><RoleBadge role={profile.role} /></div>
                    <span className="pl-[52px] text-xs text-muted-foreground lg:pl-0">Joined {formatDate(profile.created_at)}</span>
                    <div className="flex items-center gap-2 pl-[52px] lg:justify-end lg:pl-0">
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${profile.is_active ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700' : 'border-border bg-muted text-muted-foreground'}`}>{profile.is_active ? 'Active' : 'Inactive'}</span>
                      {profile.id !== currentUser?.id && (
                        <button type="button" onClick={() => { setActionError(null); setRoleModal(profile); setNewRole(profile.role); }} disabled={!adminInvitesAvailable()} title={adminInvitesAvailable() ? 'Change user role' : 'Connect Supabase to change roles'} className="btn-secondary px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Change role for ${profile.full_name}`}>
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

      <Modal open={inviteOpen} onClose={() => { if (!inviting) { setInviteOpen(false); setActionError(null); } }} title="Create a profile" size="md">
        <form onSubmit={handleInvite} className="space-y-5 p-5">
          <p className="text-sm text-muted-foreground">An invitation email will let the person securely set up their account. Their selected role is applied before they first sign in.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="label">Full name</span>
              <input autoFocus required minLength={2} maxLength={100} value={invite.fullName} onChange={(event) => setInvite((current) => ({ ...current, fullName: event.target.value }))} className="input" autoComplete="name" placeholder="e.g. Jordan Lee" />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">Email address</span>
              <input required type="email" maxLength={254} value={invite.email} onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))} className="input" autoComplete="email" placeholder="name@example.com" />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">Phone <span className="font-normal text-muted-foreground">(optional)</span></span>
              <input type="tel" maxLength={32} value={invite.phone} onChange={(event) => setInvite((current) => ({ ...current, phone: event.target.value }))} className="input" autoComplete="tel" placeholder="+1 555 010 0123" />
            </label>
          </div>
          <fieldset>
            <legend className="label mb-2">Access role</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {roleOptions.map((option) => {
                const Icon = option.icon;
                const selected = invite.role === option.role;
                return (
                  <label key={option.role} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${selected ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:bg-muted/40'}`}>
                    <input type="radio" name="role" value={option.role} checked={selected} onChange={() => setInvite((current) => ({ ...current, role: option.role }))} className="sr-only" />
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
          {invite.role === 'admin' && <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800">Administrator access includes sensitive user data and system controls.</p>}
          {actionError && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{actionError}</p>}
          <div className="flex flex-col-reverse justify-end gap-2 border-t border-border pt-4 sm:flex-row">
            <button type="button" onClick={() => setInviteOpen(false)} disabled={inviting} className="btn-secondary"><X className="h-4 w-4" />Cancel</button>
            <button type="submit" disabled={inviting || !adminInvitesAvailable()} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"><Mail className="h-4 w-4" />{inviting ? 'Sending invite...' : 'Create profile & send invite'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!roleModal}
        onClose={() => setRoleModal(null)}
        onConfirm={handleRoleChange}
        title="Update access role"
        message={roleModal ? `Choose the CivicSync access level for ${roleModal.full_name}.` : ''}
        confirmLabel={savingRole ? 'Saving...' : 'Save role'}
      >
        <div className="p-5">
          <label className="label" htmlFor="managed-user-role">Role</label>
          <select id="managed-user-role" value={newRole} onChange={(event) => setNewRole(event.target.value as UserRole)} className="input">
            {roleOptions.map((option) => <option key={option.role} value={option.role}>{option.label}</option>)}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">Role changes take effect on the user’s next request.</p>
        </div>
      </ConfirmDialog>
    </div>
  );
}