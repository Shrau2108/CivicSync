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