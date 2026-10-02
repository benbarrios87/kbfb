-- Overtid til lønn: husk hva som er ført i lønnssystemet.
-- Kjør én gang i Supabase -> SQL Editor. Trygt å kjøre flere ganger.
--
-- payroll_done_on = datoen admin trykket "Marker som ført i lønn".
-- Tom = ikke ført ennå -> vises i "Ikke ført i lønn" på Admin, uansett
-- hvilken dato overtiden gjelder (så et augustmøte som registreres i
-- oktober ikke blir glemt).
--
-- RLS: bare admin kan endre fraværsføringer (kbfb_absences_admin_update_
-- delete), så bare admin kan markere noe som ført.

ALTER TABLE public.kbfb_absences
  ADD COLUMN IF NOT EXISTS payroll_done_on date;

-- Siste lønnskjøring = siste dato noe ble markert "ført i lønn". Gir bare
-- ut én dato (ingen føringer), så alle innloggede kan spørre - appen
-- bruker den til å varsle styrer når noen registrerer noe som skjedde
-- FØR siste lønnskjøring (og derfor ikke kom med).
CREATE OR REPLACE FUNCTION public.kbfb_last_payroll_run()
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT max(payroll_done_on) FROM public.kbfb_absences
$$;

GRANT EXECUTE ON FUNCTION public.kbfb_last_payroll_run() TO authenticated;
