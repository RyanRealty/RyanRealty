# Mechanical guardrails for Ryan Realty website

This catalog lists every guardrail that has been moved out of prose
(CLAUDE.md, EXECUTION_PLAN.md, handoff docs) and into mechanical
enforcement (lint rules, CI scripts, build hooks). Prose rules require
agent discipline and break under context pressure. These don't.

**Rule:** if a guardrail can be mechanized, mechanize it. If a guardrail
keeps being violated, the answer is a new gate, not more prose.

## Active gates

| # | Gate | Mechanism | Source |
|---|---|---|---|
| G1 | DAL boundary — no raw `from('<table>')` outside `lib/data/` | ESLint `no-restricted-syntax` (error) + `scripts/check-dal-boundary.mjs` (ratcheted) | Plan §4 + CLAUDE.md §6 |
| G2 | Brand voice §6.1 + §6.2 in JSX text + string attrs | ESLint plugin `rr-brand-voice/no-violations` (error) | CLAUDE.md §3 |
| G3 | Brand voice across content files | `scripts/check-brand-voice.mjs` (ratcheted) | CLAUDE.md §3 |
| G4 | Design tokens — no raw hex, no retired fonts, no bg-image hero | `scripts/lint-design-tokens.js --base-diff` | CLAUDE.md §5 / Plan §10 |
| G5 | SEO route metadata + JSON-LD authoring | `scripts/check-seo-routes.mjs` + `scripts/check-seo-authoring.mjs` | Plan §1 |
| G6 | **Mockup parity** — every gated route imports every component the matching mockup contract requires | `scripts/check-mockup-parity.mjs` (ratcheted) + per-route `design_system/ryan-realty/ui_kits/<route>/parity.json` | Plan §1 + Wave 3 §9 |
| G7 | **Mockup coverage** — every mockup directory must have a `parity.json` contract | `scripts/check-mockup-coverage.mjs` (allowlisted) | Plan §1 + Wave 3 §9 |
| G8 | **Page DAL completeness** — every `app/<route>/page.tsx` reads through `@/lib/data` (positive direction) | `scripts/check-page-dal.mjs` (ratcheted) | Plan §1 |
| G9 | **`generateStaticParams` on every dynamic route** | `scripts/check-static-params.mjs` (ratcheted) | Plan Wave 3 §9 |
| G10 | **Bundle budget** — total + per-chunk JS size ceiling + growth-vs-baseline detection | `scripts/check-bundle-budget.mjs` (baselined) post-`next build` | Plan §1 |
| G11 | **Route smoke** — every canonical route returns 200, non-blank, non-404 against a live server | `scripts/check-route-smoke.mjs` + start-server-and-test | feedback memory "verify before moving on" |
| G12 | **Draft-first commit gate** — user-facing diffs require an `Approved-by: matt` or `Draft-shown: <url>` line | `.husky/commit-msg` → `scripts/check-draft-first.mjs` | CLAUDE.md §0.5 |
| G13 | First-frame thumbnail quality (video pipeline) | `scripts/check_first_frame.py` | CLAUDE.md §4 |
| G14 | TypeScript strict | `tsc --noEmit` via `next build` | Plan §1 |
| G15 | Lighthouse perf ≥ 0.90 / a11y ≥ 0.95 / BP ≥ 0.90 / SEO ≥ 0.95 / LCP ≤ 2500ms / CLS ≤ 0.10 | `npm run ci:lighthouse` (blocks PRs) | Plan §1 |
| **G16** | **Data access discipline** — `docs/DATABASE_SCHEMA_SNAPSHOT.md` matches live Supabase + `docs/DAL_INDEX.md` matches `lib/data/`. Drift fails CI. | `scripts/check-data-access.mjs` (regenerates both via `_agent_schema_dump()` RPC + AST walk; diffs vs HEAD) | CLAUDE.md "Data Access Discipline" + feedback `no-adhoc-sql.md` |
| **G17** | **SQL column quoting** — `lib/data/*.ts` cannot call `.eq('"ColumnName"', …)` etc. with LITERAL double-quote characters inside the JS string (that's the 2026-05-28 "Listing Not Found" regression class). | `scripts/check-dal-column-quoting.mjs` | Inventory GAP-1 |
| **G18** | **`force-dynamic` + `revalidate` coexistence** — ESLint refuses both exports in the same route file (silently disables ISR cache). | `eslint-rules/no-dynamic-revalidate.js` plugin (`rr-no-dynamic-revalidate/no-dynamic-revalidate`) | Plan §0.4 + Inventory GAP-5 |
| **G19** | **Sentry `tracesSampleRate` budget** — ESLint refuses literal values > 0.2 in `sentry.*.config.{ts,js}` (silent quota drain). | `eslint.config.mjs` `no-restricted-syntax` scoped to sentry config files | Plan §0.4 + Inventory GAP-6 |
| **G20** | **Brand-voice vocabulary single source** — ESLint plugin + CI script + runtime hook all consume `scripts/brand-voice-vocabulary.cjs`. Test asserts parity. | `scripts/__tests__/brand-voice-vocabulary.test.cjs` | Inventory GAP-7 |
| **G21** | **DAL internal cache discipline** — `getMarketStats / getMarketPulse / getPriceHistory / getGeoSnapshot` etc. must `.from('<cache>')`, never `.from('listings')`. | `scripts/check-dal-internal-discipline.mjs` (with delegation support) | Inventory GAP-8 |
| **G22** | **Producer pipeline guard** — every staged `scripts/build_*.py` must call `require_action_row(payload)` from `_producer_lib` or carry `# @producer-guard-exempt: <reason>`. | `scripts/check-producer-guard.mjs` + `.husky/pre-commit` | Inventory GAP-10 + feedback `brain-pipeline-protocol` |
| **G23** | **pa11y-ci in CI** — catches WCAG 2.1 failures the Lighthouse aggregate score misses. | `npm run ci:a11y` wired into `.github/workflows/CI.yml` (PRs only) | Inventory GAP-3 |
| **G24** | **Retired-font detection** — `font-family:`, Tailwind utilities like `font-playfair`, `next/font/google` imports of Playfair/Inter/Helvetica/AzoSans/system-ui all refused. | `scripts/lint-design-tokens.js` (added `RETIRED_FONTS` set) | Plan §0.3 + Inventory GAP-4 |
| **G25** | **Design directive registry** — every rule in `docs/DESIGN_DIRECTIVES.md` must be `enforced`, `deferred`, or `wont-fix`. Any `open` directive fails CI. | `scripts/check-design-directives.mjs` | DESIGN_DIRECTIVES.md "Maintenance protocol" |
| **G26** | **Arbitrary Tailwind brackets** — `max-w-[*]`, `py-[*]`, `gap-[*]`, `p-[*]`, `rounded-[*]`, `shadow-[*]` etc. banned outside a small allowlist (`rounded-[10px]`, `rounded-[14px]`, `ring-[3px]`, `tracking-[-0.01em]`, `tracking-[-0.02em]`, `tracking-[0.08em]`, `tracking-[0.12em]`). | `scripts/lint-design-tokens.js` G26 patterns | DESIGN_DIRECTIVES.md D17/D18/D19/D20/D21/D22/D14 |
| **G27** | **Decorative gradients** — `linear-gradient(...)` banned except the navy protection scrim and the canonical photo bottom-to-transparent. | `scripts/lint-design-tokens.js` G27 patterns | DESIGN_DIRECTIVES.md D72 |
| **G28** | **Black box-shadows** — `box-shadow: ... rgba(0, 0, 0, ...)` banned. Must use `--shadow-sm/md/lg` navy-tinted vars. | `scripts/lint-design-tokens.js` G28 pattern | DESIGN_DIRECTIVES.md D23/D24 |
| **G29** | **Inline `<style>` JSX banned** — `<style>{...}</style>` and `createGlobalStyle(...)` blocked in `app/**` + `components/site/**`. Style belongs in Tailwind + globals.css + CSS modules. | ESLint `no-restricted-syntax` `JSXElement[openingElement.name.name='style']` | DESIGN_DIRECTIVES.md D32/D33 |
| **G30** | **Geo imagery canonical source** — area-tile/geo imagery on `app/cities/**`, `app/communities/**`, `components/site/**` must come from `getGeoTileImages()` (asset_library) or `GOLF_COMMUNITY_IMAGES` (`lib/geo-images.ts`). Fails on a hardcoded `/lp/...image` path or a fake `neighborhoods`/`communities` `hero_image_url` read on any geo surface. | `scripts/check-geo-imagery.mjs` (`npm run ci:geo-imagery`) | DESIGN_DIRECTIVES.md D82/D86 |
| **G31** | **Boundary-map shared DAL** — every geo page (`app/cities/[slug]/page.tsx`, `app/cities/[slug]/[neighborhoodSlug]/page.tsx`, `app/communities/[slug]/page.tsx`) that renders `<NeighborhoodMap>` or `<SiteNeighborhoodMap>` MUST import `getGeoBoundaryMapData` from `@/lib/data`. Ad-hoc polygon + pin fetches that bypass the shared DAL are banned (they produce inconsistent map data — the old per-page City/SubdivisionName string-match divergence). | `scripts/check-boundary-map.mjs` (`npm run ci:boundary-map`) | DESIGN_DIRECTIVES.md D88 |
| **G32** | **Community page completeness** — `app/communities/[slug]/page.tsx` MUST import all four: (a) `communityImage` from `@/lib/geo-images` (photo resolver covering all 14 communities), (b) `OpenHousesGrid` (open houses section), (c) `ListingCard` (homes-for-sale card grid), (d) `getGeoBoundaryMapData` from `@/lib/data` (polygon-fit boundary map). Removing any import breaks the page contract and fails CI. | `scripts/check-community-page.mjs` (`npm run ci:community-page`) | DESIGN_DIRECTIVES.md D89/D90/D91/D92 |
| **G33** | **Community content completeness** — every resort/planned community in `data/resort-communities.json` AND all 13 Bend neighborhoods MUST have a `data/resort-community-<slug>.json` config carrying `about_prose` plus at least one of `amenities` / `drive_times`. A new geo cannot ship thin: the coverage backlog (`data/community-content-baseline.json`) must shrink to zero and never grow. Content is RESEARCHED from primary sources (community / HOA / golf / county / news) and VERIFIED, never invented — a geo leaves the backlog only when a cited config lands. | `scripts/check-community-content.mjs` (`npm run ci:community-content`) | DESIGN_DIRECTIVES.md D95/D96 |
| **G34** | **AI structured-data presence (GEO)** — every key surface MUST emit machine-readable JSON-LD so AI assistants (Claude, ChatGPT, Perplexity, Google AI Overviews) surface + cite Ryan Realty. `app/layout.tsx` → `<JsonLd>` (site-wide Organization + WebSite). `app/cities/[slug]/page.tsx` + `app/communities/[slug]/page.tsx` → `MetadataBlock` + `buildMarketFaq` (entity Place + market Dataset + verified FAQPage). `app/cities/[slug]/[neighborhoodSlug]/page.tsx` → `MetadataBlock` + `buildMarketFaq` (Neighborhood Place + market Dataset + verified FAQPage). `components/site/listing-detail/ListingDetailShell.tsx` → `MetadataBlock` (RealEstateListing + BreadcrumbList). A rebuild that drops the schema fails CI instead of shipping an un-citable surface. | `scripts/check-ai-structured-data.mjs` (`npm run ci:ai-structured-data`) | DESIGN_DIRECTIVES.md D97 |
| **G35** | **Producer SKILL.md structure** — every brain-callable producer in `marketing_brain_skills/producers/`, `social_media_skills/`, `video_production_skills/` passes the 10-gate validator: 11 numbered sections, complete frontmatter, `action_types` match REGISTRY.md, 8 mandatory base refs + 4 content refs (content producers), zero em/en-dashes, canonical `target_platforms` enum, valid `**Status:**`. Capability / reference skills (caption / safe-zone / voice rule docs) skipped via `CAPABILITY_AND_BRAIN_PATHS`. | `scripts/check-producer-skills.mjs` → `scripts/validate-producer.mjs` (`npm run ci:producer-skills`, in `ci:gates`) | CLAUDE.md "Marketing Brain Architecture" + producer audit 2026-05-28 |
| **G36** | **AI-tool inline-call discipline (ratcheted)** — no NEW inline ElevenLabs / Replicate-video API calls; VO routes through `scripts/_voice_lib.py` / `lib/voice/`, Replicate video through the shared helper. Grandfathered set in `scripts/.tool-discipline-baseline.json` (27) may only shrink. (The former "Layer 1" skill-auto-load contract for `tool-mastery` + `viral-playbook` was RETIRED 2026-06-22 — both skill files were deleted, so it asserted against non-existent files and always-failed while the gate ran nowhere; the surviving inline-call ratchet was wired into `ci:gates`.) | `scripts/check-tool-discipline.mjs` (`npm run ci:tool-discipline`, in `ci:gates`) | CLAUDE.md "Marketing Brain Architecture" + organic-growth engine 2026-05-29 |
| **G37** | **Email/PDF brand tokens** — the design-token gate (G4/G24) scans only `app/` + `components/`, so the HTML/email/PDF generators in `lib/` and `app/api/` (CMA delivery email, broker digests, FSBO/expired alerts, cron report emails, map InfoWindows) were unchecked and had drifted to retired gold `#D4AF37`, old cream `#F2EBDD`, sand `#e8e2d4`, and retired web fonts (Inter/Arial/Helvetica). This gate flags retired brand HEX + retired-everywhere fonts in those dirs. Canonical tokens come from `lib/email/brand.ts` (`EMAIL_FONT_STACK`/`EMAIL_NAVY`/`EMAIL_CREAM`/`EMAIL_BORDER`). AzoSans (print-legit per DS v2) and `system-ui` (valid OS-font keyword) are deliberately not flagged. Zero tolerance, no baseline. | `scripts/check-email-brand-tokens.mjs` (`npm run ci:email-brand`, in `ci:gates`) | DS v2 palette lock 2026-05-13 + email sweep 2026-06-05 |
| **G38** | **Broker/brokerage facts centralized** — every render surface, page metadata, and JSON-LD block that names a brokerage phone, license, broker, social profile, founding date, or NAP imports from the canonical `lib/brand/contact.ts` (`BRAND`/`CONTACT`/`BROKERS`) instead of a literal. Before it, those facts were copied into ~30 files, so a phone/license change left stale copies. The gate bans the canonical phone literals (`541.213.6706`, `541.703.3095` in any format) and `ryanrealtybend` social-profile URLs from reappearing in `app/` + `components/` `.ts/.tsx` render code (`route.ts`/`actions.ts`/`lib/` excluded; emails not gated). Ratcheted per-file count baseline (`scripts/broker-facts-baseline.json`) — counts may only fall; migrate a file then `npm run ci:broker-facts:baseline`. Escape hatch: `broker-facts-ok` line suffix. | `scripts/check-broker-facts.mjs` (`npm run ci:broker-facts`, in `ci:gates`) | Cluster 5 (site-consistency audit 2026-06-04) + broker-facts sweep 2026-06-05 |
| **G39** | **AI-crawler access + llms.txt preserved** — the site's biggest forward-looking strength is being fully open to AI citation crawlers (`app/robots.ts` allows the full bot roster) and serving a Markdown content map at `/llms.txt`. A careless edit to `robots.ts` (removing a bot, adding a blanket `Disallow`) or deleting the `llms.txt` route would make Ryan Realty invisible to ChatGPT search / Perplexity / Claude / Google AI Overviews with **zero build error**. This gate asserts every required citation bot (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, Applebot, Googlebot, Bingbot) is still allowed, `/` stays crawlable, and `app/llms.txt/route.ts` still exists. | `scripts/check-ai-crawler-access.mjs` (`npm run ci:ai-crawler-access`, in `ci:gates`) | AI-exposure audit 2026-06-06 (G9) |
| **G40** | **Canonical integrity** — (a) no page may declare an `alternates.canonical` / `openGraph.url` whose path matches a `next.config.ts` redirect `source` (a self-defeating canonical that 301s back to itself — the /reports class); (b) every indexable `app/**/page.tsx` (not robots-noindexed, not admin/api/marketing) must declare its own canonical — the root-layout blanket canonical was removed (it silently converted "missing canonical" into "wrong canonical pointing at the homepage", the /videos deindex-risk mechanism). Ratcheted with a count ceiling; baseline currently EMPTY (zero debt). | `scripts/check-canonical-integrity.mjs` (`npm run ci:canonical-integrity`, in `ci:gates`) | Site-consistency audit 2026-06-09 P1.7/P1.8/P2.8 |
| **G41** | **Dead/deprecated UI cannot return** — fails if any curated known-dead file reappears on disk (deprecated `components/Breadcrumb.tsx` alias, superseded `PhotoGallery.tsx`, orphaned geo MarketStats trio, orphaned `ListingSummary`/`ListingDetails`). Dead components with retired patterns are a re-adoption vector — they get deleted AND listed here so they stay deleted. Extend by: grep zero importers → `rm` → add path to `DEAD_FILES`. | `scripts/check-dead-ui.mjs` (`npm run ci:dead-ui`, in `ci:gates`) | Site-consistency audit 2026-06-09 P2.7 / gate 9 |
| **G42** | **Money-page content smokes** — the #1 money pages must render their commerce content, not just a 200 shell: listing-detail (formatted price + ≥1 photo URL + listing-agent name + contact CTA), buy/sell intent LPs (lead-form island + visible FAQ + talk-now block), per-city sales report (≥1 sold stat), and geo detail pages (schools/parks/subdivisions H1 + content band). Runs post-deploy against the live URL in smoke-test.yml alongside the existing content gates. | `scripts/check-listing-detail.mjs` + `scripts/check-lead-funnels.mjs` + `scripts/check-geo-detail.mjs` (`ci:listing-detail` / `ci:lead-funnels` / `ci:geo-detail`, in smoke-test.yml) | Site-consistency audit 2026-06-09 P1.9–P1.12 / gate 8 |
| **G43** | **Server-only modules stay out of the client bundle** — no `'use client'` file or `components/**` file may VALUE-import a registered server-only module (`lib/pulse-asset-library`, the asset-library manifest JSON, `pulse-lifestyle-cards.server`); `import type` is allowed. Founding case: the asset manifest grew to ~1.4 MB and shipped inside the /pulse client chunk (+42% total bundle, caught by G10). Data is resolved server-side and passed as props. | `scripts/check-server-only-imports.mjs` (`npm run ci:server-only-imports`, in `ci:gates`) | Bundle regression 2026-06-09 + G10 catch |
| **G44** | **THE LOOP canon sync** — `docs/DEVELOPMENT_PROCESS.md` (the versioned canonical development process) must be pointed at by every agent entry point (CLAUDE.md, the producer TEMPLATE, the cron system-prompt builder) with a matching "THE LOOP vX.Y.Z" version marker, and every `docs/plans/*.md` must be registered in the canon's plan table — plans are inputs to THE LOOP, never parallel processes. Pointer loss, version drift, and rogue plans each fail the build. | `scripts/check-process-canon.mjs` (`npm run ci:process-canon`, in `ci:gates`) | docs/DEVELOPMENT_PROCESS.md v1.0.0 (2026-06-09) |
| **G45** | **Producer-layer freeze** — the marketing brain's execution layer is growth-frozen per Matt's 2026-06-09 directive: the REGISTRY row count ratchets against a baseline; any new producer row fails the build. Content is produced in-session via `marketing_brain_skills/produce/` (same action row, same approval gate, same measurement). Shrinkage is free; growth requires Matt's explicit unfreeze cited in the commit message, then `npm run ci:producer-freeze:baseline`. | `scripts/check-producer-freeze.mjs` + `scripts/producer-freeze-baseline.json` (`npm run ci:producer-freeze`, in `ci:gates`) | CLAUDE.md "Producer-layer freeze" (Matt directive 2026-06-09) |
| **G46** | **Commit self-containment** — type-checks the actual committed (or staged) tree in isolation from the working tree, catching any commit that references symbols that exist only in the uncommitted working tree. Closes the two escape classes that broke production deploys 2026-06-09 night: (1) `EventName` union member added to an untracked enum while committed code consumed it; (2) `lib/data/index.ts` export added to the working tree but not yet staged while committed callers already imported it. File-existence checks cannot catch either — the files were tracked; the symbols were missing. Mechanism: `git archive HEAD \| tar -x` into `$TMP`, symlink `node_modules`, write a thin `tsconfig.check.json` extending the materialized tsconfig with `.next/` excluded, run `tsc --noEmit`, clean up. Exit 1 prints headline + first 30 error lines. `--staged` mode uses `git checkout-index -a` for pre-commit use. | `scripts/check-commit-compiles.mjs` (`npm run ci:commit-compiles`). Wired into `.husky/pre-push` (replaces the old `ci:gates` pre-push body — the gate is tree-state-independent so it belongs here; `ci:gates` still runs in GitHub Actions). | Production deploy failures 2026-06-09 |
| **G47** | **CMA single-path routing** — every CMA routes through `marketing_brain_skills/producers/cma/SKILL.md` and a property gets exactly ONE slug (the action row's `target` slug). Fails the build if two committed `public/cmas/<slug>/` dirs normalize to the same address (including the `-usa`/country-suffix alias case, e.g. `cma-62285-deer` vs `cma-62285-deer-usa`), if a CMA dir is malformed (no `cma.html`), or if `scripts/build_cma_wrapper.py` is a live copy-and-relabel rogue builder (it is now a retired guard). `public/drafts/` (gitignored scratch) is warn-only. Born from a parallel session building a second CMA for the same property under a different slug. | `scripts/check-cma-routing.mjs` (`npm run ci:cma-routing`, in `ci:gates`) | Matt directive 2026-06-13 ("all CMAs must only route through this skill / gates") |
| **G-NL-14** | **Newsletter Phase 1 schema invariants** — the migrations must declare the facts the send system rests on: `newsletter_recipients` status CHECK allows `queued`+`skipped` (else the Phase 3 queue is rejected at every enqueue — the audit A1 bug), `newsletters` status CHECK allows `scheduled`+`canceled`, the `newsletter_recipient_events` ledger exists with a UNIQUE `dedupe_key`+`broker`, `newsletter_send_schedule` exists, and `newsletter_recipients` carries `broker`+`tier`. Static: reads `supabase/migrations/*.sql`, strips SQL comments so it checks DDL (not a doc-comment mentioning the value), last-`add constraint` wins so a later regression flips it red. Authoritative live-schema check is G16 nightly. First of the 20 G-NL newsletter gates (spec §12); the rest land with their phase. | `scripts/check-newsletter-schema.mjs` (`npm run ci:newsletter-schema`, in `ci:gates`) | `docs/NEWSLETTER_SYSTEM_SPEC.md` §12 + Phase 0 adversarial audit 2026-07-03 |
| **G-NL-1/2/3** | **Newsletter CAN-SPAM + RFC 8058 compliance** — `lib/email/prepare.ts` must export `BROKERAGE_POSTAL_ADDRESS` with a real street-number fallback (not empty/placeholder), and `lib/email-templates/newsletter-shell.ts` must reference that constant and render an unsubscribe link (G-NL-1). Both `app/actions/newsletter.ts` and `app/actions/contact-newsletter.ts` must set the `List-Unsubscribe` + `List-Unsubscribe-Post` headers on the outbound send so Gmail/Yahoo render native one-click unsubscribe (G-NL-2). `app/actions/newsletter.ts` must derive a non-empty plain-text body via the `letter.body_text?.trim() \|\| htmlToPlainText(...)` fallback so a send never dispatches empty text (G-NL-3). Static text checks only. | `scripts/check-newsletter-compliance.mjs` (`npm run ci:newsletter-compliance`, in `ci:gates`) | `docs/NEWSLETTER_SYSTEM_SPEC.md` §12 + CLAUDE.md §0 (Data Accuracy / compliance risk to Matt's license) |
| **G-NL-7** | **Newsletter shell static lint** — `lib/email-templates/newsletter-shell.ts` (the ONE place newsletter markup lives) must declare a `color-scheme` meta tag (dark-mode client safety), keep its outer content table `max-width` <= 640px (mobile-safe), set the body cell `font-size:16px` (readability floor), reference `BROKERAGE_POSTAL_ADDRESS` + render "Unsubscribe" in the footer, and use the Design System v2 navy `#102742` masthead. A regression here breaks every newsletter send, not just one. | `scripts/check-newsletter-format.mjs` (`npm run ci:newsletter-format`, in `ci:gates`) | `docs/NEWSLETTER_SYSTEM_SPEC.md` §12 |
| **G-NL-4** | **Newsletter voice-gate wiring** — both newsletter send entry points must run the brand-voice gate before sending: `app/actions/newsletter.ts` (the bulk approve path) and `app/actions/contact-newsletter.ts` (the one-click path) must each call `checkNewsletterVoice(...)`. A send path that skips this check can ship a banned word or punctuation violation straight to a client inbox with no gate to catch it. | `scripts/check-newsletter-voice-paths.mjs` (`npm run ci:newsletter-voice-paths`, in `ci:gates`) | `docs/NEWSLETTER_SYSTEM_SPEC.md` §12 + CLAUDE.md "Brand Voice" |
| **G-NL-6** | **Newsletter drain re-check + no-reactivate-optout** — `lib/newsletter/send-queue.ts` must re-check BOTH suppression (`isSuppressedByEmail(...)`) AND active subscriber status (`status !== 'active'`) per recipient at drain time, not just at enrollment time, so a person who unsubscribed or bounced in the gap between enqueue and drain never gets mailed. `app/actions/contact-newsletter.ts` must refuse to silently reactivate a previously opted-out subscriber (`existing` row checked against `!== 'active'`). | `scripts/check-newsletter-drain-safety.mjs` (`npm run ci:newsletter-drain-safety`, in `ci:gates`) | `docs/NEWSLETTER_SYSTEM_SPEC.md` §12 + CLAUDE.md §0 (Data Accuracy / compliance risk to Matt's license) |
| **G-NL-9** | **Newsletter queue CAS lock + no sync mega-loop + reconciler exists** — `lib/data/newsletter/queue.ts` `claimNewsletterForSending` must be a conditional UPDATE (`status: 'sending'` guarded by `.in('status', ['draft', 'scheduled'])`) so two concurrent send-claims can only have one winner, not a read-then-write race that double-mails every recipient. `app/actions/newsletter.ts` `adminSendNewsletterAction` must NOT call `sendEmail(...)` directly (a synchronous loop over recipients would time out the request) and MUST call `enqueueNewsletter(...)` instead. `app/api/cron/newsletter-reconcile/route.ts` must exist so a stalled/orphaned send has an automated recovery path. | `scripts/check-newsletter-queue.mjs` (`npm run ci:newsletter-queue`, in `ci:gates`) | `docs/NEWSLETTER_SYSTEM_SPEC.md` §12 |
| **G-NL-15** | **Newsletter cron wiring** — `vercel.json` `crons` array must contain entries whose `path` is `/api/cron/newsletter-send` AND `/api/cron/newsletter-reconcile`, and both route files must exist. A dropped cron entry (bad merge, unrelated cron cleanup) silently stops the queue from ever draining or self-healing, with no red build and no error — just newsletters stuck in `draft`/`sending` forever. | `scripts/check-newsletter-crons.mjs` (`npm run ci:newsletter-crons`, in `ci:gates`) | `docs/NEWSLETTER_SYSTEM_SPEC.md` §12 |
| **G-NL-11/G-NL-10** | **Email tracking token safety + timeline dedup** — `lib/email-tracking.ts` `assertTrackingSecret()` must check `NODE_ENV === 'production'` and `throw` when only the insecure dev-fallback secret is set (prod hard-fail, G-NL-11); `signEmailToken` must stamp `body.exp =` + `body.n =` (sourced from `randomBytes(...)`) and `verifyEmailToken` must read `o.exp` so an expired/replayed token is rejected. Both `app/api/track/e/open/route.ts` and `app/api/track/e/click/route.ts` must upsert into `crm_timeline` with `dedupe_key` + `onConflict` + `ignoreDuplicates` so a repeat open/click collapses to one row instead of flooding the comms chain (G-NL-10). | `scripts/check-email-tracking.mjs` (`npm run ci:email-tracking`, in `ci:gates`) | `docs/NEWSLETTER_SYSTEM_SPEC.md` §12 |
| **G-runtime** | **Six runtime tool refusals** — Bash destructive / DB CLI / `--no-verify`; `execute_sql` against `information_schema` / DAL-covered tables; Write/Edit to `app/<route>/page.tsx` without `parity.json`; Write/Edit content with banned-voice tokens. Each can be bypassed with explicit `-- audit:` SQL comment, `# allow-destructive: <reason>` Bash trailer, `// @no-parity` or `// brand-voice:exempt` file marker, or `ALLOW_ALL_HOOKS=1`. | `.claude/settings.json` + `.claude/hooks/pre-tool-use.mjs` (26 tests) | Inventory L2 |

Run them all locally before pushing:
```bash
npm run ci:gates
```

That umbrella runs the gate chain defined in `package.json` → `ci:gates` (~60 gates). **That script is the single source of truth — do not re-enumerate the list in prose here; it drifts.** (The 2026-06-20 audit found this paragraph listed gates like `mockup-coverage`, `data-access`, `producer-skills`, `tool-discipline`, `geo-imagery`, `community-content`, `design-directives` as "in the umbrella" when they were never wired.) The meta-gate `ci:gates-wired` (last in the chain) now enforces two things: every `ci:*` gate is wired, AND no `scripts/check-*.mjs` runs nowhere. As of 2026-06-22, **7 gate files are an orphan backlog** tracked in `scripts/gates-wired-baseline.json` (down from the 28 the audit found; 21 since wired or fixed-then-wired). Triage the rest: wire into `ci:gates`/a workflow, or delete; the count may only shrink. DB-dependent gates (G16 `ci:data-access`) run locally + nightly, not the secret-less static chain. CI runs `ci:gates` in `.github/workflows/ci.yml` plus pa11y-ci + Lighthouse on PRs and route-smoke against `start-server-and-test`.

## The ratchet pattern

G3, G6, G7, G8 all use the same baseline-ratchet pattern: a JSON file in `scripts/` records the legacy state when the gate was first added. The gate fails on NEW violations beyond the baseline, not on the legacy backlog. As migrations land, the baseline shrinks.

To re-baseline a gate (only when intentional — e.g. accepting a deferred contract):

```bash
npm run ci:dal-boundary:baseline       # writes scripts/dal-boundary-baseline.json
npm run ci:brand-voice:baseline        # writes scripts/brand-voice-baseline.json
npm run ci:mockup-parity --write-baseline
npm run ci:page-dal:baseline
npm run ci:static-params:baseline
```

A baseline commit should always include the reason in the commit body (e.g. "Accept gap on /listing/[listingKey] until Wave 3 rebuild lands").

## G6 — mockup parity in depth

The most important gate added 2026-05-28 because the listing-detail rebuild shipped without ever reading the mockup. The plan said "build from the mockup," and the agent ignored that prose rule. The gate now enforces it.

Contract per route lives at `design_system/ryan-realty/ui_kits/<route>/parity.json`:

```json
{
  "route": "app/listing/[listingKey]/page.tsx",
  "mockup": "design_system/ryan-realty/ui_kits/listing-detail/index.html",
  "requiredComponents": [
    { "name": "ListingHero",             "section": "ld-photo-grid full-bleed hero" },
    { "name": "PriceCtaStrip",           "section": "price + CTA strip" },
    { "name": "NeighborhoodMarketContext", "section": "Live market context (Zillow beater)" }
  ]
}
```

The gate parses the parity.json, reads the route's `page.tsx`, asserts each `requiredComponents[].name` is imported. Missing imports fail CI (unless baselined).

**Adding a new gated route:**

1. Place the mockup at `design_system/ryan-realty/ui_kits/<route>/index.html` (already exists for every planned route in this repo).
2. Add `design_system/ryan-realty/ui_kits/<route>/parity.json` with the component contract.
3. Run `node scripts/check-mockup-parity.mjs` locally.
4. Fix imports in the route file until it passes, or baseline the gap with a justification.

**Updating an existing contract:**

If the mockup changes (e.g. a new section added), update the `parity.json` to reflect the new required components. The gate will fail until the route file imports them.

## G7 — page DAL in depth

Positive counterpart to G1. Every `app/<route>/page.tsx` must `import ... from '@/lib/data'` (or any subpath). Opt-out is a leading `// @data-free` comment on a page that genuinely needs no data (e.g. a static About page).

Scope excludes:
- `app/api/**` (API routes — different read pattern)
- `app/admin/**` (admin tools — lower scope per Plan §3)
- `app/account/**`, `app/dashboard/**` (auth-gated, opt out individually)

## G8 — generateStaticParams in depth

Dynamic routes (paths containing `[slug]`) must export `generateStaticParams` so Next can pre-render. Opt-out is a `// @no-static-params` comment for routes that legitimately need full SSR.

Scope excludes the same auth-gated directories as G7.

## What's NOT yet mechanized (intentionally — runtime telemetry only)

| Guardrail | Why this stays prose | Where it lives instead |
|---|---|---|
| TTFB p95 < 200ms (listing) / < 300ms (LP) | Production telemetry, not pre-deploy | Vercel Analytics dashboard + manual review |
| MV refresh successfully for 7 consecutive days | Runtime health, not pre-deploy | `monitoring_alerts` + Supabase advisor digest |
| Pixel-diff every section vs mockup (visual parity) | Subjective human-judgement step | Mockup parity (G6) handles the structural check; visual sign-off stays with Matt |
| Data accuracy (every published number traces to a verified source) | Per-content-piece runtime concern, not a static lint | Producer-side `citations.json` files + per-deliverable verification trace |
| Spark × Supabase market-data reconciliation gate | Video pipeline, not website | `scripts/_voice_lib.py` + producer pre-render gate |

Everything mechanizable for the WEBSITE surface has been mechanized. Adding new gates as new failure modes surface is the pattern (see "How to add a new gate" below).

## How to add a new gate

1. Write `scripts/check-<thing>.mjs` with these CLI conventions:
   - Default exit code: 0 on pass, 1 on fail
   - `--report` flag: human-readable, always exit 0
   - `--json` flag: machine-readable
   - `--write-baseline` flag (if ratcheted): write the current state as the baseline
2. Add a `package.json` entry: `"ci:<thing>": "node scripts/check-<thing>.mjs"`
3. Add the script to the `ci:gates` umbrella in `package.json`
4. Add a `- run: npm run ci:<thing>` line to `.github/workflows/ci.yml`
5. Add a row to the "Active gates" table above

Done. No prose update to CLAUDE.md needed — the gate is the rule.
