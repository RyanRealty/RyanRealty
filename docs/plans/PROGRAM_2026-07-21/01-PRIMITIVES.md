## THE SHARED PRIMITIVES

**Verification note:** I re-checked the load-bearing claims in source rather than trusting the audits. Confirmed by direct read: the identity join mismatch, `attributeOutbound`'s early return, the KB tracker's three-layer break, the three market-stats engines, the geo-registry duplication, and the cron/vercel.json diff (23 routes on disk unregistered). Two corrections to the audits are noted inline.

---

### The thesis, in one finding

Run this comparison. `isSuppressed` / `addSuppression` has **47 adopting files**. `recordEmailEvent` has **5**. Both are helpers in `lib/crm/`. Both cover every send path in principle. The difference is that `scripts/check-email-send-gated.mjs` is wired into `ci:gates` and asserts every send site is suppression-gated, and **no gate asserts any send site is measured**. `scripts/check-email-tracking.mjs` is in the chain but I read it: it gates HMAC forgery, replay TTL, and timeline dedup on the *token mechanism*. It never asserts a send path calls `recordEmailEvent`.

In this codebase a primitive gets adopted exactly as widely as its gate forces, and not one file further. That is the whole program. There are 125 gates in `ci:gates` and 180 `ci:*` scripts defined, which means the mechanism works and is trusted. The nine primitives below are each "a correct implementation exists somewhere, was never made the only path, and drifted into 3-12 copies." Building them without simultaneously gating them will reproduce the exact failure the audits documented.

---

## P0 — Liveness and Reachability Spine

**What it is.** A gate family plus one table that answers "is this code actually running, and did anyone check?" Three parts: (a) `scripts/check-cron-registered.mjs` failing CI when any `app/api/cron/*/route.ts` has neither a `vercel.json` entry nor an in-repo fan-out caller; (b) `scripts/check-reachable-exports.mjs` failing on exported server actions, DAL functions, and `components/**` with zero external importers; (c) a `public.loop_runs` heartbeat table (`loop_name, started_at, finished_at, outcome, blocked_on, artifacts`) plus real DAL writers for the existing-but-unwired `site_improvement_ledger` and `process_escape_ledger`, read by a staleness check bolted onto the already-registered `/api/cron/loop-health-check`.

**Domains that depend on it.** All 19. Concretely: THE LOOP, expired workflow, FSBO, broker recruiting, CRM dashboard, AEO, content scale, market reports, visitor identity.

**Current state.** I diffed disk against `vercel.json` programmatically: **72 cron route directories, 49 registrations, 23 unregistered.** Nine of those are `marketing-snapshot-*` legitimately fanned out by the registered `snapshot-channels`. The genuine orphans include `detect-expired-listings`, `marketing-inbox-poll`, `daily-broker-digest`, `optimization-loop`, `weekly-cycle`, `neighborhood-default-subscriptions` (zero external references anywhere), `strategy-revision-check`, `sync-parity`, `sync-verify-full-history`. `scripts/gates-wired-baseline.json` exists and covers orphaned `check-*.mjs` files only. `ls scripts | grep cron` returns `check-cron-auth.mjs` and `check-newsletter-crons.mjs`, both narrow. Dead-export detection does not exist at all: `app/actions/home.ts` (every export unreferenced), `components/SmartSearch.tsx`, `components/HeroSearchOverlay.tsx`, `app/actions/fsbo-dashboard.ts` (a live SMS sender with weaker compliance guards than the real one), `lib/data/crm/getContactActivityFeed.ts`, `lib/data/crm/getAdAudienceConversionReport.ts`, `lib/data/nav/getMegaMenuData.ts`, `app/actions/lead-scoring.ts`, `lib/lead-scoring.ts`, five `components/reports/*` files. `out/audits/` has never existed on disk while `out/` holds 40+ sibling directories.

**What building it unblocks.** Every subsequent primitive becomes verifiable. It converts "we built it" into "it is running," which is the single distinction every audit kept tripping on.

**What stays broken without it.** You will build P1 through P8 and three of them will end up unregistered, unimported, or behind a flag nobody can see, and the next audit will report them as missing. This has already happened four times (`optimization-loop`, `marketing-inbox-poll`, `detect-expired-listings`, `daily-broker-digest`).

**Depends on.** Nothing. This is the root.

---

## P1 — Person Identity Spine

**What it is.** One canonical subject id (`crm_people.id`) and one resolver module that every read of a person's behavior, sends, sessions, documents, and engagement goes through. Concretely: `lib/data/crm/resolvePersonIdentity.ts` becomes the sole entry point, returns `{crmPersonId, fubLegacyId, emails, phones, authUserId, sessionIds}`, resolves sessions on `crm_person_id` with `fub_person_id` as fallback, plus a backfill migration reconciling `visitor_sessions.crm_person_id` for pre-cutover rows, plus deletion of the three hardcoded broker-identity maps in favor of a `brokers`-table lookup.

**Domains.** Visitor identity, Facebook ads, CRM broker dashboard, saved searches and buyer nurture, expired workflow, FSBO workflow, CMA/BPO, newsletter/send layer, social sharing (share attribution), broker recruiting.

**Current state — verified, and one audit correction.** `lib/visitor-backfill.ts` writes the native `crm_people.id` into **both** `fub_person_id` and `crm_person_id`, with a comment saying "kept in both columns so the visitors dashboard (crm_person_id) and legacy readers agree." So the write side was already patched by someone who noticed. The read side was not. Divergent readers:

- `lib/data/crm/resolvePersonIdentity.ts:180` — `.eq('fub_person_id', fubLegacyId)`, and the whole block is gated on `if (fubLegacyId !== null)`.
- `lib/data/crm/getViewedListings.ts:31` — signature is `getViewedListingsForLead(fubPersonId)`, line 32 `if (!fubPersonId) return []`, called from the contact page with `person.fub_legacy_id`.
- `lib/crm/attributed-links.ts:72-84` — `personId` must be a positive integer or the function returns before `instrumentEmailHtml`, so no open pixel and no click wrapping.
- Broker identity: `lib/admin.ts:2` (`SUPERUSER_ADMIN_EMAIL` literal), `lib/crm/constants.ts:15` (`CRM_BROKER_BY_EMAIL`, three hardcoded logins), `lib/data/brokers/getBrokers.ts:119` (`BROKER_SLUG_ALIASES`, duplicated in `app/actions/brokers.ts`), plus consumers at `lib/cma/send.ts:327`, `lib/bpo/send.ts:361`, `app/actions/contact-cma.ts:304`, `lib/data/crm/getBrokerTelephony.ts:44`, `app/actions/broker-command-center.ts:126`.

**What it unblocks.** The CRM behavior panel filling for post-cutover contacts. Email open/click tracking for guest and unresolved recipients. Ad-click resolution. Per-broker scoping that can fail closed. Onboarding a fourth broker without a code deploy.

**What stays broken without it.** Every contact created after 2026-06-24 renders an empty viewed-listings panel, which a broker reads as "this lead did nothing." Guest newsletter and alert cohorts report structurally-zero opens forever while the admin shows them an opens column. Any scoring model built on top inherits a silently empty input.

**Depends on.** P0 (so the backfill cron and the resolver's adoption are enforced).

---

## P2 — Outbound Message Bus

**What it is.** One `sendTracked({channel, to, personId, emailKey, html|body, transport})` that folds suppression check, `prepareDeliverableEmail` (CAN-SPAM footer, List-Unsubscribe), `attributeOutbound`, transport dispatch (Resend or Gmail DWD), and `recordEmailEvent('sent')` into a single call, with `lib/resend.ts` `sendEmail` made private to it. Plus a transport-agnostic delivery/bounce signal so the Gmail rail is observable. Plus `profiles.notification_preferences` promoted into the suppression predicate. Enforced by extending `scripts/check-email-send-gated.mjs` to assert measurement, not just suppression.

**Domains.** Newsletter, CMA/BPO, saved searches, expired workflow, FSBO, CRM dashboard, market reports, visitor identity (deliverable tracking), social sharing, content scale.

**Current state — 31 direct importers, 5 measured.** `grep -rln "from '@/lib/resend'"` returns 31 non-test files including `lib/newsletter/send-queue.ts`, `lib/cma/send.ts`, `lib/bpo/send.ts`, `lib/cma-deliver.ts`, `lib/cma-delivery.ts`, `lib/crm/market-report-send.ts`, `app/actions/saved-search-alerts.ts`, `app/actions/contact-cma.ts`, `app/api/cma-drafts/[id]/send/route.ts`, `lib/tc/signing-emails.ts`, `lib/cma/request-emails.ts`, plus six alert modules. Of those, exactly five call `recordEmailEvent`. `attributeOutbound` has ~14 call sites. `lib/newsletter/send-queue.ts:475` calls `attributeOutbound` and never calls `recordEmailEvent`, so newsletters are absent from `email_events` entirely and invisible to `getContactEmailEngagement`. `lib/cma/send.ts:352` and `lib/bpo/send.ts:383` send over Gmail with Resend as failure fallback, so the Resend webhook cannot emit delivered, bounced, or complained for them, which also means the webhook's bounce-driven `addSuppression` never fires for CMA/BPO recipients. Three CMA delivery implementations coexist: `lib/cma/send.ts` (live), `lib/cma-deliver.ts` (reachable only by manual POST), `lib/cma-delivery.ts` (legacy, no suppression check at all). `notification_preferences` is read by exactly one send path, `app/actions/saved-search-alerts.ts:203-210`.

**What it unblocks.** "Everything this contact received and everything they clicked" becomes answerable. The preference center stops lying. Bounce suppression covers the document rail. Bulk send, expired email outreach, and the buyer-LP alert enrollment all become one-line additions instead of new implementations.

**What stays broken without it.** Newsletter and CMA/BPO engagement never appear on the contact record, the `/account/notifications` toggles remain non-functional for four of five channels, and every new send surface adds a tenth implementation.

**Depends on.** P1 (tracking is gated on a resolvable `personId`; without it the bus instruments nothing for exactly the cohorts that matter).

---

## P3 — Typed Client Telemetry Contract

**What it is.** One shared emitter module exporting a typed `VisitorEvent` union whose field names are the same type the route parses, imported by every client tracker, so a payload mismatch is a compile error. Plus producers for the event types the scoring model already pays for.

**Domains.** Visitor identity, Facebook ads, saved searches (intent), CRM dashboard (behavior panel), listing pages, geo pages, faceted search, AEO (crawler measurement), social sharing (share tracking).

**Current state — verified, three stacked bugs in one file.** `app/api/visitors/track/route.ts:169-171` defines `ALLOWED_EVENT_TYPES` as eight strings. I grepped producers for each: `search` 0, `cta_click` 0, `identify` 0, `scroll_depth` 0, `section_view` 1, `listing_view` 1, `page_view` 2. Four allowed types carry scoring weight in `supabase/migrations/20260522180000_visitor_tracking.sql` and can never fire. `components/site/kb/KbSectionTracker.client.tsx:15` builds `JSON.stringify({ sessionId, eventType, pageUrl: location.href, ...extra })` with **no `consent` field**, and route lines 239-244 coerce missing consent to `'declined'` and return `{ok:true, dropped:true}` without writing. Its own docblock records a *prior* audit that fixed the `pageUrl` bug on these same lines and shipped without noticing. Route line 383 reads `body.scrollDepthPct`; the component sends `scrollDepth`. Four independent emitters exist: `components/VisitTracker.tsx`, `components/site/kb/KbSectionTracker.client.tsx`, `components/listing/ListingTracker.tsx` and `components/LandingPageTracker.tsx` (both GA4-only), `components/GlobalIntentTracker.tsx` (GA4-only).

**What it unblocks.** Scroll and drop-off reporting. Buyer intent scoring that counts search behavior. CTA-intent signals reaching the CRM store. The `topSearches` panel. Every downstream lead-score model.

**What stays broken without it.** Zero scroll rows exist across ~60 page families. Buyer intent is systematically undercounted because `/homes-for-sale` scores 1 point with no category while one listing view scores 10. The hot-lead escalation cron fires on a score that structurally cannot see searching.

**Depends on.** P1 (events must attach to a resolvable subject to be worth collecting), P0 (the producer-coverage assertion is a gate).

---

## P4 — Geo Taxonomy Registry

**What it is.** One `lib/geo/registry.ts` resolving every place to `{slug, kind, parentSlug, aliases, cityId, coverageTier}` over `boundaries` + `data/resort-communities.json` + `neighborhood_subdivisions`, plus a `resolveGeoUrl(kind, slug)` that emits only routes proven to resolve, consumed by sitemap, middleware, market-stats refresh, blog association, CRM smart lists, and the facet registry.

**Domains.** Geo pages, faceted search at scale, AEO, market reports, content scale, search and map, listing pages, expired workflow, FSBO, CRM geo smart lists.

**Current state — I found 10+ hardcoded lists.** `lib/cities.ts:31 PRIMARY_CITIES`, `lib/central-oregon.ts CENTRAL_OREGON_CITY_SLUGS` (25 slugs), and then three *separate re-declarations* of `CENTRAL_OREGON_CITY_SLUGS` inline at `app/communities/[slug]/page.tsx:121`, `app/cities/[slug]/page.tsx:158`, `app/cities/[slug]/[neighborhoodSlug]/page.tsx:90`. Plus `app/sitemap.ts:23 RESORT_COMMUNITY_SLUGS` (14), `app/actions/market-report-types.ts:8 MARKET_REPORT_DEFAULT_CITIES` (11), `lib/data/nav/getMegaMenuData.ts:186 HOMES_CITY_SLUGS` (5), `lib/expired-listing-processor.ts:52 SERVICE_AREA_CITIES` (6), `lib/fsbo-detector.ts:51 FSBO_SERVICE_AREA_CITIES`, `lib/popular-searches.ts` (10 cities x 10 presets). The live cost: `app/sitemap.ts:335` emits `/cities/{city}/{sub}` for every active (city, subdivision) pair, which resolves through `neighborhoods` (Bend districts only), while the route that actually renders those pairs, `/communities/{city}-{sub}`, is never emitted; and middleware's `isInvalidGeoSlug` regex matches only single-segment `/cities/` paths, so those URLs land as hollow 200s.

**What it unblocks.** Correct sitemap emission (one-line fix once the resolver exists). Market-stats coverage following the registry instead of 11 hardcoded cities. Blog-to-geo association with a real foreign key. Geo-scoped parks/trails/events. Out-of-area referral capture as a coverage tier rather than a hardcoded 404.

**What stays broken without it.** Thousands of sitemap URLs point at a route that soft-404s while the working route sits unemitted. Every new geo surface adds an eleventh list.

**Depends on.** P0.

---

## P5 — Canonical Market-Stats Engine

**What it is.** `lib/data/market/*` as the single read path for every stat on every surface, retirement of both duplicate engines, and a historical backfill of `market_stats_cache` monthly rows across the registry (not 11 hardcoded cities) feeding a dated per-city report generator.

**Domains.** Market reports, geo pages, AEO (Dataset schema and FAQ), content scale, newsletters, CMA/BPO market context, listing pages, faceted search FAQ copy.

**Current state — three engines, verified by consumer grep.** Engine A (`getMarketPulse` / `getCityMarketDetail`) has ~20 web consumers including homepage, city, community, neighborhood, housing-market. Engine B (`get_beacon_*` RPC via `app/actions/reports.ts`) feeds `/reports`, `/reports/explore`, `/api/reports/export`, and the admin custom report builder. Engine C (`app/actions/market-reports.ts` aggregating `listing_tile_mv`) has ~20 consumers **including the highest-liability ones**: `app/api/cron/market-report/route.ts` (the registered Sunday cron producing published `/reports/[slug]`), `lib/crm/market-report-send.ts` (the market report emailed to CRM contacts), and `lib/newsletter/produce-draft.ts`. So the published weekly report, the emailed report, and the website city page compute the same numbers three different ways. `get_beacon_metrics` was correctly fixed to `ClosePrice` + SFR whitelist on 2026-06-26; `get_beacon_price_bands` was not and still buckets closed sales by `"ListPrice"` at `supabase/migrations/20260401120000_report_include_commercial.sql:243-266`.

**What it unblocks.** A single §0 verification trace per figure instead of three. Ten years of history. Neighborhood and subdivision report depth. AEO Dataset coverage on the one geo tier that lacks it.

**What stays broken without it.** A live §0 violation ships on every price-band chart and export. Three engines drift independently and any accuracy fix must be applied three times or silently isn't.

**Depends on.** P4 (coverage must follow the registry, otherwise the backfill re-hardcodes 11 cities), P0.

---

## P6 — One Search and Filter Vocabulary

**What it is.** `lib/search/field-registry.ts` consumed programmatically at *every* boundary: list query, map query, saved-search creation (consumer and broker), the alert matcher, and URL serialization. Plus geometry storage so a drawn polygon means the same thing in the browser and in the alert cron. Plus a `capped` flag on every listing read.

**Domains.** Search and map, faceted pages at scale, saved searches and buyer nurture, listing pages, CRM broker tooling, geo pages.

**Current state.** The registry defines ~90 fields and `app/search/page.tsx:7` accepts all of them. `app/actions/search.ts:394-420` then hand-lists ~18 for the map path, so map pins do not match the filtered list. Broker create surfaces (`ContactSendCenter`, the bulk registry) capture 5-6 fields, daily/weekly only. The broker *edit* dialog (`components/admin/crm/criteria/AlertCriteriaEditor.tsx`) captures ~12 including amenities and instant cadence, so the richest vocabulary is unreachable from any point of creation. `lib/search-filters.ts:405` lists `poly` in `NON_NARROWING_KEYS` because the alert path cannot evaluate point-in-polygon. Two divergent map stacks (`components/search/MapSearchView.tsx`, `components/UnifiedMapListingsView.tsx`) with different polygon persistence, different search-as-I-move, and different capped handling.

**What it unblocks.** Pre-built facet pages (`generateStaticParams` seeded from `lib/popular-searches.ts`), polygon-exact alerts, broker-created searches at parity with consumer ones, honest result counts.

**Depends on.** P4 (facet slugs are geo x preset), P1 (saved searches attach to a person).

---

## P7 — Fail-Closed Authorization Layer

**What it is.** One `requireScope()` returning a *non-nullable* scope descriptor, where an unresolved broker on a non-superuser account yields an empty result set and a logged alarm, never an unfiltered query. Plus capability arrays that grant broker-role access to broker-facing pages, plus an in-page guard on every route behind a nav capability.

**Domains.** Broker recruiting, CRM dashboard, marketing self-service, media/asset library, expired and FSBO prospecting.

**Current state — this is a live data-exposure bug, not a polish item.** Verified: `app/actions/broker-command-center.ts:244`, `:254`, `:269` are all `if (scopeToSelf && crmSlug) query.eq('assigned_broker', crmSlug)`. `crmSlug` comes from line 126, `CRM_BROKER_BY_EMAIL[email.toLowerCase()] ?? null`. A broker-role account whose login email is absent from that three-entry map gets `crmSlug = null`, the `.eq()` is never applied, and the query returns **every broker's clients and tasks**. `app/actions/crm.ts:707` and `:1795` repeat the pattern. The seeded `admin_roles` emails in `supabase/migrations/20250312000000_broker_license_and_seed.sql` (`rebecca.peterson@`, `paul.stevenson@`) do not match the `CRM_BROKER_BY_EMAIL` keys, which is precisely the input that triggers it. Separately `lib/admin/capabilities.ts` sets `'content.marketing': []` and `'content.media': []`, locking `/admin/broker-links` (a page written specifically for Paul and Rebecca) to superuser only.

**What it unblocks.** Onboarding a broker without a deploy. Per-broker marketing self-service (mostly built and switched off). Scoped performance visibility.

**Depends on.** P1 (broker identity must come from `brokers`, not the hardcoded map).

---

## P8 — Generated Rule Sources

**What it is.** Canonical rule data with *generated* per-language exports plus a parity test, applied to three currently-duplicated rule sets: brand-voice vocabulary, model routing, and search presets.

**Domains.** Brand voice, content scale, THE LOOP (cost), all producers.

**Current state.** Brand voice: `scripts/brand-voice-vocabulary.cjs` is canonical with two consumers, and at least six more independent hand-maintained lists exist and have drifted — `scripts/_producer_lib.py:350-397`, `lib/email/voice-precheck.ts:23-32`, `lib/marketing-brain/generate-briefs.ts:296-330`, `app/api/cron/gbp-health-check/route.ts:36-43`, `scripts/preflight.ts:119`, `scripts/build-blog-post.mjs:104`. The canonical list emptied `VAGUE_QUALIFIERS` to `[]` on 2026-06-02; `generate-briefs.ts:311` still hard-fails any brief containing the word "about," so the brain is rejecting valid content in production today. Migration blocker: `scripts/validate-producer.mjs:52-56` requires the literal string `voice_guidelines.md` in all 24 producer SKILL files, enforced by `ci:producer-skills` inside `ci:gates`, so renaming that doc fails CI repo-wide. Model routing: hardcoded ids at `app/api/cron/producer-runtime/route.ts:44`, `lib/cma/audit.ts:24`, `lib/marketing-brain/audit-classifier.ts:45`, `lib/marketing-brain/inbox-parser.ts:26`, `app/actions/crm-inbox.ts:448`. The routing discipline already exists by hand; it has no single home.

**Depends on.** P0 (the parity gate).

---

# DEPENDENCY-ORDERED BUILD SEQUENCE

**Phase 0 — P0a: the reachability gates only. (Days, not weeks.)**
Ship `check-cron-registered.mjs` and `check-reachable-exports.mjs` into `ci:gates` *before writing any other code*, with a baseline file capturing today's 14 orphan crons and the ~15 dead modules so the gate ratchets rather than blocking. Position justified: these are the only two gates that make every later phase verifiable, they cost a day each, and without them Phase 1-8 output will drift into the same orphan state within a quarter. Concretely this also forces the decision on `optimization-loop`, `neighborhood-default-subscriptions`, and `marketing-inbox-poll` (register or delete) rather than leaving them as ambiguous residue in every future audit.

**Phase 1 — P7: fail-closed scoping.**
Positioned second because it is the only live data-exposure item in the whole report and it is an S-sized change: convert three `if (scopeToSelf && crmSlug)` sites and two `if (access.brokerSlug)` sites to a resolver that returns an empty set on unresolved. Do it *before* P1's identity refactor, not after, because the refactor will touch these same call sites and you want them failing closed while it lands.

**Phase 2 — P1: person identity spine.**
The hinge of the entire program. Everything downstream that touches a human joins on this. Must precede P2 (tracking is gated on a resolvable `personId`), P3 (events need a subject), P6 (saved searches attach to a person), and the completion of P7 (broker identity from `brokers` rather than `CRM_BROKER_BY_EMAIL`). Building P2 or P3 first means instrumenting sends and events against a key that is about to change, then re-doing the backfill.

**Phase 3 — split, two tracks now run in parallel.**

*Track A, Phase 3A — P2: outbound message bus.* Unblocks the largest single cluster of domain work: newsletter engagement, CMA/BPO tracking, expired email outreach, saved-search alerts for guests, bulk one-time sends, the preference center. Extend `check-email-send-gated.mjs` to assert measurement in the same commit that lands the bus, otherwise you get the 5-of-31 adoption pattern again. Also collapse the three CMA delivery implementations here and delete `lib/cma-delivery.ts` (reachable, no suppression check).

*Track B, Phase 3B — P4: geo taxonomy registry.* Independent of P1/P2 (it is about places, not people), so it runs concurrently. Land the sitemap emission fix and the multi-segment middleware guard as its first consumers, since that is a currently-shipping indexing regression with a one-line fix once the resolver exists.

**Phase 4 — P3: telemetry contract.** After P1 (subject) and alongside/after P2 (so deliverable events and behavioral events land in one model). This is where the four dead event types get producers and the KB tracker's three stacked bugs get fixed by making them type errors. Do not build any lead-scoring model before this phase; the two dead scoring engines (`app/actions/lead-scoring.ts`, `lib/lead-scoring.ts`) already exist and both would score on inputs that structurally cannot fire.

**Phase 5 — P5: market-stats engine.** After P4, because the backfill must follow the registry rather than re-hardcoding 11 cities. Two sub-steps in strict order: (a) hotfix `get_beacon_price_bands` to `ClosePrice` + `property_sub_type` whitelist this week regardless of everything else, since it is a live §0 violation on public exports; (b) consolidate onto Engine A and retire Engines B and C, *then* backfill history. Backfilling before consolidating means backfilling into a store that two other engines will keep contradicting.

**Phase 6 — P6: search and filter vocabulary.** After P4 (facets are geo x preset) and P1 (saved searches). Collapse the two map stacks first, then registry-drive the map query, then add geometry storage for polygon alerts, then seed `generateStaticParams` from `lib/popular-searches.ts` and remove `app/search/[...slug]/page.tsx` from `scripts/static-params-baseline.json`.

**Phase 7 — P0b: loop heartbeat and measurement ledger.** Deliberately last of the primitives, not first, despite being part of P0. Reason: `site_improvement_ledger` stores *measured deltas of shipped changes*, and until P2 and P3 exist there is nothing trustworthy to measure. Building the ledger first produces the exact artifact that already exists, a table with one write from a one-time scheduled task that then disabled itself. Land `loop_runs` + the ledger writers + the staleness check on `loop-health-check` once the measurement inputs are real, then wire the four domain loops to schedulers.

**Phase 8 — P8: generated rule sources.** Anytime after Phase 0, but scheduled here because it gates content-scale work and nothing else depends on it. Order within: fix `generate-briefs.ts:311` immediately (it is rejecting valid content today), then generate the Python and TS exports from `brand-voice-vocabulary.cjs` with a parity test, then update `validate-producer.mjs:52-56` in the same commit as any doc rename.

**Phase 9 onward — domain work.** Expired/FSBO gaps, per-broker marketing surfaces, content at scale, AEO depth, historical reports, listing-page richness. Every one of these becomes materially smaller once P1-P6 exist. Several become one-line changes.

---

### Do not build these in the wrong order

- **Do not build a lead-scoring model before P3.** Two complete engines already exist unwired, and the CRM already renders a "Lead Score" column hardcoded to an em-dash. The work is connect-and-backfill, and connecting before the event producers exist scores everyone on nothing.
- **Do not build bulk content tooling before fixing `app/actions/blog.ts:204`.** It never selects `status`, so the admin cannot see published vs draft vs the 28 quarantined posts, and `saveBlogPost`'s union is `'draft' | 'published'` only. A bulk tool on that surface acts blind.
- **Do not build the historical report archive before P5 consolidation.** You would be backfilling a store that Engine C keeps contradicting every Sunday.
- **Do not build a marketing self-service dashboard before P7.** Two surfaces already exist (`/admin/broker-links`, the Marketing launchpad) and are locked by empty capability arrays. Unlocking is one edit; rebuilding is an L.
- **Do not resolve the CMA/BPO Gmail-vs-Resend transport question inside P2 by moving to Resend.** Gmail-from-the-broker's-mailbox is almost certainly correct for a personal client document. Build the transport-agnostic bounce signal instead.

### Safe to do out of order (touch no primitive)

Register `daily-broker-digest` in `vercel.json`. Pass `inboxUnread` at `app/admin/(protected)/layout.tsx:75` (the badge UI is complete end to end and dark for want of one prop). Render the like control in `components/ui/CardActionBar.tsx` (four callers already pass a working handler). Replace `PriceCtaStrip`'s hand-rolled share button with `components/ShareButton.tsx`. Add a `city` branch to `app/api/og/route.tsx` mirroring the existing `community` branch. De-duplicate the double `MetadataBlock` on listing pages (`app/listing/[listingKey]/page.tsx:560` vs `ListingDetailShell.tsx:128`). Add `media_suppressed` to `listing_tile_mv`, `listing_search_mv`, `similar_listings_mv`, and `getHeroPhotosByListingKeys` (four call sites, broker-liability, no primitive dependency). Delete `app/actions/fsbo-dashboard.ts`, `components/admin/fsbo/FsboActions.client.tsx`, `lib/data/fsbo/dashboard.ts`.