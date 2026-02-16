# Ops Automation Scheduler (F6.1)

Este flujo agenda la operacion 24/7 de F6.1 usando GitHub Actions y Edge Functions de Supabase.

## Jobs

- `ops-autopilot`: cada 5 minutos.
- `ops-weekly-kpi`: cada lunes `00:10 UTC`.

Archivo: `.github/workflows/ops-automation-24x7.yml`

## Secrets requeridos en GitHub

Configurar en el repo (`Settings -> Secrets and variables -> Actions`):

- `CHEFOS_SUPABASE_URL`
- `CHEFOS_SUPABASE_ANON_KEY`
- `CHEFOS_OPS_AUTOPILOT_TOKEN`
- `CHEFOS_OPS_WEEKLY_KPI_TOKEN`
- `CHEFOS_DEFAULT_HOTEL_ID` (opcional, recomendado)

## Secrets requeridos en Supabase (Edge Functions)

Configurar en proyecto Supabase:

- `OPS_AUTOPILOT_TOKEN`
- `OPS_WEEKLY_KPI_TOKEN`

Ambos deben coincidir exactamente con los tokens guardados en GitHub.

## Ejecucion manual

Desde GitHub Actions puedes lanzar `workflow_dispatch` con:

- `task`: `autopilot` | `weekly_kpi` | `both`
- `hotel_id` opcional para sobreescribir `CHEFOS_DEFAULT_HOTEL_ID`

## Verificacion

- Revisar runs del workflow en GitHub.
- En ChefOs `Operations` validar:
  - health de autopilot bridge
  - trazas en auto-remediation
  - snapshots semanales en KPI
