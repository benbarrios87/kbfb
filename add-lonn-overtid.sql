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
