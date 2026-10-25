import { useState, useEffect, useCallback } from 'react';
import {
  UserCheck,
  Search,
  Star,
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
  MapPin,
  UserPlus,
  ShieldCheck,
  UserX,
  X,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import {
  fetchVolunteers,
  updateVolunteer,
  createAuditLog,
  inviteAdminUser,
  revokeVolunteerAccess,
  grantVolunteerAccess,
} from '@/services/api';
import { formatDate } from '@/lib/utils';
import type { Volunteer } from '@/types';

const initialInvite = { fullName: '', email: '', phone: '' };

export function VolunteerManagementPage() {
  const { user } = useAuth();
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [success, setSuccess] = useState<string | null>(null);

  // Verification modal state
  const [verifyModal, setVerifyModal] = useState<Volunteer | null>(null);
  const [verifyDecision, setVerifyDecision] = useState<'verified' | 'rejected'>('verified');

  // Revoke access modal state
  const [revokeModal, setRevokeModal] = useState<Volunteer | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Restore access modal state
  const [restoreModal, setRestoreModal] = useState<Volunteer | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Invite volunteer modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState(initialInvite);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const v = await fetchVolunteers();
      setVolunteers(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load volunteers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleVerify = async () => {
    if (!user || !verifyModal) return;
    try {
      await updateVolunteer(verifyModal.id, {
        is_verified: verifyDecision === 'verified',
        verification_status: verifyDecision,
      });
      await createAuditLog({
        action: `volunteer_${verifyDecision}`,
        entity_type: 'volunteer',
        entity_id: verifyModal.id,
        details: {
          target_name: verifyModal.profile?.full_name || 'Volunteer',
          target_email: verifyModal.profile?.email,
          result: 'success',
        },
      });
      setSuccess(`Volunteer ${verifyModal.profile?.full_name || ''} has been ${verifyDecision}.`);
      setVerifyModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update volunteer');
    }
  };

  const handleRevokeAccess = async () => {
    if (!revokeModal) return;
    setRevoking(true);
    setError(null);
    try {
      await revokeVolunteerAccess(revokeModal.user_id, revokeModal.id, 'Access revoked by administrator');
      setSuccess(
        `Volunteer access revoked for ${revokeModal.profile?.full_name || 'Volunteer'}. Account role changed to Citizen.`
      );
      setRevokeModal(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke volunteer access');
    } finally {
      setRevoking(false);
    }
  };

  const handleRestoreAccess = async () => {
    if (!restoreModal) return;
    setRestoring(true);
    setError(null);
    try {
      await grantVolunteerAccess(restoreModal.user_id, restoreModal.id);
      setSuccess(
        `Volunteer access granted and verified for ${restoreModal.profile?.full_name || 'Volunteer'}.`
      );
      setRestoreModal(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant volunteer access');
    } finally {
      setRestoring(false);
    }
  };

  const handleInviteSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInviteError(null);
    setSuccess(null);
    setInviting(true);
    try {
      const profile = await inviteAdminUser({
        fullName: invite.fullName,
        email: invite.email,
        phone: invite.phone || undefined,
        role: 'volunteer',
      });
      setSuccess(`Invitation sent to ${profile.email}. Volunteer profile provisioned successfully.`);
      setInvite(initialInvite);
      setInviteOpen(false);
      await load();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Could not create volunteer invitation');
    } finally {
      setInviting(false);
    }
  };

  const filtered = volunteers.filter((v) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (v.profile?.full_name && v.profile.full_name.toLowerCase().includes(q)) ||
      (v.profile?.email && v.profile.email.toLowerCase().includes(q)) ||
      (v.profile?.phone && v.profile.phone.toLowerCase().includes(q)) ||
      (v.profile?.city && v.profile.city.toLowerCase().includes(q)) ||
      (v.service_area && v.service_area.toLowerCase().includes(q)) ||
      (v.bio && v.bio.toLowerCase().includes(q)) ||
      (v.skills && v.skills.some((s) => s.skill.toLowerCase().includes(q)))
    );
  });

  if (loading) return <LoadingState message="Loading volunteers..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Volunteer Management"
          description="Grant volunteer access, review profiles, or revoke privileges"
        />
        <button
          type="button"
          onClick={() => {
            setInviteError(null);
            setInviteOpen(true);
          }}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm"
        >
          <UserPlus className="h-4 w-4" />
          Invite Volunteer
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {success && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          {success}
        </p>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-10"
          placeholder="Search volunteers by name, email, phone, location, skills..."
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<UserCheck className="w-8 h-8" />}
              title="No volunteers found"
              description={volunteers.length ? 'Try clearing your search query.' : 'Click "Invite Volunteer" to add the first volunteer.'}
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((vol) => {
            const hasVolunteerRole = vol.profile?.role === 'volunteer';
            const isVerified = vol.verification_status === 'verified';
            const isRejected = vol.verification_status === 'rejected';
            const isPending = vol.verification_status === 'pending';

            return (
              <Card key={vol.id} className="transition-all hover:border-primary/40">
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold flex-shrink-0">
                        {vol.profile?.full_name?.charAt(0).toUpperCase() || 'V'}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{vol.profile?.full_name || 'Volunteer'}</p>
                        <p className="text-xs text-muted-foreground">Joined {formatDate(vol.created_at)}</p>
                      </div>
                    </div>

                    {/* Access Status Badge */}
                    <div className="flex flex-col items-end gap-1">
                      {!hasVolunteerRole ? (
                        <span className="badge border bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/30 text-xs">
                          Access Revoked (Citizen)
                        </span>
                      ) : isVerified ? (
                        <span className="badge border bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Active Volunteer
                        </span>
                      ) : isRejected ? (
                        <span className="badge border bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 text-xs flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> Access Rejected
                        </span>
                      ) : (
                        <span className="badge border bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs">
                          Pending Verification
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Contact details */}
                  <div className="space-y-1 rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
                    {vol.profile?.email && (
                      <div className="flex items-center gap-2 text-foreground">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{vol.profile.email}</span>
                      </div>
                    )}
                    {vol.profile?.phone && (
                      <div className="flex items-center gap-2 text-foreground">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span>{vol.profile.phone}</span>
                      </div>
                    )}
                    {(vol.service_area || vol.profile?.city || vol.profile?.area) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">
                          {[vol.service_area || vol.profile?.area, vol.profile?.city].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bio */}
                  {vol.bio && (
                    <p className="text-xs text-muted-foreground italic line-clamp-2">
                      "{vol.bio}"
                    </p>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/60">
                    <div>
                      <span className="text-muted-foreground">Workload:</span>{' '}
                      <span className="font-medium text-foreground">
                        {vol.current_workload}/{vol.max_workload}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Completed:</span>{' '}
                      <span className="font-medium text-foreground">{vol.completed_tasks}</span>
                    </div>
                    {vol.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="font-medium text-foreground">{vol.rating.toFixed(1)}</span>
                      </div>
                    )}
                    {vol.service_area && (
                      <div className="truncate">
                        <span className="text-muted-foreground">Area:</span>{' '}
                        <span className="font-medium text-foreground">{vol.service_area}</span>
                      </div>
                    )}
                  </div>

                  {/* Skills */}
                  {vol.skills && vol.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {vol.skills.map((s) => (
                        <span
                          key={s.id}
                          className="badge bg-muted text-muted-foreground border border-border text-[11px]"
                        >
                          {s.skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action buttons: Verify / Reject / Revoke / Restore */}
                  <div className="pt-2 border-t border-border/60 flex flex-wrap gap-2">
                    {isPending && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setVerifyModal(vol);
                            setVerifyDecision('verified');
                          }}
                          className="btn-primary text-xs flex-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verify Volunteer
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setVerifyModal(vol);
                            setVerifyDecision('rejected');
                          }}
                          className="btn-danger text-xs flex-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    )}

                    {hasVolunteerRole && isVerified && (
                      <button
                        type="button"
                        onClick={() => setRevokeModal(vol)}
                        className="btn-secondary text-xs flex-1 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-500/20"
                        title="Remove volunteer access and demote account to Citizen"
                      >
                        <UserX className="w-3.5 h-3.5" /> Revoke Access
                      </button>
                    )}

                    {(!hasVolunteerRole || isRejected) && (
                      <button
                        type="button"
                        onClick={() => setRestoreModal(vol)}
                        className="btn-secondary text-xs flex-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/20"
                        title="Restore volunteer role and grant access to volunteer tasks"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> Grant Volunteer Access
                      </button>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* Verify Volunteer Dialog */}
      <ConfirmDialog
        open={!!verifyModal}
        onClose={() => setVerifyModal(null)}
        onConfirm={handleVerify}
        title={verifyDecision === 'verified' ? 'Verify Volunteer' : 'Reject Volunteer'}
        message={
          verifyDecision === 'verified'
            ? `Verify ${verifyModal?.profile?.full_name}? They will be able to accept tasks.`
            : `Reject ${verifyModal?.profile?.full_name}? They will not be able to accept tasks.`
        }
        confirmLabel={verifyDecision === 'verified' ? 'Verify' : 'Reject'}
        danger={verifyDecision === 'rejected'}
      />

      {/* Revoke Access Dialog */}
      <ConfirmDialog
        open={!!revokeModal}
        onClose={() => setRevokeModal(null)}
        onConfirm={handleRevokeAccess}
        title="Revoke Volunteer Access"
        message={
          revokeModal
            ? `Revoke volunteer access for ${revokeModal.profile?.full_name}? Their role will be changed to Citizen and they will no longer be eligible to accept or perform tasks. Their historical completed tasks and records will remain safely preserved.`
            : ''
        }
        confirmLabel={revoking ? 'Revoking...' : 'Revoke Access'}
        danger={true}
      />

      {/* Grant / Restore Access Dialog */}
      <ConfirmDialog
        open={!!restoreModal}
        onClose={() => setRestoreModal(null)}
        onConfirm={handleRestoreAccess}
        title="Grant Volunteer Access"
        message={
          restoreModal
            ? `Grant volunteer access to ${restoreModal.profile?.full_name}? Their role will be updated to Volunteer and their status marked as Verified.`
            : ''
        }
        confirmLabel={restoring ? 'Granting...' : 'Grant Access'}
      />

      {/* Invite Volunteer Modal */}
      <Modal
        open={inviteOpen}
        onClose={() => {
          if (!inviting) {
            setInviteOpen(false);
            setInviteError(null);
          }
        }}
        title="Invite New Volunteer"
        size="md"
      >
        <form onSubmit={handleInviteSubmit} className="space-y-4 p-5">
          <p className="text-sm text-muted-foreground">
            Invite a new volunteer. They will receive an invitation email and their volunteer account and profile will be created with verified status.
          </p>

          <label className="block">
            <span className="label">Full Name</span>
            <input
              autoFocus
              required
              minLength={2}
              maxLength={100}
              value={invite.fullName}
              onChange={(e) => setInvite((cur) => ({ ...cur, fullName: e.target.value }))}
              className="input"
              placeholder="e.g. Ananya Sen"
            />
          </label>

          <label className="block">
            <span className="label">Email Address</span>
            <input
              required
              type="email"
              maxLength={254}
              value={invite.email}
              onChange={(e) => setInvite((cur) => ({ ...cur, email: e.target.value }))}
              className="input"
              placeholder="ananya.sen@example.com"
            />
          </label>

          <label className="block">
            <span className="label">Phone (optional)</span>
            <input
              type="tel"
              maxLength={32}
              value={invite.phone}
              onChange={(e) => setInvite((cur) => ({ ...cur, phone: e.target.value }))}
              className="input"
              placeholder="+91 98765 43210"
            />
          </label>

          {inviteError && (
            <p role="alert" className="flex items-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {inviteError}
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
              className="btn-primary disabled:opacity-50"
            >
              <Mail className="h-4 w-4" />
              {inviting ? 'Inviting...' : 'Send Volunteer Invitation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
