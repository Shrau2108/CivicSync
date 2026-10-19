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