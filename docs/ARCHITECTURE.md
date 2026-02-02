# Arquitectura de ChefOS

## 🏛️ Visión General

ChefOS sigue una arquitectura moderna de aplicación web con separación clara entre frontend y backend:

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                        │
├─────────────────────────────────────────────────────────────┤
│  Pages → Components → Hooks → Supabase Client              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   LOVABLE CLOUD (Supabase)                   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Auth       │  │   Database   │  │  Edge Functions  │  │
│  │   (JWT)      │  │  (PostgreSQL)│  │     (Deno)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                              │                               │
│                              ▼                               │
│                    Row Level Security (RLS)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVICIOS EXTERNOS                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │   Resend (Email) │  │   Lovable AI Gateway (Gemini)   │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 📂 Estructura de Carpetas

### `/src/pages/`
Componentes de página correspondientes a rutas:

| Archivo | Ruta | Descripción |
|---------|------|-------------|
| `Index.tsx` | `/` | Dashboard principal |
| `Events.tsx` | `/events` | Gestión de eventos |
| `Menus.tsx` | `/menus` | Menús y recetas |
| `Inventory.tsx` | `/inventory` | Control de inventario |
| `Purchases.tsx` | `/purchases` | Órdenes de compra |
| `Products.tsx` | `/products` | Catálogo de productos |
| `Suppliers.tsx` | `/suppliers` | Proveedores |
| `Forecast.tsx` | `/forecast` | Previsiones |
| `Staff.tsx` | `/staff` | Personal |
| `Shifts.tsx` | `/shifts` | Turnos |
| `Tasks.tsx` | `/tasks` | Tareas de producción |
| `Settings.tsx` | `/settings` | Configuración |
| `Auth.tsx` | `/auth` | Login/Registro |
| `SuperAdmin.tsx` | `/super-admin` | Panel super admin |

### `/src/hooks/`
Custom hooks para lógica de negocio:

| Hook | Propósito |
|------|-----------|
| `useAuth` | Autenticación y sesión |
| `useCurrentHotel` | Hotel activo del usuario |
| `useEvents` | CRUD de eventos |
| `useMenus` | CRUD de menús |
| `useProducts` | CRUD de productos |
| `useInventory` | Gestión de inventario |
| `usePurchases` | Órdenes de compra |
| `useSuppliers` | Proveedores |
| `useForecasts` | Previsiones |
| `useStaff` | Personal |
| `useTasks` | Tareas |
| `useAIAssistant` | Integración IA |
| `useSuperAdmin` | Funciones super admin |

### `/src/components/`
Componentes React organizados por dominio:

```
components/
├── ai/                 # Chat IA, sugerencias
├── auth/               # ProtectedRoute
├── dashboard/          # Cards, stats, actividad
├── events/             # EventCard, Calendar
├── forecast/           # ForecastCard
├── import/             # XLSX, OCR importers
├── inventory/          # BarcodeScanner, DeliveryNote
├── layout/             # Header, Sidebar, MainLayout
├── menus/              # RecipeCard, dialogs
├── purchases/          # ReceiveDialog
├── settings/           # HotelSelector, TeamManagement
└── ui/                 # shadcn/ui components
```

## 🔄 Flujo de Datos

### Patrón de Consultas (React Query)

```typescript
// Hook típico
export function useEvents(options?: { startDate?: string }) {
  return useQuery({
    queryKey: ["events", options?.startDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(`*, venue:venues(*), menu:menus(*)`)
        .order("event_date");
      
      if (error) throw error;
      return data;
    },
  });
}
```

### Patrón de Mutaciones

```typescript
export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (event: EventInsert) => {
      const { data, error } = await supabase
        .from("events")
        .insert(event)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({ title: "Evento creado" });
    },
  });
}
```

## 🔐 Seguridad

### Autenticación
- JWT tokens manejados por Supabase Auth
- Sesión persistida en localStorage
- Refresh automático de tokens

### Autorización
- **RLS (Row Level Security)** en todas las tablas
- Funciones de base de datos para verificar roles:
  - `is_admin()`
  - `is_jefe_cocina()`
  - `is_maitre()`
  - `is_produccion()`
  - `is_rrhh()`
  - `is_super_admin()`
  - `has_management_access()`
  - `user_belongs_to_hotel(hotel_id)`

### Multi-tenancy
- Todas las tablas tienen `hotel_id`
- RLS policies verifican `hotel_id = get_user_hotel_id()`
- Aislamiento completo de datos entre hoteles

## 🎨 Sistema de Diseño

### Tokens CSS
Definidos en `src/index.css`:
- Colores semánticos (background, foreground, primary, etc.)
- Soporta modo claro/oscuro
- Variables HSL para flexibilidad

### Componentes UI
- Basados en shadcn/ui
- Personalizados con Tailwind
- Accesibles (ARIA)

## ⚡ Optimizaciones

1. **React Query** - Cache inteligente y refetch automático
2. **Code splitting** - Lazy loading de páginas
3. **Parallel queries** - Consultas concurrentes
4. **Optimistic updates** - UI inmediata en mutaciones
