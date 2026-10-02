-- Omsorgsdager-kvote per ansatt (per kalenderår), satt på Admin -> Alle ansatte.
-- 0 / tom = ingen barn i omsorgsdag-alder, 10 = 1-2 barn, 15 = 3+ barn,
-- 20 / 30 = dobbel kvote (f.eks. alene-omsorg).
-- Kjør én gang i Supabase -> SQL Editor. Trygt å kjøre flere ganger.
-- RLS på kbfb_employee_settings (alle innloggede kan lese, kun admin kan
-- skrive) gjelder også den nye kolonnen - ingen policy-endring trengs.

ALTER TABLE public.kbfb_employee_settings
  ADD COLUMN IF NOT EXISTS omsorgsdager_days integer;
