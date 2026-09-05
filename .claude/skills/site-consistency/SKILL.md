---
name: site-consistency
description: Grind the public site to one standard, ONE PAGE CLASS at a time — ground the class spine from its real pages, write the page plan for every route in the class, benchmark each against named rival URLs with live Search Console data, take a separate-agent evaluator pass, and ship one commit per class. Use when Matt says "/site-consistency", "make the site consistent", "the pages don't match", "the wrong content is on the page", "fix the brokerage pages", "what should be on this page", or when a /loop firing carries this protocol.
---

# Site consistency — one class per run, never one page

**The canon is [`design_system/public/PAGE_PLAN.md`](../../../design_system/public/PAGE_PLAN.md). Read it before anything else here.**
`PUBLIC_UI.md` owns the look, `TASTE.md` owns the judgment, `PAGE_PLAN.md` owns what
belongs on the page. This skill is the grind that closes the gap between them.

**The measurement that created this skill (2026-09-05): 25 page plans for 112 public
routes.** The other 87 shipped with no objective, no section order, no competitive
target — and every gate was green, because every gate that reads a plan enumerates
*the contracts that exist* rather than the routes that need one. `ci:page-plan` fixed
the enforcement. This skill does the work.

## The one rule that makes this skill different from every previous attempt

**Never run this on a single page.** Matt's ask was "a plan for *that* page," and the
trap is the word *that*: 112 pages planned one at a time produce 112 plans that
disagree, which IS the inconsistency. `TASTE.md` already names the fix — *design the
CLASS, not the instance.* So a run takes one `pageClass` from
[`data/page-classes.json`](../../../data/page-classes.json) and finishes every route in it.

If Matt points at one page, find its class and do the class. Say so in one line and
proceed; do not ask.

## Pick the class

```bash
npm run ci:page-plan:report        # every uncovered route, grouped by class
```

Take the class with the most uncovered routes that has a real visitor job, unless Matt
named one. Skip `system` (utilities, no organic intent). Do `capture` last — paid
landing pages are measured by campaign conversion, not organic position.

Write the class you picked and why into `docs/plans/CROSS_AGENT_HANDOFF.md` before you
start, so a session that dies mid-class is resumable.

## The six phases

### 1. Ground the class spine — READ THE REAL PAGES FIRST

Do not write a spine from the class's job description. That is how a speculative spine
becomes new drift. Open every route in the class and tabulate what each actually
carries: components mounted, section ids, JSON-LD emission path, whether proof /
inventory / a next act is present.

**The defects are in the disagreements.** The brokerage class was ground this way on
2026-09-05 and the tabulation alone produced: `/contact` and `/videos` hand-rolling raw
`<script type="application/ld+json">` tags in the page body while `/about` and `/team`
emit through `MetadataBlock` and `/reviews` uses a bespoke `reviews-jsonld.ts` — three
emission paths in one class; and four of seven pages carrying no proof section on a
class whose entire job is deciding whether to trust the shop.

Write the spine into `data/page-classes.json` under `classes.<class>.spine`, each entry
`{ id, kind, why }`. The `why` cites the measurement, not an opinion. Use `"A|B"` when
a superseded primitive and its replacement both satisfy the duty. Set `groundedAt`.

**A spine entry must be something a page can only satisfy by HAVING something.** Never
write a rule a page can pass by deleting content — that is the failure that killed
page-grade (`PRODUCT.md`, 2026-08-16), and it is the one unforgivable move here.

### 2. Write the plan for every route in the class

One `parity.json` per route at `design_system/ryan-realty/ui_kits/<slug>/parity.json`,
carrying `route`, `pageClass`, `objective`, `mustAnswer`, `sectionOrder`,
`requiredComponents`, `competitiveTarget`, `benchmark`. Schema: `PAGE_PLAN.md` §3.

`mustAnswer` is the field that makes "the wrong content is on the page" mechanical.
Each entry is `{ question, answeredBy }` where the question is in the **visitor's**
words and `answeredBy` is a `#section-id` that renders. **A question with no section
gets `"answeredBy": null`** — that records an honest content gap and reports as one.
Never invent a section id to make a question look answered; the gate resolves the id in
the page source and will catch it.

### 3. Benchmark — §0 applies to every figure

**Our position, per URL and per query — live, real Google data:**
`getGscScopeAggregate(scope='page')` in `lib/data/analytics/getGscMetrics.ts`, and
`public.target_query_benchmark` for the 23 seeded must-win queries.

**The trap, and it is a §0 violation if you get it wrong:** ingestion captures only the
top 25 pages and top 25 queries by impressions per day. **A page with no row is a page
outside that day's sample, not a page with zero impressions.** Write "not sampled,"
never "0". Run the second, differently-shaped query before reporting an absence.

**Rival positions are NOT instrumented.** `growth-loop` files competitor SERP position
as Phase 2 backlog; `competitor_intel` holds `google_serp` rows for ten fixed head
queries only, and the `website_diff` source in that table has no scraper behind it. So
`rivals[].outranksUsOn` comes from a dated manual SERP check you run in this session,
and `docs/competitor-intelligence-2026-05-13.md` is the worked example of that pass.
Fetch the rival page. Read it. Do not benchmark against a domain you did not open.

`loses[]` may not be empty. A benchmark with nothing in `loses` is a comparison that
was not run, not a page that won — and the gate rejects it.

### 4. Bring the pages to the plan

Build from the `components/site/v3` barrel; a section that fits no existing pattern
becomes a NEW barrel primitive, never page-local markup (`PUBLIC_UI.md` §3,
`ci:one-design-system`). Two pages in the class doing the same job use the same
primitive in the same slot — grep for the job before building anything.

Fix the spine debt this class carries (`spineDebt` in
`scripts/page-plan-baseline.json`) and remove those rows. The ratchet may only shrink.

### 5. The evaluator is a SEPARATE agent — mandatory

`TASTE.md`: self-evaluation does not work; the builder never grades its own page. Render
every route in the class at desktop and 375px, screenshot both, and hand them to a fresh
`Agent` with the `TASTE.md` rubric and the rival URLs. It returns named defects with
section ids; fix and resubmit. Record `tasteReview` in each contract and remove those
rows from `scripts/taste-review-baseline.json`.

### 6. Ship the class as one commit

```bash
npm run ci:page-plan && npm run ci:gates
```

One commit per class — the class is the unit of review, same as it is the unit of
design. Then reseed the ratchets and confirm all three shrank:

```bash
npm run ci:page-plan:baseline && git diff --stat scripts/page-plan-baseline.json
```

Update `docs/plans/CROSS_AGENT_HANDOFF.md` with the class shipped, the counts before
and after, and the next class.

## Approval

Everything this skill touches is reversible — contracts, pages, components, gates — so
it is built, committed and pushed under the 2026-07-21 model without waiting for
review. The four per-action classes (`CLAUDE.md` §1) are untouched here: this skill
sends nothing, publishes nothing, spends nothing, grants nothing.

## Definition of done for a class

- Every route in it has a plan; the class's routes are gone from `routes` in the baseline.
- Every plan carries `pageClass`, `objective`, `mustAnswer`, `benchmark`; the class's
  rows are gone from `legacyContracts`.
- The class's `spineDebt` rows are gone, or each survivor carries a dated `waivers[]`
  entry naming why that page is the honest exception.
- Every route has a `tasteReview` from an agent that did not build it.
- `npm run ci:gates` is green and one commit is pushed.

**A class is not done because a page looks better. It is done when the next agent
cannot rebuild any page in it differently and still pass.**
