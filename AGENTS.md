# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Ryan Realty is a **Next.js 16 (App Router)** full-stack real estate website for Central Oregon, backed by **Supabase** (hosted PostgreSQL + Auth) and deployed on **Vercel**. There is no Docker, no local database, and no monorepo—just a single Next.js app.

### Running the app

- **Dev server:** `npm run dev` → http://localhost:3000
- **Build:** `npm run build` (workspace rule requires a green build before every push)
- **Lint:** `npm run lint` (uses ESLint 9 with `eslint-config-next`)

### Key caveats

- **Supabase credentials required for data:** Without real `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` environment variables, the app starts and renders but all listing counts show 0 and authenticated features are unavailable. Placeholder values in `.env.local` are sufficient for build and basic UI work.
- **`force-dynamic` everywhere:** The root layout and most pages export `dynamic = 'force-dynamic'`, so `npm run build` does not call Supabase at build time (no SSG fetch errors). Pages are server-rendered on demand.
- **No test suite:** The repo has no automated test framework (no Jest, Vitest, Playwright, etc.). Validation is done via `npm run lint` and `npm run build`.
- **Pre-existing lint warnings/errors:** `npm run lint` exits with code 1 due to ~23 pre-existing errors (mostly `@typescript-eslint/no-explicit-any`) and ~48 warnings. These are not introduced by cloud agent changes.
- **Workspace rules:** `.cursor/rules/` contains rules requiring `npm run build` before push, auto-running `npx supabase db push` when migrations change, and a continuous UI audit loop. Follow these when applicable.

### Environment variables

See `.env.example` for the full list. Only three are required for the app to start:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

All other env vars (Spark API, Mapbox, GA4, FollowUp Boss, OpenAI, Meta Pixel, Unsplash) are optional; the app degrades gracefully without them.
