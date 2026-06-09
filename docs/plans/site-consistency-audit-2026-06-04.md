# Ryan Realty site-consistency audit — 2026-06-04

Date: 2026-06-04
Status: DRAFT. Nothing committed, no files changed, no gates re-baselined. This is the synthesis deliverable only. Every item below is a proposal for Phase 3, not an applied change.

Scope: the full Ryan Realty web property and the systems that feed it. Six coverage areas — the route ledger (all 158 app/**/page.tsx routes), gate-baseline debt (the ratcheted check-*.mjs gates), knowledge-layer drift (where rendered facts diverge from their canonical store), the legacy kill-list (dead scripts, retired tokens, orphan exports, cold tables, stale docs), systems coherence (the marketing-brain producer pipeline and the data/analytics/FUB/ads/SEO plumbing), and the performance and competitive baseline (telemetry the optimization loop will read).

Method: a 16-agent read-only mapping workflow. Each agent owned one coverage slice, read source directly, and produced file:line findings. A separate adversarial pass then re-checked each flagged finding against the source and returned a verdict of confirmed, partial, or refuted. This report is built only from confirmed and partial findings. Refuted findings are listed in the appendix as investigated-but-not-substantiated and are treated as not real.

Prior art: the 2026-06-03 site audit established render-health (96 of 97 routes healthy) and green gates as separate baselines. This audit does not restate that. It maps the drift that sits behind the green gates — the surfaces the gates do not yet cover.

> **Corrected and extended by the completeness companion (`site-consistency-audit-2026-06-04-completeness.md`).** This pass had two blind spots, now closed. Overrides:
> 1. **"Competitive = no data" is FALSE.** `competitor_intel` holds 3,568 Apify-funded rows across 22 competitors. The asset exists; its cron has been DEAD 13 days.
> 2. **"Telemetry thin / barren" is OVERSTATED.** Behavioral capture is rich and writing now (`activity_events` 16,489, `visits` 4,978, `user_events` 5,037, `engagement_metrics` 3,738). Reframe as "rich capture, thin consumption."
> 3. **`listing_history` is 3,875,292 rows, not 3,330** (a stale `pg_stat` estimate was used as ground truth).
> 4. **Cluster 9 extends to cron-runtime-health: 14 of 29 crons are broken** (6 DEAD, 2 VOID, 6 STALE) in ways a `vercel.json` membership check cannot see — including the `loop-health-check` watchdog itself, which has never recorded a single observation.
> 5. **A whole persisted-asset + spend layer was omitted:** 16 live Meta audiences (25,364 hashed rows), 18,716 competitor ads in `out/design-recon`, and ~$468 of BatchData + NeverBounce spend the `marketing_cost_ledger` ($8.42, Anthropic-token-only) never recorded. See the companion for the full inventory.

---

## Executive summary

The site renders and the gates are green, but the green is narrow. Of 158 routes, only 10 carry a design-parity contract, so roughly 148 routes can drift in layout, typography, and copy without any mechanical objection. The drift is not random. It clusters into a small number of classes that each recur across dozens of files: a legacy hero component that drops the Amboqia display type, banned brand-voice words sitting in public metadata, broker and brokerage facts hardcoded into JSX instead of read from their canonical store, retired fonts and gold hex surviving in email and PDF code that the design-token gate does not scan, and a marketing-brain pipeline whose producer registry has fallen out of sync with the routing maps that feed it. Underneath, the optimization loop the business is supposed to learn from has never closed a cycle: content_performance has zero rows, the north-star seller-lead column is hardcoded to 0, and several measurement crons exist as route files but are not scheduled in vercel.json.

The loop must move four scoreboard numbers. First, the gate baselines down — 211 brand-voice violations, 164 design-token violations, 87 page-DAL routes, 47 hydration-safety files, 38 canonical-listing files, 26 tool-discipline violations, 20 static-params routes (the gates ratchet against new violations but none are trending to zero). Second, contract coverage up — from 10 parity contracts toward the ~148 uncovered routes, starting with the money-path surfaces. Third, the business metric up — attributed seller leads, which currently cannot rise because the table that holds it is empty and the column is stubbed. Fourth, review escapes to zero — every recurrence-prone class below needs a mechanical gate so the next edit cannot reintroduce it. The highest-value work is not fixing the individual instances. It is locking each class with a gate so the fix is permanent.

---

## Verified headline metrics

- 158 app/**/page.tsx routes total (ground truth). 10 parity.json contracts (ground truth), so roughly 148 routes carry no design-parity contract. This is the drift surface.
- 17 ui_kit mockup dirs (ground truth). 39 scripts/check-*.mjs gate scripts (ground truth). Gates documented G1..G36 + G-runtime (ground truth).
- Route ledger 1 of 4 (public/marketing): 57 routes scanned, 5 carry an in-scope contract, 52 do not. Traceable to the per-route table in the route-ledger finding.
- Geo route ledger: 17 geo routes scanned, 4 contracted, 13 uncontracted.
- Gate-baseline grandfathered debt (read from the baseline JSON files): brand-voice 211 violations across 151 files; page-DAL 87 routes; design-tokens 164 violations across ~118 files; hydration-safety 47 files; tool-discipline 26 violations; static-params 20 routes; canonical-listings 38 files. DAL-boundary 0, mockup-parity 0, community-content 0 (three gates with cleared debt).
- Gate-catalog drift: 39 check-*.mjs scripts, but G37/G38/G39 are self-declared in scripts yet absent from the G1..G36 catalog, and roughly 10 more scripts run in ci:gates with no catalog row.
- Underscore scripts: 218 underscore-prefixed scripts in scripts/, of which 180 are git-untracked one-offs with no sweep gate.
- Marketing-brain registry: REGISTRY.md lists roughly 76 to 80 brain-callable producers; inbox-producer-registry.ts covers 49 action_types; FORMAT_ROUTE_MAP covers roughly 40 formats. All 52 build_*.py producer scripts fail the G22 producer-guard opt-in.
- Telemetry: content_performance 0 rows; optimization_runs 0 rows; marketing_brain_actions 50 rows (32 killed, 14 executed, 4 in_production, 0 measured); marketing_channel_daily 39,128 rows across 10 channels, freshest 2026-06-03; visitor_sessions 66 rows, fresh to 2026-06-04.
- Lighthouse CI (most recent local run): 3 of 3 assertions failed. /about performance 0.81 (LCP 2.0s), listing-detail SEO 0.83, homepage performance 0.85 (LCP 1.58s). Core Web Vitals have no collection path in the codebase.

---

## Root-cause clusters

Each cluster is a class, not a symptom. Clusters are ranked by value, defined as reach times severity over effort. For each: the root cause, the instance count and representative file:line instances, the blended severity, the fix type, and the mechanical gate that would lock it.

### Cluster 1 — Money-path routes have no design-parity contract

Root cause: the mockup-parity gate (G6) was introduced for the Wave 3 rebuilds and only 10 routes were ever wired to a parity.json. Every route that predates the gate, or was never wave-migrated, carries no enforceable design contract. Roughly 148 routes sit on this surface.

Instances (representative): app/housing-market/[...slug]/page.tsx (the live per-city market ranking page, four raw stat cards, no site-v2 blocks, no JSON-LD); app/compare/page.tsx (client-facing comparison tool, no ui_kit dir at all); app/lp/buyer-listing-alerts/page.tsx and app/lp/expired-listing/page.tsx (active paid-ad landing pages, allowlisted with no parity.json); app/buy/page.tsx and app/contact/page.tsx (homepage-linked conversion pages). The market-report ui_kit mockup exists at design_system/ryan-realty/ui_kits/market-report/index.html but has no parity.json and has been allowlisted since 2026-05-28.

Blended severity: P0/P1. The market ranking page and the paid-ad LPs are revenue surfaces.

Fix type: contract. Author parity.json for each money-path route, ranked by traffic and conversion role.

Gate to lock: G6 (check-mockup-parity.mjs) already fires on contracted routes. The lock is to add the contracts, then remove the corresponding entries from scripts/mockup-coverage-allowlist.json so G7 (check-mockup-coverage.mjs) flags any future mockup that ships without a contract. A coverage target (for example, every route under app/lp/, app/housing-market/, app/buy/, app/sell/ must carry a contract) converts the backlog into an enforced ratchet.

### Cluster 2 — ContentPageHero and ad-hoc navy heroes drop the Amboqia display type

Root cause: components/layout/ContentPageHero.tsx renders the page H1 as a raw Tailwind class string and does not use DisplayHeading from components/site/primitives, so it never loads the Amboqia display face. HeroBlock (the canonical Wave 3 hero) does. Pages on ContentPageHero, plus several pages that hand-roll their own bg-primary navy section with a raw h1, look plainer than the contracted pages and carry no Amboqia.

Instances (representative): components/layout/ContentPageHero.tsx:51 (raw h1 class) feeding 14+ routes including buy, contact, blog index, open-houses index, reports index, area-guides, faq, tools/mortgage-calculator, housing-market hub. Ad-hoc navy heroes: app/sell/valuation/page.tsx:27-40, app/activity/page.tsx:44-67, app/our-homes/page.tsx:34-63, app/reviews/page.tsx:31-37. Raw section headings without the H2 primitive: app/buy/page.tsx:81,126,160,194.

Blended severity: P1. High reach, visible brand inconsistency on linked pages.

Fix type: refactor. Migrate ContentPageHero callers to HeroBlock with DisplayHeading; replace ad-hoc navy sections with HeroBlock.

Gate to lock: a new gate that asserts every page-level H1 resolves through the DisplayHeading/HeroBlock path (or carries the font-display class), failing any raw h1 in a route file. This is the typography analogue of the parity contract and would catch the next ad-hoc hero before it ships.

### Cluster 3 — Banned brand-voice words live in public metadata and hero copy

Root cause: brand-voice drift on pages that were never wave-migrated. The check-brand-voice gate (G3) ratchets against new violations but grandfathers 211 existing ones, and those grandfathered files are the template the next edit copies.

Instances (representative): app/join/page.tsx:12,28 ('passionate' in the meta description and hero); app/buy/page.tsx:18,130 ('dedicated', 'journey', 'lifestyle you'll love' in metadata and body); app/reviews/page.tsx:37 (overt virtue statement); lib/share-metadata.ts:110,95 ('Your next home awaits!' and "Don't miss this one!" in pre-filled listing share text). Grandfathered backlog: brand-voice-baseline.json total 211 across 151 files, heaviest in components/PlaceAboutTabs.tsx (14) and app/about/page.tsx (12).

Blended severity: P1. The metadata instances surface in Google search snippets.

Fix type: deletion of the banned phrases; refactor of the share-text builder.

Gate to lock: G3 already exists. The lock is to extend its scan to metadata description strings and pre-filled share-text utilities in lib/, then drive the 211-violation baseline down on a file-by-file sweep and re-baseline after each file reaches zero. The gate becomes a ratchet that must monotonically decrease.

### Cluster 4 — §0 data-accuracy violations: unverified stats and hardcoded market numbers

Root cause: numbers copied into prose from earlier drafts or pasted as static text next to a live KPI source that is never read. CLAUDE.md §0 mandates every number trace to a named primary source.

Instances (representative): app/sell/plan/page.tsx:52-54 ('self-listed homes in Central Oregon often sell for 10% to 26% less' — no source, on the conversion-focused sell funnel); app/lp/central-oregon-golf/page.tsx:932 ('Pronghorn condos run $1.77M average and ticked +14% YoY' — static text that does not read loadGolfCommunityKpis, which queries market_stats_cache for the pronghorn slug). Drive-time conflict: app/lp/tetherow/heath/page.tsx:591 says 22 minutes to Mt. Bachelor while app/lp/central-oregon-golf/page.tsx:586 says 20 minutes for the same Tetherow-to-Bachelor route.

Blended severity: P0. The brokerage cannot produce a source if challenged.

Fix type: deletion of the unverified stat; refactor to wire the Pronghorn card to the live KPI loader; reconcile the drive-time values to a single source.

Gate to lock: a content-provenance gate extension that flags percentage and dollar-figure literals in route and LP files unless they sit adjacent to a cited source or a live-data interpolation. A check-content-provenance.mjs already runs in ci:gates; widen its pattern to numeric claims in prose.

### Cluster 5 — Broker and brokerage facts hardcoded instead of read from their canonical store

Root cause: identity facts (phone, license, broker name, email, founding date, social handles) are scattered as literals across the site instead of read from public.brokers and brokerage_settings, even where the DAL already fetches them. The columns exist and are fetched but discarded at the call site.

Instances (representative): two phone numbers hardcoded across 20+ files (lib/listing-cta.ts:6-7, components/site/SiteFooter.tsx:76, and the LP routes); license #201206613 hardcoded in 7 places (SiteFooter.tsx:149, tetherow and bend LPs, about page); broker name and email hardcoded in FUB outreach templates (app/api/cron/fub-outreach-execution/route.ts:74-109); founding date '2023-06-21' in components/JsonLd.tsx:84; social sameAs array static in JsonLd.tsx:20-28 while brokers.social_* columns are fetched and unused. brokerage_settings.primary_phone and primary_email are fetched by getBrokerageSettings but never used for display. NEXT_PUBLIC_SITE_PHONE is registered in lib/env.ts:20 and consumed nowhere.

Blended severity: P1. A single license or phone change requires edits in dozens of files and is certain to leave stale copies.

Fix type: refactor to a single resolver; deletion of the dead env var.

Gate to lock: a knowledge-layer gate that fails any phone/license/email literal matching the known brokerage values outside the canonical DAL resolver. This makes the scatter mechanically impossible to re-introduce.

### Cluster 6 — Ratcheted gates grandfather a large invisible backlog that never trends down

Root cause: the ratchet pattern blocks new violations but does not require existing ones to shrink. The baselines are frozen, and a grandfathered file is the ambient template the next edit copies.

Instances (totals read from baseline JSON): brand-voice 211, page-DAL 87, design-tokens 164, hydration-safety 47 (each a latent React #418 bomb on an ISR-cached page), canonical-listings 38, tool-discipline 26, static-params 20. design-tokens-baseline.json was regenerated as recently as 2026-06-04 with no decrease.

Blended severity: P1/P2 blended. Individually low, collectively the largest source of slow drift.

Fix type: refactor (the sweeps) plus new-gate (the enforcement).

Gate to lock: convert each ratchet from monotonic-no-increase to monotonic-decrease with a posted floor that steps down on a schedule. The hydration-safety 47 should be prioritized because each file is a site-wide breakage risk, not cosmetic.

### Cluster 7 — Retired design tokens and fonts survive in email/PDF/lib code the token gate does not scan

Root cause: G24/G26 (lint-design-tokens.js) scans only SOURCE_DIRS app/ and components/, and its font regex anchors on `font-family:` so it misses CSS custom-property declarations of retired fonts. Retired tokens therefore survive untouched in lib/ and in CSS variable definitions.

Instances (representative): app/lp/tetherow/page.tsx:1398-1399 defines --rr-font-display: 'Playfair Display' and --rr-font-sans: 'Inter' at :root, cascading retired fonts into the whole Tetherow LP and evading the gate; components/lp/ListingCard.tsx:191 uses Playfair Display for the price on every listing tile; lib/pdf/report-pdf.tsx:10-25 registers 'AzoSans' and 'Amboqia' families backed by Inter woff files; lib/cma-delivery.ts:694,745 uses Helvetica Neue in CMA emails; lib/fsbo-alert.ts:71 uses retired #e8e2d4; app/api/cron/marketing-optimization-report/route.ts:123-126 uses gold #D4AF37 and Inter in an HTML email; components/pulse/BrandCard.tsx:137 uses retired #0a1a2e.

Blended severity: P1/P2. Client-facing email and PDF surfaces.

Fix type: refactor the live usages; new-gate for the scan gaps.

Gate to lock: extend lint-design-tokens.js SOURCE_DIRS to include lib/, and add a regex that catches retired fonts in CSS custom-property declarations (not just `font-family:`). Then drive the 164 baseline down.

### Cluster 8 — Marketing-brain registry is out of sync with the routing maps that feed it

Root cause: the producer registry (REGISTRY.md, roughly 76 to 80 producers) was extended on 2026-05-16/18, but the two routing maps that the runtime reads were never updated. New action_types fall through to a wrong-producer fallback and route silently.

Instances (representative): lib/marketing-brain/inbox-producer-registry.ts covers 49 action_types and is missing roughly 51 (any inbox email mapping to content:newsletter, site:community_page_create, comms:client_weekly, analyze:competitor_scan routes to comms:matt_alert instead); generate-briefs.ts FORMAT_ROUTE_MAP at line 2421 covers roughly 40 formats and is missing roughly 30 (new formats fall back to content:<format> assigned to automation_skills/content_engine); analyze:competitor_scan/report are absent from inbox-producer-registry.ts entirely; analyze:audit_findings is queried by generate-briefs.ts:783 but has no producer to create the rows, so the brain's learning loop runs without competitive-format intelligence.

Blended severity: P1. Silent mis-routing of pipeline work.

Fix type: refactor to re-sync the two maps from REGISTRY.md; new-gate to keep them synced.

Gate to lock: a registry-sync gate that fails CI when REGISTRY.md action_types are not all present in both inbox-producer-registry.ts and FORMAT_ROUTE_MAP. This turns the manual mirror comment into an enforced contract.

### Cluster 9 — The optimization loop has never closed: empty metric tables and stubbed north-star

Root cause: the measurement crons exist as route files but several are not scheduled in vercel.json, the per-post metric fetchers are stubs, and the north-star column is hardcoded. The loop the business is supposed to learn from has never produced a measurement.

Instances (representative): content_performance has 0 rows; performance-pull-48h/7d/30d and optimization-loop and marketing-optimization-report are absent from vercel.json; lib/meta-graph.ts:1083-1088 fetchMetaPostMetrics throws unconditionally; lib/ga4-data-api.ts:17-31 is a stub returning zeros (real GA4 flows through app/actions/ga4-report.ts, so the stub is dead but misleading); app/api/cron/performance-pull-48h/route.ts:129 writes north_star_attributed_seller_leads: 0 unconditionally with no follow-up cron to update it; marketing_brain_actions has 0 measured rows of 50.

Blended severity: P0. This is the business metric the loop must move.

Fix type: refactor (implement the fetchers, wire the attribution follow-up); new-gate (schedule-presence check).

Gate to lock: a gate that asserts every cron route file under app/api/cron/ that writes a metric table is present in vercel.json, and a freshness gate that fails if content_performance has no row newer than N days once the pipeline is live. Until then the gap is explicit (see the performance section).

### Cluster 10 — Seller-lead attribution tag schema is split, so canonically-tagged leads are never attributed

Root cause: canonical-lead-tagger.ts emits audience:seller and seller:nurture/hot/warm, but the seller-lead-attribution cron detects seller intent from a different tag set (hot-seller, warm-seller, seller, seller-lead). The canonical tags are not in the detection set.

Instances: lib/canonical-lead-tagger.ts:204-208 (tags produced) versus app/api/cron/seller-lead-attribution/route.ts:39-47 (SELLER_TAGS detection set). Also lib/fub.ts uses system 'ryan-realty-platform' while lib/followupboss.ts uses 'Ryan Realty Website' / 'ryan-realty.com', so no single FUB filter catches all site events. fbclid is captured client-side but never forwarded to the server-side generate_lead event, breaking Meta cross-channel attribution.

Blended severity: P1. Directly suppresses the attribution number.

Fix type: refactor to a single tag schema and a single FUB system string; add fbclid to the server event.

Gate to lock: a contract test asserting the tagger's output tags are a subset of the attribution cron's detection set, and a single shared constant for the FUB system string.

---

## Per-dimension detail

### 1. Route ledger

Public and marketing routes (57 scanned, 5 in-scope contracts): full per-route contract table is in the route-ledger finding. Highest-priority uncovered conversion/SEO routes: buy, contact, blog, open-houses, reports, area-guides, faq, reviews, our-homes, sell/valuation, sell/plan, team/[slug], motivated-sellers, schools, parks. Confirmed instance issues: app/sell/plan/page.tsx:52-54 unverified stat (P0); app/reviews/page.tsx hand-rolled hero with virtue copy; app/join, app/buy banned brand-voice; app/our-homes/page.tsx:115 raw img tag bypassing next/image; app/videos/page.tsx no page-level H1 and missing canonical alternates. app/compare/page.tsx:2 carries a dead createClient import (partial: real dead import, but it does not trip G1 since check-dal-boundary.mjs scans only .from() calls, not imports).

Geo routes (17 scanned, 4 contracted): housing-market/[...slug] is the standout — a money-path ranking page with zero contract, zero site-v2 blocks, no generateStaticParams, no AI-citable JSON-LD. housing-market hub and central-oregon pages use legacy ContentPageHero. The neighborhood parity.json is minimal (4 components) versus city/community (12-13), so a rebuild could drop the MarketSnapshot stat band or boundary map without failing G6. cities/page and communities/page index pages still import from the legacy components/city and components/community directories. The G7 allowlist carries 8 stale entries (contracts that now exist).

Listing/search/compare/buy-intent: the listing-detail parity contract is fully satisfied (all 17 components present) — a reference for the rest of the site. search/page.tsx satisfies its 3-component contract. compare has no contract and no mockup, hardcodes hoa: null and taxes: null (correct for listing_tile_mv, but could be supplemented from getListingDetail), and has no timeout guard on its DB fetches unlike every other listing surface. buy/[intent] has no generateStaticParams despite reading from static config. Dead imports: getMarketStats in listing/[listingKey] and createClient in compare.

LP/account/dashboard/admin: 3 LP mockups (seller-lp, buyer-alerts-lp, expired-lp) are allowlisted with no parity.json. The expired-listing LP is missing LandingPageTracker, so its page views are not attributed. The bend LP imports zero shadcn components and hand-rolls all layout in a 150-line inline style block; the golf LP has an 82-line inline style block. Both escape the design-token gate. Inventory only: account 7 routes, dashboard 10, admin 58.

### 2. Gate-baseline debt

Read directly from the baseline JSON files. Non-zero (tightenable): brand-voice 211, page-DAL 87, design-tokens 164 (regenerated 2026-06-04, not decreasing), hydration-safety 47, canonical-listings 38, tool-discipline 26, static-params 20. Cleared (zero): DAL-boundary, mockup-parity, community-content. Snapshot-only (not a violation ratchet): bundle-budget (3.79 MB total, 156 chunks). The hydration-safety 47 is the most dangerous backlog because each file is a latent React #418 site-wide breakage, not a cosmetic issue.

### 3. Gate-catalog coherence

39 check-*.mjs scripts. check-missing-videos.mjs and check-video-urls.mjs are one-shot dev scripts masquerading as gates (read .env.local directly, not in ci:gates) and pollute the gate count. G37/G38/G39 (hydration-safety, csp, db-timeout-guard) are self-declared in scripts and wired into ci:gates but absent from the G1..G36 catalog. Roughly 10 more scripts run in ci:gates with no catalog row (maps-safety, nav-reachability, canonical-listings, no-mojibake, no-staging-host, content-provenance, untracked-imports, internal-links, seo-authoring). The MECHANICAL_GATES.md ci:gates prose at line 58 omits 10 scripts actually in the chain. check-supabase-migration-drift runs as a pre-push hook with no catalog row. package.json line 69 has a minor formatting bug (`&&npm` missing a space).

### 4. Knowledge-layer drift

Geo SEO columns: cities.seo_title/seo_description and communities.seo_title/seo_description are never read — both generateMetadata functions hardcode template strings (app/cities/[slug]/page.tsx:88, app/communities/[slug]/page.tsx:82-84). The DAL select lists omit the columns. The neighborhood route is the correct reference: it fetches and uses seo_title/seo_description (getNeighborhoodMetadata.ts:36, used at the neighborhood page generateMetadata), and all 13 neighborhood rows are populated. cities.description and communities.description are fetched but never rendered as on-page prose; neighborhoods.description is fetched, mapped, and also dropped. The zip route correctly uses template-only metadata (no DB table exists for it). No gate enforces that geo generateMetadata consumes DB seo columns, so the drift will silently recur on any new geo route.

Fact scatter (covered as Cluster 5): phone, license, broker name/email, founding date, social handles. Resort content has a triple source: 27 data/resort-community-*.json files, the communities.resort_content JSONB column (fetched but unused at render), and an in-memory map in lib/community-content.ts. The Heath LP and Tetherow course ranking are mirrored manually with "mirror here on the next PR" comments — synchronization debt.

### 5. Systems coherence

Marketing-brain registry sync is Cluster 8. Additional confirmed items: the cron schedule comments claim 15/30/10-minute cadence but vercel.json fires producer-dispatcher, producer-runtime, and publisher-sweep once per hour each, so worst-case row-to-publish latency is roughly 3.5 hours; all 52 build_*.py scripts fail the G22 producer-guard opt-in (the guard exists but no producer calls require_action_row, and the gate only fires on staged diffs so it has never blocked anything); 10 SKILL.md files have duplicate output_type frontmatter and cma-narrative declares both text and document so it is misclassified as visual and stalls; producer-dispatcher writes a hardcoded local Mac path into production rows; the weekly-cycle alias route is not scheduled and has diverged from the canonical route. CLAUDE.md references an audit file (registry-reconciliation-2026-05-22.md) that does not exist on disk, and its "43 producers" count is stale against the live 76 to 80.

Data/analytics/FUB/ads/SEO is Clusters 9 and 10 plus: the createSellerLead DAL function is a stub that throws unconditionally (a refactor that imports it would fail silently); the GA4 Data API stub returns zeros (dead but misleading); Meta API version is split across three files (v21.0 CAPI, v21.0 marketing, v25.0 graph); ga4_query_cache.hit_count is written as 0 unconditionally (dead metric); 10+ generateMetadata implementations bypass the pageMetadata helper, risking localhost canonicals; the FUB user ID for Matt is a magic number (1) in canonical-lead-tagger bypassing the existing env-var resolution path; listing-detail JSON-LD has no dateModified field while city/neighborhood pages correctly wire it.

### 6. Performance and competitive baseline

See the dedicated section below.

---

## Legacy kill-list

| Item | Verdict | Risk | One-line reason |
|---|---|---|---|
| 21 _nordic-* scripts (1 tracked) | Remove untracked; investigate the 1 tracked | low | Completed SkySlope compliance one-off; no non-underscore script imports them |
| 16 _ordway-* scripts (11 tracked) | Remove untracked; investigate tracked | low | Completed compliance run; tracked files are a reusable audit workflow worth reviewing |
| 23 of 25 _skyslope-* probe scripts | Remove probes; keep _skyslope-login-capture and _skyslope-list-folder-docs | low | login-capture is a session dependency for 3 other scripts; the rest are UI probes |
| 13 untracked _shot-* scripts (keep _ds-shot, _live-shot, _mockup-shot) | Remove route-specific; keep reusable harnesses | low | Reusable visual-QA harnesses worth promoting; route-specific runs are disposable |
| _712 (25), _bear (11), _ochoco-way (7), _crowson (3), _huntington (3), _kwinnum (1), _jeanette (2) | Remove | low | Completed single-property compliance pipelines; zero importers |
| 15 _fub-* scripts | Remove | low | Completed FUB data ops; ap69/ap70 are action-plan-specific mutations |
| 12 _cma-228-* scripts | Remove | low | Built one CMA for 228 Soft Tail; the live route remains, the build scripts are spent |
| 4 _agentfire-* scripts | Remove | low | Completed AgentFire migration extraction |
| _render-* v3-v9 plus variants (keep v10) | Remove old versions | low | Iteration history; v10 is the tracked, current version |
| 21 farm-merge-* / westside-bend-* scripts | Remove | low | Completed Westside Bend farm-list-to-FUB pipeline |
| ~25 misc underscore one-offs | Remove | low | Confirmed zero importers; completed single tasks |
| _voice_lib.py, _producer_lib.py, _apply_brand_*.{py,mjs} | Keep | n/a | Shared libraries actively enforced by G36/G22 gates; pipeline utilities |
| _audience-design-proof, _route-audit, _orea-license-lookup | Investigate | low | Git-tracked, no current callers; orea-license-lookup may be worth promoting |
| Retired fonts/tokens in lib/ and CSS vars | Refactor (see Cluster 7) | medium | Client-facing email/PDF; gate does not scan lib/ or CSS custom properties |
| getMegaMenuData + 11 MegaMenu* types | Remove | low | Exported from DAL index, zero consumers; menu uses static MENU array |
| lib/meta-pixel.ts (4 exports) | Remove | low | Whole module dead; MetaPixel.tsx uses inline fbq instead |
| pickSurfaceImage, getResortCommunitiesForCity, selectListingsAdmin DAL exports | Remove from index | low | Orphan DAL barrel exports, zero external consumers |
| getHomeHeroImage, getVacationRentalPotential | Remove | low | Exported, never called; VacationRentalPotential renders with projection={null} |
| app/actions/hero-videos.ts + 2 wrapper components | Remove | low | Entire tree wired to nothing |
| components/listing/ 56 of 58 files | Investigate then remove | medium | Pre-refactor cluster; active page uses components/site/listing-detail; verify the 2 live imports first |
| components/community 11/13, city 11/12, neighborhood 7/7 dead | Investigate then remove | medium | Refactor replaced them with components/site; partial verdict corrected the live-consumer counts |
| getSimilarListings, getRegionPulse sub-path imports | Refactor | low | DAL-boundary violations; add to lib/data/index.ts and import from the barrel |
| content_performance, expired_listings, fsbo_listings, listing_alerts, listing_alert_matches, market_narratives, reviews, content_calendar tables (0 rows) | Investigate, do not drop | high | Pipelines built but never executed or not scheduled; dropping would break a live cron path |
| listings_historical, ai_content, listing_shares, listing_views, user_activities tables (0 rows) | Investigate | medium | Suspected dead schema superseded by another table; confirm no writer before dropping |
| reporting_cache, listing_embeddings (in DAL, absent from schema snapshot) | Investigate | high | Schema drift: DAL functions reference tables not in the 2026-06-04 production snapshot |
| phase-0..6 briefs, master-plan, PRODUCT_SPEC_V2, continuous-improvement, USER_JOURNEYS, INDEX_MASTER_DEAL_PIPELINE, CROSS_AGENT_HANDOFF, SESSION_HANDOFF_2026-06-01 (PartA+B) | Archive | low | Superseded by the ultracode kickoff and the live gate/test system |
| data-architecture-plan, SITE_AUDIT_2026-06-03, GLOBAL_SKILLS_REGISTRY, task-handoff-template, ultracode-kickoff | Keep | n/a | Load-bearing architecture/process references; some need a freshness pass |

Note on cold tables: the database items are explicitly investigate, not delete. Several are part of live cron paths and removing them would break the pipeline. The two schema-drift items (reporting_cache, listing_embeddings) are the highest-risk because a DAL function calls a table the production schema snapshot does not contain, so the call fails silently or throws on execution.

---

## Performance and competitive baseline

This is the baseline the optimization loop will read. Real values are stated where an agent pulled them live. Everything else is an explicit GAP with the command or source to fill it. No placeholder is presented as fact.

### Pulled live (real values)

- marketing_channel_daily: 39,128 rows across 10 channels, freshest date 2026-06-03 (gsc one day behind at 2026-06-02 due to the GSC API reporting lag; meta_ads has only 32 rows from a 2026-05-19 start). Source: SELECT channel, COUNT(*), MIN(date), MAX(date), MAX(fetched_at) FROM marketing_channel_daily GROUP BY channel on project dwvlophlbvvygjfxcrhm.
- visitor_sessions: 66 rows, fresh to 2026-06-04T13:21Z, spanning from 2026-05-23 (roughly 5 to 6 sessions/day — thin for the 15-minute hot-lead escalation cron).
- marketing_brain_actions: 50 rows — 32 killed, 14 executed, 4 in_production, 0 measured. The loop has never reached the measured state.
- Lighthouse CI (most recent local .lighthouseci run): 3 of 3 assertions failed. /about performance 0.81, LCP 2.0s (worst page). listing-detail SEO 0.83, best-practices null. homepage performance 0.85, LCP 1.58s, TBT 0 ms, CLS 0.0004. Team page varies 0.91 to 0.99 (cold versus warm render). All non-listing pages score SEO 1.0.
- Channel ingestors confirmed wired and runnable today: GA4 (via app/actions/ga4-report.ts, 9 parallel reports), GSC (rolling 9-to-2-day window), Meta Ads (getMetaAdsInsights, account + campaign scope), FUB (people/events/deals). Env vars for all four are present in .env.local.

### Explicit GAP list (the baseline cannot be stated until these are filled)

- content_performance row count and freshness: currently 0 rows, max(pulled_at) NULL. The per-route per-date scoreboard does not exist yet. Fill: schedule performance-pull-48h/7d/30d in vercel.json, implement lib/meta-graph.ts fetchMetaPostMetrics (currently throws), then query SELECT COUNT(*), MAX(pulled_at) FROM content_performance.
- north_star_attributed_seller_leads: always 0 (hardcoded at app/api/cron/performance-pull-48h/route.ts:129). Fill: build the FUB-attribution follow-up cron that reads lead source and updates the column, then verify a non-zero value.
- CPL (cost per lead): no ingestor writes it; it is a cross-channel ratio. Fill: a view or scheduled query computing SUM(spend WHERE channel=meta_ads) / SUM(qualified_seller_leads WHERE channel=fub) per date from marketing_channel_daily.
- LCP and CLS as a tracked time series: no collection path exists (no @vercel/speed-insights, no web-vitals, no CrUX or PageSpeed Insights API call). The only LCP/CLS numbers available are the one-off Lighthouse CI run above. Fill: add a Core Web Vitals collector (Vercel Speed Insights or a CrUX API cron) writing to a metrics table.
- optimization_runs: 0 rows, optimization-loop cron not in vercel.json. Fill: schedule app/api/cron/optimization-loop and confirm rows appear.
- TikTok, Pinterest, Threads, Nextdoor per-post metrics: hard-skipped (oauth_not_wired) at performance-pull-48h/route.ts:52-56. Fill: wire the OAuth for each, or accept the gap explicitly.
- monitoring_alerts, site_signal, performance_loop tables: do not exist in the 2026-06-04 production schema snapshot. Fill: confirm whether they are planned-but-unbuilt or were renamed (snapshot lands in marketing_channel_daily).
- Competitor/competitive baseline: Apify is wired (token present) but competitor recon was not connected in this pass. Fill: run app/api/cron/marketing-competitor-recon and read the resulting rows. No competitor numbers are stated here because none were pulled.

---

## Coverage and gaps

What this audit did not reach (no silent truncation):

- No live server render of any housing-market route (would require a running server). HTML structure was read from source only.
- The 158-route total was not individually parity-checked; the route-ledger agents covered 57 public/marketing + 17 geo + the listing/search/compare/buy-intent + LP set, and counted account (7), dashboard (10), admin (58) as inventory only.
- Several gate scripts were not executed live; gate-baseline counts were read from the baseline JSON files, not re-derived from source.
- Marketing-brain: individual producer SKILL.md bodies were checked for frontmatter only; weekly-cycle.ts and measurement-loop.ts full bodies were not read; no live producer invocation was run.
- Telemetry: a fixed set of suspicious/low-row tables was queried; ga4_query_cache freshness, linkedin/tiktok token expiry, and the 10 individual marketing-snapshot-* route bodies were not audited.
- No live API call was made to GA4, GSC, Meta, or FUB. Env presence was checked by key name only, not by value or by a successful call.
- Competitor data was not gathered (Apify wired but not connected this pass).

### Appendix — investigated but not substantiated (refuted findings)

These were checked by the adversarial pass and are treated as not real. They are listed so they are not re-investigated.

- compare/page.tsx "may trip the G1 DAL boundary gate": refuted. check-dal-boundary.mjs scans only .from() pattern matches, not imports, and compare has no .from() calls. The underlying dead createClient import is real and is listed under the route ledger; only the gate-tripping claim was refuted.

No findings in the input carried a full "refuted" verdict beyond this one over-stated detail. The remaining non-confirmed findings were "partial" (real core, over-stated detail) and are folded into the clusters above with the partial detail corrected. The notable partial corrections: the _ordway tracked/untracked split is 11/5 not 8/8; the golf-LP drive-time conflict mis-attributed line 635 to Eagle Crest (it is Brasada Ranch); content_calendar is not fully dark (the comms and analyze legs run daily, only the content-publishing leg has never fired); several "no DAL function reads it" claims for cold tables were corrected because the readers live in app/actions/ outside the lib/data tree (reviews, email_campaigns, headshot_prompts, place_attractions, listing_inquiries, user_activities all have active app/actions readers); the components/city and components/community dead-file counts were nudged (city 11/12 dead, community live consumers are only CommunityCard and CommunitiesFilter).

---

## Ranked next actions

Phase 3 should attack these first, highest value to lowest. Each is tagged with its fix type and the gate it adds or tightens.

1. Wire content_performance, schedule the performance-pull and optimization-loop crons in vercel.json, and implement the FUB-attribution follow-up that populates north_star_attributed_seller_leads. fixType: refactor + new-gate. Gate: schedule-presence check (every metric-writing cron under app/api/cron must appear in vercel.json) + content_performance freshness gate. Moves the business metric.
2. Author parity.json for the money-path routes (housing-market/[...slug], the three LPs, compare, buy, contact) and clear the matching allowlist entries. fixType: contract. Gate: G6 + G7 with a coverage target for lp/housing-market/buy/sell. Moves contract coverage.
3. Re-sync inbox-producer-registry.ts and FORMAT_ROUTE_MAP from REGISTRY.md and add a registry-sync gate. fixType: refactor + new-gate. Gate: registry-sync (REGISTRY action_types must be present in both maps). Stops silent mis-routing.
4. Reconcile the seller-lead tag schema between canonical-lead-tagger and the attribution cron, unify the FUB system string, and forward fbclid to the server event. fixType: refactor + new-gate. Gate: tagger-output-is-subset-of-attribution-detection contract test.
5. Delete the §0 data-accuracy violations (sell/plan stat, Pronghorn static figures) and reconcile the drive-time conflict; wire the Pronghorn card to the live KPI loader. fixType: deletion + refactor. Gate: widen check-content-provenance to numeric prose claims.
6. Migrate ContentPageHero callers and ad-hoc navy heroes to HeroBlock/DisplayHeading. fixType: refactor + new-gate. Gate: a page-H1-uses-DisplayHeading gate. Moves brand consistency across 18+ routes.
7. Remove the banned brand-voice words from public metadata and the share-text builder; begin the brand-voice baseline sweep. fixType: deletion + refactor. Gate: extend G3 to metadata and lib share utilities, convert to monotonic-decrease.
8. Build the single brokerage-identity resolver and replace the hardcoded phone/license/email/founding-date/social scatter; delete NEXT_PUBLIC_SITE_PHONE. fixType: refactor + new-gate. Gate: a literal-detection gate that fails known brokerage values outside the resolver.
9. Extend lint-design-tokens.js to scan lib/ and to catch retired fonts in CSS custom properties; fix the live email/PDF/ListingCard usages; drive the 164 baseline down. fixType: refactor + new-gate. Gate: G24/G26 scope + monotonic-decrease floor.
10. Tackle the hydration-safety 47 backlog (each file is a site-wide React #418 risk) on a scheduled monotonic-decrease floor. fixType: refactor + new-gate. Gate: G37 with a stepped floor.
11. Reconcile the gate catalog: add G37/G38/G39 and the ~10 uncatalogued ci:gates scripts to MECHANICAL_GATES.md, fix the prose at line 58, move the 2 dev one-shot scripts out of scripts/, and add a sweep gate that caps untracked underscore scripts. fixType: contract + new-gate. Gate: catalog-completeness (every ci:gates script has a catalog row) + untracked-script cap.
12. Wire the geo generateMetadata to consume cities/communities seo_title/seo_description (the neighborhood route is the reference) and add a gate that fails any geo generateMetadata that hardcodes a template while DB seo columns exist. fixType: refactor + new-gate. Gate: geo-seo-column-consumption check.

Promotion debt that gates the rest: ultracode-site-consistency-kickoff.md has never been promoted to docs/DEVELOPMENT_PROCESS.md (Phase 4 step 1), so no check-process-canon gate can enforce that agents load the canonical process. Do this alongside action 11.
