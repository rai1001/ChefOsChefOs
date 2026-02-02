-- Permitir a produccion ver pedidos (purchases)
DROP POLICY IF EXISTS "Management can view purchases" ON public.purchases;
CREATE POLICY "Staff can view purchases" 
ON public.purchases 
FOR SELECT 
USING (has_management_access() OR is_produccion());

-- Permitir a produccion actualizar pedidos para recepción
DROP POLICY IF EXISTS "Management can update purchases" ON public.purchases;
CREATE POLICY "Staff can update purchases for reception" 
ON public.purchases 
FOR UPDATE 
USING (has_management_access() OR is_produccion());

-- Permitir a produccion ver items de pedido
DROP POLICY IF EXISTS "Management can view purchase items" ON public.purchase_items;
CREATE POLICY "Staff can view purchase items" 
ON public.purchase_items 
FOR SELECT 
USING (has_management_access() OR is_produccion());

-- Permitir a produccion actualizar cantidades recibidas
DROP POLICY IF EXISTS "Management can update purchase items" ON public.purchase_items;
CREATE POLICY "Staff can update purchase items for reception" 
ON public.purchase_items 
FOR UPDATE 
USING (has_management_access() OR is_produccion());

-- Permitir a produccion ver todos los turnos (horarios)
DROP POLICY IF EXISTS "Shift staff can view shifts" ON public.staff_shifts;
CREATE POLICY "Staff can view all shifts" 
ON public.staff_shifts 
FOR SELECT 
USING (has_management_access() OR is_rrhh() OR is_produccion() OR (user_id = auth.uid()));