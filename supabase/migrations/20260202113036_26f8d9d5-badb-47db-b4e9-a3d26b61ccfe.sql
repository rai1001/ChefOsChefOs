-- =====================================================
-- PASO 1: Crear tabla de hoteles
-- =====================================================
CREATE TABLE public.hotels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  address text,
  phone text,
  email text,
  website text,
  logo_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id)
);

-- Trigger para updated_at
CREATE TRIGGER update_hotels_updated_at
  BEFORE UPDATE ON public.hotels
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS para hotels
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 2: Crear tabla de membresías hotel-usuario
-- =====================================================
CREATE TABLE public.hotel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_owner boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(hotel_id, user_id)
);

ALTER TABLE public.hotel_members ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 3: Crear tabla de invitaciones
-- =====================================================
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'produccion',
  token text UNIQUE NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  invited_by uuid REFERENCES auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 4: Añadir hotel_id a todas las tablas existentes
-- =====================================================
ALTER TABLE public.events ADD COLUMN hotel_id uuid REFERENCES public.hotels(id);
ALTER TABLE public.forecasts ADD COLUMN hotel_id uuid REFERENCES public.hotels(id);
ALTER TABLE public.menus ADD COLUMN hotel_id uuid REFERENCES public.hotels(id);
ALTER TABLE public.products ADD COLUMN hotel_id uuid REFERENCES public.hotels(id);
ALTER TABLE public.product_categories ADD COLUMN hotel_id uuid REFERENCES public.hotels(id);
ALTER TABLE public.suppliers ADD COLUMN hotel_id uuid REFERENCES public.hotels(id);
ALTER TABLE public.purchases ADD COLUMN hotel_id uuid REFERENCES public.hotels(id);
ALTER TABLE public.inventory_lots ADD COLUMN hotel_id uuid REFERENCES public.hotels(id);
ALTER TABLE public.inventory_movements ADD COLUMN hotel_id uuid REFERENCES public.hotels(id);
ALTER TABLE public.production_tasks ADD COLUMN hotel_id uuid REFERENCES public.hotels(id);
ALTER TABLE public.staff_shifts ADD COLUMN hotel_id uuid REFERENCES public.hotels(id);
ALTER TABLE public.venues ADD COLUMN hotel_id uuid REFERENCES public.hotels(id);
ALTER TABLE public.units ADD COLUMN hotel_id uuid REFERENCES public.hotels(id);

-- Añadir hotel_id a profiles para saber el hotel activo del usuario
ALTER TABLE public.profiles ADD COLUMN current_hotel_id uuid REFERENCES public.hotels(id);

-- =====================================================
-- PASO 5: Funciones de seguridad para multi-tenancy
-- =====================================================

-- Función para obtener el hotel actual del usuario
CREATE OR REPLACE FUNCTION public.get_user_hotel_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_hotel_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Función para verificar si un usuario pertenece a un hotel
CREATE OR REPLACE FUNCTION public.user_belongs_to_hotel(_hotel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hotel_members
    WHERE user_id = auth.uid() AND hotel_id = _hotel_id
  );
$$;

-- Función para verificar si el usuario es owner del hotel actual
CREATE OR REPLACE FUNCTION public.is_hotel_owner()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hotel_members
    WHERE user_id = auth.uid() 
      AND hotel_id = public.get_user_hotel_id()
      AND is_owner = true
  );
$$;

-- =====================================================
-- PASO 6: Políticas RLS para hotels
-- =====================================================
CREATE POLICY "Users can view their hotels"
ON public.hotels FOR SELECT
USING (public.user_belongs_to_hotel(id));

CREATE POLICY "Owners can update their hotel"
ON public.hotels FOR UPDATE
USING (public.user_belongs_to_hotel(id) AND (public.is_hotel_owner() OR public.is_admin()));

-- =====================================================
-- PASO 7: Políticas RLS para hotel_members
-- =====================================================
CREATE POLICY "Members can view hotel members"
ON public.hotel_members FOR SELECT
USING (public.user_belongs_to_hotel(hotel_id));

CREATE POLICY "Admins can manage members"
ON public.hotel_members FOR INSERT
WITH CHECK (public.user_belongs_to_hotel(hotel_id) AND (public.is_hotel_owner() OR public.is_admin()));

CREATE POLICY "Admins can delete members"
ON public.hotel_members FOR DELETE
USING (public.user_belongs_to_hotel(hotel_id) AND (public.is_hotel_owner() OR public.is_admin()));

-- =====================================================
-- PASO 8: Políticas RLS para invitations
-- =====================================================
CREATE POLICY "Admins can view invitations"
ON public.invitations FOR SELECT
USING (public.user_belongs_to_hotel(hotel_id) AND (public.is_admin() OR public.is_hotel_owner()));

CREATE POLICY "Admins can create invitations"
ON public.invitations FOR INSERT
WITH CHECK (public.user_belongs_to_hotel(hotel_id) AND (public.is_admin() OR public.is_hotel_owner()));

CREATE POLICY "Admins can delete invitations"
ON public.invitations FOR DELETE
USING (public.user_belongs_to_hotel(hotel_id) AND (public.is_admin() OR public.is_hotel_owner()));

-- Política pública para aceptar invitaciones por token
CREATE POLICY "Anyone can view invitation by token"
ON public.invitations FOR SELECT
USING (token IS NOT NULL);

-- =====================================================
-- PASO 9: Actualizar políticas existentes para multi-tenancy
-- =====================================================

-- EVENTS
DROP POLICY IF EXISTS "Event staff can view events" ON public.events;
CREATE POLICY "Hotel staff can view events"
ON public.events FOR SELECT
USING (
  hotel_id = public.get_user_hotel_id() 
  AND (has_management_access() OR is_maitre())
);

DROP POLICY IF EXISTS "Management can create events" ON public.events;
CREATE POLICY "Hotel management can create events"
ON public.events FOR INSERT
WITH CHECK (
  hotel_id = public.get_user_hotel_id() 
  AND (has_management_access() OR is_maitre())
);

DROP POLICY IF EXISTS "Management can update events" ON public.events;
CREATE POLICY "Hotel management can update events"
ON public.events FOR UPDATE
USING (
  hotel_id = public.get_user_hotel_id() 
  AND (has_management_access() OR is_maitre())
);

DROP POLICY IF EXISTS "Management can delete events" ON public.events;
CREATE POLICY "Hotel management can delete events"
ON public.events FOR DELETE
USING (
  hotel_id = public.get_user_hotel_id() 
  AND has_management_access()
);

-- FORECASTS
DROP POLICY IF EXISTS "Management can view forecasts" ON public.forecasts;
CREATE POLICY "Hotel management can view forecasts"
ON public.forecasts FOR SELECT
USING (hotel_id = public.get_user_hotel_id() AND has_management_access());

DROP POLICY IF EXISTS "Management can create forecasts" ON public.forecasts;
CREATE POLICY "Hotel management can create forecasts"
ON public.forecasts FOR INSERT
WITH CHECK (hotel_id = public.get_user_hotel_id() AND has_management_access());

DROP POLICY IF EXISTS "Management can update forecasts" ON public.forecasts;
CREATE POLICY "Hotel management can update forecasts"
ON public.forecasts FOR UPDATE
USING (hotel_id = public.get_user_hotel_id() AND has_management_access());

DROP POLICY IF EXISTS "Management can delete forecasts" ON public.forecasts;
CREATE POLICY "Hotel management can delete forecasts"
ON public.forecasts FOR DELETE
USING (hotel_id = public.get_user_hotel_id() AND has_management_access());

-- MENUS
DROP POLICY IF EXISTS "Staff can view menus" ON public.menus;
CREATE POLICY "Hotel staff can view menus"
ON public.menus FOR SELECT
USING (hotel_id = public.get_user_hotel_id() AND (has_management_access() OR is_maitre()));

DROP POLICY IF EXISTS "Management can manage menus" ON public.menus;
CREATE POLICY "Hotel management can create menus"
ON public.menus FOR INSERT
WITH CHECK (hotel_id = public.get_user_hotel_id() AND has_management_access());

DROP POLICY IF EXISTS "Management can update menus" ON public.menus;
CREATE POLICY "Hotel management can update menus"
ON public.menus FOR UPDATE
USING (hotel_id = public.get_user_hotel_id() AND has_management_access());

DROP POLICY IF EXISTS "Management can delete menus" ON public.menus;
CREATE POLICY "Hotel management can delete menus"
ON public.menus FOR DELETE
USING (hotel_id = public.get_user_hotel_id() AND has_management_access());

-- PRODUCTS
DROP POLICY IF EXISTS "Staff can view products" ON public.products;
CREATE POLICY "Hotel staff can view products"
ON public.products FOR SELECT
USING (hotel_id = public.get_user_hotel_id() AND (has_management_access() OR is_maitre() OR is_produccion()));

DROP POLICY IF EXISTS "Management can manage products" ON public.products;
CREATE POLICY "Hotel management can create products"
ON public.products FOR INSERT
WITH CHECK (hotel_id = public.get_user_hotel_id() AND has_management_access());

DROP POLICY IF EXISTS "Management can update products" ON public.products;
CREATE POLICY "Hotel management can update products"
ON public.products FOR UPDATE
USING (hotel_id = public.get_user_hotel_id() AND has_management_access());

DROP POLICY IF EXISTS "Management can delete products" ON public.products;
CREATE POLICY "Hotel management can delete products"
ON public.products FOR DELETE
USING (hotel_id = public.get_user_hotel_id() AND has_management_access());

-- SUPPLIERS
DROP POLICY IF EXISTS "Staff can view suppliers" ON public.suppliers;
CREATE POLICY "Hotel staff can view suppliers"
ON public.suppliers FOR SELECT
USING (hotel_id = public.get_user_hotel_id() AND (has_management_access() OR is_produccion()));

DROP POLICY IF EXISTS "Management can manage suppliers" ON public.suppliers;
CREATE POLICY "Hotel management can create suppliers"
ON public.suppliers FOR INSERT
WITH CHECK (hotel_id = public.get_user_hotel_id() AND has_management_access());

DROP POLICY IF EXISTS "Management can update suppliers" ON public.suppliers;
CREATE POLICY "Hotel management can update suppliers"
ON public.suppliers FOR UPDATE
USING (hotel_id = public.get_user_hotel_id() AND has_management_access());

DROP POLICY IF EXISTS "Management can delete suppliers" ON public.suppliers;
CREATE POLICY "Hotel management can delete suppliers"
ON public.suppliers FOR DELETE
USING (hotel_id = public.get_user_hotel_id() AND has_management_access());

-- PURCHASES
DROP POLICY IF EXISTS "Staff can view purchases" ON public.purchases;
CREATE POLICY "Hotel staff can view purchases"
ON public.purchases FOR SELECT
USING (hotel_id = public.get_user_hotel_id() AND (has_management_access() OR is_produccion()));

DROP POLICY IF EXISTS "Management can create purchases" ON public.purchases;
CREATE POLICY "Hotel management can create purchases"
ON public.purchases FOR INSERT
WITH CHECK (hotel_id = public.get_user_hotel_id() AND has_management_access());

DROP POLICY IF EXISTS "Staff can update purchases for reception" ON public.purchases;
CREATE POLICY "Hotel staff can update purchases"
ON public.purchases FOR UPDATE
USING (hotel_id = public.get_user_hotel_id() AND (has_management_access() OR is_produccion()));

DROP POLICY IF EXISTS "Management can delete purchases" ON public.purchases;
CREATE POLICY "Hotel management can delete purchases"
ON public.purchases FOR DELETE
USING (hotel_id = public.get_user_hotel_id() AND has_management_access());

-- PURCHASE_ITEMS
DROP POLICY IF EXISTS "Staff can view purchase items" ON public.purchase_items;
CREATE POLICY "Hotel staff can view purchase items"
ON public.purchase_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.purchases p 
    WHERE p.id = purchase_id 
    AND p.hotel_id = public.get_user_hotel_id()
  )
  AND (has_management_access() OR is_produccion())
);

DROP POLICY IF EXISTS "Management can create purchase items" ON public.purchase_items;
CREATE POLICY "Hotel management can create purchase items"
ON public.purchase_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.purchases p 
    WHERE p.id = purchase_id 
    AND p.hotel_id = public.get_user_hotel_id()
  )
  AND has_management_access()
);

DROP POLICY IF EXISTS "Staff can update purchase items for reception" ON public.purchase_items;
CREATE POLICY "Hotel staff can update purchase items"
ON public.purchase_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.purchases p 
    WHERE p.id = purchase_id 
    AND p.hotel_id = public.get_user_hotel_id()
  )
  AND (has_management_access() OR is_produccion())
);

DROP POLICY IF EXISTS "Management can delete purchase items" ON public.purchase_items;
CREATE POLICY "Hotel management can delete purchase items"
ON public.purchase_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.purchases p 
    WHERE p.id = purchase_id 
    AND p.hotel_id = public.get_user_hotel_id()
  )
  AND has_management_access()
);

-- INVENTORY_LOTS
DROP POLICY IF EXISTS "Inventory staff can view lots" ON public.inventory_lots;
CREATE POLICY "Hotel staff can view inventory lots"
ON public.inventory_lots FOR SELECT
USING (hotel_id = public.get_user_hotel_id() AND (has_management_access() OR is_produccion()));

DROP POLICY IF EXISTS "Inventory staff can create lots" ON public.inventory_lots;
CREATE POLICY "Hotel staff can create inventory lots"
ON public.inventory_lots FOR INSERT
WITH CHECK (hotel_id = public.get_user_hotel_id() AND (has_management_access() OR is_produccion()));

DROP POLICY IF EXISTS "Inventory staff can update lots" ON public.inventory_lots;
CREATE POLICY "Hotel staff can update inventory lots"
ON public.inventory_lots FOR UPDATE
USING (hotel_id = public.get_user_hotel_id() AND (has_management_access() OR is_produccion()));

DROP POLICY IF EXISTS "Management can delete lots" ON public.inventory_lots;
CREATE POLICY "Hotel management can delete inventory lots"
ON public.inventory_lots FOR DELETE
USING (hotel_id = public.get_user_hotel_id() AND has_management_access());

-- INVENTORY_MOVEMENTS
DROP POLICY IF EXISTS "Inventory staff can view movements" ON public.inventory_movements;
CREATE POLICY "Hotel staff can view inventory movements"
ON public.inventory_movements FOR SELECT
USING (hotel_id = public.get_user_hotel_id() AND (has_management_access() OR is_produccion()));

DROP POLICY IF EXISTS "Inventory staff can create movements" ON public.inventory_movements;
CREATE POLICY "Hotel staff can create inventory movements"
ON public.inventory_movements FOR INSERT
WITH CHECK (hotel_id = public.get_user_hotel_id() AND (has_management_access() OR is_produccion()));

DROP POLICY IF EXISTS "Management can delete movements" ON public.inventory_movements;
CREATE POLICY "Hotel management can delete inventory movements"
ON public.inventory_movements FOR DELETE
USING (hotel_id = public.get_user_hotel_id() AND has_management_access());

-- PRODUCTION_TASKS
DROP POLICY IF EXISTS "Task staff can view tasks" ON public.production_tasks;
CREATE POLICY "Hotel staff can view tasks"
ON public.production_tasks FOR SELECT
USING (
  hotel_id = public.get_user_hotel_id() 
  AND (has_management_access() OR is_produccion() OR assigned_to = auth.uid())
);

DROP POLICY IF EXISTS "Management can create tasks" ON public.production_tasks;
CREATE POLICY "Hotel management can create tasks"
ON public.production_tasks FOR INSERT
WITH CHECK (hotel_id = public.get_user_hotel_id() AND has_management_access());

DROP POLICY IF EXISTS "Task staff can update tasks" ON public.production_tasks;
CREATE POLICY "Hotel staff can update tasks"
ON public.production_tasks FOR UPDATE
USING (
  hotel_id = public.get_user_hotel_id() 
  AND (has_management_access() OR assigned_to = auth.uid())
);

DROP POLICY IF EXISTS "Management can delete tasks" ON public.production_tasks;
CREATE POLICY "Hotel management can delete tasks"
ON public.production_tasks FOR DELETE
USING (hotel_id = public.get_user_hotel_id() AND has_management_access());

-- STAFF_SHIFTS
DROP POLICY IF EXISTS "Staff can view all shifts" ON public.staff_shifts;
CREATE POLICY "Hotel staff can view shifts"
ON public.staff_shifts FOR SELECT
USING (
  hotel_id = public.get_user_hotel_id() 
  AND (has_management_access() OR is_rrhh() OR is_produccion() OR user_id = auth.uid())
);

DROP POLICY IF EXISTS "HR can create shifts" ON public.staff_shifts;
CREATE POLICY "Hotel HR can create shifts"
ON public.staff_shifts FOR INSERT
WITH CHECK (hotel_id = public.get_user_hotel_id() AND (has_management_access() OR is_rrhh()));

DROP POLICY IF EXISTS "HR can update shifts" ON public.staff_shifts;
CREATE POLICY "Hotel HR can update shifts"
ON public.staff_shifts FOR UPDATE
USING (hotel_id = public.get_user_hotel_id() AND (has_management_access() OR is_rrhh()));

DROP POLICY IF EXISTS "HR can delete shifts" ON public.staff_shifts;
CREATE POLICY "Hotel HR can delete shifts"
ON public.staff_shifts FOR DELETE
USING (hotel_id = public.get_user_hotel_id() AND (has_management_access() OR is_rrhh()));

-- VENUES
DROP POLICY IF EXISTS "Staff can view venues" ON public.venues;
CREATE POLICY "Hotel staff can view venues"
ON public.venues FOR SELECT
USING (hotel_id = public.get_user_hotel_id() AND (has_management_access() OR is_maitre()));

DROP POLICY IF EXISTS "Management can manage venues" ON public.venues;
CREATE POLICY "Hotel management can create venues"
ON public.venues FOR INSERT
WITH CHECK (hotel_id = public.get_user_hotel_id() AND has_management_access());

DROP POLICY IF EXISTS "Management can update venues" ON public.venues;
CREATE POLICY "Hotel management can update venues"
ON public.venues FOR UPDATE
USING (hotel_id = public.get_user_hotel_id() AND has_management_access());

DROP POLICY IF EXISTS "Management can delete venues" ON public.venues;
CREATE POLICY "Hotel management can delete venues"
ON public.venues FOR DELETE
USING (hotel_id = public.get_user_hotel_id() AND has_management_access());

-- UNITS
DROP POLICY IF EXISTS "Staff can view units" ON public.units;
CREATE POLICY "Hotel staff can view units"
ON public.units FOR SELECT
USING (hotel_id = public.get_user_hotel_id() AND (has_management_access() OR is_produccion()));

DROP POLICY IF EXISTS "Management can manage units" ON public.units;
CREATE POLICY "Hotel management can create units"
ON public.units FOR INSERT
WITH CHECK (hotel_id = public.get_user_hotel_id() AND has_management_access());

DROP POLICY IF EXISTS "Management can update units" ON public.units;
CREATE POLICY "Hotel management can update units"
ON public.units FOR UPDATE
USING (hotel_id = public.get_user_hotel_id() AND has_management_access());

DROP POLICY IF EXISTS "Management can delete units" ON public.units;
CREATE POLICY "Hotel management can delete units"
ON public.units FOR DELETE
USING (hotel_id = public.get_user_hotel_id() AND has_management_access());

-- PRODUCT_CATEGORIES
DROP POLICY IF EXISTS "Staff can view categories" ON public.product_categories;
CREATE POLICY "Hotel staff can view categories"
ON public.product_categories FOR SELECT
USING (hotel_id = public.get_user_hotel_id() AND (has_management_access() OR is_produccion()));

DROP POLICY IF EXISTS "Management can manage categories" ON public.product_categories;
CREATE POLICY "Hotel management can create categories"
ON public.product_categories FOR INSERT
WITH CHECK (hotel_id = public.get_user_hotel_id() AND has_management_access());

DROP POLICY IF EXISTS "Management can update categories" ON public.product_categories;
CREATE POLICY "Hotel management can update categories"
ON public.product_categories FOR UPDATE
USING (hotel_id = public.get_user_hotel_id() AND has_management_access());

DROP POLICY IF EXISTS "Management can delete categories" ON public.product_categories;
CREATE POLICY "Hotel management can delete categories"
ON public.product_categories FOR DELETE
USING (hotel_id = public.get_user_hotel_id() AND has_management_access());

-- MENU_ITEMS (a través de menu)
DROP POLICY IF EXISTS "Staff can view menu items" ON public.menu_items;
CREATE POLICY "Hotel staff can view menu items"
ON public.menu_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.menus m 
    WHERE m.id = menu_id 
    AND m.hotel_id = public.get_user_hotel_id()
  )
  AND (has_management_access() OR is_maitre())
);

DROP POLICY IF EXISTS "Management can manage menu items" ON public.menu_items;
CREATE POLICY "Hotel management can create menu items"
ON public.menu_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.menus m 
    WHERE m.id = menu_id 
    AND m.hotel_id = public.get_user_hotel_id()
  )
  AND has_management_access()
);

DROP POLICY IF EXISTS "Management can update menu items" ON public.menu_items;
CREATE POLICY "Hotel management can update menu items"
ON public.menu_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.menus m 
    WHERE m.id = menu_id 
    AND m.hotel_id = public.get_user_hotel_id()
  )
  AND has_management_access()
);

DROP POLICY IF EXISTS "Management can delete menu items" ON public.menu_items;
CREATE POLICY "Hotel management can delete menu items"
ON public.menu_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.menus m 
    WHERE m.id = menu_id 
    AND m.hotel_id = public.get_user_hotel_id()
  )
  AND has_management_access()
);
