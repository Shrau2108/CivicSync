-- ============================================================
-- AUDIT LOGS: Additive schema enhancements & automated triggers
-- ============================================================

-- Ensure audit_logs has result and ip_address columns
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS result text DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS ip_address text;

-- Index for target entity lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================================
-- FUNCTION: audit_profile_changes()
-- Automatically records untamperable audit logs for profile updates,
-- role modifications, and account activation/deactivation.
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_action text;
  v_changes jsonb := '{}'::jsonb;
  v_details jsonb := '{}'::jsonb;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    v_actor_id := NEW.id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'create_profile';
    v_details := jsonb_build_object(
      'target_name', NEW.full_name,
      'target_email', NEW.email,
      'target_role', NEW.role,
      'is_active', NEW.is_active,
      'result', 'success'
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- 1. Check if role changed
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      v_action := 'change_user_role';
      v_changes := jsonb_build_object('role', jsonb_build_object('old', OLD.role, 'new', NEW.role));
      v_details := jsonb_build_object(
        'target_name', NEW.full_name,
        'target_email', NEW.email,
        'from', OLD.role,
        'to', NEW.role,
        'changes', v_changes,
        'result', 'success'
      );

    -- 2. Check if active status changed
    ELSIF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      v_action := CASE WHEN NEW.is_active THEN 'activate_user' ELSE 'deactivate_user' END;
      v_changes := jsonb_build_object('is_active', jsonb_build_object('old', OLD.is_active, 'new', NEW.is_active));
      v_details := jsonb_build_object(
        'target_name', NEW.full_name,
        'target_email', NEW.email,
        'target_role', NEW.role,
        'changes', v_changes,
        'result', 'success'
      );

    -- 3. Check general profile field modifications
    ELSE
      v_action := 'update_profile';
      IF OLD.full_name IS DISTINCT FROM NEW.full_name THEN
        v_changes := v_changes || jsonb_build_object('full_name', jsonb_build_object('old', OLD.full_name, 'new', NEW.full_name));
      END IF;
      IF OLD.phone IS DISTINCT FROM NEW.phone THEN
        v_changes := v_changes || jsonb_build_object('phone', jsonb_build_object('old', OLD.phone, 'new', NEW.phone));
      END IF;
      IF (OLD.city IS DISTINCT FROM NEW.city) THEN
        v_changes := v_changes || jsonb_build_object('city', jsonb_build_object('old', OLD.city, 'new', NEW.city));
      END IF;
      IF (OLD.area IS DISTINCT FROM NEW.area) THEN
        v_changes := v_changes || jsonb_build_object('area', jsonb_build_object('old', OLD.area, 'new', NEW.area));
      END IF;
      IF (OLD.notification_preferences IS DISTINCT FROM NEW.notification_preferences) THEN
        v_changes := v_changes || jsonb_build_object('notification_preferences', jsonb_build_object('old', OLD.notification_preferences, 'new', NEW.notification_preferences));
      END IF;

      -- Do not log if only updated_at or nothing changed
      IF v_changes = '{}'::jsonb THEN
        RETURN NEW;
      END IF;

      v_details := jsonb_build_object(
        'target_name', NEW.full_name,
        'target_email', NEW.email,
        'target_role', NEW.role,
        'changes', v_changes,
        'result', 'success'
      );
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    details,
    result
  ) VALUES (
    v_actor_id,
    v_action,
    'profile',
    NEW.id,
    v_details,
    'success'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_profile_changes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_profile_changes() TO authenticated;

DROP TRIGGER IF EXISTS trg_audit_profile_changes ON public.profiles;
CREATE TRIGGER trg_audit_profile_changes
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_profile_changes();

-- ============================================================
-- FUNCTION: audit_volunteer_changes()
-- Captures volunteer verification, bio, and service area updates.
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_volunteer_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid;
  v_action text;
  v_changes jsonb := '{}'::jsonb;
  v_details jsonb := '{}'::jsonb;
  v_target_name text;
  v_target_email text;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    v_actor_id := NEW.user_id;
  END IF;

  SELECT p.full_name, p.email INTO v_target_name, v_target_email
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF OLD.verification_status IS DISTINCT FROM NEW.verification_status THEN
    v_action := CASE
      WHEN NEW.verification_status = 'verified' THEN 'approve_volunteer'
      WHEN NEW.verification_status = 'rejected' THEN 'reject_volunteer'
      ELSE 'update_volunteer'
    END;
    v_changes := jsonb_build_object('verification_status', jsonb_build_object('old', OLD.verification_status, 'new', NEW.verification_status));
  ELSIF (OLD.service_area IS DISTINCT FROM NEW.service_area) OR (OLD.bio IS DISTINCT FROM NEW.bio) THEN
    v_action := 'update_volunteer';
    IF OLD.service_area IS DISTINCT FROM NEW.service_area THEN
      v_changes := v_changes || jsonb_build_object('service_area', jsonb_build_object('old', OLD.service_area, 'new', NEW.service_area));
    END IF;
    IF OLD.bio IS DISTINCT FROM NEW.bio THEN
      v_changes := v_changes || jsonb_build_object('bio', jsonb_build_object('old', OLD.bio, 'new', NEW.bio));
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF v_changes = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  v_details := jsonb_build_object(
    'target_name', coalesce(v_target_name, 'Volunteer'),
    'target_email', v_target_email,
    'target_role', 'volunteer',
    'changes', v_changes,
    'result', 'success'
  );

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    details,
    result
  ) VALUES (
    v_actor_id,
    v_action,
    'volunteer',
    NEW.id,
    v_details,
    'success'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_volunteer_changes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_volunteer_changes() TO authenticated;

DROP TRIGGER IF EXISTS trg_audit_volunteer_changes ON public.volunteers;
CREATE TRIGGER trg_audit_volunteer_changes
AFTER UPDATE ON public.volunteers
FOR EACH ROW EXECUTE FUNCTION public.audit_volunteer_changes();
