> **NEWEST, START HERE: audit follow-through — sitemap P0 actually fixed, CI root-caused, GSC/GA4 measured (2026-08-02, Claude Code local).**
> Picks up and closes the "Open for Matt" list from the cloud session below.
> Prior: website audit + remediation + CI unblock (2026-08-02, cloud); CMA/report depth (2026-07-30).

# Current — 2026-08-02 (Claude Code, local session)

| Field | Value |
|---|---|
| Surface | Claude Code, local, in a git worktree at `.claude/worktrees/audit-e2e` |
| Branch | `claude/ryan-realty-website-audit-sybjq3`, 24 commits ahead of `main` |
| Why a worktree | `main`'s working tree had a **live sibling session** with 53 uncommitted paths, two files touched 2 minutes before this session opened. Checking out or stashing there would have destroyed work in flight |
| Credentials | Supabase service role, GSC (`siteOwner`), GA4 (`527333348`) — the three the cloud container lacked |

## Three things the cloud session could not know

**1. The sitemap P0 fix did not work.** It was the highest-value unverified item.
Measured against a real production build:

```
core.xml   http=200  234.7s  159 urls
geo.xml    http=000  280s    0 bytes    <- requested immediately after
```

The shared-universe memo stamped freshness when the build **started**, with a 60s TTL against
a 115–235s build. It expired before it ever resolved, so every sequential request rebuilt from
scratch. It was verified against five *concurrent* cold requests, where single-flight genuinely
works — but Googlebot fetches children sequentially and the warmer loops. Now stamped on
resolve, extracted to `lib/sitemap-universe-memo.ts` with 6 regression tests. Verified:

```
core.xml     200  127.8s     159    <- the one universe build
geo.xml      200    0.014s  2566
content.xml  200    0.007s    56
listings.xml 200    0.016s  7574    <- had NEVER served
matrix.xml   200    0.006s   296
```

**2. The three-month CI failure has a root cause.** `middleware.ts` `BAD_BOT_RE` blocks
automation User-Agents and contains `axios`. `start-server-and-test` waits via `wait-on`, which
is axios-based. Every readiness probe got 403, `wait-on` accepts only 2xx, so it timed out after
five minutes printing "Timed out waiting for". The app was healthy throughout. The replacement
probes went green only because Node's `fetch` sends `User-Agent: node` and someone picked
`rr-smoke/1.0` — neither on the block list, by coincidence. Gate **G60** (`ci:probe-ua`) now
reads the live regex out of `middleware.ts` via the TypeScript AST and fails if it would ever
screen the probe UA. It found 12 more CI probes riding the same accident.

The screen itself is correct: every AI crawler `robots.txt` invites returns 200 in production.
This was never a discoverability defect.

**3. Two of the audit's conclusions do not survive real data.** See
[`MEASURED_METRICS_2026-08-02.md`](../audits/MEASURED_METRICS_2026-08-02.md).

- **The sitemap's stated impact was wrong.** Search Console shows all five children downloaded
  with zero errors, `listings.xml` carrying **7,660 URLs on 2026-08-01**. Google was never
  missing listing pages. The defect was real; the impact claim was not.
- **"Zero non-brand discoverability" is the wrong diagnosis.** GSC over 28 days: **35,451
  impressions, 467 clicks, CTR 1.32%, average position 14.5**, across 1,776 named queries of
  which 1,769 are non-brand. The site is not absent, it is on page two — **83.4% of named-query
  impressions sit at position 11 or worse**. (Coverage caveat: those 9,523 impressions are 27%
  of the total; Google withholds rare queries.)
- **And one finding that argues FOR the audit, harder than the audit did:** 7 of the top 20
  pages are blog posts, holding positions 4.5–8.9 against 14.5 site-wide. The single best URL is
  long-form editorial about a named community. That is audit items 9–11 evidenced from Ryan
  Realty's own traffic instead of from competitor inference.

## Shipped this session

| Item | Commit | Evidence |
|---|---|---|
| **CI root cause + gate G60** | `c6defa1b` | Verified 4 ways: passes at 15 probes, fails when a probe drops the UA, fails when `BAD_BOT_RE` is tightened onto it, keeps a known false positive out |
| **GSC + GA4 measured (item 21)** | `3f3e1072` | `scripts/measure-search-and-analytics.mjs` reproduces every figure in the doc |
| **Sitemap P0, actually fixed** | `aa56d308` | Sequential sweep above. 6 tests, negative-tested |
| **`/admin/media/banners` 38.2s → 0.5s** | `ae42b045` | 277,415 rows → 3,344; 284 round-trips → 14. Output deep-compared byte-identical across 13 cities / 789 subdivisions. Back in the smoke set: **277/277, zero skips** |
| **pa11y 0/8 → 8/8** | `a7451039` | Real rebuild, 0 errors on all 8 URLs. Three causes separated: contrast, map markers, third-party iframes |
| **Lighthouse thresholds calibrated** | `a7451039` | 40+ real passes. Perf ≥0.90 was unachievable on 7 of 8 routes; SEO and CLS could never fail |
| **§0: Coming Soon counted as "for sale"** | `f4763138` | Bend 1,288 shown vs 1,272 correct. 16 pre-marketing listings on a public surface |

## Open for Matt

1. **Apply migration `20260802120000_subdivision_status_counts_exclude_coming_soon.sql`.**
   Committed but NOT applied — it needs the migration channel. Until it runs, `/cities/[city]`
   still shows the inflated for-sale count. This is the only §0 item outstanding.
2. **Enable the Chrome UX Report API** (or PageSpeed Insights API) on the `ryanrealty` Google
   Cloud project. Core Web Vitals field data is the last audit metric still unmeasured — CrUX
   403s on the Maps key and the anonymous PSI quota is exhausted. Both are free.
3. **Flip Lighthouse and pa11y to blocking?** Recommendation, with measurements behind it:
   accessibility, SEO, CLS and best-practices are safe to block now. Performance and LCP should
   watch 2–3 real PR runs first, because their headroom is an estimate against CI hardware that
   could not be timed from here.
4. **Audit items 9–11 still need your go-ahead** — dated citable market pages, answer-shaped
   H2s, long-form editorial for the 14 Bend neighborhoods and 14 resort communities. Deliberately
   not started: they are content programs, every figure needs a §0 trace, and they land on public
   marketing surfaces under your license. The GSC data above is now the strongest argument for
   them.
5. **AdSense caps Best Practices at 0.74 on every page** — the script loads sitewide from the
   root layout but only `/activity` and `/resources` render an ad unit. Scoping it is a
   revenue-touching product call, so it is named, not changed.

## The sitemap P0 is improved but NOT closed in production. Read this before touching it.

Three passes have now been made at this, two of them by me, and **all three treated a symptom.**
The real cause was measured at the end and is recorded here so the fourth pass starts in the
right place.

**What is fixed and proven:** the memo TTL bug (freshness stamped at build start against a
60s TTL), and the warmer, which fetched the five public URLs over HTTP on the stated theory that
the in-flight dedupe would collapse them onto one build. It cannot: each fetch is a separate
lambda invocation with its own module scope, and sequential calls have no in-flight overlap
anyway. The warmer now calls `getClassRows()` in-process, where the memo genuinely applies.

**Production state right now, measured on the deployed commit, sequential, cold:**

```
core.xml      504  300.6s
geo.xml       504  300.6s
content.xml   200  146.7s   <- one build fit, on a warm instance
listings.xml  504  300.2s
matrix.xml    504  300.6s
```

**The actual cause: `get_subdivision_status_counts`.** `buildAllUrls` calls it once per report
city. Timed directly against production:

```
Bend        41,254ms      Prineville   1,410ms
Redmond     14,644ms      Madras       4,685ms
Sisters     31,959ms      Terrebonne   3,534ms
La Pine      4,317ms      Sunriver     2,940ms
                          TOTAL 8 cities: 104.7s
```

That is 104.7s for eight cities before the paginated listings scan, zips, blog and reports are
added, and there are more cities than eight. The RPC does
`WHERE TRIM("City") ILIKE TRIM(p_city)` over a 589K-row table — an unindexable expression, the
same class of defect commit `5bc16122` fixed for search (11.1s to 1.4s) by letting the planner
reach the city index.

**No amount of cache engineering fixes a 100s+ build.** The fourth pass should make the build
cheap, not cache it better: source the subdivision list from `listing_tile_mv` (already indexed
and already used elsewhere) instead of this RPC, or give the RPC an index the planner can use.
Until then, `core.xml` will keep hitting the 300s ceiling on a cold lambda.

Worth noting the audit recommended "build per class directly instead of building-all-then-
filtering" and PR #28 dropped it. That recommendation was right.

## Known gaps
- **`fetchAllRows()` swallows per-page errors** (`lib/supabase/paginate.ts` destructures only
  `{ data }`). A mid-pagination timeout silently truncates the result for every caller, with no
  error surfaced anywhere. Found while fixing the banners page; not fixed, blast radius is wide.
- **`scripts/check-listing-detail.mjs` references an undefined `listingKey`** in its `--json`
  path — `node scripts/check-listing-detail.mjs --json` throws. Pre-existing.
- **`npm run ci:lighthouse` never invokes `scripts/pick-lhci-listing.mjs`** despite that file's
  comment claiming it does; there is no `preci:lighthouse` hook. The hardcoded fallback listing
  currently resolves, so it has not bitten.
- **A sign-in modal auto-opens on page load** on `/team` and listing detail. Outside WCAG2AA so
  pa11y did not flag it; its focus management is unexamined.
- **`includeWarnings: false`** in `.pa11yci.json` suppresses every WCAG warning-level notice.
  Nobody has looked at what is in that set.
- **`ci:css-layers`'s baseline is keyed by `path:line selector`, so it is line-drift fragile.**
  Adding a comment above an existing offender shifts its line number and the ratchet reports it
  as a NEW violation. That happened here: the `.topbar` scrim comment shifted 10 identical
  pre-existing rules by 2 lines and failed the push, with the offender count unchanged at 11.
  Regenerating was correct (diff is line numbers only, same selectors, same count) but every
  future edit above line 76 of `kb.css` pays the same tax. G56 already solved this class with
  per-file counts described as "line-drift-proof"; this baseline should adopt the same keying.

# Superseded — 2026-08-02 (Claude Code, cloud session)

| Field | Value |
|---|---|
| Surface | Claude Code on the web (remote container) |
| Branch | `claude/ryan-realty-website-audit-sybjq3` @ `57907d7`, 17 commits, pushed |
| PR | [#28](https://github.com/RyanRealty/RyanRealty/pull/28) — **draft, not merged** |
| CI | `lint-and-build` **green** — first green PR check in this repo in ~3 months |
| Base | branched from `main` @ `db53778` |

**To pick this up locally:**

```bash
git fetch origin claude/ryan-realty-website-audit-sybjq3
git checkout claude/ryan-realty-website-audit-sybjq3
npm ci
```

Read `docs/audits/WEBSITE_AUDIT_2026-08-02.md` (the audit) and
`docs/audits/AUDIT_REMEDIATION_PROGRESS.md` (what was fixed, what was deliberately not, and
why). Those two files are the durable record; this section is the summary.

## Shipped this session

| Item | Commit | Evidence |
|---|---|---|
| **Independent website audit** | `8b981a9` | Full report. Core finding: ryan-realty.com appears in **0 of 4** high-intent non-brand queries while 8 competitors with slower, less structured sites occupy every slot. Technically the site is ahead of all of them (TTFB 0.25–0.64s vs 2.0–2.4s; 2 JSON-LD blocks vs 0–1). The gap is distribution, not engineering. Three premises in the original brief were tested and disproven (the site is SSR, not CSR; the brief's URL list was stale; NAP is consistent) |
| **Sitemap P0** | `fbf512e` | 3 of 5 child sitemaps returned HTTP 000 / 0 bytes after 100s, reproduced 4×. `unstable_cache` keys per class, so a cold cache meant 5 independent `buildAllUrls` fan-outs contending on the same tables. Fixed with `maxDuration`, an in-flight promise collapsing them to one build, and an hourly cron warmer. **NOT yet verified in production — needs the merge** |
| **Broker canonicals P0** | `fbf512e` | 5+ alias URLs per broker, each self-canonicalising. `generateMetadata` built the canonical from the requested slug; the page body had the same bug feeding JSON-LD |
| **Titles / descriptions / redirects / preconnect / AggregateRating** | `fbf512e` | Descriptions were hard-cut mid-word at 155 chars (`/sell` ended "Request a fr"). `/buyers` 404'd while `/sellers` redirected. Self-serving `AggregateRating` dropped, `Review` nodes kept |
| **Punctuation rule actually enforced** | `e7580a8` `bb9fd37` | `VOCAB.PUNCTUATION` was exported and referenced **zero times** by the gate. CLAUDE.md §6 listed it as gated; nothing checked it. That is how an em dash reached the layout title template and shipped on all 20 page titles |
| **Dash rule scoped to prose** (Matt, 2 corrections) | `c2b9a5e` `ae19c3f` `6bf30b1` | "Em dashes are fine in page titles for SEO", then "the rule only applies to text users read that might seem AI-written". Now: 8+ words with a 4+ word clause after the dash that **starts lowercase** (a continuing sentence is the tell; a capitalised or numeric start is a separator). Exempt: SEO metadata, short labels, alt/aria, ranges, reviews, debug, embedded CSS/JS |
| **CI unblocked** | `7cd86a5` `b326fd3` `6fe2668` `a2e60d0` `45552a0` `57907d7` | Five independently broken things, each hidden behind the one before it. See below |

## The CI story — five layers, none caused by this work

`lint-and-build` had failed on **every** pull request since at least 2026-07-25 (verified on
unrelated branches). `main` looked green only because the route-smoke step is gated on
`github.event_name == 'pull_request'` and never runs on push.

1. **`start-server-and-test` hung 5:02 with no diagnostics** — its entire failure output was
   "Timed out waiting for". Replaced with explicit start / wait / smoke;
   `scripts/wait-for-server.mjs` reports what it saw on each probe. The app was never the
   cause: a production build serves `/` in 0.55s and passes 277/277 routes.
2. **The route-inventory generator threw on every run** — it regexes `lib/cities.ts` for a
   `PRIMARY_CITIES` literal, which now only re-exports from `lib/data/geo/report-cities.ts`.
   So `docs/ROUTE_INVENTORY.md` was 2 weeks stale with 2 dead admin routes in it
3. **`ci:lighthouse` and `ci:a11y` never existed** as npm scripts. Both quality gates had
   never executed once. Tooling and configs were always present; only the script names were
   missing
4. **Admin pages exceeding the smoke timeout** on a cold cache. Budget now splits public (15s)
   vs admin (60s); `/admin/media/banners` is skipped and printed as `[SKIP]` every run
5. **The bundle report lacked `pull-requests: write`** — no `permissions` block, so the token
   was read-only

Two of those rounds were my own errors, recorded so nobody repeats them: a per-route timeout
that made things *worse* (274/277, down from 276/277), and a teardown step that killed the
runner (`kill -- -$PGID` — background jobs inherit the runner's process group).

## Open for Matt — what finishing needs

1. **Merge PR #28.** The sitemap P0 fix is unverified in production. Logic and gates pass, but
   `listings.xml` / `matrix.xml` returning real XML can only be proven after the merge. Highest
   value item still unconfirmed — it is what makes listing pages discoverable.
2. **Credentials the cloud container did not have:**
   - `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — needed to measure and fix
     `/admin/media/banners`, which takes **>60s on a cold cache**. That is what a broker hits,
     not just CI. The fix belongs in `listMissingBanners` / `getSubdivisionsInCity`; it was
     deliberately not attempted blind
   - **GSC + GA4** — converts the audit's proxy metrics (indexation, backlinks, traffic,
     CWV field data) to measured, and is how the roadmap gets proven
3. **Three decisions:** flip Lighthouse + pa11y to blocking? Investigate pa11y's
   **`0/8 URLs passed`** on its first real run? Restore `/faq`'s double em dash or leave it?
4. **Go-ahead on audit items 9–11** — dated citable market pages, answer-shaped H2s, long-form
   editorial for the 14 Bend neighborhoods + 14 resort communities. This is the work that
   actually moves LLM discoverability. Items 17–20 (press outreach) and 19 (GBP/Zillow/Yelp
   OAuth) need per-action approval under §1 regardless

## Known gaps

- **pa11y reports `0/8 URLs passed`** — real WCAG2AA signal or untuned config, unread. Surfaces
  as a step success only because it is `continue-on-error`
- **Lighthouse ran to completion but its thresholds are unvalidated.** Non-blocking, so a
  threshold failure would look like success in the step list
- **`/admin/media/banners` >60s cold**, skipped in the smoke rather than fixed
- **Audit items 9–21 untouched.** Content and authority programs, not coding tasks. Reasoning
  per item is in `AUDIT_REMEDIATION_PROGRESS.md`
- The regenerated route inventory drops 5 live-but-catch-all routes (`/cities/tumalo`,
  `/cities/crooked-river-ranch`, `/housing-market/explore`, `/reports/explore`, `/guides`) from
  the smoke set. None has its own `page.tsx`. Widening the generator's slug sources would
  change what the inventory means — left as Matt's call


# Current — 2026-07-30 (Claude Code)

| Field | Value |
|---|---|
| Surface | Claude Code |
| `main` @ | `1e647e67` pushed, 190 gates green, 340 test files / 4257 tests passing |
| Prior plan | [`PROSPECT_TO_CMA_AND_SITE_IA_2026-07-28.md`](PROSPECT_TO_CMA_AND_SITE_IA_2026-07-28.md) — the 18 Brain Dump 2 items, all closed |

## Shipped this session

| Item | Commit | Evidence |
|---|---|---|
| **Zoning, development, rental, income sections** | `9f061b0b` | Every CMA/audit/BPO now answers: what zone the property is in, whether the lot can be subdivided, whether additional units or an ADU are allowed, what a buyer could develop, HOA and CC&Rs, and long-/mid-/short-term rental rules with income potential. Five legally wrong facts were corrected during the build, including the Deschutes WA overlay (40/160/320 acres, independently verified) which would otherwise have told a seller a 160-acre parcel supports 4 divisions when it supports 1 or zero. |
| **Report rebuild + truncation fix** | `9f061b0b` | `.page` was fixed at 11in with `overflow:hidden`, so any section taller than a page was silently cut — the rental page measured 196% of its page. Long sections now chunk ("Renting It Out 1 of 3"). 922 Ogden renders 29 sections / 237,313 bytes. |
| **Published CMA on listing pages** | `618754b8` | Broker-operated publish control on the review page. Three states; the confirm dialog splits what becomes public from what stays private. **The recommended list price and every sold comp stay private.** Verified as matt@ against the real DB: publish → listing page renders the range with the ODS §7-3 period notice → take-down removes it and kills outstanding download tokens. Left `published_now = 0`. |
| **Comps must match product type** | `83a50f89` `6354d87f` | `PropertyType='A'` is the SFR convention but it is a *bucket*. Measured on 1,000 closed Bend sales: 818 Single Family Residence, 75 Townhouse, 43 Manufactured On Land, 22 Condominium, 3 Tenancy in Common. **14.3% of the pool offered to a detached subject was a different product and the selector took it.** On 922 Ogden that put two townhomes into a 4-comp detached analysis behind a $640,000 recommendation the auditor called indefensible. Now a hard exclusion at every tier, fail-open on unknown, locked by tests. |
| **A degraded read must not publish a zero** | `1e647e67` | `/cities/bend/southeast-bend` showed "0 homes for sale" beside a real $810,000 median. Operator precedence: `??` binds looser than `>`, so `pulse?.activeCount ?? pins.length > 0 ? … : …` made the pulse count a truthiness test and the answer was always `pins.length`. **Six more pages had the same class**, including `/zip` fabricating the 0 inside the Dataset JSON-LD Google reads. `withTimeoutFallbackResult` now returns `{ value, ok }`; counts are `number \| null`; consumers suppress rather than print 0. Gated by `ci:count-degraded-read` (AST). |

## The CMA corpus, as of now

227 documents. **22 archived** (17 were `zztest`/`zz-test` residue from integration tests writing to production — 5 of them sat in `delivered` status and were inflating the delivered count). **205 live.**

- **178 rebuilt successfully** on the new pricing, comp ladder, and section set.
- **23 could not be priced**: 18 lacked 3 qualifying comps, 5 have no matching MLS row. No exceptions, no bugs — these are honest data limits. Verified that product type is *not* the binding constraint (one failing subject had 84 same-product candidates citywide); the binding constraints are the market-area and lot-character rules that predate this session.
- **7 deliberately untouched** — 5 `finalized`, 2 `delivered`. Rebuilding a document a client already has would silently reprice it.
- Judge spend for the whole rebuild: **$4.06** over 178 builds.

## Open for Matt — one real decision

**164 of 198 rebuilt documents (83%) carry `needs_review`.** The adversarial auditor is doing its job, but at that rate the flag does not discriminate, and because `needs_review` blocks publishing, only ~17% of documents can feed the listing-page funnel.

The findings cluster as: narrative mismatch 90%, price unsupported 63%, condition/quality tier 51%, location/subdivision 41%, product type 13% (down from the pre-fix state), too few comps 7%. **53% of flagged documents sit at exactly 3 comps**, the bare minimum — with three comps, one questionable comp makes the price unsupportable.

Findings already carry `[critical]` / `[major]` / `[minor]` severity, but the publish gate is binary on the verdict. **A severity-aware gate — block on `critical`, flag `major`, ignore `minor` — would be the obvious fix.** It was deliberately NOT applied unilaterally: loosening what goes public under a principal broker's license is Matt's call, and the strict default blocks nothing that matters while it waits.

## Known gaps

- The comp trace is not persisted into `build_summary`, so tier-by-tier exclusion counts cannot be audited after a build. Add it before the next comp-logic change.
- Integration tests still write to production (`zztest` rows). Archiving is a cleanup, not a fix — the tests need their own teardown or a non-production target.
- Three page files (neighborhood 598, city 695, community 1029 lines) sit exactly at their file-size ceilings. The next addition needs a real extraction, not comment trimming.
