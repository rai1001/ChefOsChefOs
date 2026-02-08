-- Fix forecasts uniqueness for multi-tenant usage.
-- Old schema had UNIQUE(forecast_date), which causes cross-hotel conflicts.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'forecasts_forecast_date_key'
      AND conrelid = 'public.forecasts'::regclass
  ) THEN
    ALTER TABLE public.forecasts
      DROP CONSTRAINT forecasts_forecast_date_key;
  END IF;
END $$;

ALTER TABLE public.forecasts
  DROP CONSTRAINT IF EXISTS forecasts_hotel_id_forecast_date_key;

ALTER TABLE public.forecasts
  ADD CONSTRAINT forecasts_hotel_id_forecast_date_key
  UNIQUE (hotel_id, forecast_date);
