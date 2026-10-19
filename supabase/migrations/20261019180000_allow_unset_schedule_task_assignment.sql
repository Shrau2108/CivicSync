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