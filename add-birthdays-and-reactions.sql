-- =========================================================
-- KBFB - Bursdager + emoji-reaksjoner på kjøkkenbok-notater
-- Kjør denne én gang i Supabase SQL Editor.
-- Krever at supabase-auth-setup.sql allerede er kjørt (bruker
-- kbfb_is_admin() og kbfb_current_employee_name() derfra).
-- =========================================================

-- ---------------------------------------------------------
-- 1) Bursdag på ansatte
--    Kun dag/måned brukes i appen - året i datoen ignoreres,
--    så det spiller ingen rolle hvilket år som legges inn.
-- ---------------------------------------------------------

ALTER TABLE public.kbfb_employees
  ADD COLUMN IF NOT EXISTS birthday date;

-- ---------------------------------------------------------
-- 2) Reaksjoner på kjøkkenbok-notater (kbfb_notes)
--    Én rad per (notat, person, emoji) - trykker du på samme
--    emoji igjen fjernes den (håndteres i app.js).
--
--    NB: antar kbfb_notes.id er uuid, i tråd med de andre
--    kbfb_-tabellene (kbfb_kind_messages, kbfb_shift_swap_requests
--    osv. bruker alle "id uuid PRIMARY KEY DEFAULT gen_random_uuid()").
--    Hvis kbfb_notes.id faktisk er en annen type hos deg, bytt
--    "uuid" i note_id-linjen under til riktig type.
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.kbfb_note_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.kbfb_notes(id) ON DELETE CASCADE,
  author text NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, author, emoji)
);

ALTER TABLE public.kbfb_note_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kbfb_note_reactions_select_authenticated" ON public.kbfb_note_reactions;
CREATE POLICY "kbfb_note_reactions_select_authenticated" ON public.kbfb_note_reactions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kbfb_note_reactions_insert_own" ON public.kbfb_note_reactions;
CREATE POLICY "kbfb_note_reactions_insert_own" ON public.kbfb_note_reactions
  FOR INSERT TO authenticated
  WITH CHECK (author = public.kbfb_current_employee_name());

DROP POLICY IF EXISTS "kbfb_note_reactions_delete_own_or_admin" ON public.kbfb_note_reactions;
CREATE POLICY "kbfb_note_reactions_delete_own_or_admin" ON public.kbfb_note_reactions
  FOR DELETE TO authenticated
  USING (author = public.kbfb_current_employee_name() OR public.kbfb_is_admin());
