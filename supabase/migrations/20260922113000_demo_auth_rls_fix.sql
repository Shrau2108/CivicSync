-- CivicSync demo authentication and RLS recursion fix.
-- Apply after the base schema and existing authentication hardening migrations.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role
  FROM public.profiles AS p
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- Profile access: signup profiles are created only by the auth trigger.
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;

DROP POLICY IF EXISTS "profiles_select_all_staff" ON public.profiles;
CREATE POLICY "profiles_select_all_staff" ON public.profiles FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = public.current_user_role()
  );

DROP POLICY IF EXISTS "profiles_update_role_admin" ON public.profiles;
CREATE POLICY "profiles_update_role_admin" ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() = 'admin'
    AND id <> auth.uid()
  )
  WITH CHECK (
    public.current_user_role() = 'admin'
    AND id <> auth.uid()
  );

-- Replace role lookups in all affected policies to avoid profiles recursion.
DROP POLICY IF EXISTS "categories_insert_admin" ON public.report_categories;
CREATE POLICY "categories_insert_admin" ON public.report_categories FOR INSERT
  TO authenticated WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "categories_update_admin" ON public.report_categories;
CREATE POLICY "categories_update_admin" ON public.report_categories FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "categories_delete_admin" ON public.report_categories;
CREATE POLICY "categories_delete_admin" ON public.report_categories FOR DELETE
  TO authenticated USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "reports_select_own_or_staff" ON public.reports;
CREATE POLICY "reports_select_own_or_staff" ON public.reports FOR SELECT
  TO authenticated USING (
    auth.uid() = reporter_id
    OR auth.uid() = assigned_volunteer_id
    OR public.current_user_role() IN ('supervisor', 'admin')
  );

DROP POLICY IF EXISTS "reports_update_own_or_staff" ON public.reports;
CREATE POLICY "reports_update_own_or_staff" ON public.reports FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = reporter_id
    OR public.current_user_role() IN ('supervisor', 'admin')
  )
  WITH CHECK (
    auth.uid() = reporter_id
    OR public.current_user_role() IN ('supervisor', 'admin')
  );

DROP POLICY IF EXISTS "reports_delete_staff" ON public.reports;
CREATE POLICY "reports_delete_staff" ON public.reports FOR DELETE
  TO authenticated USING (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "media_select_own_or_staff" ON public.report_media;
CREATE POLICY "media_select_own_or_staff" ON public.report_media FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.reports AS r
      WHERE r.id = report_media.report_id
        AND (
          r.reporter_id = auth.uid()
          OR r.assigned_volunteer_id = auth.uid()
          OR public.current_user_role() IN ('supervisor', 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "media_insert_report_owner" ON public.report_media;
CREATE POLICY "media_insert_report_owner" ON public.report_media FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reports AS r
      WHERE r.id = report_media.report_id AND r.reporter_id = auth.uid()
    )
    OR public.current_user_role() IN ('supervisor', 'admin')
  );

DROP POLICY IF EXISTS "media_delete_owner" ON public.report_media;
CREATE POLICY "media_delete_owner" ON public.report_media FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.reports AS r
      WHERE r.id = report_media.report_id AND r.reporter_id = auth.uid()
    )
    OR public.current_user_role() IN ('supervisor', 'admin')
  );

DROP POLICY IF EXISTS "location_select_own_or_staff" ON public.report_locations;
CREATE POLICY "location_select_own_or_staff" ON public.report_locations FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.reports AS r
      WHERE r.id = report_locations.report_id
        AND (
          r.reporter_id = auth.uid()
          OR r.assigned_volunteer_id = auth.uid()
          OR public.current_user_role() IN ('supervisor', 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "dup_select_staff" ON public.duplicate_candidates;
CREATE POLICY "dup_select_staff" ON public.duplicate_candidates FOR SELECT
  TO authenticated USING (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "dup_insert_staff" ON public.duplicate_candidates;
CREATE POLICY "dup_insert_staff" ON public.duplicate_candidates FOR INSERT
  TO authenticated WITH CHECK (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "dup_update_staff" ON public.duplicate_candidates;
CREATE POLICY "dup_update_staff" ON public.duplicate_candidates FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('supervisor', 'admin'))
  WITH CHECK (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "priority_select_staff" ON public.priority_scores;
CREATE POLICY "priority_select_staff" ON public.priority_scores FOR SELECT
  TO authenticated USING (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "priority_insert_staff" ON public.priority_scores;
CREATE POLICY "priority_insert_staff" ON public.priority_scores FOR INSERT
  TO authenticated WITH CHECK (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "priority_update_staff" ON public.priority_scores;
CREATE POLICY "priority_update_staff" ON public.priority_scores FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('supervisor', 'admin'))
  WITH CHECK (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "volunteers_select_own_or_staff" ON public.volunteers;
CREATE POLICY "volunteers_select_own_or_staff" ON public.volunteers FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR public.current_user_role() IN ('supervisor', 'admin')
  );

DROP POLICY IF EXISTS "volunteers_update_own_or_staff" ON public.volunteers;
CREATE POLICY "volunteers_update_own_or_staff" ON public.volunteers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.current_user_role() IN ('supervisor', 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "vskills_select_own_or_staff" ON public.volunteer_skills;
CREATE POLICY "vskills_select_own_or_staff" ON public.volunteer_skills FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.volunteers AS v
      WHERE v.id = volunteer_skills.volunteer_id
        AND (v.user_id = auth.uid() OR public.current_user_role() IN ('supervisor', 'admin'))
    )
  );

DROP POLICY IF EXISTS "vavail_select_own_or_staff" ON public.volunteer_availability;
CREATE POLICY "vavail_select_own_or_staff" ON public.volunteer_availability FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.volunteers AS v
      WHERE v.id = volunteer_availability.volunteer_id
        AND (v.user_id = auth.uid() OR public.current_user_role() IN ('supervisor', 'admin'))
    )
  );

DROP POLICY IF EXISTS "tasks_select_staff_or_assigned" ON public.tasks;
CREATE POLICY "tasks_select_staff_or_assigned" ON public.tasks FOR SELECT
  TO authenticated USING (
    public.current_user_role() IN ('supervisor', 'admin')
    OR EXISTS (SELECT 1 FROM public.task_assignments AS ta WHERE ta.task_id = tasks.id AND ta.volunteer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.reports AS r WHERE r.id = tasks.report_id AND r.reporter_id = auth.uid())
  );

DROP POLICY IF EXISTS "tasks_insert_staff" ON public.tasks;
CREATE POLICY "tasks_insert_staff" ON public.tasks FOR INSERT
  TO authenticated WITH CHECK (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "tasks_update_staff_or_volunteer" ON public.tasks;
CREATE POLICY "tasks_update_staff_or_volunteer" ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() IN ('supervisor', 'admin')
    OR EXISTS (SELECT 1 FROM public.task_assignments AS ta WHERE ta.task_id = tasks.id AND ta.volunteer_id = auth.uid())
  )
  WITH CHECK (
    public.current_user_role() IN ('supervisor', 'admin')
    OR EXISTS (SELECT 1 FROM public.task_assignments AS ta WHERE ta.task_id = tasks.id AND ta.volunteer_id = auth.uid())
  );

DROP POLICY IF EXISTS "assignments_select_staff_or_volunteer" ON public.task_assignments;
CREATE POLICY "assignments_select_staff_or_volunteer" ON public.task_assignments FOR SELECT
  TO authenticated USING (volunteer_id = auth.uid() OR public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "assignments_insert_staff" ON public.task_assignments;
CREATE POLICY "assignments_insert_staff" ON public.task_assignments FOR INSERT
  TO authenticated WITH CHECK (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "assignments_update_staff_or_volunteer" ON public.task_assignments;
CREATE POLICY "assignments_update_staff_or_volunteer" ON public.task_assignments FOR UPDATE
  TO authenticated
  USING (volunteer_id = auth.uid() OR public.current_user_role() IN ('supervisor', 'admin'))
  WITH CHECK (volunteer_id = auth.uid() OR public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "task_history_select_staff_or_assigned" ON public.task_status_history;
CREATE POLICY "task_history_select_staff_or_assigned" ON public.task_status_history FOR SELECT
  TO authenticated USING (
    public.current_user_role() IN ('supervisor', 'admin')
    OR EXISTS (SELECT 1 FROM public.task_assignments AS ta WHERE ta.task_id = task_status_history.task_id AND ta.volunteer_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.tasks AS t JOIN public.reports AS r ON r.id = t.report_id
      WHERE t.id = task_status_history.task_id AND r.reporter_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "task_history_insert_staff_or_volunteer" ON public.task_status_history;
CREATE POLICY "task_history_insert_staff_or_volunteer" ON public.task_status_history FOR INSERT
  TO authenticated WITH CHECK (public.current_user_role() IN ('supervisor', 'admin', 'volunteer'));

DROP POLICY IF EXISTS "evidence_select_staff_or_volunteer" ON public.evidence;
CREATE POLICY "evidence_select_staff_or_volunteer" ON public.evidence FOR SELECT
  TO authenticated USING (volunteer_id = auth.uid() OR public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "evidence_insert_volunteer" ON public.evidence;
CREATE POLICY "evidence_insert_volunteer" ON public.evidence FOR INSERT
  TO authenticated WITH CHECK (volunteer_id = auth.uid() OR public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "verification_select_staff_or_assigned" ON public.verification_records;
CREATE POLICY "verification_select_staff_or_assigned" ON public.verification_records FOR SELECT
  TO authenticated USING (
    public.current_user_role() IN ('supervisor', 'admin')
    OR EXISTS (SELECT 1 FROM public.task_assignments AS ta WHERE ta.task_id = verification_records.task_id AND ta.volunteer_id = auth.uid())
  );

DROP POLICY IF EXISTS "verification_insert_staff" ON public.verification_records;
CREATE POLICY "verification_insert_staff" ON public.verification_records FOR INSERT
  TO authenticated WITH CHECK (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "feedback_select_owner_or_staff" ON public.feedback;
CREATE POLICY "feedback_select_owner_or_staff" ON public.feedback FOR SELECT
  TO authenticated USING (citizen_id = auth.uid() OR public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "audit_select_staff" ON public.audit_logs;
CREATE POLICY "audit_select_staff" ON public.audit_logs FOR SELECT
  TO authenticated USING (public.current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "settings_update_admin" ON public.system_settings;
CREATE POLICY "settings_update_admin" ON public.system_settings FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "settings_insert_admin" ON public.system_settings;
CREATE POLICY "settings_insert_admin" ON public.system_settings FOR INSERT
  TO authenticated WITH CHECK (public.current_user_role() = 'admin');

-- Clients cannot forge system notifications or audit records.
DROP POLICY IF EXISTS "notif_insert_any" ON public.notifications;
DROP POLICY IF EXISTS "audit_insert_any" ON public.audit_logs;

-- Public signup always creates a citizen profile.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    'citizen'
  );
  RETURN NEW;
END;
$$;

-- Avoid recursive profile lookups in storage role checks.
DROP POLICY IF EXISTS "report_media_staff_delete" ON storage.objects;
CREATE POLICY "report_media_staff_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'report-media' AND public.current_user_role() IN ('supervisor', 'admin'));
