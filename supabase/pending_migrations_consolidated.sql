-- ============================================================
-- FILE: 20260927130000_atomic_supervisor_report_review.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.review_report(p_report_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_report public.reports%ROWTYPE;
  v_previous_status text;
  v_reviewed_at timestamptz := now();
  v_title text;
  v_description text;
  v_action text;
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  v_role := public.current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('supervisor', 'admin') THEN
    RAISE EXCEPTION 'Only supervisors and admins can review reports' USING ERRCODE = '42501';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('under_review', 'verified', 'rejected') THEN
    RAISE EXCEPTION 'Invalid report review status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_report
  FROM public.reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002';
  END IF;

  v_previous_status := v_report.status;
  IF (p_status = 'under_review' AND v_previous_status <> 'submitted')
    OR (p_status IN ('verified', 'rejected') AND v_previous_status NOT IN ('submitted', 'under_review')) THEN
    RAISE EXCEPTION 'Invalid report status transition from % to %', v_previous_status, p_status
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.reports
  SET status = p_status,
      reviewer_id = auth.uid(),
      reviewed_at = v_reviewed_at,
      updated_at = v_reviewed_at
  WHERE id = p_report_id
  RETURNING * INTO v_report;

  v_title := CASE p_status
    WHEN 'under_review' THEN 'Report Under Review'
    WHEN 'verified' THEN 'Report Verified'
    ELSE 'Report Rejected'
  END;
  v_description := CASE p_status
    WHEN 'under_review' THEN format('Your report "%s" is now being reviewed.', v_report.title)
    WHEN 'verified' THEN format('Your report "%s" has been verified.', v_report.title)
    ELSE format('Your report "%s" was rejected. Please review the report details.', v_report.title)
  END;
  v_action := CASE p_status
    WHEN 'under_review' THEN 'start_report_review'
    WHEN 'verified' THEN 'verify_report'
    ELSE 'reject_report'
  END;

  INSERT INTO public.notifications (user_id, title, description, category, related_report_id)
  VALUES (v_report.reporter_id, v_title, v_description, 'report_reviewed', p_report_id);

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    v_action,
    'report',
    p_report_id,
    jsonb_build_object('from', v_previous_status, 'to', p_status)
  );

  RETURN jsonb_build_object(
    'report_id', p_report_id,
    'status', p_status,
    'reviewer_id', auth.uid(),
    'reviewed_at', v_reviewed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_report(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_report(uuid, text) TO authenticated;

-- ============================================================
-- FILE: 20261006120000_priority_queue_urgency_and_task_uniqueness.sql
-- ============================================================

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS urgency text NOT NULL DEFAULT 'medium';

ALTER TABLE public.reports
  ALTER COLUMN priority_score TYPE numeric(6, 2)
  USING priority_score::numeric(6, 2);

ALTER TABLE public.tasks
  ALTER COLUMN priority_score TYPE numeric(6, 2)
  USING priority_score::numeric(6, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reports_urgency_check'
      AND conrelid = 'public.reports'::regclass
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_urgency_check
      CHECK (urgency IN ('critical', 'high', 'medium', 'low'));
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_report_id_unique
  ON public.tasks (report_id);


-- ============================================================
-- FILE: 20261006130000_atomic_volunteer_assignment.sql
-- ============================================================

ALTER TABLE public.task_assignments
  DROP CONSTRAINT IF EXISTS task_assignments_status_check;

ALTER TABLE public.task_assignments
  ADD CONSTRAINT task_assignments_status_check
  CHECK (status IN ('assigned', 'accepted', 'declined', 'reassigned', 'cancelled', 'completed'));

CREATE OR REPLACE FUNCTION public.refresh_volunteer_workload(p_volunteer_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.volunteers AS volunteer
  SET current_workload = (
    SELECT count(*)::integer
    FROM public.task_assignments AS assignment
    JOIN public.tasks AS task ON task.id = assignment.task_id
    WHERE assignment.volunteer_id = p_volunteer_user_id
      AND assignment.status IN ('assigned', 'accepted')
      AND task.status IN ('assigned', 'accepted', 'in_progress', 'evidence_submitted', 'under_verification')
  )
  WHERE volunteer.user_id = p_volunteer_user_id;
$$;

REVOKE ALL ON FUNCTION public.refresh_volunteer_workload(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.sync_volunteer_workload_from_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM public.refresh_volunteer_workload(OLD.volunteer_id);
  END IF;
  IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR NEW.volunteer_id IS DISTINCT FROM OLD.volunteer_id) THEN
    PERFORM public.refresh_volunteer_workload(NEW.volunteer_id);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_assignments_sync_volunteer_workload ON public.task_assignments;
CREATE TRIGGER task_assignments_sync_volunteer_workload
AFTER INSERT OR UPDATE OF volunteer_id, status OR DELETE ON public.task_assignments
FOR EACH ROW EXECUTE FUNCTION public.sync_volunteer_workload_from_assignment();

CREATE OR REPLACE FUNCTION public.close_assignments_for_terminal_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_volunteer_user_id uuid;
BEGIN
  IF NEW.status IN ('completed', 'cancelled', 'rejected') AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.task_assignments
    SET status = CASE WHEN NEW.status = 'completed' THEN 'completed' ELSE 'cancelled' END,
        updated_at = now()
    WHERE task_id = NEW.id
      AND status IN ('assigned', 'accepted');
  END IF;

  FOR v_volunteer_user_id IN
    SELECT DISTINCT volunteer_id
    FROM public.task_assignments
    WHERE task_id = NEW.id
  LOOP
    PERFORM public.refresh_volunteer_workload(v_volunteer_user_id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_close_assignments_on_terminal_status ON public.tasks;
CREATE TRIGGER tasks_close_assignments_on_terminal_status
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.close_assignments_for_terminal_task();

UPDATE public.volunteers AS volunteer
SET current_workload = (
  SELECT count(*)::integer
  FROM public.task_assignments AS assignment
  JOIN public.tasks AS task ON task.id = assignment.task_id
  WHERE assignment.volunteer_id = volunteer.user_id
    AND assignment.status IN ('assigned', 'accepted')
    AND task.status IN ('assigned', 'accepted', 'in_progress', 'evidence_submitted', 'under_verification')
);

CREATE OR REPLACE FUNCTION public.assign_task_atomic(p_task_id uuid, p_volunteer_id uuid)
RETURNS public.task_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_task public.tasks%ROWTYPE;
  v_report public.reports%ROWTYPE;
  v_volunteer public.volunteers%ROWTYPE;
  v_assignment public.task_assignments%ROWTYPE;
  v_has_schedule boolean;
  v_schedule_match boolean;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(public.current_user_role(), '') NOT IN ('supervisor', 'admin') THEN
    RAISE EXCEPTION 'Only supervisors and admins can assign tasks' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_task.status NOT IN ('assigned', 'declined', 'reassigned') THEN
    RAISE EXCEPTION 'Task is not available for assignment' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_report
  FROM public.reports
  WHERE id = v_task.report_id
  FOR UPDATE;
  IF NOT FOUND OR v_report.is_duplicate OR v_report.status NOT IN ('verified', 'prioritized', 'assigned') THEN
    RAISE EXCEPTION 'Report is not eligible for volunteer assignment' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.task_assignments
    WHERE task_id = p_task_id AND status IN ('assigned', 'accepted')
  ) THEN
    RAISE EXCEPTION 'Task already has an active volunteer assignment' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO v_volunteer
  FROM public.volunteers
  WHERE user_id = p_volunteer_id
  FOR UPDATE;
  IF NOT FOUND OR NOT v_volunteer.is_verified OR v_volunteer.verification_status <> 'verified' THEN
    RAISE EXCEPTION 'Volunteer is not verified' USING ERRCODE = '22023';
  END IF;
  IF v_volunteer.current_workload >= v_volunteer.max_workload THEN
    RAISE EXCEPTION 'Volunteer has reached maximum workload' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.volunteer_availability
    WHERE volunteer_id = v_volunteer.id
  ) INTO v_has_schedule;
  IF NOT v_has_schedule THEN
    RAISE EXCEPTION 'Volunteer has no recorded availability schedule' USING ERRCODE = '22023';
  END IF;
  SELECT EXISTS (
    SELECT 1
    FROM public.volunteer_availability
    WHERE volunteer_id = v_volunteer.id
      AND is_available
      AND day_of_week = lower(to_char(now(), 'Dy'))
      AND localtime >= start_time::time
      AND localtime < end_time::time
  ) INTO v_schedule_match;
  IF NOT v_schedule_match THEN
    RAISE EXCEPTION 'Volunteer is not available at this time' USING ERRCODE = '22023';
  END IF;

  IF cardinality(v_task.required_skills) > 0 AND EXISTS (
    SELECT 1
    FROM unnest(v_task.required_skills) AS required_skill
    WHERE NOT EXISTS (
      SELECT 1 FROM public.volunteer_skills AS skill
      WHERE skill.volunteer_id = v_volunteer.id
        AND lower(trim(skill.skill)) = lower(trim(required_skill))
    )
  ) THEN
    RAISE EXCEPTION 'Volunteer does not have all required task skills' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.task_assignments (task_id, volunteer_id, assigned_by, status)
  VALUES (p_task_id, p_volunteer_id, auth.uid(), 'assigned')
  RETURNING * INTO v_assignment;

  UPDATE public.tasks
  SET status = 'assigned', updated_at = now()
  WHERE id = p_task_id;

  UPDATE public.reports
  SET status = 'assigned', assigned_volunteer_id = p_volunteer_id, updated_at = now()
  WHERE id = v_report.id;

  IF v_task.status <> 'assigned' THEN
    INSERT INTO public.task_status_history (task_id, from_status, to_status, changed_by, reason)
    VALUES (p_task_id, v_task.status, 'assigned', auth.uid(), 'Reassigned by supervisor through volunteer matching');
  END IF;

  RETURN v_assignment;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_task_atomic(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_task_atomic(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_task_atomic(p_task_id uuid, p_volunteer_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_task public.tasks%ROWTYPE;
  v_assignment public.task_assignments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_volunteer_id THEN
    RAISE EXCEPTION 'Only the assigned volunteer can decline this task' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_assignment
  FROM public.task_assignments
  WHERE task_id = p_task_id
    AND volunteer_id = p_volunteer_id
    AND status = 'assigned'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending assignment found for this volunteer' USING ERRCODE = '22023';
  END IF;

  UPDATE public.task_assignments
  SET status = 'declined', declined_at = now(), decline_reason = p_reason, updated_at = now()
  WHERE id = v_assignment.id;

  IF NOT EXISTS (
    SELECT 1 FROM public.task_assignments
    WHERE task_id = p_task_id AND status IN ('assigned', 'accepted')
  ) THEN
    UPDATE public.tasks SET status = 'declined', updated_at = now() WHERE id = p_task_id;
    UPDATE public.reports
    SET status = 'assigned', assigned_volunteer_id = NULL, updated_at = now()
    WHERE id = v_task.report_id;
    INSERT INTO public.task_status_history (task_id, from_status, to_status, changed_by, reason)
    VALUES (p_task_id, v_task.status, 'declined', auth.uid(), 'Volunteer declined; returned to supervisor matching');
  END IF;

  INSERT INTO public.notifications (user_id, title, description, category, related_report_id, related_task_id)
  VALUES (
    v_assignment.assigned_by,
    'Volunteer Declined Task',
    format('The assigned volunteer declined task %s. It is available for reassignment.', v_task.task_id),
    'task_declined',
    v_task.report_id,
    p_task_id
  );

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(), 'decline_task', 'task', p_task_id,
    jsonb_build_object('report_id', v_task.report_id, 'reason', p_reason)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.decline_task_atomic(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_task_atomic(uuid, uuid, text) TO authenticated;


-- ============================================================
-- FILE: 20261019143000_volunteer_task_requests.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.volunteer_task_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  volunteer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text CHECK (message IS NULL OR char_length(message) <= 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_id uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_volunteer_task_requests_pending
  ON public.volunteer_task_requests (report_id, volunteer_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_volunteer_task_requests_status
  ON public.volunteer_task_requests (status, created_at DESC);

ALTER TABLE public.volunteer_task_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.volunteer_task_requests TO authenticated;

DROP POLICY IF EXISTS "volunteer_task_requests_select_own_or_staff" ON public.volunteer_task_requests;
CREATE POLICY "volunteer_task_requests_select_own_or_staff"
  ON public.volunteer_task_requests FOR SELECT TO authenticated
  USING (
    volunteer_id = auth.uid()
    OR public.current_user_role() IN ('supervisor', 'admin')
  );

DROP POLICY IF EXISTS "reports_select_own_or_staff" ON public.reports;
CREATE POLICY "reports_select_own_or_staff" ON public.reports FOR SELECT
  TO authenticated USING (
    auth.uid() = reporter_id
    OR public.current_user_role() IN ('supervisor', 'admin')
    OR auth.uid() = assigned_volunteer_id
    OR (
      status IN ('verified', 'prioritized')
      AND assigned_volunteer_id IS NULL
      AND NOT is_duplicate
      AND EXISTS (
        SELECT 1 FROM public.volunteers AS volunteer
        WHERE volunteer.user_id = auth.uid()
          AND volunteer.is_verified
          AND volunteer.verification_status = 'verified'
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.volunteer_task_requests AS task_request
      WHERE task_request.report_id = reports.id
        AND task_request.volunteer_id = auth.uid()
    )
  );

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_category_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_category_check
  CHECK (category IN (
    'report_submitted', 'report_reviewed', 'priority_updated', 'task_assigned',
    'task_accepted', 'task_declined', 'task_reassigned', 'status_changed',
    'evidence_submitted', 'evidence_approved', 'evidence_rejected',
    'report_resolved', 'feedback_requested', 'task_request_received',
    'task_request_reviewed'
  ));

CREATE OR REPLACE FUNCTION public.submit_volunteer_task_request(
  p_report_id uuid,
  p_message text DEFAULT NULL
)
RETURNS public.volunteer_task_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_report public.reports%ROWTYPE;
  v_volunteer public.volunteers%ROWTYPE;
  v_request public.volunteer_task_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(public.current_user_role(), '') <> 'volunteer' THEN
    RAISE EXCEPTION 'Only volunteers can request a task' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_volunteer
  FROM public.volunteers
  WHERE user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND OR NOT v_volunteer.is_verified OR v_volunteer.verification_status <> 'verified' THEN
    RAISE EXCEPTION 'A verified volunteer profile is required to request a task' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_report
  FROM public.reports
  WHERE id = p_report_id
  FOR UPDATE;
  IF NOT FOUND OR v_report.status NOT IN ('verified', 'prioritized')
      OR v_report.is_duplicate OR v_report.assigned_volunteer_id IS NOT NULL THEN
    RAISE EXCEPTION 'This report is no longer available for volunteer requests' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tasks WHERE report_id = p_report_id) THEN
    RAISE EXCEPTION 'A task already exists for this report' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.volunteer_task_requests
    WHERE report_id = p_report_id AND volunteer_id = auth.uid() AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending request for this report' USING ERRCODE = '23505';
  END IF;
  IF char_length(COALESCE(p_message, '')) > 500 THEN
    RAISE EXCEPTION 'Request notes must be 500 characters or fewer' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.volunteer_task_requests (report_id, volunteer_id, message)
  VALUES (p_report_id, auth.uid(), NULLIF(trim(p_message), ''))
  RETURNING * INTO v_request;

  INSERT INTO public.notifications (user_id, title, description, category, related_report_id)
  SELECT profile.id, 'Volunteer task request',
    format('%s is interested in: %s', COALESCE(profile.full_name, 'A volunteer'), v_report.title),
    'task_request_received', v_report.id
  FROM public.profiles AS profile
  WHERE profile.role IN ('supervisor', 'admin');

  RETURN v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_volunteer_task_request(
  p_request_id uuid,
  p_approve boolean
)
RETURNS public.volunteer_task_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.volunteer_task_requests%ROWTYPE;
  v_report public.reports%ROWTYPE;
  v_task public.tasks%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(public.current_user_role(), '') NOT IN ('supervisor', 'admin') THEN
    RAISE EXCEPTION 'Only supervisors and admins can review volunteer requests' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request
  FROM public.volunteer_task_requests
  WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Volunteer request not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_report
  FROM public.reports
  WHERE id = v_request.report_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The requested report no longer exists' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_request
  FROM public.volunteer_task_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'This volunteer request has already been reviewed' USING ERRCODE = '22023';
  END IF;

  IF NOT p_approve THEN
    UPDATE public.volunteer_task_requests
    SET status = 'rejected', reviewer_id = auth.uid(), reviewed_at = now(), updated_at = now()
    WHERE id = p_request_id
    RETURNING * INTO v_request;

    INSERT INTO public.notifications (user_id, title, description, category, related_report_id)
    SELECT v_request.volunteer_id, 'Task request reviewed',
      'Your request to volunteer for this report was not approved.',
      'task_request_reviewed', v_request.report_id;
    RETURN v_request;
  END IF;

  IF NOT FOUND OR v_report.status NOT IN ('verified', 'prioritized')
      OR v_report.is_duplicate OR v_report.assigned_volunteer_id IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.tasks WHERE report_id = v_report.id) THEN
    RAISE EXCEPTION 'This report is no longer eligible for assignment' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.tasks (
    report_id, title, description, category_id, priority_level,
    priority_score, affected_people, created_by
  ) VALUES (
    v_report.id, v_report.title, v_report.description, v_report.category_id,
    v_report.priority_level, COALESCE(v_report.priority_score, 0),
    COALESCE(v_report.affected_people, 1), auth.uid()
  ) RETURNING * INTO v_task;

  PERFORM public.assign_task_atomic(v_task.id, v_request.volunteer_id);

  UPDATE public.volunteer_task_requests
  SET status = 'approved', reviewer_id = auth.uid(), reviewed_at = now(),
      task_id = v_task.id, updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  INSERT INTO public.notifications (user_id, title, description, category, related_report_id, related_task_id)
  VALUES (
    v_request.volunteer_id, 'Task request approved',
    format('Your interest in "%s" was approved. Review the assignment and accept it to begin.', v_report.title),
    'task_assigned', v_report.id, v_task.id
  );

  WITH rejected_requests AS (
    UPDATE public.volunteer_task_requests
    SET status = 'rejected', reviewer_id = auth.uid(), reviewed_at = now(),
        updated_at = now()
    WHERE report_id = v_report.id AND status = 'pending' AND id <> p_request_id
    RETURNING volunteer_id
  )
  INSERT INTO public.notifications (user_id, title, description, category, related_report_id)
  SELECT volunteer_id, 'Task request reviewed',
    'Another volunteer was selected for this report.', 'task_request_reviewed', v_report.id
  FROM rejected_requests;

  RETURN v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_volunteer_task_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_volunteer_task_request(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.review_volunteer_task_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_volunteer_task_request(uuid, boolean) TO authenticated;

-- ============================================================
-- FILE: 20261019180000_allow_unset_schedule_task_assignment.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.assign_task_atomic(p_task_id uuid, p_volunteer_id uuid)
RETURNS public.task_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_task public.tasks%ROWTYPE;
  v_report public.reports%ROWTYPE;
  v_volunteer public.volunteers%ROWTYPE;
  v_assignment public.task_assignments%ROWTYPE;
  v_has_schedule boolean;
  v_schedule_match boolean;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(public.current_user_role(), '') NOT IN ('supervisor', 'admin') THEN
    RAISE EXCEPTION 'Only supervisors and admins can assign tasks' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_task.status NOT IN ('assigned', 'declined', 'reassigned') THEN
    RAISE EXCEPTION 'Task is not available for assignment' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_report
  FROM public.reports
  WHERE id = v_task.report_id
  FOR UPDATE;
  IF NOT FOUND OR v_report.is_duplicate OR v_report.status NOT IN ('verified', 'prioritized', 'assigned') THEN
    RAISE EXCEPTION 'Report is not eligible for volunteer assignment' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.task_assignments
    WHERE task_id = p_task_id AND status IN ('assigned', 'accepted')
  ) THEN
    RAISE EXCEPTION 'Task already has an active volunteer assignment' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO v_volunteer
  FROM public.volunteers
  WHERE user_id = p_volunteer_id
  FOR UPDATE;
  IF NOT FOUND OR NOT v_volunteer.is_verified OR v_volunteer.verification_status <> 'verified' THEN
    RAISE EXCEPTION 'Volunteer is not verified' USING ERRCODE = '22023';
  END IF;
  IF v_volunteer.current_workload >= v_volunteer.max_workload THEN
    RAISE EXCEPTION 'Volunteer has reached maximum workload' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.volunteer_availability
    WHERE volunteer_id = v_volunteer.id
  ) INTO v_has_schedule;
  IF v_has_schedule THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.volunteer_availability
      WHERE volunteer_id = v_volunteer.id
        AND is_available
        AND day_of_week = lower(to_char(now(), 'Dy'))
        AND localtime >= start_time::time
        AND localtime < end_time::time
    ) INTO v_schedule_match;
    IF NOT v_schedule_match THEN
      RAISE EXCEPTION 'Volunteer is not available at this time' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF cardinality(v_task.required_skills) > 0 AND EXISTS (
    SELECT 1
    FROM unnest(v_task.required_skills) AS required_skill
    WHERE NOT EXISTS (
      SELECT 1 FROM public.volunteer_skills AS skill
      WHERE skill.volunteer_id = v_volunteer.id
        AND lower(trim(skill.skill)) = lower(trim(required_skill))
    )
  ) THEN
    RAISE EXCEPTION 'Volunteer does not have all required task skills' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.task_assignments (task_id, volunteer_id, assigned_by, status)
  VALUES (p_task_id, p_volunteer_id, auth.uid(), 'assigned')
  RETURNING * INTO v_assignment;

  UPDATE public.tasks
  SET status = 'assigned', updated_at = now()
  WHERE id = p_task_id;

  UPDATE public.reports
  SET status = 'assigned', assigned_volunteer_id = p_volunteer_id, updated_at = now()
  WHERE id = v_report.id;

  IF v_task.status <> 'assigned' THEN
    INSERT INTO public.task_status_history (task_id, from_status, to_status, changed_by, reason)
    VALUES (p_task_id, v_task.status, 'assigned', auth.uid(), 'Reassigned by supervisor through volunteer matching');
  END IF;

  RETURN v_assignment;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_task_atomic(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_task_atomic(uuid, uuid) TO authenticated;

-- ============================================================
-- FILE: 20261019190000_provision_volunteer_profile_on_role_change.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.provision_volunteer_profile_for_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role = 'volunteer' THEN
    IF TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM 'volunteer' THEN
      INSERT INTO public.volunteers (user_id)
      VALUES (NEW.id)
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_volunteer_profile_for_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_provision_volunteer_role ON public.profiles;
CREATE TRIGGER profiles_provision_volunteer_role
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.provision_volunteer_profile_for_role();

INSERT INTO public.volunteers (user_id)
SELECT profile.id
FROM public.profiles AS profile
WHERE profile.role = 'volunteer'
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- FILE: 20261021000000_seed_civicsync_defaults.sql
-- ============================================================

INSERT INTO public.report_categories (name, slug, icon, description) VALUES
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

INSERT INTO public.system_settings (key, value, description) VALUES
  ('priority_weights', '{"severity": 40, "urgency": 25, "affected_people": 20, "waiting_time": 15}', 'Configurable weights for priority score calculation'),
  ('ai_integration', '{"active": false, "provider": null}', 'AI categorization and classification integration status'),
  ('map_provider', '{"name": "manual", "api_key_configured": false}', 'Map provider configuration'),
  ('notification_channels', '{"in_app": true, "push": false, "sms": false, "email": false, "whatsapp": false}', 'Active notification delivery channels')
ON CONFLICT (key) DO NOTHING;



