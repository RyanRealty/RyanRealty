# Ryan Realty — full site audit (2026-06-03)

Autonomous overnight pass against Matt's mandate: "every page works, SEO + design solid,
user features (saved searches etc.) working, admin backend working, don't break anything."

Verification was live (dev server + Playwright + the gate suite + a read-only code audit),
not assumed. Headline: **the site is healthy.** No crashing pages, all account features
wired end-to-end, the admin backend is real and data-backed, SEO coverage is comprehensive,
and the full CI gate suite passes (exit 0).

---

## 1. Page render health — 96 / 97 routes render, 0 real crashes

Method: `scripts/_route-audit.mjs` (Playwright) visits a representative URL for every route
pattern, auto-discovering real detail slugs (listing / blog / guide / report / school /
neighborhood) so dynamic routes are checked with live data. It tags each as OK / AUTH-REDIR
(expected gate to login) / 404 / BROKEN (status ≥ 500, a real crash marker in the body, or an
empty shell).

- **96 of 97 render OK or correctly auth-redirect.** No 500s, no error boundaries, no
  hydration crashes across public pages, landing pages, all dynamic detail routes, presets,
  cities, communities, zips, schools, parks, housing-market, buy intents.
- The 1 flagged route (`/admin/setup`) is a **redirect** to `/admin` (empty intermediate
  body), not a crash.
- An earlier regex flagged `/activity`, `/communities`, `/housing-market/bend` — **false
  positives**: the old pattern matched the bare string "500" inside prices like `$500,000`.
  Regex tightened to real crash markers only; all three render fine.
- Dashboard/account routes correctly redirect unauthenticated users to `/login`.
- Admin routes correctly gate to `/auth-error?next=/admin` (see §2 — by design, not a bug).

## 2. User account features — all wired end-to-end (page → action → DB)

Every feature has a real mutation path, not just a rendered page. Verified in code:

| Feature | Page | Server action | DB table |
|---|---|---|---|
| Saved homes | `account/saved-homes`, `dashboard/saved` | `app/actions/saved-listings.ts` | `saved_listings` |
| Saved cities | `account/saved-cities` | `app/actions/saved-cities.ts` | `saved_cities` |
| Saved communities | `account/saved-communities` | `app/actions/saved-communities.ts` | `saved_communities` |
| Saved searches | `dashboard/searches` | `app/actions/saved-searches.ts` | `saved_searches` |
| Likes | `dashboard/likes` | `app/actions/likes.ts` + `dashboard-likes.ts` | `likes` |
| Buying preferences | `account/buying-preferences` | `app/actions/buying-preferences.ts` | `user_buying_preferences` |
| Compare | `compare` | read-only `getListingsByKeys` | stateless (query params) |
| Dashboard | `dashboard` | composes the above | multiple |

Each action authenticates via `getSession()`, checks `user.id`, and runs the
insert/delete/update. FUB tracking on save is fire-and-forget, so a FUB hiccup never blocks a
save. **No orphaned or missing wiring found.**

## 3. Admin backend — real and functional (24 pages, no stubs)

- **Auth guard** (`app/admin/(protected)/layout.tsx`): checks `getSession()`, then
  `getAdminRoleForEmail()`; no session → `/auth-error?next=/admin` (deliberately *not*
  `/admin/login`, which would infinite-loop inside the same route group — `/auth-error` then
  links to `/admin/login?next=…`); has session but no role → `/admin/access-denied`.
- **24 admin pages verified** against real Supabase data sources: photo approval/curation
  (`asset_library`), listings management, people/leads (`marketing_assignments` +
  `visitor_sessions`), blog, analytics (GA4), approval queue, banners, CMAs, brokers, geo
  admin (8 subpages), expired listings, email, sync (12 subpages), reports (12 subpages),
  producers, search presets, users, visitors, KPI dashboard, optimization, query builder,
  stock photos, FUB attribution, resort communities. **No empty stubs.**
- Not exercisable without an admin session, so the live click-through of each admin action is
  the one thing this pass could not verify; the code paths and data sources are confirmed
  real.

## 4. SEO — comprehensive coverage

- **Sitemap** (`app/sitemap.ts`, ISR 3600s): static routes + every active listing (via
  `listing_tile_mv`), every city, subdivision, curated community, published blog post +
  guide, market report, active broker, and ZIP. ~4000+ URLs, no N+1.
- **robots** (`app/robots.ts`): allows search + AI crawlers (Googlebot, Bingbot, GPTBot,
  ClaudeBot, Perplexity, OAI-SearchBot, …); disallows `/admin`, `/dashboard`, `/account`,
  `/auth`; allows `/api/og` for social preview cards.
- **generateMetadata** present on every dynamic page type: listing, city, community, blog,
  search, housing-market report, central-oregon — title/description/canonical/OpenGraph/
  Twitter.
- **JSON-LD structured data** on 11+ surfaces (blog post + collection, cities, communities,
  contact, guides, housing-market, reports, sell LP RealEstateAgent).

## 5. Gate suite — green

`npm run ci:gates` → **exit 0.** 7/7 gates OK (design-tokens, seo-routes, DAL boundary,
brand-voice, mockup parity, page DAL, static params). Skill self-binding: 76/76 PASS. Hook
contract tests 28/28. Brand-voice vocabulary parity OK.

---

## Open items (none are page-breaking)

| # | Item | Severity | Notes / why not done tonight |
|---|---|---|---|
| 1 | **Trigram GIN index** on `listings.details->>'PublicRemarks'` and `'View'` | perf | Golf cold-load + keyword presets (with-shop, rv-parking) run ~6s cold (page-cached after). The migration file exists (`20260603191500_…trgm_index.sql`) but the build rolls back under the MCP's transaction timeout. Needs `CREATE INDEX CONCURRENTLY` in a direct off-hours psql session — can't run CONCURRENTLY inside the MCP's txn wrapper. Pages work regardless (golf uses the lightweight `search_golf_homes` RPC). |
| 2 | **Broken blog cover images** | cosmetic | 2 Unsplash URLs seeded by `scripts/blog-content/{community-spotlights,selling-guides,homeowner-guides}.ts` now 404 (`photo-1600566753190…`, `photo-1558618666…`). They surface as broken card images on blog/recent-posts strips. The 10 resort-community hero URLs are all fine (HEAD 200). Fix = reseed those post covers with curated/asset-library imagery — a content-image choice, so left for Matt's eye per the draft-first rule. |
| 3 | **Dead code: `getMegaMenuData`** | cleanup | `lib/data/nav/getMegaMenuData.ts` is exported from `lib/data/index.ts` but imported nowhere (the editorial mega-menu uses the static `lib/site-menu.ts`). Safe to delete, but removing a DAL function also requires `npm run ci:data-access -- --refresh` to keep G16 green — bundled into a deliberate cleanup commit rather than done blind overnight. |
| 4 | **Dead field: `MenuEntry.featured`** | cleanup | Populated in `lib/site-menu.ts` but consumed by neither `MegaMenu` (text-only redesign) nor `MobileNav`. Safe to strip the field + `MenuFeatured` type. |
| 5 | **Hot-linked Unsplash imagery (site-wide)** | design debt | 146 `unsplash` references across ~19 files (many are legit admin stock-picker tooling). The display-image ones (`content-page-hero-images.ts`, `central-oregon-images.ts`, `section-images.ts`, etc.) are off-brand stock and carry 404 risk. A migration to the curated `asset_library` is the right long-term fix but is a judgment-heavy sweep — propose as a tracked design task, not an overnight blind swap. |

## What shipped earlier this session (already on main)

- Golf-course preset filter fix (RPC was reading the empty `amenities.golf_view`).
- Purpose-built `/homes-for-sale/<city>/on-golf-course` golf landing (24 homes, lightweight
  `search_golf_homes` RPC, ~0.5s).
- Editorial full-width mega-menu for all 7 nav parents (replaced the rejected bento; fixed the
  disappear-on-select bug with hover-intent; text-only per Matt).
- Clean modern search/preset results page with accurate counts (replaced the capped-200
  count via `getListingsAdvanced` full_count).

All four verified live via Playwright and pushed (HEAD `e68d648`).
