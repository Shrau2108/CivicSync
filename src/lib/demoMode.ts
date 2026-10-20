import { isSupabaseConfigured } from '@/lib/supabase';
import type {
  Evidence, Profile, Report, ReportCategory, ReportLocation, Task, TaskAssignment, VerificationRecord, Volunteer, VolunteerTaskRequest,
} from '@/types';

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.VITE_DEMO_MODE === 'true') return true;
  if (!isSupabaseConfigured) return true;

  // If a real authenticated Supabase session exists in localStorage, NEVER use demo mode
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const item = localStorage.getItem(key);
        if (item && item.includes('"access_token"') && item.includes('"user"')) {
          return false;
        }
      }
    }
  } catch {
    // ignore localStorage errors
  }

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
  { id: 'demo-citizen', email: 'citizen@demo.local', full_name: 'Demo Citizen', phone: null, role: 'citizen', avatar_url: null, is_active: true, created_at: now, updated_at: now },
  { id: 'demo-supervisor', email: 'supervisor@demo.local', full_name: 'Demo Supervisor', phone: null, role: 'supervisor', avatar_url: null, is_active: true, created_at: now, updated_at: now },
  { id: 'demo-volunteer', email: 'volunteer@demo.local', full_name: 'Demo Volunteer', phone: null, role: 'volunteer', avatar_url: null, is_active: true, created_at: now, updated_at: now },
  { id: 'demo-admin', email: 'admin@demo.local', full_name: 'Demo Administrator', phone: null, role: 'admin', avatar_url: null, is_active: true, created_at: now, updated_at: now },
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

const seedReport: Report = {
  id: 'demo-report-1', report_id: 'RPT-DEMO01', title: 'Pothole near the community park',
  description: 'A large pothole is affecting traffic and pedestrians near the park entrance.', category_id: '19a1adbd-3484-4871-8859-4fadb3833e02',
  status: 'submitted', severity: 'high', urgency: 'high', priority_level: 'high', priority_score: 82, affected_people: 24,
  additional_notes: 'Most visible after sunset.', reporter_id: 'demo-citizen', assigned_volunteer_id: null,
  ai_category_confidence: null, ai_category_explanation: null, ai_integration_active: false, is_duplicate: false,
  duplicate_of: null, reviewer_id: null, reviewed_at: null, resolved_at: null, created_at: now, updated_at: now,
  category: demoCategories[1], reporter: demoProfiles[0], location: demoLocation,
};

type DemoStore = {
  reports: Report[];
  tasks: Task[];
  volunteers: Volunteer[];
  taskRequests: VolunteerTaskRequest[];
  verificationRecords: VerificationRecord[];
};

function initialStore(): DemoStore {
  return {
    reports: [seedReport],
    tasks: [],
    taskRequests: [],
    verificationRecords: [],
    volunteers: [{
      id: 'demo-volunteer-record', user_id: 'demo-volunteer', bio: 'Ready to help improve Demo City.', service_area: 'Central Ward',
      current_workload: 0, max_workload: 5, completed_tasks: 0, rating: 4.9, total_ratings: 12,
      is_verified: true, verification_status: 'verified', latitude: 17.385, longitude: 78.4867,
      created_at: now, updated_at: now, profile: demoProfiles[2], skills: [], availability: [],
    }],
  };
}

function readStore(): DemoStore {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return initialStore();
    const store = JSON.parse(stored) as Partial<DemoStore>;
    return {
      ...initialStore(),
      ...store,
      taskRequests: store.taskRequests || [],
      verificationRecords: store.verificationRecords || [],
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
  return demoProfiles.find((profile) => profile.id === id) || demoProfiles[0];
}

export function demoAllProfiles(): Profile[] {
  return demoProfiles;
}

export function demoRoleProfile(role: 'citizen' | 'supervisor' | 'volunteer' | 'admin'): Profile {
  return demoProfiles.find((profile) => profile.role === role) || demoProfiles[0];
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
  store.volunteers.forEach((volunteer) => syncDemoVolunteerWorkload(store, volunteer.user_id));
  writeStore(store);
  return store.volunteers;
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

export function demoReset(): void { sessionStorage.removeItem(STORAGE_KEY); }
