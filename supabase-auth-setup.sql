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

-- Lets admin add new employees/substitutes from the Admin page instead of SQL
DROP POLICY IF EXISTS "kbfb_employees_admin_insert" ON public.kbfb_employees;
CREATE POLICY "kbfb_employees_admin_insert" ON public.kbfb_employees
  FOR INSERT TO authenticated
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
-- STEP 10: kbfb_feedback (new table - "Forbedringsbehov" box)
--   Anyone logged in can send in a suggestion from the Hjem page.
--   Only admin can read/clear them, on the Admin page.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.kbfb_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kbfb_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kbfb_feedback_select_admin" ON public.kbfb_feedback;
CREATE POLICY "kbfb_feedback_select_admin" ON public.kbfb_feedback
  FOR SELECT TO authenticated
  USING (public.kbfb_is_admin());

DROP POLICY IF EXISTS "kbfb_feedback_insert_own" ON public.kbfb_feedback;
CREATE POLICY "kbfb_feedback_insert_own" ON public.kbfb_feedback
  FOR INSERT TO authenticated
  WITH CHECK (name = public.kbfb_current_employee_name());

DROP POLICY IF EXISTS "kbfb_feedback_admin_delete" ON public.kbfb_feedback;
CREATE POLICY "kbfb_feedback_admin_delete" ON public.kbfb_feedback
  FOR DELETE TO authenticated
  USING (public.kbfb_is_admin());

-- =========================================================
-- STEP 11: kbfb_shift_swap_requests (Vaktbytte - phase 1, no push yet)
--   Anyone except vikarer can request to swap one of their shifts with
--   a colleague's. The colleague accepts/declines; accepting swaps the
--   two shifts automatically via a SECURITY DEFINER function (so a
--   regular employee, not just admin/avdelingsleder, can accept without
--   needing general shift-editing rights).
-- =========================================================

CREATE TABLE IF NOT EXISTS public.kbfb_shift_swap_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_employee text NOT NULL,
  to_employee text NOT NULL,
  from_department text NOT NULL,
  to_department text NOT NULL,
  week_start date NOT NULL,
  day_index int NOT NULL,
  from_shift_value text,
  to_shift_value text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  decline_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

ALTER TABLE public.kbfb_shift_swap_requests ENABLE ROW LEVEL SECURITY;

-- Helper: current logged-in person's role text (needed to exclude vikarer)
CREATE OR REPLACE FUNCTION public.kbfb_current_employee_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.kbfb_employees WHERE user_id = auth.uid();
$$;

DROP POLICY IF EXISTS "kbfb_swap_select_authenticated" ON public.kbfb_shift_swap_requests;
CREATE POLICY "kbfb_swap_select_authenticated" ON public.kbfb_shift_swap_requests
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kbfb_swap_insert_own_not_vikar" ON public.kbfb_shift_swap_requests;
CREATE POLICY "kbfb_swap_insert_own_not_vikar" ON public.kbfb_shift_swap_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    from_employee = public.kbfb_current_employee_name()
    AND COALESCE(public.kbfb_current_employee_role(), '') <> 'Vikar'
  );

DROP POLICY IF EXISTS "kbfb_swap_update_recipient_or_admin" ON public.kbfb_shift_swap_requests;
CREATE POLICY "kbfb_swap_update_recipient_or_admin" ON public.kbfb_shift_swap_requests
  FOR UPDATE TO authenticated
  USING (to_employee = public.kbfb_current_employee_name() OR public.kbfb_is_admin())
  WITH CHECK (to_employee = public.kbfb_current_employee_name() OR public.kbfb_is_admin());

-- Performs the actual swap. Runs as the function owner (bypassing RLS
-- internally) but checks the caller is the request's recipient or admin
-- first, so this can't be abused to swap arbitrary shifts.
CREATE OR REPLACE FUNCTION public.kbfb_accept_shift_swap(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req RECORD;
  caller_name text;
  is_caller_admin boolean;
  from_value text;
  to_value text;
BEGIN
  SELECT * INTO req FROM public.kbfb_shift_swap_requests WHERE id = request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Forespørselen finnes ikke eller er allerede behandlet.';
  END IF;

  caller_name := public.kbfb_current_employee_name();
  is_caller_admin := public.kbfb_is_admin();

  IF caller_name IS DISTINCT FROM req.to_employee AND NOT is_caller_admin THEN
    RAISE EXCEPTION 'Bare mottakeren kan godta denne forespørselen.';
  END IF;

  SELECT shift_value INTO from_value FROM public.kbfb_shifts
    WHERE week_start = req.week_start AND department = req.from_department
      AND employee = req.from_employee AND day_index = req.day_index;

  SELECT shift_value INTO to_value FROM public.kbfb_shifts
    WHERE week_start = req.week_start AND department = req.to_department
      AND employee = req.to_employee AND day_index = req.day_index;

  -- Update or insert each side with the other's current shift value
  IF EXISTS (SELECT 1 FROM public.kbfb_shifts WHERE week_start = req.week_start AND department = req.from_department AND employee = req.from_employee AND day_index = req.day_index) THEN
    UPDATE public.kbfb_shifts SET shift_value = COALESCE(to_value, '')
      WHERE week_start = req.week_start AND department = req.from_department AND employee = req.from_employee AND day_index = req.day_index;
  ELSE
    INSERT INTO public.kbfb_shifts (week_start, department, employee, day_index, shift_value)
      VALUES (req.week_start, req.from_department, req.from_employee, req.day_index, COALESCE(to_value, ''));
  END IF;

  IF EXISTS (SELECT 1 FROM public.kbfb_shifts WHERE week_start = req.week_start AND department = req.to_department AND employee = req.to_employee AND day_index = req.day_index) THEN
    UPDATE public.kbfb_shifts SET shift_value = COALESCE(from_value, '')
      WHERE week_start = req.week_start AND department = req.to_department AND employee = req.to_employee AND day_index = req.day_index;
  ELSE
    INSERT INTO public.kbfb_shifts (week_start, department, employee, day_index, shift_value)
      VALUES (req.week_start, req.to_department, req.to_employee, req.day_index, COALESCE(from_value, ''));
  END IF;

  UPDATE public.kbfb_shift_swap_requests
    SET status = 'accepted', responded_at = now()
    WHERE id = request_id;
END;
$$;

-- Declines a request, with an optional reason. Same authorization check
-- as accept, but only flips status - no shift data changes.
CREATE OR REPLACE FUNCTION public.kbfb_decline_shift_swap(request_id uuid, reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req RECORD;
  caller_name text;
  is_caller_admin boolean;
BEGIN
  SELECT * INTO req FROM public.kbfb_shift_swap_requests WHERE id = request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Forespørselen finnes ikke eller er allerede behandlet.';
  END IF;

  caller_name := public.kbfb_current_employee_name();
  is_caller_admin := public.kbfb_is_admin();

  IF caller_name IS DISTINCT FROM req.to_employee AND NOT is_caller_admin THEN
    RAISE EXCEPTION 'Bare mottakeren kan avslå denne forespørselen.';
  END IF;

  UPDATE public.kbfb_shift_swap_requests
    SET status = 'declined', decline_reason = reason, responded_at = now()
    WHERE id = request_id;
END;
$$;

-- Avdelingsledere can now edit the vaktplan too, not just admin - the
-- database needs to match the client-side permission added this session.
DROP POLICY IF EXISTS "kbfb_shifts_admin_write" ON public.kbfb_shifts;
CREATE POLICY "kbfb_shifts_admin_write" ON public.kbfb_shifts
  FOR ALL TO authenticated
  USING (public.kbfb_is_admin() OR public.kbfb_current_employee_role() = 'Avdelingsleder')
  WITH CHECK (public.kbfb_is_admin() OR public.kbfb_current_employee_role() = 'Avdelingsleder');

-- =========================================================
-- Done. After running this, nobody who isn't logged in can read or
-- write anything anymore - including your own app, until login.html
-- and auth.js are wired up. That's expected and is the next step.
-- =========================================================

-- =========================================================
-- STEP 12: kbfb_supplies (Bestillinger - "things we need" list)
--   Any logged-in employee can report something is needed. Everyone can
--   see the list (so people don't report duplicates). Only admin can
--   check something off as ordered or remove it.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.kbfb_supplies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item text NOT NULL,
  requested_by text NOT NULL,
  ordered boolean NOT NULL DEFAULT false,
  ordered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kbfb_supplies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kbfb_supplies_select_all" ON public.kbfb_supplies;
CREATE POLICY "kbfb_supplies_select_all" ON public.kbfb_supplies
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "kbfb_supplies_insert_own" ON public.kbfb_supplies;
CREATE POLICY "kbfb_supplies_insert_own" ON public.kbfb_supplies
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = public.kbfb_current_employee_name());

DROP POLICY IF EXISTS "kbfb_supplies_admin_update" ON public.kbfb_supplies;
CREATE POLICY "kbfb_supplies_admin_update" ON public.kbfb_supplies
  FOR UPDATE TO authenticated
  USING (public.kbfb_is_admin())
  WITH CHECK (public.kbfb_is_admin());

DROP POLICY IF EXISTS "kbfb_supplies_admin_delete" ON public.kbfb_supplies;
CREATE POLICY "kbfb_supplies_admin_delete" ON public.kbfb_supplies
  FOR DELETE TO authenticated
  USING (public.kbfb_is_admin());

-- Seed a few known-needed items
INSERT INTO public.kbfb_supplies (item, requested_by) VALUES
  ('Permer', 'Benjamin'),
  ('Plaster', 'Benjamin'),
  ('Plastlommer', 'Benjamin'),
  ('Tørkepapir', 'Benjamin'),
  ('Engangshansker', 'Benjamin');

-- =========================================================
-- STEP 13: kbfb_supplies - priority + admin response
--   Requester picks "haster" vs "hadde vært fint å ha" when reporting.
--   Admin can now decline a request too (not just mark it ordered), and
--   either action can carry a short optional note back to the requester -
--   same idea as the shift-swap decline reason.
-- =========================================================

ALTER TABLE public.kbfb_supplies
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'nice_to_have'
    CHECK (priority IN ('haster', 'nice_to_have'));

ALTER TABLE public.kbfb_supplies
  ADD COLUMN IF NOT EXISTS declined boolean NOT NULL DEFAULT false;

ALTER TABLE public.kbfb_supplies
  ADD COLUMN IF NOT EXISTS declined_at timestamptz;

ALTER TABLE public.kbfb_supplies
  ADD COLUMN IF NOT EXISTS admin_note text;

-- =========================================================
-- STEP 14: Codebase audit fixes
--   kbfb_swap_select_authenticated let ANY logged-in employee read the
--   entire kbfb_shift_swap_requests table directly (not just their own
--   requests) - the app only ever queried it pre-filtered, but nothing
--   in the database actually enforced that. Narrowed to: your own sent
--   or received requests, or admin.
-- =========================================================

DROP POLICY IF EXISTS "kbfb_swap_select_authenticated" ON public.kbfb_shift_swap_requests;
DROP POLICY IF EXISTS "kbfb_swap_select_own" ON public.kbfb_shift_swap_requests;
CREATE POLICY "kbfb_swap_select_own" ON public.kbfb_shift_swap_requests
  FOR SELECT TO authenticated
  USING (
    from_employee = public.kbfb_current_employee_name()
    OR to_employee = public.kbfb_current_employee_name()
    OR public.kbfb_is_admin()
  );

-- kbfb_update_own_avatar() and the "avatars" storage bucket are used by
-- app.js (profile picture upload) but were set up directly in Supabase
-- Studio earlier and never logged here - re-running this is safe/idempotent
-- either way, so it's included now for the audit trail.

ALTER TABLE public.kbfb_employees ADD COLUMN IF NOT EXISTS avatar_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_authenticated_upload" ON storage.objects;
CREATE POLICY "avatars_authenticated_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_authenticated_update" ON storage.objects;
CREATE POLICY "avatars_authenticated_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

CREATE OR REPLACE FUNCTION public.kbfb_update_own_avatar(new_avatar_url text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.kbfb_employees
  SET avatar_url = new_avatar_url
  WHERE user_id = auth.uid();
$$;

-- =========================================================
-- STEP 15: kbfb_employee_settings.tjenestefri_days
--   Same idea as vacation_days (25 default) but for "tjenestefri" - a
--   10-day-per-year quota, admin-adjustable per employee. Shown as
--   "used/quota" on the yearly summary card, same as feriedager already
--   was. (vacation_days itself isn't in this file - it was added directly
--   in Supabase Studio earlier and never logged here.)
-- =========================================================

ALTER TABLE public.kbfb_employee_settings
  ADD COLUMN IF NOT EXISTS tjenestefri_days int NOT NULL DEFAULT 10;

-- =========================================================
-- STEP 16: Avdelingsleder can see their own department's absence
--   overview (Mari sees Regnbuen, Imelda sees Sommerfuglen), not just
--   their own records. Still read-only - approving/declining requests
--   and editing quotas both stay admin-only.
-- =========================================================

CREATE OR REPLACE FUNCTION public.kbfb_current_employee_department()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department FROM public.kbfb_employees WHERE user_id = auth.uid();
$$;

DROP POLICY IF EXISTS "kbfb_absences_select_own_or_admin" ON public.kbfb_absences;
DROP POLICY IF EXISTS "kbfb_absences_select_own_admin_or_department" ON public.kbfb_absences;
CREATE POLICY "kbfb_absences_select_own_admin_or_department" ON public.kbfb_absences
  FOR SELECT TO authenticated
  USING (
    name = public.kbfb_current_employee_name()
    OR public.kbfb_is_admin()
    OR (
      public.kbfb_current_employee_role() = 'Avdelingsleder'
      -- Egenmelding/sykemelding/omsorgsdager are health-adjacent and stay
      -- between admin and the employee themselves, even for their own
      -- avdelingsleder - everything else in the department is fine to share.
      AND type NOT IN ('Egenmelding', 'Sykemelding', 'Omsorgsdager')
      AND name IN (
        SELECT e.name FROM public.kbfb_employees e
        WHERE e.department = public.kbfb_current_employee_department()
      )
    )
  );

-- =========================================================
-- STEP 17: kbfb_kind_messages ("Hyggelig beskjed" dashboard widget)
--   A small shared board for friendly notes to colleagues. Anyone can
--   post, everyone can read, and you can remove your own (or admin can
--   remove any).
-- =========================================================

CREATE TABLE IF NOT EXISTS public.kbfb_kind_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kbfb_kind_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kbfb_kind_messages_select_all" ON public.kbfb_kind_messages;
CREATE POLICY "kbfb_kind_messages_select_all" ON public.kbfb_kind_messages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kbfb_kind_messages_insert_own" ON public.kbfb_kind_messages;
CREATE POLICY "kbfb_kind_messages_insert_own" ON public.kbfb_kind_messages
  FOR INSERT TO authenticated
  WITH CHECK (author = public.kbfb_current_employee_name());

DROP POLICY IF EXISTS "kbfb_kind_messages_delete_own_or_admin" ON public.kbfb_kind_messages;
CREATE POLICY "kbfb_kind_messages_delete_own_or_admin" ON public.kbfb_kind_messages
  FOR DELETE TO authenticated
  USING (author = public.kbfb_current_employee_name() OR public.kbfb_is_admin());

-- =========================================================
-- STEP 19: kbfb_employees DELETE policy
--   The Edge Function already bypasses RLS via the service-role key
--   when it deletes an employee row, so this isn't strictly required
--   for the "Slett" button to work - added anyway for defense in depth,
--   consistent with every other table already having a real policy for
--   each operation instead of relying only on the missing ones denying
--   by default.
-- =========================================================

DROP POLICY IF EXISTS "kbfb_employees_admin_delete" ON public.kbfb_employees;
CREATE POLICY "kbfb_employees_admin_delete" ON public.kbfb_employees
  FOR DELETE TO authenticated
  USING (public.kbfb_is_admin());

-- =========================================================
-- STEP 20: No self-approval on kbfb_absences
--   UPDATE on this table is only ever used for Godkjenn/Avslå, so
--   tightening it to exclude your own row closes the loophole where an
--   admin could approve/reject their own Ferie/Tjenestefri/etc request -
--   not just hidden client-side, enforced here too.
-- =========================================================

DROP POLICY IF EXISTS "kbfb_absences_admin_update_delete" ON public.kbfb_absences;
CREATE POLICY "kbfb_absences_admin_update_delete" ON public.kbfb_absences
  FOR UPDATE TO authenticated
  USING (public.kbfb_is_admin() AND name <> public.kbfb_current_employee_name())
  WITH CHECK (public.kbfb_is_admin() AND name <> public.kbfb_current_employee_name());

-- =========================================================
-- STEP 21: kbfb_employees.color (personal row color on vaktplan)
--   Same idea as the existing vikar color picker (kbfb_subs.color) -
--   admin sets one per employee, and the whole row on the schedule grid
--   uses it instead of the shift type driving the color.
-- =========================================================

ALTER TABLE public.kbfb_employees ADD COLUMN IF NOT EXISTS color text;

-- =========================================================
-- STEP 22: kbfb_avvik (avvikshåndtering - deviation/incident log)
--   In-house replacement for the paid PBL Mentor deviation module.
--   Admin-only end to end for now (insert/select/update/delete) - not
--   rolled out to staff yet, so RLS is locked to admin the same way the
--   UI/nav is (data-admin-only + enforceAdminPageAccess). Loosen the
--   INSERT policy later if/when staff should be able to report their own.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.kbfb_avvik (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by text NOT NULL,
  department text,
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'Lav',
  date_occurred date NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'Meldt',
  tiltak text,
  responsible text,
  closed_by text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kbfb_avvik ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kbfb_avvik_admin_all" ON public.kbfb_avvik;
CREATE POLICY "kbfb_avvik_admin_all" ON public.kbfb_avvik
  FOR ALL TO authenticated
  USING (public.kbfb_is_admin())
  WITH CHECK (public.kbfb_is_admin());

-- =========================================================
-- STEP 23: kbfb_shared_photos + "shared-photos" storage bucket
--   Dashboard "Del et bilde" widget - staff share a photo + optional
--   caption from their day, feed shows only the latest 3. Same
--   upload-then-getPublicUrl pattern as the avatars bucket.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.kbfb_shared_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author text NOT NULL,
  photo_url text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kbfb_shared_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kbfb_shared_photos_select_all" ON public.kbfb_shared_photos;
CREATE POLICY "kbfb_shared_photos_select_all" ON public.kbfb_shared_photos
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "kbfb_shared_photos_insert_own" ON public.kbfb_shared_photos;
CREATE POLICY "kbfb_shared_photos_insert_own" ON public.kbfb_shared_photos
  FOR INSERT TO authenticated
  WITH CHECK (author = public.kbfb_current_employee_name());

DROP POLICY IF EXISTS "kbfb_shared_photos_delete" ON public.kbfb_shared_photos;
CREATE POLICY "kbfb_shared_photos_delete" ON public.kbfb_shared_photos
  FOR DELETE TO authenticated
  USING (author = public.kbfb_current_employee_name() OR public.kbfb_is_admin());

INSERT INTO storage.buckets (id, name, public)
VALUES ('shared-photos', 'shared-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "shared_photos_authenticated_upload" ON storage.objects;
CREATE POLICY "shared_photos_authenticated_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shared-photos');

DROP POLICY IF EXISTS "shared_photos_delete" ON storage.objects;
CREATE POLICY "shared_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'shared-photos');

DROP POLICY IF EXISTS "shared_photos_public_read" ON storage.objects;
CREATE POLICY "shared_photos_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'shared-photos');

-- =========================================================
-- STEP 24: kbfb_photo_reactions (emoji reactions on "Del et bilde" photos)
--   Same idea/emoji set as kbfb_note_reactions (see
--   add-birthdays-and-reactions.sql) but a separate table since it
--   references kbfb_shared_photos, not kbfb_notes.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.kbfb_photo_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.kbfb_shared_photos(id) ON DELETE CASCADE,
  author text NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (photo_id, author, emoji)
);

ALTER TABLE public.kbfb_photo_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kbfb_photo_reactions_select_all" ON public.kbfb_photo_reactions;
CREATE POLICY "kbfb_photo_reactions_select_all" ON public.kbfb_photo_reactions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kbfb_photo_reactions_insert_own" ON public.kbfb_photo_reactions;
CREATE POLICY "kbfb_photo_reactions_insert_own" ON public.kbfb_photo_reactions
  FOR INSERT TO authenticated
  WITH CHECK (author = public.kbfb_current_employee_name());

DROP POLICY IF EXISTS "kbfb_photo_reactions_delete_own" ON public.kbfb_photo_reactions;
CREATE POLICY "kbfb_photo_reactions_delete_own" ON public.kbfb_photo_reactions
  FOR DELETE TO authenticated
  USING (author = public.kbfb_current_employee_name());

-- =========================================================
-- STEP 25: one vikarvakt per vikar per dag (kbfb_sub_hours)
--   app.js already blocks this client-side (name+date match), but a
--   vikar managed to double-book anyway - this is the real backstop.
--   NOTE: this will FAIL if a duplicate (same name+date) already
--   exists in the table - delete the duplicate row in vikarer.html's
--   Vikarlogg first (admin "Slett"), then run this.
-- =========================================================

ALTER TABLE public.kbfb_sub_hours DROP CONSTRAINT IF EXISTS kbfb_sub_hours_name_date_unique;
ALTER TABLE public.kbfb_sub_hours ADD CONSTRAINT kbfb_sub_hours_name_date_unique UNIQUE (name, date);
