# Design-audit remediation — progress log

Mission: complete every item in [README.md](README.md) (the 2026-07-07 full-site audit) to production grade. Each phase is browser-verified end-to-end before its commit. Statuses here are the source of truth for what has shipped since the audit.

## Phase A — top-10 quick wins (2026-07-08) ✅

| # | Item | Fix | Verified |
|---|---|---|---|
| 1 | Homepage hero says who we are | Lead now "across Central Oregon, from the Deschutes to Smith Rock. Real numbers, direct from the brokers who close deals here." — also fixes the "six cities" scope mismatch ([app/page.tsx](../../app/page.tsx)) | curl: composed sentence renders with live count |
| 2 | Zillow 3D tours framed a competitor logo + CAPTCHA | zillow.com iframe tours demoted to the branded "Open the virtual tour" new-tab card ([ListingVideoEmbed.tsx](../../components/site/listing-detail/ListingVideoEmbed.tsx)) | 63177 Iner: 0 zillow iframes, link card target=_blank |
| 3 | Search → listing dead-click | Listing-shaped `loading.tsx` skeletons for `/listing/by-address/[...slug]` + `/listing/by-key/[listingKey]` | route 200s; skeleton file per Next convention |
| 4 | $1,000 "home" led price-drops | `listPrice >= $50K` floor in getPriceDrops (grid + analytics) and getPriceDropTiles (homepage picker) | /price-drops: lowest card now $1,049,000 |
| 5 | Homepage map framed the Willamette Valley | `fitToFeatures` + 5th–95th-percentile core framing at region scale + SuperCluster radius 80 ([KbListingMapImpl.tsx](../../components/site/kb/KbListingMapImpl.tsx)) | screenshot: Sisters→Prineville, Madras→La Pine, clusters separated |
| 6 | "caldera springs 0 ACTIVE" marquee card | Title-cased card names; 0-inventory featured cards sell the guide ("Community guide · Sunriver") ([KbCommunities.client.tsx](../../components/site/kb/KbCommunities.client.tsx)) | curl: "Caldera Springs" + "Community guide ·", zero "0 active" |
| 7 | /team promised numbers the cards didn't show | Each card renders the broker's public Twilio line from the canonical registry; "Talk to a broker" now routes to /contact (was /sell) ([KbTeam.client.tsx](../../components/site/kb/KbTeam.client.tsx)) | DOM: 541.703.3095 / 541.502.3436 / 541.250.3380 on cards |
| 8 | Valuation form never said what happens next | "A broker emails your written valuation within 24 hours, with the comps behind the number. No obligation." under the submit | rendered on /sell/valuation |
| 9 | Signup collected credentials with no terms | Consent line linking /terms + /privacy under Create account ([SignupForm.tsx](../../components/auth/SignupForm.tsx)) | rendered with both links |
| 10 | Mobile search input crushed to ~60px ("Ben") | Location input gets its own row on phones (`basis-full sm:basis-auto`) ([SearchFilters.tsx](../../components/search/SearchFilters.tsx)) | 390px viewport: input 366px wide |

Ratchet cleanups the gate required in touched files: `no-scrollbar` utility on the chip track, ladder-compliant widths (`w-screen max-w-sm`, `w-44`, `max-w-sm`), play-overlay `<button>` → design-system `<Button>`.

## Phase B — conversion opens (2026-07-08) ✅

| Item | Fix | Verified |
|---|---|---|
| Listing sidebar never stuck | `.kb-root` `overflow-x: hidden` → `clip` (hidden made kb-root the sticky containing block) | sidebar pinned at 96px at 50% scroll; 0px horizontal overflow on 6 kb pages at 390px |
| One CTA row for every intent | KbHero gains `cta`/`ctaSecondary` props (default unchanged). /sell: "What's my home worth" filled + Browse ghost, search bar off; /sell/valuation: "Get my home value" → form anchor; /contact: "Send a message" → form anchor | DOM: all three heroes render intent CTAs, zero buyer search bars |
| /sell ask buried ~11 screens | Early CTA section after SellValueProps (y≈1777 on mobile) + LP-style sticky mobile bottom bar (valuation + call) | both render; sticky bar pinned to viewport bottom |
| Tour CTA dumped buyers on a blank form | intent=tour on all three listing CTAs; /contact renders the property card (photo, address, price, beds/baths, link back); tour-time select; "Request a tour" submit; intent-aware success copy | E2E: listing → Schedule a tour → card "63177 Iner, Bend $742,000 · 3 bd · 2 ba" + tour field + tour submit |
| Sign-in modal fired over the tour form | /contact + /sell/valuation added to SignInPrompt suppression (lead forms are never interrupted) | E2E re-run: no modal on the tour form |
| Tumalo tile rendered a bare name | KbExploreTowns renders "0 Active" instead of hiding the ledger | /housing-market: "Tumalo 0 Active" |

Ratchet cleanups: ContactForm labels → `text-primary`; sell sticky bar `tracking-widest`; PriceCtaStrip/TextMattCTA arbitrary text sizes → ladder (`text-4xl/lg/sm/xs`, `leading-relaxed/normal`); PriceCtaStrip registered in `.design-token-lint-ignore` for its two KB `.btn` controls (same exception class as components/site/kb/).

## Phase C — market-stat pipeline unification (2026-07-08) ✅

The 788-vs-500 investigation: geo_snapshot_mv counted by the MLS City field and included Active Under Contract; market_pulse_live (the methodology-versioned canonical) counts Active + Coming Soon SFRs inside the city GIS polygon. One metric, two definitions, same label.

| Item | Fix | Verified |
|---|---|---|
| Same stat, different number (P0) | City-level snapshots in the DAL now override count/median/pending from market_pulse_live when a pulse row exists; MV stays the resilient base + the community/neighborhood source. Cache keys bumped (geo-snapshot v3, cities-index v3) | Homepage and /housing-market both render "Bend 501 ACTIVE $775,000 median" — byte-identical |
| Pronghorn "$194K median" (P1, §0) | Migration `20260708090000_geo_snapshot_mv_sfr_medians.sql` (applied to hosted): PropertyType='A' + SFR subtype on every median block; Active definition aligned to the pulse (AUC counts as pending) | SQL: bend:pronghorn = 13 active, median $1,595,000; Brasada $1,799,900 |
| 11 flagship resort rows rendered em-dashes (P1) | /communities join gains label-only fallback (registry-city vs MLS-city mismatches) + city-row fallback (Sunriver/BBR/CRR are MLS cities) + honest "0 active" default for registry resorts | All 14 resort cards carry numbers (Sunriver 58/$938K from the pulse; Widgi Creek honest 0 — zero matching actives confirmed in SQL) |
| Luxury page led with Costco land parcels (P1) | propertyType='A' on tiles + count | 213 homes (was 242 inflated); no land parcels render |
| "501+ homes in this area" (P2) | When the tile fetch caps, an uncapped count query (same filters, cached) supplies the exact header total; polygon path marks exact when the overfetch didn't cap | header reads "966 homes in this area" |
| Drift gate | New daily cron `/api/cron/market-stat-consistency`: (1) DAL city snapshots must equal their pulse rows, (2) pulse freshness < 2h, (3) bend:pronghorn SFR-median sentinel (> $500K). Alerts Matt via the ops-email pattern; registered in vercel.json | route + alert helper + email-gate allowlist + full ci:gates green |

Gate ratchet: poison-null `// poison-null-ok` marker on the restructured genuine-miss branch; hydration-safety marker on the submit-handler session read; file-size baseline refresh (+30 lines of real logic); market-stat alert classified internal in email-quality NON_SENDER.

## Phase D — seam continuity, curation, media states, signup, addresses (2026-07-08) ✅

| Item | Fix | Verified |
|---|---|---|
| Featured cards painted black while video buffered | Photo stays visible until the video/iframe signals frames (onLoadedData/onLoad + opacity crossfade) | video mounts behind visible photo, fades in at opacity 1 |
| Register seam dropped account affordances + changed nav vocabulary | KbNav inline: "Homes" label (portal-aligned) + "Account" link; overlay gains a "Your account" group (Saved homes / Sign in) | desktop inline + mobile overlay both render; first menu link still reachable |
| No way back to results from a listing | ResultsStamp (sessionStorage, written by both results pages) + BackToResults link on listing detail — renders only for from-results arrivals, restores exact filters | E2E: direct landing clean; from-results shows link; click returns to /homes-for-sale?city=Bend&beds=3 |
| Featured homes = six $5.9M–$11.9M cards for a $740K audience | curateFeaturedTiles: 2 luxury heroes + the home closest to each town's live median + fill, deduped by street/subdivision; grid sized to 9; acreage renders when ≥1 ac (the $11.75M ranch now shows "1,248 ac") | grid: $11.75M, $5.95M, $689K, $7.5M, $775K, $515K, $548K, $938K, $719K |
| Signup silently dumped unconfirmed users on the homepage | signUpWithEmailPassword returns needsConfirmation when Supabase issues no session; SignupForm renders the check-your-email state; in-session signups go to /account | code-path + tsc (no live signup test — would create real hosted-auth users) |
| Addresses dropped the street suffix | streetSuffix pulled from listings.details jsonb in getListingDetail (cache v5); detail H1 + title join it; canonical comma added ("63177 Iner Loop, Bend, OR 97701") | title + H1 verified in browser; card-level suffix spun off as a task chip (needs listing_tile_mv column) |
| The invisible-CTA bug class had no gate | New `ci:css-layers` gate (scripts/check-css-cascade-layers.mjs): un-layered bare-element link/button color rules fail CI; 11 intentional chrome rules baselined; wired into ci:gates | gate green; new offender simulation fails |

## Phase E — P2/P3 register sweep (2026-07-08) — IN PROGRESS

Open P1s closed in this phase (each browser-verified): /cities + /communities overlay crumbs + compact-hero clearance (cream-strip nav collision), /buy mobile hero overflow (compact height now ≥760px only), community pages inventory-first (Tetherow first listing card at 1.3 viewports, was 10+), FAQ cost question, market HUD stat explainers, communities rail scroll-padding.

**Triage of all 182 P2/P3 register items** against the remediated codebase (11 parallel verify agents, file:line evidence per verdict):
- **31 fixed** by the phase A–D class fixes
- **150 still open** (134 small, 16 medium) — being fixed by the parallel worktree fan-out; per-item outcomes recorded below when it lands
- 1 item reclassified during triage (component capped reviews at 6 since June; the mobile-wall aspect stays open)

**Wave 1 applied (commit 9f08ecf4):** home (16 items) + sell-core (11 items) — 25 patched, 2 product-decision skips resolved by the lead per Matt's delegation: primary nav keeps "Communities / Cities" (plain-English labels; renaming primary nav churns SEO for a P3 gain), and the locked hero line stays (an Amboqia glyph nit does not justify changing approved brand copy).

## Phase F — final review pass — PENDING
