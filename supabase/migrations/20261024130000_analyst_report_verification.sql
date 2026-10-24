-- Allow analysts to review newly submitted reports and notify supervisors.
-- All writes happen in security-checked RPCs; clients cannot elevate roles.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('citizen', 'volunteer', 'supervisor', 'analyst', 'admin'));

DROP POLICY IF EXISTS "reports_select_own_or_staff" ON public.reports;
CREATE POLICY "reports_select_own_or_staff" ON public.reports FOR SELECT
  TO authenticated USING (
    auth.uid() = reporter_id
    OR auth.uid() = assigned_volunteer_id
    OR public.current_user_role() IN ('analyst', 'supervisor', 'admin')
  );

DROP POLICY IF EXISTS "location_select_own_or_staff" ON public.report_locations;
CREATE POLICY "location_select_own_or_staff" ON public.report_locations FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_locations.report_id
        AND (
          r.reporter_id = auth.uid()
          OR r.assigned_volunteer_id = auth.uid()
          OR public.current_user_role() IN ('analyst', 'supervisor', 'admin')
        )
    )
  );

CREATE OR REPLACE FUNCTION public.analyst_verify_report(p_report_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_report public.reports%ROWTYPE;
  v_role text;
  v_reviewed_at timestamptz := now();
  v_supervisor_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  v_role := public.current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('analyst', 'admin') THEN
    RAISE EXCEPTION 'Only analysts and admins can verify reports' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_report
  FROM public.reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_report.status NOT IN ('submitted', 'under_review') THEN
    RAISE EXCEPTION 'Only submitted or under-review reports can be verified' USING ERRCODE = '22023';
  END IF;

  UPDATE public.reports
  SET status = 'verified',
      reviewer_id = auth.uid(),
      reviewed_at = v_reviewed_at,
      updated_at = v_reviewed_at
  WHERE id = p_report_id;

  INSERT INTO public.notifications (user_id, title, description, category, related_report_id)
  VALUES (
    v_report.reporter_id,
    'Report Verified',
    format('Your report "%s" has been verified and sent to the supervisor team.', v_report.title),
    'report_reviewed',
    p_report_id
  );

  INSERT INTO public.notifications (user_id, title, description, category, related_report_id)
  SELECT p.id,
         'Report Ready for Assignment',
         format('The analyst verified "%s". It is ready for supervisor review and volunteer assignment.', v_report.title),
         'report_reviewed',
         p_report_id
  FROM public.profiles p
  WHERE p.role = 'supervisor' AND p.is_active = true;
  GET DIAGNOSTICS v_supervisor_count = ROW_COUNT;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'analyst_verify_report',
    'report',
    p_report_id,
    jsonb_build_object('from', v_report.status, 'to', 'verified', 'supervisors_notified', v_supervisor_count)
  );

  RETURN jsonb_build_object(
    'report_id', p_report_id,
    'status', 'verified',
    'reviewer_id', auth.uid(),
    'reviewed_at', v_reviewed_at,
    'notified_supervisors', v_supervisor_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.analyst_verify_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.analyst_verify_report(uuid) TO authenticated;

-- Analysts can set a recommended priority without receiving broad UPDATE
-- access to every report field.
CREATE OR REPLACE FUNCTION public.update_report_priority(
  p_report_id uuid,
  p_priority_level text,
  p_priority_score numeric,
  p_urgency text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  v_role := public.current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('analyst', 'supervisor', 'admin') THEN
    RAISE EXCEPTION 'Not authorized to update report priority' USING ERRCODE = '42501';
  END IF;

  IF p_priority_level NOT IN ('low', 'medium', 'high', 'critical')
    OR p_priority_score IS NULL OR p_priority_score < 0 OR p_priority_score > 100
    OR (p_urgency IS NOT NULL AND p_urgency NOT IN ('low', 'medium', 'high', 'critical')) THEN
    RAISE EXCEPTION 'Invalid report priority values' USING ERRCODE = '22023';
  END IF;

  UPDATE public.reports
  SET priority_level = p_priority_level,
      priority_score = p_priority_score,
      urgency = COALESCE(p_urgency, urgency),
      updated_at = now()
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_report_priority(uuid, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_report_priority(uuid, text, numeric, text) TO authenticated;
