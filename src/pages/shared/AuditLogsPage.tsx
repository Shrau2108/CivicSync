import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  Award,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  FileText,
  Filter,
  ListFilter,
  Mail,
  RotateCcw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  User,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { fetchAuditLogs } from '@/services/api';
import type { AuditLog, Profile } from '@/types';

// Format helper for audit timestamp
function formatAuditDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const dateFormatted = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timeFormatted = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return { dateFormatted, timeFormatted };
  } catch {
    return { dateFormatted: dateStr, timeFormatted: '' };
  }
}

// User avatar color helper by role
function getAvatarBgColor(role?: string) {
  switch (role) {
    case 'admin':
      return 'bg-blue-600 text-white';
    case 'supervisor':
      return 'bg-purple-600 text-white';
    case 'volunteer':
      return 'bg-emerald-600 text-white';
    case 'citizen':
    default:
      return 'bg-slate-700 text-white';
  }
}

// Format human-readable action label and get associated icon
function getActionPresentation(action: string) {
  const norm = action.toLowerCase();
  if (norm.includes('role')) {
    return { label: 'Changed user role', icon: Users };
  }
  if (norm.includes('approve_volunteer') || norm.includes('volunteer_verified')) {
    return { label: 'Approved volunteer application', icon: ShieldCheck };
  }
  if (norm.includes('reject_volunteer') || norm.includes('volunteer_rejected')) {
    return { label: 'Rejected volunteer application', icon: ShieldAlert };
  }
  if (norm.includes('update_volunteer')) {
    return { label: 'Updated volunteer profile', icon: Award };
  }
  if (norm.includes('invite')) {
    return { label: 'Invited user account', icon: Mail };
  }
  if (norm.includes('deactivate')) {
    return { label: 'Deactivated user', icon: UserX };
  }
  if (norm.includes('activate')) {
    return { label: 'Activated user', icon: UserCheck };
  }
  if (norm.includes('complete_task') || norm.includes('task_completed')) {
    return { label: 'Mark task as complete', icon: CheckCircle2 };
  }
  if (norm.includes('assign_task') || norm.includes('task_assigned')) {
    return { label: 'Assigned task', icon: UserPlus };
  }
  if (norm.includes('upload_evidence') || norm.includes('evidence')) {
    return { label: 'Uploaded evidence', icon: UploadCloud };
  }
  if (norm.includes('report_status') || norm.includes('review_report') || norm.includes('verify_report') || norm.includes('reject_report')) {
    return { label: 'Updated report status', icon: FileText };
  }
  if (norm.includes('setting')) {
    return { label: 'Updated system settings', icon: Settings };
  }
  if (norm.includes('update_profile') || norm.includes('edit_profile')) {
    return { label: 'Updated user profile', icon: UserCog };
  }
  if (norm.includes('create_profile')) {
    return { label: 'Created profile', icon: User };
  }
  if (norm.includes('edit_report')) {
    return { label: 'Edited report details', icon: Edit3 };
  }

  // Fallback prettification
  return {
    label: action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    icon: Activity,
  };
}

// Format human-readable details from audit metadata
function formatLogDetails(log: AuditLog): string {
  const d = log.details || {};
  const action = log.action.toLowerCase();

  if (d.summary && typeof d.summary === 'string') {
    return d.summary;
  }

  if (action.includes('role')) {
    const fromRole = d.from ? String(d.from) : '';
    const toRole = d.to ? String(d.to) : '';
    if (fromRole && toRole) {
      return `Role changed from ${fromRole.charAt(0).toUpperCase() + fromRole.slice(1)} to ${
        toRole.charAt(0).toUpperCase() + toRole.slice(1)
      }`;
    }
  }

  if (action.includes('invite')) {
    const role = d.role || d.target_role || 'account';
    return `Invited new ${role} account (${d.email || d.target_email || 'email'})`;
  }

  if (action.includes('deactivate')) {
    return d.reason ? `Account deactivated: ${d.reason}` : 'Account deactivated by administrator';
  }

  if (action.includes('activate')) {
    return 'Account reactivated by administrator';
  }

  if (action.includes('approve_volunteer')) {
    return 'Volunteer application approved and verified';
  }

  if (action.includes('reject_volunteer')) {
    return d.reason ? `Application rejected (${d.reason})` : 'Volunteer application rejected';
  }

  if (action.includes('report_status') || action.includes('review_report')) {
    const fromS = d.from ? String(d.from).replace(/_/g, ' ') : '';
    const toS = d.to ? String(d.to).replace(/_/g, ' ') : '';
    if (fromS && toS) {
      return `Status changed from ${fromS} to ${toS}`;
    }
    return 'Report status updated';
  }

  if (action.includes('complete_task')) {
    return 'Task marked as completed with verification';
  }

  if (action.includes('assign_task')) {
    return d.assignee_name ? `Task assigned to ${d.assignee_name}` : 'Task assigned to volunteer';
  }

  if (action.includes('setting')) {
    return d.key ? `Configuration key "${d.key}" updated` : 'System settings updated';
  }

  if (action.includes('update_profile')) {
    if (d.changes && typeof d.changes === 'object') {
      const changedKeys = Object.keys(d.changes);
      if (changedKeys.length > 0) {
        return `Updated ${changedKeys.join(', ')}`;
      }
    }
    return 'Profile information updated';
  }

  return `${log.action.replace(/_/g, ' ')} on ${log.entity_type}`;
}

// Target info helper
function getTargetDisplay(log: AuditLog) {
  const d = log.details || {};
  let targetName = 'System';
  let entityBadge = log.entity_type.toUpperCase();
  let badgeColor = 'bg-slate-700/60 text-slate-300 border-slate-600';

  if (log.target && typeof log.target === 'object') {
    const t = log.target as Profile & { title?: string };
    if (t.full_name) {
      targetName = t.full_name;
    } else if (t.title) {
      targetName = t.title;
    }
  }

  if (targetName === 'System') {
    if (d.target_name) {
      targetName = String(d.target_name);
    } else if (d.name) {
      targetName = String(d.name);
    } else if (d.report_title) {
      targetName = String(d.report_title);
    } else if (d.task_title) {
      targetName = String(d.task_title);
    } else if (d.key) {
      targetName = String(d.key);
    } else if (log.entity_id) {
      targetName = `${log.entity_type.charAt(0).toUpperCase() + log.entity_type.slice(1)} #${log.entity_id.slice(0, 6)}`;
    }
  }

  switch (log.entity_type.toLowerCase()) {
    case 'profile':
    case 'user':
      entityBadge = 'User';
      badgeColor = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      break;
    case 'volunteer':
      entityBadge = 'Volunteer';
      badgeColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      break;
    case 'report':
      entityBadge = 'Report';
      badgeColor = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
      break;
    case 'task':
      entityBadge = 'Task';
      badgeColor = 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      break;
    case 'system_settings':
    case 'settings':
      entityBadge = 'Settings';
      badgeColor = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      break;
  }

  return { targetName, entityBadge, badgeColor };
}

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  // Sorting
  const [sortField, setSortField] = useState<'created_at' | 'action' | 'actor' | 'target' | 'result'>('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Inspection modal
  const [inspectLog, setInspectLog] = useState<AuditLog | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAuditLogs(300);
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Unique list of users for dropdown filter
  const uniqueUsers = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((log) => {
      if (log.actor_id && log.actor?.full_name) {
        map.set(log.actor_id, log.actor.full_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [logs]);

  // Unique list of action categories for dropdown filter
  const uniqueActions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((log) => {
      const { label } = getActionPresentation(log.action);
      set.add(label);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Filter & sort logic
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Text search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const actionLabel = getActionPresentation(log.action).label.toLowerCase();
        const actorName = (log.actor?.full_name || 'System').toLowerCase();
        const actorEmail = (log.actor?.email || '').toLowerCase();
        const { targetName } = getTargetDisplay(log);
        const detailsText = formatLogDetails(log).toLowerCase();
        const ip = (log.ip_address || '').toLowerCase();

        const matches =
          actionLabel.includes(q) ||
          actorName.includes(q) ||
          actorEmail.includes(q) ||
          targetName.toLowerCase().includes(q) ||
          detailsText.includes(q) ||
          ip.includes(q);

        if (!matches) return false;
      }

      // 2. Action filter
      if (actionFilter !== 'all') {
        const { label } = getActionPresentation(log.action);
        if (label !== actionFilter) return false;
      }

      // 3. User filter
      if (userFilter !== 'all') {
        if (log.actor_id !== userFilter) return false;
      }

      // 4. Date filter
      if (dateFilter !== 'all') {
        const logTime = new Date(log.created_at).getTime();
        const now = Date.now();
        if (dateFilter === 'today') {
          const oneDayAgo = now - 24 * 60 * 60 * 1000;
          if (logTime < oneDayAgo) return false;
        } else if (dateFilter === '7days') {
          const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
          if (logTime < sevenDaysAgo) return false;
        } else if (dateFilter === '30days') {
          const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
          if (logTime < thirtyDaysAgo) return false;
        }
      }

      return true;
    });
  }, [logs, search, actionFilter, userFilter, dateFilter]);

  // Sorted list
  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'created_at') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortField === 'actor') {
        const nameA = a.actor?.full_name || 'System';
        const nameB = b.actor?.full_name || 'System';
        comparison = nameA.localeCompare(nameB);
      } else if (sortField === 'action') {
        const actA = getActionPresentation(a.action).label;
        const actB = getActionPresentation(b.action).label;
        comparison = actA.localeCompare(actB);
      } else if (sortField === 'target') {
        const targA = getTargetDisplay(a).targetName;
        const targB = getTargetDisplay(b).targetName;
        comparison = targA.localeCompare(targB);
      } else if (sortField === 'result') {
        const resA = a.result || 'success';
        const resB = b.result || 'success';
        comparison = resA.localeCompare(resB);
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [filteredLogs, sortField, sortAsc]);

  // Pagination calculation
  const totalLogs = sortedLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalLogs / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedLogs.slice(start, start + pageSize);
  }, [sortedLogs, currentPage, pageSize]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setActionFilter('all');
    setUserFilter('all');
    setDateFilter('all');
    setCurrentPage(1);
  };

  // CSV Export handler
  const handleExportLogs = () => {
    if (sortedLogs.length === 0) return;

    const headers = ['Timestamp', 'Actor Name', 'Actor Email', 'Action', 'Target', 'Entity Type', 'Details', 'Result', 'IP Address'];
    const rows = sortedLogs.map((log) => {
      const { dateFormatted, timeFormatted } = formatAuditDate(log.created_at);
      const actorName = log.actor?.full_name || 'System';
      const actorEmail = log.actor?.email || 'system@civicsync.local';
      const { label } = getActionPresentation(log.action);
      const { targetName, entityBadge } = getTargetDisplay(log);
      const details = formatLogDetails(log);
      const result = log.result || 'success';
      const ip = log.ip_address || '—';

      return [
        `"${dateFormatted} ${timeFormatted}"`,
        `"${actorName}"`,
        `"${actorEmail}"`,
        `"${label}"`,
        `"${targetName}"`,
        `"${entityBadge}"`,
        `"${details.replace(/"/g, '""')}"`,
        `"${result}"`,
        `"${ip}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `civicsync_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <LoadingState message="Loading system audit logs..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      {/* Page Title & Export button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Audit Logs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            System-wide activity trail of important actions
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportLogs}
          disabled={sortedLogs.length === 0}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-all hover:bg-primary/20 hover:border-primary/60 disabled:opacity-50 disabled:cursor-not-allowed shadow-soft"
        >
          <Download className="h-4 w-4" />
          Export Logs
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by action, user, target or keyword..."
              className="input pl-10 text-sm w-full"
            />
          </div>

          {/* Action Filter */}
          <div className="relative">
            <ListFilter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="input pl-9 pr-8 text-sm"
              aria-label="Filter by action"
            >
              <option value="all">All Actions</option>
              {uniqueActions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {/* User Filter */}
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={userFilter}
              onChange={(e) => {
                setUserFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="input pl-9 pr-8 text-sm"
              aria-label="Filter by user"
            >
              <option value="all">All Users</option>
              {uniqueUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="input pl-9 pr-8 text-sm"
              aria-label="Filter by date range"
            >
              <option value="all">All Time</option>
              <option value="today">Past 24 Hours</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleResetFilters}
            className="btn-secondary px-3.5 py-2 text-sm text-muted-foreground hover:text-foreground"
            title="Reset filters"
          >
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Audit Logs Table */}
      {sortedLogs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center shadow-soft">
          <EmptyState
            icon={<Filter className="h-8 w-8" />}
            title="No audit logs found"
            description={
              logs.length
                ? 'Try adjusting your search keywords or clearing active filters.'
                : 'System activity and user actions will be recorded here.'
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[12px] font-semibold text-muted-foreground">
                  <th
                    scope="col"
                    onClick={() => handleSort('created_at')}
                    className="cursor-pointer select-none px-4 py-3.5 hover:text-foreground"
                  >
                    <div className="flex items-center gap-1.5">
                      Timestamp
                      <span className="text-xs">↕</span>
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('actor')}
                    className="cursor-pointer select-none px-4 py-3.5 hover:text-foreground"
                  >
                    <div className="flex items-center gap-1.5">
                      User
                      <span className="text-xs">↕</span>
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('action')}
                    className="cursor-pointer select-none px-4 py-3.5 hover:text-foreground"
                  >
                    <div className="flex items-center gap-1.5">
                      Action
                      <span className="text-xs">↕</span>
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('target')}
                    className="cursor-pointer select-none px-4 py-3.5 hover:text-foreground"
                  >
                    <div className="flex items-center gap-1.5">
                      Target
                      <span className="text-xs">↕</span>
                    </div>
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Details
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('result')}
                    className="cursor-pointer select-none px-4 py-3.5 hover:text-foreground"
                  >
                    <div className="flex items-center gap-1.5">
                      Result
                      <span className="text-xs">↕</span>
                    </div>
                  </th>
                  <th scope="col" className="px-4 py-3.5 font-mono">
                    IP Address
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-center">
                    View
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {paginatedLogs.map((log) => {
                  const { dateFormatted, timeFormatted } = formatAuditDate(log.created_at);
                  const actorName = log.actor?.full_name || 'Admin User';
                  const actorEmail = log.actor?.email || 'admin@civicsync.local';
                  const actorInitial = actorName.charAt(0).toUpperCase() || 'U';
                  const avatarColor = getAvatarBgColor(log.actor?.role);
                  const { label: actionLabel, icon: ActionIcon } = getActionPresentation(log.action);
                  const { targetName, entityBadge, badgeColor } = getTargetDisplay(log);
                  const detailsText = formatLogDetails(log);
                  const isSuccess = !log.result || log.result === 'success';

                  return (
                    <tr
                      key={log.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      {/* Timestamp */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <div className="font-medium text-foreground">{dateFormatted}</div>
                        <div className="text-xs text-muted-foreground">{timeFormatted}</div>
                      </td>

                      {/* Actor */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-sm ${avatarColor}`}
                          >
                            {actorInitial}
                          </span>
                          <div className="min-w-0">
                            <span className="block truncate font-semibold text-foreground">
                              {actorName}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {actorEmail}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <ActionIcon className="h-4 w-4" />
                          </span>
                          <span className="font-medium text-foreground">{actionLabel}</span>
                        </div>
                      </td>

                      {/* Target */}
                      <td className="px-4 py-3.5">
                        <div className="min-w-[140px]">
                          <span className="block font-semibold text-foreground truncate max-w-[220px]">
                            {targetName}
                          </span>
                          <span
                            className={`inline-block mt-0.5 rounded px-1.5 py-0.2 text-[10px] font-semibold uppercase tracking-wider border ${badgeColor}`}
                          >
                            {entityBadge}
                          </span>
                        </div>
                      </td>

                      {/* Details */}
                      <td className="px-4 py-3.5">
                        <p className="max-w-md text-xs leading-relaxed text-muted-foreground line-clamp-2">
                          {detailsText}
                        </p>
                      </td>

                      {/* Result */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                            isSuccess
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                              : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {isSuccess ? 'Success' : 'Failed'}
                        </span>
                      </td>

                      {/* IP Address */}
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-muted-foreground">
                        {log.ip_address || '—'}
                      </td>

                      {/* View Button */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setInspectLog(log)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted hover:text-primary"
                          title="View audit event details"
                          aria-label={`View audit entry ${log.id}`}
                        >
                          <Eye className="h-4 w-4 text-sky-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col gap-4 border-t border-border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-foreground">
                {Math.min(currentPage * pageSize, totalLogs)}
              </span>{' '}
              of <span className="font-semibold text-foreground">{totalLogs}</span> logs
            </p>

            <div className="flex items-center gap-1.5 self-center sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn-secondary h-8 w-8 p-0 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNumber = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pageNumber = currentPage - 2 + i;
                  if (pageNumber > totalPages) pageNumber = totalPages - (4 - i);
                }
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${
                      currentPage === pageNumber
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {pageNumber}
                  </button>
                );
              })}

              {totalPages > 5 && currentPage < totalPages - 2 && (
                <>
                  <span className="px-1 text-xs text-muted-foreground">...</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    className="h-8 w-8 rounded-lg border border-border bg-background text-xs font-semibold text-muted-foreground hover:bg-muted"
                  >
                    {totalPages}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn-secondary h-8 w-8 p-0 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Entry Inspection Modal */}
      <Modal
        open={!!inspectLog}
        onClose={() => setInspectLog(null)}
        title="Audit Log Event Inspection"
        size="lg"
      >
        {inspectLog && (
          <div className="space-y-5 p-6">
            {/* Header info */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {(() => {
                    const { icon: Icon } = getActionPresentation(inspectLog.action);
                    return <Icon className="h-5 w-5" />;
                  })()}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {getActionPresentation(inspectLog.action).label}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    Log ID: {inspectLog.id}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold border ${
                    !inspectLog.result || inspectLog.result === 'success'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                  }`}
                >
                  {!inspectLog.result || inspectLog.result === 'success' ? 'Success' : 'Failed'}
                </span>
              </div>
            </div>

            {/* Actor and Target Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Actor Card */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Actor (Performed By)
                  </span>
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase">
                    {inspectLog.actor?.role || 'Staff'}
                  </span>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarBgColor(
                      inspectLog.actor?.role
                    )}`}
                  >
                    {inspectLog.actor?.full_name?.charAt(0).toUpperCase() || 'A'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {inspectLog.actor?.full_name || 'Admin User'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {inspectLog.actor?.email || 'admin@civicsync.local'}
                    </p>
                    <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                      ID: {inspectLog.actor_id || 'System'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Target Card */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Target (Affected Record)
                  </span>
                  <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-400 uppercase">
                    {inspectLog.entity_type}
                  </span>
                </div>
                <div className="pt-1">
                  <p className="text-sm font-semibold text-foreground">
                    {getTargetDisplay(inspectLog).targetName}
                  </p>
                  {inspectLog.details && typeof inspectLog.details.target_email === 'string' && (
                    <p className="text-xs text-muted-foreground">
                      {inspectLog.details.target_email}
                    </p>
                  )}
                  <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                    ID: {inspectLog.entity_id || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Event Timestamp and IP Details */}
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-3 text-xs">
              <div>
                <span className="text-muted-foreground block font-medium">Recorded At</span>
                <span className="font-semibold text-foreground mt-0.5 block">
                  {formatAuditDate(inspectLog.created_at).dateFormatted}{' '}
                  {formatAuditDate(inspectLog.created_at).timeFormatted}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block font-medium">Origin IP Address</span>
                <span className="font-mono font-semibold text-foreground mt-0.5 block">
                  {inspectLog.ip_address || 'Not Recorded'}
                </span>
              </div>
            </div>

            {/* Changes Diff / Details */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Recorded Changes &amp; Action Details
              </h4>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium text-foreground mb-3">
                  {formatLogDetails(inspectLog)}
                </p>

                {/* Diff table if changes dictionary exists */}
                {inspectLog.details &&
                  typeof inspectLog.details.changes === 'object' &&
                  inspectLog.details.changes !== null &&
                  Object.keys(inspectLog.details.changes).length > 0 && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">Field</th>
                            <th className="px-3 py-2 text-left font-semibold text-rose-400">Previous Value</th>
                            <th className="px-3 py-2 text-left font-semibold text-emerald-400">New Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-card font-mono">
                          {Object.entries(
                            inspectLog.details.changes as Record<string, { old?: unknown; new?: unknown }>
                          ).map(([field, val]) => (
                            <tr key={field}>
                              <td className="px-3 py-2 font-sans font-semibold text-foreground capitalize">
                                {field.replace(/_/g, ' ')}
                              </td>
                              <td className="px-3 py-2 text-rose-400 bg-rose-500/5">
                                {typeof val?.old === 'object'
                                  ? JSON.stringify(val?.old)
                                  : String(val?.old ?? '—')}
                              </td>
                              <td className="px-3 py-2 text-emerald-400 bg-emerald-500/5">
                                {typeof val?.new === 'object'
                                  ? JSON.stringify(val?.new)
                                  : String(val?.new ?? '—')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                {/* Raw metadata viewer (excluding secrets) */}
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-semibold text-sky-400 hover:underline">
                    View Complete Event Payload
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] text-slate-300 border border-slate-800">
                    {JSON.stringify(
                      (() => {
                        const sanitized = { ...inspectLog };
                        // Exclude any sensitive tokens or passwords if present
                        if (sanitized.details) {
                          const d = { ...sanitized.details };
                          delete d.password;
                          delete d.token;
                          delete d.access_token;
                          delete d.secret;
                          sanitized.details = d;
                        }
                        return sanitized;
                      })(),
                      null,
                      2
                    )}
                  </pre>
                </details>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="btn-secondary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
