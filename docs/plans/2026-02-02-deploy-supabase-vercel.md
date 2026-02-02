# Deploy Supabase & Vercel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish ChefOS with Supabase (DB + Edge Functions) as backend and Vercel serving the Vite/React frontend, with correct secrets and basic smoke tests.

**Architecture:** Supabase hosts Postgres, storage, and Deno edge functions; all data access from the React app goes through `@supabase/supabase-js` using the anon publishable key. Edge functions provide AI/email/OCR helpers and should run with JWT verification once secrets are set. Vercel builds `npm run build` and serves `dist/`; environment variables prefixed with `VITE_` are injected at build time.

**Tech Stack:** Vite + React + TypeScript, Supabase (Auth, DB, Edge Functions, Storage), Resend (email), Vercel for hosting.

---

### Task 1: Prep Supabase credentials and local env

**Files:**
- Modify: `.env` (local only, do not commit)

**Step 1: Verify project ref and anon key**

Run: `rg "VITE_SUPABASE_" .env src/integrations/supabase/client.ts`
Expected: Same `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` values across files; `VITE_SUPABASE_PROJECT_ID` matches Supabase dashboard ref (e.g., `sdfqlchgbbtzhmujlthi`).

**Step 2: Add service keys to local env for CLI**

Append (not committed):
```bash
SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_ACCESS_TOKEN="your-personal-access-token"  # for supabase CLI
```
Expected: Keys available for CLI-only usage; never commit or send to client.

### Task 2: Apply database migrations to Supabase

**Files:**
- Read: `supabase/migrations/*.sql`
- Read: `supabase/config.toml`

**Step 1: Login & link project**

Run:
```bash
supabase login                              # uses SUPABASE_ACCESS_TOKEN
supabase link --project-ref sdfqlchgbbtzhmujlthi
```
Expected: Link confirmation message referencing project ref.

**Step 2: Push migrations**

Run:
```bash
supabase db push --project-ref sdfqlchgbbtzhmujlthi
```
Expected: All migrations applied; no pending statements; exit code 0.

**Step 3: Verify RLS and roles (supabase-best-practices: rls-always-enable, rls-explicit-auth-check)**

Action: In Supabase Dashboard → Auth → Policies, confirm RLS enabled on all tables with data; ensure policies include `auth.uid()` checks for multi-tenant `hotel_id`.
Expected: All sensitive tables show RLS: ON; restrictive policies in place.

### Task 3: Deploy Edge Functions with required secrets

**Files:**
- Read: `supabase/functions/*/index.ts`
- Read: `supabase/config.toml`

**Step 1: Set secrets**

Run:
```bash
supabase secrets set \
  RESEND_API_KEY="your-resend-key" \
  GEMINI_API_KEY="your-gemini-key" \
  SUPABASE_URL="https://sdfqlchgbbtzhmujlthi.supabase.co" \
  SUPABASE_ANON_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
  SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  --project-ref sdfqlchgbbtzhmujlthi
```
Expected: CLI prints each secret set successfully.

**Step 2: Deploy functions**

Run:
```bash
supabase functions deploy ai-assistant parse-delivery-note parse-menu-image send-invitation-email \
  --project-ref sdfqlchgbbtzhmujlthi
```
Expected: Build + deploy success for all four functions.

**Step 3: Smoke test endpoints**

Run (replace token with anon key):
```bash
curl -i "$VITE_SUPABASE_URL/functions/v1/ai-assistant" \
  -H "Authorization: Bearer $VITE_SUPABASE_PUBLISHABLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message":"ping"}'
```
Expected: HTTP 200 and JSON body; no 401/403. If keeping public access is not desired, set `verify_jwt = true` in `supabase/config.toml` and redeploy (supabase-best-practices: edge-verify-jwt).

### Task 4: Configure Vercel project & envs

**Files:**
- Build: `vite.config.ts` (no changes expected)

**Step 1: Create/Link project**

Run:
```bash
vercel link  # select this repo
```
Expected: Project linked; scope set.

**Step 2: Set env vars (Preview & Production)**

Add in Vercel dashboard or CLI:
- `VITE_SUPABASE_URL=https://sdfqlchgbbtzhmujlthi.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>`

If any server-side code is added later, also set `SERVICE_ROLE_KEY` (never exposed to client).

**Step 3: Configure build**

Vercel settings:
- Framework: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
Expected: Build succeeds locally with `npm run build`.

### Task 5: Deploy frontend and run smoke tests

**Step 1: Local preflight**

Run:
```bash
npm install
npm run lint
npm run build
```
Expected: Lint/build pass; no TypeScript errors.

**Step 2: Deploy to Vercel**

Run:
```bash
vercel --prod
```
Expected: Deployment URL returned; status READY.

**Step 3: End-to-end smoke**

Navigate to production URL:
- Login flow succeeds (Supabase Auth).
- Dashboard loads KPIs without 401/403.
- AI assistant call succeeds (edge function 200).
- Email send path (if available) returns success toast.

Capture any failures for follow-up; confirm logs in Supabase Edge Functions and Vercel.

---

Plan complete and saved to `docs/plans/2026-02-02-deploy-supabase-vercel.md`.
