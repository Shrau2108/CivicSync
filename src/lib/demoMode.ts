import { hasSupabaseSessionForCurrentProject, isSupabaseConfigured } from '@/lib/supabase';
import type {
  AuditLog, DuplicateCandidate, Evidence, Profile, Report, ReportCategory, ReportLocation, ReportMedia, SimilarityType, Task, TaskAssignment, UserRole, VerificationRecord, Volunteer, VolunteerTaskRequest,
} from '@/types';

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env?.VITE_DEMO_MODE === 'true') return true;
  if (!isSupabaseConfigured) return true;

  // Only a session for this configured project should override demo mode.
  if (hasSupabaseSessionForCurrentProject()) return false;

  return Boolean(sessionStorage.getItem('civicsync-demo-role'));
}

export const DEMO_MODE = false;
const STORAGE_KEY = 'civicsync-demo-store-v1';
const DEMO_MEDIA_DATABASE = 'civicsync-demo-media-v1';

function openDemoMediaDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DEMO_MEDIA_DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('evidence');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open local evidence storage.'));
  });
}

async function saveDemoEvidenceFile(key: string, file: File): Promise<void> {
  const database = await openDemoMediaDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('evidence', 'readwrite');
    transaction.objectStore('evidence').put(file, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Could not save evidence locally.'));
    transaction.onabort = () => reject(transaction.error || new Error('Evidence storage was interrupted.'));
  }).finally(() => database.close());
}

async function loadDemoEvidenceFile(key: string): Promise<Blob | null> {
  const database = await openDemoMediaDatabase();
  return new Promise<Blob | null>((resolve, reject) => {
    const transaction = database.transaction('evidence', 'readonly');
    const request = transaction.objectStore('evidence').get(key);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error || new Error('Could not load local evidence.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
}

const now = new Date().toISOString();
const demoProfiles: Profile[] = [
  { id: 'demo-citizen', email: 'citizen@demo.local', full_name: 'Demo Citizen', phone: '+1 (555) 234-5678', role: 'citizen', avatar_url: null, is_active: true, city: 'Demo City', area: 'Central Ward', created_at: '2026-10-01T09:00:00Z', updated_at: now },
  { id: 'demo-supervisor', email: 'supervisor@civicsync.local', full_name: 'Supervisor', phone: '+1 (555) 345-6789', role: 'supervisor', avatar_url: null, is_active: true, city: 'Demo City', area: 'Central Ward', created_at: '2026-10-01T09:00:00Z', updated_at: now },
  { id: 'demo-volunteer', email: 'volunteer@civicsync.local', full_name: 'Volunteer', phone: '+1 (555) 456-7890', role: 'volunteer', avatar_url: null, is_active: true, city: 'Demo City', area: 'Central Ward', created_at: '2026-10-01T09:00:00Z', updated_at: now },
  { id: 'demo-analyst', email: 'analyst@demo.local', full_name: 'Demo Analyst', phone: '+1 (555) 567-8901', role: 'analyst', avatar_url: null, is_active: true, city: 'Demo City', area: 'Central Ward', created_at: '2026-10-01T09:00:00Z', updated_at: now },
  { id: 'demo-admin', email: 'admin@civicsync.local', full_name: 'Admin User', phone: '+1 (555) 678-9012', role: 'admin', avatar_url: null, is_active: true, city: 'Demo City', area: 'Central Ward', created_at: '2026-10-01T09:00:00Z', updated_at: now },
  { id: 'user-rohit', email: 'rohit.sharma@civicsync.local', full_name: 'Rohit Sharma', phone: '+91 98765 43210', role: 'volunteer', avatar_url: null, is_active: true, city: 'Demo City', area: 'Central Ward', created_at: '2026-10-02T10:30:00Z', updated_at: '2026-10-13T18:24:00Z' },
  { id: 'user-priya', email: 'priya.desai@civicsync.local', full_name: 'Priya Desai', phone: '+91 98765 43211', role: 'volunteer', avatar_url: null, is_active: true, city: 'Demo City', area: 'North District', created_at: '2026-10-05T11:15:00Z', updated_at: '2026-10-13T17:10:00Z' },
  { id: 'user-amit', email: 'amit.verma@civicsync.local', full_name: 'Amit Verma', phone: '+91 98765 43212', role: 'citizen', avatar_url: null, is_active: false, city: 'Demo City', area: 'East Suburb', created_at: '2026-10-04T08:00:00Z', updated_at: '2026-10-13T11:32:00Z' },
  { id: 'user-neha', email: 'neha.kapoor@civicsync.local', full_name: 'Neha Kapoor', phone: '+91 98765 43213', role: 'citizen', avatar_url: null, is_active: true, city: 'Demo City', area: 'South Ward', created_at: '2026-10-06T14:20:00Z', updated_at: '2026-10-12T17:14:00Z' },
  { id: 'user-rahul', email: 'rahul.mehta@civicsync.local', full_name: 'Rahul Mehta', phone: '+91 98765 43214', role: 'volunteer', avatar_url: null, is_active: true, city: 'Demo City', area: 'West Zone', created_at: '2026-10-03T12:00:00Z', updated_at: '2026-10-12T15:27:00Z' },
];

export const demoCategories: ReportCategory[] = [
  { id: '068ee841-7289-433f-9a24-85fd6ea43404', name: 'Garbage', slug: 'garbage', icon: 'Trash2', description: 'Waste collection, illegal dumping, overflowing bins', is_active: true, created_at: now },
  { id: '19a1adbd-3484-4871-8859-4fadb3833e02', name: 'Road Damage', slug: 'road-damage', icon: 'Construction', description: 'Potholes, cracked pavement, road erosion', is_active: true, created_at: now },
  { id: '09463ab5-f5f9-4c4d-8ad2-b0a75d440308', name: 'Streetlight', slug: 'streetlight', icon: 'Lightbulb', description: 'Broken or non-functional street lighting', is_active: true, created_at: now },
  { id: '8fa0953f-343f-44e2-a879-f5c9976c5f05', name: 'Water Leakage', slug: 'water-leakage', icon: 'Droplets', description: 'Pipe bursts, water supply issues, leaks', is_active: true, created_at: now },
  { id: 'efbb6c28-c8b4-4c04-9c96-d890b2465341', name: 'Medical', slug: 'medical', icon: 'Stethoscope', description: 'Public health hazards, sanitation emergencies', is_active: true, created_at: now },
  { id: 'b665220d-bae3-48f7-af3f-13df6fba1a77', name: 'Flood Relief', slug: 'flood-relief', icon: 'Waves', description: 'Flooding, waterlogging, drainage overflow', is_active: true, created_at: now },
  { id: '5768ebd4-03fc-479a-9a3e-765a1a2312d8', name: 'Education', slug: 'education', icon: 'GraduationCap', description: 'School infrastructure, educational access issues', is_active: true, created_at: now },
  { id: '86be93ab-7a22-469f-b149-2a95b10b22b0', name: 'Food', slug: 'food', icon: 'UtensilsCrossed', description: 'Food distribution, food safety, hunger relief', is_active: true, created_at: now },
  { id: '06aa68b7-cc25-4e57-9f5a-61390db52ecc', name: 'Shelter', slug: 'shelter', icon: 'Home', description: 'Housing issues, homeless support, shelter needs', is_active: true, created_at: now },
  { id: '3b93000b-1db3-4aaa-ad9b-4ab9dd29d79f', name: 'Other', slug: 'other', icon: 'CircleHelp', description: 'Uncategorized community issues', is_active: true, created_at: now },
];

const demoLocation: ReportLocation = {
  id: 'demo-location-1', report_id: 'demo-report-1', address: 'Main Street near the community park',
  latitude: 17.385, longitude: 78.4867, city: 'Demo City', area: 'Central Ward', postal_code: null, created_at: now,
};

const seedPotholeSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><rect width="320" height="240" fill="%23334155"/><circle cx="160" cy="120" r="50" fill="%230f172a" stroke="%2364748b" stroke-width="4"/><path d="M120 110 Q160 80 200 115 Q170 145 120 110" fill="%23020617"/></svg>`;

const seedReport: Report = {
  id: 'demo-report-1', report_id: 'RPT-DEMO01', title: 'Pothole near the community park',
  description: 'A large pothole is affecting traffic and pedestrians near the park entrance.', category_id: '19a1adbd-3484-4871-8859-4fadb3833e02',
  status: 'submitted', severity: 'high', urgency: 'high', priority_level: 'high', priority_score: 82, affected_people: 24,
  additional_notes: 'Most visible after sunset.', reporter_id: 'demo-citizen', assigned_volunteer_id: null,
  ai_category_confidence: null, ai_category_explanation: null, ai_integration_active: false, is_duplicate: false,
  duplicate_of: null, reviewer_id: null, reviewed_at: null, resolved_at: null, created_at: now, updated_at: now,
  category: demoCategories[1], reporter: demoProfiles[0], location: demoLocation,
  media: [
    {
      id: 'demo-media-seed-1',
      report_id: 'demo-report-1',
      file_url: seedPotholeSvg,
      file_type: 'image',
      file_name: 'pothole_community_park.svg',
      file_size: 1024,
      file_hash: 'd3a846c21e63a8a30c51d6f28a9b31d923bb6d28adca27d819958dc180292723',
      storage_path: null,
      created_at: now,
    },
  ],
};

const seedAuditLogs: AuditLog[] = [
  {
    id: 'audit-demo-1',
    actor_id: 'demo-admin',
    action: 'Changed user role',
    entity_type: 'profile',
    entity_id: 'user-rohit',
    result: 'success',
    ip_address: '192.168.1.24',
    created_at: '2026-10-13T18:24:00Z',
    details: {
      target_name: 'Rohit Sharma',
      target_role: 'Volunteer',
      from: 'Citizen',
      to: 'Volunteer',
      summary: 'Role changed from Citizen to Volunteer',
      changes: {
        role: { old: 'citizen', new: 'volunteer' }
      }
    }
  },
  {
    id: 'audit-demo-2',
    actor_id: 'demo-admin',
    action: 'Approved volunteer application',
    entity_type: 'volunteer',
    entity_id: 'user-priya',
    result: 'success',
    ip_address: '192.168.1.24',
    created_at: '2026-10-13T17:10:00Z',
    details: {
      target_name: 'Priya Desai',
      target_role: 'Volunteer',
      summary: 'Volunteer application approved',
      changes: {
        verification_status: { old: 'pending', new: 'verified' },
        is_verified: { old: false, new: true }
      }
    }
  },
  {
    id: 'audit-demo-3',
    actor_id: 'demo-supervisor',
    action: 'Updated report status',
    entity_type: 'report',
    entity_id: 'RPT-1023',
    result: 'success',
    ip_address: '192.168.1.35',
    created_at: '2026-10-13T16:02:00Z',
    details: {
      target_name: 'Report #1023',
      from: 'Open',
      to: 'In Progress',
      summary: 'Status changed from Open to In Progress',
      changes: {
        status: { old: 'open', new: 'in_progress' }
      }
    }
  },
  {
    id: 'audit-demo-4',
    actor_id: 'demo-volunteer',
    action: 'Mark task as complete',
    entity_type: 'task',
    entity_id: 'TSK-456',
    result: 'success',
    ip_address: '192.168.1.42',
    created_at: '2026-10-13T14:18:00Z',
    details: {
      target_name: 'Task #456',
      summary: 'Task marked as completed with evidence',
      changes: {
        status: { old: 'in_progress', new: 'completed' }
      }
    }
  },
  {
    id: 'audit-demo-5',
    actor_id: 'demo-admin',
    action: 'Updated system settings',
    entity_type: 'settings',
    entity_id: 'setting-notifications',
    result: 'success',
    ip_address: '192.168.1.24',
    created_at: '2026-10-13T13:45:00Z',
    details: {
      target_name: 'Notification Settings',
      summary: 'Email notifications enabled for new reports',
      changes: {
        email_notifications_enabled: { old: false, new: true }
      }
    }
  },
  {
    id: 'audit-demo-6',
    actor_id: 'demo-supervisor',
    action: 'Deactivated user',
    entity_type: 'profile',
    entity_id: 'user-amit',
    result: 'failed',
    ip_address: '192.168.1.35',
    created_at: '2026-10-13T11:32:00Z',
    details: {
      target_name: 'Amit Verma',
      target_role: 'User',
      reason: 'Account deactivated due to policy violation',
      summary: 'Account deactivated due to policy violation',
      error: 'Permission denied: supervisor cannot deactivate citizens directly'
    }
  },
  {
    id: 'audit-demo-7',
    actor_id: 'demo-admin',
    action: 'Edited report details',
    entity_type: 'report',
    entity_id: 'RPT-987',
    result: 'success',
    ip_address: '192.168.1.24',
    created_at: '2026-10-13T10:15:00Z',
    details: {
      target_name: 'Report #987',
      summary: 'Updated location and description',
      changes: {
        location: { old: 'Ward 4 entrance', new: 'Main Street near Community Center' },
        description: { old: 'Large pothole', new: 'Deep pothole causing vehicular damage' }
      }
    }
  },
  {
    id: 'audit-demo-8',
    actor_id: 'demo-volunteer',
    action: 'Uploaded evidence',
    entity_type: 'task',
    entity_id: 'TSK-432',
    result: 'success',
    ip_address: '192.168.1.42',
    created_at: '2026-10-12T18:50:00Z',
    details: {
      target_name: 'Task #432',
      summary: 'Added after image for pothole repair',
      evidence_type: 'after',
      file_name: 'pothole_fixed_01.jpg'
    }
  },
  {
    id: 'audit-demo-9',
    actor_id: 'demo-admin',
    action: 'Rejected volunteer application',
    entity_type: 'profile',
    entity_id: 'user-neha',
    result: 'success',
    ip_address: '192.168.1.24',
    created_at: '2026-10-12T17:14:00Z',
    details: {
      target_name: 'Neha Kapoor',
      target_role: 'User',
      summary: 'Application rejected (Insufficient details)',
      reason: 'Insufficient verification documents provided'
    }
  },
  {
    id: 'audit-demo-10',
    actor_id: 'demo-supervisor',
    action: 'Assigned task',
    entity_type: 'task',
    entity_id: 'TSK-431',
    result: 'success',
    ip_address: '192.168.1.35',
    created_at: '2026-10-12T15:27:00Z',
    details: {
      target_name: 'Task #431',
      summary: 'Task assigned to Rahul Mehta',
      assigned_to: 'Rahul Mehta',
      assigned_to_id: 'user-rahul'
    }
  }
];

type DemoStore = {
  profiles: Profile[];
  reports: Report[];
  tasks: Task[];
  volunteers: Volunteer[];
  taskRequests: VolunteerTaskRequest[];
  verificationRecords: VerificationRecord[];
  auditLogs: AuditLog[];
  duplicateCandidates: DuplicateCandidate[];
};

function initialStore(): DemoStore {
  const profiles = demoProfiles.map((p) => ({ ...p }));
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const auditLogs = seedAuditLogs.map((log) => ({
    ...log,
    actor: log.actor_id ? profileMap.get(log.actor_id) : undefined,
    target: log.entity_id && (log.entity_type === 'profile' || log.entity_type === 'user' || log.entity_type === 'volunteer')
      ? profileMap.get(log.entity_id)
      : undefined,
  }));

  return {
    profiles,
    reports: [seedReport],
    tasks: [],
    taskRequests: [],
    verificationRecords: [],
    auditLogs,
    duplicateCandidates: [],
    volunteers: [
      {
        id: 'demo-volunteer-record', user_id: 'demo-volunteer', bio: 'Ready to help improve Demo City.', service_area: 'Central Ward',
        current_workload: 0, max_workload: 5, completed_tasks: 0, rating: 4.9, total_ratings: 12,
        is_verified: true, verification_status: 'verified', latitude: 17.385, longitude: 78.4867,
        created_at: now, updated_at: now, profile: { ...profiles[2] },
        skills: [
          { id: 'sk-1', volunteer_id: 'demo-volunteer-record', skill: 'Debris Removal', proficiency: 'expert', created_at: now },
          { id: 'sk-2', volunteer_id: 'demo-volunteer-record', skill: 'First Aid', proficiency: 'intermediate', created_at: now },
        ],
        availability: [],
      },
      {
        id: 'vol-rohit', user_id: 'user-rohit', bio: 'Community volunteer helping with neighborhood cleanup and road safety.', service_area: 'Central Ward',
        current_workload: 1, max_workload: 4, completed_tasks: 8, rating: 4.8, total_ratings: 9,
        is_verified: true, verification_status: 'verified', latitude: 17.386, longitude: 78.487,
        created_at: now, updated_at: now, profile: { ...profiles.find((p) => p.id === 'user-rohit')! },
        skills: [
          { id: 'sk-3', volunteer_id: 'vol-rohit', skill: 'Traffic Control', proficiency: 'intermediate', created_at: now },
          { id: 'sk-4', volunteer_id: 'vol-rohit', skill: 'Heavy Lifting', proficiency: 'expert', created_at: now },
        ],
        availability: [],
      },
      {
        id: 'vol-priya', user_id: 'user-priya', bio: 'Dedicated volunteer focusing on education drives and emergency aid distribution.', service_area: 'North District',
        current_workload: 2, max_workload: 5, completed_tasks: 14, rating: 5.0, total_ratings: 15,
        is_verified: true, verification_status: 'verified', latitude: 17.395, longitude: 78.490,
        created_at: now, updated_at: now, profile: { ...profiles.find((p) => p.id === 'user-priya')! },
        skills: [
          { id: 'sk-5', volunteer_id: 'vol-priya', skill: 'First Aid', proficiency: 'expert', created_at: now },
          { id: 'sk-6', volunteer_id: 'vol-priya', skill: 'Food Distribution', proficiency: 'intermediate', created_at: now },
        ],
        availability: [],
      },
      {
        id: 'vol-rahul', user_id: 'user-rahul', bio: 'Experienced civil repair and streetlight fixing volunteer.', service_area: 'West Zone',
        current_workload: 1, max_workload: 6, completed_tasks: 22, rating: 4.9, total_ratings: 18,
        is_verified: true, verification_status: 'verified', latitude: 17.378, longitude: 78.475,
        created_at: now, updated_at: now, profile: { ...profiles.find((p) => p.id === 'user-rahul')! },
        skills: [
          { id: 'sk-7', volunteer_id: 'vol-rahul', skill: 'Electrical Repairs', proficiency: 'expert', created_at: now },
          { id: 'sk-8', volunteer_id: 'vol-rahul', skill: 'Pothole Filling', proficiency: 'intermediate', created_at: now },
        ],
        availability: [],
      },
    ],
  };
}

function readStore(): DemoStore {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return initialStore();
    const store = JSON.parse(stored) as Partial<DemoStore>;
    const base = initialStore();
    return {
      ...base,
      ...store,
      profiles: store.profiles && store.profiles.length > 0 ? store.profiles : base.profiles,
      volunteers: store.volunteers && store.volunteers.length > 0 ? store.volunteers : base.volunteers,
      auditLogs: store.auditLogs && store.auditLogs.length > 0 ? store.auditLogs : base.auditLogs,
      taskRequests: store.taskRequests || [],
      verificationRecords: store.verificationRecords || [],
      duplicateCandidates: store.duplicateCandidates || [],
    };
  } catch {
    return initialStore();
  }
}

function writeStore(store: DemoStore): DemoStore {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  return store;
}

function syncDemoVolunteerWorkload(store: DemoStore, volunteerId: string): void {
  const workload = store.tasks.reduce((count, task) => {
    if (!['assigned', 'accepted', 'in_progress', 'evidence_submitted', 'under_verification'].includes(task.status)) return count;
    return count + (task.assignments || []).filter((assignment) =>
      assignment.volunteer_id === volunteerId && ['assigned', 'accepted'].includes(assignment.status)
    ).length;
  }, 0);
  const volunteer = store.volunteers.find((item) => item.user_id === volunteerId);
  if (volunteer) volunteer.current_workload = workload;
}

export function demoProfile(id: string): Profile {
  const store = readStore();
  return store.profiles.find((profile) => profile.id === id) || demoProfiles.find((profile) => profile.id === id) || demoProfiles[0];
}

export function demoAllProfiles(): Profile[] {
  return readStore().profiles;
}

export function demoRoleProfile(role: 'citizen' | 'supervisor' | 'volunteer' | 'analyst' | 'admin'): Profile {
  const store = readStore();
  return store.profiles.find((profile) => profile.role === role) || demoProfiles.find((profile) => profile.role === role) || demoProfiles[0];
}

export function demoUpdateProfile(id: string, updates: Partial<Profile>): Profile {
  const store = readStore();
  let found = store.profiles.find((p) => p.id === id);
  const oldProfile = found ? { ...found } : null;

  if (!found) {
    const base = demoProfiles.find((p) => p.id === id) || {
      id,
      email: `${id}@civicsync.local`,
      full_name: 'Civic User',
      phone: null,
      role: 'citizen' as const,
      avatar_url: null,
      is_active: true,
      city: 'Demo City',
      area: 'Central Ward',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    found = { ...base, ...updates, updated_at: new Date().toISOString() };
    store.profiles.push(found);
  } else {
    Object.assign(found, updates, { updated_at: new Date().toISOString() });
  }

  // If this user is a volunteer, update the volunteer record's profile & service area
  const volunteer = store.volunteers.find((v) => v.user_id === id);
  if (volunteer) {
    volunteer.profile = { ...found };
    if (updates.area) {
      volunteer.service_area = updates.area;
    }
    volunteer.updated_at = new Date().toISOString();
  }

  // Also sync reporter on demo reports
  store.reports.forEach((report) => {
    if (report.reporter_id === id) {
      report.reporter = { ...found! };
    }
  });

  // Calculate changed fields
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  if (oldProfile) {
    (['full_name', 'phone', 'city', 'area', 'role', 'is_active', 'notification_preferences'] as const).forEach((key) => {
      if (key in updates && JSON.stringify(updates[key]) !== JSON.stringify(oldProfile[key])) {
        changes[key] = { old: oldProfile[key], new: updates[key] };
      }
    });
  }

  if (Object.keys(changes).length > 0 || !oldProfile) {
    let action = 'update_profile';
    let summary = `Updated profile information for ${found.full_name}`;
    if (updates.role && oldProfile && updates.role !== oldProfile.role) {
      action = 'change_user_role';
      summary = `Role changed from ${oldProfile.role} to ${updates.role}`;
    } else if (updates.is_active !== undefined && oldProfile && updates.is_active !== oldProfile.is_active) {
      action = updates.is_active ? 'activate_user' : 'deactivate_user';
      summary = updates.is_active ? `User account activated` : `User account deactivated`;
    }

    const currentRole = typeof window !== 'undefined' ? sessionStorage.getItem('civicsync-demo-role') : null;
    const actor = store.profiles.find((p) => p.role === (currentRole || 'admin')) || store.profiles[0];

    const auditLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: actor.id,
      action,
      entity_type: 'profile',
      entity_id: found.id,
      result: 'success',
      ip_address: '192.168.1.24',
      created_at: new Date().toISOString(),
      actor,
      target: { ...found },
      details: {
        target_name: found.full_name,
        target_email: found.email,
        target_role: found.role,
        summary,
        changes: Object.keys(changes).length > 0 ? changes : undefined,
      },
    };
    store.auditLogs.unshift(auditLog);
  }

  writeStore(store);
  return found;
}

export function demoReports(filters?: { status?: string; category_id?: string; priority_level?: string }): Report[] {
  return readStore().reports.filter((report) =>
    (!filters?.status || report.status === filters.status) &&
    (!filters?.category_id || report.category_id === filters.category_id) &&
    (!filters?.priority_level || report.priority_level === filters.priority_level)
  ).map(enrichReport);
}

export function demoReportsByReporter(reporterId: string): Report[] {
  return readStore().reports.filter((report) => report.reporter_id === reporterId).map(enrichReport);
}

export function demoReportById(id: string): Report | null {
  const report = readStore().reports.find((item) => item.id === id);
  return report ? enrichReport(report) : null;
}

function enrichReport(report: Report): Report {
  return { ...report, urgency: report.urgency || 'medium', category: demoCategories.find((category) => category.id === report.category_id), reporter: demoProfile(report.reporter_id) };
}

export function demoCreateReport(input: { title: string; description: string; category_id: string; severity: string; urgency?: string; affected_people: number; additional_notes?: string; reporter_id: string }): Report {
  const store = readStore();
  const report: Report = {
    ...input, additional_notes: input.additional_notes || null, id: `demo-report-${Date.now()}`, report_id: `RPT-DEMO${String(store.reports.length + 1).padStart(2, '0')}`,
    category_id: input.category_id, status: 'submitted', severity: input.severity as Report['severity'], urgency: (input.urgency || 'medium') as Report['urgency'], priority_level: input.severity as Report['priority_level'],
    priority_score: input.severity === 'critical' ? 100 : input.severity === 'high' ? 80 : input.severity === 'medium' ? 55 : 30,
    assigned_volunteer_id: null, ai_category_confidence: null, ai_category_explanation: null, ai_integration_active: false,
    is_duplicate: false, duplicate_of: null, reviewer_id: null, reviewed_at: null, resolved_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  store.reports.unshift(report);
  writeStore(store);
  return enrichReport(report);
}

export function demoCreateLocation(reportId: string, input: Omit<ReportLocation, 'id' | 'report_id' | 'created_at'>): void {
  const store = readStore();
  const report = store.reports.find((item) => item.id === reportId);
  if (report) report.location = { ...input, id: `demo-location-${Date.now()}`, report_id: reportId, created_at: new Date().toISOString() };
  writeStore(store);
}

export function demoUpdateReportStatus(reportId: string, status: string, reviewerId?: string): void {
  const store = readStore();
  const report = store.reports.find((item) => item.id === reportId);
  if (report) {
    report.status = status as Report['status']; report.reviewer_id = reviewerId || report.reviewer_id;
    report.reviewed_at = reviewerId ? new Date().toISOString() : report.reviewed_at;
    report.resolved_at = status === 'resolved' ? new Date().toISOString() : report.resolved_at;
  }
  writeStore(store);
}

export function demoUpdateReportPriority(reportId: string, priorityLevel: string, priorityScore: number, urgency?: string): void {
  const store = readStore();
  const report = store.reports.find((item) => item.id === reportId);
  if (report) {
    report.priority_level = priorityLevel as Report['priority_level'];
    report.priority_score = priorityScore;
    if (urgency) report.urgency = urgency as Report['urgency'];
    report.updated_at = new Date().toISOString();
  }
  writeStore(store);
}

export function demoVolunteers(): Volunteer[] {
  const store = readStore();
  store.volunteers.forEach((volunteer) => {
    syncDemoVolunteerWorkload(store, volunteer.user_id);
    const p = store.profiles.find((prof) => prof.id === volunteer.user_id);
    if (p) {
      volunteer.profile = { ...p };
      if (!volunteer.service_area && p.area) {
        volunteer.service_area = p.area;
      }
    }
  });
  writeStore(store);
  return store.volunteers;
}

export function demoUpdateVolunteer(idOrUserId: string, updates: Partial<Volunteer>): Volunteer | null {
  const store = readStore();
  const volunteer = store.volunteers.find((v) => v.id === idOrUserId || v.user_id === idOrUserId);
  if (!volunteer) return null;
  const oldVolunteer = { ...volunteer };
  Object.assign(volunteer, updates, { updated_at: new Date().toISOString() });

  const changes: Record<string, { old: unknown; new: unknown }> = {};
  (['bio', 'service_area', 'max_workload', 'verification_status', 'is_verified'] as const).forEach((key) => {
    if (key in updates && JSON.stringify(updates[key]) !== JSON.stringify(oldVolunteer[key])) {
      changes[key] = { old: oldVolunteer[key], new: updates[key] };
    }
  });

  if (Object.keys(changes).length > 0) {
    const currentRole = typeof window !== 'undefined' ? sessionStorage.getItem('civicsync-demo-role') : null;
    const actor = store.profiles.find((p) => p.role === (currentRole || 'admin')) || store.profiles[0];
    const targetProfile = store.profiles.find((p) => p.id === volunteer.user_id);
    const auditLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      actor_id: actor.id,
      action: 'update_volunteer_profile',
      entity_type: 'volunteer',
      entity_id: volunteer.id,
      result: 'success',
      ip_address: '192.168.1.24',
      created_at: new Date().toISOString(),
      actor,
      target: targetProfile,
      details: {
        target_name: targetProfile?.full_name || 'Volunteer',
        target_email: targetProfile?.email,
        target_role: 'volunteer',
        summary: `Updated volunteer profile details`,
        changes,
      },
    };
    store.auditLogs.unshift(auditLog);
  }

  writeStore(store);
  return volunteer;
}

export function demoCreateVolunteer(input: {
  user_id: string;
  bio?: string;
  service_area?: string;
  latitude?: number;
  longitude?: number;
}): Volunteer {
  const store = readStore();
  const profile = store.profiles.find((p) => p.id === input.user_id) || demoProfile(input.user_id);
  const volunteer: Volunteer = {
    id: `demo-volunteer-${Date.now()}`,
    user_id: input.user_id,
    bio: input.bio || null,
    service_area: input.service_area || null,
    current_workload: 0,
    max_workload: 5,
    completed_tasks: 0,
    rating: 5.0,
    total_ratings: 0,
    is_verified: true,
    verification_status: 'verified',
    latitude: input.latitude || 17.385,
    longitude: input.longitude || 78.4867,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    profile,
    skills: [],
    availability: [],
  };
  store.volunteers.push(volunteer);
  writeStore(store);
  return volunteer;
}

export function demoAddVolunteerSkill(volunteerId: string, skill: string, proficiency: string): void {
  const store = readStore();
  const volunteer = store.volunteers.find((v) => v.id === volunteerId || v.user_id === volunteerId);
  if (!volunteer) return;
  const newSkill = {
    id: `skill-${Date.now()}`,
    volunteer_id: volunteer.id,
    skill,
    proficiency: proficiency as import('@/types').Proficiency,
    created_at: new Date().toISOString(),
  };
  volunteer.skills = [...(volunteer.skills || []), newSkill];
  writeStore(store);
}

export function demoRemoveVolunteerSkill(skillId: string): void {
  const store = readStore();
  store.volunteers.forEach((v) => {
    if (v.skills) {
      v.skills = v.skills.filter((s) => s.id !== skillId);
    }
  });
  writeStore(store);
}

export function demoTasks(): Task[] { return readStore().tasks.map(enrichTask); }
export function demoTasksForVolunteer(volunteerId: string): Task[] {
  return demoTasks().filter((task) => task.assignments?.some((assignment) => assignment.volunteer_id === volunteerId));
}
export function demoTaskById(id: string): Task | null {
  const task = demoTasks().find((item) => item.id === id);
  return task || null;
}

export async function demoHydrateTaskMedia(tasks: Task[]): Promise<Task[]> {
  return Promise.all(tasks.map(async (task) => ({
    ...task,
    evidence: await Promise.all((task.evidence || []).map(async (evidence) => {
      if (!evidence.file_url.startsWith('demo-media:')) return evidence;
      const media = await loadDemoEvidenceFile(evidence.id);
      return media ? { ...evidence, file_url: URL.createObjectURL(media) } : evidence;
    })),
  })));
}

export function demoVolunteerTaskRequests(volunteerId?: string): VolunteerTaskRequest[] {
  const store = readStore();
  return store.taskRequests
    .filter((request) => !volunteerId || request.volunteer_id === volunteerId)
    .map((request) => ({
      ...request,
      report: store.reports.find((report) => report.id === request.report_id)
        ? enrichReport(store.reports.find((report) => report.id === request.report_id)!)
        : undefined,
      volunteer: demoProfile(request.volunteer_id),
    }));
}

export function demoSubmitVolunteerTaskRequest(reportId: string, message: string): VolunteerTaskRequest {
  const store = readStore();
  const report = store.reports.find((item) => item.id === reportId);
  const volunteer = store.volunteers.find((item) => item.user_id === demoRoleProfile('volunteer').id);
  if (!report || !['verified', 'prioritized'].includes(report.status) || report.is_duplicate || report.assigned_volunteer_id) {
    throw new Error('This report is no longer available for volunteer requests.');
  }
  if (!volunteer?.is_verified || volunteer.verification_status !== 'verified') {
    throw new Error('A verified volunteer profile is required to request a task.');
  }
  if (store.taskRequests.some((request) => request.report_id === reportId && request.volunteer_id === volunteer.user_id && request.status === 'pending')) {
    throw new Error('You already have a pending request for this report.');
  }
  const createdAt = new Date().toISOString();
  const request: VolunteerTaskRequest = {
    id: `demo-request-${Date.now()}`,
    report_id: reportId,
    volunteer_id: volunteer.user_id,
    message: message.trim() || null,
    status: 'pending',
    reviewer_id: null,
    reviewed_at: null,
    task_id: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
  store.taskRequests.unshift(request);
  writeStore(store);
  return { ...request, report: enrichReport(report), volunteer: demoProfile(volunteer.user_id) };
}

export function demoReviewVolunteerTaskRequest(requestId: string, approved: boolean, reviewerId: string): VolunteerTaskRequest {
  const store = readStore();
  const request = store.taskRequests.find((item) => item.id === requestId && item.status === 'pending');
  if (!request) throw new Error('This volunteer request has already been reviewed.');
  const report = store.reports.find((item) => item.id === request.report_id);
  if (!report) throw new Error('The citizen report could not be found.');

  if (!approved) {
    request.status = 'rejected';
    request.reviewer_id = reviewerId;
    request.reviewed_at = new Date().toISOString();
    request.updated_at = request.reviewed_at;
    writeStore(store);
    return { ...request, report: enrichReport(report), volunteer: demoProfile(request.volunteer_id) };
  }

  if (!['verified', 'prioritized'].includes(report.status) || report.is_duplicate || report.assigned_volunteer_id) {
    throw new Error('This report is no longer eligible for assignment.');
  }
  if (store.tasks.some((item) => item.report_id === report.id)) {
    throw new Error('A task already exists for this report.');
  }
  const volunteer = store.volunteers.find((item) => item.user_id === request.volunteer_id);
  if (!volunteer?.is_verified || volunteer.verification_status !== 'verified' || volunteer.current_workload >= volunteer.max_workload) {
    throw new Error('This volunteer is no longer eligible for the task.');
  }
  const task = demoCreateTask({
    report_id: report.id,
    title: report.title,
    description: report.description,
    category_id: report.category_id || undefined,
    priority_level: report.priority_level || undefined,
    priority_score: report.priority_score || 0,
    affected_people: report.affected_people,
    created_by: reviewerId,
  });
  demoAssignTask(task.id, request.volunteer_id, reviewerId);

  const updatedStore = readStore();
  const updatedRequest = updatedStore.taskRequests.find((item) => item.id === requestId)!;
  const reviewedAt = new Date().toISOString();
  updatedRequest.status = 'approved';
  updatedRequest.reviewer_id = reviewerId;
  updatedRequest.reviewed_at = reviewedAt;
  updatedRequest.updated_at = reviewedAt;
  updatedRequest.task_id = task.id;
  updatedStore.taskRequests.forEach((item) => {
    if (item.report_id === report.id && item.status === 'pending' && item.id !== requestId) {
      item.status = 'rejected';
      item.reviewer_id = reviewerId;
      item.reviewed_at = reviewedAt;
      item.updated_at = reviewedAt;
    }
  });
  writeStore(updatedStore);
  return { ...updatedRequest, report: enrichReport(report), volunteer: demoProfile(request.volunteer_id) };
}

function enrichTask(task: Task): Task {
  const report = demoReportById(task.report_id) || undefined;
  return { ...task, report, category: demoCategories.find((category) => category.id === task.category_id), assignments: task.assignments?.map((assignment) => ({ ...assignment, volunteer: demoProfile(assignment.volunteer_id) })) };
}

export function demoCreateTask(input: { report_id: string; title: string; description?: string; category_id?: string; priority_level?: string; priority_score?: number; required_skills?: string[]; estimated_time_minutes?: number; affected_people?: number; deadline?: string; notes?: string; created_by: string }): Task {
  const store = readStore();
  const task: Task = {
    ...input, id: `demo-task-${Date.now()}`, task_id: `TSK-DEMO${String(store.tasks.length + 1).padStart(2, '0')}`,
    description: input.description || null, category_id: input.category_id || null, priority_level: (input.priority_level || 'medium') as Task['priority_level'], priority_score: input.priority_score || 0,
    required_skills: input.required_skills || [], estimated_time_minutes: input.estimated_time_minutes || 60, affected_people: input.affected_people || 1,
    assignment_type: 'single', status: 'assigned', deadline: input.deadline || null, notes: input.notes || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), assignments: [], evidence: [], history: [],
  };
  store.tasks.unshift(task); writeStore(store); return enrichTask(task);
}

export function demoAssignTask(taskId: string, volunteerId: string, assignedBy: string): TaskAssignment {
  const store = readStore(); const task = store.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error('Demo task not found');
  if (task.assignments?.some((item) => ['assigned', 'accepted'].includes(item.status))) {
    throw new Error('Task already has an active volunteer assignment');
  }
  const volunteer = store.volunteers.find((item) => item.user_id === volunteerId);
  if (!volunteer || !volunteer.is_verified || volunteer.verification_status !== 'verified' || volunteer.current_workload >= volunteer.max_workload) {
    throw new Error('Volunteer is no longer eligible for this task');
  }
  const assignment: TaskAssignment = { id: `demo-assignment-${Date.now()}`, task_id: taskId, volunteer_id: volunteerId, status: 'assigned', assigned_by: assignedBy, accepted_at: null, declined_at: null, decline_reason: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), volunteer: demoProfile(volunteerId) };
  task.assignments = [...(task.assignments || []), assignment];
  task.status = 'assigned';
  task.updated_at = new Date().toISOString();
  const report = store.reports.find((item) => item.id === task.report_id);
  if (report) {
    report.status = 'assigned';
    report.assigned_volunteer_id = volunteerId;
    report.updated_at = new Date().toISOString();
  }
  syncDemoVolunteerWorkload(store, volunteerId);
  writeStore(store);
  return assignment;
}

export function demoUpdateTaskStatus(taskId: string, status: string): void {
  const store = readStore(); const task = store.tasks.find((item) => item.id === taskId);
  if (task) {
    task.status = status as Task['status'];
    task.updated_at = new Date().toISOString();
    if (status === 'completed' || status === 'cancelled' || status === 'rejected') {
      task.assignments = (task.assignments || []).map((assignment) =>
        ['assigned', 'accepted'].includes(assignment.status)
          ? { ...assignment, status: status === 'completed' ? 'completed' : 'cancelled' }
          : assignment
      );
    }
    task.assignments?.forEach((assignment) => syncDemoVolunteerWorkload(store, assignment.volunteer_id));
  }
  writeStore(store);
}

export function demoAddEvidence(taskId: string, evidence: Evidence): void {
  const store = readStore(); const task = store.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error('Demo task not found');
  task.evidence = [...(task.evidence || []), evidence];
  writeStore(store);
}

export function demoAcceptTask(taskId: string, volunteerId: string): { success: boolean; error?: string } {
  const store = readStore(); const task = store.tasks.find((item) => item.id === taskId);
  const assignment = task?.assignments?.find((item) => item.volunteer_id === volunteerId && item.status === 'assigned');
  if (!task || !assignment) return { success: false, error: 'No pending demo assignment found.' };
  if (task.assignments?.some((item) => item.status === 'accepted' && item.volunteer_id !== volunteerId)) {
    return { success: false, error: 'Task already accepted by another volunteer.' };
  }
  assignment.status = 'accepted'; assignment.accepted_at = new Date().toISOString(); task.status = 'accepted'; writeStore(store);
  const report = store.reports.find((item) => item.id === task.report_id); if (report) report.status = 'accepted'; writeStore(store);
  return { success: true };
}

export function demoDeclineTask(taskId: string, volunteerId: string, reason: string): void {
  const store = readStore(); const task = store.tasks.find((item) => item.id === taskId); const assignment = task?.assignments?.find((item) => item.volunteer_id === volunteerId && item.status === 'assigned');
  if (assignment?.status === 'assigned') {
    assignment.status = 'declined';
    assignment.decline_reason = reason;
    assignment.declined_at = new Date().toISOString();
    if (!task?.assignments?.some((item) => ['assigned', 'accepted'].includes(item.status))) {
      if (task) task.status = 'declined';
      const report = store.reports.find((item) => item.id === task?.report_id);
      if (report) {
        report.status = 'assigned';
        report.assigned_volunteer_id = null;
        report.updated_at = new Date().toISOString();
      }
    }
    syncDemoVolunteerWorkload(store, volunteerId);
  }
  writeStore(store);
}

export async function demoUploadEvidence(
  taskId: string,
  volunteerId: string,
  file: File,
  evidenceType: 'before' | 'after',
  notes?: string
): Promise<Evidence> {
  const store = readStore();
  const task = store.tasks.find((item) => item.id === taskId);
  const assignment = task?.assignments?.find((item) => item.volunteer_id === volunteerId && item.status === 'accepted');
  if (!task || !assignment || !['accepted', 'in_progress'].includes(task.status)) {
    throw new Error('Only the assigned volunteer can upload evidence for an active task.');
  }

  const evidenceId = `demo-evidence-${Date.now()}`;
  const evidence: Evidence = {
    id: evidenceId,
    task_id: taskId,
    volunteer_id: volunteerId,
    evidence_type: evidenceType,
    file_url: `demo-media:${evidenceId}`,
    file_name: file.name,
    file_size: file.size,
    file_hash: null,
    storage_path: null,
    notes: notes || null,
    submitted_at: new Date().toISOString(),
  };
  await saveDemoEvidenceFile(evidence.id, file);
  task.evidence = [...(task.evidence || []), evidence];
  task.updated_at = evidence.submitted_at;
  writeStore(store);
  return { ...evidence, file_url: URL.createObjectURL(file) };
}

export function demoCreateVerificationRecord(input: {
  task_id: string;
  verifier_id: string;
  decision: string;
  comments?: string;
  before_hash?: string;
  after_hash?: string;
  hash_match?: boolean;
}): VerificationRecord {
  const store = readStore();
  const record: VerificationRecord = {
    id: `demo-verification-${Date.now()}`,
    task_id: input.task_id,
    verifier_id: input.verifier_id,
    decision: input.decision as VerificationRecord['decision'],
    comments: input.comments || null,
    before_hash: input.before_hash || null,
    after_hash: input.after_hash || null,
    hash_match: input.hash_match ?? null,
    created_at: new Date().toISOString(),
  };
  store.verificationRecords.unshift(record);
  writeStore(store);
  return record;
}

export function demoVerificationRecords(taskId: string): VerificationRecord[] {
  return readStore().verificationRecords.filter((record) => record.task_id === taskId);
}

export function demoInviteUser(input: {
  fullName: string;
  email: string;
  phone?: string;
  role: UserRole;
}): Profile {
  const store = readStore();
  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = store.profiles.find((p) => p.email.toLowerCase() === normalizedEmail);
  if (existing) {
    throw new Error(`A user with email "${input.email}" already exists.`);
  }

  const nowIso = new Date().toISOString();
  const newProfileId = `demo-user-${Date.now()}`;
  const newProfile: Profile = {
    id: newProfileId,
    email: normalizedEmail,
    full_name: input.fullName.trim(),
    phone: input.phone?.trim() || null,
    role: input.role,
    avatar_url: null,
    is_active: true,
    city: 'Demo City',
    area: 'Central Ward',
    created_at: nowIso,
    updated_at: nowIso,
  };
  store.profiles.unshift(newProfile);

  if (input.role === 'volunteer') {
    store.volunteers.unshift({
      id: `vol-${newProfileId}`,
      user_id: newProfileId,
      bio: `Volunteer account created for ${newProfile.full_name}.`,
      service_area: 'Central Ward',
      current_workload: 0,
      max_workload: 5,
      completed_tasks: 0,
      rating: 5.0,
      total_ratings: 0,
      is_verified: true,
      verification_status: 'verified',
      latitude: 17.385,
      longitude: 78.4867,
      created_at: nowIso,
      updated_at: nowIso,
      profile: { ...newProfile },
      skills: [],
      availability: [],
    });
  }

  const currentRole = typeof window !== 'undefined' ? sessionStorage.getItem('civicsync-demo-role') : null;
  const actor = store.profiles.find((p) => p.role === (currentRole || 'admin')) || store.profiles[0];
  const auditEntry: AuditLog = {
    id: `audit-${Date.now()}`,
    actor_id: actor.id,
    action: 'invite_user',
    entity_type: 'profile',
    entity_id: newProfileId,
    result: 'success',
    ip_address: '192.168.1.24',
    created_at: nowIso,
    actor,
    target: newProfile,
    details: {
      invited_role: input.role,
      target_name: newProfile.full_name,
      target_email: newProfile.email,
      target_role: newProfile.role,
      summary: `Invited new ${input.role} account`,
    },
  };
  store.auditLogs.unshift(auditEntry);
  writeStore(store);
  return newProfile;
}

export function demoAuditLogs(limit = 100): AuditLog[] {
  const store = readStore();
  return store.auditLogs.slice(0, limit);
}

export function demoCreateAuditLog(input: {
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  actor_id?: string;
  user_id?: string;
  result?: string;
  ip_address?: string;
}): AuditLog {
  const store = readStore();
  const actorId = input.actor_id || input.user_id || 'demo-admin';
  const actor = store.profiles.find((p) => p.id === actorId);
  let targetProfile: Profile | undefined = undefined;
  if (input.entity_id && (input.entity_type === 'profile' || input.entity_type === 'user')) {
    targetProfile = store.profiles.find((p) => p.id === input.entity_id);
  }

  const log: AuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    actor_id: actorId,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id || null,
    details: input.details || null,
    result: input.result || 'success',
    ip_address: input.ip_address || '192.168.1.24',
    created_at: new Date().toISOString(),
    actor,
    target: targetProfile,
  };
  store.auditLogs.unshift(log);
  writeStore(store);
  return log;
}

export function demoDuplicateCandidates(): DuplicateCandidate[] {
  const store = readStore();
  return (store.duplicateCandidates || [])
    .filter((candidate) => candidate.status === 'pending')
    .map((candidate) => {
      const report = store.reports.find((r) => r.id === candidate.report_id);
      const candidateReport = store.reports.find((r) => r.id === candidate.candidate_report_id);
      return {
        ...candidate,
        report: report ? enrichReport(report) : undefined,
        candidateReport: candidateReport ? enrichReport(candidateReport) : undefined,
      };
    });
}

export function demoCreateDuplicateCandidate(input: {
  report_id: string;
  candidate_report_id: string;
  similarity_type: string;
  similarity_score: number;
  similarity_reasons: string;
}): DuplicateCandidate {
  const store = readStore();
  store.duplicateCandidates = store.duplicateCandidates || [];

  const existingIdx = store.duplicateCandidates.findIndex(
    (c) =>
      (c.report_id === input.report_id && c.candidate_report_id === input.candidate_report_id) ||
      (c.report_id === input.candidate_report_id && c.candidate_report_id === input.report_id)
  );

  const candidate: DuplicateCandidate = {
    id: `demo-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    report_id: input.report_id,
    candidate_report_id: input.candidate_report_id,
    similarity_type: input.similarity_type as SimilarityType,
    similarity_score: input.similarity_score,
    similarity_reasons: input.similarity_reasons,
    status: 'pending',
    reviewer_id: null,
    reviewed_at: null,
    created_at: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    store.duplicateCandidates[existingIdx] = {
      ...store.duplicateCandidates[existingIdx],
      similarity_score: input.similarity_score,
      similarity_reasons: input.similarity_reasons,
      similarity_type: input.similarity_type as SimilarityType,
    };
  } else {
    store.duplicateCandidates.unshift(candidate);
  }

  writeStore(store);
  return {
    ...candidate,
    report: demoReportById(input.report_id) || undefined,
    candidateReport: demoReportById(input.candidate_report_id) || undefined,
  };
}

export function demoResolveDuplicateCandidate(id: string, status: string, reviewerId?: string): void {
  const store = readStore();
  const candidate = (store.duplicateCandidates || []).find((c) => c.id === id);
  if (candidate) {
    candidate.status = status as DuplicateCandidate['status'];
    candidate.reviewer_id = reviewerId || null;
    candidate.reviewed_at = new Date().toISOString();
    writeStore(store);
  }
}

export function demoAddReportMedia(reportId: string, media: ReportMedia): void {
  const store = readStore();
  const report = store.reports.find((r) => r.id === reportId);
  if (report) {
    report.media = [...(report.media || []), media];
    writeStore(store);
  }
}

export function demoReset(): void { sessionStorage.removeItem(STORAGE_KEY); }
