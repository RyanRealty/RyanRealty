# Runtime crosswalk — 2026-08-18

Photograph of what is **in use**, **unused**, and **not seen**. Built from a clean `origin/main` tree (`1d2e52ea`) plus live Vercel / GitHub / Gmail probes. Mentions in plans are not use.

**Goal:** faster to run, faster to change, code matching what is live. Smaller tree is the byproduct.

**Do not delete not seen.** Do not message people, spend ads, or touch OAuth.

CMA dirty work on `cursor/cma-client-document-7fc3` was left alone. This file lives in worktree `/Users/matthewryan/RyanRealty-audit-20260818`.

---

## Method

Six machine-visible universes:

1. Credentials / Vercel env **names**
2. Who the code phones (SDKs, hostnames, webhooks)
3. What actually runs (Vercel deploys, cron invocations, GitHub Actions)
4. Hit surface (`app/` pages, `app/api`, `vercel.json`)
5. Vendor probes this TUI can reach (Vercel, GitHub, Gmail; no send)
6. Leftovers (skills, gates, docs that spawn fake work)

Hunters: 25 explore agents + parent probes. Skeptics try to kill unused claims before apply.

---

## Live snapshot (probed 2026-08-18)

| Fact | Evidence |
|---|---|
| Public host | `ryanrealty.vercel.app` **308 → `https://ryan-realty.com`** (Vercel fetch) |
| Vercel project | `prj_7ApmWUMyZQR3IIQbSiqHyzSWZoaA` / team `team_zwYQPapH0CpleD7RzJ7WctGO` / name `ryanrealty` |
| Latest READY production | `f6e29988` — newsletter subscribe hydration (`dpl_CGedqTqh…`). Tip `1d2e52ea` docs-stamp deploy was **CANCELED** |
| Extra Vercel projects | `ryan-realty-lps` (stale READY, no custom domain) · `tmp` (empty) |
| Production env keys | **106** names (CLI). Includes live vendors **and** leftover `FOLLOWUPBOSS_*`, `INNGEST_*`, `NEXT_PUBLIC_FUB_*` |
| `LOOP_SENTINEL` | set on production |
| `PRODUCER_RUNTIME_ENABLED` | set on production |
| Gmail MCP | connected (labels exist). Did not read mail. |
| Grok Tasks automations | **empty** |
| GitHub workflows | **10 active**. CI on `1d2e52ea` **success**. Nightly E2E last two runs **failure** |
| Hottest public routes (1h logs) | `/search/[...slug]` 6183 · listing-by-address 410 · `/contact` 238 · `/search` 161 |
| Hottest crons (24h logs) | `crm-alert-drain` 1442 · `newsletter-send` 722 · `crm-bulk-worker` 721 · `loop-sentinel` 177 · `sync-delta` 96 |

Vercel MCP `get_project.domains` did **not** list `ryan-realty.com`. Domain is live via redirect. Dashboard-only aliases remain **not seen**.

---

## Universe 1 — credentials

### In use (names present in prod **and** read by app/cron)

Supabase, Spark, Twilio, Resend, Meta (pixel + CAPI + ads + page), GA4/GTM/Ads/AdSense, Google OAuth + GBP + GSC service account, Maps, ElevenLabs, Anthropic, xAI, Replicate, Synthesia, SkySlope, Upstash Redis, Sentry, VAPID, stock APIs (Unsplash/Pexels/Shutterstock), Apify, Tracerfy, BatchData, FRED, LinkedIn/TikTok/Threads/X/YouTube OAuth, `CRON_SECRET`, `LOOP_SENTINEL`, `CURSOR_API_KEY`, `PRODUCER_RUNTIME_ENABLED`.

### Unused (key exists in Vercel; runtime accessor dead or only scripts)

| Name | Why unused |
|---|---|
| `FOLLOWUPBOSS_API_KEY` | `getFubApiKey()` hardcoded `undefined` (`lib/crm/fub-env.ts:17`) |
| `FOLLOWUPBOSS_EXECUTION_ENABLED` | FUB HTTP off |
| `NEXT_PUBLIC_FUB_PIXEL_ID` | pixel component gone |
| `NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM` | leftover identity param |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | send-only client; no in-repo worker |

**Park, do not delete from Vercel until a second pass confirms no dashboard job.** Removing a secret is irreversible for any hidden caller.

### Not seen

Full preview/development key set vs production. Whether `GA4_API_SECRET` is the live MP path. Whether GTM container doubles GA4/Meta. Registrar / Cloudflare / password-manager logins.

`.env.example` is a tiny subset (13 names). Prod has 106.

---

## Universe 2 — who the code phones

### In use

| Vendor | Live path |
|---|---|
| Supabase | every page/DAL/cron |
| Spark MLS | `sync-delta` / `sync-full` / `sync-history-terminal` |
| Twilio | inbound SMS/voice + sequence engine |
| Resend | newsletter + broker digest + health |
| Meta Graph | pixel, CAPI, audience crons, publish |
| ElevenLabs | Twilio recording STT |
| Anthropic | producer-runtime, inbox-poll, SMS agent |
| Replicate | admin headshot studio |
| SkySlope | `skyslope-mirror-refresh` cron |
| GA4 + GTM + Ads + AdSense | root layout |
| Sentry | instrumentation |
| Google Maps / OpenFreeMap | search map (CSP) |
| Widgetbe | **still required by CSP gate** though FUB pixel is gone |

### Unused leftovers

Follow Up Boss HTTP, OpenAI photo-classify (zero callers of `classifyListingPhoto`), Stripe (no SDK), Mapbox (probe CSS only), Calendly (tag union only), Remotion (not imported by Next app).

### Not seen

SendGrid, Mailgun, Posthog, Vercel Analytics/Speed Insights, Slack, Zapier, Cloudinary, Mux.

---

## Universe 3 — what runs

### In use — Vercel crons

**68** paths in `vercel.json`. All 68 have `app/api/cron/<name>/route.ts`. 24h logs show the frequent ones firing (CRM drain, newsletter, bulk, loop-sentinel, sync-delta, producer-runtime/dispatcher).

**10** `marketing-snapshot-*` routes are **not** in `vercel.json` but **are in use**: parent `snapshot-channels` (`vercel.json:233`) fans them out. 7d logs: 1 hit each (daily parent).

### Unused / dark cron HTTP shells

| Route | Verdict | Next |
|---|---|---|
| `detect-expired-listings` | unused HTTP; work is inside `sync-delta` | tombstone comment; do not schedule |
| `neighborhood-default-subscriptions` | manual-only by design | **park** |
| `start-sync` / `sync-parity` / `sync-verify-full-history` / `refresh-listing-year-stats` | operator curl only | **park** (manual) |
| `refresh-video-tours-cache` | no caller, twin action also unused | **kill candidate** |
| `strategy-revision-check` | header lies about vercel.json | **kill or register** |
| `weekly-cycle` | alias of `marketing-weekly-cycle`; only unused `run-loop-cycle` | **kill candidate** |
| `/api/sync-spark` | claims 15-min cron; not registered | **kill candidate** |

### In use — GitHub Actions

10 workflows, all `active`. Real factory: `ci.yml` (lint + `ci:gates` + test + build), `pr-labeler`, `security`, `smoke-test`, `release` (tag every main push, **no** CHANGELOG commit).

### Broken-but-scheduled

- `quality.yml` lighthouse/pa11y: **no `start:ci`**. Nightly LH/a11y structurally broken.
- `e2e-nightly.yml`: last two scheduled runs **failure**.
- `resend-webhook-nightly.yml` duplicates `quality.yml` resend check.
- `release.yml` still auto-releases every main push (Build CPU).

### AGENTS.md schedule lies

| Claim | Reality |
|---|---|
| Optimization loop Mon 6am GHA | No GHA. Closest: `marketing-optimization-report` Mon 06:30 Vercel |
| Saved search alerts daily 2pm GHA | Vercel **hourly** |
| Market report Saturday 2pm GHA | Vercel **Sunday** 14:00 |

---

## Universe 4 — hit surface

### In use — public (from 1h logs + tree)

Search (`/search`, `/search/[...slug]`), listing-by-address, home, contact, sell, cities, subdivisions, blog, videos, activity, compare, account, open-houses, our-homes, tools (mortgage + rental), housing-market/reports.

**Search/listing (last hunter).** Two live stacks: flagship `app/search/page.tsx` (`SearchFilters` + `MapSearchView`) vs SEO `app/search/[...slug]/page.tsx` (`SearchFilterBar` + grid; map only on `?view=map|split`). Pretty listing URLs rewrite to `app/listing/by-address` → `app/listing/[listingKey]`. Count SoR is `publishSearchCount` / `publishSearchCountPair`.

Bottlenecks still in code (not cleaned this pass):

| Issue | Where |
|---|---|
| Timeout paints empty / “No homes match” | SEO non-bare grid `ListingsResults.tsx:38`; flagship `view=map` `search/page.tsx:72-76`; golf `GolfBranch.tsx:15` |
| SEO map/split waits on 12s grid fetch first | `search/[...slug]/page.tsx:138-271` |
| SSR map is active+pending; client pan is Active-only | `MapSplitView.tsx:90-104` vs client filters |
| Neighborhood on grid; map sends subdivision name | `page.tsx:103-107` vs `MapSplitView.tsx:184-186` |
| Infinite-scroll drops registry / max beds-baths | `SearchResults.tsx:87-110` |
| “No homes” while filter-match still in flight | `MapSearchView.tsx:712-715` |
| Header all-types vs FAQ SFR | `search/[...slug]/page.tsx:278-336` |
| Split/map silently injects city Bend | `search/page.tsx:222-229` |
| by-key redirect pays full photo/agent fetch | `listing/by-key/[listingKey]/page.tsx:14-19` |

Unused leftover search UI: `HotCommunitiesSection`, `InFeedAdCard`, `ListingFilters`, old `components/listing/showcase/*`.

### In use — APIs

**210** `app/api/**/route.ts`. ~155 in use (68+10 crons + webhooks + OAuth callbacks + admin UI + product).

Live webhooks: Twilio (7), Meta lead ads, Resend.

### Unused APIs (high confidence, pending skeptic)

~42 unused HTTP shells including: Inngest-shaped admin sync POSTs that have no worker (UI may still hit `/api/admin/sync/delta` — treat as **broken in-use** if the button exists), marketing-brain diagnose/generate-briefs HTTP wrappers (weekly cycle calls TS directly), per-network `publish-facebook/instagram/tiktok` (publisher uses `/api/social/publish`), several CMA email/track JSON routes, `/api/spark-status`, `/api/sync-spark`.

### Unused UI (G55 orphans)

~165 unused components: old listing showcase stack, old city/neighborhood/community heroes, leftover homepage chrome, `components/listing/showcase/` entire folder. Live cards: `site/ListingCard`, `lp/ListingCard`, `VideoListingCard`.

**Do not mass-delete components in this pass.** One-hop mistakes are easy. Queue after a dedicated skeptic + `ci:dead-ui` / reachable-exports.

### CRM

In-house CRM is **live**. 59 admin CRM pages. Sequence crons registered and firing. `sendEvent` is a native shim (22 importers). FUB HTTP is off.

Unused CRM modules: `lib/crm/lead-router.ts` (`captureLead` zero callers), `lib/crm/saved-view-seeds.ts`.

---

## Database (code vs photograph)

**483** migrations. Newest: `get_current_mortgage_rate` / listing PITI (`20260817190000`). Snapshot + DAL index stamped **2026-08-18T01:27Z**. No live `information_schema` this pass.

**In use from `app/`/`lib/`:** `sale_pricing_facts`, `listing_pricing_reads`, analytics marts, `fleet_findings`, `loop_work_nodes`, `tc_deal_people` / form catalog, plus ~50 SECURITY DEFINER RPCs (`search_listings_advanced`, `search_listing_keys_in_shapes`, CRM claim/lease, market refresh, CMA comps).

**Unused in code (live unknown — do not drop):** `sale_pricing_seller_net` view, `sale_pricing_price_steps`, `analytics_dim_agent`, `analytics_inventory_snapshot`, backfill cursor tables, `listing_detail_mv` (DAL uses tile/search MVs), `get_beacon_metrics` / `get_homepage_market_stats` (types only). Snapshot still lists `trending_scores` after a drop migration — photograph conflict.

**Not seen:** whether all 483 files are applied; RLS/GRANT state; leftover backfill-queue rows.

### Unused `lib/` modules (high confidence, do not mass-delete)

45 top-level `lib/` folders. Almost all have a live entry. High-confidence unused leaves:

| Module | Note |
|---|---|
| `lib/crm/lead-router.ts` | `captureLead` — LPs still call `sendEvent` |
| `lib/canonical.ts` | pages use `getCanonicalSiteUrl` |
| `lib/lead-scoring.ts`, `lib/listing-highlights.ts`, `lib/market-condition.ts` | tests only; market classify lives in `lib/market/classify.ts` |
| `lib/email-templates/layout.tsx` | live mail uses `lib/email/shell.ts` |
| `lib/site/layout-constants.ts` | zero importers |
| `lib/tc/deal-state.ts`, `lib/tc/signing-schema.ts` | tests only; not wired into seal/signing |
| `lib/voice/alignment.ts` | tests only; scripts copy the voice ID |
| `lib/crm/saved-view-seeds.ts` | tests lock AST vs SQL — keep |

`lib/youtube-market-report/` has no Next importer. **Park** (possible offline CLI). Do not delete this pass.

---

## Universe 5 — vendor probes

| Probe | Result |
|---|---|
| Vercel project + deploys | live |
| Vercel runtime logs 1h / 6h / 24h | live (24h unfiltered timed out; cron query worked) |
| Vercel env names | 106 |
| GitHub workflows + CI runs | live |
| Gmail labels | connected |
| Grok Tasks | empty |
| Voice MCP | Grok voices only — **not** product ElevenLabs |
| Hosted Postgres | **not seen** (no query this pass). Snapshot photograph `2026-08-18T01:27Z`. 483 migration files on disk. |
| Meta/Google Ads/GSC consoles | **not seen** |
| Spark live inventory | **not seen** |

---

## Universe 6 — agent surface / theater

This is the bloat that makes the next agent slower.

### In use process (do not delete)

- `/admin/loop`, `lib/data/loop/*`
- `/api/cron/loop-sentinel` (firing) + `loop-health-check`
- `scripts/loop-brief.ts` (G44)
- Gated ENTERPRISE_MAP JSON: `VERSION-1.md`, `REQUIREMENTS.md`, look-walk / video-docket / integration-health / search-completeness
- Page-grade **refuse stubs** (G44 requires they stay KILLED)
- `ci:gates` (~250 unique checks) — many are real product ratchets (`ci:publish-*`)

### Unused theater (tombstone from agent surface)

| Item | Why |
|---|---|
| `AGENTS.md` start ritual: EXECUTION_PLAN + SITE_SPEC + `orchestrate.ts` | No gate. SITE_SPEC still says AgentFire WordPress. task-registry 49/49 |
| `AGENTS.md` CRM = Follow Up Boss | CRM is native |
| `AGENTS.md` `video_production_skills/**/SKILL.md` | files gone |
| `SESSION_HANDOFF.md` “execute ALL-OPEN” | second backlog vs `loop_work_nodes` |
| `ALL-OPEN-ITEMS.md` + frozen inventories (2026-08-08) | no writer, stale census |
| `CROSS_AGENT_HANDOFF.md` Prior (1700+ lines) | runtime uses 18-line Current |
| `experience-rollout` / `public-product-os` grind bodies | superseded headers, still instruct grind |
| `deep-audit` 10-pass OS | manufactures punch lists |
| `automation_skills/triggers/*` + post_scheduler / buffer / engagement / performance_loop / ab_testing | claim routes that **do not exist** |
| 25 REGISTRY producers with no writer | newsletter/alerts/site-pages already have TS paths |
| `content_engine` SKILL still routes to deleted video SKILLs | fallback assignment only |
| `GLOBAL_SKILLS_REGISTRY.md` dated 2026-04-22 + ghost video paths | wrong tree |
| `ci:design-directives` / version-manifest / program-complete / look-walk as *first read* | they gate markdown; they are not the product |

### Skills

**124** `SKILL.md` on disk. **33** have a live writer or CI that requires the file. **89** unused (agent-only or prose duplicate of a TS cron). **2** killed-but-required (page-grade stubs).

### Gates

~250 in `ci:gates`. Zero true orphan `check-*.mjs` (empty baseline). Theater: gates that only assert plan markdown. `ci:data-access` claimed nightly — **not in any workflow**. `docs/MECHANICAL_GATES.md` still says “7 orphans.”

---

## Ordered streamline queue

Apply in this order. Stop at the first bucket that needs a second human look.

### P0 — agent surface (this pass)

1. Stop telling agents `orchestrate.ts` / `task-registry.json` is next work.
2. Stop saying CRM is Follow Up Boss.
3. Stop pointing at missing `video_production_skills/**/SKILL.md`.
4. Stop SITE_SPEC / EXECUTION_PLAN as the start ritual (WordPress world).
5. Tombstone automation trigger SKILLs that invent missing crons (`STOP` at top).
6. Tombstone `experience-rollout` / `public-product-os` grind tables (keep file, refuse-to-grind).
7. Strip ghost video SKILL paths from `GLOBAL_SKILLS_REGISTRY.md`.
8. Fix `content_engine/SKILL.md` deleted-video routing.

### P1 — users already feel / jobs that lie

1. Nightly E2E failing (GitHub).
2. `quality.yml` LH/a11y without a server.
3. `TriggerDeltaSyncButton` → Inngest with no worker (broken admin).
4. Dual GTM + gtag if both env ids set (needs container — Grok Bot).
5. Widgetbe still required in CSP after FUB pixel deletion.
6. `release.yml` tags every docs push.

### P2 — unused code, one class at a time

1. Kill unused API shells after skeptic (spark-status, sync-spark, unused CMA JSON, unused marketing-brain HTTP).
2. Mark or delete dark crons that are not manuals.
3. Unused REGISTRY producers: tombstone SKILL, do not delete TS product that already shipped.
4. Unused components (showcase + old geo heroes) behind `ci:dead-ui`.
5. Unused deps: `@dnd-kit/core`, `isomorphic-dompurify`, `@types/dompurify`.
6. Park leftover Vercel secrets (`FOLLOWUPBOSS_*`, `INNGEST_*`) after confirm.

### Do not touch this pass

- Dirty CMA branch in the primary checkout
- Hosted Supabase objects
- Anything **not seen**
- In-use crons (including loop-sentinel and producer-runtime)
- Page-grade refuse stubs
- Live search/listing/CRM write paths

---

## Counts

| Slice | In use | Unused | Not seen |
|---|---:|---:|---:|
| Vercel crons | 68 + 10 fan-out | 9 dark shells | dashboard-only crons |
| API routes | ~155 | ~42 | 13 (OAuth authorize + printed curls) |
| GitHub workflows | 10 | 0 disabled | last-run for some |
| Prod env keys | ~90 product | ~5 leftover FUB/Inngest | preview drift |
| Vendors phoned | 12 | 6 leftovers | 8 never in tree |
| SKILL.md | 33 | 89 | prod producer-runtime effect |
| Components | live v3 + search + listing-detail | ~165 orphans | admin CRM walk |
| Gates | ~250 chained | 0 true orphans | `ci:data-access` “nightly” |

---

## Handoffs (filled when apply finishes)

### Instructions for Matt

P0 agent-surface cleanup is applied on worktree branch `wt/runtime-crosswalk-20260818` at `/Users/matthewryan/RyanRealty-audit-20260818` (not the dirty CMA checkout).

What changed:
- `AGENTS.md` no longer starts on SITE_SPEC / orchestrate / FUB-as-CRM / missing video SKILLs
- `SESSION_HANDOFF.md` no longer orders ALL-OPEN execution
- Trigger skills + content_engine + experience-rollout + public-product-os refuse to grind
- `GLOBAL_SKILLS_REGISTRY.md` §F no longer lists deleted video SKILLs

How to verify:
```
cd /Users/matthewryan/RyanRealty-audit-20260818
node scripts/check-process-canon.mjs   # passed
node scripts/check-claude-canon.mjs    # passed
node scripts/check-loop-skills-canon.mjs
node scripts/check-producer-skills.mjs
```

What stayed: all 68 Vercel crons, CRM, search, listing, loop-sentinel, producer-runtime. CMA dirty files on the other checkout were not touched.

To land on `main` later (not done this session — CMA branch is dirty in the primary tree): merge `wt/runtime-crosswalk-20260818` into `main` from a clean checkout, then one `npm run push`.

### Grok Bot prompt (visual / console gaps)

Draft:

> Open ryan-realty.com on 390 and 1280. Confirm home, search (Bend + $800k 3+ beds), one listing, one city, one community, sell, team. Screenshot first paint and after map settle. Check GTM preview: is GA4 firing twice (gtag + GTM)? Is Meta Pixel + CAPI matching? Does `/admin/sync` “Trigger delta” actually move a cursor or fail silently? Do not invent a listing. Do not send mail or spend ads.

---

## Sources

- Worktree `1d2e52ea`
- `vercel.json` (68 crons)
- Vercel MCP: project, deployments, runtime logs, env names
- GitHub MCP: workflows, CI + nightly E2E runs
- Hunter IDs in this session (cron, API, CRM, skills, vendors, analytics, gates, packages, MLS, theater, killed-processes)
