I have all the load-bearing facts and the critique. The task is to produce the final report incorporating every must-fix item. This is a writing/synthesis task — I have everything I need. Producing the final markdown report now.

# Ryan Realty — Final Rebuild Status & Cutover Gate Report
**Prepared for:** Matt (owner) · **Date:** 2026-05-30 · **Principle:** gates, not prose — every recommendation traces to an enforceable check you can run, not a paragraph you have to trust.

> **DO THIS FIRST, BEFORE READING THE REST:** Run `ADS-18` right now — a live Graph `effective_status` check that all 5 ads in `act_1178780510184911` are still PAUSED. They link to a URL that 404s on the live site; a single accidental unpause spends real money on dead clicks with zero capture. Zero dependencies, do it today.

---

## 1. Executive status

**Website rebuild — BUILT, NOT LIVE, NOT SWAP-READY.** The new Next.js 16 / React 19 app is real and substantial: ~135 page routes, 150 API routes, DB-driven sitemap/robots, JSON-LD, consent-gated GA4+GTM+Meta Pixel, FUB lead capture, green production build (`npm run build` EXIT=0). But it lives only on `ryanrealty.vercel.app`. The apex `ryan-realty.com` still serves the legacy AgentFire/WordPress site (confirmed live: `x-powered-by: AgentFire.com`, `server: cloudflare`); the Vercel project shows `live:false` with the apex not attached; production `NEXT_PUBLIC_SITE_URL` is still the staging host, so every canonical/og/sitemap/FUB-source/CAPI URL is wrong; there are **zero** redirects for ~177+ legacy URLs; the sitemap emits ~33% soft-404 listings. There is no cutover runbook expressed as gates — only manual dashboard prose in `docs/DOMAIN_SETUP.md`. The Lighthouse gate is RED.

**Marketing brain + producer — DECISION LAYER REAL, PRODUCTION LAYER BROKEN.** The brain (audits → diagnose → `generate-briefs` → ranked rows in `marketing_brain_actions`) is real TypeScript and has produced 27 rows; the text-producer path runs end-to-end. But the **entire visual-producer half** (video/image/flyer/carousel/PDF) has no running execution path — it defers to `scripts/render-worker.mjs`, scheduled by nothing (one row stuck `in_production` for 9 days). `producer-runtime` does **zero** schema/brand-voice/citation validation before flipping a row to `ready`, and the publish bridge is broken: no producer emits the `mediaUrl`/`mediaType` that `/api/social/publish` requires, so **zero `content:*` social posts have ever published**.

**Ad workflow (Meta-primary) — DRAFTED, NOT LAUNCH-SAFE.** Five real PAUSED link ads exist in `act_1178780510184911`, custom audiences uploaded, correct CAPI+pixel dedup chain on the new site. But every ad links to `https://ryan-realty.com/lp/seller-home-value`, which **404s on the live site right now** (confirmed: 301 → `/lp/seller-home-value/` → 404). Two of five retarget pixel audiences that can never populate (the LP isn't live). The optimization/snapshot/attribution crons the canonical doc calls "live" are absent from `vercel.json`, so the decision loop never fires. Zero recorded ad-performance data; no single source of truth for ad strategy (3-campaign vs 6-tier conflict).

**Database — FAST BUT NOT VERIFIABLE, AND PARTLY EXPOSED.** Hot read paths are excellent and index-backed (region pulse 0.13ms, city tile 1.2ms); the 15-min refresh pipeline is green. But verifiability is violated three ways: canonical `getMarketStats` queries six columns that don't exist (42703 → null, still exported as a trap); the methodology version every doc names "current" (`v4-2026-05-15`) exists in **zero** production rows (data is `v3`/`v1-pre-fix`/NULL); the homepage renders an incoherent verdict (Months-of-Supply 6.95 "Buyer's market" badge next to 13 days-to-pending and a stored "Hot" health label). **Critically, security advisors flag a live data-exfiltration surface** the cutover is about to publish the anon key against: 6 SECURITY DEFINER views, an **anon-executable `_agent_schema_dump()` RPC**, and 5 **anon-readable materialized views** (including the ~590k-row listing MV).

**Lead plumbing & enforcement (cross-cutting) — WIRED IN CODE, UNPROVEN IN PRODUCTION, NEVER NURTURED.** Sophisticated FUB/CAPI/GA4 paths exist, but every lead-capture table is empty (`processed_meta_leads=0`, `marketing_assignments=0`, `valuation_requests=3` all stamped `vercel.app`), 0/44 visitor sessions ever stitched to a FUB person, and a committed audit shows **3,492 seller-tagged people with 0 enrolled** in any FUB action plan — the funnel's output stage is open-loop. The "gates not prose" principle is itself unenforced: CI never runs `npm run ci:gates` (confirmed: 0 references in `.github/workflows/ci.yml`), `pre-push` is deliberately disabled, and the working tree carries **228 uncommitted files** including the live LP forms the swap ships.

---

## 2. Biggest high-level problems (ranked)

**#1 — THE SINGLE BIGGEST: The cutover is the convergence point of all four rebuilds, and it is governed by no source of truth and no gate.** `NEXT_PUBLIC_SITE_URL=https://ryanrealty.vercel.app` is the master variable driving canonical tags, og:url, the entire sitemap, the FUB lead `source`, the CAPI `event_source_url`, and confirmation/CMA email links — simultaneously, across website, ads, and lead plumbing. One wrong value silently corrupts SEO, lead attribution, and ad destinations at once. The apex still serves AgentFire; the new site isn't attached. **Gates:** `LAUNCH-01/02/03`, `ADS-03`, `FUNNEL-02`. **Evidence:** `.env.local:4`; `curl -sI https://ryan-realty.com/` → `x-powered-by: AgentFire.com`; Vercel `get_project` `live:false`, apex absent from `domains[]`; 3/3 `valuation_requests.source_url='https://ryanrealty.vercel.app/...'`.

**#2 — Every paid ad points to a URL that 404s, and the ads are one accidental click from spending.** All 5 manifest ads link to `/lp/seller-home-value`, which on the live AgentFire apex 301s then 404s (confirmed). Unpause any ad before cutover and 100% of paid clicks hit a dead page — no pixel, no form, no FUB lead, pure wasted spend. Tier 4/Tier 5 retarget seller-LP visitor audiences the pixel can never build. **The first safety action in this report is to verify the ads are actually still PAUSED (`ADS-18`) — that is the catastrophe case.** **Gates:** `ADS-18` (run today), `ADS-01/02/11`, `LAUNCH-06`, `FUNNEL-15/17`. **Evidence:** `out/meta-seller-ads/manifest.json` (5 ads `dry_run:false`); `curl -sIL .../lp/seller-home-value` → 404.

**#3 — The funnel's output stage is open-loop: leads are tagged in FUB but never nurtured — this is the actual business goal, and it must be fixed BEFORE any ad spend.** A committed live-API audit shows 3,492 people carry `audience:seller`, 37 carry `audience:buyer`, yet the master Action Plans show `isUsed:false`, `contactsRunningCount:0` — they have **never run**. Tagging is in code; enrollment depends on a hand-built FUB-UI Automation Rule that has demonstrably never fired and that no check verifies. **Unpausing ads while nurture is dead means every new lead dies on arrival** — so `FUNNEL-04` is reclassified as a **pre-ad-spend blocker**, not a "this month" item. **Gates:** `FUNNEL-04` (pre-spend), `FUNNEL-01/14`. **Evidence:** `docs/FUB_LEAD_WORKFLOW_LIVE_AUDIT_2026-05-29.md`.

**#4 — Zero redirects for ~177+ legacy WordPress URLs; cutover dumps all accumulated SEO equity.** The legacy Yoast sitemap exposes indexed money pages (`/free-home-valuation/`, `/vip-home-search/`, `/golf-homes-for-sale/`, `/seller-plans/`, `/testimonials/`) — confirmed live at HTTP 200 — plus 137 blog posts. `next.config.ts` `redirects()` covers only the new site's 22 internal renames; a repo-wide grep for the legacy slugs returns nothing. On cutover, every one 404s. **Gate:** `LAUNCH-04` (set-membership against the live sitemap, not a row count). **Evidence:** live `/free-home-valuation/`, `/vip-home-search/`, `/golf-homes-for-sale/` all 200 today; no redirect map in code.

**#5 — The live production DB has an open anon data-exfiltration surface that cutover is about to publish the anon key against.** `_agent_schema_dump()` is anon-EXECUTE, and 5 materialized views (incl. the ~590k-row listing MV) plus 6 SECURITY DEFINER views are anon-readable through the API the new site already uses. Today this is shielded only by obscurity; the moment the apex serves the new app, the public anon key + an exposed surface = anyone can dump the schema and the full listing warehouse. **These are reclassified launch-blocking.** **Gates:** `DATA-07/08/09` (now blocksLaunch), `DATA-10`.

**#6 — "Gates not prose" is itself unenforced; there is no clean baseline to ship from.** `package.json` defines `ci:gates` (22 gates), but `.github/workflows/ci.yml` **never calls it** (confirmed: 0 matches) — it hand-lists ~14 and omits G34/G35/G36 plus 7 others. `pre-push` is intentionally non-executable (re-arming runs `ci:gates`, which fails on the LP-form design-token violations). The active commit hook runs neither `ci:gates` nor the branch-policy check (dead `.git/hooks/pre-commit`). 228 files are uncommitted, including the exact LP forms the swap ships. **Gates:** `LAUNCH-14/15`, `SKILL-12`, `DATA-15`, `ADS-19`.

**#7 — Content fabrication is the #1 recurring risk and had no gate until now.** A subagent invented testimonials ("Sarah M.", "James K.") on `/about`, caught only by manual review; there is no automated check preventing unsourced testimonials/claims (or claims that contradict the system, e.g. "we do not auto-call") from shipping on rebuilt pages. **New gate:** `CONTENT-01` (was the largest "prose, not gate" hole in the prior draft).

**#8 — Data is fast but not verifiable; the canonical market-stats DAL is a live trap.** `getMarketStats` selects six non-existent columns (42703 → null), still exported from `@/lib/data`, "works" only because its one caller hard-codes `null` — so listing pages render Median DOM + MoS blank, and any new page wiring it gets silent blanks. The methodology stamp docs call current exists in zero rows. The homepage verdict contradicts itself. **Gates:** `DATA-01/02/03/04`.

**#9 — The marketing producer pipeline cannot publish or mutate ads; the loop has never closed.** No producer emits the `mediaUrl`/`mediaType` `/api/social/publish` requires (zero social posts ever `executed`); `ops:meta_*` rows classify as "text" so `producer-runtime` only emits JSON describing a budget change and never calls Graph; the visual render-worker has no scheduler. **Gates:** `SKILL-01/04/05/10`.

**#10 — Attribution cannot compute CPL/ROAS, and the warehouse is stale — so no ad spend can be honestly reported.** `marketing_channel_daily` is 9+ days stale (max date 2026-05-21), carries zero leads/conversions metrics across 35,793 rows, only 2 spend rows; `seller-lead-attribution` (the cron tying a contacted lead to a creative) is absent from `vercel.json`. **"Crons scheduled + warehouse fresh ≤48h + CPL computable" is now a hard pre-ad-unpause precondition** alongside the destination gates. **Gates:** `ADS-07/08`, `FUNNEL-07/08/09`.

---

## 3. The target architecture

One coherent lead-gen machine. Each arrow has a designated source-of-truth and an enforcing gate.

```
        ┌────────────────────────────────────────────────────────────────────────┐
        │  (8) ATTRIBUTION LOOP  → back into the brain                            │
        │  content_performance.north_star_attributed_seller_leads (FUNNEL-08)     │
        │  marketing_channel_daily (fresh ≤48h, CPL-computable) (FUNNEL-09)       │
        │  ── HARD PRECONDITION OF ANY AD UNPAUSE ──                              │
        └───────────────▲────────────────────────────────────────────┬───────────┘
                        │                                             │
   (1) MARKETING BRAIN  │                                             ▼
   lib/marketing-brain  │                              (7) FUB WORKFLOWS / nurture
   generate-briefs.ts   │                              audience:seller → Action Plan
   rank = severity ×    │                              contactsRunningCount>0 (FUNNEL-04)
   north_star_weight    │                              buyer:saved-search alert (FUNNEL-18)
        │ writes        │                                  ── PRE-AD-SPEND BLOCKER ──
        ▼                                                             ▲
   marketing_brain_actions  ── SINGLE AUDIT TRAIL & STATE MACHINE ────┤
   (pending→in_production→ready→approved→executed→measured)           │ enrolls
        │                                                             │
        ▼ (2) PRODUCER                                                │
   producer-runtime (text) / render-worker (visual)                  │
   • zod + brand-voice + citation validation BEFORE 'ready' (SKILL-01/02/03)
   • NO unsourced testimonial/claim in output or page (CONTENT-01)
   • publish_payload satisfies /api/social/publish contract (SKILL-04)
   • every action_type has a reachable executor (SKILL-05)
        │ approved-only, human-gated (SKILL-15)
        ├──────────────► (3) ADS (Meta-primary)
        │                ops:meta_* executor → Graph API, ±25% band (ADS-09/10)
        │                campaigns HOUSING + PAUSED (ADS-17); audiences non-empty (ADS-11)
        │                effective_status PAUSED until destination gates pass (ADS-18)
        │                       │ ad links (UTM-complete, ADS-15)
        │                       ▼
        └──────────────► (4) WEBSITE (Next.js on ryan-realty.com)
                         CANONICAL HOST = https://ryan-realty.com  ◄── SOURCE OF TRUTH
                         NEXT_PUBLIC_SITE_URL (LAUNCH-02, ADS-03, FUNNEL-02)
                         legacy 301s (LAUNCH-04) · sitemap resolvable (LAUNCH-11/DATA-14)
                         DB read path = lib/data/** DAL only (verifiable, DATA-01..06)
                         anon surface closed BEFORE key is published (DATA-07/08/09)
                              │
                              ▼ (5) FORM
                         app/lp/*/actions.ts  →  ONE shared FUB-write module (FUNNEL-05)
                         pixel + CAPI share event_id (ADS-05) · GA4 MP mirror
                         auto-response ≤300s (FUNNEL-12)
                              │
                              ▼ (6) FUB (api.followupboss.com) ── ONE system identifier
                         person + canonical tags + marketing_assignments ledger
                         FB lead-webhook → same module, durable waitUntil (ADS-14)
```

**Sources of truth (must be singular and enforced):**
- **Canonical host:** `https://ryan-realty.com`, set once in `NEXT_PUBLIC_SITE_URL` — drives SEO, FUB source, CAPI URL, emails. No `vercel.app` literal anywhere in `lib/`/`app/` source (excl. OAuth callbacks) (`LAUNCH-03`, `ADS-04`).
- **Lead state machine + audit trail:** `marketing_brain_actions` (Supabase `dwvlophlbvvygjfxcrhm`).
- **Action-type → producer routing:** `REGISTRY.md`, with all four code-side maps derived from / asserted equal to it (`SKILL-06`).
- **DB read contract:** `lib/data/**` DAL only (no raw `.from()`), every selected column proven to exist (`DATA-01`); zero `fetch(.../api.followupboss.com/(people|events))` outside the one FUB module (`FUNNEL-05`).
- **Testimonials/claims:** committed `data/testimonials.json` with source URLs — nothing else renders as a client quote (`CONTENT-01`).
- **Gate suite:** `npm run ci:gates`, invoked verbatim by CI (`LAUNCH-15`/`SKILL-12`/`DATA-15`).

---

## 4. GATE REGISTER

Rendered as checks, grouped by domain. Status legend: ✅ pass · ❌ fail · ⚠️ partial · ❔ unknown (mandatory runtime check, cannot be evaluated at CI time).

### Domain: launch-cutover

| ID | Gate (requirement) | Check | Status | Blocks launch? | Severity |
|---|---|---|---|---|---|
| LAUNCH-01 | Apex serves new Next.js app, not AgentFire; Vercel domains[] has apex + www | `curl -sI ryan-realty.com` lacks `x-powered-by: AgentFire`, has Vercel sig; `get_project.domains[]` ⊇ {ryan-realty.com, www} | ❌ | **Yes** | critical |
| LAUNCH-02 | Production canonical host = ryan-realty.com (`NEXT_PUBLIC_SITE_URL` flipped) | env === `https://ryan-realty.com`; home canonical/og + first sitemap `<loc>` host = ryan-realty.com | ❌ | **Yes** | critical |
| LAUNCH-03 | No `vercel.app` host string leaks into source/canonical/email at build | grep `lib/ app/` (excl. oauth) = 0 hits; `NEXT_PUBLIC_SITE_URL` required & === apex | ❌ | **Yes** | high |
| LAUNCH-04 | Legacy WordPress URLs 301 to live new-site targets (set membership, not count) | every `<loc>` in live `page-sitemap.xml`+`post-sitemap.xml` ∈ `data/legacy-redirects.csv` (set equality); each legacy path 301/308 → 200 target, single hop | ❌ | **Yes** | critical |
| LAUNCH-05 | Production build passes | `npm run build` exit 0 with full route table | ✅ | **Yes** | critical |
| LAUNCH-06 | Ad-destination LP resolves 200 w/ pixel on apex at exact ad URL | each manifest LP path → 200 (no 301→404), body ≠ "Page not found", HTML has pixel id | ❌ | **Yes** | critical |
| LAUNCH-07 | Non-prod (vercel.app) host noindex/protected; apex indexable | staging `X-Robots-Tag: noindex` or 401/403; apex 200 + index,follow + self-canonical | ❌ | **Yes** | high |
| LAUNCH-08 | Lighthouse CI passes (perf≥.9, a11y≥.95, BP≥.9, seo≥.95, LCP≤2500, CLS≤.1) | `npm run ci:lighthouse` exit 0; no `passed:false` in assertion-results | ❌ | **Yes** | high |
| LAUNCH-09 | Accessibility (pa11y-ci) passes on all public routes | `npm run ci:a11y` exit 0, zero errors | ❔ | **Yes** | high |
| LAUNCH-10 | Tracking embedded on prod HTML (GA4 + GTM + Meta Pixel) | home + LP HTML contains GTM-WV6R4NZ5 + pixel id `1546878946032105`; equals Vercel prod env | ⚠️ | **Yes** | high |
| LAUNCH-11 | Sitemap contains no soft-404 listing URLs | sample ≥15 sitemap listings; none returns "Listing not found"/non-listing title at 200 | ❌ | No | high |
| LAUNCH-12 | Auth/OAuth callbacks work on apex — bound to the SAME atomic deploy as LAUNCH-01/02 | Supabase Site URL = apex; `/auth/callback` + `/api/auth/callback` in allow list; Google OAuth redirect URIs = apex; sign-in round-trip in cutover deploy (admin must not be locked out of approval queue) | ❌ | **Yes** | critical |
| LAUNCH-13 | Meta lead-webhook callback = prod apex; no stale subscriptions | Graph `subscribed_apps` callback_url === `ryan-realty.com/api/meta/lead-webhook`; no vercel.app | ❌ | No | medium |
| LAUNCH-14 | Clean baseline: tree committed + full gate suite green before swap | `git status --porcelain` empty; `origin/main..HEAD`=0; `npm run ci:gates` exit 0 | ❌ | **Yes** | high |
| LAUNCH-15 | CI runs full canonical gate suite (`ci:gates`), not a subset | `.github/workflows/ci.yml` invokes `npm run ci:gates` (confirmed: 0 today) | ❌ | **Yes** | high |
| LAUNCH-16 | Rollback gate: legacy DNS captured, AgentFire origin still live, TTL ≤300s, revert verified-reversible | `data/cutover-rollback.json` exists w/ documented one-step re-point target; `curl -sI` of AgentFire origin host = 200 (not torn down); `dig` TTL ≤300; post-cutover monitor re-runs LAUNCH-01/02/06 | ❌ | **Yes** | critical |

### Domain: ads

| ID | Gate (requirement) | Check | Status | Blocks launch? | Severity |
|---|---|---|---|---|---|
| ADS-18 | **All 5 ads confirmed PAUSED via live Graph (run TODAY, standalone, zero deps)** | Graph `effective_status` of each ad in `act_1178780510184911` ∈ {PAUSED, …} and not delivering; mandatory pre-unpause runtime check | ❔ | **Yes** | critical |
| ADS-01 | No ad goes live with a destination that isn't 200 | each `manifest.results[].link` (exact URL+UTM, apex) → 200, no 404 marker, no AgentFire header | ❌ | **Yes** | critical |
| ADS-02 | Meta Pixel present in rendered HTML of every ad LP | each LP HTML contains `fbq(` + pixel id `1546878946032105` | ❌ | **Yes** | high |
| ADS-03 | Production canonical/source host = ryan-realty.com, never vercel.app | env === apex; `valuation_requests.source_url ILIKE '%vercel.app%'` post-cutover = 0 | ❌ | **Yes** | critical |
| ADS-04 | No `vercel.app` literal in lead/source/email/attribution code | grep `app/ lib/` (excl. oauth callbacks) = 0 hits | ❌ | No | high |
| ADS-05 | Pixel + CAPI Lead share one event_id (every lead path) | each path references fbq Lead + CAPI Lead sharing generated id; webhook fires CAPI | ⚠️ | No | high |
| ADS-06 | CAPI token+pixel set; `/api/meta-capi` reachable — **mandatory pre-unpause runtime check** | env set; synthetic test_event → `events_received≥1` | ❔ | **Yes (pre-unpause)** | high |
| ADS-07 | Ad-insights snapshot cron scheduled (warehouse fresh) — **pre-ad-unpause precondition** | `marketing-snapshot-meta-ads` in vercel.json; meta_ads max(date) ≥ today−2 | ❌ | **Yes (pre-unpause)** | high |
| ADS-08 | Seller-lead-attribution cron scheduled (loop closes) — **pre-ad-unpause precondition** | route in vercel.json; synthetic utm_content → `north_star_attributed_seller_leads`++ | ❌ | **Yes (pre-unpause)** | critical |
| ADS-09 | Approved `ops:meta_*` rows have an executor reaching Graph API | each emit-able ops:meta_* type has a Graph-calling consumer; no 24h-stuck approved row | ❌ | No | high |
| ADS-10 | ±25% budget band enforced in code, not prose | unit test on band function halts >25% w/o override | ❌ | No | high |
| ADS-11 | Retargeting ad sets have non-empty source audience before unpause | Graph `approximate_count > 0` per Tier4/Tier5 audience | ❌ | **Yes (pre-unpause)** | high |
| ADS-12 | Lead-webhook callback = prod host; no stale subscriptions | Graph subscription callback_url === apex; no vercel.app/ryan-realty-lps | ❌ | No | high |
| ADS-13 | CAPI CORS allowlist contains prod host (not staging leak) | `CORS_ALLOWED_ORIGINS` ⊇ `NEXT_PUBLIC_SITE_URL` origin | ⚠️ | No | medium |
| ADS-14 | Lead-webhook FUB delivery durable (no fire-and-forget after 200) | route references `waitUntil(`/queue; no `void (async()=>…)()` then immediate return | ❌ | No | medium |
| ADS-15 | Every ad link carries complete UTM tuple mapping to a creative | each link has source/medium/campaign/content; content === row.utm_content; creative_id present | ✅ | No | medium |
| ADS-16 | Creative provenance: every ad image references an on-disk artifact | `fs.existsSync(result.image)`; creative_id+ad_id non-empty; `dry_run:false` — mandatory runtime check | ❔ | No | medium |
| ADS-17 | Every campaign created HOUSING + PAUSED | shell script sets `special_ad_categories:['HOUSING']` + `status:'PAUSED'` | ✅ | No | high |
| ADS-19 | Ad-tracking gates run in CI (`ci:gates` wired) | workflow runs `ci:gates` or every ci:ad-* name | ❌ | No | high |

### Domain: funnel-crm / attribution

| ID | Gate (requirement) | Check | Status | Blocks launch? | Severity |
|---|---|---|---|---|---|
| FUNNEL-01 | Synthetic seller-LP submit → FUB person w/ canonical source tag (**Phase-D post-swap smoke; failure → LAUNCH-16 rollback**) | POST to prod apex LP → FUB person by email w/ tags {audience:seller, source:seller-lp, broker:matt}, source ≠ vercel.app | ❌ | **Yes (post-swap smoke)** | critical |
| FUNNEL-02 | FUB source/attribution host = ryan-realty.com, never vercel.app | env === apex; grep clean; post-cutover `source_url ILIKE '%vercel.app%'` = 0 | ❌ | **Yes** | critical |
| FUNNEL-03 | Anonymous→known visitor session stitch fires | synthetic submit sets `visitor_sessions.fub_person_id` within N min | ❌ | No | high |
| FUNNEL-04 | **Tagged leads actually enrolled in a FUB action plan — PRE-AD-SPEND BLOCKER (no unpause until green)** | `/v1/actionPlans` Seller plan `isUsed=true` & `contactsRunningCount>0`; synthetic seller lead appears running within N min | ❌ | **Yes (pre-ad-spend)** | critical |
| FUNNEL-05 | All entry points use one shared FUB-write contract | exactly one module POSTs to FUB; grep: zero `fetch(.../api.followupboss.com/(people\|events))` outside it; `FOLLOWUPBOSS_SYSTEM` set; one system literal | ❌ | No | high |
| FUNNEL-06 | Synthetic Meta lead-webhook creates deduped FUB person | signed POST → FUB person + 1 `processed_meta_leads` row; replay stays 1; unsigned rejected | ❌ | No | high |
| FUNNEL-07 | Lead-flow-critical crons scheduled — **pre-ad-unpause precondition** | every required cron in vercel.json (attribution, snapshots, seller-workflow-pause, detect-expired) | ❌ | **Yes (pre-unpause)** | high |
| FUNNEL-08 | Contacted lead traceable to campaign/creative | synthetic utm_content=action_id increments `north_star_attributed_seller_leads` | ❌ | No | critical |
| FUNNEL-09 | `marketing_channel_daily` fresh enough to compute CPL/ROAS — **pre-ad-unpause precondition** | each channel max(date) ≥ today−2; spend>0 row has co-keyed leads/conversions metric (CPL computable) | ❌ | **Yes (pre-unpause)** | high |
| FUNNEL-10 | FB lead-ad path has attribution parity (CAPI Lead + GA4 clientId) | webhook references CAPI Lead w/ event_id AND clientId in GA4 call | ❌ | No | high |
| FUNNEL-11 | Meta CAPI CORS allowlist contains live prod host | allowlist ⊇ {ryan-realty.com, www}; OPTIONS probe returns ACAO | ⚠️ | No | medium |
| FUNNEL-12 | Website speed-to-lead auto-response fires ≤300s (not dead code, latency-measured) | `sendAutoResponse` referenced by a live lead path (importer ≠ self); synthetic submit → auto-reply observed within 300s | ❌ | No | high |
| FUNNEL-13 | Conversion events fire & versioned — **one concrete check, no OR-of-unbuilt** | committed `config/gtm/container-export.json` exists; its version === live container version; `generate_lead`+Meta `Lead` tags present in export | ❔ | No | medium |
| FUNNEL-14 | End-to-end lead chain has an automated regression test | `ci:funnel` suite (≥1 assertion per entry point) required in CI, exit 0 | ❌ | No | high |
| FUNNEL-15 | Ad destination LP 200 + pixel + form before any ad unpaused | each manifest link (apex) → 200, body ≠ "Page not found", HTML has fbq init | ❌ | **Yes** | critical |
| FUNNEL-16 | Meta webhook callback host = prod; no stale subscription | Graph subscription callback === apex; no vercel.app | ❌ | No | medium |
| FUNNEL-17 | Retargeting audiences (Tier4/5) non-empty before those ads run | Graph audience `approximate_count > 0` | ❌ | **Yes (pre-unpause)** | high |
| FUNNEL-18 | Synthetic buyer-LP submit → active saved-search/listing-alert subscription (buyer-side equivalent of FUNNEL-04) | POST to prod buyer LP → buyer enrolled in recurring IDX listing-alert; alert record/active subscription exists | ❌ | No | high |
| FUNNEL-19 | Exit-intent / repeat-visitor capture reaches FUB with distinct source tag | synthetic exit-intent submit → FUB person tagged `source:exit-intent`, deduped against same email | ❌ | No | medium |

### Domain: data

| ID | Gate (requirement) | Check | Status | Blocks launch? | Severity |
|---|---|---|---|---|---|
| DATA-01 | Every DAL `.select()` column exists on its target table | AST-walk `lib/data/**`; each column ∈ schema (or `SELECT … LIMIT 0`); 0 missing | ❌ | No | high |
| DATA-02 | Remove/repoint dead `getMarketStats` so new pages can't wire blank stats | barrel exports no DAL fn failing DATA-01 | ❌ | No | high |
| DATA-03 | Methodology version consistent across fn/registry/docs/every row | `current_cache_methodology_version()` === registry latest; 0 rows differ; CLAUDE.md matches | ❌ | No | high |
| DATA-04 | Homepage market verdict internally coherent — **literal thresholds inlined** | 0 rows where `months_of_supply ≥ 6` coexists with `market_health_label ∈ {Hot, Very Hot}` **OR** `days_to_pending ≤ 21`; UI verdict not MoS-only | ❌ | **Yes** | high |
| DATA-05 | Every displayed market metric traces to a committed canonical query | fixtures query result === served value within tolerance | ❌ | No | medium |
| DATA-06 | Freshest-period cache reads guard `sold_count>0` | AST scan: no freshest-row select w/o sold_count filter / em-dash | ❌ | No | medium |
| DATA-07 | No SECURITY DEFINER views exposed in public/API schema — **cutover publishes anon key against this** | `get_advisors(security)` security_definer_view = 0 | ❌ | **Yes** | high |
| DATA-08 | No anon-executable SECURITY DEFINER functions (`_agent_schema_dump` etc.) — **live exfiltration hole** | `has_function_privilege('anon','_agent_schema_dump()','EXECUTE')`=false; advisor=0 | ❌ | **Yes** | critical |
| DATA-09 | No materialized views exposed to anon via API (incl. ~590k-row listing MV) | `get_advisors(security)` materialized_view_in_api = 0 | ❌ | **Yes** | high |
| DATA-10 | RLS on every public table; no always-true write policies on PII | advisor `rls_disabled_in_public`=0 & `rls_policy_always_true`=0 on write/PII | ❌ | No | medium |
| DATA-11 | No duplicate indexes (write-amp on 15-min hot tables) | `get_advisors(performance)` duplicate_index = 0 | ❌ | No | medium |
| DATA-12 | No unindexed FKs; managed ceiling on unused indexes | advisor unindexed_foreign_keys=0; unused_index ≤ baseline | ❌ | No | medium |
| DATA-13 | Hot-path p95 budget: index scans only, no raw-listing aggregation on read | EXPLAIN: no Seq Scan on listings/market tables; region≤2ms, cache≤20ms, tile≤5ms | ✅ | No | low |
| DATA-14 | Sitemap listing URLs resolve to a real listing (no 200 soft-404) | sample N; none "Listing not found"/non-listing title; sitemap+route share same status filter | ❌ | **Yes** | medium |
| DATA-15 | Data-verifiability gate suite (`ci:gates`) runs in CI | workflow invokes `npm run ci:gates` | ❌ | No | high |
| DATA-16 / CONTENT-01 | **No unsourced testimonials/claims on rebuilt pages (closes the #1 named risk)** | `scripts/check-content-provenance.mjs`: greps rendered route HTML + `app/**/page.tsx` for testimonial blocks/quoted client names/review counts; each must map to a row in committed `data/testimonials.json` (with source URL); fail on any quote/name/count not traceable; AND assert banned false-claim list (e.g. "we do not auto-call") absent | ❌ | **Yes** | high |
| DATA-17 | Service-area spatial coherence: `is_central_oregon_city()` matches canonical city table | function's city set === canonical city/community table set (0 symmetric-difference); fail if any service-area city missing | ❌ | No | medium |

### Domain: marketing-skill

| ID | Gate (requirement) | Check | Status | Blocks launch? | Severity |
|---|---|---|---|---|---|
| SKILL-01 | producer-runtime validates output vs schema before `ready` | zod `safeParse` between `JSON.parse` and status update; fail→failure status | ❌ | No | high |
| SKILL-02 | producer-runtime runs brand-voice hard-fail before `ready` | em/en-dash + banned-word scan on deliverable_text + caption; reject on hit | ❌ | No | high |
| SKILL-03 | Producer citations trace to payload provenance | every `citations[].field` ∈ row.payload/data_evidence; reject otherwise | ❌ | No | high |
| SKILL-04 | publish_payload satisfies `/api/social/publish` contract | producer output schema ⊇ {platforms, mediaType, mediaUrl} | ❌ | No | critical |
| SKILL-05 | Every emit-able action_type has a reachable executor | each FORMAT_ROUTE_MAP type maps to a consumer that reaches `executed` | ❌ | No | critical |
| SKILL-06 | Single source of truth for action_type → producer routing | FORMAT_ROUTE_MAP + 3 inbox/audit maps === REGISTRY.md set | ❌ | No | high |
| SKILL-07 | validate-producer dependency-resolution (Gate 8) is hard fail | broken SKILL.md ref → non-zero exit (failures[], not warnings[]) | ❌ | No | medium |
| SKILL-08 | Every mapped producer build script exists on disk | each `run-producer.mjs` PRODUCERS script `existsSync` | ❌ | No | medium |
| SKILL-09 | No action row stalls in in_production/approved beyond 24h | count of stale rows = 0 | ❌ | No | high |
| SKILL-10 | Visual-producer render path has a running scheduler | launchd/cron/CI invokes `render-worker.mjs` | ❌ | No | critical |
| SKILL-11 | content_engine SKILL.md has no placeholder validator-stub sections | grep for stub phrases in required sections = 0 | ❌ | No | medium |
| SKILL-12 | CI runs full `ci:gates` aggregate (producer/skill gates not orphaned) | workflow runs `ci:gates` or every ci:* name | ❌ | No | high |
| SKILL-13 | Documented producer cron cadence === actual vercel.json schedule | doc cadence strings === vercel.json per route | ❌ | No | medium |
| SKILL-14 | Marketing brain is the single canonical skill tree (no stale dupes) | no `__TEMP_MERGED_MONOLITH`; only main worktree; no `*-snapshot`/873-behind dup tree | ❌ | No | medium |
| SKILL-15 | Autonomous loop can't mutate live ads/site/CRM w/o passing human gate | live-mutating crons filter `status='approved'`; only admin route writes 'approved' | ✅ | No | critical |
| SKILL-16 | `PRODUCER_RUNTIME_ENABLED`/`PRODUCER_ALLOW_ROGUE` templated & auditable | every cron-read env var ∈ `.env.example`; no committed `=1` rogue/all-hooks | ❌ | No | medium |
| SKILL-17 | Producer rejects incomplete briefs (required payload present) | partial-payload row → failure status, not executed | ❌ | No | high |
| SKILL-18 | E2E seam smoke: a brief reaches `executed` with a real external id | sandbox content:* and ops:meta_* each reach `executed` w/ external id | ❌ | No | high |

---

## 5. Launch / cutover critical path

Only the launch-blocking gates, sequenced. Nothing else ships until these are green. The framing distinguishes **pre-swap gates** (provable off-domain), **the atomic swap window**, **post-swap smokes** (only provable after DNS, failure → rollback), and **pre-ad-unpause gates** (must be green before any ad delivers, even after the site is live).

**Phase 0 — Catastrophe prevention (TODAY, zero dependencies)**
0. **ADS-18** — live Graph `effective_status` check that all 5 ads are PAUSED. Run standalone, independent of the gate harness. This is the highest-urgency item in the report; an accidental unpause while the LP 404s burns money for zero capture.

**Phase A — Make the build shippable (off-domain, no production impact)**
1. **LAUNCH-05** — confirm `npm run build` exit 0 from the cutover commit; make the cutover job `needs: lint-and-build`.
2. **LAUNCH-14** — fix design-token violations in `SellerLPForm.tsx`/`BuyerLPForm.tsx` (raw `button`/`label`/`input`), commit/push the 228-file tree through CI, `chmod +x .husky/pre-push`. No swap off a dirty, gate-failing tree.
3. **LAUNCH-08 + LAUNCH-09** — make `ci:lighthouse` green (fix `/about` Speed Index 9.8s; reconcile listing title/meta render-timing) and confirm `ci:a11y` exit 0.
4. **CONTENT-01** — implement `scripts/check-content-provenance.mjs`; strip the fabricated `/about` testimonials; back any real ones with `data/testimonials.json` (source URLs). This gates the public pages the launch ships.

**Phase B — Pre-wire correctness so the swap is atomic (still no DNS change)**
5. **LAUNCH-03 / ADS-03 / FUNNEL-02** — flip `NEXT_PUBLIC_SITE_URL` to `https://ryan-realty.com` in Vercel production; remove the two `vercel.app` email fallbacks (`lib/cma-request.ts:23`, `app/actions/auto-response.ts:31`); add the no-staging-host grep gate.
6. **LAUNCH-04** — generate `data/legacy-redirects.csv` from the live Yoast sitemap (40 pages + 137 posts), wire into `next.config.ts redirects()` (long tail via middleware table), prove **set membership** against the live sitemap and each legacy path 301→200 single-hop.
7. **DATA-07 / DATA-08 / DATA-09** — **close the anon exfiltration surface before publishing the anon key**: REVOKE EXECUTE on `_agent_schema_dump()` from anon, drop the 5 MVs from the anon-exposed API schema, remediate the 6 SECURITY DEFINER views. Re-run `get_advisors(security)` to 0.
8. **DATA-04** — fix homepage verdict coherence (drive verdict from `market_health_label`, or recompute the MoS window) against the inlined thresholds.
9. **DATA-14 / LAUNCH-11** — align `app/sitemap.ts` listing source to the listing route's status filter so the sitemap has no soft-404s.

**Phase C — The atomic swap window (single deploy + DNS)**
10. **LAUNCH-16** — capture legacy DNS/Cloudflare config to `data/cutover-rollback.json`, **assert the AgentFire origin is still serving 200** (not torn down) for the rollback window, lower TTL to ≤300s, verify the documented one-step revert **before** changing anything.
11. **LAUNCH-01 + LAUNCH-02 + LAUNCH-12 — in ONE atomic deploy:** attach `ryan-realty.com` + `www` to the Vercel `ryanrealty` project and point DNS; the same deploy carries the flipped `NEXT_PUBLIC_SITE_URL`; re-point Supabase Auth Site URL + Google OAuth redirect URIs to apex. Binding auth to this window prevents Matt being locked out of the approval queue that gates everything downstream.
12. **LAUNCH-07** — confirm staging (`vercel.app`) is `noindex`/protected and apex is indexable; confirm Vercel deployment protection is lifted for the apex so humans/crawlers don't hit 403.

**Phase D — Post-swap smokes (only provable now; any failure triggers LAUNCH-16 rollback)**
13. **LAUNCH-10** — GA4+GTM+Meta Pixel embedded in production HTML.
14. **LAUNCH-06 / FUNNEL-15 / ADS-01** — `/lp/seller-home-value` returns 200 at the exact ad URL with pixel + form.
15. **FUNNEL-01** — synthetic seller-LP submit creates a FUB person with canonical source tag (no vercel.app). **This is a post-swap smoke, not a pre-swap gate; on failure, execute the documented LAUNCH-16 revert.**
16. **FUNNEL-06 / LAUNCH-13 / ADS-12** — re-point the Meta webhook to the apex; verify with a signed synthetic event.

**Phase E — Pre-ad-unpause gates (site is live, but NO ad may deliver until ALL of these are green)**
17. **FUNNEL-04** — tagged seller leads are actually enrolled and running in a FUB action plan (the business goal; nurture must be alive before lead flow arrives).
18. **ADS-07 / ADS-08 / FUNNEL-07 / FUNNEL-09** — attribution + snapshot crons scheduled; `marketing_channel_daily` fresh ≤48h; CPL computable. No ad spend that can't be honestly measured.
19. **ADS-06** — synthetic CAPI `test_event` returns `events_received≥1`.
20. **ADS-11 / FUNNEL-17** — retargeting Tier4/Tier5 audiences `approximate_count > 0`.
21. **ADS-18 (re-confirm)** — ads still PAUSED until 14–20 are green; unpause is the last action, one ad at a time.

**Safe-cutover procedure**
- **Pre-flight:** `ci:gates` green; `git status --porcelain` empty; rollback snapshot captured + AgentFire origin verified live; TTL ≤300s (LAUNCH-16).
- **Redirects:** legacy CSV live and set-membership-proven (LAUNCH-04) before DNS flips — no window of 404s.
- **Atomicity:** flip `NEXT_PUBLIC_SITE_URL`, attach the domain, and re-point auth in the **same** deploy so canonical never points at the live apex while still emitting vercel.app, and admin login never breaks.
- **Post-flip smoke:** LAUNCH-10, FUNNEL-01, LAUNCH-06; signed webhook (FUNNEL-06).
- **Rollback trigger:** a monitor re-runs LAUNCH-01/02/06 on an interval; on failure, execute the documented revert (TTL ≤300s propagates in minutes) back to the still-live AgentFire origin.
- **Hard rule:** **Do not unpause any ad** until Phase E is fully green — destination live (LAUNCH-06), nurture enrolled (FUNNEL-04), attribution measurable (ADS-07/08, FUNNEL-09), audiences populated (ADS-11), CAPI reachable (ADS-06), ads confirmed paused until that instant (ADS-18).

---

## 6. Prioritized roadmap

### NOW (this week) — catastrophe prevention, then cutover-blocking work
- **Confirm the ads are paused (TODAY):** live Graph `effective_status` on all 5 ads. *(ADS-18 · impact: catastrophic-loss prevention · effort: XS · zero deps.)*
- **Re-arm the gate suite** so everything below is enforceable: wire `npm run ci:gates` into `.github/workflows/ci.yml` (0 references today) and re-enable `pre-push`. *(LAUNCH-15, SKILL-12, DATA-15, ADS-19 · impact: critical/everything · effort: S.)*
- **Clean baseline:** fix LP-form design-token violations, commit the 228-file tree, push through CI. *(LAUNCH-14 · impact: high · effort: M.)*
- **Flip the host + forbid the leak:** `NEXT_PUBLIC_SITE_URL=https://ryan-realty.com`, kill the two vercel.app email fallbacks, add the grep gate. *(LAUNCH-02/03, ADS-03, FUNNEL-02 · impact: critical · effort: S.)*
- **Add the content-fabrication gate:** `CONTENT-01` + strip fabricated testimonials. *(DATA-16/CONTENT-01 · impact: high/brand+legal · effort: M.)*
- **Close the anon DB hole BEFORE publishing the anon key:** revoke `_agent_schema_dump` from anon, un-expose the 5 MVs, fix the 6 SECURITY DEFINER views. *(DATA-07/08/09 · impact: high security · effort: M — migrations.)*
- **Legacy redirect map (set-membership tested):** generate + wire + test `data/legacy-redirects.csv`. *(LAUNCH-04 · impact: critical SEO · effort: M.)*
- **Fix Lighthouse red** (`/about` Speed Index) and confirm a11y. *(LAUNCH-08/09 · impact: high · effort: M.)*
- **Homepage verdict coherence + sitemap soft-404s.** *(DATA-04, DATA-14, LAUNCH-11 · impact: high · effort: M.)*
- **Rollback artifact (incl. AgentFire-origin-live assertion) + TTL lowering**, then execute the atomic swap binding host+domain+auth. *(LAUNCH-16, LAUNCH-01/02/07/12 · impact: critical · effort: M.)*
- **Pre-ad-unpause readiness (this week so spend isn't blocked):** start `FUNNEL-04` enrollment and cron scheduling now — they are pre-spend blockers, not next-month work.

### NEXT (this month)
- **Finish the pre-ad-spend gates:** FUB tag→enroll bridge running (`applyActionPlan()` after tagging or enrollment-poll gate); attribution + snapshot crons scheduled; warehouse fresh; CPL computable. *(FUNNEL-04/07/09, ADS-07/08 · impact: critical · effort: M.)*
- **One shared FUB-write module + `FOLLOWUPBOSS_SYSTEM`** across all paths with the no-stray-fetch grep; FB webhook CAPI+clientId parity; durable `waitUntil`. *(FUNNEL-05/10, ADS-05/14 · impact: high · effort: M.)*
- **Buyer-side nurture parity:** synthetic buyer-LP submit → active IDX saved-search/listing-alert. *(FUNNEL-18 · impact: high · effort: M.)*
- **Speed-to-lead ≤300s, measured** (not just wired) + exit-intent source tagging. *(FUNNEL-12/19 · impact: high · effort: M.)*
- **End-to-end funnel test** (`ci:funnel`) + synthetic attribution loop. *(FUNNEL-01/03/06/08/14 · impact: high · effort: L.)*
- **Fix/delete `getMarketStats`; methodology stamp; DAL-live-schema gate; service-area coherence.** *(DATA-01/02/03/17 · impact: high · effort: M.)*
- **Producer pipeline runtime gates:** zod + brand-voice + citation validation before `ready`; publish-contract bridge; ad-ops executor with ±25% band; schedule render-worker + liveness. *(SKILL-01/02/03/04/05/09/10, ADS-09/10 · impact: high · effort: L.)*

### LATER
- **CPL/ROAS computability hardening** in `marketing_channel_daily` (lead/conversion metric or `marketing_cpl` view). *(FUNNEL-09 · effort: M.)*
- **Skill-sprawl cleanup:** delete `__TEMP_MERGED_MONOLITH`, remove the 873-behind worktree, single registry. *(SKILL-14, SKILL-06 · effort: M.)*
- **DB perf/RLS hygiene:** duplicate/unused indexes, unindexed FKs, always-true write policies on PII. *(DATA-10/11/12 · effort: M.)*
- **Stat-source-trace + explain-budget + empty-guard gates** to lock the current good state. *(DATA-05/06/13 · effort: M.)*
- **GTM container export committed + version gate (single concrete check); seam smoke test.** *(FUNNEL-13, SKILL-18 · effort: M.)*
- **Validator promotions** (Gate 8 hard fail, stub-section ban, env-template, runner-scripts, incomplete-brief reject). *(SKILL-07/08/11/16/17 · effort: M.)*

---

## 7. Real-estate best-practice gaps (missing entirely)

Proven small-brokerage lead-gen moves that are absent or non-functional, where each plugs in, and the gate that enforces it. **Every gap now carries a gate ID.**

1. **Speed-to-lead auto-response for ALL web leads, within 5 minutes.** `sendAutoResponse` is dead code; only "hot"-classified leads get a 5-min FUB task — warm/nurture/unknown web leads get *no* instant touch. The #1 conversion lever in real estate is missing for most leads, and latency is unmeasured. **Plugs into:** `app/lp/*/actions.ts` + `app/contact/actions.ts`. **Gate:** `FUNNEL-12` (wired AND ≤300s latency).

2. **Database / SOI nurture actually running.** The whole point of FUB is the drip; 3,492 seller-tagged people sit with `contactsRunningCount:0` — the nurture engine has never enrolled a single person. **Plugs into:** FUB Action Plan enrollment after `canonical-lead-tagger`. **Gate:** `FUNNEL-04` (pre-ad-spend blocker).

3. **Buyer-side IDX saved-search / listing-alert nurture.** Buyer LP exists, but no gate asserts a buyer lead is enrolled in recurring listing alerts (the buyer equivalent of #2). **Plugs into:** buyer LP action → IDX alert subscription. **Gate:** `FUNNEL-18`.

4. **Closed attribution / ROI per campaign+creative.** No CPL, no ROAS, no lead-to-creative trace — every ad-spend decision is blind, and the brain optimizes off conversion-less, 9-day-stale data. **Plugs into:** `seller-lead-attribution` cron → `content_performance`; `marketing_channel_daily` freshness. **Gates:** `FUNNEL-08/09`, `ADS-08` (pre-ad-unpause preconditions).

5. **Retargeting that can actually deliver (Meta MOFU/BOFU).** Tier 4/Tier 5 retarget seller-LP visitor audiences that can never populate because the LP isn't live and the pixel is consent-gated with no verified default posture. The cheapest, highest-intent tier is structurally dead. **Plugs into:** live LP pixel → Meta custom audiences. **Gates:** `ADS-11`, `FUNNEL-17`, `ADS-02`.

6. **Hyperlocal city/neighborhood SEO equity preservation.** Strong hyperlocal routes exist, but cutover with zero legacy redirects throws away ~177 ranking URLs (money pages + 137 posts) — the single most damaging SEO own-goal at relaunch. **Plugs into:** `next.config.ts redirects()` / middleware redirect table. **Gate:** `LAUNCH-04` (set-membership).

7. **Review-velocity / social-proof engine that is real, not fabricated.** Testimonials currently exist only as *fabricated* content (a subagent invented "Sarah M."/"James K." on `/about`); there is no system to harvest real reviews into the site or GBP. Review velocity drives both LSA/local rank and conversion. **Plugs into:** committed `data/testimonials.json` + a GBP-review-ingestion producer. **Gate:** `CONTENT-01` (no unsourced quotes/counts) **plus** a GBP-review-ingestion check (roadmap LATER).

8. **FB Lead-Ads optimization signal (server-side Lead).** FB-ad leads fire GA4 only — no CAPI Lead, and GA4 gets a random clientId, so the lead is an orphan and Meta's optimizer never learns from the leads it generated, inflating CPL over time. **Plugs into:** `app/api/meta/lead-webhook/route.ts`. **Gates:** `FUNNEL-10`, `ADS-05`.

9. **Home-valuation seller magnet that is reachable.** The seller LP is genuinely well-built (multi-step qualify, tier classification, broker routing, CMA kickoff) — but it 404s on the live domain, so the strongest seller magnet currently captures nothing from ads. **Plugs into:** the cutover itself. **Gates:** `LAUNCH-06`, `FUNNEL-15`.

10. **Abandoned / exit-intent re-engagement.** Exit-intent capture exists in code but isn't proven to reach FUB with a distinct source tag, so the cheapest re-engagement surface is unverified. **Plugs into:** exit-intent component → shared FUB module. **Gate:** `FUNNEL-19`.

---

## 8. What to verify before building

Open questions whose answers change the plan. Resolve these before committing engineering time.

1. **Are the 5 ads actually PAUSED right now?** This is also gate `ADS-18` and the first action in §5 — but it is verification because the report cannot query Graph. Until confirmed, treat the account as one click from spending on dead links. *(Determines whether NOW item #0 is "confirm" or "emergency pause".)*
2. **Blog disposition at cutover.** Are the 137 WordPress posts redirected to `/blog/[slug]`, kept on a subdomain, or 410'd? Determines whether `LAUNCH-04`'s CSV needs 137 content-matched targets or a bulk rule. *(Changes redirect-map scope.)*
3. **Why does the sitemap include unresolvable listings?** Status-filter mismatch or sync-timing gap between `app/sitemap.ts` and the listing route? Determines whether `DATA-14`/`LAUNCH-11` is a one-line filter alignment or a pipeline fix.
4. **Was the methodology v4 recompute ever run?** `current_cache_methodology_version()` returns v3 while the registry's latest-unsuperseded is v4 and v3 was never marked superseded. Determines whether `DATA-03` is fixed by running the backfill or by correcting the docs to v3.
5. **Is `PRODUCER_RUNTIME_ENABLED=true` actually set in Vercel prod?** It's not in `.env.example`; determines whether the autonomous Claude loop is live now and whether `SKILL-01..05` are blocking real output or dormant scaffolding.
6. **Housing non-discrimination certification status.** `ADS_MANAGER_SETUP.md` flags `error_subcode 2859002` ("Certification Required") on every ad-create. If incomplete, no ad activates regardless of cutover — verify before sequencing Phase E.
7. **Source of truth for ad strategy + go-live budget.** The 3-campaign/$60-day playbook vs the 6-tier shell script conflict; the manifest realizes only 4 ad sets with creative. Pick one before `ADS-09/10` (executor + budget band) are built.
8. **GTM conversion mapping.** Whether GA4 `generate_lead` is flagged a conversion and whether Meta `Lead` fires from the container lives only in the GTM UI. `FUNNEL-13` now requires a committed `config/gtm/container-export.json` whose version matches live — verify you can export it (no OR-fallback to an unbuilt debug probe).
9. **Anon-key blast radius.** Before/after closing `DATA-08/09`, confirm nothing legitimate on the new site reads those MVs/RPC via the anon key (i.e., the DAL uses service-role or a safe view). Determines whether the lockdown is a pure REVOKE or needs a read-path repoint.
10. **Vercel deployment protection on the apex.** Bare deployment URLs return 403; verify protection is lifted for the apex post-cutover so real users and crawlers reach the site (otherwise `LAUNCH-01` passes the header check but humans get 403).

---

**Bottom line:** The new site is built and the chassis (gate harness, DAL boundary, human approval gate, dedup design) is genuinely good. The machine does not run end-to-end because of one convergent failure — the cutover hasn't happened and `NEXT_PUBLIC_SITE_URL` is wrong — and one open output loop — leads are tagged but never enrolled. The corrected sequence is: **(0) confirm the ads are paused today; (A–C) get the pre-swap blockers green — gate suite wired, baseline clean, host flipped, legacy redirects proven, content-fabrication gated, anon DB hole closed; cut the domain over in one atomic deploy that also re-points auth; (D) run the post-swap smokes with rollback armed; (E) only then enable ad delivery — and only after nurture enrollment (FUNNEL-04) and attribution freshness (ADS-07/08, FUNNEL-09) are green, because the business goal is a nurtured, measurable lead, not a click.** Everything else is hardening, and every item above is a check you can run, not a paragraph you have to trust.

**Key files:** `/Users/matthewryan/RyanRealty/.env.local` (host var), `/Users/matthewryan/RyanRealty/next.config.ts` (redirects), `/Users/matthewryan/RyanRealty/package.json` (`ci:gates`), `/Users/matthewryan/RyanRealty/.github/workflows/ci.yml` (must call `ci:gates` — 0 references today), `/Users/matthewryan/RyanRealty/out/meta-seller-ads/manifest.json` (ad destinations), `/Users/matthewryan/RyanRealty/lib/data/market/getMarketStats.ts` (dead DAL), `/Users/matthewryan/RyanRealty/docs/FUB_LEAD_WORKFLOW_LIVE_AUDIT_2026-05-29.md` (enroll break), `/Users/matthewryan/RyanRealty/.husky/pre-push` (disabled gate), `/Users/matthewryan/RyanRealty/scripts/check-content-provenance.mjs` (to build — CONTENT-01), `/Users/matthewryan/RyanRealty/data/testimonials.json` (to build — provenance source), `/Users/matthewryan/RyanRealty/data/legacy-redirects.csv` (to build — LAUNCH-04), `/Users/matthewryan/RyanRealty/data/cutover-rollback.json` (to build — LAUNCH-16), `/Users/matthewryan/RyanRealty/config/gtm/container-export.json` (to build — FUNNEL-13).
