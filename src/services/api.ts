import { supabase, STORAGE_BUCKET } from '@/lib/supabase';

import type {
  Report, ReportCategory, ReportMedia, Task, TaskAssignment,
  Volunteer, Notification, Feedback, AuditLog, DuplicateCandidate,
  VerificationRecord, Evidence, PriorityScore, SystemSetting, VolunteerTaskRequest, Profile,
} from '@/types';

import { computeFileHash } from '@/lib/duplicateDetection';
import { matchVolunteersToTask } from '@/lib/volunteerMatching';

import {
  isDemoMode,
  demoCategories,
  demoReports,
  demoReportsByReporter,
  demoReportById,
  demoCreateReport,
  demoCreateLocation,
  demoUpdateReportStatus,
  demoUpdateReportPriority,
  demoVolunteers,
  demoTasks,
  demoTasksForVolunteer,
  demoTaskById,
  demoCreateTask,
  demoAssignTask,
  demoUpdateTaskStatus,
  demoAcceptTask,
  demoDeclineTask,
  demoVolunteerTaskRequests,
  demoSubmitVolunteerTaskRequest,
  demoReviewVolunteerTaskRequest,
  demoUploadEvidence,
  demoCreateVerificationRecord,
  demoVerificationRecords,
  demoHydrateTaskMedia,
  demoAllProfiles,
  demoUpdateProfile,
  demoUpdateVolunteer,
  demoCreateVolunteer,
  demoAddVolunteerSkill,
  demoRemoveVolunteerSkill,
  demoInviteUser,
  demoAuditLogs,
  demoCreateAuditLog,
  demoDuplicateCandidates,
  demoCreateDuplicateCandidate,
  demoResolveDuplicateCandidate,
  demoAddReportMedia,
} from '@/lib/demoMode';

// ============================================================
// CATEGORIES
// ============================================================
export async function fetchCategories(): Promise<ReportCategory[]> {
  if (isDemoMode()) return demoCategories;
  const { data, error } = await supabase
    .from('report_categories')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return (data || []) as ReportCategory[];
}

// ============================================================
// REPORTS
// ============================================================
export async function fetchReports(filters?: {
  status?: string;
  category_id?: string;
  priority_level?: string;
}): Promise<Report[]> {
  if (isDemoMode()) return demoReports(filters);
  let query = supabase
    .from('reports')
    .select(`
      *,
      category:report_categories(*),
      location:report_locations(*),
      media:report_media(*)
    `)
    .order('created_at', { ascending: false });

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.category_id) query = query.eq('category_id', filters.category_id);
  if (filters?.priority_level) query = query.eq('priority_level', filters.priority_level);

  const { data, error } = await query;
  if (error) throw error;

  const reports = (data || []) as unknown as Report[];
  const reporterIds = [...new Set(reports.map(r => r.reporter_id).filter(Boolean))];
  if (reporterIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', reporterIds);
    if (profilesError) throw profilesError;
    reports.forEach(r => {
      r.reporter = profiles?.find(p => p.id === r.reporter_id);
    });
  }
  return reports;
}

export async function fetchAllReports(): Promise<Report[]> {
  if (isDemoMode()) return demoReports();
  const pageSize = 1000;
  const reports: Report[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('reports')
      .select('*, category:report_categories(*), location:report_locations(*), media:report_media(*)')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data || []) as unknown as Report[];
    reports.push(...page);
    if (page.length < pageSize) return reports;
  }
}

export async function fetchReportById(id: string): Promise<Report | null> {
  if (isDemoMode()) return demoReportById(id);
  const { data, error } = await supabase
    .from('reports')
    .select(`
      *,
      category:report_categories(*),
      location:report_locations(*),
      media:report_media(*)
    `)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const report = data as unknown as Report;
  if (report.reporter_id) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', report.reporter_id).maybeSingle();
    if (profile) report.reporter = profile;
  }

  return report as unknown as Report;
}

export async function fetchReportsByReporter(reporterId: string): Promise<Report[]> {
  if (isDemoMode()) return demoReportsByReporter(reporterId);
  const { data, error } = await supabase
    .from('reports')
    .select(`
      *,
      category:report_categories(*),
      location:report_locations(*),
      media:report_media(*)
    `)
    .eq('reporter_id', reporterId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as Report[];
}

export async function createReport(input: {
  title: string;
  description: string;
  category_id: string;
  severity: string;
  urgency?: string;
  affected_people: number;
  additional_notes?: string;
  reporter_id: string;
}): Promise<Report> {
  if (isDemoMode()) return demoCreateReport(input);

  const { data, error } = await supabase
    .from('reports')
    .insert({
      title: input.title,
      description: input.description,
      category_id: input.category_id,
      severity: input.severity,
      urgency: input.urgency || 'medium',
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
  if (isDemoMode()) { demoUpdateReportStatus(reportId, status, reviewerId); return; }
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

export async function reviewReport(
  reportId: string,
  status: 'under_review' | 'verified' | 'rejected',
  reviewerId: string
): Promise<void> {
  if (isDemoMode()) {
    demoUpdateReportStatus(reportId, status, reviewerId);
    return;
  }
  const { error } = await supabase.rpc('review_report', {
    p_report_id: reportId,
    p_status: status,
  });
  if (error) throw error;
}

export async function verifyReportAsAnalyst(
  reportId: string
): Promise<{ notifiedSupervisors: number; demo: boolean }> {
  if (isDemoMode()) {
    demoUpdateReportStatus(reportId, 'verified');
    return { notifiedSupervisors: 0, demo: true };
  }

  const { data, error } = await supabase.rpc('analyst_verify_report', {
    p_report_id: reportId,
  });
  if (error) throw error;
  return {
    notifiedSupervisors: Number(data?.notified_supervisors ?? 0),
    demo: false,
  };
}

export async function updateReportPriority(reportId: string, priorityLevel: string, priorityScore: number, urgency?: string): Promise<void> {
  if (isDemoMode()) {
    demoUpdateReportPriority(reportId, priorityLevel, priorityScore, urgency);
    return;
  }
  const { error } = await supabase.rpc('update_report_priority', {
    p_report_id: reportId,
    p_priority_level: priorityLevel,
    p_priority_score: priorityScore,
    p_urgency: urgency ?? null,
  });
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
  if (isDemoMode()) {
    demoCreateLocation(input.report_id, { address: input.address || null, latitude: input.latitude, longitude: input.longitude, city: input.city || null, area: input.area || null, postal_code: input.postal_code || null });
    return;
  }

  const { error } = await supabase
    .from('report_locations')
    .upsert(input, { onConflict: 'report_id' });
  if (error) throw error;
}

// ============================================================
// REPORT MEDIA
// ============================================================
export async function uploadReportMedia(
  reportId: string,
  file: File
): Promise<ReportMedia> {
  if (isDemoMode()) {
    const fileHash = await computeFileHash(file);
    let fileUrl = '';
    try {
      fileUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(URL.createObjectURL(file));
        reader.readAsDataURL(file);
      });
    } catch {
      fileUrl = URL.createObjectURL(file);
    }
    const media: ReportMedia = {
      id: `demo-media-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      report_id: reportId,
      file_url: fileUrl,
      file_type: file.type.startsWith('video') ? 'video' : 'image',
      file_name: file.name,
      file_size: file.size,
      file_hash: fileHash,
      storage_path: null,
      created_at: new Date().toISOString(),
    };
    demoAddReportMedia(reportId, media);
    return media;
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${reportId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  const storage = supabase.storage.from(STORAGE_BUCKET);
  const { error: uploadError } = await storage.upload(fileName, file);
  if (uploadError) throw uploadError;

  const { data: urlData } = storage.getPublicUrl(fileName);
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
  if (error) {
    const { error: cleanupError } = await storage.remove([fileName]);
    if (cleanupError) {
      console.error('Could not remove uploaded media after metadata insert failed:', cleanupError.message);
    }
    throw error;
  }
  return data as unknown as ReportMedia;
}

export async function deleteReportMedia(mediaId: string, storagePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
  if (storageError) throw storageError;
  const { error } = await supabase.from('report_media').delete().eq('id', mediaId);
  if (error) throw error;
}

// ============================================================
// DUPLICATE CANDIDATES
// ============================================================
export async function fetchDuplicateCandidates(): Promise<DuplicateCandidate[]> {
  if (isDemoMode()) {
    return demoDuplicateCandidates();
  }

  try {
    const { data, error } = await supabase
      .from('duplicate_candidates')
      .select(`
        *,
        report:reports!duplicate_candidates_report_id_fkey(
          *,
          category:report_categories(*),
          location:report_locations(*),
          media:report_media(*)
        ),
        candidateReport:reports!duplicate_candidates_candidate_report_id_fkey(
          *,
          category:report_categories(*),
          location:report_locations(*),
          media:report_media(*)
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!error && data) {
      return data as unknown as DuplicateCandidate[];
    }
  } catch (err) {
    console.warn('Nested query on duplicate_candidates failed, falling back to basic join:', err);
  }

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
  return (data || []) as unknown as DuplicateCandidate[];
}

export async function createDuplicateCandidate(input: {
  report_id: string;
  candidate_report_id: string;
  similarity_type: string;
  similarity_score: number;
  similarity_reasons: string;
}): Promise<void> {
  if (isDemoMode()) {
    demoCreateDuplicateCandidate(input);
    return;
  }
  const { error } = await supabase.from('duplicate_candidates').insert({
    ...input,
    status: 'pending',
  });
  if (error) throw error;
}

export async function resolveDuplicateCandidate(id: string, status: string, reviewerId: string): Promise<void> {
  if (isDemoMode()) {
    demoResolveDuplicateCandidate(id, status, reviewerId);
    return;
  }
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

async function hydrateProfiles(userIds: (string | undefined | null)[]): Promise<Record<string, Profile>> {
  const unique = [...new Set(userIds.filter(Boolean) as string[])];
  if (unique.length === 0) return {};
  const { data, error } = await supabase.from('profiles').select('*').in('id', unique);
  if (error) throw error;
  return Object.fromEntries((data || []).map((profile) => [profile.id, profile as Profile]));
}

// ============================================================
// VOLUNTEERS
// ============================================================
export async function fetchVolunteers(): Promise<Volunteer[]> {
  if (isDemoMode()) return demoVolunteers();
  const { data, error } = await supabase
    .from('volunteers')
    .select(`
      *,
      skills:volunteer_skills(*),
      availability:volunteer_availability(*)
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const volunteers = data || [];
  const profileMap = await hydrateProfiles(volunteers.map((volunteer) => volunteer.user_id));
  return volunteers.map((volunteer) => ({
    ...volunteer,
    profile: profileMap[volunteer.user_id] || null,
  })) as Volunteer[];
}

export async function fetchVolunteerByUserId(userId: string): Promise<Volunteer | null> {
  if (isDemoMode()) return demoVolunteers().find((volunteer) => volunteer.user_id === userId) || null;
  const { data, error } = await supabase
    .from('volunteers')
    .select(`
      *,
      skills:volunteer_skills(*),
      availability:volunteer_availability(*)
    `)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const profileMap = await hydrateProfiles([userId]);
  return {
    ...data,
    profile: profileMap[userId] || null,
  } as unknown as Volunteer;
}

export async function createVolunteer(input: {
  user_id: string;
  bio?: string;
  service_area?: string;
  latitude?: number;
  longitude?: number;
}): Promise<Volunteer> {
  if (isDemoMode()) return demoCreateVolunteer(input);
  const { data, error } = await supabase
    .from('volunteers')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Volunteer;
}

export async function updateVolunteer(id: string, updates: Partial<Volunteer>): Promise<void> {
  if (isDemoMode()) {
    demoUpdateVolunteer(id, updates);
    return;
  }
  const { error } = await supabase.from('volunteers').update(updates).eq('id', id);
  if (error) throw error;
}

export async function addVolunteerSkill(volunteerId: string, skill: string, proficiency: string): Promise<void> {
  if (isDemoMode()) {
    demoAddVolunteerSkill(volunteerId, skill, proficiency);
    return;
  }
  const { error } = await supabase
    .from('volunteer_skills')
    .insert({ volunteer_id: volunteerId, skill, proficiency });
  if (error) throw error;
}

export async function removeVolunteerSkill(skillId: string): Promise<void> {
  if (isDemoMode()) {
    demoRemoveVolunteerSkill(skillId);
    return;
  }
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
  if (isDemoMode()) {
    const tasks = demoTasks().filter((task) => !filters?.status || task.status === filters.status);
    return demoHydrateTaskMedia(tasks);
  }
  let query = supabase
    .from('tasks')
    .select(`
      *,
      report:reports(*),
      category:report_categories(*),
      assignments:task_assignments(*),
      evidence:evidence(*)
    `)
    .order('created_at', { ascending: false });

  if (filters?.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw error;
  const tasks = (data || []) as unknown as Task[];
  const volunteerIds = tasks.flatMap((task) => (task.assignments || []).map((assignment) => assignment.volunteer_id));
  const profileMap = await hydrateProfiles(volunteerIds);
  return tasks.map((task) => ({
    ...task,
    assignments: (task.assignments || []).map((assignment) => ({
      ...assignment,
      volunteer: profileMap[assignment.volunteer_id] || null,
    })),
  })) as unknown as Task[];
}

export async function fetchAllTasks(): Promise<Task[]> {
  if (isDemoMode()) return demoHydrateTaskMedia(demoTasks());
  const pageSize = 1000;
  const tasks: Task[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        report:reports(*),
        category:report_categories(*),
        assignments:task_assignments(*),
        evidence:evidence(*)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data || []) as unknown as Task[];
    tasks.push(...page);
    if (page.length < pageSize) break;
  }
  const volunteerIds = tasks.flatMap((task) => (task.assignments || []).map((assignment) => assignment.volunteer_id));
  const profileMap = await hydrateProfiles(volunteerIds);
  return tasks.map((task) => ({
    ...task,
    assignments: (task.assignments || []).map((assignment) => ({
      ...assignment,
      volunteer: profileMap[assignment.volunteer_id] || null,
    })),
  }));
}

export async function fetchTaskById(id: string): Promise<Task | null> {
  if (isDemoMode()) {
    const task = demoTaskById(id);
    if (!task) return null;
    return (await demoHydrateTaskMedia([task]))[0];
  }
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      report:reports(*, category:report_categories(*), location:report_locations(*)),
      category:report_categories(*),
      assignments:task_assignments(*),
      evidence:evidence(*),
      history:task_status_history(*)
    `)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const task = data as unknown as Task;
  const volunteerIds = (task.assignments || []).map((assignment) => assignment.volunteer_id);
  const changedByUserIds = (task.history || []).map((entry) => entry.changed_by);
  const profileMap = await hydrateProfiles([...volunteerIds, ...changedByUserIds]);
  return {
    ...task,
    assignments: (task.assignments || []).map((assignment) => ({
      ...assignment,
      volunteer: profileMap[assignment.volunteer_id] || null,
    })),
    history: (task.history || []).map((entry) => ({
      ...entry,
      changedByUser: profileMap[entry.changed_by] || null,
    })),
  } as unknown as Task;
}

export async function fetchTasksForVolunteer(volunteerId: string): Promise<Task[]> {
  if (isDemoMode()) return demoHydrateTaskMedia(demoTasksForVolunteer(volunteerId));
  const { data: assignments, error: assignmentsError } = await supabase
    .from('task_assignments')
    .select('task_id')
    .eq('volunteer_id', volunteerId);
  if (assignmentsError) throw assignmentsError;
  if (!assignments?.length) return [];

  const taskIds = assignments.map((assignment) => assignment.task_id);
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      report:reports(*, category:report_categories(*), location:report_locations(*)),
      category:report_categories(*),
      assignments:task_assignments(*)
    `)
    .in('id', taskIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const tasks = (data || []) as unknown as Task[];
  const volunteerIds = tasks.flatMap((task) => (task.assignments || []).map((assignment) => assignment.volunteer_id));
  const profileMap = await hydrateProfiles(volunteerIds);
  return tasks.map((task) => ({
    ...task,
    assignments: (task.assignments || []).map((assignment) => ({
      ...assignment,
      volunteer: profileMap[assignment.volunteer_id] || null,
    })),
  })) as unknown as Task[];
}

export async function fetchAvailableTasks(): Promise<Task[]> {
  if (isDemoMode()) return demoTasks().filter((task) => ['assigned', 'accepted'].includes(task.status));
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

export async function fetchAvailableVolunteerReports(): Promise<Report[]> {
  const reports = await fetchReports();
  return reports.filter((report) =>
    ['verified', 'prioritized'].includes(report.status)
    && !report.is_duplicate
    && !report.assigned_volunteer_id
  );
}

export async function fetchVolunteerTaskRequests(volunteerId?: string): Promise<VolunteerTaskRequest[]> {
  if (isDemoMode()) return demoVolunteerTaskRequests(volunteerId);

  let query = supabase
    .from('volunteer_task_requests')
    .select(`
      *,
      report:reports(*, category:report_categories(*), location:report_locations(*))
    `)
    .order('created_at', { ascending: false });
  if (volunteerId) query = query.eq('volunteer_id', volunteerId);
  const { data, error } = await query;
  if (error) throw error;
  const taskRequests = data as unknown as VolunteerTaskRequest[];
  const volunteerIds = [...new Set(taskRequests.map((request) => request.volunteer_id))];
  if (volunteerIds.length === 0) return taskRequests;

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', volunteerIds);
  if (profilesError) throw profilesError;
  return taskRequests.map((request) => ({
    ...request,
    volunteer: profiles?.find((profile) => profile.id === request.volunteer_id),
  }));
}

export async function submitVolunteerTaskRequest(reportId: string, message: string): Promise<VolunteerTaskRequest> {
  if (isDemoMode()) return demoSubmitVolunteerTaskRequest(reportId, message);
  const { data, error } = await supabase.rpc('submit_volunteer_task_request', {
    p_report_id: reportId,
    p_message: message.trim() || null,
  });
  if (error) throw error;
  return data as unknown as VolunteerTaskRequest;
}

export async function reviewVolunteerTaskRequest(requestId: string, approve: boolean): Promise<VolunteerTaskRequest> {
  if (isDemoMode()) return demoReviewVolunteerTaskRequest(requestId, approve, 'demo-supervisor');
  const { data, error } = await supabase.rpc('review_volunteer_task_request', {
    p_request_id: requestId,
    p_approve: approve,
  });
  if (error) throw error;
  return data as unknown as VolunteerTaskRequest;
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
  if (isDemoMode()) return demoCreateTask(input);
  const { data, error } = await supabase
    .from('tasks')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Task;
}

export async function updateTaskStatus(taskId: string, status: string, changedBy: string, reason?: string): Promise<void> {
  if (isDemoMode()) { demoUpdateTaskStatus(taskId, status); return; }
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
  if (isDemoMode()) {
    const task = demoTasks().find((item) => item.id === taskId);
    const volunteer = demoVolunteers().find((item) => item.user_id === volunteerId);
    if (!task || !volunteer) throw new Error('Task or volunteer is no longer available');
    const location = task.report?.location;
    const match = matchVolunteersToTask(
      task,
      [volunteer],
      location ? { lat: location.latitude, lng: location.longitude } : null
    )[0];
    if (!match) throw new Error('Volunteer is no longer eligible for this task');
    return demoAssignTask(taskId, volunteerId, assignedBy);
  }
  const { data, error } = await supabase.rpc('assign_task_atomic', {
    p_task_id: taskId,
    p_volunteer_id: volunteerId,
  });
  if (error) throw error;
  return data as unknown as TaskAssignment;
}

export async function acceptTask(taskId: string, volunteerId: string): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return demoAcceptTask(taskId, volunteerId);
  const { data, error } = await supabase.rpc('accept_task_atomic', {
    p_task_id: taskId,
    p_volunteer_id: volunteerId,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, ...(data as Record<string, unknown>) };
}

export async function declineTask(taskId: string, volunteerId: string, reason: string): Promise<void> {
  if (isDemoMode()) { demoDeclineTask(taskId, volunteerId, reason); return; }
  const { error } = await supabase.rpc('decline_task_atomic', {
    p_task_id: taskId,
    p_volunteer_id: volunteerId,
    p_reason: reason,
  });
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
  if (isDemoMode()) return demoUploadEvidence(taskId, volunteerId, file, evidenceType, notes);

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
  if (isDemoMode()) {
    const t = demoTaskById(taskId);
    return t?.evidence || [];
  }
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
  if (isDemoMode()) {
    demoCreateVerificationRecord(input);
    return;
  }
  const { error } = await supabase.from('verification_records').insert(input);
  if (error) throw error;
}

export async function fetchVerificationRecords(taskId: string): Promise<VerificationRecord[]> {
  if (isDemoMode()) return demoVerificationRecords(taskId);
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
  if (isDemoMode()) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as Notification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  if (isDemoMode()) return;
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (isDemoMode()) return;
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
  if (isDemoMode()) return;
  try {
    const { error } = await supabase.from('notifications').insert(input);
    if (error) {
      console.warn('Could not insert notification (non-fatal):', error.message);
    }
  } catch (err) {
    console.warn('Notification insert failed (non-fatal):', err);
  }
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
  if (isDemoMode()) return;
  const { error } = await supabase.from('feedback').insert(input);
  if (error) throw error;
}

export async function fetchFeedbackForReport(reportId: string): Promise<Feedback[]> {
  if (isDemoMode()) return [];
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
export async function hydrateAuditLogs(logs: AuditLog[]): Promise<AuditLog[]> {
  if (!logs || logs.length === 0) return [];

  // 1. Gather all profile IDs needing hydration (actors + direct target entities)
  const profileIdSet = new Set<string>();
  const volunteerIdSet = new Set<string>();

  logs.forEach((log) => {
    if (log.actor_id) profileIdSet.add(log.actor_id);

    if (log.entity_type === 'profile' || log.entity_type === 'user') {
      if (log.entity_id) profileIdSet.add(log.entity_id);
    } else if (log.entity_type === 'volunteer') {
      if (log.entity_id) volunteerIdSet.add(log.entity_id);
    }
  });

  // 2. Hydrate volunteer user_ids if any volunteer entities were referenced
  const volunteerUserIdMap: Record<string, string> = {};
  if (volunteerIdSet.size > 0 && !isDemoMode()) {
    try {
      const { data: vList } = await supabase
        .from('volunteers')
        .select('id, user_id')
        .in('id', Array.from(volunteerIdSet));
      (vList || []).forEach((v) => {
        if (v.user_id) {
          volunteerUserIdMap[v.id] = v.user_id;
          profileIdSet.add(v.user_id);
        }
      });
    } catch (vErr) {
      console.warn('Could not hydrate volunteer entities:', vErr);
    }
  }

  // 3. Hydrate all profiles in bulk
  let profileMap: Record<string, Profile> = {};
  if (profileIdSet.size > 0) {
    try {
      profileMap = await hydrateProfiles(Array.from(profileIdSet));
    } catch (pErr) {
      console.warn('Could not hydrate profiles for audit logs:', pErr);
    }
  }

  // 4. Attach actor, target, result, and clean details to each log
  return logs.map((log) => {
    const enriched = { ...log };

    // Actor
    if (enriched.actor_id && profileMap[enriched.actor_id]) {
      enriched.actor = profileMap[enriched.actor_id];
    }

    // Target
    const details = enriched.details || {};
    if (enriched.entity_type === 'profile' || enriched.entity_type === 'user') {
      if (enriched.entity_id && profileMap[enriched.entity_id]) {
        enriched.target = profileMap[enriched.entity_id];
      } else if (details.target_name || details.target_email) {
        enriched.target = {
          id: enriched.entity_id || '',
          full_name: (details.target_name as string) || (details.name as string) || 'User',
          email: (details.target_email as string) || (details.email as string) || '',
          role: (details.target_role as import('@/types').UserRole) || (details.role as import('@/types').UserRole) || 'citizen',
          phone: null,
          avatar_url: null,
          is_active: true,
          created_at: enriched.created_at,
          updated_at: enriched.created_at,
        };
      }
    } else if (enriched.entity_type === 'volunteer') {
      const targetUserId = enriched.entity_id ? volunteerUserIdMap[enriched.entity_id] : null;
      if (targetUserId && profileMap[targetUserId]) {
        enriched.target = profileMap[targetUserId];
      } else if (details.target_name || details.target_email) {
        enriched.target = {
          id: enriched.entity_id || '',
          full_name: (details.target_name as string) || 'Volunteer',
          email: (details.target_email as string) || '',
          role: 'volunteer',
          phone: null,
          avatar_url: null,
          is_active: true,
          created_at: enriched.created_at,
          updated_at: enriched.created_at,
        };
      }
    }

    // Normalize result
    if (!enriched.result) {
      if (typeof details.result === 'string') {
        enriched.result = details.result as 'success' | 'failed';
      } else {
        enriched.result = 'success';
      }
    }

    // Normalize IP address
    if (!enriched.ip_address && typeof details.ip_address === 'string') {
      enriched.ip_address = details.ip_address;
    }

    return enriched;
  });
}

export async function fetchAuditLogs(limit = 100): Promise<AuditLog[]> {
  if (isDemoMode()) return demoAuditLogs(limit);
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rawLogs = (data || []) as unknown as AuditLog[];
  return await hydrateAuditLogs(rawLogs);
}

export async function fetchAllAuditLogs(): Promise<AuditLog[]> {
  if (isDemoMode()) return demoAuditLogs(1000);
  const pageSize = 1000;
  const logs: AuditLog[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data || []) as unknown as AuditLog[];
    logs.push(...page);
    if (page.length < pageSize) break;
  }
  return await hydrateAuditLogs(logs);
}

export async function createAuditLog(input: {
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  actor_id?: string;
  user_id?: string;
  result?: string;
  ip_address?: string;
}): Promise<void> {
  if (isDemoMode()) {
    demoCreateAuditLog(input);
    return;
  }
  try {
    const currentUser = (await supabase.auth.getUser()).data.user;
    const actorId = input.actor_id || input.user_id || currentUser?.id;
    const { error } = await supabase.from('audit_logs').insert({
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      details: input.details,
      actor_id: actorId,
      result: input.result || 'success',
      ip_address: input.ip_address || null,
    });
    if (error) {
      console.warn('Could not insert audit log (non-fatal):', error.message);
    }
  } catch (err) {
    console.warn('Audit log insert failed (non-fatal):', err);
  }
}

// ============================================================
// SYSTEM SETTINGS
// ============================================================
let demoSystemSettingsStore: SystemSetting[] = [
  {
    id: 'demo-setting-1',
    key: 'priority_weights',
    value: { severity: 40, urgency: 25, affected_people: 20, waiting_time: 15 },
    description: 'Weights used to calculate priority queue scores',
    updated_by: null,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-setting-2',
    key: 'notification_channels',
    value: { in_app: true, push: false, sms: false, email: false, whatsapp: false },
    description: 'Active notification delivery channels',
    updated_by: null,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-setting-3',
    key: 'ai_integration',
    value: { active: false, provider: 'gemini' },
    description: 'AI categorization configuration',
    updated_by: null,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-setting-4',
    key: 'map_provider',
    value: { provider: 'google_maps', api_key_configured: false },
    description: 'Map dashboard provider configuration',
    updated_by: null,
    updated_at: new Date().toISOString(),
  },
];

export async function fetchSystemSettings(): Promise<SystemSetting[]> {
  if (isDemoMode()) return demoSystemSettingsStore;
  const { data, error } = await supabase.from('system_settings').select('*');
  if (error) throw error;
  return (data || []) as unknown as SystemSetting[];
}

export async function updateSystemSetting(key: string, value: Record<string, unknown>): Promise<void> {
  if (isDemoMode()) {
    demoSystemSettingsStore = demoSystemSettingsStore.map(s =>
      s.key === key ? { ...s, value, updated_at: new Date().toISOString() } : s
    );
    return;
  }
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
  if (isDemoMode()) return demoAllProfiles();
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as import('@/types').Profile[];
}

export async function updateProfile(id: string, updates: Partial<import('@/types').Profile>): Promise<void> {
  if (isDemoMode()) {
    demoUpdateProfile(id, updates);
    return;
  }
  const { error } = await supabase.from('profiles').update(updates).eq('id', id);
  if (error) {
    if (
      error.message?.includes('city') ||
      error.message?.includes('area') ||
      error.message?.includes('notification_preferences') ||
      error.code === 'PGRST204'
    ) {
      const baseUpdates: Record<string, unknown> = {};
      if (updates.full_name !== undefined) baseUpdates.full_name = updates.full_name;
      if (updates.phone !== undefined) baseUpdates.phone = updates.phone;
      if (updates.avatar_url !== undefined) baseUpdates.avatar_url = updates.avatar_url;
      if (updates.role !== undefined) baseUpdates.role = updates.role;
      if (updates.is_active !== undefined) baseUpdates.is_active = updates.is_active;

      const { error: baseError } = await supabase.from('profiles').update(baseUpdates).eq('id', id);
      if (baseError) throw baseError;

      try {
        await supabase.auth.updateUser({
          data: {
            full_name: updates.full_name,
            phone: updates.phone,
            city: updates.city,
            area: updates.area,
            notification_preferences: updates.notification_preferences,
          },
        });
      } catch {
        // ignore
      }
      return;
    }
    throw error;
  }

  // Only sync to auth.updateUser if the user is updating their own profile
  try {
    const currentUser = (await supabase.auth.getUser()).data.user;
    if (currentUser?.id === id) {
      await supabase.auth.updateUser({
        data: {
          full_name: updates.full_name,
          phone: updates.phone,
          city: updates.city,
          area: updates.area,
          notification_preferences: updates.notification_preferences,
        },
      });
    }
  } catch {
    // ignore
  }
}

export async function updateUserActiveStatus(userId: string, isActive: boolean): Promise<void> {
  await updateProfile(userId, { is_active: isActive });
}

export async function revokeVolunteerAccess(
  userId: string,
  volunteerId?: string,
  reason?: string
): Promise<void> {
  // 1. Demote user's profile role from 'volunteer' to 'citizen'
  await updateProfile(userId, { role: 'citizen' });

  // 2. Set volunteer verification to rejected / unverified so tasks cannot be assigned
  let targetVolId = volunteerId;
  if (!targetVolId) {
    const vol = await fetchVolunteerByUserId(userId);
    targetVolId = vol?.id;
  }

  if (targetVolId) {
    await updateVolunteer(targetVolId, {
      is_verified: false,
      verification_status: 'rejected',
    });
  }

  // 3. Create explicit audit record for revocation
  await createAuditLog({
    action: 'revoke_volunteer_access',
    entity_type: 'volunteer',
    entity_id: targetVolId || userId,
    details: {
      user_id: userId,
      previous_role: 'volunteer',
      new_role: 'citizen',
      reason: reason || 'Volunteer access revoked by administrator',
      summary: 'Volunteer access revoked; account demoted to Citizen',
    },
  });
}

export async function grantVolunteerAccess(
  userId: string,
  volunteerId?: string
): Promise<void> {
  // 1. Promote user's profile role to 'volunteer'
  await updateProfile(userId, { role: 'volunteer' });

  // 2. Ensure volunteer verification status is verified
  let targetVolId = volunteerId;
  if (!targetVolId) {
    const vol = await fetchVolunteerByUserId(userId);
    targetVolId = vol?.id;
  }

  if (targetVolId) {
    await updateVolunteer(targetVolId, {
      is_verified: true,
      verification_status: 'verified',
    });
  } else {
    // If no volunteer record exists, create one
    await createVolunteer({
      user_id: userId,
    });
  }

  // 3. Create explicit audit record for grant
  await createAuditLog({
    action: 'grant_volunteer_access',
    entity_type: 'volunteer',
    entity_id: targetVolId || userId,
    details: {
      user_id: userId,
      new_role: 'volunteer',
      summary: 'Volunteer access granted by administrator',
    },
  });
}

export async function revokeAnalystAccess(userId: string): Promise<void> {
  await updateProfile(userId, { role: 'citizen' });
  await createAuditLog({
    action: 'revoke_analyst_access',
    entity_type: 'profile',
    entity_id: userId,
    details: {
      user_id: userId,
      previous_role: 'analyst',
      new_role: 'citizen',
      summary: 'Analyst access revoked; account demoted to Citizen',
    },
  });
}

export function adminInvitesAvailable(): boolean {
  return true;
}

export async function inviteAdminUser(input: {
  fullName: string;
  email: string;
  phone?: string;
  role: import('@/types').UserRole;
}): Promise<import('@/types').Profile> {
  if (isDemoMode()) {
    return demoInviteUser(input);
  }

  const cleanEmail = input.email.trim().toLowerCase();
  const cleanName = input.fullName.trim();
  const cleanPhone = input.phone?.trim() || null;

  // Attempt Supabase Edge Function with a 5s timeout
  try {
    const invokePromise = supabase.functions.invoke('admin-invite-user', {
      body: {
        fullName: cleanName,
        email: cleanEmail,
        phone: cleanPhone || undefined,
        role: input.role,
      },
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Edge function timeout')), 5000)
    );

    const result = (await Promise.race([invokePromise, timeoutPromise])) as unknown as {
      data?: { profile?: import('@/types').Profile; error?: string };
      error?: Error | { message?: string } | null;
    };

    if (!result.error && result.data?.profile) {
      return result.data.profile;
    }
    if (result.data?.error) {
      throw new Error(result.data.error);
    }
    if (result.error && 'message' in result.error && result.error.message) {
      const msg = result.error.message.toLowerCase();
      if (msg.includes('already exists') || msg.includes('registered') || msg.includes('denied') || msg.includes('only administrators')) {
        throw new Error(result.error.message);
      }
    }
  } catch (fnErr) {
    const errText = fnErr instanceof Error ? fnErr.message : String(fnErr);
    if (errText.toLowerCase().includes('already exists') || errText.toLowerCase().includes('already registered')) {
      throw fnErr;
    }
    console.warn('Edge Function admin-invite-user not deployed or timed out. Falling back to direct profile provisioning:', fnErr);
  }

  // Fallback: Check for existing profile by email first
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', cleanEmail)
    .maybeSingle();

  if (existingProfile) {
    throw new Error('An account with this email address already exists.');
  }

  // Create provisional profile in public.profiles table
  const provisionalId = crypto.randomUUID();
  const provisionalProfile: import('@/types').Profile = {
    id: provisionalId,
    email: cleanEmail,
    full_name: cleanName,
    phone: cleanPhone,
    role: input.role,
    avatar_url: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .upsert(provisionalProfile)
    .select()
    .maybeSingle();

  if (insertError) {
    throw new Error(`Database insert error: ${insertError.message}`);
  }

  // Provision corresponding volunteer record if volunteer role chosen
  if (input.role === 'volunteer') {
    try {
      await supabase.from('volunteers').upsert({
        user_id: provisionalId,
        is_verified: true,
        verification_status: 'verified',
      });
    } catch (vErr) {
      console.warn('Could not provision volunteer record:', vErr);
    }
  }

  // Record audit log for fallback invitation
  try {
    const currentUser = (await supabase.auth.getUser()).data.user;
    await supabase.from('audit_logs').insert({
      actor_id: currentUser?.id || provisionalId,
      action: 'invite_user',
      entity_type: 'profile',
      entity_id: provisionalId,
      details: {
        email: cleanEmail,
        role: input.role,
        target_name: cleanName,
        target_email: cleanEmail,
        target_role: input.role,
        result: 'success',
      },
      result: 'success',
    });
  } catch (auditErr) {
    console.warn('Could not insert fallback audit log:', auditErr);
  }

  return (inserted as unknown as import('@/types').Profile) || provisionalProfile;
}
