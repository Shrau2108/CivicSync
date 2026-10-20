import { supabase, STORAGE_BUCKET, isSupabaseConfigured } from '@/lib/supabase';
import type {
  Report, ReportCategory, ReportMedia, Task, TaskAssignment,
  Volunteer, Notification, Feedback, AuditLog, DuplicateCandidate,
  VerificationRecord, Evidence, PriorityScore, SystemSetting, VolunteerTaskRequest, Profile,
} from '@/types';
import { computeFileHash } from '@/lib/duplicateDetection';
import { matchVolunteersToTask } from '@/lib/volunteerMatching';
import { isDemoMode, demoCategories, demoReports, demoReportsByReporter, demoReportById, demoCreateReport, demoCreateLocation, demoUpdateReportStatus, demoUpdateReportPriority, demoVolunteers, demoTasks, demoTasksForVolunteer, demoTaskById, demoCreateTask, demoAssignTask, demoUpdateTaskStatus, demoAcceptTask, demoDeclineTask, demoVolunteerTaskRequests, demoSubmitVolunteerTaskRequest, demoReviewVolunteerTaskRequest, demoUploadEvidence, demoCreateVerificationRecord, demoVerificationRecords, demoHydrateTaskMedia, demoAllProfiles } from '@/lib/demoMode';

// ============================================================
// CATEGORIES
// ============================================================
export async function fetchCategories(): Promise<ReportCategory[]> {
  if (isDemoMode()) return demoCategories;
  try {
    const { data, error } = await supabase
      .from('report_categories')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (!error && data && data.length > 0) {
      return data as ReportCategory[];
    }
  } catch (err) {
    console.warn('Could not fetch categories from Supabase, using defaults:', err);
  }
  return demoCategories;
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
  try {
    let query = supabase
      .from('reports')
      .select(`
        *,
        category:report_categories(*),
        location:report_locations(*)
      `)
      .order('created_at', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.category_id) query = query.eq('category_id', filters.category_id);
    if (filters?.priority_level) query = query.eq('priority_level', filters.priority_level);

    const { data, error } = await query;
    if (!error && data) {
      const reports = data as unknown as Report[];
      const reporterIds = [...new Set(reports.map(r => r.reporter_id).filter(Boolean))];
      if (reporterIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', reporterIds);
        if (profiles) {
          reports.forEach(r => {
            r.reporter = profiles.find(p => p.id === r.reporter_id);
          });
        }
      }
      return reports;
    }
  } catch (err) {
    console.warn('Error fetching live reports, falling back to demo store:', err);
  }
  return demoReports(filters);
}

export async function fetchAllReports(): Promise<Report[]> {
  if (isDemoMode()) return demoReports();
  try {
    const pageSize = 1000;
    const reports: Report[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('reports')
        .select('*, category:report_categories(*), location:report_locations(*)')
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const page = (data || []) as unknown as Report[];
      reports.push(...page);
      if (page.length < pageSize) return reports;
    }
  } catch (err) {
    console.warn('Error fetching all live reports:', err);
    return demoReports();
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

export async function updateReportPriority(reportId: string, priorityLevel: string, priorityScore: number, urgency?: string): Promise<void> {
  if (isDemoMode()) {
    demoUpdateReportPriority(reportId, priorityLevel, priorityScore, urgency);
    return;
  }
  const updates: Record<string, unknown> = { priority_level: priorityLevel, priority_score: priorityScore };
  if (urgency) updates.urgency = urgency;
  const { error } = await supabase
    .from('reports')
    .update(updates)
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
  if (isDemoMode()) {
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
  file: File
): Promise<ReportMedia> {
  if (isDemoMode()) return { id: `demo-media-${Date.now()}`, report_id: reportId, file_url: URL.createObjectURL(file), file_type: file.type.startsWith('video') ? 'video' : 'image', file_name: file.name, file_size: file.size, file_hash: null, storage_path: null, created_at: new Date().toISOString() };
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

async function hydrateProfiles(userIds: (string | undefined | null)[]): Promise<Record<string, Profile>> {
  const unique = [...new Set(userIds.filter(Boolean) as string[])];
  if (unique.length === 0) return {};
  try {
    const { data } = await supabase.from('profiles').select('*').in('id', unique);
    if (data) {
      return Object.fromEntries(data.map((p) => [p.id, p as Profile]));
    }
  } catch (err) {
    console.warn('Error fetching profiles map:', err);
  }
  return {};
}

// ============================================================
// VOLUNTEERS
// ============================================================
export async function fetchVolunteers(): Promise<Volunteer[]> {
  if (isDemoMode()) return demoVolunteers();
  try {
    const { data, error } = await supabase
      .from('volunteers')
      .select(`
        *,
        skills:volunteer_skills(*),
        availability:volunteer_availability(*)
      `)
      .order('created_at', { ascending: false });
    if (!error && data) {
      const profileMap = await hydrateProfiles(data.map((v: any) => v.user_id));
      return data.map((v: any) => ({
        ...v,
        profile: profileMap[v.user_id] || null,
      })) as Volunteer[];
    }
  } catch (err) {
    console.warn('Error fetching live volunteers, falling back to demo store:', err);
  }
  return demoVolunteers();
}

export async function fetchVolunteerByUserId(userId: string): Promise<Volunteer | null> {
  if (isDemoMode()) return demoVolunteers().find((volunteer) => volunteer.user_id === userId) || null;
  try {
    const { data, error } = await supabase
      .from('volunteers')
      .select(`
        *,
        skills:volunteer_skills(*),
        availability:volunteer_availability(*)
      `)
      .eq('user_id', userId)
      .maybeSingle();
    if (!error && data) {
      const profileMap = await hydrateProfiles([userId]);
      return {
        ...data,
        profile: profileMap[userId] || null,
      } as unknown as Volunteer;
    }
  } catch (err) {
    console.warn('Error fetching volunteer by user id:', err);
  }
  return demoVolunteers().find((volunteer) => volunteer.user_id === userId) || null;
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
  if (isDemoMode()) {
    const tasks = demoTasks().filter((task) => !filters?.status || task.status === filters.status);
    return demoHydrateTaskMedia(tasks);
  }
  try {
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
    if (!error && data) {
      const volunteerIds = data.flatMap((t: any) => (t.assignments || []).map((a: any) => a.volunteer_id));
      const profileMap = await hydrateProfiles(volunteerIds);
      return data.map((t: any) => ({
        ...t,
        assignments: (t.assignments || []).map((a: any) => ({
          ...a,
          volunteer: profileMap[a.volunteer_id] || null,
        })),
      })) as unknown as Task[];
    }
  } catch (err) {
    console.warn('Error fetching live tasks, falling back to demo store:', err);
  }
  const fallbackTasks = demoTasks().filter((task) => !filters?.status || task.status === filters.status);
  return demoHydrateTaskMedia(fallbackTasks);
}

export async function fetchAllTasks(): Promise<Task[]> {
  if (isDemoMode()) return demoHydrateTaskMedia(demoTasks());
  try {
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
    const volunteerIds = tasks.flatMap((t: any) => (t.assignments || []).map((a: any) => a.volunteer_id));
    const profileMap = await hydrateProfiles(volunteerIds);
    return tasks.map((t: any) => ({
      ...t,
      assignments: (t.assignments || []).map((a: any) => ({
        ...a,
        volunteer: profileMap[a.volunteer_id] || null,
      })),
    }));
  } catch (err) {
    console.warn('Error in fetchAllTasks, falling back to demo store:', err);
    return demoHydrateTaskMedia(demoTasks());
  }
}

export async function fetchTaskById(id: string): Promise<Task | null> {
  if (isDemoMode()) {
    const task = demoTaskById(id);
    if (!task) return null;
    return (await demoHydrateTaskMedia([task]))[0];
  }
  try {
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
    if (!error && data) {
      const volunteerIds = (data.assignments || []).map((a: any) => a.volunteer_id);
      const changedByUserIds = (data.history || []).map((h: any) => h.changed_by);
      const profileMap = await hydrateProfiles([...volunteerIds, ...changedByUserIds]);
      return {
        ...data,
        assignments: (data.assignments || []).map((a: any) => ({
          ...a,
          volunteer: profileMap[a.volunteer_id] || null,
        })),
        history: (data.history || []).map((h: any) => ({
          ...h,
          changedByUser: profileMap[h.changed_by] || null,
        })),
      } as unknown as Task;
    }
  } catch (err) {
    console.warn('Error fetching task by id, falling back to demo store:', err);
  }
  const task = demoTaskById(id);
  if (!task) return null;
  return (await demoHydrateTaskMedia([task]))[0];
}

export async function fetchTasksForVolunteer(volunteerId: string): Promise<Task[]> {
  if (isDemoMode()) return demoHydrateTaskMedia(demoTasksForVolunteer(volunteerId));
  try {
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
        assignments:task_assignments(*)
      `)
      .in('id', taskIds)
      .order('created_at', { ascending: false });
    if (!error && data) {
      const volunteerIds = data.flatMap((t: any) => (t.assignments || []).map((a: any) => a.volunteer_id));
      const profileMap = await hydrateProfiles(volunteerIds);
      return data.map((t: any) => ({
        ...t,
        assignments: (t.assignments || []).map((a: any) => ({
          ...a,
          volunteer: profileMap[a.volunteer_id] || null,
        })),
      })) as unknown as Task[];
    }
  } catch (err) {
    console.warn('Error fetching tasks for volunteer, falling back to demo store:', err);
  }
  return demoHydrateTaskMedia(demoTasksForVolunteer(volunteerId));
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
  return data as unknown as Notification[];
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
export async function fetchAuditLogs(limit = 50): Promise<AuditLog[]> {
  if (isDemoMode()) return [];
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, actor:profiles!audit_logs_actor_id_fkey(*)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as unknown as AuditLog[];
}

export async function fetchAllAuditLogs(): Promise<AuditLog[]> {
  if (isDemoMode()) return [];
  const pageSize = 1000;
  const logs: AuditLog[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, actor:profiles!audit_logs_actor_id_fkey(*)')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data || []) as unknown as AuditLog[];
    logs.push(...page);
    if (page.length < pageSize) return logs;
  }
}

export async function createAuditLog(input: {
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  if (isDemoMode()) return;
  const { error } = await supabase.from('audit_logs').insert(input);
  if (error) throw error;
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
  if (error) {
    console.warn('Could not fetch system settings from Supabase, using fallback:', error.message);
    return demoSystemSettingsStore;
  }
  return data as unknown as SystemSetting[];
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
  return data as unknown as import('@/types').Profile[];
}

export async function updateProfile(id: string, updates: Partial<import('@/types').Profile>): Promise<void> {
  if (isDemoMode()) return;
  const { error } = await supabase.from('profiles').update(updates).eq('id', id);
  if (error) throw error;
}

export function adminInvitesAvailable(): boolean {
  const hasDemoSession = typeof window !== 'undefined' && Boolean(sessionStorage.getItem('civicsync-demo-role'));
  return isSupabaseConfigured && !hasDemoSession;
}

export async function inviteAdminUser(input: {
  fullName: string;
  email: string;
  phone?: string;
  role: import('@/types').UserRole;
}): Promise<import('@/types').Profile> {
  if (!adminInvitesAvailable()) {
    throw new Error('Email invitations are unavailable in demo mode. Connect Supabase and deploy the admin-invite-user function to create real accounts.');
  }

  // Attempt Supabase Edge Function with a 4.5s timeout
  try {
    const invokePromise = supabase.functions.invoke('admin-invite-user', { body: input });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Edge function timeout')), 4500)
    );

    const result = (await Promise.race([invokePromise, timeoutPromise])) as unknown as {
      data?: { profile?: import('@/types').Profile; error?: string };
      error?: Error | null;
    };

    if (!result.error && result.data?.profile) {
      return result.data.profile;
    }
    if (result.data?.error) {
      throw new Error(result.data.error);
    }
  } catch (fnErr) {
    console.warn('Edge Function admin-invite-user not deployed or timed out. Falling back to direct profile provisioning:', fnErr);
  }

  // Fallback: Create provisional profile in public.profiles table
  const provisionalId = crypto.randomUUID();
  const provisionalProfile: import('@/types').Profile = {
    id: provisionalId,
    email: input.email.trim().toLowerCase(),
    full_name: input.fullName.trim(),
    phone: input.phone?.trim() || null,
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
    throw new Error(
      `Could not invoke invite function (Edge Function not deployed on Supabase). Database insert error: ${insertError.message}`
    );
  }

  return (inserted as unknown as import('@/types').Profile) || provisionalProfile;
}

