-- Harden public signup, profile role changes, and report location visibility.

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

DROP POLICY IF EXISTS "profiles_select_all_staff" ON public.profiles;
CREATE POLICY "profiles_select_all_staff" ON public.profiles FOR SELECT
  TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = public.get_user_role(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    'citizen'
  );
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "location_select_own_or_staff" ON public.report_locations;
CREATE POLICY "location_select_own_or_staff" ON public.report_locations FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_locations.report_id
        AND (
          r.reporter_id = auth.uid()
          OR r.assigned_volunteer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('supervisor', 'admin')
          )
        )
    )
  );
