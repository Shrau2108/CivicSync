/*
# CivicSync — Full Database Schema (restructured)

Creates all tables first, then enables RLS and adds policies.
Tables: profiles, report_categories, reports, report_media, report_locations,
duplicate_candidates, priority_scores, volunteers, volunteer_skills,
volunteer_availability, tasks, task_assignments, task_status_history,
evidence, verification_records, notifications, feedback, audit_logs, system_settings.

Security: RLS on every table, owner-scoped policies via auth.uid(),
role-based access via profiles.role. Public registration creates 'citizen' only.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'volunteer', 'supervisor', 'admin')),
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- REPORT CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS report_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  icon text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id text NOT NULL UNIQUE DEFAULT ('RPT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  title text NOT NULL,
  description text NOT NULL,
  category_id uuid REFERENCES report_categories(id),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'under_review', 'verified', 'prioritized', 'assigned',
    'accepted', 'in_progress', 'evidence_submitted', 'under_verification',
    'resolved', 'rejected', 'duplicate', 'reopened', 'cancelled'
  )),
  severity text CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  priority_level text CHECK (priority_level IN ('critical', 'high', 'medium', 'low')),
  priority_score integer DEFAULT 0,
  affected_people integer DEFAULT 1,
  additional_notes text,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_volunteer_id uuid REFERENCES auth.users(id),
  ai_category_confidence float,
  ai_category_explanation text,
  ai_integration_active boolean NOT NULL DEFAULT false,
  is_duplicate boolean NOT NULL DEFAULT false,
  duplicate_of uuid REFERENCES reports(id),
  reviewer_id uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category_id);
CREATE INDEX IF NOT EXISTS idx_reports_priority ON reports(priority_level);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);

-- ============================================================
-- REPORT MEDIA
-- ============================================================
CREATE TABLE IF NOT EXISTS report_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('image', 'video')),
  file_name text,
  file_size bigint,
  file_hash text,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_media_report ON report_media(report_id);

-- ============================================================
-- REPORT LOCATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS report_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
  address text,
  latitude float NOT NULL,
  longitude float NOT NULL,
  city text,
  area text,
  postal_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_location_report ON report_locations(report_id);

-- ============================================================
-- DUPLICATE CANDIDATES
-- ============================================================
CREATE TABLE IF NOT EXISTS duplicate_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  candidate_report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  similarity_type text NOT NULL CHECK (similarity_type IN ('text', 'geographic', 'file_hash', 'category')),
  similarity_score float NOT NULL DEFAULT 0,
  similarity_reasons text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed_duplicate', 'marked_separate')),
  reviewer_id uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dup_report ON duplicate_candidates(report_id);
CREATE INDEX IF NOT EXISTS idx_dup_candidate ON duplicate_candidates(candidate_report_id);
CREATE INDEX IF NOT EXISTS idx_dup_status ON duplicate_candidates(status);

-- ============================================================
-- PRIORITY SCORES
-- ============================================================
CREATE TABLE IF NOT EXISTS priority_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  severity_weight float NOT NULL DEFAULT 40,
  urgency_weight float NOT NULL DEFAULT 25,
  affected_people_weight float NOT NULL DEFAULT 20,
  waiting_time_weight float NOT NULL DEFAULT 15,
  total_score float NOT NULL DEFAULT 0,
  factors jsonb,
  override_reason text,
  overridden_by uuid REFERENCES auth.users(id),
  overridden_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_priority_report ON priority_scores(report_id);
CREATE INDEX IF NOT EXISTS idx_priority_score ON priority_scores(total_score DESC);

-- ============================================================
-- VOLUNTEERS
-- ============================================================
CREATE TABLE IF NOT EXISTS volunteers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  bio text,
  service_area text,
  current_workload integer NOT NULL DEFAULT 0,
  max_workload integer NOT NULL DEFAULT 5,
  completed_tasks integer NOT NULL DEFAULT 0,
  rating float,
  total_ratings integer NOT NULL DEFAULT 0,
  is_verified boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  latitude float,
  longitude float,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_volunteers_user ON volunteers(user_id);
CREATE INDEX IF NOT EXISTS idx_volunteers_verified ON volunteers(is_verified);

-- ============================================================
-- VOLUNTEER SKILLS
-- ============================================================
CREATE TABLE IF NOT EXISTS volunteer_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id uuid NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  skill text NOT NULL,
  proficiency text NOT NULL DEFAULT 'intermediate' CHECK (proficiency IN ('beginner', 'intermediate', 'expert')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vskills_volunteer ON volunteer_skills(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_vskills_skill ON volunteer_skills(skill);

-- ============================================================
-- VOLUNTEER AVAILABILITY
-- ============================================================
CREATE TABLE IF NOT EXISTS volunteer_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id uuid NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  day_of_week text NOT NULL CHECK (day_of_week IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
  start_time text NOT NULL,
  end_time text NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vavail_volunteer ON volunteer_availability(volunteer_id);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL UNIQUE DEFAULT ('TSK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category_id uuid REFERENCES report_categories(id),
  priority_level text CHECK (priority_level IN ('critical', 'high', 'medium', 'low')),
  priority_score integer DEFAULT 0,
  required_skills text[] DEFAULT '{}',
  estimated_time_minutes integer,
  affected_people integer DEFAULT 1,
  assignment_type text NOT NULL DEFAULT 'single' CHECK (assignment_type IN ('single', 'multi')),
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN (
    'assigned', 'accepted', 'in_progress', 'evidence_submitted',
    'under_verification', 'completed', 'declined', 'reassigned', 'rejected', 'cancelled'
  )),
  deadline timestamptz,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_report ON tasks(report_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority_level);

-- ============================================================
-- TASK ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  volunteer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'accepted', 'declined', 'reassigned', 'cancelled')),
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  accepted_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignments_task ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_assignments_volunteer ON task_assignments(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON task_assignments(status);

-- ============================================================
-- TASK STATUS HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS task_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_history_task ON task_status_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_created ON task_status_history(created_at DESC);

-- ============================================================
-- EVIDENCE
-- ============================================================
CREATE TABLE IF NOT EXISTS evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  volunteer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evidence_type text NOT NULL CHECK (evidence_type IN ('before', 'after')),
  file_url text NOT NULL,
  file_name text,
  file_size bigint,
  file_hash text,
  storage_path text,
  notes text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_task ON evidence(task_id);
CREATE INDEX IF NOT EXISTS idx_evidence_type ON evidence(evidence_type);

-- ============================================================
-- VERIFICATION RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS verification_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  verifier_id uuid NOT NULL REFERENCES auth.users(id),
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected', 'resubmission_requested')),
  comments text,
  before_hash text,
  after_hash text,
  hash_match boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_task ON verification_records(task_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN (
    'report_submitted', 'report_reviewed', 'priority_updated', 'task_assigned',
    'task_accepted', 'task_declined', 'task_reassigned', 'status_changed',
    'evidence_submitted', 'evidence_approved', 'evidence_rejected',
    'report_resolved', 'feedback_requested'
  )),
  related_report_id uuid,
  related_task_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at DESC);

-- ============================================================
-- FEEDBACK
-- ============================================================
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  citizen_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comments text,
  request_reopen boolean NOT NULL DEFAULT false,
  reopen_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_report ON feedback(report_id);
CREATE INDEX IF NOT EXISTS idx_feedback_citizen ON feedback(citizen_id);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ============================================================
-- SYSTEM SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE duplicate_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE priority_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES: PROFILES
-- ============================================================
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_select_all_staff" ON profiles;
CREATE POLICY "profiles_select_all_staff" ON profiles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
CREATE POLICY "profiles_insert_self" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_role_admin" ON profiles;
CREATE POLICY "profiles_update_role_admin" ON profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- POLICIES: REPORT CATEGORIES
-- ============================================================
DROP POLICY IF EXISTS "categories_select_all" ON report_categories;
CREATE POLICY "categories_select_all" ON report_categories FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "categories_insert_admin" ON report_categories;
CREATE POLICY "categories_insert_admin" ON report_categories FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "categories_update_admin" ON report_categories;
CREATE POLICY "categories_update_admin" ON report_categories FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "categories_delete_admin" ON report_categories;
CREATE POLICY "categories_delete_admin" ON report_categories FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- POLICIES: REPORTS
-- ============================================================
DROP POLICY IF EXISTS "reports_select_own_or_staff" ON reports;
CREATE POLICY "reports_select_own_or_staff" ON reports FOR SELECT
  TO authenticated USING (
    auth.uid() = reporter_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
    OR auth.uid() = assigned_volunteer_id
  );

DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own" ON reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_update_own_or_staff" ON reports;
CREATE POLICY "reports_update_own_or_staff" ON reports FOR UPDATE
  TO authenticated USING (
    auth.uid() = reporter_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  ) WITH CHECK (
    auth.uid() = reporter_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

DROP POLICY IF EXISTS "reports_delete_staff" ON reports;
CREATE POLICY "reports_delete_staff" ON reports FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

-- ============================================================
-- POLICIES: REPORT MEDIA
-- ============================================================
DROP POLICY IF EXISTS "media_select_own_or_staff" ON report_media;
CREATE POLICY "media_select_own_or_staff" ON report_media FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM reports r WHERE r.id = report_media.report_id AND (
      r.reporter_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
      OR r.assigned_volunteer_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "media_insert_report_owner" ON report_media;
CREATE POLICY "media_insert_report_owner" ON report_media FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM reports r WHERE r.id = report_media.report_id AND r.reporter_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

DROP POLICY IF EXISTS "media_delete_owner" ON report_media;
CREATE POLICY "media_delete_owner" ON report_media FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM reports r WHERE r.id = report_media.report_id AND r.reporter_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

-- ============================================================
-- POLICIES: REPORT LOCATIONS
-- ============================================================
DROP POLICY IF EXISTS "location_select_own_or_staff" ON report_locations;
CREATE POLICY "location_select_own_or_staff" ON report_locations FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM reports r WHERE r.id = report_locations.report_id AND (
      r.reporter_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin', 'volunteer'))
      OR r.assigned_volunteer_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "location_insert_report_owner" ON report_locations;
CREATE POLICY "location_insert_report_owner" ON report_locations FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM reports r WHERE r.id = report_locations.report_id AND r.reporter_id = auth.uid())
  );

-- ============================================================
-- POLICIES: DUPLICATE CANDIDATES
-- ============================================================
DROP POLICY IF EXISTS "dup_select_staff" ON duplicate_candidates;
CREATE POLICY "dup_select_staff" ON duplicate_candidates FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

DROP POLICY IF EXISTS "dup_insert_staff" ON duplicate_candidates;
CREATE POLICY "dup_insert_staff" ON duplicate_candidates FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

DROP POLICY IF EXISTS "dup_update_staff" ON duplicate_candidates;
CREATE POLICY "dup_update_staff" ON duplicate_candidates FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

-- ============================================================
-- POLICIES: PRIORITY SCORES
-- ============================================================
DROP POLICY IF EXISTS "priority_select_staff" ON priority_scores;
CREATE POLICY "priority_select_staff" ON priority_scores FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

DROP POLICY IF EXISTS "priority_insert_staff" ON priority_scores;
CREATE POLICY "priority_insert_staff" ON priority_scores FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

DROP POLICY IF EXISTS "priority_update_staff" ON priority_scores;
CREATE POLICY "priority_update_staff" ON priority_scores FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

-- ============================================================
-- POLICIES: VOLUNTEERS
-- ============================================================
DROP POLICY IF EXISTS "volunteers_select_own_or_staff" ON volunteers;
CREATE POLICY "volunteers_select_own_or_staff" ON volunteers FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

DROP POLICY IF EXISTS "volunteers_insert_self" ON volunteers;
CREATE POLICY "volunteers_insert_self" ON volunteers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "volunteers_update_own_or_staff" ON volunteers;
CREATE POLICY "volunteers_update_own_or_staff" ON volunteers FOR UPDATE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  ) WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

-- ============================================================
-- POLICIES: VOLUNTEER SKILLS
-- ============================================================
DROP POLICY IF EXISTS "vskills_select_own_or_staff" ON volunteer_skills;
CREATE POLICY "vskills_select_own_or_staff" ON volunteer_skills FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM volunteers v WHERE v.id = volunteer_skills.volunteer_id AND (
      v.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
    ))
  );

DROP POLICY IF EXISTS "vskills_insert_own" ON volunteer_skills;
CREATE POLICY "vskills_insert_own" ON volunteer_skills FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM volunteers v WHERE v.id = volunteer_skills.volunteer_id AND v.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "vskills_delete_own" ON volunteer_skills;
CREATE POLICY "vskills_delete_own" ON volunteer_skills FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM volunteers v WHERE v.id = volunteer_skills.volunteer_id AND v.user_id = auth.uid())
  );

-- ============================================================
-- POLICIES: VOLUNTEER AVAILABILITY
-- ============================================================
DROP POLICY IF EXISTS "vavail_select_own_or_staff" ON volunteer_availability;
CREATE POLICY "vavail_select_own_or_staff" ON volunteer_availability FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM volunteers v WHERE v.id = volunteer_availability.volunteer_id AND (
      v.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
    ))
  );

DROP POLICY IF EXISTS "vavail_insert_own" ON volunteer_availability;
CREATE POLICY "vavail_insert_own" ON volunteer_availability FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM volunteers v WHERE v.id = volunteer_availability.volunteer_id AND v.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "vavail_delete_own" ON volunteer_availability;
CREATE POLICY "vavail_delete_own" ON volunteer_availability FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM volunteers v WHERE v.id = volunteer_availability.volunteer_id AND v.user_id = auth.uid())
  );

-- ============================================================
-- POLICIES: TASKS
-- ============================================================
DROP POLICY IF EXISTS "tasks_select_staff_or_assigned" ON tasks;
CREATE POLICY "tasks_select_staff_or_assigned" ON tasks FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
    OR EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = tasks.id AND ta.volunteer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM reports r WHERE r.id = tasks.report_id AND r.reporter_id = auth.uid())
  );

DROP POLICY IF EXISTS "tasks_insert_staff" ON tasks;
CREATE POLICY "tasks_insert_staff" ON tasks FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

DROP POLICY IF EXISTS "tasks_update_staff_or_volunteer" ON tasks;
CREATE POLICY "tasks_update_staff_or_volunteer" ON tasks FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
    OR EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = tasks.id AND ta.volunteer_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
    OR EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = tasks.id AND ta.volunteer_id = auth.uid())
  );

-- ============================================================
-- POLICIES: TASK ASSIGNMENTS
-- ============================================================
DROP POLICY IF EXISTS "assignments_select_staff_or_volunteer" ON task_assignments;
CREATE POLICY "assignments_select_staff_or_volunteer" ON task_assignments FOR SELECT
  TO authenticated USING (
    volunteer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

DROP POLICY IF EXISTS "assignments_insert_staff" ON task_assignments;
CREATE POLICY "assignments_insert_staff" ON task_assignments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

DROP POLICY IF EXISTS "assignments_update_staff_or_volunteer" ON task_assignments;
CREATE POLICY "assignments_update_staff_or_volunteer" ON task_assignments FOR UPDATE
  TO authenticated USING (
    volunteer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  ) WITH CHECK (
    volunteer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

-- ============================================================
-- POLICIES: TASK STATUS HISTORY
-- ============================================================
DROP POLICY IF EXISTS "task_history_select_staff_or_assigned" ON task_status_history;
CREATE POLICY "task_history_select_staff_or_assigned" ON task_status_history FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
    OR EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = task_status_history.task_id AND ta.volunteer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM tasks t JOIN reports r ON r.id = t.report_id WHERE t.id = task_status_history.task_id AND r.reporter_id = auth.uid())
  );

DROP POLICY IF EXISTS "task_history_insert_staff_or_volunteer" ON task_status_history;
CREATE POLICY "task_history_insert_staff_or_volunteer" ON task_status_history FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin', 'volunteer'))
  );

-- ============================================================
-- POLICIES: EVIDENCE
-- ============================================================
DROP POLICY IF EXISTS "evidence_select_staff_or_volunteer" ON evidence;
CREATE POLICY "evidence_select_staff_or_volunteer" ON evidence FOR SELECT
  TO authenticated USING (
    volunteer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

DROP POLICY IF EXISTS "evidence_insert_volunteer" ON evidence;
CREATE POLICY "evidence_insert_volunteer" ON evidence FOR INSERT
  TO authenticated WITH CHECK (
    volunteer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

DROP POLICY IF EXISTS "evidence_delete_owner" ON evidence;
CREATE POLICY "evidence_delete_owner" ON evidence FOR DELETE
  TO authenticated USING (volunteer_id = auth.uid());

-- ============================================================
-- POLICIES: VERIFICATION RECORDS
-- ============================================================
DROP POLICY IF EXISTS "verification_select_staff_or_assigned" ON verification_records;
CREATE POLICY "verification_select_staff_or_assigned" ON verification_records FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
    OR EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = verification_records.task_id AND ta.volunteer_id = auth.uid())
  );

DROP POLICY IF EXISTS "verification_insert_staff" ON verification_records;
CREATE POLICY "verification_insert_staff" ON verification_records FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

-- ============================================================
-- POLICIES: NOTIFICATIONS
-- ============================================================
DROP POLICY IF EXISTS "notif_select_own" ON notifications;
CREATE POLICY "notif_select_own" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_insert_any" ON notifications;
CREATE POLICY "notif_insert_any" ON notifications FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notif_update_own" ON notifications;
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_delete_own" ON notifications;
CREATE POLICY "notif_delete_own" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- POLICIES: FEEDBACK
-- ============================================================
DROP POLICY IF EXISTS "feedback_select_owner_or_staff" ON feedback;
CREATE POLICY "feedback_select_owner_or_staff" ON feedback FOR SELECT
  TO authenticated USING (
    citizen_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

DROP POLICY IF EXISTS "feedback_insert_owner" ON feedback;
CREATE POLICY "feedback_insert_owner" ON feedback FOR INSERT
  TO authenticated WITH CHECK (
    citizen_id = auth.uid()
    AND EXISTS (SELECT 1 FROM reports r WHERE r.id = feedback.report_id AND r.reporter_id = auth.uid())
  );

-- ============================================================
-- POLICIES: AUDIT LOGS
-- ============================================================
DROP POLICY IF EXISTS "audit_select_staff" ON audit_logs;
CREATE POLICY "audit_select_staff" ON audit_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin'))
  );

DROP POLICY IF EXISTS "audit_insert_any" ON audit_logs;
CREATE POLICY "audit_insert_any" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============================================================
-- POLICIES: SYSTEM SETTINGS
-- ============================================================
DROP POLICY IF EXISTS "settings_select_all" ON system_settings;
CREATE POLICY "settings_select_all" ON system_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "settings_update_admin" ON system_settings;
CREATE POLICY "settings_update_admin" ON system_settings FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "settings_insert_admin" ON system_settings;
CREATE POLICY "settings_insert_admin" ON system_settings FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'citizen')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS reports_updated_at ON reports;
CREATE TRIGGER reports_updated_at BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS volunteers_updated_at ON volunteers;
CREATE TRIGGER volunteers_updated_at BEFORE UPDATE ON volunteers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS assignments_updated_at ON task_assignments;
CREATE TRIGGER assignments_updated_at BEFORE UPDATE ON task_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO report_categories (name, slug, icon, description) VALUES
  ('Garbage', 'garbage', 'Trash2', 'Waste collection, illegal dumping, overflowing bins'),
  ('Road Damage', 'road-damage', 'Construction', 'Potholes, cracked pavement, road erosion'),
  ('Streetlight', 'streetlight', 'Lightbulb', 'Broken or non-functional street lighting'),
  ('Water Leakage', 'water-leakage', 'Droplets', 'Pipe bursts, water supply issues, leaks'),
  ('Medical', 'medical', 'Stethoscope', 'Public health hazards, sanitation emergencies'),
  ('Flood Relief', 'flood-relief', 'Waves', 'Flooding, waterlogging, drainage overflow'),
  ('Education', 'education', 'GraduationCap', 'School infrastructure, educational access issues'),
  ('Food', 'food', 'UtensilsCrossed', 'Food distribution, food safety, hunger relief'),
  ('Shelter', 'shelter', 'Home', 'Housing issues, homeless support, shelter needs'),
  ('Other', 'other', 'CircleHelp', 'Uncategorized community issues')
ON CONFLICT (name) DO NOTHING;

INSERT INTO system_settings (key, value, description) VALUES
  ('priority_weights', '{"severity": 40, "urgency": 25, "affected_people": 20, "waiting_time": 15}', 'Configurable weights for priority score calculation'),
  ('ai_integration', '{"active": false, "provider": null}', 'AI categorization and classification integration status'),
  ('map_provider', '{"name": "manual", "api_key_configured": false}', 'Map provider configuration'),
  ('notification_channels', '{"in_app": true, "push": false, "sms": false, "email": false, "whatsapp": false}', 'Active notification delivery channels')
ON CONFLICT (key) DO NOTHING;
/*
# Add atomic task acceptance function for concurrency control

## Purpose
When multiple volunteers try to accept the same task simultaneously, a race condition
can occur. This SECURITY DEFINER function uses an atomic UPDATE with a WHERE clause
that checks the current assignment status, ensuring only one volunteer can accept.

## Function
- accept_task_atomic(p_task_id, p_volunteer_id)
- Checks if the task_assignment exists and is in 'assigned' status
- Atomically updates to 'accepted' only if still 'assigned'
- Returns { success: boolean, error: text }
- Also updates the task status to 'accepted' and the report status

## Security
- SECURITY DEFINER so it can update task_assignments and tasks atomically
- Only callable by authenticated users
- Verifies the volunteer_id matches auth.uid()
*/

CREATE OR REPLACE FUNCTION accept_task_atomic(p_task_id uuid, p_volunteer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment_id uuid;
  v_current_status text;
BEGIN
  -- Verify caller is the volunteer
  IF auth.uid() IS NULL OR auth.uid() != p_volunteer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: caller must be the volunteer');
  END IF;

  -- Find the assignment
  SELECT id, status INTO v_assignment_id, v_current_status
  FROM task_assignments
  WHERE task_id = p_task_id AND volunteer_id = p_volunteer_id
  FOR UPDATE;

  IF v_assignment_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No assignment found for this task and volunteer');
  END IF;

  -- Check if already accepted or declined
  IF v_current_status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task already accepted by you');
  END IF;

  IF v_current_status = 'declined' THEN
    RETURN jsonb_build_object('success', false, 'error', 'You previously declined this task');
  END IF;

  IF v_current_status = 'reassigned' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task has been reassigned');
  END IF;

  -- Check if any other volunteer has already accepted this task (for single-assignment tasks)
  PERFORM 1 FROM task_assignments
  WHERE task_id = p_task_id AND status = 'accepted'
  AND volunteer_id != p_volunteer_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task already accepted by another volunteer');
  END IF;

  -- Atomically accept
  UPDATE task_assignments
  SET status = 'accepted', accepted_at = now(), updated_at = now()
  WHERE id = v_assignment_id AND status = 'assigned';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task was no longer available for acceptance');
  END IF;

  -- Update task status
  UPDATE tasks SET status = 'accepted', updated_at = now() WHERE id = p_task_id;

  -- Update report status
  UPDATE reports SET status = 'accepted', updated_at = now() WHERE id = (
    SELECT report_id FROM tasks WHERE id = p_task_id
  );

  -- Insert status history
  INSERT INTO task_status_history (task_id, from_status, to_status, changed_by, reason)
  VALUES (p_task_id, 'assigned', 'accepted', p_volunteer_id, 'Task accepted by volunteer');

  RETURN jsonb_build_object('success', true, 'error', null);
END;
$$;

GRANT EXECUTE ON FUNCTION accept_task_atomic TO authenticated;
/*
# Create report-media storage bucket

## Purpose
Creates a public storage bucket for report evidence images and videos.
The bucket is public so that uploaded files can be accessed via public URLs.

## Changes
- Creates storage bucket 'report-media' if it doesn't exist
- Sets it as public (anyone with the URL can read)
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('report-media', 'report-media', true)
ON CONFLICT (id) DO NOTHING;
/*
# Add storage policies for report-media bucket

## Purpose
The 'report-media' bucket stores report evidence images/videos and task before/after evidence.
The bucket is public (readable via URL) so the frontend can display images in <img> tags.
This migration adds policies to control who can upload and delete files.

## Policies
1. Public read — anyone can read files (required for getPublicUrl)
2. Authenticated upload — any signed-in user can upload
3. Staff delete — supervisors and admins can delete files

## Security
- Unauthenticated users CANNOT upload or delete
- Authenticated users CAN upload (needed for evidence submission)
- Only staff can delete files (citizens delete via DB-level cascade)
- Reads are public (bucket is public for getPublicUrl compatibility)
*/

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "report_media_public_read" ON storage.objects;
DROP POLICY IF EXISTS "report_media_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "report_media_staff_delete" ON storage.objects;

-- Policy 1: Public read
CREATE POLICY "report_media_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'report-media');

-- Policy 2: Authenticated upload
CREATE POLICY "report_media_auth_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'report-media');

-- Policy 3: Staff-only delete
CREATE POLICY "report_media_staff_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'report-media'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin')
  )
);
-- Harden public signup, profile role changes, and report location visibility.

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

DROP POLICY IF EXISTS "profiles_select_all_staff" ON public.profiles;
CREATE POLICY "profiles_select_all_staff" ON public.profiles FOR SELECT
  TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = public.get_user_role(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    'citizen'
  );
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "location_select_own_or_staff" ON public.report_locations;
CREATE POLICY "location_select_own_or_staff" ON public.report_locations FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_locations.report_id
        AND (
          r.reporter_id = auth.uid()
          OR r.assigned_volunteer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin')
          )
        )
    )
  );
-- CivicSync demo authentication and RLS recursion fix.
-- Apply after the base schema and existing authentication hardening migrations.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role
  FROM public.profiles AS p
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- Profile access: signup profiles are created only by the auth trigger.
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;

DROP POLICY IF EXISTS "profiles_select_all_staff" ON public.profiles;
CREATE POLICY "profiles_select_all_staff" ON public.profiles FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = public.current_user_role()
  );

DROP POLICY IF EXISTS "profiles_update_role_admin" ON public.profiles;
CREATE POLICY "profiles_update_role_admin" ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() = 'admin'
    AND id <> auth.uid()
  )
  WITH CHECK (
    public.current_user_role() = 'admin'
    AND id <> auth.uid()
  );

-- Replace role lookups in all affected policies to avoid profiles recursion.
DROP POLICY IF EXISTS "categories_insert_admin" ON public.report_categories;
CREATE POLICY "categories_insert_admin" ON public.report_categories FOR INSERT
  TO authenticated WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "categories_update_admin" ON public.report_categories;
CREATE POLICY "categories_update_admin" ON public.report_categories FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "categories_delete_admin" ON public.report_categories;
CREATE POLICY "categories_delete_admin" ON public.report_categories FOR DELETE
  TO authenticated USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "reports_select_own_or_staff" ON public.reports;
CREATE POLICY "reports_select_own_or_staff" ON public.reports FOR SELECT
  TO authenticated USING (
    auth.uid() = reporter_id
    OR auth.uid() = assigned_volunteer_id
    OR public.current_user_role() IN ('supervisor', 'admin')
  );

DROP POLICY IF EXISTS "reports_update_own_or_staff" ON public.reports;
CREATE POLICY "reports_update_own_or_staff" ON public.reports FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = reporter_id
    OR public.current_user_role() IN ('supervisor', 'admin')
  )
  WITH CHECK (
    auth.uid() = reporter_id
    OR public.current_user_role() IN ('supervisor', 'admin')
  );

DROP POLICY IF EXISTS "reports_delete_staff" ON public.reports;
CREATE POLICY "reports_delete_staff" ON public.reports FOR DELETE
  TO authenticated USING (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "media_select_own_or_staff" ON public.report_media;
CREATE POLICY "media_select_own_or_staff" ON public.report_media FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.reports AS r
      WHERE r.id = report_media.report_id
        AND (
          r.reporter_id = auth.uid()
          OR r.assigned_volunteer_id = auth.uid()
          OR public.current_user_role() IN ('supervisor', 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "media_insert_report_owner" ON public.report_media;
CREATE POLICY "media_insert_report_owner" ON public.report_media FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reports AS r
      WHERE r.id = report_media.report_id AND r.reporter_id = auth.uid()
    )
    OR public.current_user_role() IN ('supervisor', 'admin')
  );

DROP POLICY IF EXISTS "media_delete_owner" ON public.report_media;
CREATE POLICY "media_delete_owner" ON public.report_media FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.reports AS r
      WHERE r.id = report_media.report_id AND r.reporter_id = auth.uid()
    )
    OR public.current_user_role() IN ('supervisor', 'admin')
  );

DROP POLICY IF EXISTS "location_select_own_or_staff" ON public.report_locations;
CREATE POLICY "location_select_own_or_staff" ON public.report_locations FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.reports AS r
      WHERE r.id = report_locations.report_id
        AND (
          r.reporter_id = auth.uid()
          OR r.assigned_volunteer_id = auth.uid()
          OR public.current_user_role() IN ('supervisor', 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "dup_select_staff" ON public.duplicate_candidates;
CREATE POLICY "dup_select_staff" ON public.duplicate_candidates FOR SELECT
  TO authenticated USING (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "dup_insert_staff" ON public.duplicate_candidates;
CREATE POLICY "dup_insert_staff" ON public.duplicate_candidates FOR INSERT
  TO authenticated WITH CHECK (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "dup_update_staff" ON public.duplicate_candidates;
CREATE POLICY "dup_update_staff" ON public.duplicate_candidates FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('supervisor', 'admin'))
  WITH CHECK (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "priority_select_staff" ON public.priority_scores;
CREATE POLICY "priority_select_staff" ON public.priority_scores FOR SELECT
  TO authenticated USING (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "priority_insert_staff" ON public.priority_scores;
CREATE POLICY "priority_insert_staff" ON public.priority_scores FOR INSERT
  TO authenticated WITH CHECK (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "priority_update_staff" ON public.priority_scores;
CREATE POLICY "priority_update_staff" ON public.priority_scores FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('supervisor', 'admin'))
  WITH CHECK (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "volunteers_select_own_or_staff" ON public.volunteers;
CREATE POLICY "volunteers_select_own_or_staff" ON public.volunteers FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR public.current_user_role() IN ('supervisor', 'admin')
  );

DROP POLICY IF EXISTS "volunteers_update_own_or_staff" ON public.volunteers;
CREATE POLICY "volunteers_update_own_or_staff" ON public.volunteers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.current_user_role() IN ('supervisor', 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "vskills_select_own_or_staff" ON public.volunteer_skills;
CREATE POLICY "vskills_select_own_or_staff" ON public.volunteer_skills FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.volunteers AS v
      WHERE v.id = volunteer_skills.volunteer_id
        AND (v.user_id = auth.uid() OR public.current_user_role() IN ('supervisor', 'admin'))
    )
  );

DROP POLICY IF EXISTS "vavail_select_own_or_staff" ON public.volunteer_availability;
CREATE POLICY "vavail_select_own_or_staff" ON public.volunteer_availability FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.volunteers AS v
      WHERE v.id = volunteer_availability.volunteer_id
        AND (v.user_id = auth.uid() OR public.current_user_role() IN ('supervisor', 'admin'))
    )
  );

DROP POLICY IF EXISTS "tasks_select_staff_or_assigned" ON public.tasks;
CREATE POLICY "tasks_select_staff_or_assigned" ON public.tasks FOR SELECT
  TO authenticated USING (
    public.current_user_role() IN ('supervisor', 'admin')
    OR EXISTS (SELECT 1 FROM public.task_assignments AS ta WHERE ta.task_id = tasks.id AND ta.volunteer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.reports AS r WHERE r.id = tasks.report_id AND r.reporter_id = auth.uid())
  );

DROP POLICY IF EXISTS "tasks_insert_staff" ON public.tasks;
CREATE POLICY "tasks_insert_staff" ON public.tasks FOR INSERT
  TO authenticated WITH CHECK (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "tasks_update_staff_or_volunteer" ON public.tasks;
CREATE POLICY "tasks_update_staff_or_volunteer" ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() IN ('supervisor', 'admin')
    OR EXISTS (SELECT 1 FROM public.task_assignments AS ta WHERE ta.task_id = tasks.id AND ta.volunteer_id = auth.uid())
  )
  WITH CHECK (
    public.current_user_role() IN ('supervisor', 'admin')
    OR EXISTS (SELECT 1 FROM public.task_assignments AS ta WHERE ta.task_id = tasks.id AND ta.volunteer_id = auth.uid())
  );

DROP POLICY IF EXISTS "assignments_select_staff_or_volunteer" ON public.task_assignments;
CREATE POLICY "assignments_select_staff_or_volunteer" ON public.task_assignments FOR SELECT
  TO authenticated USING (volunteer_id = auth.uid() OR public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "assignments_insert_staff" ON public.task_assignments;
CREATE POLICY "assignments_insert_staff" ON public.task_assignments FOR INSERT
  TO authenticated WITH CHECK (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "assignments_update_staff_or_volunteer" ON public.task_assignments;
CREATE POLICY "assignments_update_staff_or_volunteer" ON public.task_assignments FOR UPDATE
  TO authenticated
  USING (volunteer_id = auth.uid() OR public.current_user_role() IN ('supervisor', 'admin'))
  WITH CHECK (volunteer_id = auth.uid() OR public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "task_history_select_staff_or_assigned" ON public.task_status_history;
CREATE POLICY "task_history_select_staff_or_assigned" ON public.task_status_history FOR SELECT
  TO authenticated USING (
    public.current_user_role() IN ('supervisor', 'admin')
    OR EXISTS (SELECT 1 FROM public.task_assignments AS ta WHERE ta.task_id = task_status_history.task_id AND ta.volunteer_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.tasks AS t JOIN public.reports AS r ON r.id = t.report_id
      WHERE t.id = task_status_history.task_id AND r.reporter_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "task_history_insert_staff_or_volunteer" ON public.task_status_history;
CREATE POLICY "task_history_insert_staff_or_volunteer" ON public.task_status_history FOR INSERT
  TO authenticated WITH CHECK (public.current_user_role() IN ('supervisor', 'admin', 'volunteer'));

DROP POLICY IF EXISTS "evidence_select_staff_or_volunteer" ON public.evidence;
CREATE POLICY "evidence_select_staff_or_volunteer" ON public.evidence FOR SELECT
  TO authenticated USING (volunteer_id = auth.uid() OR public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "evidence_insert_volunteer" ON public.evidence;
CREATE POLICY "evidence_insert_volunteer" ON public.evidence FOR INSERT
  TO authenticated WITH CHECK (volunteer_id = auth.uid() OR public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "verification_select_staff_or_assigned" ON public.verification_records;
CREATE POLICY "verification_select_staff_or_assigned" ON public.verification_records FOR SELECT
  TO authenticated USING (
    public.current_user_role() IN ('supervisor', 'admin')
    OR EXISTS (SELECT 1 FROM public.task_assignments AS ta WHERE ta.task_id = verification_records.task_id AND ta.volunteer_id = auth.uid())
  );

DROP POLICY IF EXISTS "verification_insert_staff" ON public.verification_records;
CREATE POLICY "verification_insert_staff" ON public.verification_records FOR INSERT
  TO authenticated WITH CHECK (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "feedback_select_owner_or_staff" ON public.feedback;
CREATE POLICY "feedback_select_owner_or_staff" ON public.feedback FOR SELECT
  TO authenticated USING (citizen_id = auth.uid() OR public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "audit_select_staff" ON public.audit_logs;
CREATE POLICY "audit_select_staff" ON public.audit_logs FOR SELECT
  TO authenticated USING (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "settings_update_admin" ON public.system_settings;
CREATE POLICY "settings_update_admin" ON public.system_settings FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "settings_insert_admin" ON public.system_settings;
CREATE POLICY "settings_insert_admin" ON public.system_settings FOR INSERT
  TO authenticated WITH CHECK (public.current_user_role() = 'admin');

-- Clients cannot forge system notifications or audit records.
DROP POLICY IF EXISTS "notif_insert_any" ON public.notifications;
DROP POLICY IF EXISTS "audit_insert_any" ON public.audit_logs;

-- Public signup always creates a citizen profile.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    'citizen'
  );
  RETURN NEW;
END;
$$;

-- Avoid recursive profile lookups in storage role checks.
DROP POLICY IF EXISTS "report_media_staff_delete" ON storage.objects;
CREATE POLICY "report_media_staff_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'report-media' AND public.current_user_role() IN ('supervisor', 'admin'));
