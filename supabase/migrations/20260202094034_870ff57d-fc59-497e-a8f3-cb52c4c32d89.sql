-- =============================================
-- ChefOs Database Schema with Role-Based Security
-- =============================================

-- 1. Create role enum type
CREATE TYPE public.app_role AS ENUM ('admin', 'jefe_cocina', 'maitre', 'produccion', 'rrhh');

-- 2. Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- 4. Create venues (salones) table
CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  capacity INT,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create product categories table
CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Create units table
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Create suppliers table
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.product_categories(id),
  unit_id UUID REFERENCES public.units(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  cost_price DECIMAL(10,2) DEFAULT 0,
  min_stock DECIMAL(10,2) DEFAULT 0,
  current_stock DECIMAL(10,2) DEFAULT 0,
  allergens TEXT[],
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Create menus table
CREATE TABLE public.menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('breakfast', 'lunch', 'dinner', 'banquet', 'cocktail', 'coffee_break')),
  cost_per_pax DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Create menu_items (escandallo) table
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity_per_pax DECIMAL(10,4) NOT NULL,
  preparation_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME,
  venue_id UUID REFERENCES public.venues(id),
  menu_id UUID REFERENCES public.menus(id),
  pax INT NOT NULL DEFAULT 0,
  client_name TEXT,
  client_contact TEXT,
  status TEXT CHECK (status IN ('draft', 'confirmed', 'in_progress', 'completed', 'cancelled')) DEFAULT 'draft',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Create forecasts table
CREATE TABLE public.forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_date DATE NOT NULL UNIQUE,
  hotel_occupancy INT DEFAULT 0,
  predicted_occupancy INT DEFAULT 0,
  breakfast_pax INT DEFAULT 0,
  half_board_pax INT DEFAULT 0,
  full_board_pax INT DEFAULT 0,
  extras_pax INT DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Create inventory_lots table
CREATE TABLE public.inventory_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id),
  lot_number TEXT,
  quantity DECIMAL(10,2) NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  supplier_id UUID REFERENCES public.suppliers(id),
  cost_per_unit DECIMAL(10,2),
  location TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. Create production_tasks table
CREATE TABLE public.production_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  task_date DATE NOT NULL,
  shift TEXT CHECK (shift IN ('morning', 'afternoon', 'night')) NOT NULL,
  assigned_to UUID REFERENCES auth.users(id),
  event_id UUID REFERENCES public.events(id),
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. Create staff_shifts table
CREATE TABLE public.staff_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  shift_date DATE NOT NULL,
  shift_type TEXT CHECK (shift_type IN ('morning', 'afternoon', 'night', 'split', 'off')) NOT NULL,
  start_time TIME,
  end_time TIME,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, shift_date)
);

-- 16. Create purchases table
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  status TEXT CHECK (status IN ('draft', 'ordered', 'partial', 'received', 'cancelled')) DEFAULT 'draft',
  total_amount DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. Create purchase_items table
CREATE TABLE public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2),
  received_quantity DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- Security: Helper Functions (SECURITY DEFINER)
-- =============================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

-- Check if current user is jefe de cocina
CREATE OR REPLACE FUNCTION public.is_jefe_cocina()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'jefe_cocina');
$$;

-- Check if current user is maitre
CREATE OR REPLACE FUNCTION public.is_maitre()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'maitre');
$$;

-- Check if current user is produccion
CREATE OR REPLACE FUNCTION public.is_produccion()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'produccion');
$$;

-- Check if current user is RRHH
CREATE OR REPLACE FUNCTION public.is_rrhh()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'rrhh');
$$;

-- Check if user has management access (admin or jefe_cocina)
CREATE OR REPLACE FUNCTION public.has_management_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR public.is_jefe_cocina();
$$;

-- =============================================
-- Enable RLS on all tables
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies
-- =============================================

-- PROFILES
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- USER_ROLES (only admin can manage)
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin() OR user_id = auth.uid());
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin());

-- VENUES
CREATE POLICY "Staff can view venues" ON public.venues FOR SELECT TO authenticated USING (public.has_management_access() OR public.is_maitre());
CREATE POLICY "Management can manage venues" ON public.venues FOR INSERT TO authenticated WITH CHECK (public.has_management_access());
CREATE POLICY "Management can update venues" ON public.venues FOR UPDATE TO authenticated USING (public.has_management_access());
CREATE POLICY "Management can delete venues" ON public.venues FOR DELETE TO authenticated USING (public.has_management_access());

-- PRODUCT_CATEGORIES
CREATE POLICY "Staff can view categories" ON public.product_categories FOR SELECT TO authenticated USING (public.has_management_access() OR public.is_produccion());
CREATE POLICY "Management can manage categories" ON public.product_categories FOR INSERT TO authenticated WITH CHECK (public.has_management_access());
CREATE POLICY "Management can update categories" ON public.product_categories FOR UPDATE TO authenticated USING (public.has_management_access());
CREATE POLICY "Management can delete categories" ON public.product_categories FOR DELETE TO authenticated USING (public.has_management_access());

-- UNITS
CREATE POLICY "Staff can view units" ON public.units FOR SELECT TO authenticated USING (public.has_management_access() OR public.is_produccion());
CREATE POLICY "Management can manage units" ON public.units FOR INSERT TO authenticated WITH CHECK (public.has_management_access());
CREATE POLICY "Management can update units" ON public.units FOR UPDATE TO authenticated USING (public.has_management_access());
CREATE POLICY "Management can delete units" ON public.units FOR DELETE TO authenticated USING (public.has_management_access());

-- SUPPLIERS
CREATE POLICY "Staff can view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (public.has_management_access() OR public.is_produccion());
CREATE POLICY "Management can manage suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.has_management_access());
CREATE POLICY "Management can update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (public.has_management_access());
CREATE POLICY "Management can delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (public.has_management_access());

-- PRODUCTS
CREATE POLICY "Staff can view products" ON public.products FOR SELECT TO authenticated USING (public.has_management_access() OR public.is_maitre() OR public.is_produccion());
CREATE POLICY "Management can manage products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_management_access());
CREATE POLICY "Management can update products" ON public.products FOR UPDATE TO authenticated USING (public.has_management_access());
CREATE POLICY "Management can delete products" ON public.products FOR DELETE TO authenticated USING (public.has_management_access());

-- MENUS
CREATE POLICY "Staff can view menus" ON public.menus FOR SELECT TO authenticated USING (public.has_management_access() OR public.is_maitre());
CREATE POLICY "Management can manage menus" ON public.menus FOR INSERT TO authenticated WITH CHECK (public.has_management_access());
CREATE POLICY "Management can update menus" ON public.menus FOR UPDATE TO authenticated USING (public.has_management_access());
CREATE POLICY "Management can delete menus" ON public.menus FOR DELETE TO authenticated USING (public.has_management_access());

-- MENU_ITEMS
CREATE POLICY "Staff can view menu items" ON public.menu_items FOR SELECT TO authenticated USING (public.has_management_access() OR public.is_maitre());
CREATE POLICY "Management can manage menu items" ON public.menu_items FOR INSERT TO authenticated WITH CHECK (public.has_management_access());
CREATE POLICY "Management can update menu items" ON public.menu_items FOR UPDATE TO authenticated USING (public.has_management_access());
CREATE POLICY "Management can delete menu items" ON public.menu_items FOR DELETE TO authenticated USING (public.has_management_access());

-- EVENTS
CREATE POLICY "Event staff can view events" ON public.events FOR SELECT TO authenticated USING (public.has_management_access() OR public.is_maitre());
CREATE POLICY "Management can create events" ON public.events FOR INSERT TO authenticated WITH CHECK (public.has_management_access() OR public.is_maitre());
CREATE POLICY "Management can update events" ON public.events FOR UPDATE TO authenticated USING (public.has_management_access() OR public.is_maitre());
CREATE POLICY "Management can delete events" ON public.events FOR DELETE TO authenticated USING (public.has_management_access());

-- FORECASTS
CREATE POLICY "Management can view forecasts" ON public.forecasts FOR SELECT TO authenticated USING (public.has_management_access());
CREATE POLICY "Management can create forecasts" ON public.forecasts FOR INSERT TO authenticated WITH CHECK (public.has_management_access());
CREATE POLICY "Management can update forecasts" ON public.forecasts FOR UPDATE TO authenticated USING (public.has_management_access());
CREATE POLICY "Management can delete forecasts" ON public.forecasts FOR DELETE TO authenticated USING (public.has_management_access());

-- INVENTORY_LOTS
CREATE POLICY "Inventory staff can view lots" ON public.inventory_lots FOR SELECT TO authenticated USING (public.has_management_access() OR public.is_produccion());
CREATE POLICY "Inventory staff can create lots" ON public.inventory_lots FOR INSERT TO authenticated WITH CHECK (public.has_management_access() OR public.is_produccion());
CREATE POLICY "Inventory staff can update lots" ON public.inventory_lots FOR UPDATE TO authenticated USING (public.has_management_access() OR public.is_produccion());
CREATE POLICY "Management can delete lots" ON public.inventory_lots FOR DELETE TO authenticated USING (public.has_management_access());

-- PRODUCTION_TASKS
CREATE POLICY "Task staff can view tasks" ON public.production_tasks FOR SELECT TO authenticated USING (public.has_management_access() OR public.is_produccion() OR assigned_to = auth.uid());
CREATE POLICY "Management can create tasks" ON public.production_tasks FOR INSERT TO authenticated WITH CHECK (public.has_management_access());
CREATE POLICY "Task staff can update tasks" ON public.production_tasks FOR UPDATE TO authenticated USING (public.has_management_access() OR assigned_to = auth.uid());
CREATE POLICY "Management can delete tasks" ON public.production_tasks FOR DELETE TO authenticated USING (public.has_management_access());

-- STAFF_SHIFTS
CREATE POLICY "Shift staff can view shifts" ON public.staff_shifts FOR SELECT TO authenticated USING (public.has_management_access() OR public.is_rrhh() OR user_id = auth.uid());
CREATE POLICY "HR can create shifts" ON public.staff_shifts FOR INSERT TO authenticated WITH CHECK (public.has_management_access() OR public.is_rrhh());
CREATE POLICY "HR can update shifts" ON public.staff_shifts FOR UPDATE TO authenticated USING (public.has_management_access() OR public.is_rrhh());
CREATE POLICY "HR can delete shifts" ON public.staff_shifts FOR DELETE TO authenticated USING (public.has_management_access() OR public.is_rrhh());

-- PURCHASES
CREATE POLICY "Management can view purchases" ON public.purchases FOR SELECT TO authenticated USING (public.has_management_access());
CREATE POLICY "Management can create purchases" ON public.purchases FOR INSERT TO authenticated WITH CHECK (public.has_management_access());
CREATE POLICY "Management can update purchases" ON public.purchases FOR UPDATE TO authenticated USING (public.has_management_access());
CREATE POLICY "Management can delete purchases" ON public.purchases FOR DELETE TO authenticated USING (public.has_management_access());

-- PURCHASE_ITEMS
CREATE POLICY "Management can view purchase items" ON public.purchase_items FOR SELECT TO authenticated USING (public.has_management_access());
CREATE POLICY "Management can create purchase items" ON public.purchase_items FOR INSERT TO authenticated WITH CHECK (public.has_management_access());
CREATE POLICY "Management can update purchase items" ON public.purchase_items FOR UPDATE TO authenticated USING (public.has_management_access());
CREATE POLICY "Management can delete purchase items" ON public.purchase_items FOR DELETE TO authenticated USING (public.has_management_access());

-- =============================================
-- Triggers for updated_at
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_venues_updated_at BEFORE UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_menus_updated_at BEFORE UPDATE ON public.menus FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_forecasts_updated_at BEFORE UPDATE ON public.forecasts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_inventory_lots_updated_at BEFORE UPDATE ON public.inventory_lots FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_production_tasks_updated_at BEFORE UPDATE ON public.production_tasks FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_staff_shifts_updated_at BEFORE UPDATE ON public.staff_shifts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_purchases_updated_at BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- Trigger to create profile on signup
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();