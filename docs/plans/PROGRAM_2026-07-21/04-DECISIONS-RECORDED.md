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

## 11. Program-completion build-scope decisions — 2026-07-22

Recorded during the RR-PLATFORM-DECISIONS completion run. Scope calls made while closing ledger rows, so the boundary is durable and not re-litigated next session.

- **W7.2 hidden-homes exclusion — surface scope.** "Hide homes I don't want to see" must subtract a hidden home from **every browse of for-sale inventory** and from alert emails. In scope, all now closed on BOTH the list and the map pins where a surface has each:
  - `components/search/SearchResults.tsx` — the /search grid (already excluded).
  - `components/search/MapSearchView.tsx` — the /search split view: subtracts from the card list AND the map pins, plus the hide control.
  - `app/search/[...slug]/page.tsx` **grid** view — renders through the new client `components/search/HideAwareListingGrid.tsx`.
  - `components/UnifiedMapListingsView.tsx` — the /search/[...slug] **map/split** view: subtracts from the ListingTile list AND the map pins, plus the hide control. (BLOCKER round 1: the map view is a DIFFERENT component than MapSearchView and was leaking.)
  - `components/search/HideAwareSearchMap.tsx` — the **/search?view=map** (map-only) pin layer: subtracts hidden before the pins draw. (BLOCKER round 2: the map-only branch of the flagship /search page rendered a raw SearchMapClustered with the server's unfiltered pins; the split view hid its pins but the map-only view of the same page did not.)
  - `app/price-drops/page.tsx` + `app/price-drops/[city]/page.tsx` **grids** — through HideAwareListingGrid (`gridClassName` preserves the KB grid styling).
  - `app/videos/page.tsx` — the video-tour browse grid, through the new `components/site/HideAwareVideoGrid.tsx`.
  - Alert emails already exclude via `app/actions/saved-search-alerts.ts`.
  All wrappers match dual-key (ListingKey OR ListNumber) so membership holds whichever identifier `hidden_listings` recorded (`HiddenMatchable.ListNumber` widened to accept the numeric ListNumber some map pin rows carry).
- **Out of scope (deliberate):** surfaces that are NOT a browse of for-sale inventory. The user's OWN data — `app/account/hidden` (shows hidden homes on purpose), `app/account/collections/[id]`, `app/account/page`, `app/account/history`, `app/account/saved-homes` (their saved/viewed lists; filtering their explicit picks by a hide flag would be wrong). Curated recommendation/marketing modules — `FeaturedListings`, `SimilarListings`, `MotivatedListings`, `GolfHomesGrid`/`GolfLanding`, the `app/lp/bend` strip, the `OpenHousesGrid` top-4 preview (the full `/open-houses` page is an event/calendar view, not a listing-card grid). Context maps — `CityMap` / `NeighborhoodMap` (both currently mounted by zero pages; they are city/neighborhood overview maps in the same hero/context class as the price-drops `KbListingMap`, not the interactive search-results pin layer, which is always `SearchMapClustered`).
- **Price-drops terrain MAP dots — out of scope (documented boundary).** The `/price-drops` + `/price-drops/[city]` pages render a `KbListingMap` hero above the results grid, plotting every dropped listing as a dot from the unfiltered set. A hidden home can still appear as a dot there. The boundary: **an interactive search-results map (the /search + city map/split views) subtracts hidden pins because the map IS the results; a supplementary hero/context map does not.** Extending per-user dot-hiding to an SSR-seeded hero map (and then, for consistency, to every listing-marker on the site — listing-detail maps, community maps) is out of scope for W7.2; the actual results list on those pages hides, which is the user-facing promise. Revisit if a future directive wants hero-map dots hidden too.
- **Mechanism (AST-based, un-bypassable).** The `ci:hidden-exclusion-surfaces` gate (`scripts/check-hidden-exclusion-surfaces.mjs`, in `ci:gates`) (1) asserts each exclusion-aware WRAPPER references an exclusion primitive as a real identifier (an AST Identifier node — a comment/string mention can't fake it), and (2) DISCOVERS every `app/**/page.tsx` and fails the build if a page VALUE-imports a raw listing renderer — a card (`ListingCard`/`ListingTile`/`VideoListingCard`) OR the map pin layer (`SearchMapClustered`/`LazySearchMapClustered`) — statically OR dynamically (`dynamic(() => import(...))`), under any local alias, unless the page is in a documented curated allowlist. **It parses imports with the real TypeScript compiler** (`ts.createSourceFile` → walk `ImportDeclaration` / dynamic `import()` nodes), not a hand-rolled lexer. That was the fix after FIVE adversarial rounds each defeated a regex/tokenizer version through a new lexer edge case: an aliased import, a JSX-text apostrophe, a hardcoded page list, `from` inside an import comment, no-whitespace `}from'…'`, a regex literal `/\/*$/` read as a block comment, a nested template `` `${`/*`}` `` desyncing the string scanner, and a unicode escape in the specifier (`'…ListingCard'`). The compiler handles comments, template interpolation, regex literals, and escape sequences natively, and `moduleSpecifier.text` is the DECODED specifier — closing that entire class. A sixth round then defeated even the AST version by SPELLING: a plain relative `import ListingCard from '../../components/site/ListingCard'` resolves to the same file but isn't the literal `@/` string the gate compared. Fixed by matching on the RESOLVED file (`ts.resolveModuleName` with the project's tsconfig paths, then `realpath`) instead of the literal specifier — so relative / `@/` / `@/./` / `@/..` / `.tsx` spellings all collapse to one identity. A seventh round then found the break was at a THIRD layer (specifier collection): a CommonJS `require('.../ListingCard').default` renders the raw card but is a plain call expression, not an import — so it collected `require(...)` + `import x = require(...)` alongside static + dynamic imports, and dropped an unsound basename pre-filter (a renamed path alias would resolve to a raw file under a different last segment) in favor of resolving every value specifier behind a module-resolution cache. Proven to bite on every lexer technique, on a dynamic import, on a direct pin-layer import, on a relative-spelling import and its `.`/`..` variants, on a new uncovered route, and on a wrapper losing its exclusion; the genuine type-only import is correctly not flagged. **Documented residual (out of the gate's per-page-direct-import scope):** a page that reaches a raw renderer *indirectly* — through a barrel that re-exports it or a non-wrapper component that renders it — is not caught (it would need a full import-graph walk). No such path exists today: the round-4 completeness sweep confirmed every browse of for-sale inventory renders through a wrapper, and no barrel re-exports the raw modules. Source-contract tests in `components/search/__tests__/map-search-contracts.test.ts` additionally pin the per-surface dual-key wiring.
