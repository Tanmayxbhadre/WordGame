# WordShift

A production-minded, real-time turn-based word transformation game for **Web (Next.js)**, **Android**, and **iOS (Expo + React Native)** backed by **Supabase (PostgreSQL, Auth, Realtime)** and a shared TypeScript game engine.

## Monorepo Structure

- `apps/web` — Next.js App Router web application + server-authoritative API routes + Vercel Cron worker
- `apps/mobile` — Expo + React Native mobile application (iOS & Android)
- `packages/game-engine` — Word validation, one-letter diff detection, BFS shortest-path solver, puzzle generator, and turn/timeout state machine
- `packages/word-dictionary` — 12,796 curated 4- and 5-letter English words with difficulty tiers (`easy`, `medium`, `hard`) and documented Public Domain provenance
- `packages/shared-types` — Shared TypeScript domain models, locked rule constants, and API contracts
- `packages/ui-tokens` — Shared dark/light design tokens
- `supabase/migrations` — PostgreSQL schema, strict RLS policies, and atomic `SECURITY DEFINER` RPCs
- `supabase/seed.sql` — Approved dictionary seed for `public.words`

## Locked Game Rules

- **2 players** per private match sharing one evolving word chain
- **30-second** server-authoritative turn timer; **5-minute** maximum match duration
- **15-second** reconnection grace period without resetting the turn clock
- Exactly **one letter** must change per turn; word must be in the approved dictionary and cannot repeat (including the starting word)
- Timeout skips the turn; **3 consecutive timeouts** or 5-minute expiry ends the match as a draw
- Reaching the target word wins immediately

## Prerequisites

- Node.js `>= 20`
- A Supabase project (or local Supabase CLI)

## Setup & Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env.local` in `apps/web/` (and `.env` in `apps/mobile/`):
   ```bash
   cp .env.example apps/web/.env.local
   ```
   Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET`.

3. **Run database migrations & seed dictionary:**
   ```bash
   supabase db push
   psql "$DATABASE_URL" -f supabase/seed.sql
   ```
   Or execute `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_rpcs.sql`, and `supabase/seed.sql` in the Supabase SQL Editor.

4. **Build shared packages:**
   ```bash
   npm run build:packages
   ```

5. **Start development servers:**
   ```bash
   npm run dev:web
   # In another terminal for mobile:
   npm run dev:mobile
   ```

## Security Boundaries

- **Server-Authoritative State:** Clients never compute or persist authoritative match state, timers, or winners. All mutations go through Next.js API routes -> PostgreSQL `rpc_*` functions with `FOR UPDATE` row locking and version checks.
- **Row Level Security (RLS):** Enabled on all 11 tables. Players can only `SELECT` matches, players, and moves they belong to. Direct client `INSERT`/`UPDATE`/`DELETE` on match tables is blocked.
- **Idempotency & Rate Limiting:** Every mutating endpoint accepts an `idempotency_key` persisted in `public.idempotency_keys` and enforces per-user sliding-window rate limits.
- **Service Role Isolation:** `SUPABASE_SERVICE_ROLE_KEY` is only used in server-side route handlers and never exposed in client bundles.

## Testing

```bash
# Build all shared packages
npm run build:packages

# Run unit & integration tests (dictionary, game engine, API flow)
npm test

# Run typechecks across all workspaces
npm run typecheck

# Run Playwright E2E tests (Web + Mobile viewport)
npx playwright install chromium
npm run test:e2e
```

## Deployment

### Web (Vercel)
1. Connect the repository to Vercel with Root Directory set to `apps/web` (or monorepo root with `npm run build --workspace=apps/web`).
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET` to Vercel Environment Variables.
3. `apps/web/vercel.json` configures a Vercel Cron job hitting `/api/cron/process-timeouts` every minute to resolve expired turns/matches even when both clients are closed.

### Mobile (Expo EAS)
1. Set `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_API_URL` (pointing to your deployed Vercel URL).
2. Run `npx eas build` inside `apps/mobile`.
# WordGame
