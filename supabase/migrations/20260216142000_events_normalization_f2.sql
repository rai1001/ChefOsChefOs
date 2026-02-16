-- Fase 2: normalizacion de eventos (tipo + pax estimado/confirmado) para operacion hotelera.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS pax_estimated integer,
  ADD COLUMN IF NOT EXISTS pax_confirmed integer;

UPDATE public.events
SET event_type = CASE
  WHEN lower(name) ~ '(desayuno|breakfast|brunch)' THEN 'breakfast'
  WHEN lower(name) ~ '(banquete|banquet|cena|almuerzo|comida)' THEN 'banquet'
  WHEN lower(name) ~ '(boda|wedding|enlace)' THEN 'wedding'
  WHEN lower(name) ~ '(corporativo|corporate|empresa|reunion|meeting)' THEN 'corporate'
  WHEN lower(name) ~ '(conferencia|conference|congreso|seminario)' THEN 'conference'
  WHEN lower(name) ~ '(cocktail|coctel|aperitivo)' THEN 'cocktail'
  ELSE 'other'
END
WHERE event_type IS NULL OR btrim(event_type) = '';

UPDATE public.events
SET pax_estimated = GREATEST(COALESCE(pax_estimated, pax, 0), 0)
WHERE pax_estimated IS NULL OR pax_estimated < 0;

UPDATE public.events
SET pax_confirmed = CASE
  WHEN status IN ('confirmed', 'in_progress', 'completed') THEN GREATEST(COALESCE(pax_confirmed, pax, pax_estimated, 0), 0)
  ELSE GREATEST(COALESCE(pax_confirmed, 0), 0)
END
WHERE pax_confirmed IS NULL OR pax_confirmed < 0;

UPDATE public.events
SET pax = GREATEST(
  COALESCE(NULLIF(pax_confirmed, 0), pax_estimated, pax, 0),
  0
);

ALTER TABLE public.events
  ALTER COLUMN event_type SET DEFAULT 'other',
  ALTER COLUMN event_type SET NOT NULL,
  ALTER COLUMN pax_estimated SET DEFAULT 0,
  ALTER COLUMN pax_estimated SET NOT NULL,
  ALTER COLUMN pax_confirmed SET DEFAULT 0,
  ALTER COLUMN pax_confirmed SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_event_type_check'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_event_type_check
      CHECK (
        event_type IN (
          'breakfast',
          'banquet',
          'wedding',
          'corporate',
          'conference',
          'cocktail',
          'other'
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_pax_estimated_non_negative'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_pax_estimated_non_negative CHECK (pax_estimated >= 0);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_pax_confirmed_non_negative'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_pax_confirmed_non_negative CHECK (pax_confirmed >= 0);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.normalize_event_row()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.name := regexp_replace(trim(COALESCE(NEW.name, '')), '\s+', ' ', 'g');
  IF NEW.name = '' THEN
    RAISE EXCEPTION 'events.name cannot be empty';
  END IF;

  NEW.status := COALESCE(NULLIF(trim(NEW.status), ''), 'draft');
  NEW.event_type := COALESCE(NULLIF(trim(NEW.event_type), ''), 'other');
  NEW.pax_estimated := GREATEST(COALESCE(NEW.pax_estimated, NEW.pax, 0), 0);

  IF NEW.status IN ('confirmed', 'in_progress', 'completed') THEN
    NEW.pax_confirmed := GREATEST(COALESCE(NEW.pax_confirmed, NEW.pax, NEW.pax_estimated, 0), 0);
  ELSE
    NEW.pax_confirmed := GREATEST(COALESCE(NEW.pax_confirmed, 0), 0);
  END IF;

  IF NEW.status = 'cancelled' THEN
    NEW.pax_confirmed := 0;
  END IF;

  IF NEW.pax_confirmed > NEW.pax_estimated THEN
    NEW.pax_estimated := NEW.pax_confirmed;
  END IF;

  NEW.pax := GREATEST(COALESCE(NULLIF(NEW.pax_confirmed, 0), NEW.pax_estimated, NEW.pax, 0), 0);

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS normalize_events_fields ON public.events;
CREATE TRIGGER normalize_events_fields
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.normalize_event_row();

CREATE INDEX IF NOT EXISTS idx_events_hotel_date_status_type
  ON public.events(hotel_id, event_date, status, event_type);

COMMENT ON COLUMN public.events.event_type IS 'Normalized event type for planning (breakfast/banquet/wedding/corporate/conference/cocktail/other).';
COMMENT ON COLUMN public.events.pax_estimated IS 'Estimated attendance for planning and procurement.';
COMMENT ON COLUMN public.events.pax_confirmed IS 'Confirmed attendance for production execution.';
