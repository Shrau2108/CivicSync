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
