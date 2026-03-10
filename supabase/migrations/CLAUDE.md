# CLAUDE.md — Agent Instructions for Ryan Realty Platform

## What You're Building
The ultimate real estate platform for Ryan Realty in Bend, Oregon. This is a greenfield project — everything is built from scratch per the master plan.

## Master Plan
The complete specification is at `docs/MASTER_PLAN.md`. It is the single source of truth. Follow it exactly. The Build Order is in Section 51.

## Tech Stack (Do Not Change)
- Next.js 15+ (App Router), TypeScript strict, Tailwind CSS
- Supabase (PostgreSQL + PostGIS + RLS + Auth + Storage + Realtime)
- Vercel (hosting, auto-deploy from GitHub main branch)
- Inngest (all background jobs — sync, CMA, reports, notifications)
- Sentry (@sentry/nextjs for error monitoring)
- Upstash Redis (@upstash/ratelimit for rate limiting)
- Follow Up Boss (CRM, lead tracking via REST API)
- Resend (user-facing email via @react-email/components)
- Google Maps JavaScript API
- GA4 via GTM + Meta Pixel + CAPI
- @react-pdf/renderer (PDF generation)
- @vercel/og (dynamic OG image generation)

## Critical Rules
1. TypeScript strict mode. No `any`. No `@ts-ignore`.
2. Server components by default. Only `"use client"` when interactivity is needed.
3. All data fetching in server components or API routes. Never expose API keys to the client.
4. Server-only keys: NO `NEXT_PUBLIC_` prefix. Client-safe keys: `NEXT_PUBLIC_` prefix.
5. Supabase RLS on every table. No table accessible without a policy.
6. Every user-facing page: SSR or SSG for SEO.
7. Every page needs: meta title, meta description, canonical URL, JSON-LD, OG tags.
8. Every interactive element fires `trackEvent()` to `window.dataLayer`.
9. Every lead action pushes to FUB via `POST /v1/events`.
10. If a job might take >30 seconds, it's an Inngest function, NOT a Vercel API route.
11. All schema changes via Supabase CLI migration files in `supabase/migrations/`.
12. No bare minimum. Build the complete version of everything.
13. Admin backend lives at /admin. Protected by auth middleware. First-run setup wizard creates default super_admin.
14. Every multi-line text field in admin has an AI Assist button (sparkle icon) with tone selector and context-aware generation.

## Spark API Field Names
Use exact names from the API. Key fields:
- `ListingId`, `ListingKey` (unique ID — use ListingKey for upserts)
- `StandardStatus`, `MlsStatus`, `ListPrice`, `ClosePrice`
- `BedsTotal`, `BathsFull` (NOT BathroomsFull), `BathsHalf`, `BathroomsTotalInteger`
- `LivingArea`, `LotSizeAcres`, `LotSizeSquareFeet`, `YearBuilt`
- `SubdivisionName` (maps to communities), `City`, `CountyOrParish`
- `Latitude`, `Longitude` (non-IDX — geocode if unavailable)
- `ModificationTimestamp` (delta sync key)
- `VOWAutomatedValuationDisplayYN` (MUST check before showing CMA)
- Full mapping in docs/MASTER_PLAN.md Appendix A.

## Brand
- Primary: Navy #102742 | Secondary: Cream #F0EEEC
- CTA Accent: Warm Amber #D4A853 (ONLY for primary action buttons)
- Success: #22C55E | Warning: #F59E0B | Urgent: #EF4444
- Cards: 12px radius, shadow-sm rest, shadow-md hover, transition-all duration-200
- Touch targets: min 44px desktop, 48px mobile
- Tone: Direct, conversational, authentic. No hyphens in copy. No generic phrases.

## File Structure
```
src/app/(public)/         — Public pages (listings, communities, search, etc)
src/app/(auth)/           — Auth pages (login, signup, forgot-password)
src/app/(dashboard)/      — User dashboard (requires auth)
src/app/(admin)/          — Admin backend at /admin (requires admin role)
src/app/api/              — API routes
src/components/           — React components (ui/, listing/, community/, search/, broker/, admin/, layout/)
src/lib/                  — Utilities (supabase.ts, tracking.ts, fub.ts, spark.ts, cma.ts, ai-assist.ts)
src/types/                — TypeScript types
docs/                     — Master plan and build documents
supabase/migrations/      — Database migration SQL files
inngest/                  — Inngest function definitions
```

## Git Conventions
- Branches: `feature/description`, `fix/description`
- Commits: Descriptive, present tense. Commit after each meaningful unit of work.
- Push to feature branches, never directly to main.

## When Unsure
1. Check docs/MASTER_PLAN.md.
2. If not covered, make the best decision and add `// TODO: Verify with plan`.
3. Never skip something because it seems hard.
