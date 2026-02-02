# Módulos de ChefOS

## 📊 Dashboard (`/`)

**Archivo:** `src/pages/Index.tsx`

Vista principal con resumen operativo:

### Componentes
- `StatCard` - KPIs principales
- `RecentActivity` - Actividad reciente
- `OrderCard` - Pedidos pendientes
- `MenuItemCard` - Menús activos
- `InventoryItem` - Alertas de stock

### Datos mostrados
- Eventos del día
- Total PAX
- Pedidos pendientes
- Stock bajo mínimo
- Tareas del día

---

## 📅 Eventos (`/events`)

**Archivo:** `src/pages/Events.tsx`

Gestión completa de eventos y banquetes.

### Funcionalidades
- Vista calendario mensual
- Vista lista
- Filtro por salón
- CRUD de eventos
- Asignación de menú
- Importación desde Excel (XLSX)
- Importación de menú por OCR

### Componentes
- `EventCalendarView` - Calendario interactivo
- `EventsXLSXImport` - Importador Excel
- `MenuOCRImport` - Importador OCR de menús
- `AIMenuSuggestion` - Sugerencia IA de menús

### Hook: `useEvents.ts`
```typescript
useEvents(options?: { startDate?: string; endDate?: string })
useVenues()
useMenus()
useCreateEvent()
useUpdateEvent()
useDeleteEvent()
useBulkInsertEvents()
```

---

## 🍽️ Menús (`/menus`)

**Archivo:** `src/pages/Menus.tsx`

Gestión de menús y recetas.

### Funcionalidades
- Listado de menús activos
- Crear/editar menús
- Añadir productos a menús
- Calcular coste por PAX
- Generar hoja de producción
- Generar orden de compra

### Componentes
- `RecipeCard` - Tarjeta de menú
- `RecipeDetailDialog` - Detalle del menú
- `CreateRecipeDialog` - Crear receta
- `ProductionSheetDialog` - Hoja de producción
- `GeneratePurchaseOrderDialog` - Generar pedido

### Hook: `useMenus.ts`
```typescript
useMenusWithItems()
useCreateMenu()
useUpdateMenu()
useDeleteMenu()
useAddMenuItems()
useRemoveMenuItem()
```

---

## 📦 Inventario (`/inventory`)

**Archivo:** `src/pages/Inventory.tsx`

Control de stock con lotes y trazabilidad.

### Funcionalidades
- Listado de lotes activos
- Registro de entradas/salidas
- Escaneo de códigos de barras
- Importación de albaranes (OCR)
- Alertas de caducidad
- Alertas de stock mínimo

### Componentes
- `BarcodeScanner` - Escáner de códigos
- `DeliveryNoteImport` - Importador de albaranes

### Hook: `useInventory.ts`
```typescript
useInventoryLots()
useInventoryMovements()
useCreateInventoryLot()
useCreateInventoryMovement()
useUpdateInventoryLot()
useDeleteInventoryLot()
```

---

## 🛒 Compras (`/purchases`)

**Archivo:** `src/pages/Purchases.tsx`

Órdenes de compra y recepción.

### Funcionalidades
- Listado de pedidos
- Crear orden de compra
- Recepción de mercancía
- Control de incidencias
- Estados: borrador, enviado, recibido

### Componentes
- `PurchaseReceiveDialog` - Recepción de pedido

### Hook: `usePurchases.ts`
```typescript
usePurchases()
usePurchaseWithItems(id)
useCreatePurchase()
useUpdatePurchase()
useDeletePurchase()
useAddPurchaseItems()
useReceivePurchase()
```

---

## 🏢 Proveedores (`/suppliers`)

**Archivo:** `src/pages/Suppliers.tsx`

Gestión de proveedores.

### Funcionalidades
- CRUD de proveedores
- Días de entrega
- Tiempo de anticipación
- Contacto

### Hook: `useSuppliers.ts`
```typescript
useSuppliers()
useCreateSupplier()
useUpdateSupplier()
useDeleteSupplier()
```

---

## 📋 Productos (`/products`)

**Archivo:** `src/pages/Products.tsx`

Catálogo de productos.

### Funcionalidades
- CRUD de productos
- Categorías
- Unidades de medida
- Alérgenos
- Stock actual y mínimo
- Importación desde Excel

### Componentes
- `ProductsXLSXImport` - Importador Excel

### Hook: `useProducts.ts`
```typescript
useProducts()
useProductCategories()
useUnits()
useCreateProduct()
useUpdateProduct()
useDeleteProduct()
useBulkInsertProducts()
```

---

## 📈 Previsiones (`/forecast`)

**Archivo:** `src/pages/Forecast.tsx`

Forecast de ocupación y producción.

### Funcionalidades
- Vista semanal
- Ocupación hotel
- PAX por régimen
- Importación desde Excel

### Componentes
- `ForecastCard` - Tarjeta de día
- `ForecastXLSXImport` - Importador Excel

### Hook: `useForecasts.ts`
```typescript
useForecasts(options?: { startDate, endDate })
useCreateForecast()
useUpdateForecast()
useDeleteForecast()
useBulkInsertForecasts()
```

---

## 👥 Personal (`/staff`)

**Archivo:** `src/pages/Staff.tsx`

Gestión de empleados.

### Funcionalidades
- CRUD de personal
- Roles/puestos
- Estado (activo/inactivo)
- Contacto

### Hook: `useStaff.ts`
```typescript
useStaff()
useCreateStaffMember()
useUpdateStaffMember()
useDeleteStaffMember()
```

---

## 📆 Turnos (`/shifts`)

**Archivo:** `src/pages/Shifts.tsx`

Planificación de turnos.

### Funcionalidades
- Vista calendario de turnos
- Asignar turnos
- Tipos de turno

### Hook: `useStaff.ts`
```typescript
useStaffShifts(options?: { startDate, endDate })
useCreateShift()
useUpdateShift()
useDeleteShift()
```

---

## ✅ Tareas (`/tasks`)

**Archivo:** `src/pages/Tasks.tsx`

Tareas de producción.

### Funcionalidades
- Vista por fecha
- Filtro por turno
- Estados: pendiente, en progreso, completada
- Prioridades
- Cronómetro de duración

### Hook: `useTasks.ts`
```typescript
useTasks(options?: { date, shift })
useCreateTask()
useUpdateTask()
useDeleteTask()
useStartTask()
useCompleteTask()
```

---

## ⚙️ Configuración (`/settings`)

**Archivo:** `src/pages/Settings.tsx`

Configuración del hotel y equipo.

### Componentes
- `HotelSettings` - Datos del hotel
- `HotelSelector` - Cambiar hotel activo
- `TeamManagement` - Gestión de equipo e invitaciones

### Funcionalidades
- Editar datos del hotel
- Cambiar hotel activo
- Invitar miembros al equipo
- Gestionar roles

---

## 🔐 Autenticación (`/auth`)

**Archivo:** `src/pages/Auth.tsx`

Login y registro de usuarios.

### Funcionalidades
- Login con email/password
- Registro con email/password
- Verificación de email
- Recordar sesión

### Hook: `useAuth.tsx`
```typescript
useAuth() → { user, session, signIn, signUp, signOut, loading }
```

---

## 👑 Super Admin (`/super-admin`)

**Archivo:** `src/pages/SuperAdmin.tsx`

Panel de administración global.

### Funcionalidades
- Ver todos los hoteles
- Crear hoteles
- Gestionar usuarios globalmente

### Hook: `useSuperAdmin.ts`
```typescript
useAllHotels()
useAllUsers()
useCreateHotel()
useAssignUserToHotel()
```

---

## 🤖 Asistente IA

**Componente:** `src/components/ai/AIChatWidget.tsx`

Chat flotante con IA integrada.

### Funcionalidades
- Chat conversacional
- Contexto del hotel
- Sugerencias de menús
- Resúmenes operativos

### Hook: `useAIAssistant.ts`
```typescript
useAIAssistant() → { 
  messages, 
  sendMessage, 
  isLoading, 
  suggestMenu 
}
```
