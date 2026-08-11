-- KBFB Personal: lock down the database
-- What this does, in plain terms:
--   1. Adds a "role" column to kbfb_employees so we know who is admin (Benjamin)
--      and who is regular staff.
--   2. Adds a "user_id" column to kbfb_employees so each employee row can be
--      linked to a real login account.
--   3. Removes the old "Allow public ..." rules that let ANYONE (no login
--      needed) read and edit everything.
--   4. Adds new rules: logged-in staff can VIEW everything, but only admin
--      (or the right person) can CHANGE things.
--
-- Run this once, in full, in Supabase Studio -> SQL Editor -> New query.
-- Safe to re-run: every step either checks "if not exists" first or drops
-- before creating, so running it twice won't break anything.

-- =========================================================
-- STEP 1: Add login-related columns to kbfb_employees
-- =========================================================

-- Note: kbfb_employees already has a "role" column with job titles
-- (Vikar, Pedagog, Daglig leder, Assistent, Avdelingsleder, ...) - that is
-- NOT an admin flag, so we leave it alone and add a separate column instead.

ALTER TABLE public.kbfb_employees
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

ALTER TABLE public.kbfb_employees
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- After running this file, you still need to (in the Supabase dashboard):
--   - Create an Auth user for each employee (Authentication -> Users -> Add user)
--   - UPDATE public.kbfb_employees SET user_id = '<their auth uuid>' WHERE name = '<their name>';
--   - UPDATE public.kbfb_employees SET is_admin = true WHERE name = 'Benjamin';
--     (adjust the name/column to match your actual kbfb_employees columns)

-- =========================================================
-- STEP 2: Helper functions used inside the rules below
-- =========================================================

-- True if the currently logged-in user is an admin.
CREATE OR REPLACE FUNCTION public.kbfb_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kbfb_employees
    WHERE user_id = auth.uid() AND is_admin = true
  );
$$;

-- The employee "name" text for whoever is logged in right now.
-- (Tables like kbfb_notes.author and kbfb_absences.name store the
-- employee's name as text, not a uuid, so rules match on this.)
CREATE OR REPLACE FUNCTION public.kbfb_current_employee_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT name FROM public.kbfb_employees WHERE user_id = auth.uid();
$$;

-- =========================================================
-- STEP 2B: kbfb_employees itself
--   RLS was already ON here with no policy letting a logged-in
--   person read their own row - that silently broke login (auth.js
--   looks up your row right after sign-in; zero rows back = signed
--   back out a second later). This is what fixes that.
-- =========================================================

ALTER TABLE public.kbfb_employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kbfb_employees_select_authenticated" ON public.kbfb_employees;
CREATE POLICY "kbfb_employees_select_authenticated" ON public.kbfb_employees
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kbfb_employees_admin_write" ON public.kbfb_employees;
CREATE POLICY "kbfb_employees_admin_write" ON public.kbfb_employees
  FOR UPDATE TO authenticated
  USING (public.kbfb_is_admin())
  WITH CHECK (public.kbfb_is_admin());

-- =========================================================
-- STEP 3: kbfb_events (currently has NO rules at all - wide open)
-- =========================================================

ALTER TABLE public.kbfb_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kbfb_events_select_authenticated" ON public.kbfb_events;
CREATE POLICY "kbfb_events_select_authenticated" ON public.kbfb_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kbfb_events_admin_write" ON public.kbfb_events;
CREATE POLICY "kbfb_events_admin_write" ON public.kbfb_events
  FOR ALL TO authenticated
  USING (public.kbfb_is_admin())
  WITH CHECK (public.kbfb_is_admin());

-- =========================================================
-- STEP 4: kbfb_employee_settings
-- =========================================================

ALTER TABLE public.kbfb_employee_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read employee settings" ON public.kbfb_employee_settings;
DROP POLICY IF EXISTS "Allow public insert employee settings" ON public.kbfb_employee_settings;
DROP POLICY IF EXISTS "Allow public update employee settings" ON public.kbfb_employee_settings;
DROP POLICY IF EXISTS "Allow public delete employee settings" ON public.kbfb_employee_settings;

DROP POLICY IF EXISTS "kbfb_employee_settings_select_authenticated" ON public.kbfb_employee_settings;
CREATE POLICY "kbfb_employee_settings_select_authenticated" ON public.kbfb_employee_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kbfb_employee_settings_admin_write" ON public.kbfb_employee_settings;
CREATE POLICY "kbfb_employee_settings_admin_write" ON public.kbfb_employee_settings
  FOR ALL TO authenticated
  USING (public.kbfb_is_admin())
  WITH CHECK (public.kbfb_is_admin());

-- =========================================================
-- STEP 5: kbfb_shifts
-- =========================================================

ALTER TABLE public.kbfb_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read shifts" ON public.kbfb_shifts;
DROP POLICY IF EXISTS "Allow public insert shifts" ON public.kbfb_shifts;
DROP POLICY IF EXISTS "Allow public update shifts" ON public.kbfb_shifts;
DROP POLICY IF EXISTS "Allow public delete shifts" ON public.kbfb_shifts;

DROP POLICY IF EXISTS "kbfb_shifts_select_authenticated" ON public.kbfb_shifts;
CREATE POLICY "kbfb_shifts_select_authenticated" ON public.kbfb_shifts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kbfb_shifts_admin_write" ON public.kbfb_shifts;
CREATE POLICY "kbfb_shifts_admin_write" ON public.kbfb_shifts
  FOR ALL TO authenticated
  USING (public.kbfb_is_admin())
  WITH CHECK (public.kbfb_is_admin());

-- =========================================================
-- STEP 6: kbfb_notes (Kjøkkenboka)
--   Any logged-in staff can read and post notes.
--   Only the note's own author or admin can delete it.
--   (Assumes a text column "author" - adjust if the real column differs.)
-- =========================================================

ALTER TABLE public.kbfb_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read notes" ON public.kbfb_notes;
DROP POLICY IF EXISTS "Allow public insert notes" ON public.kbfb_notes;
DROP POLICY IF EXISTS "Allow public delete notes" ON public.kbfb_notes;

DROP POLICY IF EXISTS "kbfb_notes_select_authenticated" ON public.kbfb_notes;
CREATE POLICY "kbfb_notes_select_authenticated" ON public.kbfb_notes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kbfb_notes_insert_authenticated" ON public.kbfb_notes;
CREATE POLICY "kbfb_notes_insert_authenticated" ON public.kbfb_notes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "kbfb_notes_delete_own_or_admin" ON public.kbfb_notes;
CREATE POLICY "kbfb_notes_delete_own_or_admin" ON public.kbfb_notes
  FOR DELETE TO authenticated
  USING (author = public.kbfb_current_employee_name() OR public.kbfb_is_admin());

-- =========================================================
-- STEP 7: kbfb_absences (ferie/avspasering)
--   Staff can see and submit their own requests, or admin sees all.
--   Only admin approves/edits/deletes (change to taste - see chat).
--   (kbfb_absences links to a person via its "name" column.)
-- =========================================================

ALTER TABLE public.kbfb_absences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read absences" ON public.kbfb_absences;
DROP POLICY IF EXISTS "Allow public insert absences" ON public.kbfb_absences;
DROP POLICY IF EXISTS "Allow public update absences" ON public.kbfb_absences;
DROP POLICY IF EXISTS "Allow public delete absences" ON public.kbfb_absences;

DROP POLICY IF EXISTS "kbfb_absences_select_own_or_admin" ON public.kbfb_absences;
CREATE POLICY "kbfb_absences_select_own_or_admin" ON public.kbfb_absences
  FOR SELECT TO authenticated
  USING (name = public.kbfb_current_employee_name() OR public.kbfb_is_admin());

DROP POLICY IF EXISTS "kbfb_absences_insert_own" ON public.kbfb_absences;
DROP POLICY IF EXISTS "kbfb_absences_insert_own_or_admin" ON public.kbfb_absences;
CREATE POLICY "kbfb_absences_insert_own_or_admin" ON public.kbfb_absences
  FOR INSERT TO authenticated
  WITH CHECK (name = public.kbfb_current_employee_name() OR public.kbfb_is_admin());

DROP POLICY IF EXISTS "kbfb_absences_admin_update_delete" ON public.kbfb_absences;
CREATE POLICY "kbfb_absences_admin_update_delete" ON public.kbfb_absences
  FOR UPDATE TO authenticated
  USING (public.kbfb_is_admin())
  WITH CHECK (public.kbfb_is_admin());

DROP POLICY IF EXISTS "kbfb_absences_admin_delete" ON public.kbfb_absences;
CREATE POLICY "kbfb_absences_admin_delete" ON public.kbfb_absences
  FOR DELETE TO authenticated
  USING (public.kbfb_is_admin());

-- =========================================================
-- STEP 8: kbfb_subs
-- =========================================================

ALTER TABLE public.kbfb_subs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read subs" ON public.kbfb_subs;
DROP POLICY IF EXISTS "Allow public insert subs" ON public.kbfb_subs;

DROP POLICY IF EXISTS "kbfb_subs_select_authenticated" ON public.kbfb_subs;
CREATE POLICY "kbfb_subs_select_authenticated" ON public.kbfb_subs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kbfb_subs_admin_write" ON public.kbfb_subs;
CREATE POLICY "kbfb_subs_admin_write" ON public.kbfb_subs
  FOR ALL TO authenticated
  USING (public.kbfb_is_admin())
  WITH CHECK (public.kbfb_is_admin());

-- =========================================================
-- STEP 9: kbfb_sub_hours
-- =========================================================

ALTER TABLE public.kbfb_sub_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read sub hours" ON public.kbfb_sub_hours;
DROP POLICY IF EXISTS "Allow public insert sub hours" ON public.kbfb_sub_hours;
DROP POLICY IF EXISTS "Allow public delete sub hours" ON public.kbfb_sub_hours;

DROP POLICY IF EXISTS "kbfb_sub_hours_select_authenticated" ON public.kbfb_sub_hours;
CREATE POLICY "kbfb_sub_hours_select_authenticated" ON public.kbfb_sub_hours
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kbfb_sub_hours_admin_write" ON public.kbfb_sub_hours;
DROP POLICY IF EXISTS "kbfb_sub_hours_admin_update" ON public.kbfb_sub_hours;
CREATE POLICY "kbfb_sub_hours_admin_update" ON public.kbfb_sub_hours
  FOR UPDATE TO authenticated
  USING (public.kbfb_is_admin())
  WITH CHECK (public.kbfb_is_admin());

DROP POLICY IF EXISTS "kbfb_sub_hours_admin_delete" ON public.kbfb_sub_hours;
CREATE POLICY "kbfb_sub_hours_admin_delete" ON public.kbfb_sub_hours
  FOR DELETE TO authenticated
  USING (public.kbfb_is_admin());

-- Substitutes with their own login can log their own hours too, not just admin
DROP POLICY IF EXISTS "kbfb_sub_hours_insert_own_or_admin" ON public.kbfb_sub_hours;
CREATE POLICY "kbfb_sub_hours_insert_own_or_admin" ON public.kbfb_sub_hours
  FOR INSERT TO authenticated
  WITH CHECK (name = public.kbfb_current_employee_name() OR public.kbfb_is_admin());

-- =========================================================
-- Done. After running this, nobody who isn't logged in can read or
-- write anything anymore - including your own app, until login.html
-- and auth.js are wired up. That's expected and is the next step.
-- =========================================================
