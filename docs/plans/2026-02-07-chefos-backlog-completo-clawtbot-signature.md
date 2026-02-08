# ChefOS Backlog Completo + Firma de Conexion Clawtbot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar todas las mejoras propuestas (operativas, analiticas y de seguridad), manteniendo las funciones IA como opcionales y agregando una firma de conexion segura para el agente `clawtbot`.

**Architecture:** Se implementa un nucleo determinista (reglas de negocio + SQL + React Query) para cada modulo y, encima, una capa IA opt-in por feature flag. La integracion de `clawtbot` se implementa como API firmada con verificacion criptografica, anti-replay y scoping por hotel.

**Tech Stack:** React 18 + TypeScript + Vite, Supabase (Postgres + RLS + Edge Functions Deno), TanStack Query, Vitest, Resend, Gemini/Mistral (opcional), cron/scheduler de Supabase.

---

## 0) Reglas de implementacion (obligatorias)

1. IA opcional y nunca bloqueante:
- Si IA falla/no hay credito/no hay clave, el flujo sigue con motor determinista.
- Toda UI IA debe tener toggle `Usar IA` y fallback explicito.

2. Multi-tenant estricto:
- Toda tabla nueva con `hotel_id` + RLS.
- Query keys de React Query deben incluir `hotelId`.

3. Seguridad por defecto:
- Edge Functions con JWT `verify_jwt = true` salvo endpoints publicos justificados.
- Validacion de input + rate limits + logs de auditoria.

4. TDD y verificacion:
- Test primero para motores de calculo.
- Ejecutar `npm run lint`, `npm run test`, `npx tsc --noEmit`, `npm run build` por fase.

---

## 1) Fase Fundacional (feature flags + observabilidad)

### Task 1: Feature flags por hotel (incluye IA opt-in)

**Files:**
- Create: `supabase/migrations/20260208xxxxxx_feature_flags.sql`
- Modify: `src/integrations/supabase/types.ts`
- Create: `src/hooks/useFeatureFlags.ts`
- Modify: `src/hooks/useAuth.tsx`
- Modify: `src/pages/Settings.tsx`
- Create: `src/components/settings/FeatureFlagsSettings.tsx`

**Step 1: Write failing test**
- Create: `src/lib/featureFlags.test.ts`
- Casos: defaults por hotel, lectura de flags, fallback si tabla vacia.

**Step 2: Add DB schema + RLS**
- Tabla `hotel_feature_flags`:
  - `hotel_id uuid`, `feature_key text`, `enabled boolean`, `updated_by uuid`, timestamps.
  - unique `(hotel_id, feature_key)`.
- Politicas: lectura por miembros del hotel; escritura solo `admin|jefe_cocina|super_admin`.

**Step 3: Add hook + UI**
- `useFeatureFlags(hotelId)` + `useSetFeatureFlag()`.
- Nuevo panel en `Settings` con flags:
  - `ai_purchase_suggestions`
  - `ai_daily_briefing`
  - `ai_menu_recommender`
  - `clawtbot_integration`

**Step 4: Verify**
- Run: `npm run test src/lib/featureFlags.test.ts`

### Task 2: Telemetria operativa base

**Files:**
- Create: `supabase/migrations/20260208xxxxxx_ops_audit_log.sql`
- Create: `src/lib/telemetry.ts`
- Modify: `src/hooks/usePurchases.ts`
- Modify: `src/hooks/useInventory.ts`
- Modify: `src/hooks/useTasks.ts`

**Step 1: Write failing test**
- Create: `src/lib/telemetry.test.ts`

**Step 2: Add `ops_audit_log` table + RLS**
- Campos: `hotel_id`, `entity`, `action`, `payload jsonb`, `actor_user_id`, `created_at`.

**Step 3: Instrument critical mutaciones**
- Insert/update/delete en compras, inventario, tareas.

**Step 4: Verify**
- Run: `npm run test src/lib/telemetry.test.ts`

---

## 2) Fase Coste y abastecimiento

### Task 3: Auto-compra inteligente (motor determinista)

**Files:**
- Create: `src/lib/procurementSuggestionEngine.ts`
- Create: `src/lib/procurementSuggestionEngine.test.ts`
- Create: `src/hooks/usePurchaseSuggestions.ts`
- Create: `src/components/purchases/PurchaseSuggestionsDialog.tsx`
- Modify: `src/pages/Purchases.tsx`
- Create: `supabase/functions/generate-purchase-suggestions/index.ts` (sin IA en baseline)
- Modify: `supabase/config.toml`

**Step 1: Write failing tests**
- Casos:
  - demanda = forecast + eventos/menu
  - descuento por stock util disponible
  - ajuste por lead time proveedor
  - redondeo por unidad/pack

**Step 2: Implement engine**
- Salida por producto: `required_qty`, `current_qty`, `recommended_qty`, `reason`.

**Step 3: Expose via hook + dialog**
- Boton en Compras: “Sugerencias automaticas”.
- No usar IA aqui por defecto.

**Step 4: Verify**
- Run: `npm run test src/lib/procurementSuggestionEngine.test.ts`

### Task 4: Mermas reales y causa

**Files:**
- Create: `supabase/migrations/20260208xxxxxx_inventory_waste.sql`
- Modify: `src/integrations/supabase/types.ts`
- Create: `src/hooks/useInventoryWaste.ts`
- Create: `src/components/inventory/WasteCaptureDialog.tsx`
- Modify: `src/pages/Inventory.tsx`
- Create: `src/lib/wasteMetrics.ts`
- Create: `src/lib/wasteMetrics.test.ts`

**Step 1: Write failing tests**
- KPI merma por producto/categoria/periodo.

**Step 2: Add `inventory_waste` schema + RLS**
- Campos: `hotel_id`, `lot_id`, `product_id`, `qty`, `cause`, `note`, `recorded_by`, `recorded_at`.

**Step 3: Register waste + inventory movement coupling**
- Al guardar merma: crear `inventory_movement` tipo `waste`.

**Step 4: Verify**
- Run: `npm run test src/lib/wasteMetrics.test.ts`

### Task 5: Desviacion de coste por evento (teorico vs real)

**Files:**
- Create: `supabase/migrations/20260208xxxxxx_event_cost_variance.sql`
- Create: `src/lib/eventCostVariance.ts`
- Create: `src/lib/eventCostVariance.test.ts`
- Create: `src/hooks/useEventCostVariance.ts`
- Modify: `src/pages/Events.tsx`
- Create: `src/components/events/EventCostVarianceCard.tsx`

**Step 1: Write failing tests**
- Casos: evento con menu asignado, evento sin menu, parcial de consumos.

**Step 2: Implement variance model**
- `event_cost_baseline` (snapshot de escandallo x pax).
- `event_cost_actual` (consumos/lotes + compras imputadas).

**Step 3: Surface UI**
- Tarjeta por evento con `% desviacion`, delta absoluto y top 3 productos desviados.

**Step 4: Verify**
- Run: `npm run test src/lib/eventCostVariance.test.ts`

---

## 3) Fase Operacion diaria

### Task 6: Plan diario automatico (determinista + IA opcional)

**Files:**
- Create: `src/lib/dailyPlanner.ts`
- Create: `src/lib/dailyPlanner.test.ts`
- Create: `src/hooks/useDailyPlan.ts`
- Create: `src/pages/DailyPlan.tsx`
- Modify: `src/App.tsx`
- Create: `supabase/functions/daily-ops-briefing/index.ts`

**Step 1: Write failing tests**
- Priorizacion por ventana de servicio, dependencia de tareas, capacidad por turno.

**Step 2: Implement deterministic planner**
- Input: eventos, forecast, staff_shifts, tareas pendientes.
- Output: plan por bloques horario + responsable sugerido.

**Step 3: Optional AI narrative**
- Si flag `ai_daily_briefing=true`, generar resumen explicativo (solo texto).
- Si falla IA, mostrar plan determinista igual.

**Step 4: Verify**
- Run: `npm run test src/lib/dailyPlanner.test.ts`

### Task 7: Alertas proactivas programadas

**Files:**
- Create: `supabase/migrations/20260208xxxxxx_alert_subscriptions.sql`
- Create: `supabase/functions/send-ops-alert/index.ts`
- Modify: `supabase/functions/send-invitation-email/index.ts` (shared mail helper opcional)
- Create: `src/hooks/useAlertSubscriptions.ts`
- Create: `src/components/settings/AlertSubscriptionsSettings.tsx`

**Step 1: Write failing tests**
- `src/lib/opsAlertsComposer.test.ts`

**Step 2: Add subscription model**
- Canal: email (fase 1).
- Frecuencia: diaria, semanal.

**Step 3: Scheduled function**
- Compone alertas (stock critico, compras urgentes, tareas vencidas, eventos sin menu).
- IA opcional solo para redactado; no para detectar alertas.

**Step 4: Verify**
- Test unitario + dry-run function local.

---

## 4) Fase Gobierno y control

### Task 8: Flujo de aprobaciones (compras y cambios de menu)

**Files:**
- Create: `supabase/migrations/20260208xxxxxx_approval_workflow.sql`
- Modify: `src/integrations/supabase/types.ts`
- Create: `src/hooks/useApprovals.ts`
- Create: `src/components/approvals/ApprovalInbox.tsx`
- Modify: `src/pages/Purchases.tsx`
- Modify: `src/pages/Menus.tsx`

**Step 1: Write failing tests**
- `src/lib/approvalRules.test.ts`
- Reglas por umbral (`>500`, `>1500`, etc.) y por rol.

**Step 2: Implement approval entities**
- `approval_policies`, `approval_requests`, `approval_events`.

**Step 3: Gate mutaciones**
- Compra/menu no aplica cambios definitivos sin aprobacion cuando regla coincide.

**Step 4: Verify**
- Run: `npm run test src/lib/approvalRules.test.ts`

### Task 9: Recepcion avanzada con conciliacion OCR vs pedido

**Files:**
- Create: `src/lib/deliveryReconciliation.ts`
- Create: `src/lib/deliveryReconciliation.test.ts`
- Modify: `supabase/functions/parse-delivery-note/index.ts`
- Modify: `src/components/purchases/PurchaseReceiveDialog.tsx`

**Step 1: Write failing tests**
- Matching por nombre (normalizado), diferencias cantidad/precio, faltantes.

**Step 2: Add reconciliation result model**
- `matched`, `missing`, `unexpected`, `price_delta`.

**Step 3: UI assisted receive**
- Resumen de discrepancias antes de confirmar recepcion.

**Step 4: Verify**
- Run: `npm run test src/lib/deliveryReconciliation.test.ts`

### Task 10: Versionado de recetas/escandallos

**Files:**
- Create: `supabase/migrations/20260208xxxxxx_menu_versioning.sql`
- Modify: `src/hooks/useMenus.ts`
- Create: `src/hooks/useMenuVersions.ts`
- Create: `src/components/menus/MenuVersionHistoryDialog.tsx`

**Step 1: Write failing tests**
- `src/lib/menuVersioning.test.ts`

**Step 2: Schema + snapshot**
- `menu_versions`, `menu_item_versions`.
- Snapshot al publicar/versionar menu.

**Step 3: Compare UI**
- Diff entre versiones: ingredientes/cantidades/coste.

**Step 4: Verify**
- Run: `npm run test src/lib/menuVersioning.test.ts`

---

## 5) Fase Expansión de producto

### Task 11: Modo movil operativo (PWA + quick actions)

**Files:**
- Modify: `vite.config.ts`
- Create: `public/manifest.webmanifest`
- Create: `src/components/mobile/QuickOpsBar.tsx`
- Modify: `src/components/layout/MainLayout.tsx`
- Modify: `src/components/inventory/BarcodeScanner.tsx`

**Step 1: Write failing tests**
- `src/lib/mobileRoutingGuards.test.ts`

**Step 2: PWA shell + quick actions**
- Acciones rapidas: recibir pedido, registrar merma, iniciar/completar tarea.

**Step 3: Verify**
- Build + Lighthouse baseline (manual QA en movil).

### Task 12: Analytics multi-hotel para super admin

**Files:**
- Create: `supabase/migrations/20260208xxxxxx_superadmin_analytics_views.sql`
- Create: `src/hooks/useSuperAdminAnalytics.ts`
- Modify: `src/pages/SuperAdmin.tsx`
- Create: `src/components/superadmin/BenchmarkCards.tsx`

**Step 1: Write failing tests**
- `src/lib/superAdminBenchmarks.test.ts`

**Step 2: SQL views/materialized views**
- KPIs: coste/PAX, merma, cumplimiento tareas, puntualidad compras por hotel.

**Step 3: Ranking UI + filtros**
- Filtro por rango fecha y comparativa entre hoteles.

**Step 4: Verify**
- Run: `npm run test src/lib/superAdminBenchmarks.test.ts`

---

## 6) Firma de conexion para agente `clawtbot`

## Decision tecnica para aprobacion

**Opcion A (recomendada): Ed25519 (public/private key)**
- `clawtbot` firma cada request con clave privada.
- ChefOS guarda solo clave publica por conexion.
- Ventaja: no guardamos secretos compartidos en DB.

**Opcion B: HMAC-SHA256 (shared secret)**
- Mas simple de integrar, pero requiere custodiar secreto compartido.

### Task 13: Agent Signature Layer + API bridge

**Files:**
- Create: `supabase/migrations/20260208xxxxxx_agent_connections.sql`
- Create: `supabase/functions/agent-bridge/index.ts`
- Create: `supabase/functions/_shared/agentSignature.ts`
- Modify: `supabase/config.toml`
- Create: `src/hooks/useAgentConnections.ts`
- Create: `src/components/settings/AgentConnectionsSettings.tsx`

**Step 1: Write failing tests**
- Create: `src/lib/agentSignature.test.ts`
- Casos:
  - firma valida
  - timestamp expirado
  - nonce repetido (replay)
  - scope no permitido

**Step 2: Add schema + RLS**
- Tabla `agent_connections`:
  - `id`, `hotel_id`, `agent_name`, `agent_id`, `public_key`, `status`, `allowed_scopes`, timestamps.
- Tabla `agent_nonces` con TTL corto para anti-replay.

**Step 3: Implement canonical signature contract**
- Headers requeridos:
  - `x-agent-id`
  - `x-agent-ts`
  - `x-agent-nonce`
  - `x-agent-signature`
- Canonical string:
  - `METHOD\nPATH\nQUERY\nSHA256(BODY)\nTS\nNONCE\nAGENT_ID`

**Step 4: Implement bridge scopes (v1)**
- `read:events`
- `read:tasks`
- `write:tasks`
- `read:inventory`

**Step 5: Verify**
- Unit tests + curl firmado + intento replay debe dar `401/409`.

### Contract de firma (para `clawtbot`)

**Request example:**
- `POST /functions/v1/agent-bridge/tasks/complete`
- Body JSON normal.
- Signature computed on canonical string (UTF-8) with Ed25519 private key.
- `x-agent-signature` en base64.

**Server checks:**
1. Conexion activa y hotel coincide.
2. Timestamp dentro de ventana (ej. +/- 60s).
3. Nonce no usado.
4. Firma valida con public key registrada.
5. Scope autorizado.

---

## 7) IA opcional en cada modulo (matriz)

| Feature | Motor base (obligatorio) | IA opcional |
|---|---|---|
| Auto-compra | reglas demanda-stock-lead time | priorizacion textual |
| Plan diario | scheduler determinista | resumen narrativo |
| Alertas | reglas umbral | redaccion mensaje |
| Menu suggestion | matching eventos-menus | recomendacion cualitativa |
| OCR recepcion | parser + conciliacion por reglas | mejora de extraccion |

**Regla de producto:** Si IA falla, siempre mostrar resultado base + aviso no bloqueante.

---

## 8) Plan de entregas para aprobacion

### Release 1 (2 semanas)
- Fase Fundacional completa (Task 1-2)
- Auto-compra + merma (Task 3-4)
- Clawtbot signature base (Task 13, scopes read-only)

### Release 2 (2 semanas)
- Desviacion de coste + plan diario + alertas (Task 5-7)
- IA opcional habilitable por flags

### Release 3 (2 semanas)
- Aprobaciones + conciliacion OCR + versionado recetas (Task 8-10)

### Release 4 (2 semanas)
- Movil operativo + analytics super admin (Task 11-12)
- Clawtbot scopes write + hardening final

---

## 9) Criterios de aceptacion global (Definition of Done)

1. Ningun flujo core depende de IA para completar operaciones.
2. Todas las tablas nuevas con RLS y test de acceso por rol/hotel.
3. `clawtbot` no puede ejecutar request sin firma valida o con replay.
4. Cobertura de tests en motores nuevos (calculo y seguridad).
5. Build/lint/test/typecheck verdes por release.
6. Documentacion actualizada:
- `docs/API.md`
- `docs/SECURITY.md`
- `docs/BUSINESS_LOGIC.md`

---

## 10) Riesgos y mitigaciones

1. Complejidad alta del scope total.
- Mitigacion: releases por fases + feature flags + rollout por hotel.

2. Regresiones de performance en analytics.
- Mitigacion: materialized views + indices + refresh programado.

3. Riesgo de seguridad en agent bridge.
- Mitigacion: firma + nonce + ventana temporal + scopes + auditoria.

4. Dependencia de proveedores IA.
- Mitigacion: fallback determinista en todos los casos.

---

## 11) Aprobaciones requeridas

1. Aprobar opcion criptografica de firma para `clawtbot`:
- [x] Opcion A Ed25519 (recomendada)
- [ ] Opcion B HMAC

2. Aprobar orden de releases:
- [x] Secuencia propuesta (R1 -> R4)
- [ ] Ajustar prioridad (indicar cambios)

3. Aprobar flags IA por defecto:
- [x] Todas desactivadas por defecto
- [ ] Activar algunas desde inicio (indicar cuales)
