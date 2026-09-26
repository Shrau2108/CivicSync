export type UserRole = 'citizen' | 'volunteer' | 'supervisor' | 'admin';

export type ReportStatus =
  | 'submitted' | 'under_review' | 'verified' | 'prioritized' | 'assigned'
  | 'accepted' | 'in_progress' | 'evidence_submitted' | 'under_verification'
  | 'resolved' | 'rejected' | 'duplicate' | 'reopened' | 'cancelled';

export type TaskStatus =
  | 'assigned' | 'accepted' | 'in_progress' | 'evidence_submitted'
  | 'under_verification' | 'completed' | 'declined' | 'reassigned' | 'rejected' | 'cancelled';

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type AssignmentStatus = 'assigned' | 'accepted' | 'declined' | 'reassigned' | 'cancelled';
export type VerificationDecision = 'approved' | 'rejected' | 'resubmission_requested';
export type DuplicateStatus = 'pending' | 'confirmed_duplicate' | 'marked_separate';
export type SimilarityType = 'text' | 'geographic' | 'file_hash' | 'category';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type Proficiency = 'beginner' | 'intermediate' | 'expert';

export type NotificationCategory =
  | 'report_submitted' | 'report_reviewed' | 'priority_updated' | 'task_assigned'
  | 'task_accepted' | 'task_declined' | 'task_reassigned' | 'status_changed'
  | 'evidence_submitted' | 'evidence_approved' | 'evidence_rejected'
  | 'report_resolved' | 'feedback_requested';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReportCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Report {
  id: string;
  report_id: string;
  title: string;
  description: string;
  category_id: string | null;
  status: ReportStatus;
  severity: Severity | null;
  priority_level: PriorityLevel | null;
  priority_score: number;
  affected_people: number;
  additional_notes: string | null;
  reporter_id: string;
  assigned_volunteer_id: string | null;
  ai_category_confidence: number | null;
  ai_category_explanation: string | null;
  ai_integration_active: boolean;
  is_duplicate: boolean;
  duplicate_of: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  category?: ReportCategory;
  reporter?: Profile;
  location?: ReportLocation;
  media?: ReportMedia[];
}

export interface ReportMedia {
  id: string;
  report_id: string;
  file_url: string;
  file_type: 'image' | 'video';
  file_name: string | null;
  file_size: number | null;
  file_hash: string | null;
  storage_path: string | null;
  created_at: string;
}

export interface ReportLocation {
  id: string;
  report_id: string;
  address: string | null;
  latitude: number;
  longitude: number;
  city: string | null;
  area: string | null;
  postal_code: string | null;
  created_at: string;
}

export interface DuplicateCandidate {
  id: string;
  report_id: string;
  candidate_report_id: string;
  similarity_type: SimilarityType;
  similarity_score: number;
  similarity_reasons: string | null;
  status: DuplicateStatus;
  reviewer_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  report?: Report;
  candidateReport?: Report;
}

export interface PriorityScore {
  id: string;
  report_id: string;
  severity_weight: number;
  urgency_weight: number;
  affected_people_weight: number;
  waiting_time_weight: number;
  total_score: number;
  factors: Record<string, number> | null;
  override_reason: string | null;
  overridden_by: string | null;
  overridden_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Volunteer {
  id: string;
  user_id: string;
  bio: string | null;
  service_area: string | null;
  current_workload: number;
  max_workload: number;
  completed_tasks: number;
  rating: number | null;
  total_ratings: number;
  is_verified: boolean;
  verification_status: VerificationStatus;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
  skills?: VolunteerSkill[];
  availability?: VolunteerAvailability[];
}

export interface VolunteerSkill {
  id: string;
  volunteer_id: string;
  skill: string;
  proficiency: Proficiency;
  created_at: string;
}

export interface VolunteerAvailability {
  id: string;
  volunteer_id: string;
  day_of_week: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  task_id: string;
  report_id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  priority_level: PriorityLevel | null;
  priority_score: number;
  required_skills: string[];
  estimated_time_minutes: number | null;
  affected_people: number;
  assignment_type: 'single' | 'multi';
  status: TaskStatus;
  deadline: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  report?: Report;
  category?: ReportCategory;
  assignments?: TaskAssignment[];
  evidence?: Evidence[];
  history?: TaskStatusHistory[];
}

export interface TaskAssignment {
  id: string;
  task_id: string;
  volunteer_id: string;
  status: AssignmentStatus;
  assigned_by: string;
  accepted_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  created_at: string;
  updated_at: string;
  volunteer?: Profile;
}

export interface TaskStatusHistory {
  id: string;
  task_id: string;
  from_status: string | null;
  to_status: TaskStatus;
  changed_by: string;
  reason: string | null;
  created_at: string;
  changedByUser?: Profile;
}

export interface Evidence {
  id: string;
  task_id: string;
  volunteer_id: string;
  evidence_type: 'before' | 'after';
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  file_hash: string | null;
  storage_path: string | null;
  notes: string | null;
  submitted_at: string;
}

export interface VerificationRecord {
  id: string;
  task_id: string;
  verifier_id: string;
  decision: VerificationDecision;
  comments: string | null;
  before_hash: string | null;
  after_hash: string | null;
  hash_match: boolean | null;
  created_at: string;
  verifier?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: NotificationCategory;
  related_report_id: string | null;
  related_task_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Feedback {
  id: string;
  report_id: string;
  citizen_id: string;
  rating: number;
  comments: string | null;
  request_reopen: boolean;
  reopen_reason: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  actor?: Profile;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface VolunteerMatchResult {
  volunteer: Volunteer;
  score: number;
  reasons: string[];
  skillMatch: number;
  availabilityMatch: boolean;
  workloadOk: boolean;
  distance: number | null;
}

export interface DijkstraResult {
  path: string[];
  distance: number;
  unreachable: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  weight: number;
}
