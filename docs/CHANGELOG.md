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

## [1.0.8] - 2026-02-16

### Added
- Fase 6.1 (operacion productiva 24/7):
  - auto-remediation con guardrails para:
    - `sync-delayed` (relanzar sync)
    - `jobs-queue-backlog` (drenar/reintentar cola)
    - `service heartbeat stale` (restart controlado worker)
  - trazabilidad completa de automatizaciones:
    - tabla `ops_automation_runs`
    - tabla `ops_automation_cooldowns` (anti-loop/cooldown por incidente+servicio+accion)
    - timeline de incidentes con eventos `auto_remediation` y `auto_resolved` (actor `system`)
  - escalado automatico por severidad/SLA:
    - politicas `ops_escalation_policies`
    - estado activo `ops_escalations`
    - eventos `escalation` y `escalation_reminder` con deduplicacion temporal
  - panel SLO/SLI operativo en `Operations`:
    - uptime por servicio 24h/7d
    - MTTA/MTTR 30d
    - incidentes por severidad
    - backlog abierto por edad
    - objetivo vs real con targets configurables
  - KPI semanal operativo:
    - snapshots persistidos en `ops_weekly_snapshots`
    - funcion `ops-weekly-kpi`
    - vista historica de ultimas 8 semanas en `Operations`
  - nueva funcion `ops-autopilot` para ejecucion automatica de remediacion + escalado.
  - nuevo helper y tests para decisiones de autopilot/escalado:
    - `src/lib/opsAutopilot.ts`
    - `src/lib/opsAutopilot.test.ts`
    - `src/lib/opsAutopilot.integration.test.ts`

### Changed
- `supabase/config.toml` incorpora `ops-autopilot` y `ops-weekly-kpi`.
- `Operations` incorpora acciones manuales de autopilot/KPI y estado de salud del bridge de automatizacion.
- Scheduler 24/7 definido en GitHub Actions (`.github/workflows/ops-automation-24x7.yml`) para ejecutar:
  - `ops-autopilot` cada 5 minutos
  - `ops-weekly-kpi` semanal (lunes)
- Nueva guia de integracion: `docs/integrations/ops-automation-scheduler.md`.

## [1.0.7] - 2026-02-16

### Added
- Sistema de tickets end-to-end en ChefOs:
  - tablas `support_tickets` + `support_ticket_events` + RLS y triggers de auditoria
  - cola de integracion `support_ticket_outbox` (reintentos/backoff) e inbox idempotente `support_ticket_inbox`
  - logs estructurados de bridge `support_ticket_bridge_logs`
  - vistas de metricas `support_ticket_metrics_view` y salud `support_ticket_bridge_health_view`
  - nueva pagina `Tickets` con:
    - listado con filtros por estado, severidad, prioridad, fechas y requester
    - bandeja inicial `received`/sin triage
    - detalle con timeline completo
    - acciones rapidas: estado, asignacion, notas, cerrar/reabrir
  - nuevos hooks de dominio `useTickets`
  - nuevo dominio `ticketing` y `openclawBridge` con tests unitarios
- Bridge OpenClaw:
  - edge function outbound `openclaw-ticket-dispatch`
  - edge function inbound `openclaw-ticket-callback`
  - firma HMAC, validacion temporal, deduplicacion por `event_id`, y actualizacion idempotente de ticket
  - soporte de eventos:
    - salida: `ticket.created`, `ticket.updated`, `ticket.escalated`
    - entrada: `ticket.triaged`, `ticket.analysis_ready`, `ticket.solution_proposed`, `ticket.resolved`, `ticket.needs_human`
- Documentacion de contrato API en `docs/integrations/openclaw-ticketing.md`.

### Changed
- Router y sidebar incorporan modulo `Tickets` (`/tickets`).
- `Operations` incorpora indicador de salud del bridge de tickets OpenClaw.
- `supabase/config.toml` incorpora funciones `openclaw-ticket-dispatch` y `openclaw-ticket-callback`.

## [1.0.6] - 2026-02-16

### Added
- Fase 6 inicial (modo 24/7 y operacion remota):
  - nuevo Centro de Operacion 24/7 (`/operations`) con monitoreo, watchdog, incidentes y runbooks
  - reporte automatico de heartbeat web app desde `MainLayout` (throttle 5 min por hotel)
  - utilidades `opsWatchdog` para consolidar uptime 24h, stale heartbeats y backlog de colas
  - pruebas unitarias `src/lib/opsWatchdog.test.ts`
  - migracion `20260216190000_f6_ops_center.sql` con:
    - `ops_service_heartbeats`
    - `ops_incidents`
    - `ops_incident_events`
    - `ops_runbooks` (seed por hotel)

### Changed
- Sidebar agrega acceso `Operacion 24/7` para roles operativos.
- `HealthBar` redirige a `/operations` para roles operativos y mantiene `/status` para `super_admin`.
- Router principal incorpora ruta protegida `/operations`.

## [1.0.5] - 2026-02-16

### Added
- Fase 5 inicial (UX movil first):
  - nueva navegacion inferior movil con 5 areas clave segun rol (`Inicio`, `Eventos`, `Compras`, `Stock`, `Mi turno`)
  - acciones rapidas flotantes en movil (recibir compra, merma, nueva tarea, iniciar/completar tarea)
  - skeleton fallback para carga de rutas en movil y skeletons operativos en `Dashboard` y `Mi turno`
  - modo oscuro funcional con `ThemeProvider` y toggle en header

### Changed
- `MainLayout` ahora reserva espacio inferior para navegacion movil sin solapar contenido.
- `AIChatWidget` reposicionado en movil para coexistir con navegacion inferior y acciones flotantes.
- Controles tactiles actualizados para movil (>=44px):
  - `Button` (sizes `default/sm/icon`)
  - `Input`
  - `SelectTrigger`

## [1.0.4] - 2026-02-16

### Added
- Fase 4 inicial (Tareas, Turnos y Personal):
  - vista personal `Mi turno` con panel `Mi turno + mis tareas` (`/my-shift`)
  - plantillas operativas de tareas por tipo de servicio (`desayuno`/`evento`)
  - boton rapido de creacion de tarea desde barra movil y dashboard
  - centro de notificaciones priorizadas en `Header` (in-app)
  - nueva migracion `20260216173000_f4_staff_self_select.sql` para lectura segura de ficha propia de staff (`user_id = auth.uid()`)
- Nueva logica de cobertura por franja:
  - utilidad `shiftCoverage` para calcular requerido vs asignado por dia/turno
  - tests de cobertura para baseline, sobrecarga y agrupacion por fecha

### Changed
- `Tasks` incorpora selector de servicio + plantilla con autocompletado de:
  - titulo
  - descripcion
  - turno
  - prioridad (incluye `urgent`)
- `Shifts` ahora muestra validaciones de cobertura en tiempo real:
  - resumen de huecos por mes
  - marcadores por dia en cabecera
  - previsualizacion de cobertura antes de guardar una asignacion
  - validacion de horario `inicio < fin`
- `Header` deja de ser icono pasivo y muestra alertas accionables por prioridad con acceso rapido a ajustes de canal.
- Navegacion lateral incluye acceso directo a `Mi Turno`.

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
