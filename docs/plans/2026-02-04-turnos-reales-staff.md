# Turnos Reales (Personal Sin Cuenta) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Hacer que el modulo **Turnos (/shifts)** deje de ser mock y gestione turnos reales guardados en Supabase para el personal de `public.staff` (aunque no tenga cuenta).

**Architecture:** Crear una nueva tabla `public.staff_shift_assignments` (multi-tenant por `hotel_id`) relacionada con `public.staff`. En el frontend, reemplazar el generador aleatorio por lectura/escritura via `@supabase/supabase-js` (React Query) y un dialog para asignar `shift_type` + `start_time/end_time`.

**Tech Stack:** Vite + React + TypeScript, React Router, @tanstack/react-query, Supabase (Postgres + RLS).

---

### Task 1: Tests (RED) para helpers de turnos

**Files:**
- Create: `src/lib/staffShiftAssignments.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { dbShiftToUi, makeShiftKey, uiShiftToDb } from "./staffShiftAssignments";

describe("staffShiftAssignments helpers", () => {
  test("maps DB shift <-> UI shift", () => {
    expect(dbShiftToUi("morning")).toBe("M");
    expect(dbShiftToUi("afternoon")).toBe("T");
    expect(dbShiftToUi("night")).toBe("N");
    expect(dbShiftToUi("off")).toBe(null);

    expect(uiShiftToDb("M")).toBe("morning");
    expect(uiShiftToDb("T")).toBe("afternoon");
    expect(uiShiftToDb("N")).toBe("night");
    expect(uiShiftToDb(null)).toBe(null);
  });

  test("builds stable map keys", () => {
    expect(makeShiftKey("staff-1", "2026-02-04")).toBe("staff-1|2026-02-04");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/staffShiftAssignments.test.ts`
Expected: FAIL with module not found (because `staffShiftAssignments.ts` does not exist yet).

---

### Task 2: Helpers (GREEN) para mapear turnos

**Files:**
- Create: `src/lib/staffShiftAssignments.ts`

**Step 1: Write minimal implementation**

```ts
export type DbShiftType = "morning" | "afternoon" | "night" | "off";
export type UiShiftType = "M" | "T" | "N";

export function makeShiftKey(staffId: string, shiftDate: string) {
  return `${staffId}|${shiftDate}`;
}

export function dbShiftToUi(shift: DbShiftType | null): UiShiftType | null {
  if (!shift || shift === "off") return null;
  if (shift === "morning") return "M";
  if (shift === "afternoon") return "T";
  return "N";
}

export function uiShiftToDb(shift: UiShiftType | null): DbShiftType | null {
  if (!shift) return null;
  if (shift === "M") return "morning";
  if (shift === "T") return "afternoon";
  return "night";
}
```

**Step 2: Run test to verify it passes**

Run: `npm test -- src/lib/staffShiftAssignments.test.ts`
Expected: PASS.

**Step 3: Commit**

```bash
git add src/lib/staffShiftAssignments.ts src/lib/staffShiftAssignments.test.ts
git commit -m "feat(shifts): add staff shift helper utils"
```

---

### Task 3: Database - nueva tabla `staff_shift_assignments`

**Files:**
- Create: `supabase/migrations/20260204120000_staff_shift_assignments.sql`

**Step 1: Create migration**

Add table + RLS + trigger:
- FK a `public.hotels` y `public.staff`
- Unique `(staff_id, shift_date)`
- RLS por `hotel_id = get_user_hotel_id()`
- SELECT permitido a `management/rrhh/produccion`
- INSERT/UPDATE/DELETE permitido a `management/rrhh`

**Step 2: Push migration**

Run: `supabase db push`
Expected: migration aplicada sin errores.

**Step 3: Commit**

```bash
git add supabase/migrations/20260204120000_staff_shift_assignments.sql
git commit -m "feat(db): add staff_shift_assignments table"
```

---

### Task 4: Types - actualizar `src/integrations/supabase/types.ts`

**Files:**
- Modify: `src/integrations/supabase/types.ts`

**Step 1: Add `staff_shift_assignments` table typing**

Add `Row/Insert/Update/Relationships` similarly to existing tables.

**Step 2: Verify TS build**

Run: `npm run build`
Expected: exit 0.

**Step 3: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "chore(types): add staff_shift_assignments"
```

---

### Task 5: Hooks - leer/escribir turnos reales

**Files:**
- Create: `src/hooks/useStaffShiftAssignments.ts`
- Modify: `src/pages/Shifts.tsx`

**Step 1: Fetch**

Hook `useStaffShiftAssignments({ startDate, endDate })`:
- filtra por `hotel_id`
- rango `shift_date`

**Step 2: Upsert**

Hook `useUpsertStaffShiftAssignment()`:
- `upsert` por `staff_id,shift_date`
- incluye `hotel_id`

**Step 3: Delete**

Hook `useDeleteStaffShiftAssignment()`.

**Step 4: Replace mock UI**

En `src/pages/Shifts.tsx`:
- usar `useStaff()` (tabla `public.staff`)
- usar `useStaffShiftAssignments` para pintar celdas reales
- al click en celda abrir Dialog y guardar con upsert

**Step 5: Verify**

Run:
```bash
npm run lint
npm test
npm run build
```
Expected: exit 0.

**Step 6: Commit**

```bash
git add src/hooks/useStaffShiftAssignments.ts src/pages/Shifts.tsx
git commit -m "feat(shifts): make shifts module use real staff assignments"
```

---

### Task 6: Push + Deploy

**Step 1: Push**

Run: `git push`

**Step 2: Deploy Vercel**

Run: `npx --yes vercel --prod --yes`

Expected: URL production OK (SPA).

