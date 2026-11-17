-- =========================================================
-- FAGTID / ASSISTENTTREFF
-- Kan kjøres flere ganger uten at noe går i stykker.
--
-- 1. kbfb_fagtid_svar          anonym undersøkelse (bare assistenter svarer)
-- 2. kbfb_fagtid_innstillinger  av/på-bryter for undersøkelsen
-- 3. kbfb_fagtid_treff          løypa: hva vi gjorde, neste gang, lekse
-- 4. kbfb_fagtid_highlights     korte sitater fra assistentene per treff
-- =========================================================

-- Hjelper: er innlogget bruker en aktiv assistent?
CREATE OR REPLACE FUNCTION public.kbfb_is_assistant()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kbfb_employees
    WHERE user_id = auth.uid()
      AND role = 'Assistent'
      AND active IS DISTINCT FROM false
  );
$$;

-- ---------------------------------------------------------
-- 1. Undersøkelsen. Lagres UTEN navn.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kbfb_fagtid_svar (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  temaer        text[]      NOT NULL DEFAULT '{}',
  annet_tema    text,
  situasjon     text,
  laeringsform  text[]      NOT NULL DEFAULT '{}',
  nyttig_mote   text
);
ALTER TABLE public.kbfb_fagtid_svar ADD COLUMN IF NOT EXISTS krevende   text;  -- mest krevende i hverdagen nå
ALTER TABLE public.kbfb_fagtid_svar ADD COLUMN IF NOT EXISTS traff_godt text;  -- en gang du traff et barn godt
ALTER TABLE public.kbfb_fagtid_svar DROP COLUMN IF EXISTS class_tanker;
-- nyttig_mote = "Hva skal til for at du tar med deg noe ut på avdelingen?"

ALTER TABLE public.kbfb_fagtid_svar DROP CONSTRAINT IF EXISTS fagtid_maks_tre_temaer;
ALTER TABLE public.kbfb_fagtid_svar DROP CONSTRAINT IF EXISTS fagtid_tekst_lengde;
ALTER TABLE public.kbfb_fagtid_svar ADD CONSTRAINT fagtid_maks_tre_temaer CHECK (cardinality(temaer) <= 3);
ALTER TABLE public.kbfb_fagtid_svar ADD CONSTRAINT fagtid_tekst_lengde CHECK (
  coalesce(length(annet_tema), 0)  <= 300  AND
  coalesce(length(situasjon), 0)   <= 3000 AND
  coalesce(length(nyttig_mote), 0) <= 3000 AND
  coalesce(length(krevende), 0)    <= 3000 AND
  coalesce(length(traff_godt), 0)  <= 3000
);

ALTER TABLE public.kbfb_fagtid_svar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fagtid: alle innloggede kan svare" ON public.kbfb_fagtid_svar;
DROP POLICY IF EXISTS "fagtid: assistenter kan svare" ON public.kbfb_fagtid_svar;
CREATE POLICY "fagtid: assistenter kan svare"
  ON public.kbfb_fagtid_svar FOR INSERT TO authenticated
  WITH CHECK (public.kbfb_is_assistant());

DROP POLICY IF EXISTS "fagtid: admin kan lese" ON public.kbfb_fagtid_svar;
CREATE POLICY "fagtid: admin kan lese"
  ON public.kbfb_fagtid_svar FOR SELECT TO authenticated
  USING (public.kbfb_is_admin());

DROP POLICY IF EXISTS "fagtid: admin kan slette" ON public.kbfb_fagtid_svar;
CREATE POLICY "fagtid: admin kan slette"
  ON public.kbfb_fagtid_svar FOR DELETE TO authenticated
  USING (public.kbfb_is_admin());

-- ---------------------------------------------------------
-- 2. Av/på-bryter for undersøkelsen (én rad, id = 1)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kbfb_fagtid_innstillinger (
  id                 int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  undersokelse_aapen boolean NOT NULL DEFAULT true
);
INSERT INTO public.kbfb_fagtid_innstillinger (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.kbfb_fagtid_innstillinger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fagtid innst: alle kan lese" ON public.kbfb_fagtid_innstillinger;
CREATE POLICY "fagtid innst: alle kan lese"
  ON public.kbfb_fagtid_innstillinger FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "fagtid innst: admin kan endre" ON public.kbfb_fagtid_innstillinger;
CREATE POLICY "fagtid innst: admin kan endre"
  ON public.kbfb_fagtid_innstillinger FOR UPDATE TO authenticated
  USING (public.kbfb_is_admin())
  WITH CHECK (public.kbfb_is_admin());

-- ---------------------------------------------------------
-- 3. Treff i løypa. Alle ansatte kan lese, bare admin skriver.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kbfb_fagtid_treff (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  dato         date NOT NULL,
  avdeling     text NOT NULL DEFAULT 'Felles'
               CHECK (avdeling IN ('Felles', 'Sommerfuglen', 'Regnbuen')),
  tema         text NOT NULL CHECK (length(tema) <= 200),
  class_fokus  text CHECK (length(class_fokus) <= 200),
  innhold      text CHECK (length(innhold) <= 5000),     -- dette jobbet vi med
  neste_gang   text CHECK (length(neste_gang) <= 3000),
  lekse        text CHECK (length(lekse) <= 3000)
);

ALTER TABLE public.kbfb_fagtid_treff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fagtid treff: alle kan lese" ON public.kbfb_fagtid_treff;
CREATE POLICY "fagtid treff: alle kan lese"
  ON public.kbfb_fagtid_treff FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "fagtid treff: admin skriver" ON public.kbfb_fagtid_treff;
CREATE POLICY "fagtid treff: admin skriver"
  ON public.kbfb_fagtid_treff FOR ALL TO authenticated
  USING (public.kbfb_is_admin())
  WITH CHECK (public.kbfb_is_admin());

-- ---------------------------------------------------------
-- 4. Highlights: korte sitater fra assistentene, med navn.
--    Alle kan lese. Assistenter (og admin) kan skrive i eget navn.
--    Man kan slette sitt eget, admin kan slette alle.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kbfb_fagtid_highlights (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  treff_id    uuid NOT NULL REFERENCES public.kbfb_fagtid_treff(id) ON DELETE CASCADE,
  author      text NOT NULL,
  tekst       text NOT NULL CHECK (length(tekst) BETWEEN 1 AND 300)
);
CREATE INDEX IF NOT EXISTS kbfb_fagtid_highlights_treff_idx ON public.kbfb_fagtid_highlights (treff_id);

ALTER TABLE public.kbfb_fagtid_highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fagtid hl: alle kan lese" ON public.kbfb_fagtid_highlights;
CREATE POLICY "fagtid hl: alle kan lese"
  ON public.kbfb_fagtid_highlights FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "fagtid hl: assistenter skriver" ON public.kbfb_fagtid_highlights;
CREATE POLICY "fagtid hl: assistenter skriver"
  ON public.kbfb_fagtid_highlights FOR INSERT TO authenticated
  WITH CHECK (
    author = public.kbfb_current_employee_name()
    AND (public.kbfb_is_assistant() OR public.kbfb_is_admin())
  );

DROP POLICY IF EXISTS "fagtid hl: slett eget" ON public.kbfb_fagtid_highlights;
CREATE POLICY "fagtid hl: slett eget"
  ON public.kbfb_fagtid_highlights FOR DELETE TO authenticated
  USING (author = public.kbfb_current_employee_name() OR public.kbfb_is_admin());
