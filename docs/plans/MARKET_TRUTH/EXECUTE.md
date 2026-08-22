# Market Truth — execution brief

**This is the single entry point. Point one agent at this file and it runs the whole job.**

**Read `DECISIONS.md` first.** It is newer than every other file here and it *overrides* them.
It closes both questions `SPEC.md` §7 still lists as open, and it corrects a load-bearing era claim
in `SPEC.md` about which years have unrecoverable on-market spans.

Two phases, in order, without stopping to ask:

**Phase A — audit (always first).** Execute `AUDIT.md` in full. Produce `AUDIT-FINDINGS.md`, commit
it, push it. You are auditing another agent's work adversarially; the brief explains why that is
warranted and where to look. **Do not build during Phase A.**

**Phase B — build.** Begin only when `AUDIT-FINDINGS.md` exists and every finding marked **blocker**
is resolved — either fixed in the package files, or explicitly waived in writing by Matt. Then work
`§4` top to bottom from the first unchecked box.

If Phase A returns a verdict of **"no — not safe to build from"**, stop at the end of Phase A, report
to Matt, and do not start Phase B.

Do not re-plan; the plan is settled. Do not re-litigate the definitions; Matt locked them
(SPEC §0, D1–D12). Everything else is open to the audit.

**Phase A status (2026-08-22):** `AUDIT-FINDINGS.md` is on `origin/main` (`fba6435d`). Verdict:
safe to build from after the listed blocker fixes. Those fixes are in `DDL.sql` / `REGISTRY.md` /
this file / `SPEC.md` §7 / `DECISIONS.md` as of the Phase B package patch. Do not re-run the audit
unless the findings file is missing.

**Read order:** `CLAUDE.md` §0 + §7 → `docs/DATA_COVERAGE_INDEX.md` → `SPEC.md` (all of it) →
`REGISTRY.md` (the predicates you will implement) → `DDL.sql` → `AUDIT-FINDINGS.md` → this file →
`PLAN.md` only if you want the background story.

---

## 1. The one-paragraph brief

Ryan Realty publishes market statistics from **9 independent computation engines** producing **38
distinct stats**, with no stat owned by any single layer. The same label resolves to different
numbers depending on which page a client opens — "days on market" is four different measurements on
Bend today (25, 58, 62, 64); "months of supply" says seller's market on the site and balanced in the
admin builder. Your job is to replace all of it with **one fact layer, one membership rule, one
metric registry, one read function, and gates that make the old way impossible** — without moving a
single published number until the reconciliation has been shown to Matt.

Matt is a licensed Oregon principal broker. A wrong published stat is a compliance risk, not a bug.
`CLAUDE.md` §0 outranks everything in this file.

---

## 2. Non-negotiables

1. **Verify before you assert.** Two claims in the original forensics were wrong and were caught only
   because someone re-derived them (SPEC §1.7, §1.1). If you cannot reproduce a number with your own
   query, do not build on it. A null result is a fact about your query first — run a second,
   differently-shaped check before concluding something does not exist.
2. **Nothing public changes** until step 5. Build alongside the existing writers, never in place of
   them, until a reconciliation report has been reviewed.
3. **Every figure carries provenance** — rows counted, method, window actually used, computed_at,
   confidence. A figure without a trace does not ship.
4. **`-- audit: <reason>`** prefixes any raw SQL against a DAL-guarded table.
5. **Mixed-case columns are double-quoted in raw SQL** (`"ClosePrice"`, `"CloseDate"`, `"City"`,
   `"StandardStatus"`, `"OnMarketDate"`) and bare in supabase-js. Getting this wrong returns nothing
   silently.
6. **Work on `main`.** Commit and push each step. Use a clean worktree if the main checkout has
   another session's uncommitted work (see §6).
7. **Never use `--no-verify`.** If a hook fails on someone else's work, use a clean worktree.

---

## 3. What you are building

```
listings (+ listing_history)          ← raw, untouched
        │
        ├─► market_fact_sale           one row per closed sale, cleaned, scoped, stamped
        ├─► market_fact_listing_span   one row per on-market episode (from listing_history)
        │
        ├─► place_membership           one row per (listing, place) — listed AND sold alike
        │
        ├─► metric registry (code)     each stat declared once: formula, population, min_n,
        │                              grains, earliest_year, window policy, exclusions
        │
        ├─► compute job                evaluates registry per (geo × segment × window × metric)
        │                              writes value + provenance + publishable + reason
        │
        └─► getMetric()                the ONLY read path for every consumer
```

Full detail in `SPEC.md` §3. Do not invent an alternative architecture.

---

## 4. Steps

Work top to bottom. Tick a box only when its **Done when** clause is literally true.

### Step 0 — apply `DDL.sql`

- [x] Apply the schema after the audit's blockers are cleared. It has never been run
      (`AUDIT.md` §2.2) — expect to fix it, and record what you changed.

**Done when:** all five objects exist and the `place_membership` one-primary index holds against a
backfill dry run.

Applied 2026-08-22 as `supabase/migrations/20260822230000_market_truth_foundation.sql` on hosted
`dwvlophlbvvygjfxcrhm`. Five tables + `market_in_service_area()` (STABLE, 16 cities). RLS on, anon
revoked. Dry-run: 27,018 current-primary subdivision rows for 2021+ service-area closed geocoded
sales (matches the 27,018 in-any-subdivision count); unique index held (27,018 listings = 27,018
current primaries). Changes from the un-applied draft: 16-city seed not 18; `exclusion_reasons
text[]`; `complete_through` on the sale fact; `definition_id` in `market_metric` PK; one-current-
primary unique; date-only span CHECK; RLS/`REVOKE`.

### Step 1 — `market_fact_sale`

Generalise `sale_pricing_facts` (already one row per closed CO residential sale, 1996+, with
normalised product/lot/story/water/sewer/HOA classes) to cover **all segments** (SPEC D7).

- [ ] Apply the mandatory exclusions of SPEC §3.4 — service-area scope, `PropertyType='G'`
      (commercial lease, median ClosePrice $2.01), fractional interests (TIC/timeshare/deeded week,
      median $/sqft $19.01), order-of-magnitude price typos, $1 auction lists, retroactive off-market
      entries, duplicate parcel+date events (~0.5–1%), `sqft <= 0` for $/sqft only.
- [ ] Record every exclusion as a **counted, queryable reason** — never a silent `WHERE`.
- [ ] Stamp `complete_through` so a half-ingested month can never be read as complete.
- [ ] Fix the refresh: a **recency lane** (last 90 days, every run) plus the slow full-history lane.
      Today the full sweep takes ~23 days and recent closes enter the corpus weeks late.

**Done when:** a query returns, per year 1997→now, the row count kept and the count excluded by each
named reason; and `complete_through` is within 48 hours.

### Step 2 — `market_fact_listing_span`

One row per on-market episode, reconstructed from `listing_history` (3.9M events, 546,300 listings).

- [ ] Emit `span_source` (`history` | `listing_row`) and `first_on_market_confidence`
      (`recovered` | `assumed`). **73.0%** of relisted listings carry history predating the current
      `OnMarketDate`, recovering a median **102 days** (SPEC §3.2). `listing_history` covers 99.5%.
- [ ] Never read `status_change_timestamp` — corrupted by bulk platform-migration stamps.
      `off_market_date` survived intact.
- [ ] Flag the 28,169 listings whose `off_market_date` precedes their on-market date, and the 150
      zombie Actives whose own payload says Expired/Cancelled/Pending/Closed.

**Done when:** reconstructing active inventory for 2026-08-10 lands within 1% of the stored snapshot,
and a per-year table shows what share of spans are `recovered` vs `assumed`.

### Step 3 — `place_membership`

- [ ] Cities resolve by **MLS city text** (SPEC D5). Sub-city places by polygon, falling back to alias.
- [ ] `is_primary` resolves multi-polygon overlap — **19.5% of sales sit inside 2+ subdivision
      polygons (max 8)**, 17.3% inside 2+ neighborhoods. Smallest containing polygon wins. Only
      primary rows may be summed.
- [ ] Cover **listed and sold alike** from the same table — this is what makes SPEC §1.4's absorption
      defect structurally impossible.
- [ ] One canonical hyphen slug alphabet. `market_stats_cache` uses `la pine`, `boundaries` uses
      `la-pine`. Note the verified scope: only **2 of 20** city slugs fail for that reason — the other
      9 misses have no `boundaries` row at all, and the alphabets are already reconciled in code by
      `lib/market/city-cache-slug.ts` under the `ci:city-cache-slug` gate.
- [ ] Stamp `method` and `confidence`. A polygon we have not checked is `unverified` (Broken Top's
      boundary measures 17.96 sq mi against Bend's 35.45).

**Done when:** a disagreement report exists comparing membership against every current attribution
path, with counts per place and per disagreement type.

### Step 4 — Registry + compute job (shadow)

- [ ] Implement **`REGISTRY.md` §3** verbatim — all 28 stats with their formula, population, `min_n`,
      grains and earliest year. The predicates are written; do not re-derive them, but DO run them
      (they have never been executed — see `AUDIT.md` §2.1).
- [ ] Vocabulary from `REGISTRY.md` §1–§2: the twelve segment predicates, the `closed` and `active`
      populations, and `market_service_area` (a **city list**, not a county filter — county is
      unusable, see `DDL.sql`).
- [ ] Sample floors and window ladder per `REGISTRY.md` §2.3 — but treat them as **proposals the
      audit may move** (`AUDIT.md` §2.4).
- [ ] Days on market = `purchase_contract_date − OnMarketDate`, named `days_to_contract` (D2),
      earliest **2006**. Note `market_stats_cache.median_dom` is ALREADY the correct list-to-pending
      basis — the defect is the raw `"DaysOnMarket"` column and the video and beacon paths.
- [ ] Write to a **shadow store**. Nothing repointed.

**Done when:** a reconciliation report lists every live figure beside its shadow value, the delta, and
a one-line reason for each difference — defect found, or definition changed.

### Step 5 — Migrate consumers (Matt reviews the delta report first)

- [ ] **`/sell` is migration #1** — live 2026-08-22: **"a seller's market · 488 homes · 3.5 months"**
      from the city-limits polygon (pulse 488 / 3.54). MLS-city **detached** (D1) is **775 homes /
      4.42 months / balanced**. The 988 / 4.52 figure is the mixed `PropertyType='A'` bucket and
      was marked `[was wrong]` in SPEC — do not migrate to it (AUDIT B3).
- [ ] Then CMA and BPO — the subdivision speed statistic there can never render today
      (`lib/cma/subdivision-story.ts` reads the empty `CumulativeDaysOnMarket`), and the CMA computes
      market-area chapters over the whole A bucket while the cache figures beside them are SFR-only.
- [ ] Then place pages, market hub, newsletter, video producers, JSON feeds, admin.
- [ ] Each surface proves reconciliation before it flips.

**Done when:** `/sell` reads `getMetric` for active count, months of supply, and verdict; the three
figures match the shadow recon report Matt reviewed; JSON-LD / `/data/market` for Bend still agree
with the page. Other surfaces remain on the old store until their own recon line exists.

### Step 6 — Gates (baseline may only shrink)

- [ ] No writer computes geography inline.
- [ ] No consumer reads a market store directly.
- [ ] Every rendered figure carries provenance.
- [ ] Mixed-method membership ⇒ non-publishable (retires `lib/market/geo-grain-trust.ts`).
- [ ] `min_n` and window policy live only in the registry.
- [ ] Dead-column gate: `CumulativeDaysOnMarket`, consumer-surface `"DaysOnMarket"`, and any
      `mls_source = 'central_oregon'` filter (it is a constant on 100% of rows, including all 93,233
      Jackson County ones).
- [ ] **Freshness gate** — a metric whose `complete_through` is older than its window fails rather
      than serving stale data. This is the gate that would have caught the dead cube cron and the
      boundary job that stopped on 2026-04-30.

**Done when:** each gate has a failing fixture in `scripts/` (or `ci:*`) and a counted allowlist
that may only shrink. Gate 2's baseline is the frozen inventory of direct cache/pulse reads.

### Step 7 — Repairs folded in (not hotfixes, per SPEC D8)

- [ ] Restart boundary assignment (4.3% coverage on Actives since 2026-05-01).
- [ ] Restart the analytics cube cron (has never run; calendar 2026 has 0 rows).
- [ ] Normalise `buyer_financing` (April-2026 format break, 26 `[object Object]` rows).
- [ ] `close_price_per_sqft = 0` → NULL on 65,577 rows.
- [ ] Quarantine the 883 structurally bare rows and 150 zombie Actives.
- [ ] Retire the two permanent-zero geographies; unify the slug alphabet.
- [ ] Correct `lib/property-type.ts`: **E = Farm** (not commercial), **G = commercial Lease**.
- [ ] Instrument listing/place views through `user_events`; drop the empty `listing_views` table.

**Done when:** each repair has a counted before/after query in the commit, and 883 structurally
bare is either found and quarantined or struck from the list (AUDIT: unverified).

### Step 8 — Canon corrections

- [ ] `CLAUDE.md` §0 — "SFR convention is `PropertyType='A'`" is wrong per D1. Restate.
- [ ] `CLAUDE.md` §7 — remove `CumulativeDaysOnMarket` from the quoted-column list; add the
      `"DaysOnMarket"` warning.
- [ ] `docs/DATABASE_FOR_AI_AGENTS.md` — mark CDOM dead, `mls_source` a constant, `listings` a
      two-market table.

**Done when:** `rg CumulativeDaysOnMarket CLAUDE.md` is empty; `"DaysOnMarket"` warning is in §7;
`DATABASE_FOR_AI_AGENTS.md` states CDOM dead, `mls_source` constant, two-market table. (SFR
restatement in CLAUDE.md §0 is already on `origin/main` as of `526dac93`.)

### Step 9 — Then, and only then, the moat

- [ ] Granular surfaces: every segment × every grain, sample-gated.
- [ ] Leaderboards as registry queries: best performing (YoY median), most expensive, biggest movers,
      fastest to contract, most price cuts, most new inventory.
- [ ] Agent/office share — **internal only** (Matt, 2026-08-22): admin and listing presentations, not
      the public site. Resolve `office_id` first; every row is currently unresolved and the MLS
      placeholder "No Office" ranks as a brokerage.

**Done when:** leaderboards are registry queries with `min_n` inherited; office share is behind
admin auth; `office_id` is populated or "No Office" is suppressed; no public surface lists a
brokerage rank.

---

## 5. Definition of done for the whole program

- One read path. `getMetric()` is the only way any surface obtains a market figure.
- Every published figure traces to rows, method and window.
- The same question asked twice, anywhere in the estate, returns the same number.
- A new metric is a registry entry, and it is correct on arrival because it inherits membership,
  windows, floors and provenance.
- The gates make the old way fail the build.

---

## 6. Practical notes

- The main checkout often carries another session's uncommitted work. If a pre-commit hook fails on
  files you did not touch, create a clean worktree off `origin/main`, do the work there, commit
  (hooks run clean), `npm run push`, then `git push origin HEAD:main` and remove the worktree.
- `npm run push` runs gates + lint + stamps a marker before the SSH push. If it fails on
  `ci:process-canon`, someone landed unregistered plan docs — register them in
  `docs/DEVELOPMENT_PROCESS.md` "Registered plan documents" rather than bypassing.
- Supabase project id: `dwvlophlbvvygjfxcrhm`.
- Do not query `information_schema` — read `docs/DATABASE_SCHEMA_SNAPSHOT.md`.
- Post progress by ticking boxes in this file and committing it. This file is the live board.
