# Decisions — recorded 2026-07-21

Matt's answers. These override the recommendations in `03-DECISIONS.md` where they differ.

---

## 1. Loop autonomy — full autonomy, post-hoc review

**Decided:** loops commit and push without Matt in the session. No draft queue for code, infra, gates, DAL, migrations, site content, or dead-code deletion. He reviews after.

**Carve-out held, pending his confirmation:** actions that leave the building and cannot be pulled back stay per-action.

- Sending email or SMS to real people
- Publishing social posts
- Ad spend
- OAuth grants

Reason: CLAUDE.md §0 ties a wrong published figure to a principal broker license, and a send to 129 expired owners has no undo. Everything upstream — build, verify, queue — runs unattended.

**Consequence for `02-LOOP-V2.md`:** the `approval_class` enum collapses from three values to two. `draft-first` is retired. Every candidate is `continuous` except the four action types above, which stay `per-action`. The per-domain cap of 3 and fleet cap of 12 no longer bind on anything except `per-action`, so §6.2's bottleneck-release mechanisms are mostly moot. `loop_standing_approvals` survives only to cover `per-action` grants.

## 2. Brand voice — layer, do not replace

**Decided:** keep the deterministic word list as a free floor. Collapse the 12 hand-maintained copies into one generated source with a parity test. Add an Orwell pass as an advisory LLM reviewer on long-form only.

The Orwell reviewer output format, per Matt's own spec: list every violation first — each stale phrase, each long word with its short replacement, each cuttable word, each passive construction — then the rewrite, with every fact, number, and name unchanged.

Not a commit blocker. Scope extends past `app/` and `components/` to the surfaces currently ungated entirely: emails, SMS templates, CMA prose, video VO, social captions, and Supabase blog posts.

Immediate fix: `lib/marketing-brain/generate-briefs.ts` still hard-fails on "about", "around", "approximately". The canonical list emptied those on 2026-06-02. The brain is rejecting valid content in production.

## 3. Effort units — agent-hours and loop iterations, never calendar

**Decided:** calendar estimates are wrong at this velocity and are banned from program docs. The repo ships ~51 commits a day with agent fleets.

Effort stays on the scoring function's scale (S=1, M=3, L=8, XL=20 agent-hours). Progress is reported as candidates closed per loop iteration, not weeks elapsed.

## 4. Automation spend — measure first, cap later

**Decided:** no ceiling set yet. The $250/month proposal was not grounded in any measurement.

Measured actuals as of 2026-07-21:

| Cost center | Actual | Source |
|---|---|---|
| Brain LLM calls | $8.54 lifetime — $8.42 May (145 events), $0.12 July (3 events) | `marketing_cost_ledger` |
| BatchData skip trace | ~$10/month | 146 new prospects in 30 days (129 expired, 17 FSBO) at ~$0.07/hit per `lib/owner-resolution.mjs:9` |
| Apify | **uninstrumented** — zero rows, `cost_type` only ever records `anthropic_tokens` | `marketing_cost_ledger` |

Pipeline total runs roughly $25–50/month at current volume.

The real cost center is the loop's own model spend, which no ledger tracks. The 2026-07-21 audit alone consumed ~8M subagent tokens.

**Actions:** instrument Apify runs and loop model spend into `marketing_cost_ledger`. Add the zero-result scraper alarm regardless of budget — the current failure mode is indistinguishable from an empty market, which is how the pipelines went dark unnoticed before. Set a ceiling after 30 days of measured cost per closed candidate.

## 5. The loop — shelved

**Decided 2026-07-21:** "Forget the loop right now. We'll pick that up at a later time."

`02-LOOP-V2.md` is preserved but is not part of this program. No scheduler, no `loop_*` tables, no candidate queue, no domain contracts. The program runs as one sequenced spec.

Two things from the loop spec survive because they are useful independent of any loop: the adversarial verification method (build with one agent, refute with a second that is starved of the builder's reasoning, compute the verdict in code rather than asking a model), and the reachability test (a change to unreachable code is not a change).

## 6. Follow Up Boss — zero references

**Decided 2026-07-21:** "We do not use Follow Up Boss anymore so there should be zero reference to it."

Recorded as D21 in `00-MASTER-SPEC.md` §4.1. Verified: FUB is off the serving path, zero calls in `app/`. Residue is 2,662 code references, 15 `fub_*` database columns, 5 env vars including stored login credentials, 905 doc files, and three reachable lib modules still containing FUB API calls — one of them on the live expired and FSBO path.

Converges with the top-priority defect: the identity spine reads `fub_person_id` while writing the native `crm_people.id`. Same fix.

## 7. Consolidation preserves memory

**Decided 2026-07-21, correcting an earlier over-read:** "WE NEED TO KEEP MEMORY AND CONTEXT — I just don't want duplicates or conflicting audits, reports, plans."

The consolidation target is deduplication, not deletion. One audit per subject, one plan per initiative, one statement per rule. History, research, and past findings are memory and are kept. A file is removed only when its entire content has moved somewhere else.

Recorded as D22 in `00-MASTER-SPEC.md` §4.2.

## 8. Still open

- **30-day win condition.** Not answered; the question carried bad calendar framing. Re-ask as an ordering question, not a duration one.
- **IDX agreement**: does it permit public display of individual sold listings? Three nav surfaces promise "Sold homes" and render active inventory. Those links get pulled either way.
- **FSBO price floor**: inherited $500K from expireds with no decision recorded. FSBO stock skews below it.
- **Broker publishing autonomy**: can Paul and Rebecca publish under the brand with their own attribution, or does it route through Matt?
- **`transaction-tc` contract**: commission a 20th audit to seed it, or leave it on the `/tc-builder` ladder outside the contract system?

## 9. Platform decisions — 2026-07-21 (evening session)

Recorded from Matt's answers to the 14-domain platform gap analysis. His words: "LIFT G45, KEEP EXPIRED FLOOR, YES ON NEWSLETTER, YES ON APPROVAL MODEL, ME WANT ACTUAL MECHANICAL AND NOT PROSE."

1. **G45 producer freeze — LIFTED.** Gate script and baseline deleted, `ci:producer-freeze` removed from the chain, CLAUDE.md section shrunk to the lift record. New producers may be added; the action-row protocol, approval queue, and voice gates still govern every one.
2. **Expired capture floor — KEPT.** The 2026-05-19 scope stands: SFR, $500K+, six cities. Widening is a one-constant change whenever Matt says so.
3. **Newsletter — START.** Audience: past clients + engaged leads + the West Side cohort, consent-respecting. Not the full ~12K cold book. Preconditions before the first large send: postmaster ingestion cron, Resend-webhook registration check.
4. **Approval model — CONFIRMED.** Decision 1 (full autonomy, post-hoc review for reversible work) stands with the four per-action classes: outbound messages to real people, publishing posts, ad spend, OAuth grants. Mechanically applied: CLAUDE.md §0.5 rewritten, `check-draft-first.mjs` narrowed to rendered content deliverables (media files in tracked `public/` paths) — code and site content commit clean.
5. **Mechanical over prose — ABSOLUTE, permanent.** Every rule ships as a gate, cron, schema constraint, or contract test, or it does not count. First installment: G53 `ci:cron-registered` (23 dark cron routes: 12 now marked with their real triggers, 11 in a shrink-only baseline), sitemap derives communities from the registry (drift now impossible), sitemap no longer submits 404-ing `/cities/{city}/{subdivision}` URLs.
6. **Sold-listing pages — RESOLVED by the rules themselves (2026-07-21, same session).** Matt is an ODS Participant and directed a review of the ODS Rules and Regulations (Aug 2024). §5-3 (IDX) licenses active-listing display only; §5-4 A.4 defines VOW "MLS listing information" as active + sold data — so sold listings may be shown ONLY to registered, signed-in consumers under the full VOW regime (broker-consumer relationship, terms-of-use click-through with five required clauses, 90-day password expiry, 180-day records, 3-day refresh, no expired/withdrawn display). Public indexable sold pages are off the table; a sold-data experience is a VOW build behind /account sign-in if ever wanted. Enforced by gate G54 (`ci:ods-compliance`). The §8 "Sold homes" nav promises get pulled or pointed at VOW-gated surfaces.

## 10. Program-completion operating findings — 2026-07-22

Recorded during the RR-PLATFORM-DECISIONS completion run (COMPLETION-LEDGER.json). Operating items surfaced to Matt, never auto-actioned.

- **W12.4 out-of-area inventory sizing + Burns/Harney.** Read-only audit against `geo_snapshot_mv` (the same MV the `getOutOfAreaCityIndex` DAL reads; §0 trace: `geo_type='city'`, live prod `dwvlophlbvvygjfxcrhm`, 2026-07-22). **181** cities carry ≥1 active listing; **71** carry ≥5; **61** of those are out-of-area (minus the 14 service-area keys). The referral tier indexes the **top 25** out-of-area cities by active count, so ~36 qualifying-but-smaller markets render noindex — the top-25 cutoff captures the meaningful inventory. **Burns** IS present (`geo_key='burns'`, 6 active, 0 SFR — all non-residential, median null); **Hines** (Harney County) has 3 active (below the 5-active index threshold); no "Harney" city key. Implication: no scope change needed — Burns clears the ≥5 threshold on non-SFR stock; the existing top-25 referral scope is sound. **Matt action:** confirm the top-25 out-of-area referral scope stands (default: yes).

  **RESOLVED 2026-07-22 — Matt chose WIDEN.** The arbitrary top-25 cap is lifted: `OUT_OF_AREA_INDEXABLE_TOP_N` raised 25 → 100 in `lib/out-of-area-cities.ts`, so the ≥5-active-listing threshold (`OUT_OF_AREA_INDEXABLE_MIN_ACTIVE`) is now the effective index criterion and the cap only guards a data glitch. Fresh §0 count (`geo_snapshot_mv`, `geo_type='city'`, out-of-area, plausible-city-key, live prod `dwvlophlbvvygjfxcrhm`, 2026-07-22): **60** out-of-area cities carry ≥5 active listings — all now index, up from 25, adding the ~35 smaller markets (Burns, Hines, …) the old cap excluded. (10 of the 60 have ≥100 active — the big metros already in the old top-25, so widening adds only the smaller towns.) Pure `pickIndexableOutOfAreaCities` returns min(60, 100) = 60. Mechanism: `lib/out-of-area-cities.test.ts` pins `TOP_N === 100` (bites on a regression to 25) + the cap/tiebreak behavior. W12.4 → done.

## 11. Program-completion build-scope decisions — 2026-07-22

Recorded during the RR-PLATFORM-DECISIONS completion run. Scope calls made while closing ledger rows, so the boundary is durable and not re-litigated next session.

- **W7.2 hidden-homes exclusion — surface scope.** "Hide homes I don't want to see" must subtract a hidden home from **every browse of for-sale inventory** and from alert emails. In scope, all now closed on BOTH the list and the map pins where a surface has each:
  - `components/search/SearchResults.tsx` — the /search grid (already excluded).
  - `components/search/MapSearchView.tsx` — the /search split view: subtracts from the card list AND the map pins, plus the hide control.
  - `app/search/[...slug]/page.tsx` **grid** view — renders through the new client `components/search/HideAwareListingGrid.tsx`.
  - ~~`components/UnifiedMapListingsView.tsx`~~ — **DELETED 2026-08-11 (SEARCH_UX_WAVE3 P10).** SEO map/split now seeds flagship `MapSearchView` via `app/search/[...slug]/sections/MapSplitView.tsx` (list+pins+hide via ListingCardHideControl). Historical: was the leak surface in W7.2 R1 when it was a separate stack.
  - `components/search/HideAwareSearchMap.tsx` — the **/search?view=map** (map-only) pin layer: subtracts hidden before the pins draw. (BLOCKER round 2: the map-only branch of the flagship /search page rendered a raw SearchMapClustered with the server's unfiltered pins; the split view hid its pins but the map-only view of the same page did not.)
  - `app/price-drops/page.tsx` + `app/price-drops/[city]/page.tsx` **grids** — through HideAwareListingGrid (`gridClassName` preserves the KB grid styling).
  - `app/videos/page.tsx` — the video-tour browse grid, through the new `components/site/HideAwareVideoGrid.tsx`.
  - Alert emails already exclude via `app/actions/saved-search-alerts.ts`.
  All wrappers match dual-key (ListingKey OR ListNumber) so membership holds whichever identifier `hidden_listings` recorded (`HiddenMatchable.ListNumber` widened to accept the numeric ListNumber some map pin rows carry).
- **Out of scope (deliberate):** surfaces that are NOT a browse of for-sale inventory. The user's OWN data — `app/account/hidden` (shows hidden homes on purpose), `app/account/collections/[id]`, `app/account/page`, `app/account/history`, `app/account/saved-homes` (their saved/viewed lists; filtering their explicit picks by a hide flag would be wrong). Curated recommendation/marketing modules — `FeaturedListings`, `SimilarListings`, `MotivatedListings`, `GolfHomesGrid`/`GolfLanding`, the `app/lp/bend` strip, the `OpenHousesGrid` top-4 preview (the full `/open-houses` page is an event/calendar view, not a listing-card grid). Context maps — `CityMap` / `NeighborhoodMap` (both currently mounted by zero pages; they are city/neighborhood overview maps in the same hero/context class as the price-drops `KbListingMap`, not the interactive search-results pin layer, which is always `SearchMapClustered`).
- **Price-drops terrain MAP dots — out of scope (documented boundary).** The `/price-drops` + `/price-drops/[city]` pages render a `KbListingMap` hero above the results grid, plotting every dropped listing as a dot from the unfiltered set. A hidden home can still appear as a dot there. The boundary: **an interactive search-results map (the /search + city map/split views) subtracts hidden pins because the map IS the results; a supplementary hero/context map does not.** Extending per-user dot-hiding to an SSR-seeded hero map (and then, for consistency, to every listing-marker on the site — listing-detail maps, community maps) is out of scope for W7.2; the actual results list on those pages hides, which is the user-facing promise. Revisit if a future directive wants hero-map dots hidden too.
- **Mechanism (AST-based, un-bypassable).** The `ci:hidden-exclusion-surfaces` gate (`scripts/check-hidden-exclusion-surfaces.mjs`, in `ci:gates`) (1) asserts each exclusion-aware WRAPPER references an exclusion primitive as a real identifier (an AST Identifier node — a comment/string mention can't fake it), and (2) DISCOVERS every `app/**/page.tsx` and fails the build if a page VALUE-imports a raw listing renderer — a card (`ListingCard`/`ListingTile`/`VideoListingCard`) OR the map pin layer (`SearchMapClustered`/`LazySearchMapClustered`) — statically OR dynamically (`dynamic(() => import(...))`), under any local alias, unless the page is in a documented curated allowlist. **It parses imports with the real TypeScript compiler** (`ts.createSourceFile` → walk `ImportDeclaration` / dynamic `import()` nodes), not a hand-rolled lexer. That was the fix after FIVE adversarial rounds each defeated a regex/tokenizer version through a new lexer edge case: an aliased import, a JSX-text apostrophe, a hardcoded page list, `from` inside an import comment, no-whitespace `}from'…'`, a regex literal `/\/*$/` read as a block comment, a nested template `` `${`/*`}` `` desyncing the string scanner, and a unicode escape in the specifier (`'…ListingCard'`). The compiler handles comments, template interpolation, regex literals, and escape sequences natively, and `moduleSpecifier.text` is the DECODED specifier — closing that entire class. A sixth round then defeated even the AST version by SPELLING: a plain relative `import ListingCard from '../../components/site/ListingCard'` resolves to the same file but isn't the literal `@/` string the gate compared. Fixed by matching on the RESOLVED file (`ts.resolveModuleName` with the project's tsconfig paths, then `realpath`) instead of the literal specifier — so relative / `@/` / `@/./` / `@/..` / `.tsx` spellings all collapse to one identity. A seventh round then found the break was at a THIRD layer (specifier collection): a CommonJS `require('.../ListingCard').default` renders the raw card but is a plain call expression, not an import — so it collected `require(...)` + `import x = require(...)` alongside static + dynamic imports, and dropped an unsound basename pre-filter (a renamed path alias would resolve to a raw file under a different last segment) in favor of resolving every value specifier behind a module-resolution cache. Proven to bite on every lexer technique, on a dynamic import, on a direct pin-layer import, on a relative-spelling import and its `.`/`..` variants, on a new uncovered route, and on a wrapper losing its exclusion; the genuine type-only import is correctly not flagged. **Documented residual (out of the gate's per-page-direct-import scope):** a page that reaches a raw renderer *indirectly* — through a barrel that re-exports it or a non-wrapper component that renders it — is not caught (it would need a full import-graph walk). No such path exists today: the round-4 completeness sweep confirmed every browse of for-sale inventory renders through a wrapper, and no barrel re-exports the raw modules. Source-contract tests in `components/search/__tests__/map-search-contracts.test.ts` additionally pin the per-surface dual-key wiring.

## 12. W1.5 — legacy `visits` + `email_campaigns` (2026-07-22/23)

- **`visits` table — retired for READS, repointed to the live pipeline.** Finding that corrects the ledger premise: `visits` is NOT flat-dead — it still takes a stray legacy WordPress-beacon trickle via an old anon INSERT policy (latest row 2026-07-22, 8,573 total), while ALL real traffic writes to `visitor_sessions` (24,536) + `visitor_events` (44,519+). The four readers were showing that stale trickle. Repointed each to the live source at its correct grain (§0-verified against live prod `dwvlophlbvvygjfxcrhm`, 2026-07-23): `app/actions/dashboard.ts` → `visitor_sessions` (session counts; `created_at`→`first_seen_at`, `user_id`→`crm_person_id`, seller-intent via `landing_page ILIKE '%/sell%'` since landing_page is a FULL URL — 465 seller / 11 FB-attributed in 30d; FB now reads the dedicated `utm_source`/`fbclid`/`referrer` columns); `app/actions/partnership-revenue.ts` → `visitor_events` count (page-view activity proxy); `app/admin/(protected)/reports/lead-flow/page.tsx` → `visitor_events.page_url` with `new URL().pathname` extraction (per-page-view, so mid-session LP hits count); `app/admin/(protected)/reports/traffic-sources/page.tsx` → `visitor_sessions` (`path:landing_page` alias + `referrer`). Mechanism: new gate `scripts/check-no-visits-reads.mjs` (`ci:no-visits-reads`, in `ci:gates`) fails on any `.from('visits')` read — proven to bite. The table itself is left in place (the beacon still inserts; dropping it is a separate migration decision).
- **`email_campaigns` — ADOPTED as the native batch-email store, not retired.** It is actively written (`app/actions/admin-email.ts:32` inserts a row per batch send) and read (`lib/data/crm/getEmailReporting.ts:552`, `getBatchEmailsReport.ts`, the `/admin/email/campaigns` page). It is the live batch-email ledger, so it stays; no retirement.
- **FACEBOOK_SELLER_GROWTH_PIPELINE.md fold** — reassigned to M6 (W13.1 CLAUDE.md shrink + doc consolidation), where the canon-fold + routing-entry fixes belong with the rest of the doc consolidation, rather than duplicated here.

## 13. W1.1 — West Side Meta audience refresh (2026-07-23)

- **Heartbeat mechanism EXISTED but was IMPRECISE — now fixed.** `lib/pipeline-heartbeat.ts` already had `evalAudienceSync` (8-day threshold) and `loop-health-check` already probed `meta_audience_log` — the earlier audit's "heartbeat absent" claim was stale. The real gap: the probe read `max(ran_at)` over the WHOLE `meta_audience_log`, but that table is a SHARED ledger — the daily general CRM-audience sync (`meta-audience-sync`, audience_id `120246504502300698`) also writes it. So the daily CRM writes MASKED the weekly West Side refresh (a false green). Fixed: `latestTimestamp` gained an optional equality filter and the West Side probe now scopes to `audience_id = WESTSIDE_AUDIENCE_ID` (`120244510092910698`). Pinned by `app/api/cron/loop-health-check/westside-probe.contract.test.ts` (proven to bite when the filter is removed).
- **§0 flag verification — META_AUDIENCE_PUSH_ENABLED is ON.** `meta_audience_log` has 32 rows, ALL `dry_run=false` (real pushes), latest 2026-07-23, ~daily — but ALL for the general CRM audience `120246504502300698`. The flag is enabled and the general CRM audience is pushing live.
- **NEW FINDING — the West Side audience refresh is DARK (operating, needs Matt).** `meta_audience_log` has ZERO rows for `WESTSIDE_AUDIENCE_ID` (`120244510092910698`) since inception, while the general CRM audience writes daily. The West Side cron (`/api/cron/meta-westside-audience`, weekly Mon 14:00) wraps `refreshWestsideAudience()` in a try/catch and only writes the ledger AFTER it succeeds (route.ts:57→71) — so a throw there produces no row. The route comment even notes "the last push was [via CLI] by hand." The audience Ryan Realty paid to build (~17,665 parcels) is going stale. The now-precise heartbeat will alert on it. **Root cause needs prod runtime diagnosis** (the caught error at route.ts:97 in the Vercel cron execution log for `/api/cron/meta-westside-audience` — most likely a Meta token scope for that audience, or a `loadWestsideInputs` data query) — beyond code inspection. **Matt action:** check the Vercel cron logs for `meta-westside-audience` (or trigger it once with `?dry=1`) and share the error; then it's a targeted fix.
- **Cadence — deviation recorded (weekly, not the decided daily).** The Wave-C impl runs the West Side refresh weekly (Mon 14:00), not daily as the decision named. Recording the deviation here (the audit's ask): weekly is defensible for a parcel-linked homeowner audience that changes slowly, and conserves Meta API calls. Moot until the dark cron is fixed; revisit the daily-vs-weekly call once it produces rows.

## 14. W5.3 — inbound EMAIL replies get reply-intent classification (2026-07-23)

- **Gap closed.** `classifyInboundReply` (`lib/crm/reply-intent.ts`) was wired ONLY into the Twilio inbound-SMS webhook. The crm-gmail-sync path (`lib/crm/gmail.ts` `syncMailboxWindow`) had no reply-intent hookup, so an expired/FSBO prospect who REPLIED BY EMAIL got no classification, no suggested reply, and no `?reply=` deep link — the broker had to read and draft from scratch, while a texted reply from the same prospect got the one-tap enrichment. Now both channels behave the same.
- **Scope parity with SMS (deliberate).** The email pass classifies ONLY prospecting-pipeline contacts, gated on `prospectOutreachContext(...)` returning non-null (expired / FSBO), exactly as the SMS path scopes it. A general lead's email reply is NOT classified. `prospectOutreachContext` was EXTRACTED from the SMS route (was `app/api/twilio/inbound-sms/route.ts` local) into a shared server lib `lib/crm/prospect-context.ts` so both channels call one implementation — byte-equivalent logic, now DRY. (Side benefit: moving those `.from()` reads out of the `app/` route into `lib/crm/` dropped the DAL-boundary violation count 217→155.)
- **The deep link opens the EMAIL composer.** The classified note carries `buildSuggestedReplyLink(..., { channel: 'email', body: recommendedReply, subject: 'Re:<subject>' })` → `?reply=…&replyChannel=email#comms`. `composer-preload.parseSuggestedReply` reads `replyChannel=email` and preloads the EMAIL composer (the SMS path uses `channel:'sms'`). Without the channel marker the parser defaults to SMS — an email reply would wrongly open the SMS composer. The send stays G50-suppression-gated; the link only FILLS the box.
- **Idempotency + bounded cost.** Each note is keyed `gmail-intent:<messageKey>:p<personId>` and the pass pre-checks existing dedupe_keys, so re-syncing a window is a no-op (no dup notes, no re-classify). The LLM fan-out is capped at `MAX_EMAIL_INTENT_CLASSIFY = 12` per invocation (the deterministic fast-path in `classifyInboundReply` handles most replies for free); a large backfill page cannot run the model away. The whole pass is fail-open — it runs on the sync success path (never inside the early-returning catch) inside its own try/catch, so a classification error never breaks the sync or loses the Gmail cursor advance. Only inbound (`dir==='in'`) emails are collected; outbound is never classified.
- **Mechanism (a test that bites, runs in CI).** The note + link construction is a pure module `lib/crm/email-intent-note.ts` (`buildEmailIntentNote` / `emailIntentDedupeKey`), unit-tested by `lib/crm/email-intent-note.contract.test.ts` (7 tests) which round-trips the produced link back through the CONSUMER (`parseSuggestedReply`) and asserts `{channel:'email', body, subject}`. Proven to bite: flipping `channel:'email'`→`'sms'` in the builder turns the round-trip test RED; restored → GREEN. The test matches vitest's `lib/**/*.test.ts` include and runs via `npm run test` in `.github/workflows/ci.yml`, and a wiring block in the same test asserts `gmail.ts` actually collects inbound emails and calls `classifyInboundEmailReplies` + `buildEmailIntentNote` (deleting the hookup fails CI). Referenced in the ledger row's `requiredMechanism.tests`/`paths`.

## 15. W8.8 — one report-coverage geo registry + a gate on inline geo lists (2026-07-23)

- **The five were NOT one set — a §0 correction to the framing.** The audit named five duplicated report-coverage lists. Mapping them exactly showed three distinct tiers, not one: a **report core 7** `{bend, redmond, sisters, sunriver, tumalo, la-pine, terrebonne}` duplicated verbatim in FOUR places (getMarketReportData `CITY_SLUGS`, market-stat-consistency `VERDICT_CITIES`, generate-market-report `VERDICT_CITY_SLUGS`, getContactReportSubscriptions `CENTRAL_OREGON_CITIES`); a **wider 11-city stat tier** (`MARKET_REPORT_DEFAULT_CITIES` — the home snapshot, pulse carousel, stat crons); and a **9-city /cities feature tier** (`PRIMARY_CITIES`). Naively merging the three would have silently dropped 4 cities from the stat crons and changed the /cities cards — a §0 (data-accuracy) violation. So the registry holds each tier as its OWN named export; nothing was merged across tiers.
- **The registry:** `lib/data/geo/report-cities.ts` — the report core once as `REPORT_CITIES` (ordered `{slug,label}[]`) with derived `REPORT_CITY_SLUGS` / `REPORT_CITY_LABELS` / `REPORT_CITY_SLUG_SET`, plus `MARKET_REPORT_DEFAULT_CITIES` (11), `PRIMARY_CITIES` (9), and `NEWSLETTER_MARKET_CITY_SLUGS`. This is distinct from `lib/central-oregon.ts` (the service-area source): report coverage is the smaller verified set the report engine serves a §0-traced verdict for.
- **Repointed (8 sites, every set preserved exactly):** the four core-7 dupes → `REPORT_CITY_SLUG_SET` / `REPORT_CITY_LABELS` / `REPORT_CITY_SLUGS` / `REPORT_CITIES`; `MARKET_REPORT_DEFAULT_CITIES` and `PRIMARY_CITIES` moved into the registry and RE-EXPORTED from their old modules (`app/actions/market-report-types.ts`, `lib/cities.ts`) so every existing import path still resolves; plus two exact dupes the audit's five missed but the new gate caught — `app/actions/market-stats.ts` `populateAllMarketPulse` (an 11-city copy) and (verified, not flagged) the `map-constants.ts` pin table. `getMarketReportData` + `getSalesReportCardsData` params widened `string[]` → `readonly string[]` (a safe generalization — never breaks a caller) so the `as const` registry arrays pass. Re-export gotcha fixed: `export { X } from` gives no LOCAL binding, so `lib/cities.ts`'s own helpers needed a top-level `import` + a separate `export`.
- **Terrebonne / the newsletter — preserved, not "fixed" (§0).** The newsletter Market section covers 6 of the 7 report cities (no Terrebonne). Rather than silently ADD Terrebonne (a change to published newsletter content), `NEWSLETTER_MARKET_CITY_SLUGS` is derived as `REPORT_CITY_SLUGS.filter(s => s !== 'terrebonne')` — byte-identical current behavior, now tracking the core minus the one documented omission. **Open question for Matt:** should the monthly newsletter cover all 7 report cities (add Terrebonne)? One-line change if yes.
- **Mechanism (AST gate that bites, wired):** `scripts/check-report-geo-registry.mjs` (`ci:report-geo-registry`, in `ci:gates`). It parses with the real TypeScript compiler (per the code-inspecting-gate doctrine — never regex), READS the canonical sets from the registry itself (self-adjusting), and fails the build if any array / Set / `{slug}`-object literal in `app/`+`lib/`+`components/` (outside `lib/data/geo/` and tests) is slug-normalized-equal to a registry set. It distinguishes a bare list copy from a per-city DATA TABLE — an object-array that carries data fields (lat/lng) like `PRIMARY_CITY_PINS` is intentionally NOT flagged (it can't import a plain list; its coordinates are real data). Proven to bite: a re-inlined 7-city list in slug OR display-name form turns it RED; removed → GREEN. `ci:gates-wired` confirms it is registered (0 gates run nowhere). Residual (documented): the data-table exemption could be abused by adding a bogus data key to evade — an absurd move the gate does not defend against; it targets honest drift.
- **Out of scope (documented, gate does NOT over-reach):** the housing-market page set (`CORE_CITY_SLUGS`/`HOUSING_MARKET_PAGES`, 11 incl. resort slugs), the pulse-tile/compare set (8, in three housing-market files), the communities-page inline set, the `/pulse` feed set (13), and the video Market/counties + orchestrator sets are genuinely DIFFERENT sets — none equals a registry tier, so the gate leaves them alone. Deduping those is a separate follow-up the audit flagged, not part of W8.8's report-coverage scope.

### 15a. W8.8 — adversarial-verification hardening (2026-07-23)

A 4-lens adversarial verification (§0 set-equality, newsletter §0, consumer integrity, defeat-the-gate) ran before commit. Three lenses passed; the gate lens found two real gaps, both now closed:

- **Gate bypass CLOSED.** The gate extracted a city only from a `slug` property, so the report core re-inlined as `[{value,label}]` (the shadcn `<Select>` option shape) or `[{name}]` evaded it — a real hole, since a market-report city dropdown is exactly how someone would re-inline the list. `cityMembersOf` now extracts from the first of `slug ?? value ?? name ?? label`, so all three object shapes bite. Proven: `{value,label}` and `{name}` core-7 probes now exit 1.
- **Newsletter render order PRESERVED (§0 conservatism).** The first cut derived `NEWSLETTER_MARKET_CITY_SLUGS` as `REPORT_CITY_SLUGS.filter(!== 'terrebonne')`, which inherited the core's tumalo-before-la-pine order and would have silently swapped the La Pine / Tumalo meter rows in the monthly draft (coverage-neutral, but an observable change). It is now an explicit array in the newsletter's historical order (la-pine before tumalo) — zero observable change.
- **Owned-set floor = 7 (avoids false positives).** Making the newsletter 6-set gate-owned false-positived on three unrelated service-area lists (`lib/cities.ts`, `expired-listing-processor.ts`, `fsbo-detector.ts`) that independently enumerate the same 6 primary cities. A report-coverage signature is only distinctive at 7+ cities (the tiers are 7/9/11), so the gate owns only ≥7 sets; the newsletter 6-subset stays import-discipline-protected. Re-verified: clean tree exit 0, and the 7/9/11 tiers each bite in slug, display-name, `{value,label}`, `{name}`, and `new Set([...])` forms.

## 16. W10.5 — producer-registry shim reconciled to reality + resolve gate (2026-07-23)

- **The bug (worse than "dead entries").** The in-process shim `lib/marketing-brain/inbox-producer-registry.ts` still mapped ~24 video action_types to `video_production_skills/*` paths, plus 4 `ops:fub_*` to `ops-fub-crm` and `content:coming_soon_teaser` to `coming-soon-teaser` — none of which have a SKILL.md in the DEPLOYED repo (video producers were decommissioned 2026-06-14 per REGISTRY.md; their tree lives only on the local render worker). The cloud producer-runtime loads `path.join(process.cwd(), producerSlug, 'SKILL.md')`, so a video request routed via the shim died with "SKILL.md not found" and was LOST — instead of falling through to `comms:matt_alert` (which is what an ABSENT shim entry does, via `resolveProducer → null` in inbox-dispatcher).
- **The fix.** Reconciled the shim to REGISTRY.md: removed all 29 entries whose path has no in-repo SKILL.md (verified by resolution, not by name). Now every video / decommissioned action_type has NO shim entry, so the dispatcher routes it to `comms:matt_alert` — the intended funnel: the broker's video request reaches Matt, who fulfills it on the local worker. 57 resolving entries remain, all cloud-runnable.
- **Deliberately NOT pruned (corrects the audit's framing).** The audit also proposed pruning `inbox-parser.ts` VALID_ACTION_TYPES and the `deliverables.ts` broker catalog. Left in place ON PURPOSE: the video action_types stay in VALID_ACTION_TYPES so the parser still classifies a broker's "make a listing reel" correctly and Matt's alert NAMES the deliverable (removing them would degrade the alert to "unknown"); the broker catalog keeps its video items so brokers can still REQUEST video (→ matt_alert → local fulfillment). Gutting the catalog would delete the local-fulfillment request path and leave brokers a skeleton menu (the "Neighborhoods" group would be empty, "Market reports" reduced to one item). The video capability is decommissioned in the CLOUD brain, not removed from the brokerage.
- **Mechanism.** `scripts/check-producer-registry-resolves.mjs` (`ci:producer-registry-resolves`, in `ci:gates`). AST-based (TS compiler reads the object-literal string values, not a regex): fails the build if any shim path lacks a real `<path>/SKILL.md`. Proven to bite (re-adding a `video_production_skills/*` entry → exit 1; removed → exit 0). `ci:gates-wired` confirms it is registered (151 gates, 0 run nowhere). This closes the audit's "no gate exists asserting registry paths resolve to real SKILL.md dirs" gap and prevents the shim from ever again routing to a producer the cloud runtime can't load.

### 16a. W10.5 — a SECOND dispatch map has the same drift (follow-up, out of scope) (2026-07-23)

The independent verifier surfaced a parallel gap the audit missed: `lib/marketing-brain/generate-briefs.ts` has its OWN producer map, `FORMAT_ROUTE_MAP` (line 2421), used by the brain-CYCLE dispatch path (not the inbox path W10.5 fixed). It still maps ~12 video formats + the 4 `ops_fub_*` formats to the same dead `video_production_skills/*` / `ops-fub-crm` paths. This is LIVE, not dead code: the brain generates `ops_fub_*` briefs (generate-briefs.ts:1397–1512) and competitor-gap video briefs (:1162, :2164), which then route to a producer with no in-repo SKILL.md and die in producer-runtime.

It is NOT a clean extension of W10.5's fix: `FORMAT_ROUTE_MAP`'s miss fallback is `automation_skills/content_engine` (:2547), the CONTENT routing bus — correct-ish for an unknown content format, but WRONG as a destination for an ops action (`ops_fub_tag_fix` → content_engine makes no sense) or a decommissioned video. So the right fix is a design choice at the generate-briefs layer — either stop generating briefs for decommissioned/producerless formats, or route them to `comms:matt_alert` like the inbox path — not a mechanical path swap. Scoped OUT of W10.5 (whose recorded target is the inbox `inbox-producer-registry.ts` shim) and spawned as a tracked follow-up. When it lands, extend `ci:producer-registry-resolves` to cover `FORMAT_ROUTE_MAP` too, closing the gate's remaining blind spot.

## 17. W13.3 — loop skills reviewed + streamlined, canon-reconciled, gated (2026-07-23)

- **Promoted to tracked.** `crm-e2e` + `tc-builder` had no `.gitignore` un-ignore AND were never committed — so they lived only on the author's machine and were absent from every clone. Added the un-ignore lines and `git add`ed them; also made `experience-rollout`'s implicit exception explicit. The gate proves it: `ci:loop-skills-canon` fails if `crm-e2e`/`tc-builder` aren't in the git index (an un-ignore without a commit is the exact trap it catches).
- **Stale fleet state stripped.** `tc-builder`'s "## PAUSED — Matt directive 2026-06-11" block (holding all iterations until the v6 homepage shipped) is removed and replaced with a proper "Approval model (2026-07-21)" section. The LIVE "PENDING INPUT — Oregon law sweep" block above it was preserved.
- **Approval model reconciled to 2026-07-21 across the loop skills.** The superseded "Draft-First, Commit-Last always" blanket model was rewritten in `creative-brain` (L92), `growth-loop` (the "wait for Matt's explicit go" ship step + the stale `§0.5` reference), `experience-rollout` (preserving its per-FAMILY review as a NAMED standing exception, not the blanket default), `tc-builder` (new approval section), and `skyslope-form-compliance` (L96 — its "execute needs explicit approval" rule was already correct; only the `§0.5 Draft-First-Commit-Last` citation was stale). `local-seo` needed no change (its outputs are GBP publishing = the per-action "publishing" class, already correctly gated).
- **No retired producer stubs to delete.** Verified: every `marketing_brain_skills/producers/*` dir is a full live recipe. The video decommission (2026-06-14) happened at the REGISTRY level (rows removed), leaving no tombstone directories — so that clause of W13.3 was already satisfied.
- **Contradicting cursor rules reconciled.** `blog-voice.mdc` (replaced a stale 6-attribute voice model with a pointer to `VOICE.md`'s Five Laws; removed a "No hyphens or colons" line that contradicts canon — canon ALLOWS compound hyphens + structural colons; deferred the banned-word list to `brand-voice-vocabulary.cjs`), `design-system.mdc` (same hyphen/colon fix + deferred word list — a copy the enumeration missed, CAUGHT BY THE GATE), and `market-video.mdc` (repointed from two DELETED files to CLAUDE.md's repo-local "Video Build Hard Rules"; removed the "no hyphens in prose" contradiction).
- **Mechanism.** `scripts/check-loop-skills-canon.mjs` (`ci:loop-skills-canon`, in `ci:gates`): fails if crm-e2e/tc-builder aren't tracked, if any tracked skill carries the "commit-last" blanket model, if tc-builder has a "## PAUSED" block, or if any cursor rule re-introduces "no hyphens or colons". It found TWO drifts the manual enumeration missed (skyslope's citation, design-system.mdc). Proven to bite on all three content invariants. A self-inflicted whole-file-exemption bypass (a file documenting the removal exempted a re-introduction elsewhere in it) was found during bite-testing and fixed to a PER-LINE check. `ci:gates-wired` confirms registration (152 gates, 0 run nowhere).

## 18. W4.1 — global header search on the DEFAULT chrome too (2026-07-23)

- **The gap.** "Global header search on every page" only held for the KB-nav chrome (~70 editorial/portal/search/blog/guides routes). Every page that falls back to the DEFAULT chrome — `/dashboard/*`, `/account`, `/login`, `/signup`, `/forgot-password`, `/feed`, and the legal pages (privacy, terms, cookies, dmca, accessibility, fair-housing, data-deletion) — had NO search anywhere in its header (grep of SiteHeader/MegaMenu/MobileNav/HeaderAccount found no SearchSuggest).
- **The fix — reuses the ONE engine, no copy.** `components/site/SiteHeaderSearch.client.tsx` is a compact desktop search widget that imports the SHARED suggestions engine (`useSearchSuggest` / `flattenSuggestions` / `SearchSuggestPanel` from `@/components/search/SearchSuggest` — the same "ONE suggestions engine" KbNav uses); only the input glue is per-chrome. `SiteHeader.tsx` renders it (`hidden md:block`). For sub-md widths, `MobileNav.tsx` gained a `<form role="search">` that routes to the full `/search` page. So every default-chrome page now has header search on desktop AND mobile.
- **Live-verified (§0).** On `/privacy` (a default-chrome page): the desktop input renders, focusing + typing "redmond" fires `GET /api/search/suggestions?q=redmond → 200` and the panel shows 22 real listing suggestions (`/homes-for-sale/redmond/...`). At 375px the desktop input is correctly hidden and the mobile drawer's `<form role="search">` renders visible (`placeholder="Search homes, areas, guides"`). No console errors from the new code. (The dev server showed STALE turbopack errors — `GUTTED_*`, duplicate `noopPassthrough` — from a sibling session's earlier transient mid-edit; the current source is clean, zero `GUTTED_` in the tree, and the only working-tree diff was this change.)
- **Mechanism.** `scripts/check-header-search.mjs` (`ci:header-search`, in `ci:gates`). AST-based (TS compiler): fails if SiteHeader stops rendering `<SiteHeaderSearch/>`, if the widget stops importing the shared engine, if KbNav loses the shared engine, or if MobileNav loses its `<form role="search">`. Proven to bite on all four. `ci:gates-wired` confirms registration (153 gates, 0 run nowhere).
- **Out of scope (noted).** The pre-existing 150ms suggest-perf test bounds handler compute with a mocked DAL, not a live warm round-trip — the audit already called this "acceptable as a CI contract but weaker than the decision's wording"; unchanged here.

- **Design-system compliance (two-gate resolution).** The widget uses a RAW `<input>`/`<label>` (like KbNav + MobileNav search), NOT the shadcn `<Input>`: the default chrome is a burn-down-shadcn site surface (`ci:shadcn-burndown` forbids new `@/components/ui` imports there), and the KB `--cream` tokens are scoped to `.kb-root` (unavailable on the default chrome). All colors are the global `primary-foreground` token; only the raw primitives take a `.design-token-lint-ignore` exception (same class as the KB idiom). Both `ci:design-tokens` and `ci:shadcn-burndown` pass.

## 19. W3.1 — 2-segment {city}/{preset} zero-inventory: noindex + sitemap omit (2026-07-23)

- **The gap.** W3.2/3.3 count-gated the 3-segment `/homes-for-sale/{city}/{area}/{preset}` matrix (emit + noindex only on verified inventory), but the pre-existing 2-segment `/homes-for-sale/{city}/{preset}` set (~840 URLs — the "with-pool-in-Culver class") was untouched: `app/sitemap.ts` emitted EVERY indexable preset for every Central Oregon city with no count check, and the search page's `matrixNoIndex` only fired at `slug.length >= 3`. So a city×preset combo with zero matching active inventory was both submitted to the sitemap AND indexable — thin-content SEO harm + "submitted but noindex" churn.
- **The fix — one count, two consumers.** `buildSearchMatrix` now also computes `countByCityPreset` (search-matrix.ts): the SAME live inventory rows and the SAME tested `presetMatrixMatcher`, aggregated city-wide (independent of the curated-geo buckets). It initializes 0 for every service-area city present in the inventory × derivable preset, so a VERIFIED zero (city has rows, preset derivable, no match) is distinguishable from an unverifiable ABSENT (non-serviceable city / non-derivable preset). `getMatrixCityPresetNoIndex(city, preset)` reads it and is called by BOTH `app/search/[...slug]/page.tsx` (noindex the 2-segment page) and `app/sitemap.ts` (omit it from the sitemap). Fail-OPEN on any unknown state (a transient read blip never hides a live page). Non-derivable presets (keywords, open-house, golf, new-listings) are absent → unchanged (still emitted/indexed).
- **§0 (live trace).** `listing_search_mv` @ `dwvlophlbvvygjfxcrhm`, `standard_status='Active'`: Bend 1287 active / 338 pool, Culver 59 active / 3 pool; and `condos` (property_sub_type ILIKE '%condominium%') = **0 active in culver, la pine, madras, powell butte, terrebonne** — so `/homes-for-sale/culver/condos` is a genuine verified-zero combo the guard now noindexes + omits.
- **Mechanism.** Two parts, both wired + proven to bite: (1) `lib/seo/search-matrix.test.ts` — the vitest contract pins `countByCityPreset` (city-wide count, verified-zero → `shouldNoIndexMatrixCombo` true, absent → fail-open, MLS `city_lower`→slug mapping); proven RED when the verified-zero initialization is removed. (2) `scripts/check-sitemap-inventory-gate.mjs` (`ci:sitemap-inventory-gate`, in `ci:gates`) — AST-asserts BOTH `app/sitemap.ts` and the search page CALL `getMatrixCityPresetNoIndex` (a correct helper nobody calls guards nothing); proven RED when the sitemap guard call is removed. `ci:gates-wired`: 154 gates, 0 run nowhere.

## 20. W10.4 — bulk approve / bulk reject in the approval queue (2026-07-23)

- **The gap.** The marketing-brain approval queue (`/admin/approval-queue`) could only act on one row at a time (`_components/ActionButtons.tsx` → `POST /api/admin/approval-queue/[id]/action`). With 328 `ready` rows in the queue, clearing or approving a batch meant one click per row.
- **The feature.** `POST /api/admin/approval-queue/bulk-action` batches the two verbs that make sense across a selection — `approve_now` (→ `approved`) and `reject` (→ `killed`, shared reason). UI: `_components/BulkSelection.tsx` — a React context provider (`BulkSelectionProvider`, holds the selected-id Set + `allIds` for select-all), a per-row `BulkSelectCheckbox` in the `ActionCard` header (hidden on already-`killed` rows), and a sticky `BulkActionBar` (approve-all / reject-all-with-required-reason / select-all / clear). On success the bar `router.refresh()`es so the flipped rows drop out of the `ready`/`needs_changes` fetch — no cross-card status sync. `page.tsx` wraps the card list in the provider and mounts the bar.
- **Authz + safety (the two properties that matter).** Every code path calls `requireAdminRoute('approvals.act')` BEFORE `createServiceClient()` — the SAME superuser-only publish gate as the single-row route (`approvals.act` → empty role list in `capabilities.ts`, true only for `role==='superuser'`). Every mutation is status-scoped `.in('status', ['ready','needs_changes'])`, so a stale client submitting an id already `approved`/`killed`/`executed`/`pending`/`in_production` matches zero rows and cannot re-flip it; `.select('id')` returns the honest `affected` count. Input caps: `ids` must be a non-empty, de-duped string array ≤ `MAX_BULK`(100); reject requires a non-empty `killed_reason`.
- **§0 / correctness (live trace).** `marketing_brain_actions` @ `dwvlophlbvvygjfxcrhm`: a mixed candidate set proved the status-scope — 3 `ready` rows → `would_be_affected=true`; an `executed` + an `in_production` row → `false`. Verified WRITE-SAFE (the surface publishes content, per-action approval-gated) — DB + production `next build`, never approving a real row.
- **Mechanism.** `scripts/check-bulk-approval-wired.mjs` (`ci:bulk-approval-wired`, in `ci:gates`). AST-based (TS compiler, no regex). Bites on 5 failure modes, each proven RED→restore→GREEN: (1) dropped/downgraded `requireAdminRoute('approvals.act')`; (2) a `marketing_brain_actions.update()` branch missing `.in('status',...)` in ITS OWN fluent chain — PER-BRANCH, walking each update's receiver (`.from('marketing_brain_actions')`) down and its scope up, so stripping the scope from just ONE of the two mutations is caught (a gap the first file-level version missed, found by the independent adversarial verifier and closed here); (3) `<BulkSelectCheckbox>` not RENDERED as JSX (import alone fails — a second gap caught during bite-testing); (4) `<BulkActionBar/>` not rendered on the page; (5) zero `update()` branches (gutted mutation). `ci:gates-wired` confirms registration.
- **Independent verification.** A separate adversarial agent (assume-broken brief, told to find a way it's broken) confirmed all six checked properties (authz before write + matching cap; per-branch terminal protection; input caps; full producer→consumer UI wiring with refresh+clear + required reject reason; gate is AST-based and in the chain; tsc clean) — verdict PASS, and surfaced the single-branch gate gap now closed.

## 21. W11.1 — one generated banned-list source, all consumers generated, drift gate (2026-07-23)

- **The gap.** `scripts/brand-voice-vocabulary.cjs` was the "single source of truth" in name, but only 2 consumers (the ESLint plugin + `check-brand-voice.mjs`) actually loaded it, and the gate-wired parity test asserted only those two require-paths — never list CONTENT, never the other consumers. ~10 more runtime consumers each hand-typed their own banned list, and several had DRIFTED: `generate-briefs.ts` rejected any brief containing "about" (plus around/leverage/comprehensive/navigate) and `_producer_lib.py` hard-banned spacious/cozy/turnkey/leverage/navigate/comprehensive/foster — all words the canonical source relaxed 2026-06-02. The .cjs is CJS in `scripts/`, so the Next app bundle can't `require` it and Python can't import it at all — which is why the copies existed.
- **The fix — a codegen bridge, not more copies.** `scripts/gen-brand-voice-consumers.mjs` (`--write`/`--check`) reads the canonical .cjs and emits two DERIVED, in-bundle artifacts the consumers CAN import: `lib/brand-voice/generated-vocabulary.ts` (app-bundle + tsx) and `scripts/_brand_voice_vocab_generated.py` (the build_*.py fleet). `BANNED_PATTERNS` (the VOICE.md law regexes) is deliberately NOT mirrored — no in-bundle consumer needs it and the pattern scanners already `require` the .cjs directly, so emitting it would just trip `ci:reachable-exports`. All 10 consumers (`voice-precheck`, `templateVoiceCheck`, `generate-briefs`, `gbp-health-check` route, `preflight`, `build-blog-post`/`build-comms-client-update`/`build-agent-coop-eflyer`, `_producer_lib.py`, `generate_content_calendar.py`) now import the generated/canonical core; genuine per-consumer terms stay as explicit `LOCAL_EXTRAS` layered on top, never a re-typed core. The `gbp-health-check` route dropped its char-code obfuscation (it existed only to dodge the CI scanner a hand-typed array would trip).
- **Live bugs fixed.** `generate-briefs.applyBrandVoice` no longer rejects legitimate briefs containing "about"/"around"; `_producer_lib.grep_banned` no longer flags spacious/cozy/turnkey/leverage/navigate/comprehensive/foster — confirmed at runtime that clichés (stunning, boasts) still trip and the relaxed words no longer do.
- **Mechanism.** `scripts/check-voice-vocab-parity.mjs` (`ci:voice-vocab-parity`, in `ci:gates` immediately before `ci:program-complete`). Two assertions, each proven RED→restore→GREEN: (1) **freshness** — shells out to `gen --check`; a canonical .cjs edit made without regenerating fails. (2) **per-consumer discipline** — a `CONSUMER_MANIFEST` of all 10 files; TS/JS via the TypeScript compiler AST (real import/require of the canonical source AND no array literal overlapping the canonical core), Python via a comment-stripped scan. A consumer that re-hand-types a CORE list OR drops the import fails. Coverage went from 2 of ~12 (content-blind) to all 10 (content-aware).
- **Verified.** tsc 0 errors project-wide; `gen --check`, the gate, `ci:reachable-exports`, `ci:gates-wired`, the existing `.cjs` parity test, and vitest (`templateVoiceCheck` + email, 58/58) all green; the three gate bite-modes proven; the relaxed words confirmed absent from BOTH generated artifacts. Independent adversarial verifier (different agent, assume-broken, behavior-preservation focus): PASS.

## 22. W11.2 — one shared voice-check on every send path + ratchet gate (2026-07-23)

- **The gap.** Two self-contained runtime voice checks existed (`voice-precheck.ts` for newsletters, `templateVoiceCheck.ts` for CRM templates), each with its own list; and of the four send paths the decision names, only sequence-templates was actually gated. Blog publish, CMA/BPO prose render, and social captions had no word-scan.
- **The fix.** NEW `lib/voice/check.ts` — `checkBrandVoice(input, opts)` returning `{ok, violations:VoiceViolation[]}`, the ONE shared scanner, consuming W11.1's `generated-vocabulary` (never hand-typed). String or `{subject,body,bodyHtml,bodyText}` input; `stripHtml` + entity handling from the old newsletter check; `allowExclamation` (default false; true for captions/SMS which permit one `!`); word-boundary matcher from the template check (handles multi-word phrases + hyphens). `voice-precheck.ts` and `templateVoiceCheck.ts` became thin adapters over it, preserving their exact return shapes (verified by the existing suites). Send paths wired to each file's own convention: blog `saveBlogPost` RETURNS `{ok:false}` on a published post's violation (drafts stay WIP); `lib/cma/build.ts` + `lib/bpo/build.ts` THROW before render (caught by the builder's outer try/catch → graceful `{ok:false}`); social `resolveCaption` THROWS (caught by the route). CMA/BPO prose fed to the check is our own generated narrative (template literals + data-derived stats), not raw MLS remarks — low false-positive risk.
- **Mechanism.** `scripts/check-voice-send-paths.mjs` (`ci:voice-send-paths`, in `ci:gates` before `ci:program-complete`). AST (TS compiler): for each of the 5 registered paths, asserts `checkBrandVoice`/`checkTemplateVoice` is called-and-bound to a const AND that binding gates the send via `if(!X.ok){ return | throw }`. Proven to bite (dropping the guard on a path → RED). Modeled on `ci:newsletter-voice-paths`.
- **Verified.** tsc 0 errors; `ci:voice-send-paths` (5/5) + `ci:voice-vocab-parity` (W11.1 intact) + `ci:reachable-exports` + `ci:gates-wired` green; `checkBrandVoice` unit test (20 cases) + the two refactored adapters keep vitest green (78 tests); sanity-checked that clean prose passes and clichés/`!`/em-dash are caught. Independent adversarial verifier initially FAILED it — proved 3 false-positives (a semicolon literal + the unsanitized LLM narrative throwing on CMA/BPO, a non-graceful social batch-fail); all 3 fixed (semicolon->period, LLM narrative excluded from the hard gate, per-platform graceful caption failure) and re-tested before flip.

## 23. W11.4 — voice canon reconciled to VOICE.md; G35 repointed (2026-07-23)

- **The gap.** VOICE.md was the named single source of truth, but the canon around it still carried the retired model: brand-voice/SKILL.md led with a five-attribute voice model (trustworthy / honest / knowledgeable / professional / dependable) that predates and contradicts the Five Laws (Law 1 forbids the site from saying any of those words), and the G35 producer gate required `voice_guidelines.md` (the mechanical-floor companion) rather than VOICE.md. **Zero** producer SKILL.md referenced VOICE.md.
- **The fix.**
  - **VOICE.md** gained two sections after the Five Laws: **The Orwell rules** (once a sentence passes the Laws, six rules decide how it reads — no clichés, short words over long, cut what you can, active voice, plain English over jargon, break a rule before writing something graceless) and **Never pander** (never praise the reader or ourselves, never talk down, never manufacture urgency; warmth is fine, pandering is warmth with nothing behind it). Written to model the voice (no em-dash, en-dash, or semicolon; banned words appear only as quoted counter-examples).
  - **brand-voice/SKILL.md** retired the five-attribute table for a Five Laws pointer to VOICE.md, and the frontmatter description was updated to match.
  - **.cursor/rules/blog-voice.mdc** was already reconciled to VOICE.md's Five Laws by W13.3 — no change needed.
- **Mechanism.** `scripts/validate-producer.mjs` G35 `MANDATORY_REFS_BASE` repointed `voice_guidelines.md` → `VOICE.md`, enforced by `ci:producer-skills` (in `ci:gates`). The repoint immediately failed 51 producers (none cited VOICE.md), so a script inserted a clean `marketing_brain_skills/brand-voice/VOICE.md` reference into every producer SKILL.md across `marketing_brain_skills/producers` + `social_media_skills`, plus TEMPLATE.md so new producers inherit it. Now every producer points to the canonical source.
- **Verified.** `ci:producer-skills` 51/51 PASS; the gate is proven to bite (drop the VOICE.md reference from a producer → RED, restore → GREEN); the VOICE.md added prose carries no banned punctuation; `ci:gates-wired` clean. Independent adversarial verifier initially FAILED it — caught the first-pass line-insertion splitting 21 markdown tables/lists and 25 self-violations of the punctuation rule in VOICE.md; both fixed (structure-safe inline replacement, VOICE.md punctuation converted) and deterministically re-verified before flip.

## 24. W11.3 — Orwell advisory reviewer with a §0 fact-preservation guard (2026-07-23)

- **The gap.** The deterministic floor (`checkBrandVoice`, W11.2) catches banned words + punctuation, but not the softer Orwell failures (clichés, long words, cuttable words, passive voice, pandering) that a human editor would flag. The decision asked for an advisory LLM pass that lists those + offers a rewrite, without blocking anything.
- **The fix.** NEW `lib/voice/reviewer.ts` `reviewProse(text, opts)` — an ADVISORY, non-blocking LLM pass (same Anthropic tool-forced pattern as `lib/cma/judge.ts`, `claude-sonnet-4-5`). Returns `{ran, violations, rewrite, factsPreserved}`. It degrades to `{ran:false, rewrite:null, factsPreserved:true, violations:[]}` when there is no `ANTHROPIC_API_KEY`, the text is empty, or the API errors — it **never throws and never blocks** a build or publish.
- **§0 fact-preservation guard (the mechanism).** Exported `factsPreserved(original, rewrite)` extracts every currency, number, percent, and 4-digit year from the original and requires each to survive in the rewrite. `reviewProse` **nulls** any rewrite that drops a fact (`factsPreserved:false`) — an advisory rewrite can never surface a changed number. (The output is human-reviewed, never auto-applied; the number guard is the hard floor. Proper-noun preservation is instructed in the prompt but not machine-enforced — a noted, acceptable limitation for advisory output.)
- **Wiring (non-blocking, alongside the deterministic floor).** `lib/cma/build.ts` + `lib/bpo/build.ts` attach a `voiceReview` to the result; `app/actions/blog.ts` `saveBlogPost` attaches it on the published path; the newsletter draft logs the violation count (its body is fixed evergreen copy and the deterministic gate already runs at send). Every call is `.catch()`-guarded.
- **Mechanism.** `scripts/check-voice-reviewer.mjs` (`ci:voice-reviewer`, in `ci:gates`). AST: asserts `reviewProse`'s own body CALLS `factsPreserved` (the guard is applied, not just defined) AND cma/bpo build call `reviewProse`. Proven to bite (remove the guard call → RED; unwire a surface → RED).
- **Verified.** tsc 0 errors; `reviewer.test.ts` 9/9 (fact-guard + no-key degrade); **LIVE run confirmed end-to-end** — on "This stunning home is nestled in a charming neighborhood. It sold for $725,000 in just 38 days" it flagged 5 stale-phrase violations and returned "This home is in a quiet neighborhood. It sold for $725,000 in just 38 days." (clichés gone, $725,000 + 38 preserved). W11.1/W11.2 gates + reachable-exports + gates-wired all green. Independent adversarial verifier: PASS (never-blocks confirmed) — its §0 guard gaps (percent unit, magnitude inflation, and a gate that green-passed a present-but-defeated guard) were all fixed + re-verified before flip.

## 25. W11.5 — batched voice-rewrite review over stored copy (2026-07-23)

- **The gap.** W11.3 built the advisory reviewer, but nothing ran it over the copy already published. The decision asked for a batched pass over published blog posts + stored templates, reviewed before republish.
- **The fix.** `scripts/voice-rewrite-batch.ts` reads `public.blog_posts` (status=published) + `public.crm_templates`, strips HTML to prose, runs `reviewProse` over each, and writes a REVIEW ARTIFACT (`out/voice-rewrite-batch/report.{json,md}`, gitignored) of violations + fact-safe rewrites. `--source blog|templates|all`, `--limit N`, `--all`. The W11.3 §0 fact guard still applies, so a rewrite that drops a number is nulled and never suggested.
- **Read-only IS the "reviewed before republish" guarantee.** The batch never writes to the content tables. Verified live: after a run, the reviewed post's `updated_at` was unchanged.
- **Mechanism.** `scripts/check-voice-rewrite-batch.mjs` (`ci:voice-rewrite-batch`, in `ci:gates`). AST: asserts the batch calls `reviewProse`, writes an artifact, and contains ZERO mutator references. An independent verifier proved three evasions (`.rpc()`, computed `['update']()`, aliased `.update.bind()`); the gate now flags ANY mutator reference — direct, computed, or aliased — plus `.rpc`, and all four are proven to bite.
- **Verified.** Gate GREEN + bites on all four vectors; live run over published posts produced the artifact (one post flagged 21 violations: stale phrases + cuttable words); nothing written to the DB; `ci:gates-wired` clean.

## §27 — market_stats_cache city slug canonicalization (M5 prerequisite, §0) — 2026-07-24

The `/api/cron/refresh-market-stats` route built city geo_slugs via `slugify(name)` ("la-pine"),
but `compute_and_cache_period_stats` matches a city by `lower("City") = lower(p_geo_slug)` and stores
the row under p_geo_slug verbatim. `slugify` never matches a multi-word city, so La Pine, Powell Butte,
and Crooked River Ranch got stale/empty cache stubs, while the in-DB pg_cron writer (keying on
`lower("City")`, the space form) wrote the fresh, correct rows — a two-convention split-brain where the
published number depended on which slug a surface queried. Nothing wrong was published (the read path,
`citySlugCandidates`, resolves to the space form) but it was a latent §0 hazard and the stub writer ran
every 6h.

Fix: the route now maps city names via `.toLowerCase()` (space form), matching the RPC and the in-DB
writer, so the two writers converge. The 36 stale hyphenated city stubs (la-pine / crooked-river-ranch /
powell-butte, 12 rows each) were deleted; the black-butte-ranch NEIGHBORHOOD row was untouched.
Mechanism: `ci:market-city-slug-canon` (in `ci:gates`) AST-asserts the city refresh writer lowercases the
name and never calls slugify — bites on a revert to slugify. Verified live: /cities/la-pine renders
$415,000 median sale, matching the fresh space-slug cache row. Unblocks W2.6 / W8.4 / W8.5 (the backfill
and archive would otherwise reproduce the broken stubs).

## §28 — W8.7 deterministic §0-safe market-narrative generation + the market_narratives writer (M5) — 2026-07-24

The decision asked for the Mohtashami corpus applied to narrative generation, and for `market_narratives`
to get its writer. Built as a DETERMINISTIC generator, not an LLM: `lib/data/market/market-narrative.ts`
`buildMarketNarrative(stats)` interpolates ONLY a `market_stats_cache` row's own values, so §0 (every
published number traces to a verified source) holds BY CONSTRUCTION — an LLM narrative can drift or
fabricate a figure; a template over the source row cannot. The Mohtashami framing is applied as analytical
METHOD (months of supply as the demand/supply balance, price + days-on-market + inventory read together,
buyer/seller outlook from the direction of those three), never reproduced text. The writer
(`marketNarrativeWrites.ts`) reads the real cache row + `market_pulse_live` months-of-supply and upserts
`public.market_narratives`, with `generated_from_stats_id` linking each narrative back to the exact cache
row it was built from. Cron `generate-market-narratives` (vercel.json, 15 8 * * *, after the 07:00 stats
refresh) fans it out over every report city + region.

The §0 hazard this closes: sale-to-list is stored as a FRACTION (0.9697), and a first build shipped it as
"sold for 1.0% of asking" by formatting the raw fraction. Fix: `pctFromRatio` (×100). Two mechanisms now
bite the CLASS, not just the instance — the gate `ci:market-narrative-integrity` (in `ci:gates`)
esbuild-EXECUTES the generator over fixtures and adds a plausibility band (check D: sale-to-list outside
50-150% is a scale bug even though the mis-scaled value "traces") plus a comma-grouping check (E), and the
producer→consumer int test asserts the stored sale-to-list == `ratio*100` explicitly (the old test was
vacuous — it stripped every % before checking). Both were bite-tested: reverting the fix turns the gate
RED and fails the int test; restoring returns GREEN. `supplyVerdict` delegates to the canonical
`marketVerdict()` (`ci:market-formula`), and a null MoS makes NO market-direction claim.

Verified live end-to-end by an independent adversarial agent (assume-broken): the stored Bend/2026-06-01
narrative reads "median $725,000, 183 sales, sold for 97.0% of asking (=0.96968×100), $403/sqft, 470
homes, 3.9 months of supply, a seller's market" — every number equal to its cache field formatted,
`generated_from_stats_id` = the exact source row. The writer's `lower(City)` space-form slug hits the real
121-row historical series (not the stray hyphen stubs), and zero-sales geos hit the skip guard (no invented
narrative). Also reconciled a pre-existing RED that had blocked every commit repo-wide: the admin nav D9.2
budget test (`lib/admin/capabilities.test.ts`) had been failing since W10.2 shipped the "Content library"
nav item (capability `content.view`, granted to both roles) without bumping the 38/21 count — corrected to
the verified 39/22.

## §29 — W8.5 per-city decade sales archive (M5): the live consumer of the W2.6 cache backfill — 2026-07-24

W2.6 backfilled a decade of monthly `market_stats_cache` rows (121 per report city, 2016-07 → present,
byte-verified vs raw SFR listings). Those rows were orphaned — no live surface read past ~month 60. W8.5
is the CONSUMER that lights them up: `/housing-market/reports/archive/[city]` (a static route,
`generateStaticParams` over the `REPORT_CITIES` registry, placed under the canonical `/housing-market/reports`
namespace because bare `/reports/*` 308-redirects there) renders per-year aggregate statistics through
`getCityArchive`.

§0 decision — SINGLE SOURCE, so every figure reconciles by construction. The archive reads ONE monthly-cache
series (`getPriceHistory`) and aggregates per year: homes sold = the exact Σ of monthly `sold_count` (a
per-month closed count, so the annual sum is additive and exact). The price column deliberately does NOT
fabricate an "annual median" — a median of monthly medians is not a true annual median. It shows the RANGE of
the year's monthly medians (each itself a verified aggregate). A month below `MONTHLY_VOLUME_FLOOR` (3
closings) is kept out of the range, so a 1-2 sale month's near-individual "median" can never surface as a
published statistic (ODS §5-4 A.4 aggregate-only; §7-3 source line on the section). The hyphen report slug
(la-pine) resolves to the space-form cache slug (la pine) — the W2.6/§27 trap.

Data-completeness fix the integration test caught: `getPriceHistory`'s zod `limit` cap was 120, but a report
city already has 121 monthly rows, so the archive silently dropped the oldest month (2016-07) and undercounted
2016. Raised the cap 120 → 180 (15-year headroom); every other caller passes ≤ 60, so the change is inert for
them. Labeling fix an adversarial verifier caught: `complete` is now based on all-12-cache-rows-present, not
months-carrying-a-median, so a finished past year with a zero-sale month (e.g. Terrebonne 2024, all 12 rows,
4 dead months) reads complete instead of a misleading "(through 8 months)"; only genuinely partial 2016
(6 months) and the current year carry the flag.

Mechanism (un-fakeable producer→consumer, in CI via `lib/**/*.test.ts`): `city-archive-depth.int.test.ts`
hits the live DB through the archive's OWN DAL and turns RED on a limit regression (24 months = 2 years), a
slug regression (la-pine stays hyphenated → empty), or a broken homesSold aggregation (reconciled against an
independent cache Σ). The prior W2.6 test only queried the raw table, so this closes the "page ignores the
deep cache" gap. `getCityArchive.test.ts` pins the pure aggregation. Wiring auto-covered by `ci:page-dal`
(imports `@/lib/data/*`) + `ci:static-params` (exports `generateStaticParams`). Verified live: Bend 2016-2026
renders, 2024 = 1,540 sold / $680,000-$797,000 (= the cache row exactly); independent adversarial agent PASS
on all six attack dimensions.

## §30 — W2.1 subdivision light-up: the stats leg ships (M1) — 2026-07-24

Matt directed "DO SUBDIVISION." The threshold/sales-history/noindex/sitemap legs were already live;
the starved stats leg is now built as a dedicated producer→consumer unit. Producer:
`public.compute_subdivision_period_stats` — a NEW focused SECURITY DEFINER function, NOT a patch to the
shared 400-line `compute_and_cache_period_stats` (whose subdivision branch scopes name-only via
`initcap(p_geo_slug)` and would merge same-named subdivisions across cities — Deer Park exists in
Sunriver AND Bend, DRRH in Bend AND La Pine). The new function scopes by `"City"=p_city AND
"SubdivisionName"=p_subdivision_name` (exact, non-lossy), uses the canonical SFR methodology
byte-faithful to the shared RPC (percentile_cont, >=5 DOM/ratio/ppsf thresholds), and adds an ODS >=3
median gate — a subdivision median over 1-2 sales is a near-individual price and stores NULL instead.

Writer `refreshSubdivisionStats` iterates data/resort-communities.json, keys each row
`geo_slug=slugify(alias)` — exactly the `/subdivisions/[slug]` route slug, so write-key == read-key by
construction — and runs from the `refresh-subdivision-stats` cron (vercel.json 08:30 UTC,
requireCronAuth). Consumer reads `getMarketStats({geoType:'subdivision', periodType:'ytd'})` (default
rolling_90d was unpopulated and ODS-thin). Backfilled 100 registry subdivisions, 43 with ytd sales.

§0 verified by an independent adversarial agent (PASS, all 8 attack vectors): stored == manual
recompute EXACT on all checked subdivisions (Eagle Crest 37/$890,000 … sparse Sunrise Village
3/$1,300,000; 43/43 with-sales rows reconcile); the cross-city merge provably absent (Deer Park stores
7, not the merged 8); all 17 thin rows NULL medians; 100/100 slugs match; consumer renders the stored
numbers ($935,000/14 on rivers-edge-village). Mechanisms bite: the real-DB int test went RED on a
corrupted median and GREEN after the producer restored the exact value; the verifier's finding that the
cited static gate didn't exist was fixed by building `ci:subdivision-stats-integrity` (AST: producer
city+name scoping, writer slugify keying, consumer ytd period — proven RED on de-scoping city and on
flipping the period). W2.4 keeps an honest residual (schools section, plat parent cross-links, curated
events/HOA) — its stats leg is complete.

## §31 — W2.4 MPC parity completes: schools + parent cross-links (M1) — 2026-07-24

The last two MPC-parity legs on /subdivisions/[slug]. SCHOOLS: `get_subdivision_schools` RPC returns
the modal school per level from the subdivision's OWN listings' MLS school fields (city+SubdivisionName
scoped, aggregate-only); the DAL's pure `applySchoolThreshold` claims a school ONLY when >=70% of >=10
listings agree. The §0 case for the threshold is real and live: Rivers Edge Village's elementary splits
691/1164 (59.4%) across an attendance boundary and is OMITTED, while its high school (Summit High,
1100/1106 = 99.5%) renders with a verified /schools/summit-high cross-link. A clean 50.0% split
(Sunrise Village elementary) and masked MLS junk ('********' districts) are likewise never published — a
wrong school claim is worse than none. PARENT CROSS-LINKS: plain GIS plats derive their parent city as
the modal city of their own in-boundary listings (strict majority) into breadcrumb + JSON-LD; a plat
with no matching listings honestly renders no crumb rather than a guess; registry plats keep their
resort link. Events/HOA render only-where-curated — no curated source exists, so nothing renders,
which is what the decision says.

Mechanism: `ci:subdivision-stats-integrity` extended (page must call getSubdivisionSchools AND render
the section — proven RED on removal) + 5 unit tests pinning the threshold on the real mixed-split and
junk cases. Independent adversarial verifier: PASS with zero defects — recomputed every claim across
all 100 registry pairs, verified no sub-threshold claim can render, cross-links land on the correct
school pages, and the W2.1 stats leg is unregressed. W2.1 + W2.4 are both done; the subdivision surface
now carries stats, sales history, schools, and parent links end to end.

## §32 — W8.4 canonical /housing-market/[geo] report: timeframe selector + explore retired (M5) — 2026-07-24

Two atomic legs, both live on the pre-generated geo report. LEG A — TIMEFRAME SELECTOR: the city-scope
report gains a YTD-default period selector (this-month / last-12-months). The server pre-fetches all
three market_stats_cache rows through one DAL helper, `getCityMarketDetailByTimeframe`, which fans out
to the cached `getCityMarketDetail` per period (each keeps its own cache entry + tag, each self-catches
to null); the client `KbTimeframeStats` only formats + swaps the displayed block — it never computes or
fetches. §0 is exact and live: /housing-market/bend YTD renders $721,000 / 846 sold / 96.6% sale-to-list
/ Hot, matching the bend·city·ytd cache row (median 720500 → $721,000) to the dollar; monthly and
rolling_365d each trace to their own period row (not the YTD values re-labeled), and a null field renders
the em-dash placeholder rather than a fabricated 0.

LEG B — RETIRE EXPLORE: the custom date-range/property-type/price-band explore tool (the 924-line
ExploreClient behind /reports/explore, re-exported at /housing-market/explore) is removed. Both routes
now 308-redirect to /housing-market (verified live: 308 → /housing-market 200); the explore pages,
ExploreClient, its loading state, and the explore-only HousingWireMarketContextCard are deleted and
imported by nothing; ~11 inbound links across app/ + components/ + lib/ (sitemap, llms.txt, reports
index, GeoMarketOverview, MarketPulseCarousel, lib/slug.ts reportsExploreYtdPath, site-menu, site-nav,
lead-landing-content) now point at the canonical /housing-market/[geo] report or /subdivisions/[slug].
This is the program-authorized M5 "retire explore" move — it also removes the public custom-filter
consumers of the three get_city_period_metrics RPCs, teeing up the W8.1 admin-only decision.

Mechanism: `ci:no-explore-route` (in ci:gates) — no app/**/explore report page may exist, both routes
must redirect, and no source file may link the retired routes. Proven to bite: RED on re-adding an
explore page.tsx, RED on re-adding a `/housing-market/explore` link to a lib/ source file, GREEN after
each restore. The fetch extraction into the DAL helper minimized leg A's growth on the frozen p2.2
god-file; the residual +15 was re-baselined as a single hand-edited entry (not a whole-baseline rewrite,
which would have absorbed an unrelated in-flight breach), so the file-size gate still bites past 884 and
on every other frozen file. Independent adversarial verifier: PASS on all 5 attack vectors, re-verified against the fetch->DAL refactor commit. §0 is exact for bend and redmond across all three periods (each panel binds its own market_stats_cache row, proven by the YTD-vs-monthly inventory split), null fields render the em-dash, both explore routes 308-redirect with every file deleted and imported by nothing, and ci:no-explore-route bit RED on both a re-added explore page and a re-added link then GREEN on restore. The one observation (a 1-unit cross-tab inventory difference) traces to the pre-existing 6h market_stats_cache window, not a §0 violation and not introduced by W8.4..


## §33 — W8.1a MoS window for resorts in outbound market-report email (LOCKED 2026-07-27)

**Status:** LOCKED. Matt decision: `switch resorts to 6mo` (spoken as "8.1, is 6 mos").

**Implementation (`lib/data/crm/getMarketReportData.ts`):**
- Cities AND resort neighborhoods prefer live `market_pulse_live.monthsOfSupply` (canonical 6-month close base: `active / (closed_6mo / 6)`). Resort neighborhood rows come from `refresh_community_market_pulse` (BL-016 / DATABASE_FOR_AI_AGENTS §3a).
- `soldLast12mo` stays on `market_stats_cache` `rolling_365d` for the email volume line (same dual-base pattern cities already used).
- When pulse MoS is null (sparse slow-turnover geos), fall back to computing MoS from the rolling_365d sold count so the email still has a real figure.
- Thresholds unchanged (≤4 seller · 4–6 balanced · ≥6 buyer).

**Rejected option:** KEEP 12mo as the primary resort MoS base.
