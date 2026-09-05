# PAGE PLAN — what belongs on a page, and how we know it beats the field

`PUBLIC_UI.md` says how a section LOOKS. `TASTE.md` says whether it is beautiful.
This file says **which sections a page carries, what questions it must answer, and
which real page it has to beat.** It is the layer that was missing, and its absence
is why the site still reads as 112 one-off decisions.

**Read order:** `CLAUDE.md` §0/§2 → `PUBLIC_UI.md` (the look) → this file (the plan) →
`TASTE.md` (the judgment).

---

## 1. Why this exists

On 2026-09-05 the site had **25 page plans for 112 public routes.** The other 87
routes had no stated objective, no section order, no competitive target — and every
gate was green.

That is not an oversight in any one gate. It is the shape of all of them. Every gate
that reads a page plan starts the same way:

```js
const contracts = readdirSync(join(ROOT, KITS), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => `${KITS}/${e.name}/parity.json`)
  .filter((rel) => existsSync(join(ROOT, rel)))
```

`ci:page-purpose`, `ci:mockup-parity`, `ci:mockup-coverage` and `ci:taste-canon` all
enumerate **the contracts that exist**. None enumerates the routes that should have
one. A public page shipped with no plan is not failing these gates; it is invisible
to them. So the plan was mandatory on the 22% of the site that already had one, and
optional on the 78% that did not — which is exactly backwards from how a standard
spreads.

**The fix is not another document. It is making the route the unit of enforcement
instead of the contract.** `ci:page-plan` walks `app/**/page.tsx` and asks each route
for its plan.

## 2. The class is the unit of design, not the page

Matt, 2026-09-05: *"If I'm on a page about my brokerage, we should have a plan for
what should be on that page and how it should be laid out."*

The trap in that sentence is the word "that." Writing a plan for *that* page, 112
times, produces 112 plans that disagree — which is the inconsistency, not the cure.
`TASTE.md` already names the rule: **design the CLASS, not the instance.**

So every public route declares a `pageClass`, and the class owns the spine: the
objective, the required sections, the schema types, the internal-link duties. A route
may **add** to its class spine. It may not drop a required section without an
explicit, dated waiver in its own contract. Two pages in one class that answer the
same question do it with the same primitive, in the same slot, in the same order.

**The eleven classes**, derived from the five jobs in `PRODUCT.md` and the grain table
in `PUBLIC_UI.md` §3 — the closed list lives in `data/page-classes.json`:

| Class | The visitor's job | Opens on | Benchmark required |
|---|---|---|---|
| `home` | Orient, then route to a job | Field | yes |
| `inventory` | Find a home | Field (Ledger register on search) | yes |
| `listing` | Decide on this house | Stage | yes |
| `place` | Evaluate this place | per grain (`PUBLIC_UI.md` §3) | yes |
| `market` | Understand the market | Instrument | yes |
| `seller` | Get the number, decide whether to sell | Stage → Sheet | yes |
| `guide` | Understand the area around the house | varies | yes |
| `brokerage` | Decide whether to trust this shop | Quiet + Sheet | yes |
| `tool` | Compute one thing | Sheet | yes |
| `capture` | Convert a campaign click | Stage → Sheet | no — paid traffic, not organic |
| `system` | A utility, not a content page | — | no |

`system` and `capture` are the only classes exempt from the benchmark, and the
exemption is **declared in the class, never inferred from the page.** Indexability
cannot be read out of the source: `app/blog/[slug]/page.tsx` and `app/blog/page.tsx`
both contain `robots: { index: false }`, and in both cases it is a conditional
fallback for a missing post or an empty index, not the page's posture. A gate that
grepped for `noindex` would have exempted the blog — the single content type this
repo's own audit credits with its best organic positions.

## 3. The contract schema

The contract stays where it is — `design_system/ryan-realty/ui_kits/<slug>/parity.json`
— and keeps every field it has. Four fields are added; nothing is renamed or removed.

| Field | Status | What it holds |
|---|---|---|
| `route` | existing, required | `app/**/page.tsx` this contract governs |
| `requiredComponents` | existing, required | components the route may not lose |
| `sectionOrder` | existing, required | the page's sections, in DOM order |
| `competitiveTarget` | existing, required | prose: how this page wins |
| `pageClass` | **new**, required | one of the eleven |
| `objective` | **new**, required | the visitor's job in one sentence, and the one act that completes it |
| `mustAnswer` | **new**, required | the questions a visitor arrives with, each bound to the `#section-id` that answers it |
| `benchmark` | **new**, required outside `system`/`capture` | the measured competitive claim — §4 |

`mustAnswer` is the field that makes "the correct content is not on the page" a
mechanical failure rather than a judgment call. Each entry names a question in the
visitor's words and the section id that answers it; the gate resolves the id in the
page source, so deleting the section that carried the answer fails the build. A
question with no section is the honest way to record a known gap — mark it
`"answeredBy": null` and it reports as an open gap instead of passing silently.

## 4. The benchmark — an outcome, never a rubric

**Page-grade was killed on 2026-08-16 and it is not coming back.** `PRODUCT.md`
records what it did: *"Page-grade scored pages, then deleted photography, maps, and
listing facts so a caption rule could pass."* Any scoring system an agent can satisfy
by removing content will be satisfied that way, because removing is cheaper than
building. That failure is the reason this section is shaped the way it is.

So the benchmark is not a score we award ourselves. It is **a named rival page and a
number measured outside this repo**, and it has one property that page-grade lacked:
**you cannot improve it by deleting anything.**

```json
"benchmark": {
  "measuredAt": "2026-09-05",
  "queries": ["bend oregon real estate brokerage", "ryan realty bend"],
  "rivals": [
    { "url": "https://www.cascadehassonsir.com/about", "outranksUsOn": ["bend oregon real estate brokerage"] }
  ],
  "ourPosition": { "source": "target_query_benchmark", "query": "...", "position": 14.2, "impressions": 310 },
  "wins": ["live city inventory beside the origin story; three brokers reachable in one tap"],
  "loses": ["no organization schema; rival carries 40 agent profiles as inbound link surface"],
  "nextMove": "emit RealEstateAgent JSON-LD sitewide, not only on /lp/bend"
}
```

Every figure in that block is §0-governed like any other number that leaves this shop.
The sources that exist today:

- **Our position, per URL and per query — LIVE.** `getGscScopeAggregate(scope='page')`
  in `lib/data/analytics/getGscMetrics.ts` returns `{ key, clicks, impressions, ctr,
  position }` from `marketing_channel_daily`, and `public.target_query_benchmark`
  joins the 23 seeded must-win queries in `public.target_queries` to our daily GSC
  position. Both are real Google Search Console data.
  **The one trap:** ingestion captures only the top 25 pages and top 25 queries by
  impressions per day. A page with no row is a page outside that day's sample, **not
  a page with zero impressions.** Never write "0" where the honest value is "not
  sampled" — that is the §0 absence-from-one-query-shape rule, and it applies here.
- **Rival SERP positions — NOT BUILT.** `growth-loop` files it as Phase 2 backlog;
  `competitor_intel` holds `google_serp` rows for ten fixed head queries only, and
  the `website_diff` source in that table's enum has no scraper behind it. Until it
  exists, `rivals[].outranksUsOn` is filled by a dated manual SERP check recorded in
  `measuredAt`, and `docs/competitor-intelligence-2026-05-13.md` is the worked
  example of that pass.

`wins` and `loses` are prose and are meant to be. They are the honest half — an agent
comparing our rendered page against the rival's rendered page — and they are graded by
the same separate-evaluator discipline `TASTE.md` already requires, because
self-evaluation does not work. What keeps them from becoming page-grade is that they
sit beside a number the repo did not generate, and that `loses` is a required field:
a benchmark with an empty `loses` array is not a page that has won, it is a pass that
was not run.

## 5. What binds mechanically

`ci:page-plan` (`scripts/check-page-plan.mjs`), in the `ci:gates` chain:

1. **Coverage.** Every `app/**/page.tsx` outside the authenticated tree resolves to a
   contract. Shrink-only against `scripts/page-plan-baseline.json`: the 87 uncovered
   routes are grandfathered, no route may be added, and a route leaves by earning a
   plan. **Every route created from 2026-09-05 needs a plan in its first commit.**
2. **Class.** Every contract declares a `pageClass` in the closed list.
3. **Spine.** Every section the class requires resolves in the page source, and a
   dropped one fails unless the contract carries a dated `waivers` entry naming it.
4. **Answers.** Every `mustAnswer` entry either binds to a section id that resolves in
   the page, or is explicitly `null` and reported as an open gap.
5. **Benchmark.** Outside `system` and `capture`: a `benchmark` block with a real
   `measuredAt` date, at least one query, at least one rival URL, and a non-empty
   `loses`. Staleness is reported, not failed — an old benchmark is a work item, and a
   gate that fails on the calendar teaches agents to touch the date.

Everything else in this file is prose, and prose is advisory (`CLAUDE.md` §6). If a
rule here keeps getting broken, the answer is a new check inside this gate.

## 6. The grind

`/site-consistency` (`.claude/skills/site-consistency/SKILL.md`) is the prompt that
works this down. It runs **one class at a time, never one page at a time** — that is
the whole point of §2 — and per class it writes the class spine, brings every route in
the class to it, benchmarks against the named rivals, takes a separate evaluator pass,
and ships one commit per class.

---

# Changelog

- **2026-09-05** — written after the coverage measurement (25/112) traced Matt's
  standing complaint — inconsistent pages, wrong content on the page — to gates that
  enumerate contracts instead of routes. Adds the class system, the four schema
  fields, and the outcome-shaped benchmark. The benchmark is deliberately not a
  rubric: page-grade died on 2026-08-16 for scoring pages against one, and the
  content it deleted to pass is the reason `loses` is required and `wins` is not
  scored.
