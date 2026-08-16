# Capability maturity matrix (CAP-001 … CAP-035)

**Close pass:** 2026-08-08 (Enterprise Map CAP close)  
**Scale:** 0 Ether · 1 Spec · 2 Skeleton · 3 Working · 4 Reliable · 5 Productized  

**Evidence status (per cell):**
- **VERIFIED** — claim matches disk and/or live probe in `EVIDENCE-LOG.md` / inventories this cycle
- **PARTIAL** — real surface + some live or path proof; residual gaps or dual-check incomplete
- **UNKNOWN** — insufficient dual-check; do not treat as closed
- **BLOCKED_MATT** — progress requires Matt approval/action (not agent-only)

**Residual disposition:** DONE · ACTIVE (owner class) · BLOCKED_MATT · PARKED  

**Rule:** Prefer UNKNOWN over false VERIFIED. Matt gates stay BLOCKED_MATT, never false DONE. No CAP dropped.

**Path proofs:** `inventories/R-cap-path-proofs.json`  
**Live anchors:** `inventories/M-live-db-counts.json` (captured 2026-08-08T21:02Z)  
**Narrative claims:** `matrix/EVIDENCE-LOG.md`

---

## Summary counts (this close pass)

| Evidence status | Count | CAP IDs |
|-----------------|------:|---------|
| VERIFIED | **6** | 006, 009, 014, 015, 019, 024 |
| PARTIAL | **28** | 001–005, 007–008, 010–013, 016–018, 020–023, 025–032, 034–035 |
| UNKNOWN | **1** | 033 |
| BLOCKED_MATT | **0** | — (CAP-020 first-cohort gate closed 2026-08-16; look-approve remains M1 after G31) |

*Note:* Residuals that still need a human click: newsletter look-approve (M1), outbound/publish, TC HOLD (M2). Ads spend PARKED. DNS DONE. Video silence = park-in-practice.

| Maturity band | CAPs |
|---------------|------|
| 4 Reliable | 001, 003, 006, 024, 028, 029 |
| 3 Working | 002, 004, 005, 007, 008, 009, 010, 011, 013, 014, 015, 016, 018, 020, 021, 022, 023, 025, 026, 027, 030, 031, 032, 034 |
| 2 Skeleton | 012, 017, 019, 033, 035 |
| 1 Spec | — |
| 0 Ether | — |

---

## CAP-001 — Public Next site (routes)

| Field | Value |
|-------|--------|
| **Maturity** | **4** — Large production Next surface (296 `page.tsx` routes in `A-routes.txt`); app segments 72 (`J-app-segments.txt`); ship discipline on `main`/Vercel. Live host is ryan-realty.com (M5 DONE 2026-08-16). |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `inventories/A-routes.txt` (296); `inventories/J-app-segments.txt` (72); `inventories/Z-inventory-meta.json`; production host historically ryanrealty.vercel.app — **no full route smoke this pass** |
| **Public risk** | High |
| **Broker product?** | Yes (brand surface) |
| **Residual disposition** | **ACTIVE** (ops/growth) — continuous route smoke of money paths. DNS cutover closed (M5 DONE 2026-08-16). |

---

## CAP-002 — Search / map / homes-for-sale

| Field | Value |
|-------|--------|
| **Maturity** | **3** — Core search app under `app/search/**`; public SEO URLs via rewrites `/homes-for-sale` → `/search` (`next.config.ts`). Map split, filters, SEO tail present. Not 4: filter completeness + search opt plans open; F7 MV **DONE** prod 2026-07-29; search perf budget continuous. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `app/search/[...slug]/page.tsx` + sections (MapSplitView, ListingsResults); `app/homes-for-sale/loading.tsx` only (rewrite-backed); `next.config.ts` rewrites 293–300; plans `SEARCH_OPTIMIZATION_PLAN_2026-07-29.md`, `SEARCH_FILTER_COMPLETENESS_PLAN_2026-07-30.md`, `F7-sync-contention.md`; DAL `lib/data/search` domain in G |
| **Public risk** | High |
| **Broker product?** | Yes |
| **Residual disposition** | **ACTIVE** (search filter/opt plans). **F7 MV DONE** prod 2026-07-29 (T-017) — residual query cost is not unapplied F7 |

---

## CAP-003 — Listing detail

| Field | Value |
|-------|--------|
| **Maturity** | **4** — Dedicated listing routes + address/key rewrites; showcase-oriented product surface; continuous polish expected. Not 5: competitor parity / LCP gates continuous, not “finished forever.” |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `app/listing/**` (segment in J); rewrites to `/listing/by-key` and `/listing/by-address` in `next.config.ts`; listing URL canon in Agents.md / `lib/slug.ts`; PROGRAM audit `property-detail-pages-listing-detail.json` |
| **Public risk** | High |
| **Broker product?** | Yes |
| **Residual disposition** | **ACTIVE** (engagement) — showcase polish, photo/LCP watch |

---

## CAP-004 — Geo / KB pages

| Field | Value |
|-------|--------|
| **Maturity** | **3** — Cities, communities, zip, schools, parks, subdivisions, area-guides segments present; geo DAL domains exist. EXPERIENCE archetype uneven across families. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | Segments: `cities`, `communities`, `zip`, `schools`, `parks`, `subdivisions`, `area-guides`, `areas` (`J-app-segments.txt`); DAL: cities, communities, geo, schools, parks, subdivisions, trails (`G-dal-domains.txt`); boundaries live ~3312 (EVIDENCE-LOG); `KB_SITE_CONVERSION_GOAL.md` |
| **Public risk** | High |
| **Broker product?** | Indirect |
| **Residual disposition** | **ACTIVE** (growth/content) — EXPERIENCE completeness; no serial-rollout method reintroduction |

---

## CAP-005 — Market hub / reports

| Field | Value |
|-------|--------|
| **Maturity** | **3** — `app/housing-market/**` hub, reports archive, annual-review, OG routes, market crons scheduled. Shareable monthly consumer artifact / full chart suite historically incomplete. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `app/housing-market/` tree; crons: `market-report`, `generate-market-narratives`, `refresh-market-stats*` (`C-crons-vercel.json`); market DAL; PROGRAM `market-reports-and-market-data-depth.json` |
| **Public risk** | **Critical** (§0 / license-adjacent narrative) |
| **Broker product?** | Yes |
| **Residual disposition** | **ACTIVE** (reporting) — shareable monthly artifact; PDF/export; §0 honesty on admin reports |

---

## CAP-006 — Stats engine (pulse / cache / DAL)

| Field | Value |
|-------|--------|
| **Maturity** | **4** — Live pulse + large cache; only-path for public market stats; methodology stamp on served rows. Not 5: v3 vs v4 definition drift; ClosePrice bands migration apply; continuous freshness Sense. |
| **Evidence status** | **VERIFIED** |
| **Evidence pointers** | EVIDENCE-LOG CAP-006: cache methodology v3=12920, v4=0, v1=70; pulse sample v3; live `market_pulse_live`=45, `market_stats_cache`=12995 (`M-live-db-counts.json`); gates `ci:market-formula`, DAL boundary; migration file `20260808181843_beacon_price_bands_close_price.sql` (hosted apply still open) |
| **Public risk** | **Critical** |
| **Broker product?** | Yes |
| **Residual disposition** | **ACTIVE** (data/accuracy) — hosted ClosePrice apply; pulse freshness Sense; never claim v4 for v3 rows; cache writer adoption of v4 string |

---

## CAP-007 — MLS sync (Spark → listings)

| Field | Value |
|-------|--------|
| **Maturity** | **3** — Multi-lane sync crons scheduled (delta/full/history-terminal); ~595k listings live; admin/sync surface. Not 4: multi-lane ops complexity; some probe table names missing via REST (PGRST205); strict verification backlog continuous. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | listings **594623**, listing_history **3896211** (`M-live-db-counts.json`); crons `sync-delta`, `sync-full`, `sync-history-terminal` on vercel; `app/admin/(protected)/sync/**`; `lib/data/sync` + `lib/sync`; inventory table name probes failed for some legacy names — use SYNC_HANDOFF not invented tables |
| **Public risk** | High |
| **Broker product?** | Yes |
| **Residual disposition** | **ACTIVE** (ops/sync) — delta health Sense; strict backlog drain; runbook accuracy |

---

## CAP-008 — Lead capture / money paths

| Field | Value |
|-------|--------|
| **Maturity** | **3** — Multiple LPs (seller, buyer, FSBO, expired, geo/tetherow); forms write CRM via ensureNativeLead / autoEnroll patterns. Buyer LP has alert upsert code (2026-07-21 class). Not 4: full live re-verify of every LP enroll not done this pass; historical defects require continuous re-check. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `app/lp/*` (sell-your-home, seller-home-value, buyer-listing-alerts, fsbo, expired-listing, tetherow, bend, central-oregon-golf); buyer `actions.ts` autoEnroll + upsertListingAlert (EVIDENCE-LOG); `docs/MARKETING_LEAD_FLOW.md`; crons `crm-auto-enroll`, attribution crons |
| **Public risk** | **Critical** |
| **Broker product?** | Yes |
| **Residual disposition** | **ACTIVE** (monetization/CRM) — re-verify every LP live; hard-stop/suppression parity; attribution residual map |

---

## CAP-009 — Native CRM

| Field | Value |
|-------|--------|
| **Maturity** | **3** — Large people graph (22978); messaging volume; scope helpers exist. Not 4: stages collapse to Nurture-heavy (journey model underused); multi-broker fail-closed not universal; FUB residue keys. |
| **Evidence status** | **VERIFIED** (stage distribution + row counts) |
| **Evidence pointers** | `P-crm-stage-dist.json`: Nurture 20371 · Sphere 2338 · Trash 217 · Past Client 32 · Active Client 12 · Lead 7; crm_message 45299; `lib/crm/scope.ts` (EVIDENCE-LOG); admin CRM tree under `app/admin/(protected)/crm/**` + people; INT-018 FUB Legacy |
| **Public risk** | High |
| **Broker product?** | **Yes** (core) |
| **Residual disposition** | **ACTIVE** (CRM product) — stage writers/product decision; entity-scope baseline shrink; FUB-named residue purge |

---

## CAP-010 — Sequences / sends

| Field | Value |
|-------|--------|
| **Maturity** | **3** — Sequence engine cron scheduled; tables live; suppressions + email_events prove send/measurement plumbing. Not 4: **low throughput** (4 sequence sends; last claim ~2026-07-18); enrollments mostly stopped/paused. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `crm_sequences`=7 (4 active / 3 paused), enrollments=33, sends=4; `email_events`=564 latest 2026-08-08; `crm_suppressions`=5169 (`M-live-db-counts.json` / EVIDENCE-LOG); crons `crm-sequence-engine`, `crm-scheduled-sends`, `crm-auto-enroll` |
| **Public risk** | **Critical** |
| **Broker product?** | Yes |
| **Residual disposition** | **ACTIVE** (CRM sequences) — measurement only-path; pause-on-reply health; raise active throughput intentionally |

---

## CAP-011 — CRM inbox

| Field | Value |
|-------|--------|
| **Maturity** | **3** — Inbox product surface exists; 11F / Product OS work active in parallel Claude session. Not 4 until island purity + dual send paths fully landed and re-censused. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `app/admin/(protected)/crm/inbox/**` (18 component files); `03-COORDINATION.md` parallel ownership; CAP-024/025 census; **this pass did not edit inbox paths** |
| **Public risk** | High (ops failure → broker trust) |
| **Broker product?** | Yes |
| **Residual disposition** | **ACTIVE** (admin / parallel Claude) — finish 11F inbox; re-census on land; mobile+desktop |

---

## CAP-012 — TC / closings

| Field | Value |
|-------|--------|
| **Maturity** | **2** — Vault/TC surfaces and SkySlope mirror rows exist (33/33) but mirror sample `synced_at` **2026-06-10 stale**; TC_BUILDOUT historically PAUSED; not PB-ready productization. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `tc_deals`=33, `skyslope_transactions`=33 (M-live); EVIDENCE-LOG INT-017; admin `closings`, `deals`, `signing`, `transactions`; plans `TC_BUILDOUT_HANDOFF.md`, `TC_ARCHITECTURE_REVIEW.md`; skills skyslope-form-compliance / tc-builder |
| **Public risk** | High (compliance) |
| **Broker product?** | Yes |
| **Residual disposition** | **HOLD** (Matt 2026-08-16) — TC cutover held until TMS thoroughly tested. Do not unpause TC_BUILDOUT. SkySlope stays live TMS; vault remains SoR. Mirror freshness is G8 residual. |

---

## CAP-013 — CMA / BPO

| Field | Value |
|-------|--------|
| **Maturity** | **3** — 267 CMAs in DB; admin CMA/BPO routes; public CMA routes; build worker cron. Not 4: pipeline-to-production partial; ready queue flooded with `content:cma` (brain coupling). |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | cmas=267 (M-live); `app/admin/(protected)/cmas/**`, `bpo/**`; `app/cma/**`, `bpo/**`; cron `cma-build-worker`; plans `CMA_PIPELINE_TO_PRODUCTION_2026-07-30.md`, accuracy pipeline; brain ready sample majority content:cma (EVIDENCE-LOG) |
| **Public risk** | High (§0) |
| **Broker product?** | Yes |
| **Residual disposition** | **ACTIVE** (CMA product) — production pipeline; PAGE_CONTRACT PDF; accuracy pipeline |

---

## CAP-014 — Expired / FSBO prospecting

| Field | Value |
|-------|--------|
| **Maturity** | **3** — Detection via sync-delta (intentional; unscheduled detect-expired is not a production bug); expired_listings=248; FSBO detect cron scheduled; prospecting admin. Not 4: volume/ops hygiene + enroll policy productization. |
| **Evidence status** | **VERIFIED** (wiring intent + counts) |
| **Evidence pointers** | EVIDENCE-LOG CAP-014: `lib/expired-listing-processor.ts` via sync-delta; detect-expired-listings manual/ad-hoc; expired=248; cron `detect-fsbo-listings` on vercel; admin prospecting + expired surfaces (many redirect stubs to new IA); `app/lp/expired-listing`, `app/lp/fsbo` |
| **Public risk** | Med-High |
| **Broker product?** | Yes |
| **Residual disposition** | **ACTIVE** (prospecting) — FSBO off-market hygiene; volume health; enroll policy comments intentional |

---

## CAP-015 — Marketing brain pipeline

| Field | Value |
|-------|--------|
| **Maturity** | **3** — Full pipeline code + crons (dispatcher, runtime, publisher-sweep, measurement-loop); action rows exist. **Learn loop broken as a class:** measured=0; ready backlog ~397 mostly CMA/ops not publishable posts; executed digests lack publish identity. |
| **Evidence status** | **VERIFIED** (queue census + root-cause class) |
| **Evidence pointers** | brain_by_status ready 397 / executed 90 / measured **0** / in_production 92 / killed 73 (M-live); P-brain-* samples; `lib/marketing-brain/measurement-loop.ts` findUnmeasuredCandidates; EVIDENCE-LOG CAP-015 sections; crons producer-*, publisher-sweep, marketing-measurement-loop |
| **Public risk** | Med |
| **Broker product?** | Partial |
| **Residual disposition** | **ACTIVE** (marketing factory) — approve→publish→`published_to`/`published_posts`→measure; drain ready policy; status=measured adoption |

---

## CAP-016 — Content producers / social skills

| Field | Value |
|-------|--------|
| **Maturity** | **3** — Producers registry + skills trees + content engine path exist; many skill-only / NO_SCRIPT rows historically. Video producers removed from registry (2026-06). Inventory N-registry this pass empty/glitch — dual-check REGISTRY.md on disk. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `marketing_brain_skills/producers/REGISTRY.md`; `N-producer-dirs.txt`; `L-skills.txt` (claude skills sample); social_media_skills / automation_skills trees; EVIDENCE-LOG N-registry historical 85 rows; video skills deleted (Claude.md §4) |
| **Public risk** | Med |
| **Broker product?** | Partial |
| **Residual disposition** | **ACTIVE** (content factory) — every REGISTRY row script vs NO_SCRIPT; dead producer cleanup; content_engine only-path |

---

## CAP-017 — Video productized pipeline

| Field | Value |
|-------|--------|
| **Maturity** | **2** — Remotion projects + §4 hard rules on disk; first-frame gate script exists. **Not** brain-shipped product; skill library deleted; productization low. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `listing_video_v4/`; `video/`; Claude.md §4; `scripts/check_first_frame.py`; three caption modules only under `video_production_skills/`; EVIDENCE-LOG CAP-017 |
| **Public risk** | Med |
| **Broker product?** | Partial |
| **Residual disposition** | **PARK-IN-PRACTICE** (Matt silence 2026-08-16) — G12 docket delivered (`docs/plans/ENTERPRISE_MAP/video-decision-docket.json`). Park = $0 vendor / keep R-045. Rebuild = $0.05/1k Turbo + $5/row cap + change R-045 + fix 11 dead safe-zone imports. No rebuild until Matt says rebuild. |

---

## CAP-018 — Meta ads / CAPI / audiences

| Field | Value |
|-------|--------|
| **Maturity** | **3** — CAPI/pixel env; webhooks; audience + westside audience crons; hold DAL. Not 4: G11 KEEP waits for 2026-08-22; **ad spend Matt-gated**. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | INT-007; `readMetaAudienceHold`; last LIVE 2026-08-16T09:01Z CRM 13980; crons `meta-audience-sync`, `meta-westside-audience`; `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`; env META_CAPI_* |
| **Public risk** | High (paid + privacy) |
| **Broker product?** | Indirect |
| **Residual disposition** | **PARKED** spend for v1 (Matt 2026-08-16) + **ACTIVE** (ops) refresh audience heartbeat |

---

## CAP-019 — Multi-social OAuth publish

| Field | Value |
|-------|--------|
| **Maturity** | **2** — OAuth tables + publish paths exist. **Token health corrected 2026-08-15:** TikTok/YT/X/GBP auto-refresh via the daily heartbeat (refresh tokens on file, verified live); LinkedIn parked (no provider refresh token); Threads/Pin/Nextdoor not connected. Still not a productized “multi-social product” — the gap is publish cadence, not tokens. |
| **Evidence status** | **VERIFIED** (heartbeat `sync_logs` 2026-08-15T12:00:03Z + live renew trigger; supersedes the 2026-08-08 `expires_at`-only read) |
| **Evidence pointers** | EVIDENCE-LOG 2026-08-15 token correction; INTEGRATIONS INT-009…016 (corrected); cron `token-heartbeat`; publisher-sweep depends on tokens |
| **Public risk** | Med |
| **Broker product?** | Premium thesis |
| **Residual disposition** | **ACTIVE** (product) publish cadence; LinkedIn **PARKED** per Matt 2026-08-15; **PARK** stands for Threads/Pinterest/Nextdoor |

---

## CAP-020 — Newsletter

| Field | Value |
|-------|--------|
| **Maturity** | **3** (code) — Admin newsletters, subscribers 5346, draft/send crons. Look redesign is G31. Send stays Matt-manual after look-approve. |
| **Evidence status** | **PARTIAL** (G31 redesign open); send is Matt-manual (M1 CHANGE 2026-08-16) |
| **Evidence pointers** | newsletter_subscribers=5346; newsletters total 24 (draft 15 / failed 5 / sent 4) EVIDENCE-LOG; crons newsletter-*; `app/admin/(protected)/newsletters/**`; `app/newsletter` |
| **Public risk** | Med (reputation) |
| **Broker product?** | Yes |
| **Residual disposition** | **ACTIVE** G31 redesign + **M1** look-approve. Enroll/send stay Matt-manual. |

---

## CAP-021 — Broker public pages /team

| Field | Value |
|-------|--------|
| **Maturity** | **3** — `/team` and `/team/[slug]` routes exist; brokers table n=3. Not 4: “dialed” client-send quality bar not closed. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `app/team/page.tsx`, `app/team/[slug]/page.tsx`; brokers=3 (M-live); design team assets; PROGRAM broker recruiting audit |
| **Public risk** | High |
| **Broker product?** | **Yes** |
| **Residual disposition** | **ACTIVE** (broker product) — dialed quality; attribution; stats only from CAP-006 |

---

## CAP-022 — Broker platform / onboarding

| Field | Value |
|-------|--------|
| **Maturity** | **3** — Day-one checklist on Today; own-book fail-closed (`scopeBroker` → `UNMAPPED_OWN_BOOK`); slug from `brokers.crm_slug`; `content.marketing` unlocked for brokers. OAuth-connect of personal socials stays Matt-gated (R-198 residual). |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `lib/crm/scope.ts`; `lib/crm/day-one.ts`; `lib/data/brokers/resolveCrmSlug.ts`; `/admin/today`; `/admin/settings/account`; gate `ci:broker-own-book` |
| **Public risk** | — (internal/growth thesis) |
| **Broker product?** | **Core thesis** |
| **Residual disposition** | **ACTIVE** (platform) — personal social OAuth (D8) still Matt-gated; /join convert instrumented (G10) |

---

## CAP-023 — Consumer portal /account

| Field | Value |
|-------|--------|
| **Maturity** | **3** — Account subtree (saved homes/searches/cities/communities, profile, notifications, collections). Completeness and engagement measurement open. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `A-routes.txt` account/* rows; `app/account/**`; ADMIN_REBUILD consumer-account audit; SAVED_SEARCH_MASTER_GOAL |
| **Public risk** | Med |
| **Broker product?** | No (consumer) |
| **Residual disposition** | **ACTIVE** (engagement) — feature completeness; engagement measurement |

---

## CAP-024 — Admin Product OS shell

| Field | Value |
|-------|--------|
| **Maturity** | **4** — Rule B: real admin pages import v2 barrel; 27 without-v2 are **all redirect stubs** (<40 lines). Shell reliable for product pages. Not 5: continuous no-new-legacy discipline. |
| **Evidence status** | **VERIFIED** |
| **Evidence pointers** | EVIDENCE-LOG admin re-census: 170 pages, 143 with v2, 27 without; `Q-admin-without-v2-classified.txt` all REDIRECT_STUB; `Q-admin-with-v2-import.txt`; `components/admin/v2/*` |
| **Public risk** | Low public / high ops |
| **Broker product?** | Ops |
| **Residual disposition** | **DONE** for rule B shell census · **ACTIVE** (maintain) no new legacy full pages |

---

## CAP-025 — Admin token purity (11F)

| Field | Value |
|-------|--------|
| **Maturity** | **3** — Shell barrel adoption strong; island/token purity and remaining families still rolling (inbox parallel). Token-gate narrative ≠ import census. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | Q-admin inventories; ADMIN_PRODUCT PHASE-11 docs; `components/admin/v2/tokens.css`; coordination 03; CAP-011 parallel |
| **Public risk** | Low public |
| **Broker product?** | Ops |
| **Residual disposition** | **ACTIVE** (admin 11F) — post-inbox island families; token gate coverage ratio |

---

## CAP-026 — Design system public

| Field | Value |
|-------|--------|
| **Maturity** | **3** — Canon `design_system/ryan-realty/` + gates (`ci:design-tokens`, mockup parity). Frankenstein residue / uneven mockup coverage. Not 4 until residual purge continuous green. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `design_system/ryan-realty/MANIFEST.md` + SKILL; `scripts/lint-design-tokens.js` via package; mockup parity gate; Claude.md §3 |
| **Public risk** | High (brand) |
| **Broker product?** | Brand |
| **Residual disposition** | **ACTIVE** (design) — mockup parity remaining routes; residue purge |

---

## CAP-027 — Design system admin v2

| Field | Value |
|-------|--------|
| **Maturity** | **3** — v2 component kit present and widely imported; rolling with 11F. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `components/admin/v2/` (Button, Field, RailNav, tokens, etc.); CAP-024 import census; ADMIN_UI unification docs |
| **Public risk** | Ops |
| **Broker product?** | Ops |
| **Residual disposition** | **ACTIVE** (admin design) — island migration complete; contrast |

---

## CAP-028 — Brand voice enforcement

| Field | Value |
|-------|--------|
| **Maturity** | **4** — Mechanical gates (`ci:brand-voice`) + VOICE.md canon + send-path hard-fail. Not 5: public rewrite surface PARTIAL; continuous vocabulary drift. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `marketing_brain_skills/brand-voice/VOICE.md`; `scripts/check-brand-voice.mjs`; `package.json` ci:brand-voice in ci:gates; `lib/voice/check.ts`; VOICE-CANON plan |
| **Public risk** | High |
| **Broker product?** | Yes |
| **Residual disposition** | **ACTIVE** (brand) — remaining public rewrite; voice-constructions; send-path coverage |

---

## CAP-029 — AEO / SEO plumbing

| Field | Value |
|-------|--------|
| **Maturity** | **4** — llms.txt, JSON-LD patterns, many seo/ci gates, sitemaps. Bytespider robots/middleware conflict **fixed** this map cycle. Defend continuously. |
| **Evidence status** | **PARTIAL** (Bytespider piece **VERIFIED** fixed) |
| **Evidence pointers** | `app/llms.txt`; seo gates in ci:gates; EVIDENCE-LOG CAP-029 middleware; `warm-sitemaps` cron; PROGRAM AEO audit JSON |
| **Public risk** | High |
| **Broker product?** | Indirect |
| **Residual disposition** | **ACTIVE** (SEO/AEO) — JSON-LD completeness; sitemap integrity; regression watch |

---

## CAP-030 — Westside growth program

| Field | Value |
|-------|--------|
| **Maturity** | **3** — Backlog fully dispositioned 2026-08-16 (G7). Luxury money-surface links + review-ask drafts shipped. Audience + cohort crons already live. Residual: crawl prune (GSC-gated), community depth (G22), paid/expired sends (Matt-gated). |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `docs/plans/WESTSIDE_BACKLOG.md`; crons `westside-cohort-digest`, `meta-westside-audience`, `review-ask-on-close`; gate `ci:westside-backlog`; admin CRM reporting westside |
| **Public risk** | High (local authority) |
| **Broker product?** | Indirect |
| **Residual disposition** | **ACTIVE** (growth) — crawl prune + community depth on G22; paid/expired on M-class |

---

## CAP-031 — Analytics fabric (GA4 / GSC / ads snapshots)

| Field | Value |
|-------|--------|
| **Maturity** | **3** — snapshot-channels fan-out includes google-ads (wiring fixed); multi-platform PLATFORMS list; digests. Token expiry + Meta audience staleness degrade reliability. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `app/api/cron/snapshot-channels/route.ts` PLATFORMS (incl. google-ads) EVIDENCE-LOG S1a; performance-pull crons; analytics-daily-digest; admin analytics/* ; INT-008 |
| **Public risk** | Med |
| **Broker product?** | Ops |
| **Residual disposition** | **ACTIVE** (analytics ops) — per-snapshot health; GOOGLE_ADS API env if needed; social token dependency |

---

## CAP-032 — Agent / process OS

| Field | Value |
|-------|--------|
| **Maturity** | **3** — THE LOOP, G44 process canon, mechanical gates, skills registry, Enterprise Map package. Not 4: fleet map not yet mandatory start ritual everywhere. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `docs/DEVELOPMENT_PROCESS.md`; `scripts/check-process-canon.mjs`; Agents.md / Claude.md; `docs/plans/ENTERPRISE_MAP/*`; GLOBAL_SKILLS_REGISTRY; `H-ci-scripts.txt` (~271 ci:*) |
| **Public risk** | — |
| **Broker product?** | — |
| **Residual disposition** | **ACTIVE** (factory) — mandatory map start; no subject-only handoff |

---

## CAP-033 — Grok memory

| Field | Value |
|-------|--------|
| **Maturity** | **2** — Assist layer enabled/seeded externally; **not SoR**; disk_signal false in repo proofs. |
| **Evidence status** | **UNKNOWN** (external to repo; dual-check live memory health not automated here) |
| **Evidence pointers** | `~/.grok/memory/MEMORY.md` (global); R-cap-path-proofs CAP-033 disk=false; EVIDENCE-LOG CAP-033 assist only |
| **Public risk** | — |
| **Broker product?** | — |
| **Residual disposition** | **PARKED** as SoR · **ACTIVE** (assist hygiene) keep seeded; never authority for numbers |

---

## CAP-034 — DSCR tool

| Field | Value |
|-------|--------|
| **Maturity** | **3** — Admin DSCR screen + RentCast integration path; niche but working skeleton→working. Discoverability / emailable list residual. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `app/admin/(protected)/dscr/**`; DAL `dscr`; plan `DSCR_DEAL_FINDER_2026-08-03.md`; INT-027 RentCast |
| **Public risk** | Low |
| **Broker product?** | Niche |
| **Residual disposition** | **ACTIVE** (niche tools) — nav discoverability; draft-first email list; rent source accuracy |

---

## CAP-035 — Broker SMS agent

| Field | Value |
|-------|--------|
| **Maturity** | **2** — Substantial `lib/agent/**` runtime (tools, send, session, tests); plan exists; digests scheduled separately. DoD from plan incomplete. |
| **Evidence status** | **PARTIAL** |
| **Evidence pointers** | `lib/agent/` (runtime, tools/*, send, ingress, gmail, tests); `docs/plans/BROKER_SMS_AGENT_2026-07-31.md`; cron `broker-agent-digest` (≠ daily-broker-digest); Twilio INT-004 |
| **Public risk** | Med (comms / approval model) |
| **Broker product?** | Yes |
| **Residual disposition** | **ACTIVE** (agent product) — complete plan DoD; approval stamps §1; continuous e2e |

---

## Aggregate (honest)

| Band | Reading |
|------|---------|
| **Reliable core** | Public site routes, listing detail, stats engine access model, admin shell rule B, brand-voice gates, AEO plumbing |
| **Working incomplete** | Search residual, geo, market reports, sync ops, money paths, CRM stages/sends, inbox 11F, CMA pipeline, brain learn loop, Meta, newsletter ops, design residue, westside, analytics health, process OS ritual |
| **Thesis / lag** | TC freshness, video product, multi-social health, broker onboarding platform, Grok memory (assist), SMS agent DoD |

**This matrix is closed for cell coverage (CAP-001…035 all filled).** It is **not** a claim that residuals are DONE. Synthesis may cite VERIFIED cells; PARTIAL/UNKNOWN require dual-check before “ship complete” language.

**Path proofs:** regenerated `inventories/R-cap-path-proofs.json` (per-CAP disk/live/evidence_status/notes).  
**Evidence log:** append section “CAP maturity close pass 2026-08-08”.
