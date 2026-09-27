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