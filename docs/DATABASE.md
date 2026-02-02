# Base de Datos - ChefOS

## 📊 Diagrama de Entidades

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   hotels     │────<│hotel_members │>────│   profiles   │
└──────────────┘     └──────────────┘     └──────────────┘
       │                                         │
       │                                         │
       ▼                                         ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    events    │────>│    menus     │     │  user_roles  │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │
       │                    │
       ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    venues    │     │  menu_items  │────>│   products   │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
       ┌─────────────────────────────────────────┤
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  suppliers   │     │    units     │     │ categories   │
└──────────────┘     └──────────────┘     └──────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│  purchases   │────<│purchase_items│
└──────────────┘     └──────────────┘

┌──────────────┐     ┌──────────────┐
│inventory_lots│     │inv_movements │
└──────────────┘     └──────────────┘

┌──────────────┐     ┌──────────────┐
│    staff     │     │ staff_shifts │
└──────────────┘     └──────────────┘

┌──────────────┐     ┌──────────────┐
│  forecasts   │     │production_   │
│              │     │   tasks      │
└──────────────┘     └──────────────┘
```

## 📋 Tablas

### `hotels`
Hoteles/establecimientos del sistema.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| name | text | Nombre del hotel |
| slug | text | Identificador URL |
| address | text | Dirección |
| phone | text | Teléfono |
| email | text | Email |
| website | text | Web |
| logo_url | text | Logo |
| is_active | boolean | Activo |
| created_by | uuid | Usuario creador |
| created_at | timestamptz | Fecha creación |
| updated_at | timestamptz | Última actualización |

### `profiles`
Perfiles de usuario (extensión de auth.users).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK (= auth.uid) |
| email | text | Email |
| full_name | text | Nombre completo |
| avatar_url | text | Avatar |
| current_hotel_id | uuid | Hotel activo |
| created_at | timestamptz | Fecha creación |
| updated_at | timestamptz | Última actualización |

### `hotel_members`
Relación usuarios-hoteles.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| hotel_id | uuid | FK → hotels |
| user_id | uuid | FK → profiles |
| is_owner | boolean | Es propietario |
| created_at | timestamptz | Fecha creación |

### `user_roles`
Roles de usuario en el sistema.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK → profiles |
| role | app_role | Enum de rol |
| created_at | timestamptz | Fecha creación |

**Enum `app_role`:**
- `super_admin`
- `admin`
- `jefe_cocina`
- `maitre`
- `produccion`
- `rrhh`

### `events`
Eventos (bodas, banquetes, etc.).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| hotel_id | uuid | FK → hotels |
| name | text | Nombre del evento |
| event_date | date | Fecha |
| event_time | time | Hora |
| venue_id | uuid | FK → venues |
| menu_id | uuid | FK → menus |
| pax | integer | Número de comensales |
| client_name | text | Cliente |
| client_contact | text | Contacto |
| status | text | Estado (draft, confirmed) |
| notes | text | Notas |
| created_by | uuid | Creador |
| created_at | timestamptz | Fecha creación |
| updated_at | timestamptz | Última actualización |

### `venues`
Salones/espacios.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| hotel_id | uuid | FK → hotels |
| name | text | Nombre |
| capacity | integer | Capacidad |
| location | text | Ubicación |
| notes | text | Notas |
| created_at | timestamptz | Fecha creación |
| updated_at | timestamptz | Última actualización |

### `menus`
Menús disponibles.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| hotel_id | uuid | FK → hotels |
| name | text | Nombre |
| type | text | Tipo (buffet, servido) |
| description | text | Descripción |
| cost_per_pax | numeric | Coste por persona |
| is_active | boolean | Activo |
| created_by | uuid | Creador |
| created_at | timestamptz | Fecha creación |
| updated_at | timestamptz | Última actualización |

### `menu_items`
Productos en un menú.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| menu_id | uuid | FK → menus |
| product_id | uuid | FK → products |
| quantity_per_pax | numeric | Cantidad por persona |
| preparation_notes | text | Notas de preparación |
| created_at | timestamptz | Fecha creación |

### `products`
Catálogo de productos.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| hotel_id | uuid | FK → hotels |
| name | text | Nombre |
| category_id | uuid | FK → product_categories |
| unit_id | uuid | FK → units |
| supplier_id | uuid | FK → suppliers |
| cost_price | numeric | Precio coste |
| current_stock | numeric | Stock actual |
| min_stock | numeric | Stock mínimo |
| allergens | text[] | Alérgenos |
| notes | text | Notas |
| is_active | boolean | Activo |
| created_at | timestamptz | Fecha creación |
| updated_at | timestamptz | Última actualización |

### `product_categories`
Categorías de productos.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| hotel_id | uuid | FK → hotels |
| name | text | Nombre |
| description | text | Descripción |
| created_at | timestamptz | Fecha creación |

### `units`
Unidades de medida.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| hotel_id | uuid | FK → hotels |
| name | text | Nombre (kilogramo) |
| abbreviation | text | Abreviatura (kg) |
| created_at | timestamptz | Fecha creación |

### `suppliers`
Proveedores.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| hotel_id | uuid | FK → hotels |
| name | text | Nombre |
| contact_person | text | Persona de contacto |
| email | text | Email |
| phone | text | Teléfono |
| address | text | Dirección |
| delivery_days | text[] | Días de entrega |
| delivery_lead_days | integer | Días de anticipación |
| notes | text | Notas |
| is_active | boolean | Activo |
| created_at | timestamptz | Fecha creación |
| updated_at | timestamptz | Última actualización |

### `purchases`
Órdenes de compra.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| hotel_id | uuid | FK → hotels |
| supplier_id | uuid | FK → suppliers |
| order_date | date | Fecha pedido |
| expected_date | date | Fecha entrega esperada |
| status | text | Estado |
| delivery_status | text | Estado entrega |
| delivery_note_url | text | URL albarán |
| total_amount | numeric | Importe total |
| notes | text | Notas |
| received_at | timestamptz | Fecha recepción |
| delivery_issues | text | Incidencias |
| is_complete | boolean | Completo |
| created_by | uuid | Creador |
| created_at | timestamptz | Fecha creación |
| updated_at | timestamptz | Última actualización |

### `purchase_items`
Líneas de pedido.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| purchase_id | uuid | FK → purchases |
| product_id | uuid | FK → products |
| quantity | numeric | Cantidad pedida |
| received_quantity | numeric | Cantidad recibida |
| unit_price | numeric | Precio unitario |
| created_at | timestamptz | Fecha creación |

### `inventory_lots`
Lotes de inventario.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| hotel_id | uuid | FK → hotels |
| product_id | uuid | FK → products |
| supplier_id | uuid | FK → suppliers |
| quantity | numeric | Cantidad |
| entry_date | date | Fecha entrada |
| expiry_date | date | Fecha caducidad |
| lot_number | text | Número de lote |
| barcode | text | Código de barras |
| location | text | Ubicación |
| cost_per_unit | numeric | Coste unitario |
| movement_type | text | Tipo movimiento |
| reference_document | text | Documento referencia |
| notes | text | Notas |
| created_by | uuid | Creador |
| created_at | timestamptz | Fecha creación |
| updated_at | timestamptz | Última actualización |

### `inventory_movements`
Movimientos de inventario.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| hotel_id | uuid | FK → hotels |
| product_id | uuid | FK → products |
| lot_id | uuid | FK → inventory_lots |
| movement_type | text | Tipo (entry, exit, adjustment) |
| quantity | numeric | Cantidad |
| barcode | text | Código barras |
| reference_document | text | Documento referencia |
| notes | text | Notas |
| created_by | uuid | Creador |
| created_at | timestamptz | Fecha creación |

### `forecasts`
Previsiones de ocupación.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| hotel_id | uuid | FK → hotels |
| forecast_date | date | Fecha |
| hotel_occupancy | integer | Ocupación hotel |
| predicted_occupancy | integer | Ocupación prevista |
| breakfast_pax | integer | Pax desayunos |
| half_board_pax | integer | Pax media pensión |
| full_board_pax | integer | Pax pensión completa |
| extras_pax | integer | Pax extras |
| notes | text | Notas |
| created_by | uuid | Creador |
| created_at | timestamptz | Fecha creación |
| updated_at | timestamptz | Última actualización |

### `staff`
Personal del hotel.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| hotel_id | uuid | FK → hotels |
| user_id | uuid | FK → profiles (opcional) |
| full_name | text | Nombre completo |
| email | text | Email |
| phone | text | Teléfono |
| role | text | Puesto |
| status | text | Estado (active, inactive) |
| notes | text | Notas |
| created_at | timestamptz | Fecha creación |
| updated_at | timestamptz | Última actualización |

### `staff_shifts`
Turnos de personal.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| hotel_id | uuid | FK → hotels |
| user_id | uuid | FK → profiles |
| shift_date | date | Fecha |
| shift_type | text | Tipo turno |
| start_time | time | Hora inicio |
| end_time | time | Hora fin |
| notes | text | Notas |
| created_by | uuid | Creador |
| created_at | timestamptz | Fecha creación |
| updated_at | timestamptz | Última actualización |

### `production_tasks`
Tareas de producción.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| hotel_id | uuid | FK → hotels |
| event_id | uuid | FK → events |
| title | text | Título |
| description | text | Descripción |
| task_date | date | Fecha |
| shift | text | Turno |
| priority | text | Prioridad |
| status | text | Estado |
| assigned_to | uuid | Asignado a |
| started_at | timestamptz | Inicio |
| completed_at | timestamptz | Fin |
| duration_seconds | integer | Duración |
| created_by | uuid | Creador |
| created_at | timestamptz | Fecha creación |
| updated_at | timestamptz | Última actualización |

### `invitations`
Invitaciones de equipo.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | PK |
| hotel_id | uuid | FK → hotels |
| email | text | Email invitado |
| role | app_role | Rol asignado |
| token | text | Token único |
| expires_at | timestamptz | Expiración |
| invited_by | uuid | Invitador |
| accepted_at | timestamptz | Fecha aceptación |
| created_at | timestamptz | Fecha creación |

## 🔐 Row Level Security (RLS)

Todas las tablas tienen RLS habilitado. Ejemplos de políticas:

```sql
-- Ver eventos del hotel actual
CREATE POLICY "Hotel staff can view events"
ON events FOR SELECT
USING (
  hotel_id = get_user_hotel_id() 
  AND (has_management_access() OR is_maitre())
);

-- Crear eventos (management o maitre)
CREATE POLICY "Hotel management can create events"
ON events FOR INSERT
WITH CHECK (
  hotel_id = get_user_hotel_id() 
  AND (has_management_access() OR is_maitre())
);
```

## 🔧 Funciones de Base de Datos

```sql
-- Obtener hotel del usuario actual
get_user_hotel_id() → uuid

-- Verificar pertenencia a hotel
user_belongs_to_hotel(_hotel_id uuid) → boolean

-- Verificar roles
is_admin() → boolean
is_jefe_cocina() → boolean
is_maitre() → boolean
is_produccion() → boolean
is_rrhh() → boolean
is_super_admin() → boolean
has_management_access() → boolean  -- admin OR jefe_cocina
is_hotel_owner() → boolean
has_role(_user_id uuid, _role app_role) → boolean
```

## 🔄 Triggers

```sql
-- Actualizar updated_at automáticamente
CREATE TRIGGER handle_updated_at
BEFORE UPDATE ON [table]
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();

-- Crear perfil al registrar usuario
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();
```
