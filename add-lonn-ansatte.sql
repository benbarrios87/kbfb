-- Lønn per ansatt (Personalliste på Admin): grunnlønn, tillegg,
-- og stillingsprosent.
-- Kjør én gang i Supabase -> SQL Editor. Trygt å kjøre flere ganger.
--
-- Egen tabell (ikke kolonner på kbfb_employees), fordi alle innloggede
-- kan lese kbfb_employees. Her kan BARE admin lese og skrive.
-- Koblet på ansatt-id (ikke navn), så "Bytt navn" ikke trenger å
-- oppdatere denne tabellen, og raden slettes sammen med den ansatte.

CREATE TABLE IF NOT EXISTS public.kbfb_salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES public.kbfb_employees(id) ON DELETE CASCADE,
  base_salary integer,          -- grunnlønn pr. år i 100 % stilling
  allowance integer,            -- tillegg pr. år
  allowance_note text,          -- f.eks. "midlertidig"
  position_pct numeric,         -- stillingsprosent, f.eks. 70
  effective_from date,          -- lønnen gjelder fra
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kbfb_salaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kbfb_salaries_admin_all" ON public.kbfb_salaries;
CREATE POLICY "kbfb_salaries_admin_all" ON public.kbfb_salaries
  FOR ALL TO authenticated
  USING (public.kbfb_is_admin())
  WITH CHECK (public.kbfb_is_admin());
