import { useState, useEffect, useCallback } from 'react';
import { UserCheck, Search, Star, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Modal';
import { fetchVolunteers, updateVolunteer, createAuditLog } from '@/services/api';
import { formatDate } from '@/lib/utils';
import type { Volunteer } from '@/types';

export function VolunteerManagementPage() {
  const { user } = useAuth();
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [verifyModal, setVerifyModal] = useState<Volunteer | null>(null);
  const [verifyDecision, setVerifyDecision] = useState<'verified' | 'rejected'>('verified');

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

  useEffect(() => { load(); }, [load]);

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
      });
      setVerifyModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update volunteer');
    }
  };

  const filtered = volunteers.filter(v =>
    !search || v.profile?.full_name.toLowerCase().includes(search.toLowerCase()) || v.service_area?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingState message="Loading volunteers..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Volunteer Management" description="Review and verify volunteer profiles" />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Search volunteers..." />
      </div>

      {filtered.length === 0 ? (
        <Card><CardBody>
          <EmptyState icon={<UserCheck className="w-8 h-8" />} title="No volunteers found" />
        </CardBody></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((vol) => (
            <Card key={vol.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold">
                      {vol.profile?.full_name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-medium text-charcoal-800">{vol.profile?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-charcoal-400">{formatDate(vol.created_at)}</p>
                    </div>
                  </div>
                  <span className={`badge border ${
                    vol.verification_status === 'verified' ? 'bg-primary-50 text-primary-700 border-primary-200' :
                    vol.verification_status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {vol.verification_status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-charcoal-400">Workload:</span>{' '}
                    <span className="text-charcoal-700">{vol.current_workload}/{vol.max_workload}</span>
                  </div>
                  <div>
                    <span className="text-charcoal-400">Completed:</span>{' '}
                    <span className="text-charcoal-700">{vol.completed_tasks}</span>
                  </div>
                  {vol.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400" />
                      <span className="text-charcoal-700">{vol.rating.toFixed(1)}</span>
                    </div>
                  )}
                  {vol.service_area && (
                    <div>
                      <span className="text-charcoal-400">Area:</span>{' '}
                      <span className="text-charcoal-700">{vol.service_area}</span>
                    </div>
                  )}
                </div>

                {vol.skills && vol.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {vol.skills.map(s => (
                      <span key={s.id} className="badge bg-charcoal-100 text-charcoal-700 border border-charcoal-200">{s.skill}</span>
                    ))}
                  </div>
                )}

                {vol.verification_status === 'pending' && (
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => { setVerifyModal(vol); setVerifyDecision('verified'); }} className="btn-primary text-sm flex-1">
                      <CheckCircle2 className="w-4 h-4" /> Verify
                    </button>
                    <button onClick={() => { setVerifyModal(vol); setVerifyDecision('rejected'); }} className="btn-danger text-sm flex-1">
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!verifyModal}
        onClose={() => setVerifyModal(null)}
        onConfirm={handleVerify}
        title={verifyDecision === 'verified' ? 'Verify Volunteer' : 'Reject Volunteer'}
        message={verifyDecision === 'verified'
          ? `Verify ${verifyModal?.profile?.full_name}? They will be able to accept tasks.`
          : `Reject ${verifyModal?.profile?.full_name}? They will not be able to accept tasks.`}
        confirmLabel={verifyDecision === 'verified' ? 'Verify' : 'Reject'}
        danger={verifyDecision === 'rejected'}
      />
    </div>
  );
}
