-- =========================================================
-- Vaktplan <-> Ferie og fravær: alltid i samsvar
-- Kjør én gang i Supabase -> SQL Editor. Trygt å kjøre flere ganger.
--
-- Hva den gjør:
--  * Fravær -> vaktplan: når en fraværsføring lagres, endres, slettes,
--    godkjennes eller avslås, oppdateres vaktplanen automatisk:
--      Egenmelding/Sykemelding -> SYK, Omsorgsdager -> SB  (med en gang)
--      Ferie -> F, Ønsker å avspasere -> AVS, Tjenestefri -> Tjenestefri,
--      Permisjon/Velferd -> PERM                            (når Godkjent)
--    Ved sletting/endring tømmes bare celler som fortsatt har den koden,
--    og som ikke dekkes av en annen føring.
--  * Vaktplan -> fravær: settes SYK/SB i en celle, lages (eller forlenges)
--    en egenmelding/omsorgsdag. Fjernes SYK/SB, tas dagen ut av føringen
--    (deles i to hvis dagen lå midt i en periode).
--  * Virker uansett hvem som gjør endringen - også vanlige ansatte som
--    melder seg syke (de har ikke selv lov til å skrive i vaktplanen).
-- =========================================================

-- Fraværstype -> kode i vaktplanen
CREATE OR REPLACE FUNCTION public.kbfb_absence_shift_code(absence_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE absence_type
    WHEN 'Ferie' THEN 'F'
    WHEN 'Tjenestefri' THEN 'Tjenestefri'
    WHEN 'Permisjon med lønn' THEN 'PERM'
    WHEN 'Permisjon uten lønn' THEN 'PERM'
    WHEN 'Velferdspermisjon' THEN 'PERM'
    WHEN 'Ønsker å avspasere' THEN 'AVS'
    WHEN 'Egenmelding' THEN 'SYK'
    WHEN 'Sykemelding' THEN 'SYK'
    WHEN 'Omsorgsdager' THEN 'SB'
    ELSE NULL
  END
$$;

-- Skal føringen vises i vaktplanen? Sykdom: med en gang (om ikke avslått).
-- Søknader: først når de er godkjent.
CREATE OR REPLACE FUNCTION public.kbfb_absence_on_schedule(absence_type text, absence_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN absence_type IN ('Egenmelding', 'Sykemelding', 'Omsorgsdager') THEN COALESCE(absence_status, '') <> 'Avslått'
    ELSE absence_status = 'Godkjent'
  END
$$;

-- Nærmeste arbeidsdag før (direction = -1) eller etter (+1), helg hoppes over.
CREATE OR REPLACE FUNCTION public.kbfb_neighbour_workday(day date, direction int)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  x date := day + direction;
BEGIN
  WHILE extract(isodow FROM x) > 5 LOOP
    x := x + direction;
  END LOOP;
  RETURN x;
END;
$$;

-- ---------- Fravær -> vaktplan ----------
CREATE OR REPLACE FUNCTION public.kbfb_sync_absence_to_shifts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date;
  code text;
  new_code text;
  dept text;
  dow int;
BEGIN
  -- Bare navnebytte (kbfb_rename_employee): vaktplanen bytter navn selv.
  IF TG_OP = 'UPDATE'
     AND OLD.name IS DISTINCT FROM NEW.name
     AND OLD.type IS NOT DISTINCT FROM NEW.type
     AND OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.start_date IS NOT DISTINCT FROM NEW.start_date
     AND OLD.end_date IS NOT DISTINCT FROM NEW.end_date THEN
    RETURN NEW;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    new_code := public.kbfb_absence_shift_code(NEW.type);
  END IF;

  -- 1. Rydd bort det den gamle versjonen satte i vaktplanen
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    code := public.kbfb_absence_shift_code(OLD.type);

    IF code IS NOT NULL AND public.kbfb_absence_on_schedule(OLD.type, OLD.status) AND OLD.start_date IS NOT NULL THEN
      FOR d IN
        SELECT g::date FROM generate_series(OLD.start_date::date, COALESCE(OLD.end_date, OLD.start_date)::date, interval '1 day') g
      LOOP
        dow := extract(isodow FROM d)::int;
        CONTINUE WHEN dow > 5;

        -- Den nye versjonen dekker fortsatt dagen med samme kode
        IF TG_OP = 'UPDATE' AND new_code = code
           AND public.kbfb_absence_on_schedule(NEW.type, NEW.status)
           AND NEW.name = OLD.name
           AND d BETWEEN NEW.start_date::date AND COALESCE(NEW.end_date, NEW.start_date)::date THEN
          CONTINUE;
        END IF;

        -- En annen føring dekker dagen med samme kode
        IF EXISTS (
          SELECT 1 FROM public.kbfb_absences a
          WHERE a.name = OLD.name
            AND a.id <> OLD.id
            AND public.kbfb_absence_shift_code(a.type) = code
            AND public.kbfb_absence_on_schedule(a.type, a.status)
            AND d BETWEEN a.start_date::date AND COALESCE(a.end_date, a.start_date)::date
        ) THEN
          CONTINUE;
        END IF;

        UPDATE public.kbfb_shifts
          SET shift_value = ''
          WHERE employee = OLD.name
            AND week_start = d - (dow - 1)
            AND day_index = dow - 1
            AND shift_value = code;
      END LOOP;
    END IF;
  END IF;

  -- 2. Sett den nye versjonen inn i vaktplanen
  IF TG_OP IN ('INSERT', 'UPDATE')
     AND new_code IS NOT NULL
     AND public.kbfb_absence_on_schedule(NEW.type, NEW.status)
     AND NEW.start_date IS NOT NULL THEN

    SELECT department INTO dept FROM public.kbfb_employees WHERE name = NEW.name LIMIT 1;

    IF dept IS NOT NULL AND dept <> '' THEN
      FOR d IN
        SELECT g::date FROM generate_series(NEW.start_date::date, COALESCE(NEW.end_date, NEW.start_date)::date, interval '1 day') g
      LOOP
        dow := extract(isodow FROM d)::int;
        CONTINUE WHEN dow > 5;

        UPDATE public.kbfb_shifts
          SET shift_value = new_code
          WHERE week_start = d - (dow - 1)
            AND department = dept
            AND employee = NEW.name
            AND day_index = dow - 1;

        IF NOT FOUND THEN
          INSERT INTO public.kbfb_shifts (week_start, department, employee, day_index, shift_value)
            VALUES (d - (dow - 1), dept, NEW.name, dow - 1, new_code);
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS kbfb_absences_sync_shifts ON public.kbfb_absences;
CREATE TRIGGER kbfb_absences_sync_shifts
  AFTER INSERT OR UPDATE OR DELETE ON public.kbfb_absences
  FOR EACH ROW EXECUTE FUNCTION public.kbfb_sync_absence_to_shifts();

-- ---------- Vaktplan -> fravær (bare SYK og SB) ----------
CREATE OR REPLACE FUNCTION public.kbfb_sync_shift_to_absences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date;
  old_code text;
  new_code text;
  types text[];
  new_type text;
  r record;
  before_r record;
  after_r record;
  left_end date;
  right_start date;
  r_end date;
BEGIN
  -- Endringen kom fra fravær-triggeren over - ikke send den tilbake.
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Navnebytte: ingen endring i selve fraværet.
  IF TG_OP = 'UPDATE' AND OLD.employee IS DISTINCT FROM NEW.employee THEN
    RETURN NEW;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN old_code := OLD.shift_value; END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN new_code := NEW.shift_value; END IF;

  IF old_code IS NOT DISTINCT FROM new_code THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 1. SYK/SB fjernet: ta dagen ut av føringen
  IF old_code IN ('SYK', 'SB') THEN
    d := OLD.week_start + OLD.day_index;
    types := CASE WHEN old_code = 'SYK' THEN ARRAY['Egenmelding', 'Sykemelding'] ELSE ARRAY['Omsorgsdager'] END;

    FOR r IN
      SELECT * FROM public.kbfb_absences
      WHERE name = OLD.employee
        AND type = ANY(types)
        AND COALESCE(status, '') <> 'Avslått'
        AND d BETWEEN start_date::date AND COALESCE(end_date, start_date)::date
    LOOP
      r_end := COALESCE(r.end_date, r.start_date)::date;
      left_end := public.kbfb_neighbour_workday(d, -1);
      right_start := public.kbfb_neighbour_workday(d, 1);

      IF left_end < r.start_date::date AND right_start > r_end THEN
        DELETE FROM public.kbfb_absences WHERE id = r.id;
      ELSIF left_end < r.start_date::date THEN
        UPDATE public.kbfb_absences SET start_date = right_start WHERE id = r.id;
      ELSIF right_start > r_end THEN
        UPDATE public.kbfb_absences SET end_date = left_end WHERE id = r.id;
      ELSE
        -- Dagen lå midt i: del i to (lag høyre del først, så ingenting
        -- i vaktplanen tømmes underveis).
        INSERT INTO public.kbfb_absences (name, type, start_date, end_date, status, note)
          VALUES (r.name, r.type, right_start, r_end, r.status, r.note);
        UPDATE public.kbfb_absences SET end_date = left_end WHERE id = r.id;
      END IF;
    END LOOP;
  END IF;

  -- 2. SYK/SB satt: sørg for at det finnes en føring (slå sammen med naboer)
  IF new_code IN ('SYK', 'SB') THEN
    d := NEW.week_start + NEW.day_index;
    types := CASE WHEN new_code = 'SYK' THEN ARRAY['Egenmelding', 'Sykemelding'] ELSE ARRAY['Omsorgsdager'] END;
    new_type := CASE WHEN new_code = 'SYK' THEN 'Egenmelding' ELSE 'Omsorgsdager' END;

    IF NOT EXISTS (
      SELECT 1 FROM public.kbfb_absences
      WHERE name = NEW.employee
        AND type = ANY(types)
        AND COALESCE(status, '') <> 'Avslått'
        AND d BETWEEN start_date::date AND COALESCE(end_date, start_date)::date
    ) THEN
      SELECT * INTO before_r FROM public.kbfb_absences
        WHERE name = NEW.employee AND type = new_type AND COALESCE(status, '') <> 'Avslått'
          AND COALESCE(end_date, start_date)::date = public.kbfb_neighbour_workday(d, -1)
        LIMIT 1;
      SELECT * INTO after_r FROM public.kbfb_absences
        WHERE name = NEW.employee AND type = new_type AND COALESCE(status, '') <> 'Avslått'
          AND start_date::date = public.kbfb_neighbour_workday(d, 1)
        LIMIT 1;

      IF before_r.id IS NOT NULL AND after_r.id IS NOT NULL THEN
        UPDATE public.kbfb_absences SET end_date = COALESCE(after_r.end_date, after_r.start_date) WHERE id = before_r.id;
        DELETE FROM public.kbfb_absences WHERE id = after_r.id;
      ELSIF before_r.id IS NOT NULL THEN
        UPDATE public.kbfb_absences SET end_date = d WHERE id = before_r.id;
      ELSIF after_r.id IS NOT NULL THEN
        UPDATE public.kbfb_absences SET start_date = d WHERE id = after_r.id;
      ELSE
        INSERT INTO public.kbfb_absences (name, type, start_date, end_date, status, note)
          VALUES (NEW.employee, new_type, d, d, 'Registrert', 'Registrert automatisk fra vaktplanen');
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS kbfb_shifts_sync_absences ON public.kbfb_shifts;
CREATE TRIGGER kbfb_shifts_sync_absences
  AFTER INSERT OR UPDATE OR DELETE ON public.kbfb_shifts
  FOR EACH ROW EXECUTE FUNCTION public.kbfb_sync_shift_to_absences();

-- ---------- Rett opp det som allerede ligger der ----------
-- Legger alle sykedager og godkjente fridager fra 1. januar i år og
-- framover inn i vaktplanen (f.eks. sykdom ansatte har meldt selv, som
-- tidligere ikke kom med). Rører ikke vakter som ikke har en føring.
UPDATE public.kbfb_absences
  SET status = status
  WHERE public.kbfb_absence_shift_code(type) IS NOT NULL
    AND public.kbfb_absence_on_schedule(type, status)
    AND COALESCE(end_date, start_date)::date >= date_trunc('year', current_date)::date;
