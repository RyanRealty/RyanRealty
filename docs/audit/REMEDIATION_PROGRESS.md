# Audit Remediation — Progress Log

**Source plan:** `scratch/AUDIT_REMEDIATION_PROMPT.md` (the master prompt from the 2026-06-20 inherited-codebase audit; 174 verified findings).
**How to read:** newest entry at the top of the log. Each step records what/why, the change set, how it was real-tested, the result, and any follow-ups discovered. Status table is the at-a-glance index.

## Autonomous /loop run — final state (2026-06-22)

The safe, autonomously-verifiable portion of the plan is **complete**. Review pass: all 15 audit-added gates pass, `tsc` source-clean, vitest 780/780. What shipped this run:

- **Phase 0 (CRITICAL):** all done before this run (governance meta-gate, sync data-loss, auth/access holes, CRM fail-closed, market-classification).
- **3.2 the 5 critical-path tests — DONE 5/5:** DAL (`resolveCanonicalListingKey`), sync-cursor (`deltaCursor`), market-formula (`classify`), FUB lead-create (`sendEvent`, fetch-mocked), auth-guards (`isValidCronAuth` + `safeRedirect`).
- **3.3 dual-name env collapse — DONE for both names the plan flagged:** FUB (`getFubApiKey`, `ci:fub-env` 14→1) + Meta (`getMetaPageToken`, new `ci:meta-token`).
- **Shared gate-lib (`scripts/lib/walk.mjs`)** + 4 gates migrated byte-identical; new gates dogfood it.
- **Orphan gate backlog 28→7** (fixed-then-wired email-brand-tokens + producer-skills, etc.).
- **1.5 dead code:** −308 LOC (3 verified-dead lib modules); corrected the audit's wrong `types/database.ts` "dead" label.
- **1.6 fork:** market-faq routed through canonical `formatPrice`.
- **1.2 FUB env-key collapse complete** (only the `.mjs` remains, can't import the `.ts`).
- **Doc drift:** orphan-count synced in CLAUDE.md + MECHANICAL_GATES.md.
- **Tests:** +28 files / 780 total (81 files), incl. money/date/market-classify/YoY/FAQ/dedup/JSON-LD-honesty/coercers/phone/attribution/FSBO/inventory/TC-field-map/sync-health/Twilio-webhook-auth.

### Tier-1 SAFE deferred set — DONE (2026-06-22 continuation)

Three additional deferred items that were safely completable in-session (additive/reversible, no build/creds/render-verify needed) shipped this continuation:

- **(4) Zod env Stage 1** — `lib/env.ts` converted to a typed `zod` schema mirroring the EXACT existing required/optional split (2 build-required + 2 runtime-required + 13 optional; no expansion). Behavior identical: `validateEnv`/`validateEnvRuntime` still return `{ ok, missing }` and NEVER throw; adds `getValidatedEnv()` + exported `Env` type. `zod` recorded as a direct dep (was transitive via `lib/data/*`; version unchanged 4.3.6). **Stage 2 (build-failing throw) stays deferred — needs a verified `next build`.** (commit `164544d8`)
- **(5) DAL boundary Part A — cached-read write classifier** — `check-dal-boundary.mjs` now hard-fails any `.insert/.update/.upsert/.delete` on a cached-read path (zero-tolerance, NOT ratcheted): Rule 1 = no writes in `lib/data/cache/**`; Rule 2 = no write lexically inside an inline `unstable_cache(...)`/`makeResilientCached(...)` callback (string/comment/template-aware paren matcher). Named-fn-reference resolution = deferred **Part C** (call-graph). Verified clean today + negative-tested (fires on inline-callback write + cache-dir write, ignores the named-ref case). Already in `ci:gates` via `ci:dal-boundary`. (commit `d92490fc`)
- **(6) collections-wiring gate** — repointed from the stale `/dashboard/collections` paths (now redirect stubs) to the live `/account/collections/*` impl (`getUserCollections`/`getCollectionById` + create/delete/add/remove markers), added a regression guard that the legacy `/dashboard` routes stay pure redirects, added `ci:collections-wiring` + wired into `ci:gates`. Passes 10/10. **Orphan gate-file backlog shrunk 4→3.** (commit `d819e62e`)

**Deferred — needs a build env, render-verify, live-path care, creds, or a Matt decision (NOT blind-pushed, per policy):**
- Build-failing Zod over ~159 keys (needs `next build`); FUB 3-client merge + Meta-publisher reader migrations (live paths, trim-semantics nuance); currency/date baseline shrink + ~15 page-level round-to-$1k dupes (output-changing, render-verify); `2.2` barrel split + `server-only` (needs `next build`); `dal-boundary` write-path read/write split; the `experience/` family per-symbol consumption trace; the remaining 7 orphan gates (`bundle-budget` build · `geo-imagery`/`collections-wiring` page/feature · `legacy-redirects`/`missing-videos`/`video-urls` creds · `tool-discipline` frozen-layer owner call); `ci:process-canon` was already RED on `main` pre-run (an unregistered plan doc, someone's to own).

## Status

| Phase | Step | Title | Status |
|---|---|---|---|
| 0 | 0.0 | Governance-gate truth (meta-gate blind spot) | ✅ done (2026-06-20) |
| 0 | 0.1 | MLS sync data-loss | ✅ done (2026-06-20) |
| 0 | 0.2 | Auth/access holes — a: open-redirect ✅ · b: admin CRON_SECRET mutations ✅ · c: access-denied loop ✅ · d: unauthed service-role action ✅ | ✅ done (2026-06-20) |
| 0 | 0.3 | CRM compliance fail-safe — enroll fail-closed ✅ · STOP/START reversible ✅ (meta-webhook routing: follow-up) | ✅ done (2026-06-21) |
| 0 | 0.4 | Market-classification helper — a: §0 methodology fix ✅ · b: data-layer threshold consolidation ✅ (page-prose sites: follow-up) | ✅ done (2026-06-21) |
| 1 | 1.3 | Shared auth guards (`lib/auth/guards.ts`) | ✅ shipped + adopted in 0.2b/d |
| 1 | 1.5 | Delete confirmed dead code | ✅ done — 32 Homepage* (3,055 LOC) + kpi-dashboard (559) + 4 orphan lib modules |
| 1 | 1.4 | Canonical money + date formatters | 🔶 helpers + gates ✅; migrating call sites (currency 59, date 86 baselined) |
| 1 | 1.1 | Unify Supabase clients | 🔶 service-role ratchet gate ✅ (baseline 137; 6 dead helpers removed); browser/server factories deferred (needs `next build`) |
| 1 | 1.2 | FUB client + env-key collapse | 🔶 accessor + gate ✅; ALL app/+lib `.ts/.tsx` key-readers now via `getFubApiKey()` (page + meta lead-webhook migrated; `ci:fub-env` baseline 3→1 — only `lib/fub-client.mjs` left, a `.mjs` that can't import the `.ts` accessor); 3-client merge deferred (needs `next build`) |
| 1 | 1.6 | Remaining forks | 🔶 market-faq `roundedThousand` → canonical `formatPrice` (proven byte-identical for positive inputs, guarded caller, test asserts it) ✅; ~15 page-level round-to-$1k dupes are the render-verify currency-migration bucket (locale-default toLocaleString + unguarded-0 edge cases) — deferred; the 2 `lib/data/*` ones return numbers, not currency — not candidates |
| 2 | 2.1 | DAL boundary → default-deny | 🔶 any-table matcher + ratchet 213→0 ✅ · **Part A cached-read write classifier ✅** (zero-tolerance: no write in `lib/data/cache/**` or inside an inline `unstable_cache`/`makeResilientCached` callback); named-fn-reference write trace = Part C (call-graph), deferred; the app/actions read/write split is the larger 2.1 remainder, deferred |
| 2 | 2.2 | Split barrels/god-files + server-only | ⬜ todo |
| 3 | 3.x | Governance + tests + env | 🔶 orphan gates 24→7 ✅ · doc drift ✅ (orphan-count 24→7 synced in CLAUDE.md + MECHANICAL_GATES.md) · tests +28 files / 780 ✅ (+ skyslope-field-map TC signer-role routing, strict-verify-run-health sync-health state machine, twilio validateTwilioSignature webhook HMAC auth) · **3.2 critical paths — 5/5 COVERED ✅: sync-cursor · market-formula · auth-guards (pure isValidCronAuth from the CRON_SECRET bypass surface + safeRedirect) · FUB lead-create (sendEvent fetch-mocked + isPlaceholderFubEmail) · DAL-fn (resolveCanonicalListingKey, supabase+cache-mocked: ListNumber-first -> ListingKey -> input-unchanged resolution + no-client fallback; the mismatch that repeatedly broke photos/videos/history)** · shared gate-lib: walkFiles + 4 gates migrated; rest NOT drop-in, left as-is ✅ · **3.3 dual-name env collapse: `getMetaPageToken()` (META_PAGE_ACCESS_TOKEN ?? META_PAGE_TOKEN) + `ci:meta-token` gate (baseline 8, dogfoods walkFiles), meta-health page migrated** 🔶; **Zod env Stage 1 ✅** (`lib/env.ts` typed `zod` schema, exact required/optional split, no-throw, `zod` now a direct dep); build-failing Zod over ~159 keys (Stage 2): deferred (needs `next build`) |

## Discovered (cross-step follow-ups, not yet scheduled)

- **Orphaned gate-file backlog (3, was 28).** The audit said 4 documented gates ran nowhere; the real number was **28 `scripts/check-*.mjs` that run nowhere**. Now **3 remain**, tracked in `scripts/gates-wired-baseline.json` (the meta-gate prints them every run and blocks NEW ones). Since the earlier prose: `geo-imagery` + `collections-wiring` were repointed to the real feature and wired into `ci:gates`; `missing-videos` + `video-urls` were deleted (dead). The remaining **3** each need a non-mechanical step, not just wiring: `bundle-budget` (a clean `next build` to re-baseline), `legacy-redirects` (a creds-bearing workflow — hits live URLs), `tool-discipline` (references a missing `viral-playbook/SKILL.md` — frozen-layer owner decision).
- **`ci:gates` was already RED on `main`** before this work: `ci:process-canon` (G44) fails because `docs/plans/PAGE_REVIEW_REDESIGN_RUNBOOK.md` is committed but not registered in `docs/DEVELOPMENT_PROCESS.md`. Quick win: register it (status row) or remove the rogue doc. Not fixed here (it's someone's plan doc; needs an owner decision), but it means the static chain is not currently green for reasons unrelated to this step.
- **8 competing homepage mockup contracts** (`homepage`, `-film`, `-magazine`, `-terminal`, `-v4/5/6`, `-v7-cinematic`) all map to `app/page.tsx`; the live KB homepage satisfies none of the component-bearing ones. One was baselined in 0.0 to wire `mockup-parity`; the contract sprawl itself is a Phase-1.5 (design-system consolidation / dead-prototype) cleanup.

---

## Log

### 3.x — Shared gate file-walker + more pure-function tests · 2026-06-22

**Shared `scripts/lib/walk.mjs` (gate-lib, audit-maintainability finding).** ~33 `check-*.mjs` gates each re-implemented the identical recursive `walk(dir, acc)` (skip `node_modules/.next/.git`, collect `.ts/.tsx`). Extracted the single source (configurable `ext`/`skip`) + a vitest unit test (wired `scripts/lib/**/*.test.mjs` into `vitest.config.ts` include). Migrated the 4 p1.4-era gates whose walk was behavior-identical: `currency-format`, `date-format`, `service-client`, `market-formula`. **Each verified byte-identical output before/after** (captured to `/tmp`, diffed) — no gate changes what it scans.

**Gate-walker finding (thread closed for the safe cluster).** Inspecting the other ~29 walk copies: they are NOT drop-in compatible with `walkFiles`. They use `path.join(ROOT, ...)` absolute paths + `path.relative` to re-derive (vs walkFiles' forward-slash `${dir}/${e.name}`), unanchored skip regexes (`/node_modules|\.next|\.git/` matches mid-name), and divergent skip-sets (`no-staging-host` skips only `node_modules`+`.next`, NOT `.git`) and extensions (`.tsx/.jsx`, `.ts/.mts`, generators). Forcing them onto `walkFiles` means restructuring each gate's path-building, with real divergence risk for a tooling-only DRY win. Decision: keep the canonical `walkFiles` for the clean cluster + as the home for any NEW gate; leave the heterogeneous legacy walkers in place. Not worth the per-gate risk.

**Test +1 (this cycle): `report-year-compare.test.ts`** (YoY market-report grid + the published "up/down N%" interpretation sentence — data-accuracy-critical per S0): `getAvailableYears` (distinct, desc, invalid-skipping), `buildYtdComparisonRows` (per-year keys, null for missing year-month), `summarizeInterpretation` (YTD + peer-delta math).

**Tests +2 files (→ 717 / 69).** `inventory-filters.test.ts` (city/market "homes for sale" counts: `isActiveForSaleStatus`/`classifyInventoryPropertyType`/`isResidentialInventoryType`), `search-filters.test.ts` (saved-search alert dedup: `getSavedSearchHash` is order-independent, `'500000'==500000`, junk-ignoring, changes on real diff). Plus `scripts/lib/walk.test.mjs`.

**Real-test.** All 4 gates byte-identical; `ci:gates-wired` green (walk.mjs not flagged as a gate); full `vitest` 717/717; G46 pre-push `tsc` PASS.

### 3.x — Orphan backlog 9 → 7 (fix-then-wire) + 4 pure-function test files · 2026-06-22

**Two orphan gates fixed at the source, then wired (no baseline cop-out).**
- **`ci:email-brand-tokens` (orphan 9→8).** The newsletter HTML shell (`lib/email-templates/newsletter-shell.ts`) carried retired sand `#e8e2d4` as its card border — invisible to the design-token gate (which scans only `app/`+`components/`). Imported the canonical `EMAIL_BORDER` (`rgba(16,39,66,0.08)`) from `lib/email/brand.ts` and used it; gate now CLEAN; wired into `ci:gates`.
- **`ci:producer-skills` (orphan 8→7).** The CMA producer SKILL (a live recipe the producer-runtime reads verbatim → produced copy inherits its dashes) had 3 em-dashes in prose. Replaced with period/comma; G35 now passes 52/0 across all producers; wired into `ci:gates`. No REGISTRY row added — `producer-freeze` still green at 78 rows.

**Tests +4 files (→ 699 / 66 files).** `lib/admin.test.ts` (isSuperuserAdmin auth gate — case/whitespace tolerance + non-string rejection), `lib/mls-source.test.ts` (getMlsSourceMeta known-source map + empty/title-case fallback; normalizeMlsDisplayNumber 5–12 alphanumeric guard). Earlier this run: `agent-attribution`, `fsbo-detector`.

**Real-test.** Each gate run green before wiring; `ci:gates-wired` → orphan baseline re-written 9→8→7, meta-gate green; full `vitest` 699/699; G46 pre-push full `tsc` PASS.

**Deferred (flagged, per the loop's no-blind-push rule):** currency/date baseline shrink is NOT zero-output-change — `formatPrice` rounds to the nearest $1,000, so migrating inline `Intl.NumberFormat` call sites changes output for non-thousand prices; needs per-site review, not a mechanical sweep. Remaining 5 orphan gates need a `next build` (`bundle-budget`), real page/feature edits (`geo-imagery`, `collections-wiring`), a creds-bearing workflow (`legacy-redirects`, `missing-videos`, `video-urls`), or a frozen-layer owner decision (`tool-discipline`).

### 3.x — Triage the orphaned gate-file backlog (24 → 12) · 2026-06-22

**Problem (audit CRITICAL follow-up).** Step 0.0 surfaced 28 `scripts/check-*.mjs` gate files that ran nowhere; 4 were resolved then, leaving a 24-file backlog (`scripts/gates-wired-baseline.json`). These are real gates the team wrote but never wired.

**Change set.** Ran all 24: 15 pass, 9 fail (real violations / obsolete). Of the 15 passing, 12 are file-only (no DB/network) → **wired into `ci:gates`**: `cma-routing`, `community-content`, `console-kit`, `dead-ui`, `design-directives`, `flyover-video-size`, `hero-image`, `lp-conversion`, `measurement-loop`, `mockup-coverage`, `nav-reachability`, `rental-lead-wiring`. Re-baselined the orphan list to **12**.

**Real-test.** All 12 pass; `ci:gates-wired` → 83 ci:* gates wired / 0 orphaned, 12 file-orphans baselined; meta-gate green.

**Second pass (same day): 12 → 9.** Of the 9 failing gates, 3 support a `--write-baseline` ratchet and pass once baselined → wired: `broker-facts` (bans literal phone numbers, use lib/brand/contact.ts), `canonical-listings` (bans new legacy-ListingCard usage), `heading-display`. Baselines committed alongside.

**Remaining (9 orphans):** 3 DB/network-dependent (`legacy-redirects`, `missing-videos`, `video-urls`) → wire to a creds-bearing workflow; 6 fail with no baseline mechanism (`bundle-budget`, `tool-discipline` fail even after baseline; `collections-wiring`, `email-brand-tokens`, `geo-imagery`, `producer-skills`) — each needs its violations fixed or the gate retired (several relate to the frozen marketing-brain producer layer). Tracked for the next passes.

### 1.2a — Single FollowUpBoss API-key accessor · 2026-06-22

**Problem (audit MED/HIGH, duplication + fragility).** The FUB key was read under two env names — `FOLLOWUPBOSS_API_KEY` (15 files) and `FUB_API_KEY` (6) — and the main client (`followupboss.ts:23`) read only the former, so a key set under just `FUB_API_KEY` silently disabled half the system. The Basic-auth header was also hand-built `Buffer.from(...)` in 8+ places.

**Change set.** `lib/crm/fub-env.ts` — `getFubApiKey()` (reads `FOLLOWUPBOSS_API_KEY ?? FUB_API_KEY`, so either name works everywhere) + `fubAuthHeader()` (the shared Basic-auth header). `ci:fub-env` ratchet gate wired into `ci:gates`: direct `process.env.FOLLOWUPBOSS_API_KEY|FUB_API_KEY` reads baselined (14 after migrating the main client), new ones fail. Migrated `lib/followupboss.ts` onto the accessor.

**Real-test.** `ci:fub-env` → 14 baselined / 0 new; `followupboss.ts` has 0 direct env reads now; `ci:gates-wired` → 71 gates; `tsc` source clean.

**Next (1.2):** collapse the 3 FUB clients (`followupboss.ts` / `fub.ts` / `fub-client.mjs`) + a single `createLead()` entry, and route the remaining 14 key-readers + the inline `Buffer.from` headers through `fub-env.ts`.

### 2.1 — Flip the DAL boundary gate to default-deny · 2026-06-22

**Problem (audit HIGH, structural).** `check-dal-boundary.mjs` (G1) only matched a hardcoded **26-table denylist**, so the audit's note held: "any new/non-listed table can be read raw from a page/component without tripping the gate." The boundary was partial by design.

**Change set.** The matcher is now **default-deny**: it flags `.from('<table>')` for ANY lowercase snake_case table name outside `lib/data/` (+ the existing write-path prefixes `app/actions`/`app/api`/`app/admin`), with lookbehind excluding `Buffer.from(`/`Array.from(`. Re-baselined: **213 boundary violations across 48 files** (`scripts/dal-boundary-baseline.json`) — the real consumer-read/lib-helper boundary debt, which now ratchets toward 0.

**Real-test.** `ci:dal-boundary` passes at the 213 baseline; a synthetic `supabase.from('some_new_table')` in `app/` correctly FAILS (regression-catches-new, which the old 26-table list would have passed); regex sanity-checked to match `listings`/`crm_people` and exclude `Buffer.from('hello')`/`Array.from(x)`; `ci:gates-wired` → 70 gates.

**Scope note.** The remaining part of 2.1 — narrowing the blanket `app/actions`/`api`/`admin` write-path exemption so raw READS there are also flagged (the audit's ~440 in app/actions) — requires a read/write split of those files (move reads into `lib/data` / an `app/actions/_read` tier) and is a larger architecture pass; deferred. This flip already closes the "unlisted table" hole and ratchets the 213.

### 1.1a — Consolidate inline service-role Supabase clients · 2026-06-22

**Problem (audit MED, duplication).** The service-role client was constructed inline in many files (`createClient(url, SUPABASE_SERVICE_ROLE_KEY)`) instead of the memoized singleton `createServiceClient()` (lib/supabase/service.ts) — 143 files reference the key + build a client. Each inline copy rebuilds a client per call (no memoization) and duplicates the bootstrap.

**Change set.** `ci:service-client` ratchet gate wired into `ci:gates`: 143 inline offenders baselined (`scripts/service-client-baseline.json`), NEW ones fail. Migrated `app/actions/admin-roles.ts` off its inline `getServiceSupabase()` onto `createServiceClient()` (server-only, exact match) as the first shrink.

**Real-test.** `ci:service-client` → 143 baselined / 0 new; admin-roles has 0 service-key refs now; `ci:gates-wired` → 70 gates; `tsc` source clean.

**Scope note (1.1 browser/server factories).** The 5-factory unification of the *browser*/*server cookie* clients (lib/supabase.ts, lib/supabase/{server,client}.ts) crosses the React client/server boundary — a wrong import poisons the client bundle and is caught only by `next build`, not `tsc`. That part is deferred to a render-verified pass rather than blind-pushed; the service-role consolidation (server-only, safe) proceeds now via the ratchet.

### 1.4 — Canonical money formatter + ratchet gate · 2026-06-21

**Problem (audit HIGH, duplication).** ~58 inline `Intl.NumberFormat(... currency ...)` call sites and 3 divergent `formatPriceCompact` defs (the two LP copies differed only in millions rounding → inconsistent `$1.2M` vs `$1.20M`), risking the brand rule of rounding to the nearest $1,000.

**Change set.** `lib/format/money.ts` — single `formatPrice` (nearest $1,000) + `formatPriceCompact` (one rounding rule). + `money.test.ts`. `ci:currency-format` ratchet gate wired into `ci:gates`: 60 existing offenders baselined (`scripts/currency-format-baseline.json`), NEW inline currency formatters fail. Baseline may only shrink.

**Real-test.** money tests pass; `ci:currency-format` → 60 baselined / 0 new; `ci:gates-wired` → 68 gates; `tsc` source clean. Additive — zero change to currently-published output.

**Date helper (same turn).** `lib/format/date.ts` — `formatDate`/`formatDateTime` (default `America/Los_Angeles`) + `date.test.ts`. `ci:date-format` ratchet gate wired into `ci:gates`: 86 inline date formatters baselined (`scripts/date-format-baseline.json`), new ones fail.

**Migration note (currency + date, gradual).** The ~60 currency + ~86 date call sites are heterogeneous — local `formatPrice` defs vary (some round to $1,000 matching the helper, some show exact, some use `$895k` compact style), so a blind codemod would change PUBLISHED prices/dates I can't render-verify from here. Per the additive/flag rule, the helpers + ratchet gates are shipped now (banking the no-new-duplication value); each existing call site migrates in a render-checked pass that shrinks the baseline. Start point for the next pass: the formatters that already round-to-$1,000 (byte-identical to `formatPrice`, e.g. `ShowcaseKeyFacts.tsx`) — zero-output-change migrations first.

### 1.5a — Delete 32 dead Homepage* prototype components · 2026-06-21

**Problem (audit MED, dead code).** `components/site/Homepage*` = 3 abandoned homepage prototype generations (Cine / V6 / HeroV3 families), 32 files / ~3,055 LOC. The live homepage is 100% KB; re-verified **zero external importers** (the 5 that looked live only reference each other).

**Change set.** `git rm` all 32 `components/site/Homepage*`. Cleaned the stale entries they left in the debt baselines (the honest ratchet "decrease"): `scripts/shadcn-burndown-baseline.json` 244→238 (existence-filtered), `.design-token-lint-ignore` 199→191 (dropped deleted-file paths).

**Real-test.** `tsc` → source clean. `ci:design-tokens`, `ci:shadcn-burndown`, `ci:mockup-parity`, `ci:gates-wired` → all PASS. (The `mockup-parity` baseline still lists `HomepageV6Hero` as a required-but-missing component for the dead `homepage-v6` ui_kit contract — that's the "8 competing homepage contracts" follow-up, not a live route.)

### 1.5b — Delete kpi-dashboard route + 4 orphan lib modules · 2026-06-21

**Change set.** Verified zero importers (exact-path grep across app/components/lib/scripts + tsc), then `git rm`:
- `app/admin/(protected)/kpi-dashboard/` (page + loading + KpiAutoRefresh, 559 LOC) — orphan after the 3-dashboard collapse, no nav/link refs.
- `lib/meta-pixel.ts` (decoy shadowed by `meta-pixel-helpers.ts`), `lib/activity-tracker.ts`, `lib/ga4-data-api.ts`, `lib/visitor.ts` — top-level modules with zero importers.
- Removed the now-stale `kpi-dashboard` entries from two non-CI scripts (`check-console-kit.mjs`, `audit-brain.mjs`) so they don't trip when the orphan-gate backlog is triaged.

**Real-test.** `tsc` → source clean. The only post-delete name hits were a string literal (`source: 'visitor'`) and an HTML id (`id="meta-pixel"`), not imports.

**Remaining dead code (follow-up).**
- **`types/database.ts` — NOT dead, corrected.** Re-verified 2026-06-22: its one importer (`video/listing-tour/scripts/prepare-tour.ts:399`, `createClient<Database>(...)`) is load-bearing for the ACTIVE `npm run video:listing-tour:prepare` script (package.json:186). The audit's "dead" label was wrong. Keep it.
- **3 confirmed-dead lib modules deleted (308 LOC, 2026-06-22):** `lib/community-profiles.ts` (140, superseded by `data/resort-communities.json` + KB community pages), `lib/pulse-brain-content.ts` (99, frozen brain layer), `lib/push-notifications.ts` (69, never wired since 2026-03-30). Each: zero imports + zero references to any export repo-wide + `tsc` source-clean after removal. All git-recoverable if any is wanted back.
- **`components/site/experience/` family:** all 13 files have >=1 ref, but mostly via the heavily-used `index.ts` barrel (241 refs) which masks downstream consumption. Needs per-SYMBOL consumption tracing (is each export actually rendered by a page?) before any deletion — real breakage risk, deferred.

### 0.3 — CRM compliance fail-safe (TCPA) · 2026-06-21 — PHASE 0 COMPLETE

**Problem (audit HIGH, TCPA/SMS).** Re-verified: the send-path chokepoint `isSuppressed` (suppressions.ts) ALREADY fails closed (good). The real gaps: (1) `lib/crm/enroll.ts` hard-stop checks (2 sites) ignored the query `.error` → a network blip returned no rows → **enrolled a hard-stopped contact** (fail OPEN); (2) the STOP auto-reply promises "Reply START to resubscribe" but **no START handler existed** — an opt-out was permanent, contradicting the promise.

**Change set (all err toward NOT messaging — the TCPA-safe direction).**
- `lib/crm/enroll.ts` — both hard-stop checks now capture `.error` and return `enrolled:false` on error (fail CLOSED).
- `lib/crm/suppressions.ts` — new `removeSuppression({personId, channel, reason})`, scoped by reason.
- `app/api/twilio/inbound-sms/route.ts` — `START_WORDS` handler removes the user's own `sms` `stop-keyword` suppression (never a compliance do-not-text/hard-stop), logs it, and confirms. The "Reply START" promise is now real.
- `scripts/check-crm-fail-closed.mjs` (`ci:crm-fail-closed`, wired into `ci:gates`) — asserts every enroll hard-stop read has an error guard + a START handler exists.

**Real-test.** `ci:crm-fail-closed` → OK. `ci:gates-wired` → 67 gates, green. `tsc` → source clean. Could not runtime-test live SMS here; both changes are conservative (fail-closed enroll; START only clears the user's own opt-out), so a wrong assumption cannot create a TCPA violation — worst case is a suppressed-but-sendable message or an unchanged opt-out.

**Follow-up (tracked):** 0.3(c) — the Meta `lead-webhook` re-implements tagging by hand and skips the canonical `canonicallyTagLead` path. Lower compliance risk (lead *creation* doesn't send; every send still hits the fail-closed `isSuppressed`), so deferred to the Phase-1 CRM-consolidation pass rather than rushed here.

### 0.4a — Wrong published months-of-supply formula (§0 compliance) · 2026-06-21

**Problem (audit HIGH, §0 data-accuracy on a licensed-broker surface).** Two market pages printed an AI-citable methodology trace stating "Months of supply = active listings divided by (closed last 30 days times 2)" (`central-oregon/page.tsx:162`, `[...slug]/page.tsx:256`). That contradicts the canonical §0 formula `active / (closed_6mo / 6)` AND the number actually shown (from `market_pulse_live.months_of_supply`). The displayed verdict thresholds (≤4/<6/≥6) were already correct and consistent across sites — the published *formula text* was the violation.

**Change set.**
- `lib/market/classify.ts` — NEW single source: `monthsOfSupply()`, `marketVerdict()` (the one place the ≤4/<6/≥6 boundaries live), `MOS_METHODOLOGY_CLAUSE` (canonical formula text), `MOS_THRESHOLD_CLAUSE`. + `classify.test.ts` (5 cases incl. boundary at 4 and 6, null handling, no "times 2"/"30 days" in the clause).
- `central-oregon/page.tsx` + `[...slug]/page.tsx` — methodology trace now uses `MOS_METHODOLOGY_CLAUSE` + `MOS_THRESHOLD_CLAUSE` instead of the false inline string.
- `scripts/check-market-formula.mjs` (`ci:market-formula`, wired into `ci:gates`) — fails if any app/lib file publishes "closed last 30 days times 2".

**Real-test (local).** `npx vitest run lib/market/classify.test.ts` → 5/5. `ci:market-formula` → OK (no wrong formula remains). `ci:gates-wired` → 66 gates, green. `tsc` → source clean.

**Assumption / note.** The displayed MoS number comes from the `refresh_market_pulse()` RPC (not in this repo). The fix makes the *printed* methodology match the §0-mandated canonical formula; it assumes the RPC implements canonical (which §0 mandates). Recommend a one-time reconciliation query to confirm the column == `active/(closed_6mo/6)`; logged here rather than blocking the text fix.

### 0.4b — Consolidate data-layer MoS verdict thresholds · 2026-06-21

**Change set.** The 3 reusable data-layer helpers now derive their verdict from `marketVerdict()` instead of inline `mos <= 4 / < 6 / >= 6`, with byte-identical output:
- `lib/data/market/getMarketStats.ts` `classifyMoS` → `marketVerdict().kind` (null preserved).
- `lib/data/nav/getMegaMenuData.ts` `verdictFromMoS` → keeps its `mos<=0 → null` guard, then `marketVerdict().kind`.
- `lib/site/market-faq.ts` `marketType` → maps `marketVerdict().kind` to the FAQ's short labels ("seller's"/"balanced"/"buyer's").
- `ci:market-formula` extended to ALSO fail on inline MoS thresholds in `lib/data` + `lib/site`.

**Real-test.** `ci:market-formula` → OK. `rg "mos <= 4|< 6|>= 6" lib/data lib/site` → none. `tsc` → source clean.

**Follow-up (tracked):** the ~8 page-prose verdict sites in `app/housing-market/*` (e.g. "a seller's market" with article variations) still inline the thresholds. They render the CORRECT verdict today; consolidating them onto `marketVerdict().label` is a low-risk cleanup left for the Phase-1 pass (the gate's threshold ban is scoped to the data layer to avoid altering published page copy without a render check).

### 0.2d — Unauthed service-role admin-role mutations (privilege escalation) · 2026-06-20

**Problem (audit HIGH, security — privilege escalation).** `upsertAdminRole` + `removeAdminRole` in `app/actions/admin-roles.ts` are `'use server'` actions (exposed as public POST endpoints) that write the `admin_roles` table via the **service role**. They validated only the *target* email (can't set `superuser`), never the **caller** — so any unauthenticated visitor could POST and grant an arbitrary email a `broker`/`report_viewer` admin role. The `getSession()` call present was for audit-logging only, not authorization.

**Change set.**
- Both mutations now resolve the caller (`getSession` → `getAdminRoleForEmail`) at the top and **return `Forbidden` unless the caller is `superuser`** before any write. Reuses the now-hoisted session for the audit log (removed the duplicate `getSession`). Guarded inline (not via `lib/auth/guards`) because `guards.ts` imports `admin-roles` — importing back would be circular.
- `scripts/check-admin-role-guard.mjs` (`ci:admin-role-guard`, wired into `ci:gates`) — asserts both mutations carry the superuser caller guard.

**Real-test (local).** `ci:admin-role-guard` → PASS. `ci:gates-wired` → green. `tsc --noEmit` → source clean. The admin Users page calls these as a superuser → unaffected; non-superuser/unauthed callers are now blocked (correct).

### 0.2b — Interactive admin endpoints gated only by CRON_SECRET · 2026-06-20

**Problem (audit HIGH, security).** Interactive admin mutation endpoints authenticated with a shared `Bearer ${CRON_SECRET}` only — no operator identity. Confirmed two: `app/api/admin/gbp/set-website-utm` (cross-account GBP write; its own comment "mirrors the other admin write endpoints") and `app/api/admin/expired-listing-lookup` (manual owner-lookup trigger, "when Matt wants to immediately re-fire", used `isAuthorizedCron`).

**Change set.**
- Both now authenticate via `isAuthorizedAdminOrCron()` (lib/auth/guards.ts) — accepts a valid admin session OR the cron secret. **Additive**: operators get an identity path; any existing automation using the secret still works (no lockout). Adopts the Step 1.3 guards.
- `expired-listing-lookup` drops the `isAuthorizedCron` import from `lib/marketing-brain/snapshot`.
- `scripts/check-admin-endpoint-auth.mjs` (`ci:admin-endpoint-auth`, wired into `ci:gates`) — asserts these converted endpoints authenticate via `@/lib/auth/guards` (regression guard; grows as more interactive endpoints convert).

**Real-test (local).** `ci:admin-endpoint-auth` → PASS. `ci:gates-wired` → green. `tsc --noEmit` → no source errors (only a stale gitignored `.next/types` artifact referencing the 0.2c-deleted page; G46 runs tsc on a clean HEAD tree so it passes on push). The 4 genuinely cron/maintenance admin endpoints (`sync/photos`, `sync/history-active`, `run-loop-cycle`, `tracerfy-history`) correctly keep secret-only auth.

**Note.** Could not runtime-verify the live endpoints (no running app with auth here). The change is additive (session-OR-secret) specifically so a wrong assumption can't lock out an operator or break automation — worst case is unchanged behavior.

### 0.2c — Admin access-denied redirect loop + 1.3 shared guards · 2026-06-20

**Problem (audit HIGH, structural).** `app/admin/(protected)/access-denied/page.tsx` lived INSIDE the `(protected)` route group whose layout (`getSession` → `getAdminRoleForEmail` → `redirect('/admin/access-denied')`) guards every page under it. A signed-in non-admin was redirected to access-denied, which re-ran the same guard, which redirected again — infinite loop. (Re-verified against code; my first glob missed the file because of the `(protected)` parens — the audit was right.)

**Change set.**
- Deleted `app/admin/(protected)/access-denied/page.tsx` (the looping page).
- Added `app/admin/access-denied/page.tsx` OUTSIDE the group, under the no-auth `app/admin/layout.tsx`, so the redirect target renders without re-triggering the guard. Also resolves the previously-dead target (it never existed at a reachable location → would 404).
- `scripts/check-access-denied-loop.mjs` (`ci:access-denied`, wired into `ci:gates`) — fails if the page is missing OR if one exists inside `(protected)`.
- **Step 1.3 foundation:** `lib/auth/guards.ts` — single source for `getAdminContext()` / `requireAdminOr403()` / `requireSuperuserOr403()` / `isAuthorizedAdminOrCron()`, modeled exactly on the existing `getSession` + `getAdminRoleForEmail` chain (superuser + admin_roles). Additive (no adoption yet → no behavior change); will replace the ~6 inline authz patterns in 0.2b/d and the duplication cleanup.

**Real-test (local).** `ci:access-denied` → OK (after deleting the inside page). `ci:gates-wired` → green. `ci:auth-redirect` → green. package.json valid. `lib/auth/guards.ts` type-checks (verified via pre-push G46 tsc on commit).

**Note.** 0.2b (CRON_SECRET-gated interactive mutations → `isAuthorizedAdminOrCron`) and 0.2d (the specific unauthed service-role `'use server'` action) change live admin authz and I can't fully runtime-verify them here, so they get adopted carefully next with the shared guards, additively (session-OR-secret) to avoid any lockout.

### 0.2a — Open-redirect in auth server actions · 2026-06-20

**Problem (audit HIGH, security).** `app/actions/auth.ts` sanitized the post-auth `next` redirect with `next.startsWith('/') ? next : `/${next}`` in 6 places — `//evil.com` starts with `/`, so it passed and became a protocol-relative open redirect after sign-in. `app/auth/callback/route.ts` had a stronger-but-local `safeRedirectPath` (collapsed `//` but missed backslash tricks).

**Change set.**
- `lib/auth/safeRedirect.ts` — NEW single sanitizer: strips control chars (codepoint filter), normalizes `\`→`/`, rejects non-relative targets (`https://`, `javascript:`, bare host), collapses leading slashes. + `lib/auth/safeRedirect.test.ts` (6 cases incl. `//evil.com`, `/\evil.com`, `https://`, CR/LF).
- `app/actions/auth.ts` — all 6 weak checks routed through `safeRedirectPath()`.
- `app/auth/callback/route.ts` — local `safeRedirectPath` removed; imports the shared one (kills the duplication finding + hardens it).
- `scripts/check-auth-redirect.mjs` (`ci:auth-redirect`, wired into `ci:gates`) — fails if either auth file uses the weak `startsWith('/') ?` pattern or stops importing `safeRedirectPath`.

**Real-test (local).** `npx vitest run lib/auth/safeRedirect.test.ts` → 6/6. `ci:auth-redirect` → OK. `ci:gates-wired` → 62 gates wired, exit 0. `npx tsc --noEmit` → no errors. No weak `startsWith('/')` redirect pattern remains in either file.

**Remaining 0.2 sub-fixes (next):** (b) admin mutation endpoints gated only by a shared `CRON_SECRET` bearer instead of operator session+role; (c) `access-denied` page inside the `(protected)` group it is the redirect target of (infinite loop); (d) a public `'use server'` POST using the service-role key with no auth guard. These depend on the shared `requireAdmin`/`requireSuperuser` guards (Step 1.3) and change live admin authz, so they get extra care + a running-app check where feasible.

### 0.1 — MLS sync data-loss · 2026-06-20

**Problem (audit HIGH).** `app/api/cron/sync-delta/route.ts` set the cursor `last_delta_sync_at = now()` unconditionally at the end of every run. Two silent-data-loss paths: (1) overflow — a run caps at `MAX_PAGES=100` (~20k rows); if more pages remained, jumping the cursor to now() skipped every un-fetched change permanently; (2) failed upserts were logged + skipped but the cursor still advanced, so those rows were never re-fetched. Confirmed Spark is fetched `_orderby=+ModificationTimestamp` (ascending), so the newest processed row is a safe resume point.

**Change set.**
- `lib/sync/deltaCursor.ts` — NEW pure helper `computeNextDeltaCursor({upsertFailed, truncated, runStartedAt, maxProcessedTs})`: returns the ISO to write, or `null` to leave the cursor unchanged. Failure → null (retry whole window, idempotent); truncated → newest processed row; clean drain → runStartedAt (captured BEFORE fetching).
- `lib/sync/deltaCursor.test.ts` — NEW, 5 cases (clean / truncated / truncated-empty / failure / failure-overrides-truncation).
- `app/api/cron/sync-delta/route.ts` — capture `runStartedAt` before the loop; track `maxProcessedTs` high-water mark per page; set `upsertFailed` on any failed chunk; replace the unconditional `updateSyncStateLastDelta(new Date())` with a `computeNextDeltaCursor()`-gated write; return `ok: !upsertFailed` + `partial` flag.
- `scripts/check-sync-cursor.mjs` (`ci:sync-cursor`, wired into `ci:gates`) — fails if the route advances the cursor straight to `new Date()` or stops using `computeNextDeltaCursor()`.

**Real-test (local).** `npx vitest run lib/sync/deltaCursor.test.ts` → 5/5 pass. `ci:sync-cursor` → OK. `ci:gates-wired` → 61 gates wired, 91 files, 24 baseline, exit 0. `npx tsc --noEmit` → no errors. package.json valid.

**Residual risk / note.** The safe-advance assumes ascending Spark order (verified via `_orderby=+ModificationTimestamp` in `fetchSparkDelta`). On a real overflow the run now self-heals over subsequent ticks instead of losing rows; a sustained backlog > MAX_PAGES×200 will catch up gradually (raise `MAX_PAGES` or run a full sync if it ever persists). Behavior on a normal (non-overflow, no-failure) run is unchanged except the cursor is `runStartedAt` instead of post-run `now()` — strictly safer (re-picks rows modified mid-run).

### 0.0 — Governance-gate truth (CRITICAL) · 2026-06-20

**Problem (audit's #1 / CRITICAL).** `CLAUDE.md` + `docs/MECHANICAL_GATES.md` documented gates as "enforced" that ran nowhere, and the meta-gate `check-gates-wired.mjs` only enumerated `ci:*` npm scripts — so a `scripts/check-*.mjs` gate *file* with no `ci:*` wrapper was invisible to it. Confirmed against code: the `ci:gates` chain had no `ci:mockup-parity`/`ci:static-params`/`ci:data-access`/`ci:producer-freeze`; all four files existed and ran nowhere; the meta-gate reported "0 orphaned" anyway. Scanning revealed **28** such orphaned gate files in total (not 4).

**Change set.**
- `scripts/check-gates-wired.mjs` — rewritten. Adds a second check: every `scripts/check-*.mjs` must be reachable (chain / workflow / husky / any npm script) OR recorded in `scripts/gates-wired-baseline.json`. A NEW unaccounted gate file now fails the build; the known backlog prints every run and may only shrink. Adds a `KNOWN_UNWIRED` map for gates intentionally off the static chain (with reasons).
- `package.json` — added `ci:mockup-parity`, `ci:static-params`, `ci:producer-freeze`, `ci:data-access` (+ baseline/refresh variants) and `ci:gates-wired:baseline`. Wired `ci:mockup-parity`, `ci:static-params`, `ci:producer-freeze` into the `ci:gates` chain (before the meta-gate). `ci:data-access` deliberately left off the static chain (needs live Supabase) and recorded in `KNOWN_UNWIRED`.
- `app/sign/[token]/page.tsx` — added `// @no-static-params` (token-gated signing route is per-request SSR). Comment only; zero runtime change. Makes `check-static-params` pass.
- `docs/DAL_INDEX.md` — regenerated (`node scripts/index-dal.mjs`) to clear the `data-access` dal-index drift.
- `scripts/mockup-parity-baseline.json` — baselined the one intentional stale-homepage gap so `mockup-parity` could be wired (see follow-up on 8 contracts).
- `scripts/gates-wired-baseline.json` — NEW; records the 24 remaining orphaned gate files.
- `CLAUDE.md` + `docs/MECHANICAL_GATES.md` — replaced hand-maintained gate-list prose with a pointer to the authoritative `package.json` `ci:gates` chain; documented the meta-gate's new file-orphan check, the 24-file backlog, and that `data-access` runs locally/nightly (DB), not the static chain.

**Real-test (local).**
- `node scripts/check-gates-wired.mjs` → PASS: `ci:* gates: 60 checked · 60 wired · 0 orphaned`; `gate FILES: 90 total · 24 run nowhere (baseline 24)`; backlog printed; exit 0.
- `node scripts/check-mockup-parity.mjs` → PASS. `node scripts/check-static-params.mjs` → PASS. `node scripts/check-producer-freeze.mjs` → PASS (78 ≤ baseline 116).
- `node scripts/check-data-access.mjs` → schema-snapshot matches HEAD ✓; dal-index clears once the regenerated `DAL_INDEX.md` is committed (gate diffs vs HEAD).
- `package.json` validated as JSON.
- Verified the meta-gate now FAILS on a new unaccounted gate file (the whole point) and PASSES with the baseline.

**Result.** The governance layer is honest and self-policing: a gate file can no longer run nowhere unnoticed, the documented claims match the real chain, and 4 of the 28 orphans are resolved (3 wired + `data-access` accounted). Remaining 24 are a visible, shrink-only backlog.

**Not done here (flagged above):** the 24-file triage, the pre-existing `process-canon` red, and the 8-contract homepage sprawl.
