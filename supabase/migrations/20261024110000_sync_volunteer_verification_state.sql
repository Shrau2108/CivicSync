BEGIN;

-- Keep the legacy boolean and the explicit verification status in sync. Older
-- manual updates often changed only is_verified, which made Admin report a
-- verified volunteer that supervisor assignment correctly rejected.
UPDATE public.volunteers
SET is_verified = CASE
      WHEN verification_status = 'rejected' THEN false
      WHEN is_verified OR verification_status = 'verified' THEN true
      ELSE false
    END,
    verification_status = CASE
      WHEN verification_status = 'rejected' THEN 'rejected'
      WHEN is_verified OR verification_status = 'verified' THEN 'verified'
      ELSE 'pending'
    END
WHERE (is_verified IS DISTINCT FROM (verification_status = 'verified'));

CREATE OR REPLACE FUNCTION public.sync_volunteer_verification_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    NEW.is_verified := NEW.verification_status = 'verified';
  ELSIF TG_OP = 'UPDATE' AND NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    IF NEW.verification_status = 'rejected' AND NOT NEW.is_verified THEN
      NEW.verification_status := 'rejected';
    ELSE
      NEW.verification_status := CASE WHEN NEW.is_verified THEN 'verified' ELSE 'pending' END;
    END IF;
  ELSIF NEW.verification_status = 'rejected' THEN
    NEW.is_verified := false;
  ELSIF NEW.is_verified OR NEW.verification_status = 'verified' THEN
    NEW.is_verified := true;
    NEW.verification_status := 'verified';
  ELSE
    NEW.is_verified := false;
    NEW.verification_status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_volunteer_verification_state() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS volunteers_sync_verification_state ON public.volunteers;
CREATE TRIGGER volunteers_sync_verification_state
BEFORE INSERT OR UPDATE OF is_verified, verification_status
ON public.volunteers
FOR EACH ROW
EXECUTE FUNCTION public.sync_volunteer_verification_state();

COMMIT;
