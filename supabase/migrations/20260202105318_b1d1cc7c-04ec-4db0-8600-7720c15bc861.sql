-- Add timing columns for task duration tracking
ALTER TABLE public.production_tasks
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Add barcode column for inventory lots (for barcode scanning)
ALTER TABLE public.inventory_lots
ADD COLUMN IF NOT EXISTS barcode TEXT,
ADD COLUMN IF NOT EXISTS movement_type TEXT DEFAULT 'entry',
ADD COLUMN IF NOT EXISTS reference_document TEXT;

-- Create inventory movements table for tracking entries/exits
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_id UUID REFERENCES public.inventory_lots(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL, -- 'entry' or 'exit'
  quantity NUMERIC NOT NULL,
  barcode TEXT,
  reference_document TEXT, -- albarán number, etc.
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on inventory_movements
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Policies for inventory_movements
CREATE POLICY "Inventory staff can create movements"
ON public.inventory_movements
FOR INSERT
WITH CHECK (has_management_access() OR is_produccion());

CREATE POLICY "Inventory staff can view movements"
ON public.inventory_movements
FOR SELECT
USING (has_management_access() OR is_produccion());

CREATE POLICY "Management can delete movements"
ON public.inventory_movements
FOR DELETE
USING (has_management_access());