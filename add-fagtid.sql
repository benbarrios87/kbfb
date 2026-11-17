-- Fagtid / assistenttreff: anonym undersøkelse om hvilke temaer de ansatte
-- vil bruke fagtiden på. Svarene lagres UTEN navn, så de er anonyme.
-- Bare ansatte med rollen 'Assistent' kan sende inn svar.
-- Bare admin kan lese og slette dem.

CREATE TABLE IF NOT EXISTS public.kbfb_fagtid_svar (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  temaer        text[]      NOT NULL DEFAULT '{}',   -- valgte temaer (maks 3)
  annet_tema    text,                                -- "Annet: ..."
  situasjon     text,                                -- konkret situasjon de vil ha hjelp til
  laeringsform  text[]      NOT NULL DEFAULT '{}',   -- hvordan de lærer best
  nyttig_mote   text,                                -- hva gjør et møte nyttig
  CONSTRAINT fagtid_maks_tre_temaer CHECK (cardinality(temaer) <= 3),
  CONSTRAINT fagtid_tekst_lengde CHECK (
    coalesce(length(annet_tema), 0)   <= 300  AND
    coalesce(length(situasjon), 0)    <= 3000 AND
    coalesce(length(nyttig_mote), 0)  <= 3000
  )
);

ALTER TABLE public.kbfb_fagtid_svar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fagtid: alle innloggede kan svare" ON public.kbfb_fagtid_svar;
DROP POLICY IF EXISTS "fagtid: assistenter kan svare" ON public.kbfb_fagtid_svar;
CREATE POLICY "fagtid: assistenter kan svare"
  ON public.kbfb_fagtid_svar FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.kbfb_employees e
    WHERE e.user_id = auth.uid()
      AND e.role = 'Assistent'
      AND e.active IS DISTINCT FROM false
  ));

DROP POLICY IF EXISTS "fagtid: admin kan lese" ON public.kbfb_fagtid_svar;
CREATE POLICY "fagtid: admin kan lese"
  ON public.kbfb_fagtid_svar FOR SELECT TO authenticated
  USING (public.kbfb_is_admin());

DROP POLICY IF EXISTS "fagtid: admin kan slette" ON public.kbfb_fagtid_svar;
CREATE POLICY "fagtid: admin kan slette"
  ON public.kbfb_fagtid_svar FOR DELETE TO authenticated
  USING (public.kbfb_is_admin());
