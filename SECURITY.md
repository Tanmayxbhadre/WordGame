# Security Policy & Architecture Boundaries

## Core Principles
1. **Server-Authoritative Game State:** Clients (`apps/web`, `apps/mobile`) never decide turn order, timers, word validity, or winners. All state transitions execute inside PostgreSQL `SECURITY DEFINER` RPCs with `FOR UPDATE` row locks.
2. **Row Level Security (RLS):** Enabled on all 11 tables in `public`. Players can only read matches they participate in (`is_match_participant(id)`). Direct client writes to match tables are denied.
3. **Key Isolation:** `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` are strictly server-side and must never be prefixed with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.
4. **Idempotency & Rate Limiting:** Mutating API routes require `idempotency_key` and enforce per-user sliding-window rate limits.
