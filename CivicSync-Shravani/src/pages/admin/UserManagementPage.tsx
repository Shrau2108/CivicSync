import { useState, useEffect, useCallback } from 'react';
import { Users, Search, ShieldCheck, UserCog } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { RoleBadge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Modal';
import { fetchAllProfiles, updateProfile, createAuditLog } from '@/services/api';
import { formatDate } from '@/lib/utils';
import type { Profile, UserRole } from '@/types';

export function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [roleModal, setRoleModal] = useState<Profile | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('citizen');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await fetchAllProfiles();
      setProfiles(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRoleChange = async () => {
    if (!currentUser || !roleModal) return;
    setSaving(true);
    try {
      await updateProfile(roleModal.id, { role: newRole });
      await createAuditLog({
        action: 'change_user_role',
        entity_type: 'profile',
        entity_id: roleModal.id,
        details: { from: roleModal.role, to: newRole },
      });
      setRoleModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const filtered = profiles.filter(p => {
    const matchesSearch = !search || p.full_name.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || p.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) return <LoadingState message="Loading users..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="User Management" description="Manage user roles and permissions" />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Search by name or email..." />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input sm:w-48">
          <option value="all">All Roles</option>
          <option value="citizen">Citizens</option>
          <option value="volunteer">Volunteers</option>
          <option value="supervisor">Supervisors</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardBody>
          <EmptyState icon={<Users className="w-8 h-8" />} title="No users found" />
        </CardBody></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-charcoal-100">
                  <th className="text-left text-xs font-medium text-charcoal-500 uppercase px-4 py-3">Name</th>
                  <th className="text-left text-xs font-medium text-charcoal-500 uppercase px-4 py-3 hidden sm:table-cell">Email</th>
                  <th className="text-left text-xs font-medium text-charcoal-500 uppercase px-4 py-3">Role</th>
                  <th className="text-left text-xs font-medium text-charcoal-500 uppercase px-4 py-3 hidden sm:table-cell">Joined</th>
                  <th className="text-right text-xs font-medium text-charcoal-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-charcoal-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs">
                          {p.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-charcoal-800">{p.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-charcoal-500 hidden sm:table-cell">{p.email}</td>
                    <td className="px-4 py-3"><RoleBadge role={p.role} /></td>
                    <td className="px-4 py-3 text-sm text-charcoal-500 hidden sm:table-cell">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {p.id !== currentUser?.id && (
                        <button
                          onClick={() => { setRoleModal(p); setNewRole(p.role); }}
                          className="btn-ghost text-sm"
                        >
                          <UserCog className="w-4 h-4" /> Change Role
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!roleModal}
        onClose={() => setRoleModal(null)}
        onConfirm={handleRoleChange}
        title="Change User Role"
        message={roleModal ? `Change role for ${roleModal.full_name}?` : ''}
        confirmLabel={saving ? 'Saving...' : 'Save'}
      >
        <div className="p-5">
          <label className="label">New Role</label>
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)} className="input">
            <option value="citizen">Citizen</option>
            <option value="volunteer">Volunteer</option>
            <option value="supervisor">Supervisor</option>
            <option value="admin">Administrator</option>
          </select>
          <p className="text-xs text-charcoal-400 mt-2">
            Note: Supervisor and Admin roles grant access to sensitive data and operations.
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
