import type { UserRole, ReportStatus, TaskStatus, PriorityLevel } from '@/types';

export function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  verified: 'Verified',
  prioritized: 'Prioritized',
  assigned: 'Assigned',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  evidence_submitted: 'Evidence Submitted',
  under_verification: 'Under Verification',
  resolved: 'Resolved',
  rejected: 'Rejected',
  duplicate: 'Duplicate',
  reopened: 'Reopened',
  cancelled: 'Cancelled',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  assigned: 'Assigned',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  evidence_submitted: 'Evidence Submitted',
  under_verification: 'Under Verification',
  completed: 'Completed',
  declined: 'Declined',
  reassigned: 'Reassigned',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  citizen: 'Citizen',
  volunteer: 'Volunteer',
  supervisor: 'Supervisor',
  admin: 'Administrator',
};

export function getPriorityColor(level: PriorityLevel | null | undefined): string {
  switch (level) {
    case 'critical': return 'text-priority-critical bg-priority-criticalBg border-priority-criticalBorder';
    case 'high': return 'text-priority-high bg-priority-highBg border-priority-highBorder';
    case 'medium': return 'text-priority-medium bg-priority-mediumBg border-priority-mediumBorder';
    case 'low': return 'text-priority-low bg-priority-lowBg border-priority-lowBorder';
    default: return 'text-charcoal-500 bg-charcoal-100 border-charcoal-200';
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'submitted': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'under_review': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'verified': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'prioritized': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'assigned': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'accepted': return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'in_progress': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'evidence_submitted': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'under_verification': return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'resolved': case 'completed': return 'bg-green-50 text-green-700 border-green-200';
    case 'rejected': return 'bg-red-50 text-red-700 border-red-200';
    case 'duplicate': return 'bg-gray-50 text-gray-700 border-gray-200';
    case 'reopened': return 'bg-pink-50 text-pink-700 border-pink-200';
    case 'cancelled': return 'bg-charcoal-100 text-charcoal-600 border-charcoal-200';
    case 'declined': return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'reassigned': return 'bg-sky-50 text-sky-700 border-sky-200';
    default: return 'bg-charcoal-100 text-charcoal-600 border-charcoal-200';
  }
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
