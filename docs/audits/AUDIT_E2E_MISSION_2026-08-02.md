# Audit follow-through — end-to-end mission (local session)

**Picks up:** `docs/plans/CROSS_AGENT_HANDOFF.md` → "Open for Matt", written by the cloud
session on branch `claude/ryan-realty-website-audit-sybjq3` (PR #28).
**Started:** 2026-08-02, local Claude Code session.
**Working tree:** `.claude/worktrees/audit-e2e` — a git worktree, deliberately. `main`'s tree
has a *live* sibling session with 53 uncommitted paths (two files touched 2 minutes before this
session opened). Stashing or checking out there would have destroyed work in flight.

## The goal

Every item on the cloud session's "Open for Matt" list is either **closed with evidence** or
**named as genuinely needing Matt**, with the reason. No item is left in the ambiguous middle
where nobody knows whether it is done.

**What exists when finished**

1. `/admin/media/banners` loads inside the 15s public smoke budget on a cold cache, and is back
   in the smoke set rather than skipped.
2. The audit's proxy metrics are **measured**: indexed-page counts per class, real traffic,
   real Core Web Vitals field data. Audit item 21 closed.
3. `pa11y`'s `0/8 URLs passed` is resolved to a named cause, and every real WCAG2AA defect it
   found is fixed.
4. Lighthouse thresholds are validated against a real run instead of assumed.
5. PR #28 is merged and the sitemap P0 is **confirmed in production** — `listings.xml` and
   `matrix.xml` returning real XML is the whole point of the branch and is still unproven.

**What a real user does with it:** a broker opens `/admin/media/banners` and it renders. A
crawler fetches every child sitemap and gets a complete URL list. A screen-reader user works
the audited pages without hitting a WCAG2AA blocker.

**The bar:** live HTTP against production for site behaviour, a real build or real API response
for everything else. Not "the diff looks right", and not "the gate is green" — the cloud session
already proved a green gate can mean a step that never ran.

## Why these items and not audit items 9–11

Items 9–11 (dated citable market pages, answer-shaped H2s, 28 long-form neighborhood articles)
are the highest-LLM-impact work in the audit, and they are **explicitly waiting on Matt's
go-ahead** in the handoff. They are also content programs: every figure needs a §0 verification
trace and lands on a public marketing surface under a principal broker's license. Starting them
unasked would be scope invention. They stay open, and the closing summary says so.

## Workers — disjoint file sets

| # | Worker | Exclusive files | Needs |
|---|---|---|---|
| 1 | Banners cold-load | `app/admin/(protected)/media/banners/**`, `app/actions/banners.ts`, `lib/data/**` banner reads | Supabase service role |
| 2 | pa11y `0/8` | `.pa11yci.json`, a11y fixes in flagged components | Production server |
| 3 | Lighthouse thresholds | `lighthouserc.cjs` | Production server |
| — | GSC + GA4 (item 21) | `docs/audits/**`, measurement scripts | Google service account |

## Progress log

| Time | Event |
|---|---|
| 15:44 | Sibling session detected live on `main`. Worktree created instead of checkout |
| 15:50 | Goal written. `npm ci` + production build started (the long pole) |
| 15:58 | **GSC + GA4 authenticated** (`siteOwner`). Audit item 21 unblocked |
| 16:05 | **Sitemap P0 impact corrected.** Google has downloaded all five children, including 7,660 listing URLs on 2026-08-01. The defect is real and worse than recorded (`core.xml` 115s, four children dead at 120s), but "listing pages are absent from Google's discovery" is false |
| 16:12 | Production build **succeeded on real credentials** — the cloud session could only build on dummies |
| 16:15 | **Three-month CI failure root-caused.** `middleware.ts` `BAD_BOT_RE` matches `axios`; `wait-on` is axios-based; every readiness probe got 403; `wait-on` accepts only 2xx, so it timed out with no diagnostic. The app was never the cause |
| 16:28 | Gate **G60** `ci:probe-ua` written. Immediately found **12 more** CI probes depending on the same accident. Delegated the mechanical fix |
| 16:40 | `docs/audits/MEASURED_METRICS_2026-08-02.md` + `scripts/measure-search-and-analytics.mjs`. Every figure reproduces from the script. Item 21 closed except CWV field data (API not enabled) |
| 16:45 | **Banners fixed.** `getSubdivisionsInCity` fetched every historical row per city (277,415 rows, 284 round-trips, 38.2s) then filtered in JS. Pre-filtered server-side: 3,344 rows, 14 round-trips, **271–510ms**, output byte-identical across all 13 cities |
| 16:50 | **The sitemap P0 fix did not work.** `core.xml` served locally in 234.7s; `geo.xml` requested straight after still died at 280s. Cause: the shared-universe memo stamped freshness at build START with a 60s TTL against a 115–235s build, so it expired before it ever resolved. Verified against 5 concurrent requests, which is not how crawlers or the warmer fetch |
| 17:05 | Memo extracted to `lib/sitemap-universe-memo.ts`, stamped on RESOLVE, 6 regression tests. Negative-tested: reintroducing the original stamp fails exactly one test |
| 17:20 | **§0 defect found off-mission and fixed.** `get_subdivision_status_counts` counts `'%coming soon%'` as active, and the public "Hot communities" cards render it as the for-sale count. Bend: 1,288 shown vs 1,272 correct, 16 pre-marketing listings on a public surface. Migration written |

---

# Phase 2 — items 1–4 (2026-08-02, evening, /endtoend)

Matt: "Yes on 1-3 and do number 4." This phase's goal, written before the work:

## What exists when finished

1. **Coming Soon migration applied to production** and verified live: the Bend
   "Hot communities" for-sale total equals the count of status-exactly-Active
   rows (1,272-class, not 1,288-class). §0 closed end to end, not just committed.
2. **CrUX / PageSpeed Insights callable**: the API enabled on the `ryanrealty`
   GCP project, a working key stored, `scripts/measure-search-and-analytics.mjs`
   returning a real CWV answer — including the honest one ("insufficient field
   data") if 256 sessions/28d is below Chrome's sample floor.
3. **Quality gates blocking where safe**: pa11y fully blocking; Lighthouse step
   blocking with accessibility/SEO/CLS/best-practices at error level and
   performance/LCP at warn (watch 2-3 real PR runs before promoting, per the
   calibration session).
4. **Audit items 9–11 built**:
   - Every geography market surface shows a visible "Data updated <date>" from
     the pulse row's real refresh stamp (item 9's timestamp half; formula +
     source already render inline via KbMarketHud/KbTimeframeStats).
   - The market section heading on every geography page is answer-shaped —
     "Is <geo> a buyer's or seller's market?" — with the verdict and number in
     the first line beneath (item 10), in the display face per the heading gate.
   - All 13 Bend neighborhoods + 14 content-configured resort communities carry
     long-form editorial (multi-section, question-shaped H2s, 600+ words) in
     their content configs, rendered by the existing KbResortOverview path.
     **No market figures in static prose** — live components own every number;
     durable facts only, each piece carrying a sources list. Enforced by a gate,
     not a promise: the brand-voice scan extends to the editorial JSON, and a
     new check refuses $-figures/percentages in editorial sections and requires
     non-empty sources beside them.

## What a real user does with it

A buyer searching "is Bend a buyer's market 2026" lands on a page whose H2 is
that question with the answer in the first sentence. An LLM grounding a Central
Oregon answer finds a dated, sourced, formula-stated stats block it can cite. A
reader on /cities/bend/awbrey-butte gets a real essay about the neighborhood,
not 200 words of filler. Nobody anywhere sees a pre-marketing listing counted
or a formula the data does not use.

## The bar

Live production verification for the migration; a real API response for CrUX;
rendered HTML checked for the H2s/timestamps; every content piece passing the
mechanical gates plus a §0 trace; full ci:gates + build green; pushed on main.

## Out of scope, named

The sitemap build-cost root cause (104.7s RPC — needs the listing_tile_mv
re-source, its own pass). The sibling session's three TOAST migrations (heavy
MV rebuilds with their own apply plan). Audit items 12–21 beyond the above.

## Phase 2 progress

| Time | Event |
|---|---|
| 19:05 | **§0 formula fixed.** `CityComparisonTable` footnoted a 30-day-doubling MoS method beside a 6-month-formula number, on every subdivision market page. Now renders `MOS_METHODOLOGY_CLAUSE`; `ci:market-formula` scans `components/` as of this commit (it had only scanned `app/` + `lib/`, which is how the exact string its own docblock names got shipped) |
| 19:20 | **Item 1 done, verified live.** Migration applied to production. Bend Hot-communities for-sale sum **1,266 → 1,251**, exactly the 15 Coming Soon rows removed, and the new sum equals an independently computed corrected predicate (1,251 = 1,251) |
| 19:35 | **Item 3 done.** Lighthouse + pa11y drop `continue-on-error`. A11y/SEO/CLS/BP assert at error; perf/LCP at warn until real runner samples validate the estimated CI headroom. Proves out on the next PR, not this push |
| 20:10 | **Item 2 done.** CrUX + PSI APIs enabled on the `ryanrealty` GCP project (service account got 403 on serviceusage; done via console under matt@). Key restricted to those two APIs. **CWV measured:** CLS 0.00 good, TTFB 292 ms good, LCP 2,692 ms needs work — **1,239 ms of it is image resource load DELAY**, 46% of the whole metric, before the hero request even starts |

### Item 2's trap, recorded

PageSpeed Insights reported "no field data for this origin" while the CrUX API
returned a full histogram for the same origin in the same minute. PSI's
`loadingExperience` is URL-scoped and falls back inconsistently. Trusting PSI
would have written "insufficient sample size" into the record as the answer, and
it was wrong. The script queries CrUX directly.

---

# Phase 3 — every remaining roadmap item (2026-08-03)

Matt: "I told you to work /endtoend on all of these items, no stopping."

Nine items open at phase-3 start: 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, plus the
sitemap root cause carried from phase 1. Item 21 closed in phase 2.

## What exists when finished

| # | Done means |
|---|---|
| **sitemap** | `buildAllUrls` no longer calls `get_subdivision_status_counts` per city (104.7s for 8 cities). Subdivision slugs come from `listing_tile_mv`, which is indexed. All five children serve **in production**, not just locally |
| **11** | 13 Bend neighborhoods + 14 resort communities carry long-form editorial. No market figures in static prose (live components own every number); durable facts only; sources listed. Gated, not promised |
| **12** | `/data/<geo>.json` per geography: the published figures, the formula, the period, the source, `Content-Type: application/json`, linked from the page it describes |
| **13** | Every `/housing-market/*` surface emits `Dataset`. Measured coverage, not assumed |
| **14** | Outbound citations to OHCS / Census / BLS / FRED / ORMLS on the market surfaces, from a shared component so they cannot drift |
| **15** | `/faq` emits `FAQPage` JSON-LD (it emits none today), and its answers exist as standalone indexable pages |
| **16** | `/homes-for-sale` under 1 MB and **ratcheted** so it cannot silently regrow. It drifted 996 KB → 1,019,774 bytes with nobody watching |
| **17** | The weekly market report exists as a press-citable artifact with a drafted pitch. **NOT SENT** — §1 class 1, Matt's approval per send |
| **18** | "Months of supply in Central Oregon" is a defined term with its own citable URL |
| **19** | NAP/profile audit done and a correction packet prepared. **NO OAuth grant performed** — §1 class 4 |
| **20** | An annual Central Oregon market review, published, linkable, every figure §0-traced |

## The bar

Every number traced live (§0). Brand voice clean. Gates green. Rendered HTML
checked for what the item claims. Production-verified where production is the
claim. Pushed on main.

## Approval boundary, stated up front

17 and 19 get built to the edge and stop there. An outbound press pitch and an
OAuth grant are §1 per-action classes; canon outranks this protocol. The
deliverable is the artifact plus the draft, not the send.
