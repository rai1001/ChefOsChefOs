# Changelog - ChefOS

Historial de cambios y versiones del sistema.

---

## Formato

Cada entrada sigue el formato:

```
## [Versión] - Fecha

### Added (Añadido)
- Nuevas funcionalidades

### Changed (Modificado)
- Cambios en funcionalidades existentes

### Fixed (Corregido)
- Corrección de errores

### Security (Seguridad)
- Mejoras de seguridad

### Deprecated (Obsoleto)
- Funcionalidades que serán eliminadas

### Removed (Eliminado)
- Funcionalidades eliminadas
```

---

## [1.0.3] - 2026-02-16

### Added
- Fase 3 inicial (Inventario + Compras inteligentes):
  - umbrales de stock por producto (`critical_stock`, `min_stock`, `optimal_stock`)
  - defaults por categoria (`default_critical_stock`, `default_min_stock`, `default_optimal_stock`)
  - hook de alertas inteligentes de inventario con CTA inmediata
  - ventana de caducidades en 3d/7d/14d
  - compra rapida desde alerta `?quick=suggested&supplier_id=&product_id=&qty=`
  - historial de precios/proveedor por producto
- Utilidad de dominio `stockThresholds` con tests para severidad y reposicion recomendada.
- Migracion `20260216152000_inventory_thresholds_f3.sql` con normalizacion y constraints.

### Changed
- Motor de sugerencias de compra (`usePurchaseSuggestions`) ahora considera:
  - stock actual
  - umbrales efectivos (producto/categoria)
  - demanda por eventos/menus
  - intensidad de prevision
- Dialogo de sugerencias permite crear pedido borrador completo por proveedor en 1 clic.
- Pantalla de productos incluye edicion de umbrales C/M/O y modal de trazabilidad de precios.
- Pantalla de inventario incluye panel de alertas criticas accionables.

## [1.0.2] - 2026-02-16

### Added
- Fase 2 inicial (prevision + eventos) con normalizacion operativa:
  - nuevo campo `event_type`
  - nuevo campo `pax_estimated`
  - nuevo campo `pax_confirmed`
  - trigger de saneamiento en `events` para evitar registros huerfanos
- Nueva logica reusable `src/lib/eventNormalization.ts` para estandarizar:
  - nombre de evento
  - estado (`draft/confirmed/cancelled`)
  - tipo de evento
  - pax estimado/confirmado
  - deduplicado por fecha/salon/nombre
- Hook `useProductionLoadAlerts` para alertas de sobrecarga de produccion por franja.

### Changed
- `Forecast` ahora incluye vista compacta configurable `7/14/30 dias`.
- `ForecastXLSXImport` reforzado con:
  - validacion de fechas y rangos numericos
  - deteccion de filas invalidas
  - deduplicado por fecha con reporte de estadisticas
- `EventsXLSXImport` reforzado con:
  - normalizacion de estado/tipo/pax
  - deduplicado por fecha/salon/nombre
  - reporte de validos, invalidos, duplicados y salones sin mapeo
- `Events` actualizado con filtros por estado/tipo y formulario completo de campos normalizados.

### Fixed
- Las metricas de dashboard y ejecutivo ahora excluyen eventos cancelados en calculos operativos.

## [1.0.1] - 2026-02-16

### Added
- Barra global de salud operativa (sistema, sync, jobs, errores, backup) visible en toda la app.
- Nueva pagina tecnica `/status` protegida para `super_admin` con detalle de senales y actividad reciente.
- Metricas ejecutivas adicionales en dashboard:
  - coste diario estimado
  - merma estimada (EUR y %)
  - roturas de stock hoy/7d
  - desviacion prevision vs real (proxy 7d)
- Tarjeta de alertas priorizadas con CTA directo por alerta.
- Soporte de quick actions:
  - `/tasks?quick=new-task`
  - `/purchases?quick=new-purchase`

### Changed
- Dashboard refactorizado con modo `Resumen` / `Detalle` para reducir saturacion visual.
- Configuracion de `QueryClient` con captura centralizada de errores de query/mutation.
- Cliente Supabase con fetch resiliente para reintentos en fallos transitorios de red.

### Fixed
- Correccion de flujo de build en dashboard al renderizar condiciones de texto JSX.

## [1.0.0] - 2025-02-02

### Added
- **Sistema base completo**
  - Dashboard con KPIs en tiempo real
  - Gestión de eventos con calendario interactivo
  - Sistema de menús y escandallos
  - Control de inventario con lotes
  - Gestión de compras y proveedores
  - Catálogo de productos
  - Previsiones de ocupación
  - Gestión de personal y turnos
  - Tareas de producción con cronómetro

- **Multi-tenancy**
  - Soporte para múltiples hoteles
  - Aislamiento de datos por hotel_id
  - Cambio de hotel activo

- **Autenticación y roles**
  - Sistema de login/registro
  - 6 roles de usuario
  - RLS en todas las tablas

- **Importación de datos**
  - Importación XLSX de eventos
  - Importación XLSX de previsiones
  - Importación XLSX de productos
  - OCR de menús con IA
  - OCR de albaranes con IA

- **Edge Functions**
  - `ai-assistant`: Chat con IA
  - `parse-menu-image`: OCR de menús
  - `parse-delivery-note`: OCR de albaranes
  - `send-invitation-email`: Invitaciones

- **Sistema de invitaciones**
  - Invitar usuarios por email
  - Asignación de rol en invitación
  - Flujo de aceptación

- **Documentación**
  - README principal
  - Arquitectura del sistema
  - Esquema de base de datos
  - Documentación de módulos
  - Edge Functions
  - Migraciones
  - Lógica de negocio
  - Guía de despliegue
  - Seguridad
  - API Reference
  - Troubleshooting

### Technical Stack
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- TanStack React Query
- React Router v6
- Lovable Cloud (Supabase)
- Lovable AI Gateway

---

## Próximas Versiones

### [1.1.0] - Planificado

#### Planned
- [ ] Notificaciones push
- [ ] Dashboard personalizable
- [ ] Reportes exportables
- [ ] Integración con PMS hotelero
- [ ] App móvil (PWA)

### [1.2.0] - Planificado

#### Planned
- [ ] Predicción de demanda con IA
- [ ] Optimización automática de compras
- [ ] Sistema de alérgenos avanzado
- [ ] Trazabilidad completa APPCC

---

## Convenciones de Versionado

- **MAJOR (X.0.0)**: Cambios incompatibles con versiones anteriores
- **MINOR (0.X.0)**: Nuevas funcionalidades compatibles
- **PATCH (0.0.X)**: Correcciones de errores

---

## Cómo Contribuir

1. Documentar cambios en este archivo
2. Seguir el formato establecido
3. Incluir fecha de la versión
4. Categorizar correctamente los cambios
