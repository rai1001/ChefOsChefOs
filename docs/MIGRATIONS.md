# Migraciones de Base de Datos - ChefOS

## 📍 Ubicación

Las migraciones se almacenan en:
```
supabase/migrations/
```

> **Nota:** Este directorio es de solo lectura y gestionado automáticamente por Lovable Cloud.

## 🔄 Flujo de Migraciones

### Crear una migración

1. Usar la herramienta de migración de Lovable
2. Escribir SQL con cambios de schema
3. El sistema solicita confirmación del usuario
4. Se ejecuta y aplica automáticamente

### Ejemplo de migración

```sql
-- Crear tabla de eventos
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID REFERENCES public.hotels(id),
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME,
  venue_id UUID REFERENCES public.venues(id),
  menu_id UUID REFERENCES public.menus(id),
  pax INTEGER NOT NULL DEFAULT 0,
  client_name TEXT,
  client_contact TEXT,
  status TEXT DEFAULT 'draft',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Hotel staff can view events"
ON public.events FOR SELECT
USING (
  hotel_id = get_user_hotel_id() 
  AND (has_management_access() OR is_maitre())
);

CREATE POLICY "Hotel management can create events"
ON public.events FOR INSERT
WITH CHECK (
  hotel_id = get_user_hotel_id() 
  AND (has_management_access() OR is_maitre())
);

CREATE POLICY "Hotel management can update events"
ON public.events FOR UPDATE
USING (
  hotel_id = get_user_hotel_id() 
  AND (has_management_access() OR is_maitre())
);

CREATE POLICY "Hotel management can delete events"
ON public.events FOR DELETE
USING (
  hotel_id = get_user_hotel_id() 
  AND has_management_access()
);

-- Trigger para updated_at
CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();
```

## 📋 Historial de Migraciones

### Tablas Core

#### 1. Sistema de Usuarios
```sql
-- profiles: Perfiles de usuario
-- user_roles: Roles asignados
-- hotels: Hoteles del sistema
-- hotel_members: Relación usuario-hotel
-- invitations: Invitaciones de equipo
```

#### 2. Eventos y Menús
```sql
-- events: Eventos y banquetes
-- venues: Salones/espacios
-- menus: Menús disponibles
-- menu_items: Productos en menús
```

#### 3. Productos e Inventario
```sql
-- products: Catálogo de productos
-- product_categories: Categorías
-- units: Unidades de medida
-- suppliers: Proveedores
-- inventory_lots: Lotes de inventario
-- inventory_movements: Movimientos
```

#### 4. Compras
```sql
-- purchases: Órdenes de compra
-- purchase_items: Líneas de pedido
```

#### 5. Personal y Tareas
```sql
-- staff: Personal
-- staff_shifts: Turnos
-- production_tasks: Tareas de producción
```

#### 6. Previsiones
```sql
-- forecasts: Previsiones de ocupación
```

## 🔧 Funciones de Base de Datos

### Funciones de utilidad
```sql
-- Actualizar timestamp automáticamente
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear perfil al registrar usuario
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Funciones de autorización
```sql
-- Obtener hotel actual del usuario
CREATE OR REPLACE FUNCTION get_user_hotel_id()
RETURNS UUID AS $$
  SELECT current_hotel_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Verificar pertenencia a hotel
CREATE OR REPLACE FUNCTION user_belongs_to_hotel(_hotel_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hotel_members
    WHERE user_id = auth.uid() AND hotel_id = _hotel_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Verificar rol específico
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Funciones de rol específicas
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT has_role(auth.uid(), 'admin');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_jefe_cocina() RETURNS BOOLEAN AS $$
  SELECT has_role(auth.uid(), 'jefe_cocina');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_maitre() RETURNS BOOLEAN AS $$
  SELECT has_role(auth.uid(), 'maitre');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_produccion() RETURNS BOOLEAN AS $$
  SELECT has_role(auth.uid(), 'produccion');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_rrhh() RETURNS BOOLEAN AS $$
  SELECT has_role(auth.uid(), 'rrhh');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN AS $$
  SELECT has_role(auth.uid(), 'super_admin');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Acceso de gestión (admin O jefe de cocina)
CREATE OR REPLACE FUNCTION has_management_access() RETURNS BOOLEAN AS $$
  SELECT is_admin() OR is_jefe_cocina();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Es propietario del hotel
CREATE OR REPLACE FUNCTION is_hotel_owner() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hotel_members
    WHERE user_id = auth.uid() 
      AND hotel_id = get_user_hotel_id()
      AND is_owner = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

## 🔐 Patrones de RLS

### Patrón básico por hotel
```sql
-- SELECT: Ver datos del hotel actual
CREATE POLICY "Hotel staff can view [table]"
ON public.[table] FOR SELECT
USING (hotel_id = get_user_hotel_id() AND [role_check]);

-- INSERT: Crear en hotel actual
CREATE POLICY "Hotel management can create [table]"
ON public.[table] FOR INSERT
WITH CHECK (hotel_id = get_user_hotel_id() AND [role_check]);

-- UPDATE: Modificar en hotel actual
CREATE POLICY "Hotel management can update [table]"
ON public.[table] FOR UPDATE
USING (hotel_id = get_user_hotel_id() AND [role_check]);

-- DELETE: Eliminar en hotel actual
CREATE POLICY "Hotel management can delete [table]"
ON public.[table] FOR DELETE
USING (hotel_id = get_user_hotel_id() AND [role_check]);
```

### Patrón para tablas relacionadas
```sql
-- Para menu_items (verificar hotel via menu)
CREATE POLICY "Hotel management can create menu items"
ON public.menu_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM menus m
    WHERE m.id = menu_items.menu_id 
      AND m.hotel_id = get_user_hotel_id()
  ) 
  AND has_management_access()
);
```

## ⚠️ Consideraciones

### Cambios destructivos
Antes de eliminar columnas/tablas:
1. Verificar datos en producción
2. Hacer backup si es necesario
3. Migrar datos antes de eliminar

### Índices recomendados
```sql
-- Índice para búsquedas por hotel
CREATE INDEX idx_events_hotel_date 
ON events(hotel_id, event_date);

-- Índice para productos activos
CREATE INDEX idx_products_hotel_active 
ON products(hotel_id) WHERE is_active = true;
```

### Triggers de auditoría
```sql
-- Aplicar a todas las tablas con updated_at
CREATE TRIGGER update_[table]_updated_at
BEFORE UPDATE ON public.[table]
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();
```

## 🔄 Sincronización de Tipos

Después de cada migración, los tipos TypeScript se regeneran automáticamente en:
```
src/integrations/supabase/types.ts
```

Este archivo es de solo lectura y refleja el schema actual de la base de datos.
