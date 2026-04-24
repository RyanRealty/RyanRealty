# Claude Code Session: Fix Vercel Deployment Errors

## Context

You are working on the Ryan Realty platform — a Next.js 16.1.6 / React 19.2.3 / TypeScript 5 / Tailwind v4 / Supabase real estate application. The Vercel deployment is failing. Your job is to get the build passing with zero errors.

## Immediate Task

**Run `npm run build` and fix every error until it compiles cleanly.** This is the only priority right now. Do not add features, do not refactor beyond what's needed to fix compilation.

## Approach

Use this exact loop:

```
1. Run `npm run build 2>&1 | head -80`
2. Read the FIRST error (not all of them — fix one at a time)
3. Open the file, understand the error, fix it
4. Re-run `npm run build 2>&1 | head -80`
5. Repeat until "✓ Compiled successfully"
```

If the error list is long, work top-down — later errors are often caused by earlier ones.

## Stack Reference

- **Next.js 16.1.6** with App Router (all routes in `app/`)
- **React 19.2.3** (new React — `use()`, async server components, etc.)
- **TypeScript 5** strict mode
- **Tailwind v4** (CSS-based config, NOT `tailwind.config.js`)
- **Supabase** for auth, database, storage
- **@sentry/nextjs ^10.42.0**
- **Inngest** for background functions
- **@react-pdf/renderer** for PDF generation

## Known Issues From Audit (may or may not be causing build failures)

These are documented issues that may contribute to build errors:

### F-001: Duplicate listing routes
- Both `app/listing/[listingKey]/page.tsx` and `app/listings/[listingKey]/page.tsx` exist
- Canonical should be `/listing/`. The `/listings/[listingKey]` route should redirect via `next.config.ts` (already configured).
- If there are import/type conflicts between these two, the `/listing/` version is authoritative.

### F-002: Duplicate agent/team routes
- Both `app/agents/` and `app/team/` exist
- Canonical is `/team/`. Redirects from `/agents/` already in `next.config.ts`.

### F-009: @supabase/supabase-js was previously pinned to "latest"
- Now pinned to `2.98.0` in package.json. If you see Supabase type errors, check `types/database.ts` matches the client version.

### F-013: Oversized listing detail page
- `app/listing/[listingKey]/page.tsx` is 859 lines. May have type issues from its size/complexity.

### F-014: Root error boundary doesn't report to Sentry
- `app/error.tsx` exists but may have import issues with `@sentry/nextjs`.

### F-016: Image remotePatterns
- Was `hostname: '**'` (wildcard). Now restricted to specific hosts in `next.config.ts`. If build fails on image optimization config, check the `images.remotePatterns` array.

### F-020: Multiple Supabase client patterns
- Some files use `createServerClient`, some use `createServiceClient`, some do ad-hoc `createClient(url, key)`. The canonical patterns are in `lib/supabase/server.ts` and `lib/supabase/service.ts`. If you see auth/client type mismatches, check which pattern the file uses.

## File Structure Quick Reference

```
app/                    # Next.js App Router pages and server actions
  actions/              # Server actions (50+ files)
  admin/                # Admin routes (protected)
  api/                  # API routes
  listing/[listingKey]/ # Canonical listing detail
  listings/             # Search/map listings + duplicate detail route
  team/[slug]/          # Canonical broker profiles
  agents/[slug]/        # Duplicate broker route (redirects)
components/             # 217 React components
lib/                    # 59 library modules
  supabase/             # Supabase client factories
types/                  # TypeScript types
  database.ts           # Supabase generated types
inngest/                # Background job functions
```

## Important Constraints

1. **Do NOT delete routes or features to fix the build.** Fix the actual errors.
2. **Do NOT change `next.config.ts`** unless the error is specifically in that file.
3. **Do NOT upgrade or downgrade dependencies** unless a specific type mismatch requires it. If you must change a dep version, note it clearly.
4. **Preserve all existing functionality.** The goal is compilation, not cleanup.
5. **If a type error is in `types/database.ts`**, that file is auto-generated from Supabase. Don't manually edit it — instead fix the consuming code to match the types that exist.

## After Build Passes

Once `npm run build` succeeds with zero errors:

1. Run `npx tsc --noEmit` to double-check no type errors remain
2. Run `npm run lint` to check for lint warnings (fix errors, warnings are OK)
3. Provide a summary of every file you changed and why
4. Note any changes that might affect runtime behavior (not just types)

## Source of Truth Docs (read only if needed for understanding a specific error)

1. `docs/FEATURES.md` — What's built

## Start

Run `npm run build` now. Fix every error. Don't stop until it compiles.
