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