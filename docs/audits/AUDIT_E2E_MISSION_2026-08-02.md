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
