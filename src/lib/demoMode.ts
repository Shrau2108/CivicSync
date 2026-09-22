import type {
  Profile, Report, ReportCategory, ReportLocation, Task, TaskAssignment, Volunteer,
} from '@/types';

const hasSupabaseConfig = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true' || !hasSupabaseConfig;
const STORAGE_KEY = 'civicsync-demo-store-v1';

const now = new Date().toISOString();
const demoProfiles: Profile[] = [
  { id: 'demo-citizen', email: 'citizen@demo.local', full_name: 'Demo Citizen', phone: null, role: 'citizen', avatar_url: null, is_active: true, created_at: now, updated_at: now },
  { id: 'demo-supervisor', email: 'supervisor@demo.local', full_name: 'Demo Supervisor', phone: null, role: 'supervisor', avatar_url: null, is_active: true, created_at: now, updated_at: now },
  { id: 'demo-volunteer', email: 'volunteer@demo.local', full_name: 'Demo Volunteer', phone: null, role: 'volunteer', avatar_url: null, is_active: true, created_at: now, updated_at: now },
];

export const demoCategories: ReportCategory[] = [
  ['Garbage', 'garbage'], ['Road Damage', 'road-damage'], ['Streetlight', 'streetlight'],
  ['Water Leakage', 'water-leakage'], ['Medical', 'medical'], ['Flood Relief', 'flood-relief'],
  ['Education', 'education'], ['Food', 'food'], ['Shelter', 'shelter'], ['Other', 'other'],
].map(([name, slug], index) => ({ id: `demo-category-${index + 1}`, name, slug, icon: null, description: null, is_active: true, created_at: now }));

const demoLocation: ReportLocation = {
  id: 'demo-location-1', report_id: 'demo-report-1', address: 'Main Street near the community park',
  latitude: 17.385, longitude: 78.4867, city: 'Demo City', area: 'Central Ward', postal_code: null, created_at: now,
};

const seedReport: Report = {
  id: 'demo-report-1', report_id: 'RPT-DEMO01', title: 'Pothole near the community park',
  description: 'A large pothole is affecting traffic and pedestrians near the park entrance.', category_id: 'demo-category-2',
  status: 'submitted', severity: 'high', priority_level: 'high', priority_score: 82, affected_people: 24,
  additional_notes: 'Most visible after sunset.', reporter_id: 'demo-citizen', assigned_volunteer_id: null,
  ai_category_confidence: null, ai_category_explanation: null, ai_integration_active: false, is_duplicate: false,
  duplicate_of: null, reviewer_id: null, reviewed_at: null, resolved_at: null, created_at: now, updated_at: now,
  category: demoCategories[1], reporter: demoProfiles[0], location: demoLocation,
};

type DemoStore = { reports: Report[]; tasks: Task[]; volunteers: Volunteer[] };

function initialStore(): DemoStore {
  return {
    reports: [seedReport],
    tasks: [],
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
    return stored ? JSON.parse(stored) as DemoStore : initialStore();
  } catch {
    return initialStore();
  }
}

function writeStore(store: DemoStore): DemoStore {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  return store;
}

export function demoProfile(id: string): Profile {
  return demoProfiles.find((profile) => profile.id === id) || demoProfiles[0];
}

export function demoRoleProfile(role: 'citizen' | 'supervisor' | 'volunteer'): Profile {
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
  return { ...report, category: demoCategories.find((category) => category.id === report.category_id), reporter: demoProfile(report.reporter_id) };
}

export function demoCreateReport(input: { title: string; description: string; category_id: string; severity: string; affected_people: number; additional_notes?: string; reporter_id: string }): Report {
  const store = readStore();
  const report: Report = {
    ...input, additional_notes: input.additional_notes || null, id: `demo-report-${Date.now()}`, report_id: `RPT-DEMO${String(store.reports.length + 1).padStart(2, '0')}`,
    category_id: input.category_id, status: 'submitted', severity: input.severity as Report['severity'], priority_level: input.severity as Report['priority_level'],
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

export function demoVolunteers(): Volunteer[] { return readStore().volunteers; }

export function demoTasks(): Task[] { return readStore().tasks.map(enrichTask); }
export function demoTasksForVolunteer(volunteerId: string): Task[] {
  return demoTasks().filter((task) => task.assignments?.some((assignment) => assignment.volunteer_id === volunteerId));
}
export function demoTaskById(id: string): Task | null {
  const task = demoTasks().find((item) => item.id === id);
  return task || null;
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
  const assignment: TaskAssignment = { id: `demo-assignment-${Date.now()}`, task_id: taskId, volunteer_id: volunteerId, status: 'assigned', assigned_by: assignedBy, accepted_at: null, declined_at: null, decline_reason: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), volunteer: demoProfile(volunteerId) };
  task.assignments = [...(task.assignments || []), assignment]; writeStore(store); return assignment;
}

export function demoUpdateTaskStatus(taskId: string, status: string): void {
  const store = readStore(); const task = store.tasks.find((item) => item.id === taskId);
  if (task) { task.status = status as Task['status']; task.updated_at = new Date().toISOString(); }
  writeStore(store);
}

export function demoAcceptTask(taskId: string, volunteerId: string): { success: boolean; error?: string } {
  const store = readStore(); const task = store.tasks.find((item) => item.id === taskId);
  const assignment = task?.assignments?.find((item) => item.volunteer_id === volunteerId);
  if (!task || !assignment) return { success: false, error: 'No demo assignment found.' };
  assignment.status = 'accepted'; assignment.accepted_at = new Date().toISOString(); task.status = 'accepted'; writeStore(store);
  const report = store.reports.find((item) => item.id === task.report_id); if (report) report.status = 'accepted'; writeStore(store);
  return { success: true };
}

export function demoDeclineTask(taskId: string, volunteerId: string, reason: string): void {
  const store = readStore(); const task = store.tasks.find((item) => item.id === taskId); const assignment = task?.assignments?.find((item) => item.volunteer_id === volunteerId);
  if (assignment) { assignment.status = 'declined'; assignment.decline_reason = reason; assignment.declined_at = new Date().toISOString(); } writeStore(store);
}

export function demoReset(): void { sessionStorage.removeItem(STORAGE_KEY); }
