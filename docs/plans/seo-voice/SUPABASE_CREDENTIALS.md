# Supabase credentials — what the agent can and cannot do

## What is already in `.env.local` / Vercel / GitHub

| Credential | Present | What it can do |
|------------|---------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project host |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public RLS reads |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Bypass RLS via **PostgREST** (SELECT/INSERT/UPDATE/DELETE on existing tables) |

GitHub “Supabase linked” and Vercel with those three vars = same capability: **API access, not Postgres superuser**.

## What is missing for migrations

| Credential | Present | What it can do |
|------------|---------|----------------|
| `SUPABASE_DB_PASSWORD` or `DATABASE_URL` | **No** (checked `.env.local` + Vercel production pull) | Connect to Postgres and run **DDL** (CREATE TABLE, CREATE INDEX, CREATE VIEW) |

**Service role JWT ≠ database password.**  
This is a platform security design, not an agent limitation.

## How to unlock DDL once (then agent never stops for this)

1. Open: https://supabase.com/dashboard/project/dwvlophlbvvygjfxcrhm/settings/database  
2. Copy **Database password** (reset if unknown).  
3. Add to **`.env.local`**:
   ```bash
   SUPABASE_DB_PASSWORD=your-password-here
   ```
4. Add the same to **Vercel** Production (optional, for CI later).  
5. Agent/you run:
   ```bash
   node scripts/analytics/apply-analytics-migration.mjs
   node scripts/analytics/rebuild-analytics-marts.mjs --year 2024
   ```

No `supabase login` / `supabase link` required.

## Agent policy (do not stop)

- **Ship and use live aggregate DAL** without marts (`getCoMarketAnnual`, `getCoOfficeShare`).  
- Migration = **performance + pre-agg**, not a gate on product progress.  
- When `SUPABASE_DB_PASSWORD` appears in env, auto-run apply + rebuild without asking.
