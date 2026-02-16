-- Fase 3: umbrales por producto/categoria para compras inteligentes.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS optimal_stock numeric(10,2),
  ADD COLUMN IF NOT EXISTS critical_stock numeric(10,2);

UPDATE public.products
SET optimal_stock = GREATEST(COALESCE(min_stock, 0), COALESCE(min_stock, 0) * 1.5)
WHERE optimal_stock IS NULL;

UPDATE public.products
SET critical_stock = GREATEST(0, ROUND(COALESCE(min_stock, 0) * 0.4, 2))
WHERE critical_stock IS NULL;

ALTER TABLE public.products
  ALTER COLUMN optimal_stock SET DEFAULT 0,
  ALTER COLUMN optimal_stock SET NOT NULL,
  ALTER COLUMN critical_stock SET DEFAULT 0,
  ALTER COLUMN critical_stock SET NOT NULL;

ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS default_min_stock numeric(10,2),
  ADD COLUMN IF NOT EXISTS default_optimal_stock numeric(10,2),
  ADD COLUMN IF NOT EXISTS default_critical_stock numeric(10,2);

UPDATE public.product_categories
SET
  default_min_stock = COALESCE(default_min_stock, 0),
  default_optimal_stock = COALESCE(default_optimal_stock, 0),
  default_critical_stock = COALESCE(default_critical_stock, 0)
WHERE default_min_stock IS NULL
   OR default_optimal_stock IS NULL
   OR default_critical_stock IS NULL;

ALTER TABLE public.product_categories
  ALTER COLUMN default_min_stock SET DEFAULT 0,
  ALTER COLUMN default_min_stock SET NOT NULL,
  ALTER COLUMN default_optimal_stock SET DEFAULT 0,
  ALTER COLUMN default_optimal_stock SET NOT NULL,
  ALTER COLUMN default_critical_stock SET DEFAULT 0,
  ALTER COLUMN default_critical_stock SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_stock_thresholds_non_negative'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_stock_thresholds_non_negative
      CHECK (
        min_stock >= 0
        AND optimal_stock >= 0
        AND critical_stock >= 0
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_stock_thresholds_order'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_stock_thresholds_order
      CHECK (
        critical_stock <= min_stock
        AND min_stock <= optimal_stock
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_categories_stock_thresholds_non_negative'
      AND conrelid = 'public.product_categories'::regclass
  ) THEN
    ALTER TABLE public.product_categories
      ADD CONSTRAINT product_categories_stock_thresholds_non_negative
      CHECK (
        default_min_stock >= 0
        AND default_optimal_stock >= 0
        AND default_critical_stock >= 0
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_categories_stock_thresholds_order'
      AND conrelid = 'public.product_categories'::regclass
  ) THEN
    ALTER TABLE public.product_categories
      ADD CONSTRAINT product_categories_stock_thresholds_order
      CHECK (
        default_critical_stock <= default_min_stock
        AND default_min_stock <= default_optimal_stock
      );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.normalize_product_thresholds()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.min_stock := GREATEST(COALESCE(NEW.min_stock, 0), 0);
  NEW.critical_stock := GREATEST(COALESCE(NEW.critical_stock, NEW.min_stock * 0.4, 0), 0);
  IF NEW.critical_stock > NEW.min_stock THEN
    NEW.min_stock := NEW.critical_stock;
  END IF;
  NEW.optimal_stock := GREATEST(COALESCE(NEW.optimal_stock, NEW.min_stock, 0), NEW.min_stock);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS normalize_products_thresholds ON public.products;
CREATE TRIGGER normalize_products_thresholds
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.normalize_product_thresholds();

CREATE OR REPLACE FUNCTION public.normalize_product_category_thresholds()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.default_min_stock := GREATEST(COALESCE(NEW.default_min_stock, 0), 0);
  NEW.default_critical_stock := GREATEST(COALESCE(NEW.default_critical_stock, NEW.default_min_stock * 0.4, 0), 0);
  IF NEW.default_critical_stock > NEW.default_min_stock THEN
    NEW.default_min_stock := NEW.default_critical_stock;
  END IF;
  NEW.default_optimal_stock := GREATEST(COALESCE(NEW.default_optimal_stock, NEW.default_min_stock, 0), NEW.default_min_stock);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS normalize_product_categories_thresholds ON public.product_categories;
CREATE TRIGGER normalize_product_categories_thresholds
BEFORE INSERT OR UPDATE ON public.product_categories
FOR EACH ROW
EXECUTE FUNCTION public.normalize_product_category_thresholds();

CREATE INDEX IF NOT EXISTS idx_products_hotel_thresholds
  ON public.products(hotel_id, is_active, current_stock, critical_stock, min_stock, optimal_stock);

COMMENT ON COLUMN public.products.critical_stock IS 'Critical stock threshold (alerta critica).';
COMMENT ON COLUMN public.products.min_stock IS 'Minimum stock threshold (alerta media).';
COMMENT ON COLUMN public.products.optimal_stock IS 'Target stock threshold (reposicion sugerida).';
COMMENT ON COLUMN public.product_categories.default_critical_stock IS 'Default critical stock threshold for category.';
COMMENT ON COLUMN public.product_categories.default_min_stock IS 'Default minimum stock threshold for category.';
COMMENT ON COLUMN public.product_categories.default_optimal_stock IS 'Default optimal stock threshold for category.';
