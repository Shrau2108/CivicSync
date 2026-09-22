import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'priority' | 'status' | 'role';
}

export function Badge({ children, className }: BadgeProps) {
  return <span className={cn('badge border', className)}>{children}</span>;
}

interface PriorityBadgeProps {
  level: string | null | undefined;
}

export function PriorityBadge({ level }: PriorityBadgeProps) {
  const labels: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  const colors: Record<string, string> = {
    critical: 'text-priority-critical bg-priority-criticalBg border-priority-criticalBorder',
    high: 'text-priority-high bg-priority-highBg border-priority-highBorder',
    medium: 'text-priority-medium bg-priority-mediumBg border-priority-mediumBorder',
    low: 'text-priority-low bg-priority-lowBg border-priority-lowBorder',
  };
  if (!level || !labels[level]) return null;
  return <span className={cn('badge border', colors[level])}>{labels[level]}</span>;
}

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const labels: Record<string, string> = {
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
    completed: 'Completed',
    rejected: 'Rejected',
    duplicate: 'Duplicate',
    reopened: 'Reopened',
    cancelled: 'Cancelled',
    declined: 'Declined',
    reassigned: 'Reassigned',
  };
  const colors: Record<string, string> = {
    submitted: 'bg-blue-50 text-blue-700 border-blue-200',
    under_review: 'bg-amber-50 text-amber-700 border-amber-200',
    verified: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    prioritized: 'bg-purple-50 text-purple-700 border-purple-200',
    assigned: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    accepted: 'bg-teal-50 text-teal-700 border-teal-200',
    in_progress: 'bg-orange-50 text-orange-700 border-orange-200',
    evidence_submitted: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    under_verification: 'bg-violet-50 text-violet-700 border-violet-200',
    resolved: 'bg-green-50 text-green-700 border-green-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    duplicate: 'bg-gray-50 text-gray-700 border-gray-200',
    reopened: 'bg-pink-50 text-pink-700 border-pink-200',
    cancelled: 'bg-charcoal-100 text-charcoal-600 border-charcoal-200',
    declined: 'bg-rose-50 text-rose-700 border-rose-200',
    reassigned: 'bg-sky-50 text-sky-700 border-sky-200',
  };
  const label = labels[status] || status;
  const color = colors[status] || 'bg-charcoal-100 text-charcoal-600 border-charcoal-200';
  return <span className={cn('badge border', color)}>{label}</span>;
}

interface RoleBadgeProps {
  role: string;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const labels: Record<string, string> = {
    citizen: 'Citizen',
    volunteer: 'Volunteer',
    supervisor: 'Supervisor',
    admin: 'Administrator',
  };
  const colors: Record<string, string> = {
    citizen: 'bg-primary-50 text-primary-700 border-primary-200',
    volunteer: 'bg-teal-50 text-teal-700 border-teal-200',
    supervisor: 'bg-navy-50 text-navy-700 border-navy-200',
    admin: 'bg-charcoal-800 text-white border-charcoal-900',
  };
  return <span className={cn('badge border', colors[role] || colors.citizen)}>{labels[role] || role}</span>;
}
