# Lógica de Negocio - ChefOS

Este documento describe las reglas de negocio, flujos operativos y procesos automatizados del sistema.

---

## 📋 Índice

1. [Multi-tenancy y Aislamiento de Datos](#multi-tenancy-y-aislamiento-de-datos)
2. [Sistema de Roles y Permisos](#sistema-de-roles-y-permisos)
3. [Gestión de Eventos](#gestión-de-eventos)
4. [Menús y Escandallos](#menús-y-escandallos)
5. [Inventario y Lotes](#inventario-y-lotes)
6. [Ciclo de Compras](#ciclo-de-compras)
7. [Previsiones y Forecast](#previsiones-y-forecast)
8. [Tareas de Producción](#tareas-de-producción)
9. [Invitaciones y Onboarding](#invitaciones-y-onboarding)
10. [Integraciones IA](#integraciones-ia)
11. [Backlog R1-R4 (2026-02-08)](#backlog-r1-r4-2026-02-08)

---

## 🏨 Multi-tenancy y Aislamiento de Datos

### Arquitectura

ChefOS implementa un modelo **multi-tenant** donde cada hotel opera de forma independiente:

```
┌─────────────────────────────────────────────────────┐
│                    ChefOS SaaS                      │
├─────────────────────────────────────────────────────┤
│  Hotel A          │  Hotel B          │  Hotel C   │
│  ─────────        │  ─────────        │  ─────────  │
│  • Usuarios       │  • Usuarios       │  • Usuarios │
│  • Eventos        │  • Eventos        │  • Eventos  │
│  • Productos      │  • Productos      │  • Productos│
│  • Inventario     │  • Inventario     │  • Inventario│
│  • Proveedores    │  • Proveedores    │  • Proveedores│
└─────────────────────────────────────────────────────┘
```

### Reglas de Aislamiento

1. **hotel_id obligatorio**: Toda tabla con datos operativos incluye `hotel_id`
2. **RLS automático**: Las políticas de Row Level Security filtran por `get_user_hotel_id()`
3. **Hotel activo**: El usuario tiene un `current_hotel_id` en su perfil
4. **Sin visibilidad cruzada**: Un usuario solo ve datos de su hotel activo

### Cambio de Hotel Activo

```typescript
// Hook useCurrentHotel
const hotelId = useCurrentHotelId();

// Al cambiar hotel, se actualiza el perfil
await supabase
  .from('profiles')
  .update({ current_hotel_id: newHotelId })
  .eq('id', userId);
```

---

## 👥 Sistema de Roles y Permisos

### Roles Disponibles

| Rol | Descripción | Permisos Clave |
|-----|-------------|----------------|
| `super_admin` | Administrador global | Acceso a todos los hoteles, gestión global |
| `admin` | Administrador de hotel | CRUD completo, invitaciones, configuración |
| `jefe_cocina` | Jefe de cocina | Gestión de menús, tareas, inventario |
| `maitre` | Maître | Eventos, salones, clientes |
| `produccion` | Personal de producción | Tareas, inventario limitado |
| `rrhh` | Recursos humanos | Personal, turnos |

### Verificación de Permisos

```typescript
// En componentes React
const { hasRole, hasManagementAccess } = useAuth();

// Acceso a gestión (admin o jefe_cocina)
if (hasManagementAccess()) {
  // Mostrar opciones de gestión
}

// Rol específico
if (hasRole('maitre')) {
  // Mostrar gestión de eventos
}
```

### Funciones de Base de Datos

```sql
-- Verificar rol específico
SELECT public.has_role(auth.uid(), 'admin');

-- Verificar acceso de gestión
SELECT public.has_management_access();

-- Verificar propiedad del hotel
SELECT public.is_hotel_owner();
```

---

## 📅 Gestión de Eventos

### Ciclo de Vida del Evento

```
┌──────────┐    ┌──────────┐    ┌───────────┐    ┌───────────┐
│ Creación │ -> │ Asignado │ -> │ Preparado │ -> │ Realizado │
│          │    │  (menú)  │    │           │    │           │
└──────────┘    └──────────┘    └───────────┘    └───────────┘
```

### Reglas de Negocio

1. **Importación masiva (XLSX)**:
   - Reemplaza eventos importados previamente (`created_by IS NULL`)
   - Mantiene eventos creados manualmente
   - Detecta formato de fecha y hora automáticamente

2. **Asignación de menú**:
   - Un evento puede tener un menú de BD o descripción OCR
   - El menú determina los ingredientes necesarios

3. **Cálculo de PAX**:
   - El campo `pax` define el número de comensales
   - Se usa para escalar ingredientes en hojas de producción

### Importación desde Excel

```typescript
// useBulkInsertEvents
const eventsWithHotel = events.map(e => ({
  ...e,
  hotel_id: hotelId,
  created_by: null // Marca como importado
}));

// Borra solo eventos importados previamente
await supabase
  .from("events")
  .delete()
  .eq("hotel_id", hotelId)
  .is("created_by", null);

// Inserta nuevos eventos
await supabase
  .from("events")
  .insert(eventsWithHotel);
```

---

## 🍽️ Menús y Escandallos

### Estructura de un Menú

```
Menú (menus)
├── Información general
│   ├── name
│   ├── description
│   ├── type (breakfast, lunch, dinner)
│   └── cost_per_pax (calculado)
└── Ingredientes (menu_items)
    ├── product_id → products
    ├── quantity_per_pax
    └── preparation_notes
```

### Cálculo de Coste por PAX

El coste se recalcula automáticamente al modificar ingredientes:

```typescript
async function updateMenuCost(menuId: string) {
  const { data: items } = await supabase
    .from("menu_items")
    .select(`quantity_per_pax, product:products(cost_price)`)
    .eq("menu_id", menuId);

  const totalCost = items.reduce((sum, item) => {
    const productCost = item.product?.cost_price || 0;
    return sum + (productCost * item.quantity_per_pax);
  }, 0);

  await supabase
    .from("menus")
    .update({ cost_per_pax: totalCost })
    .eq("id", menuId);
}
```

### Flujo de Escandallo

1. **Crear menú** → Definir nombre y tipo
2. **Añadir ingredientes** → Seleccionar productos con cantidad por PAX
3. **Coste automático** → Sistema calcula `cost_per_pax`
4. **Hoja de producción** → Escalar por número de comensales

### Hoja de Producción

```
Evento: Boda García (150 PAX)
Menú: Menú Primavera

┌─────────────────┬──────────┬──────────┬───────────┐
│ Ingrediente     │ Por PAX  │ Total    │ Notas     │
├─────────────────┼──────────┼──────────┼───────────┤
│ Salmón fresco   │ 0.2 kg   │ 30 kg    │ Corte fino│
│ Patatas         │ 0.15 kg  │ 22.5 kg  │           │
│ Limones         │ 0.5 ud   │ 75 ud    │           │
└─────────────────┴──────────┴──────────┴───────────┘
```

### Duplicación de Menús

```typescript
// useDuplicateMenu - Crea copia completa con ingredientes
const newMenu = {
  name: `${original.name} (copia)`,
  description: original.description,
  // ... resto de campos
};

// Duplicar también los items
const newItems = originalItems.map(item => ({
  menu_id: newMenu.id,
  product_id: item.product_id,
  quantity_per_pax: item.quantity_per_pax,
}));
```

---

## 📦 Inventario y Lotes

### Modelo de Lotes

Cada lote representa una entrada de mercancía:

```
inventory_lots
├── product_id      → Qué producto
├── quantity        → Cantidad actual
├── expiry_date     → Fecha de caducidad
├── entry_date      → Cuándo entró
├── lot_number      → Identificador del lote
├── location        → Ubicación física
├── cost_per_unit   → Coste unitario
└── supplier_id     → Proveedor origen
```

### Alertas de Caducidad

El sistema categoriza lotes según proximidad a caducidad:

```typescript
// useInventoryStats
const criticalCount = lots.filter(l => 
  l.expiry_date && l.expiry_date <= threeDaysLater  // ≤3 días
).length;

const expiringCount = lots.filter(l => 
  l.expiry_date && 
  l.expiry_date > threeDaysLater && 
  l.expiry_date <= sevenDaysLater  // 4-7 días
).length;
```

### Niveles de Alerta

| Nivel | Días hasta caducidad | Color |
|-------|---------------------|-------|
| Crítico | ≤ 3 días | Rojo |
| Advertencia | 4-7 días | Naranja |
| Normal | > 7 días | Verde |

### Trazabilidad

Cada lote mantiene:
- **lot_number**: Identificador del fabricante
- **barcode**: Código de barras escaneado
- **reference_document**: Albarán de entrada
- **supplier_id**: Proveedor origen

---

## 🛒 Ciclo de Compras

### Estados de un Pedido

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌──────────┐
│  draft  │ -> │ pending │ -> │ ordered │ -> │ received │
│(borrador)│   │(pendiente)│  │(enviado)│    │(recibido)│
└─────────┘    └─────────┘    └─────────┘    └──────────┘
```

### Reglas de Negocio

1. **Cálculo de total**:
   ```typescript
   const total = items.reduce((sum, item) => 
     sum + (item.quantity * (item.unit_price || 0)), 0
   );
   ```

2. **Eliminación en cascada**:
   - Al eliminar pedido, primero se borran `purchase_items`
   - Luego se elimina el `purchase`

3. **Recepción de mercancía**:
   - Marca `received_at` con timestamp
   - Evalúa `is_complete` (entrega completa o incidencia)
   - Registra `delivery_issues` si hay problemas

### Flujo de Recepción

```typescript
// useReceivePurchase
await supabase
  .from("purchases")
  .update({
    status: "received",
    received_at: new Date().toISOString(),
    delivery_status: is_complete ? "delivered" : "incomplete",
    is_complete,
    delivery_issues: delivery_issues || null,
  })
  .eq("id", purchaseId);
```

### Alertas de Entregas

```typescript
// usePendingDeliveries
const { late, today, upcoming } = categorize(purchases);

// late: expected_date < hoy (atrasadas)
// today: expected_date === hoy (para hoy)
// upcoming: expected_date > hoy (próximas)
```

---

## 📈 Previsiones y Forecast

### Datos de Previsión

```
forecasts
├── forecast_date       → Fecha objetivo
├── hotel_occupancy     → % ocupación hotel
├── breakfast_pax       → PAX desayunos
├── half_board_pax      → PAX media pensión
├── full_board_pax      → PAX pensión completa
├── extras_pax          → PAX extras
└── predicted_occupancy → Predicción IA (futuro)
```

### Regla de Importación

**Siempre se reemplaza** la previsión existente al importar:

```typescript
// useBulkUpsertForecasts
// Borrar TODA la previsión anterior
await supabase
  .from("forecasts")
  .delete()
  .neq("id", "00000000-0000-0000-0000-000000000000");

// Insertar nueva previsión
await supabase
  .from("forecasts")
  .insert(forecasts);
```

### Uso en Dashboard

El forecast alimenta:
- KPIs de ocupación semanal
- Alertas de picos de demanda
- Planificación de compras
- Asignación de personal

---

## ✅ Tareas de Producción

### Estados de Tarea

```
┌─────────┐    ┌─────────────┐    ┌───────────┐
│ pending │ -> │ in_progress │ -> │ completed │
└─────────┘    └─────────────┘    └───────────┘
     ↑              │                   │
     └──────────────┴───────────────────┘
                (reiniciar)
```

### Cronómetro de Tarea

Las tareas registran tiempo de ejecución:

```typescript
// useStartTask
await supabase.from("production_tasks").update({ 
  status: "in_progress",
  started_at: new Date().toISOString()
});

// useCompleteTask
const duration_seconds = Math.round(
  (new Date() - new Date(started_at)) / 1000
);

await supabase.from("production_tasks").update({ 
  status: "completed",
  completed_at: new Date().toISOString(),
  duration_seconds
});
```

### Prioridades

| Prioridad | Orden | Uso |
|-----------|-------|-----|
| `high` | 1 | Urgentes, para servicio inmediato |
| `medium` | 2 | Normales, dentro del turno |
| `low` | 3 | Pueden esperar |

### Turnos

| Código | Nombre | Horario típico |
|--------|--------|----------------|
| `M` | Mañana | 06:00 - 14:00 |
| `T` | Tarde | 14:00 - 22:00 |
| `N` | Noche | 22:00 - 06:00 |

---

## 📧 Invitaciones y Onboarding

### Flujo de Invitación

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ Admin crea  │ -> │ Email con    │ -> │ Usuario     │
│ invitación  │    │ token único  │    │ acepta      │
└─────────────┘    └──────────────┘    └─────────────┘
                          │                   │
                          v                   v
                   ┌──────────────┐    ┌─────────────┐
                   │ Resend envía │    │ Se asigna   │
                   │ email        │    │ rol y hotel │
                   └──────────────┘    └─────────────┘
```

### Estructura de Invitación

```typescript
interface Invitation {
  id: string;
  email: string;
  hotel_id: string;
  role: AppRole;
  token: string;          // UUID único para el link
  expires_at: string;     // 7 días por defecto
  invited_by: string;     // Usuario que invitó
  accepted_at: string;    // Null hasta aceptar
}
```

### Aceptación de Invitación

1. Usuario accede a `/accept-invitation?token=XXX`
2. Sistema valida token y expiración
3. Si no tiene cuenta, se registra
4. Se crea `hotel_member` y `user_role`
5. Se marca `accepted_at`

---

## 🤖 Integraciones IA

### Edge Functions con IA

#### 1. Asistente de Chat (`ai-assistant`)

```typescript
// Modelo: google/gemini-2.5-flash
// Contexto: hotel_id, fecha actual, módulo activo

const response = await fetch('/functions/v1/ai-assistant', {
  body: JSON.stringify({
    message: "¿Qué eventos tengo mañana?",
    context: {
      hotel_id: currentHotelId,
      current_date: new Date().toISOString(),
      module: "events"
    }
  })
});
```

#### 2. OCR de Menús (`parse-menu-image`)

```typescript
// Modelo: google/gemini-2.5-flash (visión)
// Input: imagen base64 de menú impreso

// Output:
{
  mealType: "lunch",
  sections: [
    {
      name: "Entrantes",
      items: [{ name: "Ensalada César", highlighted: false }]
    }
  ],
  observations: "Menú sin gluten disponible"
}
```

#### 3. OCR de Albaranes (`parse-delivery-note`)

```typescript
// Modelo: google/gemini-2.5-flash (visión)
// Input: imagen de albarán/factura

// Output:
{
  supplier: "Distribuciones García",
  date: "2025-02-01",
  items: [
    { name: "Salmón fresco", quantity: 10, unit: "kg", price: 15.50 }
  ],
  total: 155.00
}
```

### Sugerencias de Menú

El asistente puede sugerir menús basándose en:
- Productos disponibles en inventario
- Caducidades próximas
- Histórico de eventos similares
- Temporada y festividades

---

## 🔄 Flujos Integrados

### Evento → Producción → Inventario

```
1. Se crea evento con menú asignado
         ↓
2. Se genera hoja de producción (escalado por PAX)
         ↓
3. Se crean tareas de producción
         ↓
4. Se identifican ingredientes faltantes
         ↓
5. Se genera orden de compra
         ↓
6. Se recibe mercancía → lotes en inventario
         ↓
7. Se completan tareas de producción
```

### Importación XLSX → Dashboard

```
1. Usuario sube Excel de eventos/previsión
         ↓
2. Parser detecta formato y extrae datos
         ↓
3. Bulk insert reemplaza datos anteriores
         ↓
4. Invalidación de queries relacionadas
         ↓
5. Dashboard se actualiza automáticamente
```

---

## 📊 KPIs y Métricas

### Dashboard Principal

| Métrica | Cálculo | Fuente |
|---------|---------|--------|
| Eventos del día | COUNT donde `event_date = today` | events |
| PAX total día | SUM(pax) donde `event_date = today` | events |
| Lotes críticos | COUNT donde `expiry_date ≤ today + 3` | inventory_lots |
| Tareas pendientes | COUNT donde `status = 'pending'` | production_tasks |
| Pedidos esperando | COUNT donde `status = 'ordered'` | purchases |

### Estadísticas de Inventario

```typescript
// useInventoryStats
{
  totalLots: number,        // Lotes con cantidad > 0
  criticalCount: number,    // Caducidad ≤ 3 días
  expiringCount: number,    // Caducidad 4-7 días
  uniqueLocations: number   // Ubicaciones distintas
}
```

### Estadísticas de Tareas

```typescript
// useTaskStats
{
  pendingCount: number,       // Pendientes de hoy en adelante
  inProgressCount: number,    // En progreso
  completedTodayCount: number,// Completadas hoy
  totalTasks: number          // Total desde hoy
}
```

---

## 🛡️ Validaciones de Negocio

### Creación de Registros

1. **Hotel obligatorio**: Toda operación CRUD verifica `hotelId`
2. **Fechas válidas**: Eventos no pueden tener fecha pasada (opcional)
3. **Cantidades positivas**: Stock, PAX, precios ≥ 0
4. **Referencias válidas**: FK a productos, proveedores, menús

### Eliminación Segura

1. **Soft delete en menús**: `is_active = false` en lugar de DELETE
2. **Cascada en compras**: Items se eliminan antes que el pedido
3. **Protección de importados**: Eventos manuales no se borran en bulk

### Concurrencia

- React Query maneja invalidación automática
- Optimistic updates para UX fluida
- Refetch en focus/reconnect

---

## 🚀 Backlog R1-R4 (2026-02-08)

### 1. Flags de capacidad (IA opcional, OFF por defecto)

Las funcionalidades con dependencia de IA quedan controladas por `hotel_feature_flags`.

- `ai_purchase_suggestions`
- `ai_daily_briefing`
- `ai_menu_recommender`
- `ai_ops_alert_copy`
- `clawtbot_integration`

Regla: si el flag está en `false`, el sistema usa flujo determinista o no muestra la acción avanzada.

### 2. Sugerencias de compra deterministas

La recomendación se calcula con señales de demanda y stock:

```text
demanda = forecast + eventos + menús + safety_stock + (lead_time * demanda_diaria)
required_qty = max(demanda - stock_actual, 0)
recommended_qty = redondeo_por_pack(required_qty)
```

Salida agrupada por proveedor para acelerar creación de pedidos.

### 3. Mermas reales de inventario

Nueva captura de merma (`inventory_waste`) con causa y nota.

Reglas:
- Registrar merma descuenta stock del lote asociado (trigger).
- Cada merma genera movimiento de inventario tipo `waste`.
- Métrica mensual de merma visible en Inventario.

### 4. Desviación de coste por evento

Comparación entre:

- Baseline (`event_cost_baseline`) calculado desde escandallo del menú.
- Coste actual (`event_cost_actual`) registrado por operación.

Vista `event_cost_variance_view` expone `delta_amount` y `delta_pct`.

### 5. Aprobaciones por umbral

Compras y menús pueden requerir aprobación según políticas activas (`approval_policies`).

Reglas:
- Si `amount >= threshold_amount`, crear `approval_request`.
- La entidad queda en estado pendiente (ej. `pending_approval` en compras).
- Resolución en bandeja (`approved`, `rejected`, `cancelled`) con evento en `approval_events`.

### 6. Versionado de menús

Cada snapshot guarda estado completo del menú:

- Cabecera en `menu_versions`
- Items en `menu_item_versions`

Permite diff de ingredientes/cantidades/coste entre versiones.

### 7. Plan diario de operación

Planificación diaria con asignación por turno/capacidad:

- Input: tareas pendientes + eventos + disponibilidad de staff.
- Output: tareas planificadas y tareas sin capacidad.
- Briefing opcional por flag IA (`ai_daily_briefing`); fallback determinista siempre disponible.

### 8. Alertas operativas por suscripción

Usuarios pueden configurar frecuencia `daily/weekly` en `alert_subscriptions`.

`send-ops-alert` genera resumen con:
- stock crítico
- compras urgentes
- tareas vencidas
- eventos sin menú

### 9. Bridge seguro para agentes (clawtbot)

`agent-bridge` habilita consumo/escritura acotada por scopes:

- `read:events`
- `read:tasks`
- `write:tasks`
- `read:inventory`

La conexión se valida con firma Ed25519, timestamp y nonce para prevenir replay.

### 10. Móvil/PWA y quick actions

Soporte PWA (manifest + service worker) y barra móvil de operaciones rápidas.

Rutas rápidas habilitadas por querystring:
- Compras: `?quick=new-purchase`
- Inventario: `?quick=new-lot` / `?quick=waste`
- Tareas: `?quick=new-task`
