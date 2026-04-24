# Ryan Realty — Architecture

**Status:** Active · **Last synthesized:** 2026-04-21 (governance purge ch.6) · **Canonical.**

This is the single authoritative description of the Ryan Realty system. When this file disagrees with anything else in the repo, either this file is wrong (fix it here) or the other thing is drifting (fix it there and update the pointer below). Do not leave disagreements unresolved.

**What this file is for:** new agent or human reads it once and understands the system. Long detail lives in the files this one points to.

**What this file is NOT for:** task status, workflow conventions, or sales copy. See:

- Status / next work → `docs/plans/task-registry.json` + `npx tsx scripts/orchestrate.ts next`
- How to work on this repo as an agent → `AGENTS.md`, `CLAUDE.md`
- Cross-tool handoff state → `docs/plans/CROSS_AGENT_HANDOFF.md`

---

## 1. The system in one paragraph

Ryan Realty is a Next.js 16 (App Router) real-estate platform for Central Oregon, deployed on Vercel, backed by Supabase Postgres + Storage + Auth. It pulls MLS data from Flexmls/Spark into `listings` + `listing_history` via two syncs (delta every 10 min, full every Sunday 02:00). A Postgres trigger (`trg_compute_listing_fields`) computes 21 derived fields on every insert/update. A cron (`mpl_refresh_30min`) refreshes `market_pulse_live` per (geo × property_type) every 30 minutes. A Postgres-backed summary table (`market_stats_cache`) holds historical period stats. Public pages are ISR-cached. FollowUpBoss is the CRM of record. TikTok, Meta Graph, Google Ads, GA4/GTM, Google Maps, and SkySlope are integrated.

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | React 19.2 |
| Language | TypeScript 5 (strict) | |
| Styling | Tailwind v4 + shadcn/ui | shadcn is the **only** component layer; no raw HTML for anything with a shadcn equivalent. See `CLAUDE.md`. |
| DB | Supabase Postgres | Project ID `dwvlophlbvvygjfxcrhm` |
| Auth | Supabase Auth | Google OAuth |
| Storage | Supabase Storage + Cloudflare R2 | |
| MLS | Flexmls / Spark API | NWMLS-compatible |
| CRM | FollowUpBoss (FUB) | page views + registration + inquiry events |
| Analytics | GA4 + GTM + Meta Pixel | |
| Hosting | Vercel (Git-triggered deploy from `main`) | |

---

## 3. URL contract (canonical)

Full spec: `.cursor/rules/seo-url-guardrails.mdc` (machine-enforceable).

| Page type | URL |
|---|---|
| Listings browse hub | `/homes-for-sale` |
| Homes for sale in a city | `/homes-for-sale/{citySlug}` |
| Homes for sale in a community | `/homes-for-sale/{citySlug}/{communitySlug}` |
| **City page (marketing)** | `/cities/{citySlug}` |
| Neighborhood page | `/cities/{citySlug}/{neighborhoodSlug}` |
| Community page (marketing) | `/communities/{communitySlug}` |
| **Listing detail (canonical)** | `/homes-for-sale/{citySlug}/[{neighborhood}/]{community}/{address-slug}-{mlsNumber}` |
| Listing detail (no community) | `/homes-for-sale/{citySlug}/{address-slug}-{mlsNumber}` |
| Listing detail (fallback) | `/homes-for-sale/listing/{mlsNumber}` |
| Team index / broker | `/team`, `/team/{slug}` |
| Home valuation | `/sell/valuation` |

**Identifier rules:**
- Public listing ID is **`ListNumber`** (MLS number). `ListingKey` is internal.
- Legacy ListingKey URLs must 301-redirect to canonical.
- Always build URLs via `lib/slug.ts` helpers: `listingDetailPath`, `homesForSalePath`, `subdivisionListingsPath`, `cityEntityKey`, `subdivisionEntityKey`, etc. Never hand-concatenate.

**Structured data:** Listing detail emits `Product` + `Offer` + `BreadcrumbList` (Google's documented rich-result path). `RealEstateListing` is schema.org but has no Google rich-result support — do not use it as the primary type.

---

## 4. Geographic hierarchy

```
City (e.g. Bend)
  └─ optional Neighborhood (e.g. Westside)  — the broader area
       └─ Community / Subdivision (e.g. Tetherow)  — the specific development
```

- **City** = MLS `City`, `cities` table, slug via `cityEntityKey()`.
- **Neighborhood** = `neighborhoods` table, `city_id` FK. Optional — not all cities have them. When present, appears in URLs/breadcrumbs/JSON-LD; when absent, skipped gracefully.
- **Community** = MLS `SubdivisionName`, `communities` table, FK to city and optional neighborhood. UI label is "Community" everywhere; code may still say "subdivision" in some files (same concept).

**Slug format for stats cache keys:** always `citySlug:communitySlug` (colon-separated) via `subdivisionEntityKey()`. Never hyphen-joined. Full spec: `.cursor/rules/data-architecture.mdc`.

---

## 5. Data layer

Full spec: `.cursor/rules/data-architecture.mdc` + `.cursor/rules/supabase-data-layer.mdc`. Body reference: `docs/plans/data-architecture-plan.md`.

### Core tables

| Table | Rows (approx) | Purpose |
|---|---|---|
| `listings` | 587K | Flat + JSONB `details`; 130+ flat columns promoted from Spark |
| `listing_history` | 3.87M | Price/status events (chronology) |
| `price_history` | 345K | Normalized price-change events |
| `market_pulse_live` | 987 | Real-time snapshot per (geo × property_type) |
| `market_stats_cache` | — | Historical period stats (seller/buyer rows) |
| `cities` | 1 | City marketing content (only Bend currently) |
| `neighborhoods` | 13 | Neighborhoods under Bend |
| `communities` | 1,848 | Subdivisions |
| `brokers` | — | Team roster |
| `listing_photos`, `listing_videos` | — | MLS-sourced media (video population varies) |

### Auto-computed fields

Trigger `trg_compute_listing_fields` (enabled, on INSERT/UPDATE of `listings`) computes 21 Tier 1 fields:
DaysOnMarket, days_to_pending, days_pending_to_close, was_relisted, price_per_sqft, close_price_per_sqft, sale_to_list_ratio, sale_to_final_list_ratio, total_price_change_pct, total_price_change_amt, price_per_acre, price_per_bedroom, price_per_room, property_age, sqft_efficiency, bed_bath_ratio, above_grade_pct, hoa_annual_cost, hoa_pct_of_price, tax_rate, estimated_monthly_piti.

All values clamped to column precision.

### Stats APIs (single source of truth)

```ts
// CORRECT
import { getCachedStats, getLiveMarketPulse } from '@/app/actions/market-stats'
```

Closed-sale stats: `StandardStatus ILIKE '%Closed%'` AND `CloseDate` in window.
Sold price: `COALESCE("ClosePrice", (details->>'ClosePrice')::numeric, "ListPrice")`.
Medians: `percentile_cont(0.5) WITHIN GROUP (...)` — never `avg()` labeled as median.
Sale-to-list ratio: computed from close/list numerics, never hardcoded.

### Sync pipeline

| Lane | Route | Cadence | Purpose |
|---|---|---|---|
| Delta | `/api/cron/sync-delta` | Every 10 min | New listings, price/status changes, closings; emits activity_events |
| History-terminal backfill | `/api/cron/sync-history-terminal` | Every 5 min | Drains terminal history |
| Full | `/api/cron/sync-full` | Sunday 02:00 | Safety net for anything delta missed; skips finalized rows |
| Market pulse | pg_cron `mpl_refresh_30min` | Every 30 min | Refreshes `market_pulse_live` per geo×type |
| Refresh video cache | `/api/cron/refresh-video-tours-cache` | Every 30 min | — |
| Refresh year stats | `/api/cron/refresh-listing-year-stats` | Hourly | — |
| Refresh place content | `/api/cron/refresh-place-content` | 03:00 daily | Grok-generated city copy |

**Finalization (permanent):** a listing is frozen (`is_finalized=true`) only when (a) status contains "Closed", (b) `CloseDate` is not null, AND (c) `history_finalized=true`. Full rule: `.cursor/rules/sync-pipeline.mdc`.

### Query patterns (non-negotiables)

- Never `select('*')` on listing-heavy paths. Use named projections in `lib/listing-tile-projections.ts`.
- Never put `details` JSONB in tile/card/map selects on hot paths. Promote hot fields to flat columns.
- Paginate anything that could return >1,000 rows via `lib/supabase/paginate.ts` → `fetchAllRows()`.
- Independent queries → `Promise.all`. No sequential waterfalls.
- Metadata + page on same dataset → wrap fetcher in `React.cache()`.
- Public pages must set `revalidate` (ISR). Stats reads come from cache tables, not ad-hoc aggregations.

---

## 6. Workstreams + file ownership

Full matrix: `.cursor/rules/master-plan-protocol.mdc`. Short version:

| Area | Owner workstream |
|---|---|
| `supabase/migrations/*_market_stats*`, `app/actions/market-stats.ts`, `components/reports/*`, `app/housing-market/*`, `app/api/cron/sync-full/route.ts` | **Reporting** |
| `app/page.tsx`, `app/search/[...slug]/page.tsx`, `app/listing/[listingKey]/page.tsx` section order, `app/actions/activity-feed.ts`, `components/PageCTA.tsx` | **Engagement** |
| `components/AdUnit.tsx`, `app/layout.tsx` (site-wide banner), `app/sitemap.ts`, `app/guides/*` | **Monetization** |
| `lib/followupboss.ts`, `components/ShareButton.tsx` | **Shared** (extend carefully) |
| `app/admin/*` | **Admin** (superuser only) |

If your change crosses workstream boundaries, read the file ownership matrix before editing — Monetization adds ad slots into Engagement sections without rewriting section order, etc.

---

## 7. Governance

### The machine-enforceable rules

All `.cursor/rules/*.mdc` fire into every agent's context. The canonical ones (`alwaysApply: true`):

- `data-architecture.mdc` — stats, URLs, geo slug, JSONB, query patterns
- `master-plan-protocol.mdc` — workstream ownership
- `complete-scope-and-best-practices.mdc` — execution style
- `no-shortcuts.mdc` — thoroughness standard
- `design-system.mdc` — shadcn/ui only
- `server-actions.mdc` — server action patterns
- `auth-patterns.mdc` — auth conventions
- `error-handling.mdc` — error patterns
- `definition-of-done.mdc`, `deploy-verify-before-done.mdc`, `production-parity.mdc` — ship pipeline
- `supabase-migrations-auto.mdc` — hosted-migration requirement
- `sync-active-inventory-freshness.mdc` — freshness standard

Non-always rules fire when globs match or when explicitly loaded.

### Where truth lives (single source per concern)

| Concern | Source of truth |
|---|---|
| Canonical URLs, SEO constraints | `.cursor/rules/seo-url-guardrails.mdc` |
| Data architecture (stats, geo, caching) | `.cursor/rules/data-architecture.mdc` |
| Supabase access patterns | `.cursor/rules/supabase-data-layer.mdc` |
| File ownership (workstreams) | `.cursor/rules/master-plan-protocol.mdc` |
| Design system / shadcn / color tokens | `CLAUDE.md` |
| Sync architecture | `.cursor/rules/sync-pipeline.mdc` |
| CMA / closed-sale price | `.cursor/rules/cma-data-model.mdc` |
| Task / phase status | `docs/plans/task-registry.json` (+ `orchestrate.ts next`) |
| Workstream scope + file-ownership matrix | `docs/plans/master-plan.md` |
| Data architecture reference body | `docs/plans/data-architecture-plan.md` (body only; header is a stale marker) |
| Schema reference for agents | `docs/DATABASE_FOR_AI_AGENTS.md` |
| Feature inventory (what exists today) | `docs/FEATURES.md` |
| Tech docs index | `docs/README.md` |
| Cross-tool handoff state (Cursor ↔ Claude Code) | `docs/plans/CROSS_AGENT_HANDOFF.md` |
| Agent workflow conventions | `AGENTS.md` |
| Claude-specific work standards | `CLAUDE.md` |
| Historical snapshots (superseded) | `docs/archive/` |

### Drift-prevention pact

If you find a disagreement between this file, a cursor rule, and code:
1. Assume the **code** is reality.
2. Fix the rule or doc that's wrong — same commit as whatever drew you in.
3. Never leave "I'll fix the doc later" — that's how $1K got burned.

### Pre-flight for any substantive change

1. Read the cursor rules that match your task (check globs).
2. Read `npx tsx scripts/orchestrate.ts next` for current open work.
3. Check the workstream ownership matrix.
4. Code.
5. `npm run build` must pass.
6. For DB changes: migration file + `apply_migration` in the same commit (hosted parity).
7. Push `main` immediately (no saved-but-unpushed).
8. Verify production: deployment READY + the changed path works on `ryanrealty.vercel.app`.

---

## 8. Non-negotiables (compliance + product)

- **Data accuracy is absolute.** Matt is a licensed principal broker. Every number that ships (price, stat, YoY, absorption, months-of-supply, anything) must trace to a verified query against Supabase / MLS / official source. See CLAUDE.md's data-accuracy block.
- **shadcn/ui is the only styling authority.** Every UI element uses a shadcn component or a semantic color token. No hex, no `bg-blue-600`, no custom CSS classes from `globals.css`.
- **Trunk only.** `main` is the only branch. No feature branches, no PRs for routine work, no `git worktree`. Pre-commit hook enforces.
- **Always push.** If you commit, push in the same session. Never leave unpushed work on `main`.
- **No manual terminal asks.** Agents run every command themselves. Matt does not touch the terminal.
- **No half-built features.** Verify end-to-end before claiming done. `npm run build` passes, real data renders, mobile works.

---

## 9. Glossary

| Term | Meaning |
|---|---|
| **Community** | Public-facing label for MLS `SubdivisionName`. Same concept, different word. |
| **Subdivision** | MLS/code word for the same thing as Community. |
| **Neighborhood** | Broader area grouping communities. Optional. |
| **ListingKey** | Internal Spark ID. Not used in URLs. |
| **ListNumber** | Public MLS number. Used in URLs. |
| **Delta sync** | 10-min Spark pull of any changed listing. |
| **Full sync** | Weekly safety-net refresh of all non-finalized listings. |
| **Finalized** | Closed listing that is frozen, never re-synced. Requires closed + CloseDate + history captured. |
| **Reporting workstream** | The market-stats / market-pulse / reports surface and its data layer. |
| **Engagement workstream** | Home, search, listing-detail page content + section order. |
| **Monetization workstream** | Ads, site-wide banners, sitemap, guides, programmatic filter pages. |

---

## 10. When this file is wrong

This document should reflect reality. If you find a claim here that no longer matches the code:

1. Check whether the claim or the code is correct.
2. Fix whichever is wrong.
3. Update the "Last synthesized" date at the top.
4. Commit with `docs(architecture): ...`.

Do not delete sections. If something has changed, rewrite — don't leave silent gaps.

---

*Last synthesized from: `.cursor/rules/*.mdc`, `docs/plans/master-plan.md`, `docs/plans/data-architecture-plan.md`, `AGENTS.md`, `CLAUDE.md`, `vercel.json`, and live DB state (trigger + cron + tables) on 2026-04-21.*
