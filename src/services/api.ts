import { supabase, STORAGE_BUCKET } from '@/lib/supabase';
import type {
  Report, ReportCategory, ReportLocation, ReportMedia, Task, TaskAssignment,
  Volunteer, VolunteerSkill, Notification, Feedback, AuditLog, DuplicateCandidate,
  VerificationRecord, Evidence, TaskStatusHistory, PriorityScore, SystemSetting,
  VolunteerAvailability,
} from '@/types';
import { computeFileHash } from '@/lib/duplicateDetection';
import { DEMO_MODE, demoCategories, demoReports, demoReportsByReporter, demoReportById, demoCreateReport, demoCreateLocation, demoUpdateReportStatus, demoVolunteers, demoTasks, demoTasksForVolunteer, demoTaskById, demoCreateTask, demoAssignTask, demoUpdateTaskStatus, demoAcceptTask, demoDeclineTask } from '@/lib/demoMode';

// ============================================================
// CATEGORIES
// ============================================================
export async function fetchCategories(): Promise<ReportCategory[]> {
  if (DEMO_MODE) return demoCategories;
  const { data, error } = await supabase
    .from('report_categories')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data as ReportCategory[];
}

// ============================================================
// REPORTS
// ============================================================
export async function fetchReports(filters?: {
  status?: string;
  category_id?: string;
  priority_level?: string;
}): Promise<Report[]> {
  if (DEMO_MODE) return demoReports(filters);
  let query = supabase
    .from('reports')
    .select(`
      *,
      category:report_categories(*),
      reporter:profiles!reports_reporter_id_fkey(*),
      location:report_locations(*)
    `)
    .order('created_at', { ascending: false });

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.category_id) query = query.eq('category_id', filters.category_id);
  if (filters?.priority_level) query = query.eq('priority_level', filters.priority_level);

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as Report[];
}

export async function fetchReportById(id: string): Promise<Report | null> {
  if (DEMO_MODE) return demoReportById(id);
  const { data, error } = await supabase
    .from('reports')
    .select(`
      *,
      category:report_categories(*),
      reporter:profiles!reports_reporter_id_fkey(*),
      location:report_locations(*),
      media:report_media(*)
    `)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Report | null;
}

export async function fetchReportsByReporter(reporterId: string): Promise<Report[]> {
  if (DEMO_MODE) return demoReportsByReporter(reporterId);
  const { data, error } = await supabase
    .from('reports')
    .select(`
      *,
      category:report_categories(*),
      location:report_locations(*)
    `)
    .eq('reporter_id', reporterId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as Report[];
}

export async function createReport(input: {
  title: string;
  description: string;
  category_id: string;
  severity: string;
  affected_people: number;
  additional_notes?: string;
  reporter_id: string;
}): Promise<Report> {
  if (DEMO_MODE) return demoCreateReport(input);
  const { data, error } = await supabase
    .from('reports')
    .insert({
      title: input.title,
      description: input.description,
      category_id: input.category_id,
      severity: input.severity,
      affected_people: input.affected_people,
      additional_notes: input.additional_notes || null,
      reporter_id: input.reporter_id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Report;
}

export async function updateReportStatus(reportId: string, status: string, reviewerId?: string): Promise<void> {
  if (DEMO_MODE) { demoUpdateReportStatus(reportId, status, reviewerId); return; }
  const updates: Record<string, unknown> = { status };
  if (reviewerId) {
    updates.reviewer_id = reviewerId;
    updates.reviewed_at = new Date().toISOString();
  }
  if (status === 'resolved') {
    updates.resolved_at = new Date().toISOString();
  }
  const { error } = await supabase.from('reports').update(updates).eq('id', reportId);
  if (error) throw error;
}

export async function updateReportPriority(reportId: string, priorityLevel: string, priorityScore: number): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .update({ priority_level: priorityLevel, priority_score: priorityScore })
    .eq('id', reportId);
  if (error) throw error;
}

export async function markDuplicate(reportId: string, duplicateOf: string): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .update({ is_duplicate: true, duplicate_of: duplicateOf, status: 'duplicate' })
    .eq('id', reportId);
  if (error) throw error;
}

// ============================================================
// REPORT LOCATION
// ============================================================
export async function createReportLocation(input: {
  report_id: string;
  address?: string;
  latitude: number;
  longitude: number;
  city?: string;
  area?: string;
  postal_code?: string;
}): Promise<void> {
  if (DEMO_MODE) {
    demoCreateLocation(input.report_id, { address: input.address || null, latitude: input.latitude, longitude: input.longitude, city: input.city || null, area: input.area || null, postal_code: input.postal_code || null });
    return;
  }
  const { error } = await supabase.from('report_locations').insert(input);
  if (error) throw error;
}

// ============================================================
// REPORT MEDIA
// ============================================================
export async function uploadReportMedia(
  reportId: string,
  file: File,
  reporterId: string
): Promise<ReportMedia> {
  if (DEMO_MODE) return { id: `demo-media-${Date.now()}`, report_id: reportId, file_url: URL.createObjectURL(file), file_type: file.type.startsWith('video') ? 'video' : 'image', file_name: file.name, file_size: file.size, file_hash: null, storage_path: null, created_at: new Date().toISOString() };
  const fileExt = file.name.split('.').pop();
  const fileName = `${reportId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, file);
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
  const fileHash = await computeFileHash(file);

  const { data, error } = await supabase
    .from('report_media')
    .insert({
      report_id: reportId,
      file_url: urlData.publicUrl,
      file_type: file.type.startsWith('video') ? 'video' : 'image',
      file_name: file.name,
      file_size: file.size,
      file_hash: fileHash,
      storage_path: fileName,
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as ReportMedia;
}

export async function deleteReportMedia(mediaId: string, storagePath: string): Promise<void> {
  await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
  await supabase.from('report_media').delete().eq('id', mediaId);
}

// ============================================================
// DUPLICATE CANDIDATES
// ============================================================
export async function fetchDuplicateCandidates(): Promise<DuplicateCandidate[]> {
  const { data, error } = await supabase
    .from('duplicate_candidates')
    .select(`
      *,
      report:reports!duplicate_candidates_report_id_fkey(*),
      candidateReport:reports!duplicate_candidates_candidate_report_id_fkey(*)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as DuplicateCandidate[];
}

export async function createDuplicateCandidate(input: {
  report_id: string;
  candidate_report_id: string;
  similarity_type: string;
  similarity_score: number;
  similarity_reasons: string;
}): Promise<void> {
  const { error } = await supabase.from('duplicate_candidates').insert({
    ...input,
    status: 'pending',
  });
  if (error) throw error;
}

export async function resolveDuplicateCandidate(id: string, status: string, reviewerId: string): Promise<void> {
  const { error } = await supabase
    .from('duplicate_candidates')
    .update({ status, reviewer_id: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ============================================================
// PRIORITY SCORES
// ============================================================
export async function fetchPriorityScores(): Promise<PriorityScore[]> {
  const { data, error } = await supabase
    .from('priority_scores')
    .select('*')
    .order('total_score', { ascending: false });
  if (error) throw error;
  return data as unknown as PriorityScore[];
}

export async function savePriorityScore(input: {
  report_id: string;
  severity_weight: number;
  urgency_weight: number;
  affected_people_weight: number;
  waiting_time_weight: number;
  total_score: number;
  factors: Record<string, number>;
}): Promise<void> {
  const { error } = await supabase.from('priority_scores').insert(input);
  if (error) throw error;
}

// ============================================================
// VOLUNTEERS
// ============================================================
export async function fetchVolunteers(): Promise<Volunteer[]> {
  if (DEMO_MODE) return demoVolunteers();
  const { data, error } = await supabase
    .from('volunteers')
    .select(`
      *,
      profile:profiles!volunteers_user_id_fkey(*),
      skills:volunteer_skills(*),
      availability:volunteer_availability(*)
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as Volunteer[];
}

export async function fetchVolunteerByUserId(userId: string): Promise<Volunteer | null> {
  if (DEMO_MODE) return demoVolunteers().find((volunteer) => volunteer.user_id === userId) || null;
  const { data, error } = await supabase
    .from('volunteers')
    .select(`
      *,
      profile:profiles!volunteers_user_id_fkey(*),
      skills:volunteer_skills(*),
      availability:volunteer_availability(*)
    `)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Volunteer | null;
}

export async function createVolunteer(input: {
  user_id: string;
  bio?: string;
  service_area?: string;
  latitude?: number;
  longitude?: number;
}): Promise<Volunteer> {
  const { data, error } = await supabase
    .from('volunteers')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Volunteer;
}

export async function updateVolunteer(id: string, updates: Partial<Volunteer>): Promise<void> {
  const { error } = await supabase.from('volunteers').update(updates).eq('id', id);
  if (error) throw error;
}

export async function addVolunteerSkill(volunteerId: string, skill: string, proficiency: string): Promise<void> {
  const { error } = await supabase
    .from('volunteer_skills')
    .insert({ volunteer_id: volunteerId, skill, proficiency });
  if (error) throw error;
}

export async function removeVolunteerSkill(skillId: string): Promise<void> {
  const { error } = await supabase.from('volunteer_skills').delete().eq('id', skillId);
  if (error) throw error;
}

export async function addVolunteerAvailability(volunteerId: string, dayOfWeek: string, startTime: string, endTime: string): Promise<void> {
  const { error } = await supabase
    .from('volunteer_availability')
    .insert({ volunteer_id: volunteerId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime });
  if (error) throw error;
}

export async function removeVolunteerAvailability(availId: string): Promise<void> {
  const { error } = await supabase.from('volunteer_availability').delete().eq('id', availId);
  if (error) throw error;
}

// ============================================================
// TASKS
// ============================================================
export async function fetchTasks(filters?: { status?: string }): Promise<Task[]> {
  if (DEMO_MODE) return demoTasks().filter((task) => !filters?.status || task.status === filters.status);
  let query = supabase
    .from('tasks')
    .select(`
      *,
      report:reports(*),
      category:report_categories(*),
      assignments:task_assignments(*, volunteer:profiles!task_assignments_volunteer_id_fkey(*)),
      evidence:evidence(*)
    `)
    .order('created_at', { ascending: false });

  if (filters?.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as Task[];
}

export async function fetchTaskById(id: string): Promise<Task | null> {
  if (DEMO_MODE) return demoTaskById(id);
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      report:reports(*, category:report_categories(*), location:report_locations(*)),
      category:report_categories(*),
      assignments:task_assignments(*, volunteer:profiles!task_assignments_volunteer_id_fkey(*)),
      evidence:evidence(*),
      history:task_status_history(*, changedByUser:profiles!task_status_history_changed_by_fkey(*))
    `)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Task | null;
}

export async function fetchTasksForVolunteer(volunteerId: string): Promise<Task[]> {
  if (DEMO_MODE) return demoTasksForVolunteer(volunteerId);
  const { data: assignments } = await supabase
    .from('task_assignments')
    .select('task_id')
    .eq('volunteer_id', volunteerId);

  if (!assignments || assignments.length === 0) return [];

  const taskIds = assignments.map((a) => a.task_id);
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      report:reports(*, category:report_categories(*), location:report_locations(*)),
      category:report_categories(*),
      assignments:task_assignments(*, volunteer:profiles!task_assignments_volunteer_id_fkey(*))
    `)
    .in('id', taskIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as Task[];
}

export async function fetchAvailableTasks(): Promise<Task[]> {
  if (DEMO_MODE) return demoTasks().filter((task) => ['assigned', 'accepted'].includes(task.status));
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      report:reports(*, category:report_categories(*), location:report_locations(*)),
      category:report_categories(*),
      assignments:task_assignments(*)
    `)
    .in('status', ['assigned', 'accepted'])
    .order('priority_score', { ascending: false });
  if (error) throw error;
  return data as unknown as Task[];
}

export async function createTask(input: {
  report_id: string;
  title: string;
  description?: string;
  category_id?: string;
  priority_level?: string;
  priority_score?: number;
  required_skills?: string[];
  estimated_time_minutes?: number;
  affected_people?: number;
  deadline?: string;
  notes?: string;
  created_by: string;
}): Promise<Task> {
  if (DEMO_MODE) return demoCreateTask(input);
  const { data, error } = await supabase
    .from('tasks')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Task;
}

export async function updateTaskStatus(taskId: string, status: string, changedBy: string, reason?: string): Promise<void> {
  if (DEMO_MODE) { demoUpdateTaskStatus(taskId, status); return; }
  const { data: task } = await supabase
    .from('tasks')
    .select('status')
    .eq('id', taskId)
    .maybeSingle();

  const fromStatus = task?.status || null;

  const { error: updateError } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', taskId);
  if (updateError) throw updateError;

  await supabase.from('task_status_history').insert({
    task_id: taskId,
    from_status: fromStatus,
    to_status: status,
    changed_by: changedBy,
    reason: reason || null,
  });
}

// ============================================================
// TASK ASSIGNMENTS
// ============================================================
export async function assignTask(taskId: string, volunteerId: string, assignedBy: string): Promise<TaskAssignment> {
  if (DEMO_MODE) return demoAssignTask(taskId, volunteerId, assignedBy);
  const { data, error } = await supabase
    .from('task_assignments')
    .insert({
      task_id: taskId,
      volunteer_id: volunteerId,
      assigned_by: assignedBy,
      status: 'assigned',
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as TaskAssignment;
}

export async function acceptTask(taskId: string, volunteerId: string): Promise<{ success: boolean; error?: string }> {
  if (DEMO_MODE) return demoAcceptTask(taskId, volunteerId);
  const { data, error } = await supabase.rpc('accept_task_atomic', {
    p_task_id: taskId,
    p_volunteer_id: volunteerId,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, ...(data as Record<string, unknown>) };
}

export async function declineTask(taskId: string, volunteerId: string, reason: string): Promise<void> {
  if (DEMO_MODE) { demoDeclineTask(taskId, volunteerId, reason); return; }
  const { error } = await supabase
    .from('task_assignments')
    .update({
      status: 'declined',
      declined_at: new Date().toISOString(),
      decline_reason: reason,
    })
    .eq('task_id', taskId)
    .eq('volunteer_id', volunteerId);
  if (error) throw error;
}

// ============================================================
// EVIDENCE
// ============================================================
export async function uploadEvidence(
  taskId: string,
  volunteerId: string,
  file: File,
  evidenceType: 'before' | 'after',
  notes?: string
): Promise<Evidence> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${taskId}/${evidenceType}-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, file);
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
  const fileHash = await computeFileHash(file);

  const { data, error } = await supabase
    .from('evidence')
    .insert({
      task_id: taskId,
      volunteer_id: volunteerId,
      evidence_type: evidenceType,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
      file_hash: fileHash,
      storage_path: fileName,
      notes,
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Evidence;
}

export async function fetchEvidenceForTask(taskId: string): Promise<Evidence[]> {
  const { data, error } = await supabase
    .from('evidence')
    .select('*')
    .eq('task_id', taskId)
    .order('submitted_at', { ascending: true });
  if (error) throw error;
  return data as unknown as Evidence[];
}

// ============================================================
// VERIFICATION
// ============================================================
export async function createVerificationRecord(input: {
  task_id: string;
  verifier_id: string;
  decision: string;
  comments?: string;
  before_hash?: string;
  after_hash?: string;
  hash_match?: boolean;
}): Promise<void> {
  const { error } = await supabase.from('verification_records').insert(input);
  if (error) throw error;
}

export async function fetchVerificationRecords(taskId: string): Promise<VerificationRecord[]> {
  const { data, error } = await supabase
    .from('verification_records')
    .select('*, verifier:profiles!verification_records_verifier_id_fkey(*)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as VerificationRecord[];
}

// ============================================================
// NOTIFICATIONS
// ============================================================
export async function fetchNotifications(userId: string): Promise<Notification[]> {
  if (DEMO_MODE) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as Notification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  if (DEMO_MODE) return;
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (DEMO_MODE) return;
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
}

export async function createNotification(input: {
  user_id: string;
  title: string;
  description?: string;
  category: string;
  related_report_id?: string;
  related_task_id?: string;
}): Promise<void> {
  if (DEMO_MODE) return;
  const { error } = await supabase.from('notifications').insert(input);
  if (error) throw error;
}

// ============================================================
// FEEDBACK
// ============================================================
export async function createFeedback(input: {
  report_id: string;
  citizen_id: string;
  rating: number;
  comments?: string;
  request_reopen?: boolean;
  reopen_reason?: string;
}): Promise<void> {
  if (DEMO_MODE) return;
  const { error } = await supabase.from('feedback').insert(input);
  if (error) throw error;
}

export async function fetchFeedbackForReport(reportId: string): Promise<Feedback[]> {
  if (DEMO_MODE) return [];
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as Feedback[];
}

// ============================================================
// AUDIT LOGS
// ============================================================
export async function fetchAuditLogs(limit = 50): Promise<AuditLog[]> {
  if (DEMO_MODE) return [];
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, actor:profiles!audit_logs_actor_id_fkey(*)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as unknown as AuditLog[];
}

export async function createAuditLog(input: {
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  if (DEMO_MODE) return;
  const { error } = await supabase.from('audit_logs').insert(input);
  if (error) throw error;
}

// ============================================================
// SYSTEM SETTINGS
// ============================================================
export async function fetchSystemSettings(): Promise<SystemSetting[]> {
  const { data, error } = await supabase.from('system_settings').select('*');
  if (error) throw error;
  return data as unknown as SystemSetting[];
}

export async function updateSystemSetting(key: string, value: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from('system_settings')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('key', key);
  if (error) throw error;
}

// ============================================================
// PROFILES
// ============================================================
export async function fetchAllProfiles(): Promise<import('@/types').Profile[]> {
  if (DEMO_MODE) return demoVolunteers().map((volunteer) => volunteer.profile!).filter(Boolean);
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as import('@/types').Profile[];
}

export async function updateProfile(id: string, updates: Partial<import('@/types').Profile>): Promise<void> {
  const { error } = await supabase.from('profiles').update(updates).eq('id', id);
  if (error) throw error;
}
