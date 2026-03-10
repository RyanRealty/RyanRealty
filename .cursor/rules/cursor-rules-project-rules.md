---
description: Core project rules for the Ryan Realty real estate platform
globs: ["**/*.ts", "**/*.tsx", "**/*.css"]
---

# Ryan Realty Platform — Cursor Rules

## Project Context
This is a greenfield real estate platform for Ryan Realty in Bend, Oregon.
The complete specification is at docs/MASTER_PLAN.md. Always reference it.
Build Order is in Section 51 of the master plan.

## Code Standards
- TypeScript strict mode. No `any` types. No `@ts-ignore`.
- Server components by default. Only add `"use client"` when the component needs browser APIs or interactivity (useState, useEffect, onClick, etc).
- All API keys are server-only (no NEXT_PUBLIC_ prefix) except: Supabase anon key, Google Maps key, GTM container ID, GA4 measurement ID, Meta Pixel ID, FUB email click param.
- Use Supabase JS client for database operations. Use `supabase.rpc()` for stored procedures.
- All database schema changes go through Supabase CLI migration files in supabase/migrations/. Never modify schema directly.
- Background jobs that may take >30 seconds run via Inngest, not Vercel API routes (60s timeout).
- Connect to Supabase via the connection pooler (port 6543) in serverless functions.

## Admin Backend
- Admin lives at /admin route group: src/app/(admin)/
- Protected by middleware checking auth + admin role.
- First-run setup wizard creates default super_admin when database is empty.
- Every multi-line text field has an <AIAssistButton> component with tone selector and context-aware AI generation.
- Broker profiles include full media upload: headshot (with crop tool), additional photos, videos.

## Styling
- Tailwind CSS only. No CSS modules, no styled-components, no inline styles.
- Brand colors: Navy #102742 (primary), Cream #F0EEEC (secondary), Amber #D4A853 (CTA accent only).
- 4px spacing grid. All spacing values are multiples of 4.
- Cards: rounded-xl (12px), shadow-sm at rest, shadow-md on hover, transition-all duration-200.
- Minimum touch target: 44px (desktop), 48px (mobile). Use p-3 minimum on buttons.

## Component Patterns
- Use Next.js App Router conventions (page.tsx, layout.tsx, loading.tsx, error.tsx).
- Shared UI components go in src/components/ui/ (Button, Card, Input, Modal, Badge, AIAssistButton).
- Feature components go in src/components/{feature}/ (listing/, community/, search/, etc).
- Every page component exports metadata for SEO (title, description, openGraph, etc).
- Reusable <AIAssistButton> component wraps any textarea/rich editor with AI generation.

## Data Fetching
- Server components fetch data directly from Supabase (no API route needed).
- Client components use SWR or React Query for client-side fetching with stale-while-revalidate.
- ISR revalidation: listing pages 60s, community pages 300s, blog posts 3600s.

## Tracking
- Every interactive element calls trackEvent() from src/lib/tracking.ts.
- Event names: lowercase_with_underscores (view_listing, save_listing, click_cta, etc).
- Every lead action pushes to FUB via src/lib/fub.ts.

## Spark API
- Use EXACT field names from the API (see docs/MASTER_PLAN.md Appendix A).
- BathsFull (not BathroomsFull), ListAgentName (not ListAgentFullName).
- ListingKey is the unique identifier (not ListingId).
- Check VOWAutomatedValuationDisplayYN before showing estimated values.

## PDF Generation
- Use @react-pdf/renderer for all PDFs (listing sheets, CMAs, reports, comparisons).
- PDF API routes: /api/pdf/listing, /api/pdf/cma, /api/pdf/report, /api/pdf/comparison.

## File Naming
- Components: PascalCase (ListingCard.tsx, SearchFilters.tsx, AIAssistButton.tsx)
- Utilities: camelCase (supabase.ts, tracking.ts, fub.ts)
- Types: camelCase files, PascalCase exports (listing.ts exports Listing, ListingPhoto, etc)
- Pages: lowercase (page.tsx, layout.tsx — Next.js convention)
- Inngest functions: camelCase (syncListings.ts, computeMarketStats.ts)
