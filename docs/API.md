# API Reference - ChefOS

Este documento describe las APIs disponibles en el sistema.

---

## 📋 Índice

1. [Autenticación](#autenticación)
2. [Supabase Client](#supabase-client)
3. [Edge Functions](#edge-functions)
4. [React Query Hooks](#react-query-hooks)
5. [Tipos y Interfaces](#tipos-e-interfaces)

---

## 🔐 Autenticación

### Headers Requeridos

Todas las peticiones autenticadas requieren:

```http
Authorization: Bearer {jwt_token}
Content-Type: application/json
apikey: {supabase_anon_key}
```

### Obtener Token

```typescript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

---

## 📡 Supabase Client

### Configuración

```typescript
import { supabase } from "@/integrations/supabase/client";
```

### Operaciones CRUD

#### SELECT

```typescript
// Básico
const { data, error } = await supabase
  .from('events')
  .select('*');

// Con relaciones
const { data, error } = await supabase
  .from('events')
  .select(`
    *,
    venue:venues(id, name, capacity),
    menu:menus(id, name)
  `);

// Con filtros
const { data, error } = await supabase
  .from('events')
  .select('*')
  .eq('status', 'confirmed')
  .gte('event_date', '2025-01-01')
  .order('event_date', { ascending: true })
  .limit(10);
```

#### INSERT

```typescript
const { data, error } = await supabase
  .from('events')
  .insert({
    name: 'Boda García',
    event_date: '2025-06-15',
    pax: 150,
    hotel_id: hotelId
  })
  .select()
  .single();
```

#### UPDATE

```typescript
const { data, error } = await supabase
  .from('events')
  .update({ status: 'completed' })
  .eq('id', eventId)
  .select()
  .single();
```

#### DELETE

```typescript
const { error } = await supabase
  .from('events')
  .delete()
  .eq('id', eventId);
```

---

## ⚡ Edge Functions

### Base URL

```
https://sdfqlchgbbtzhmujlthi.supabase.co/functions/v1/
```

### Funciones Disponibles

---

### `ai-assistant`

Asistente de IA conversacional.

**Endpoint**: `POST /ai-assistant`

**Request Body**:
```json
{
  "message": "¿Qué eventos hay mañana?",
  "context": {
    "hotel_id": "uuid",
    "current_date": "2025-02-02T10:00:00Z",
    "module": "events"
  },
  "history": [
    { "role": "user", "content": "Hola" },
    { "role": "assistant", "content": "¡Hola! ¿En qué puedo ayudarte?" }
  ]
}
```

**Response**:
```json
{
  "response": "Mañana tienes 3 eventos programados...",
  "suggestions": [
    "Ver detalle del evento",
    "Generar hoja de producción"
  ]
}
```

**Errores**:
| Código | Descripción |
|--------|-------------|
| 400 | Mensaje vacío o inválido |
| 401 | No autenticado |
| 500 | Error interno |

---

### `parse-menu-image`

OCR de menús impresos con IA.

**Endpoint**: `POST /parse-menu-image`

**Request Body**:
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

**Response**:
```json
{
  "mealType": "lunch",
  "serviceFormat": "buffet",
  "sections": [
    {
      "name": "Entrantes",
      "items": [
        {
          "name": "Ensalada César",
          "description": "Lechuga romana, parmesano, croutons",
          "highlighted": false
        }
      ]
    }
  ],
  "observations": "Opciones sin gluten disponibles"
}
```

---

### `parse-delivery-note`

OCR de albaranes de entrega.

**Endpoint**: `POST /parse-delivery-note`

**Request Body**:
```json
{
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQ...",
  "expectedItems": [
    { "name": "Salmón fresco", "quantity": 10, "unit": "kg" }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "supplier_name": "Distribuciones García",
    "document_number": "ALB-2025-0123",
    "date": "2025-02-01",
    "items": [
      { "name": "Salmón fresco", "quantity": 10, "unit": "kg" }
    ]
  },
  "reconciliation": {
    "matched": [],
    "missing": [],
    "unexpected": [],
    "has_issues": false
  }
}
```

---

### `send-invitation-email`

Envío de invitaciones por email.

**Endpoint**: `POST /send-invitation-email`

**Request Body**:
```json
{
  "email": "nuevo@ejemplo.com",
  "hotelName": "Hotel Costa Brava",
  "invitedBy": "Juan García",
  "role": "produccion",
  "invitationUrl": "https://app.chefos.com/accept?token=xxx"
}
```

**Response**:
```json
{
  "success": true,
  "messageId": "abc123"
}
```

---

### `generate-purchase-suggestions`

Motor determinista para sugerencias de compra.

**Endpoint**: `POST /generate-purchase-suggestions`

**Request Body**:
```json
{
  "signals": [
    {
      "product_id": "uuid",
      "product_name": "Tomate",
      "forecast_qty": 12,
      "event_qty": 4,
      "menu_qty": 8,
      "current_qty": 5,
      "safety_stock_qty": 2,
      "lead_time_days": 1,
      "daily_demand_rate": 2.5,
      "pack_size": 1
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "suggestions": [
    {
      "product_id": "uuid",
      "product_name": "Tomate",
      "required_qty": 21.5,
      "current_qty": 5,
      "recommended_qty": 22,
      "reason": "Demanda 26.50 y stock 5.00"
    }
  ]
}
```

---

### `daily-ops-briefing`

Briefing diario determinista (texto). Se usa para la versión no-IA y como fallback.

**Endpoint**: `POST /daily-ops-briefing`

**Request Body**:
```json
{
  "date": "2026-02-08",
  "plannedTaskCount": 18,
  "unplannedTaskCount": 3,
  "eventsCount": 4
}
```

**Response**:
```json
{
  "success": true,
  "briefing": "Plan diario 2026-02-08:\n- Tareas planificadas: 18\n- Tareas sin capacidad: 3\n- Eventos del día: 4\n- Recomendación: reasignar personal en los turnos críticos."
}
```

---

### `send-ops-alert`

Envía alertas operativas por suscripción (email). Si falta `RESEND_API_KEY`, devuelve envío en modo `dry_run`.

**Endpoint**: `POST /send-ops-alert`

**Response**:
```json
{
  "success": true,
  "sent": [
    {
      "email": "chef@hotel.com",
      "hotel_id": "uuid",
      "frequency": "daily",
      "dry_run": false
    }
  ]
}
```

---

### `agent-bridge` (clawtbot / agentes firmados)

Puente de conexión para agentes externos con firma Ed25519.  
`verify_jwt = false` en esta función porque se autentica con firma y replay-guard.

**Endpoint base**: `POST|GET /agent-bridge/*`

**Headers requeridos**:
```http
x-agent-id: clawtbot-prod
x-agent-ts: 1739013902
x-agent-nonce: 3f7c1a48-0d25-48f0-99d2-9eb6fef83f8f
x-agent-signature: base64_signature
Content-Type: application/json
```

**Cadena canónica a firmar**:
```text
{METHOD_UPPER}
{PATH}
{QUERY_SORTED}
{SHA256_HEX_BODY}
{TIMESTAMP_SECONDS}
{NONCE}
{AGENT_ID}
```

**Scopes soportados**:
- `GET /agent-bridge/events` → `read:events`
- `GET /agent-bridge/tasks` → `read:tasks`
- `POST /agent-bridge/tasks/complete` → `write:tasks`
- `GET /agent-bridge/inventory` → `read:inventory`

---

### Llamar Edge Functions desde React

```typescript
// Usando supabase.functions.invoke
const { data, error } = await supabase.functions.invoke('ai-assistant', {
  body: {
    message: 'Hola',
    context: { hotel_id: hotelId }
  }
});

// El token JWT se incluye automáticamente
```

---

## 🎣 React Query Hooks

### Eventos

```typescript
// Listar eventos
const { data: events, isLoading } = useEvents({
  startDate: '2025-01-01',
  endDate: '2025-12-31'
});

// Crear evento
const createEvent = useCreateEvent();
await createEvent.mutateAsync({
  name: 'Nuevo Evento',
  event_date: '2025-03-15',
  pax: 100
});

// Actualizar evento
const updateEvent = useUpdateEvent();
await updateEvent.mutateAsync({
  id: 'event-id',
  status: 'confirmed'
});

// Eliminar evento
const deleteEvent = useDeleteEvent();
await deleteEvent.mutateAsync('event-id');

// Importación masiva
const bulkInsert = useBulkInsertEvents();
await bulkInsert.mutateAsync(eventsArray);
```

### Menús

```typescript
// Listar menús con items
const { data: menus } = useMenusWithItems();

// Crear menú
const createMenu = useCreateMenu();
await createMenu.mutateAsync({
  menu: { name: 'Menú Primavera', type: 'lunch' },
  items: [
    { product_id: 'prod-1', quantity_per_pax: 0.2 }
  ]
});

// Duplicar menú
const duplicateMenu = useDuplicateMenu();
await duplicateMenu.mutateAsync('menu-id');

// Añadir ingrediente
const addItem = useAddMenuItem();
await addItem.mutateAsync({
  menu_id: 'menu-id',
  product_id: 'product-id',
  quantity_per_pax: 0.15
});
```

### Inventario

```typescript
// Listar lotes
const { data: lots } = useInventoryLots();

// Lotes próximos a caducar
const { data: expiring } = useExpiringLots(7); // 7 días

// Estadísticas
const { data: stats } = useInventoryStats();
// { totalLots, criticalCount, expiringCount, uniqueLocations }

// Crear lote
const createLot = useCreateInventoryLot();
await createLot.mutateAsync({
  product_id: 'prod-id',
  quantity: 50,
  expiry_date: '2025-03-01',
  lot_number: 'LOT-2025-001'
});
```

### Compras

```typescript
// Listar compras
const { data: purchases } = usePurchases({ status: 'ordered' });

// Detalle de compra
const { data: purchase } = usePurchase('purchase-id');

// Entregas pendientes
const { data: pending } = usePendingDeliveries();
// { late, today, upcoming, all }

// Crear pedido
const createPurchase = useCreatePurchase();
await createPurchase.mutateAsync({
  supplier_id: 'supplier-id',
  expected_date: '2025-02-05'
});

// Recibir pedido
const receivePurchase = useReceivePurchase();
await receivePurchase.mutateAsync({
  id: 'purchase-id',
  is_complete: true
});
```

### Tareas

```typescript
// Listar tareas
const { data: tasks } = useTasks({
  startDate: '2025-02-01',
  shift: 'M',
  status: 'pending'
});

// Estadísticas
const { data: stats } = useTaskStats();
// { pendingCount, inProgressCount, completedTodayCount }

// Iniciar tarea
const startTask = useStartTask();
await startTask.mutateAsync('task-id');

// Completar tarea
const completeTask = useCompleteTask();
await completeTask.mutateAsync({
  id: 'task-id',
  started_at: '2025-02-02T10:00:00Z'
});
```

### Previsiones

```typescript
// Listar previsiones
const { data: forecasts } = useForecasts({
  startDate: '2025-02-01',
  endDate: '2025-02-14'
});

// Próximos días
const { data: upcoming } = useUpcomingForecasts(7);

// Importar (reemplaza existentes)
const bulkUpsert = useBulkUpsertForecasts();
await bulkUpsert.mutateAsync(forecastsArray);
```

### Operación Avanzada (R1-R4)

```typescript
// Flags por hotel (IA OFF por defecto)
const { data: flags } = useFeatureFlags();
const setFlag = useSetFeatureFlag();
await setFlag.mutateAsync({ key: "ai_daily_briefing", enabled: false });

// Suscripciones de alertas operativas
const { data: subscriptions } = useAlertSubscriptions();
const upsertSubscription = useUpsertAlertSubscription();
await upsertSubscription.mutateAsync({ frequency: "daily", enabled: true, sendAt: "07:00" });

// Conexiones de agentes (clawtbot)
const { data: connections } = useAgentConnections();
const createConnection = useCreateAgentConnection();
await createConnection.mutateAsync({
  agent_name: "Clawtbot",
  agent_id: "clawtbot-prod",
  public_key: "base64_raw_ed25519_public_key",
  allowed_scopes: ["read:events", "read:tasks", "write:tasks", "read:inventory"],
});

// Bandeja de aprobaciones
const { data: pendingApprovals } = useApprovals("pending");
const resolveApproval = useResolveApproval();
await resolveApproval.mutateAsync({ id: "approval-id", status: "approved", note: "OK" });

// Versionado de menús
const { data: versions } = useMenuVersions(menuId);
const snapshotMenu = useCreateMenuVersion();
await snapshotMenu.mutateAsync(menuId);

// Mermas de inventario
const createWaste = useCreateInventoryWaste();
await createWaste.mutateAsync({
  product_id: "prod-id",
  qty: 2.5,
  cause: "expired",
  note: "Caducidad lote cámara 2",
});

// Desviación de coste evento
const { data: eventVariance } = useEventCostVariance({ startDate: "2026-02-01", endDate: "2026-02-29" });

// Sugerencias de compra (deterministas)
const { data: suggestionsBySupplier } = usePurchaseSuggestions();

// Plan diario determinista con briefing opcional
const { data: dailyPlan } = useDailyPlan("2026-02-08");
```

---

## 📝 Tipos e Interfaces

### Eventos

```typescript
interface Event {
  id: string;
  name: string;
  event_date: string;
  event_time: string | null;
  venue_id: string | null;
  menu_id: string | null;
  pax: number;
  client_name: string | null;
  client_contact: string | null;
  status: string | null;
  notes: string | null;
  hotel_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface EventWithRelations extends Event {
  venue?: { id: string; name: string; capacity: number | null } | null;
  menu?: { id: string; name: string } | null;
}
```

### Menús

```typescript
interface Menu {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  cost_per_pax: number | null;
  is_active: boolean | null;
  hotel_id: string | null;
  created_at: string;
  updated_at: string;
}

interface MenuItem {
  id: string;
  menu_id: string;
  product_id: string;
  quantity_per_pax: number;
  preparation_notes: string | null;
  product?: {
    id: string;
    name: string;
    cost_price: number | null;
    unit?: { abbreviation: string } | null;
  };
}

interface MenuWithItems extends Menu {
  menu_items: MenuItem[];
}
```

### Inventario

```typescript
interface InventoryLot {
  id: string;
  product_id: string;
  quantity: number;
  lot_number: string | null;
  expiry_date: string | null;
  entry_date: string;
  location: string | null;
  cost_per_unit: number | null;
  supplier_id: string | null;
  barcode: string | null;
  hotel_id: string | null;
  created_at: string;
  updated_at: string;
}
```

### Compras

```typescript
interface Purchase {
  id: string;
  supplier_id: string;
  order_date: string;
  expected_date: string | null;
  status: 'draft' | 'pending' | 'ordered' | 'received';
  total_amount: number | null;
  received_at: string | null;
  delivery_status: string | null;
  is_complete: boolean | null;
  delivery_issues: string | null;
  hotel_id: string | null;
}

interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  unit_price: number | null;
  received_quantity: number | null;
}
```

### Tareas

```typescript
interface ProductionTask {
  id: string;
  title: string;
  description: string | null;
  task_date: string;
  shift: 'M' | 'T' | 'N';
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  assigned_to: string | null;
  event_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  hotel_id: string | null;
}
```

### Roles

```typescript
type AppRole = 
  | 'super_admin'
  | 'admin'
  | 'jefe_cocina'
  | 'maitre'
  | 'produccion'
  | 'rrhh';
```

---

## 🔄 Códigos de Estado

| Código | Significado |
|--------|-------------|
| 200 | Éxito |
| 201 | Creado |
| 400 | Error de validación |
| 401 | No autenticado |
| 403 | Sin permisos (RLS) |
| 404 | No encontrado |
| 409 | Conflicto (duplicado) |
| 500 | Error interno |

---

## 📚 Ejemplos de Uso

### Flujo Completo: Crear Evento con Menú

```typescript
// 1. Crear menú
const { mutateAsync: createMenu } = useCreateMenu();
const menu = await createMenu({
  menu: { name: 'Menú Boda', type: 'dinner' },
  items: [
    { product_id: 'salmon-id', quantity_per_pax: 0.2 },
    { product_id: 'patatas-id', quantity_per_pax: 0.15 }
  ]
});

// 2. Crear evento con menú asignado
const { mutateAsync: createEvent } = useCreateEvent();
const event = await createEvent({
  name: 'Boda García-López',
  event_date: '2025-06-15',
  pax: 150,
  menu_id: menu.id,
  venue_id: 'salon-principal-id'
});

// 3. Generar tareas de producción
const { mutateAsync: createTask } = useCreateTask();
await createTask({
  title: 'Preparar entrantes boda',
  task_date: '2025-06-15',
  shift: 'M',
  event_id: event.id,
  priority: 'high'
});
```
