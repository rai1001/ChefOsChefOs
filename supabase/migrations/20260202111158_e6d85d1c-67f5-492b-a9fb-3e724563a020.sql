-- Add delivery scheduling to suppliers
ALTER TABLE public.suppliers
ADD COLUMN delivery_days text[] DEFAULT '{}',
ADD COLUMN delivery_lead_days integer DEFAULT 1;

-- Add tracking fields to purchases
ALTER TABLE public.purchases
ADD COLUMN received_at timestamp with time zone,
ADD COLUMN delivery_status text DEFAULT 'pending',
ADD COLUMN is_complete boolean,
ADD COLUMN delivery_issues text,
ADD COLUMN delivery_note_url text;

-- Add constraint for delivery_status
ALTER TABLE public.purchases
ADD CONSTRAINT purchases_delivery_status_check 
CHECK (delivery_status IN ('pending', 'in_transit', 'delivered', 'late', 'incomplete'));

COMMENT ON COLUMN public.suppliers.delivery_days IS 'Days of week for delivery: monday, tuesday, wednesday, thursday, friday, saturday, sunday';
COMMENT ON COLUMN public.suppliers.delivery_lead_days IS 'Number of days from order to delivery';
COMMENT ON COLUMN public.purchases.delivery_status IS 'pending, in_transit, delivered, late, incomplete';
COMMENT ON COLUMN public.purchases.is_complete IS 'Whether all items were received in correct quantities';
COMMENT ON COLUMN public.purchases.delivery_issues IS 'Description of any delivery issues';