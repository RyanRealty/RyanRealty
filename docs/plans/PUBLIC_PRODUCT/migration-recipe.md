# Migration recipe — moving a public page onto `components/site/v3`

**What this is.** The executable procedure for migrating one public route off its current
register (KB, legacy flat, primitives) onto the v3 barrel. It is distilled from the one
migration that shipped and survived: `app/housing-market/page.tsx`, commit **`b076e15b`**,
plus its deletion-declaration follow-up **`4fa982be`**. Every rule below is here because
that migration either got it right after being refuted, or shipped it wrong once and had it
found by a verifier.

**Who it is for.** An agent who has never seen this program. Read this file top to bottom
before opening the route you are migrating. Nothing here is optional and nothing here is
advice: each step names the gate, the file, or the defect behind it.

**What "done" means.** The route renders from the barrel, every gate contract that pointed
at the old register now points at the new one, every dropped section is named in the commit,
no module is orphaned, and §8's checklist ran clean with its output pasted into the commit
or the decisions log. A green `ci:gates` is *necessary*, never *sufficient* — three of the
worst defects in the shipped migration passed every gate.

**The one sentence that explains most of the failures below:** *the gates encode the OLD
destination.* A page that leaves KB leaves the scope of gates written for KB, and a gate that
stops applying announces nothing. Half of this recipe exists to stop protection from lapsing
silently.

---

## 1. Order of operations

Do these in order. Each step's output is the next step's input. Skipping ahead to the JSX is
how attempt one at `/housing-market` got built, refuted, and reverted unshipped.

| # | Phase | You produce | You must not yet |
|---|---|---|---|
| 1 | **Contracts** | The list of gates binding your route and what each demands | open the page file |
| 2 | **Data** | The exact reads, filters, windows, units, and freshness stamps the page publishes | choose patterns |
| 3 | **Patterns** | The section list: which of the six patterns, in what order, and what each one's figures/trace/stamp are | write chrome |
| 4 | **Chrome** | Breadcrumb + footer placement | run gates |
| 5 | **Gates** | The contract edits, in the same commit as the page | claim done |
| 6 | **Verify** | §8's checklist output, browser-verified at 390 and 1280 | push |

### Step 1 — read the contracts first

Read, in this order, before touching the route:

1. **`docs/plans/PUBLIC_PRODUCT/gate-contracts.md`** — the exhaustive per-gate map for the
   Market family. §2 is the route × gate binding matrix, §3 is the per-gate contract, §4 is
   the four blockers, **§5 is the list of gates that go SILENT when a page leaves KB**, and
   §6 is the change checklist in dependency order. If your route is not in that map, produce
   the equivalent for your family *first* (the method is in its §0: execute every gate, read
   every gate script, and grep `scripts/check-*.mjs` for your route literals — the grep found
   eight binding gates the original brief did not name).
2. **`design_system/public/PUBLIC_UI.md`** (locked 2026-08-11) — the visual language. §3 is
   the six closed patterns and the rhythm rule. §1 is the one-primary-per-viewport rule. §5
   is the motion ladder.
3. **`components/site/v3/index.ts`** — the barrel header. It is the pressure valve and it
   states what a consumer gets and what it still owes.
4. **`docs/plans/PUBLIC_PRODUCT/decisions.md`** — the running ledger. Read the last two or
   three entries; they will name what the previous roll left open for you.
5. **The parity contract for your route**, if one exists:
   `design_system/ryan-realty/ui_kits/<surface>/parity.json`. Its `requiredComponents` array
   is a hard, source-text import check with zero baselined gaps for the Market routes — it
   is the gate that killed attempt one.

Then baseline the tree **before you edit**, so you can tell your failures from pre-existing
ones (command in §8.0).

### Step 2 — inventory what you are replacing

Open the old page and write down, as a table you keep beside you:

- **Every read** in the `Promise.all` (or wherever): DAL function, arguments, and what
  renders from it. A read whose output does not reach the screen must be deleted, not
  carried (`getSurfaceImage` and `getCoMarketAnnualSeries` were carried into attempt one and
  rendered nothing).
- **Every published figure**: its filter, window, units, rounding, and which query it came
  from. Populations that differ get different traces and different stamps.
- **Every emitted payload**: metadata, JSON-LD types and who emits them, analytics tracker
  and its `pageType`, `revalidate`, the route itself.
- **Every capture contract**: server action name, payload shape, field names. These do not
  change during a migration. Ever.
- **Every section and control you intend to drop.** This list becomes §7.

---

## 2. How data flows

The barrel is fetch-free, format-free, and round-free by construction — `ci:public-v3` rule 3
forbids `toLocaleDateString`, `toLocaleTimeString`, currency `toLocaleString`, and
`Intl.NumberFormat` inside a primitive. That is not a style preference: it is what makes
"the number on screen is the number the caller's source trace covers" (CLAUDE.md §0)
mechanically true.

### 2.1 The DAL call lives at the page

Every read goes through `@/lib/data` (G8 `ci:page-dal`). One `Promise.all`, no
`.catch(() => null)`:

```ts
// app/housing-market/page.tsx
const [regionPulse, citySnapshots, blogPosts, closedYear] = await Promise.all([
  getMarketPulse({ geoType: 'region', geoSlug: 'central-oregon' }),
  getMarketPulseCitySnapshots(CITY_LABELS),
  getRecentBlogPosts({ limit: 3 }),
  getCoMarketAnnual({ year: CLOSED_SALES_YEAR, typeScope: 'all' }),
])
```

The shipped page states why there is no catch, and the reasoning generalizes: every DAL
function here is resilient-cached and answers a transient failure with its own documented
fallback, so a swallow at the page would only hide a real outage behind a confident empty
page. (`feedback_swallowed_errors_lie`: a read that discards its error renders a hard failure
as a confident empty state.)

Do **not** add `// @data-free` to a page that renders live figures. If your route genuinely
renders no data, the marker must be defensible line by line — the one dev page that used it
had its verification written on the line: renders one component, and that component holds no
fetch, no `@/lib/data` import, no supabase client, no async.

### 2.2 Formatting happens at the call site, through `lib/format`

```ts
import { formatPrice } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
```

`ci:currency-format` and `ci:date-format` require the canonical formatters. `formatDate` is
pinned to `America/Los_Angeles`; if the old page formatted with `timeZone: 'UTC'`, the
migrated page shows a different calendar day for anything published between 00:00 and 08:00
UTC. **State that trade in the file header rather than absorbing it silently** — the shipped
page does, in a paragraph headed `DATES RENDER IN PACIFIC`.

**`formatPrice` rounds to the nearest $1,000** (`lib/format/money.ts`). That is correct for a
list-price display and *wrong for a published payload*. A $627,450 median goes into FAQPage
JSON-LD as $627,000. When the same string is both rendered and published, format it in whole
dollars and print the identical string in both places:

```ts
const closedMedianLabel =
  closed && closed.medianClose != null && closed.medianClose > 0
    ? `$${Math.round(closed.medianClose).toLocaleString('en-US')}`
    : null
```

### 2.3 Preformatted strings go into the primitives

Every figure, trace, and stamp crosses the boundary as a string the caller already made:

```ts
const regionFigures: V3InstrumentFigure[] = []
if (regionPulse?.medianListPrice != null) {
  regionFigures.push({
    value: v3Text(formatPrice(regionPulse.medianListPrice)),
    label: v3Text('median list price'),
    href: '/housing-market/central-oregon',   // every figure is a door
  })
}
```

`updated` is a **preformatted string, not a date**:

```tsx
updated={refreshedAt ? v3Text(formatDate(refreshedAt)) : undefined}
```

Patterns that take at-least-one-row collections use the tuple-head technique, and you handle
the empty case explicitly rather than letting an empty array render a headless section:

```ts
const [firstRegionFigure, ...restRegionFigures] = regionFigures
// …
{firstRegionFigure ? (
  <V3Instrument figures={[firstRegionFigure, ...restRegionFigures]} … />
) : (
  <V3Quiet id="market" heading="…" headingLevel={1} items={[{ kind: 'prose', term: 'No live figures right now', body: '…' }]} />
)}
```

### 2.4 `v3Text` for anything that becomes an accessible name

`v3Text()` builds the branded `V3Text` type. Every heading, eyebrow, label, button text,
source line, and figure label in the barrel is typed `V3Text`, not `string`, because `string`
accepts `''` and an empty headline renders a region whose `aria-labelledby` points at an empty
`<h1>` — a landmark with no accessible name at all.

`v3Text('')` **does not compile** (the literal narrows the parameter to `never`).

### 2.5 The guard that keeps `v3Text` from throwing on a DB-sourced empty string

A value typed `string` — anything read out of a query — compiles fine and is checked at
**run time**, where `v3Text` **throws**. On a server component that is a 500 on the route.

So: every DB-sourced string that reaches the barrel is guarded at the page, and a row that
cannot be named honestly is **dropped, not defaulted**:

```ts
const guideRows: V3LedgerPlainRow[] = []
for (const post of blogPosts) {
  const title = post.title?.trim()
  const slug = post.slug?.trim()
  if (!title || !slug) continue        // one blank title would 500 the whole route
  const excerpt = post.excerpt?.trim()
  guideRows.push({
    href: `/blog/${slug}`,
    when: v3Text(post.publishedAt ? formatDate(post.publishedAt) : 'Guide'),
    what: v3Text(title),
    detail: excerpt ? v3Text(excerpt) : undefined,
    id: slug,
  })
}
```

When a blank value is legitimately expected, the caller supplies the fallback explicitly —
`v3Text(listing.address || 'Address withheld')` — never a bare `v3Text(row.someColumn)`.

**Audit rule:** grep your finished page for `v3Text(` and check every argument. If it is not
a literal, a `formatX()` return, or a value you just proved non-empty, it is a live 500.

---

## 3. The section-0 rules that bit us

These five cost a repair pass on the shipped page. Every one passed the gates.

### 3.1 One derivation for a verdict, shared with the FAQ builder — and it classifies the RAW value

The defect: the page rounded months-of-supply and then classified the rounded number. That
walks the verdict across a canonical threshold in **both** directions — a genuinely balanced
`4.02` rounds to `4.0`, and `4.0 <= 4` prints "a seller's market"; a genuinely balanced `5.97`
rounds to `6.0`, and `6.0 >= 6` prints "buyer's". It appeared in the H1, the visible FAQ
answer, and the FAQPage JSON-LD. `lib/site/market-faq.ts` had the identical bug inside it, so
"one derivation" was one derivation of a wrong verdict.

The shape that is correct:

```ts
// THE ONE DERIVATION. Classify the raw value, round only to display it, and hand the
// RAW value to buildMarketFaq so the shared builder repeats the same two steps in the
// same order.
const mosRaw =
  regionPulse?.monthsOfSupply != null && regionPulse.monthsOfSupply > 0
    ? regionPulse.monthsOfSupply
    : null
const mosDisplay = mosRaw == null ? null : Math.round(mosRaw * 10) / 10
const verdict = marketVerdict(mosRaw)
// …
const pulse = regionPulse ? { …, monthsOfSupply: mosRaw, … } : null
const marketFaq = buildMarketFaq('Central Oregon', pulse ?? { activeCount: null, medianListPrice: null, refreshedAt: null })
```

Corollaries:

- **The guard is shared with the consumer.** `mosRaw` is null unless the stored value is
  above 0, which is `buildMarketFaq`'s own condition. Before that, the page printed a verdict
  at a stored `0` with no FAQ answer behind it: `"a seller's market"` beside `"0.0 months of
  supply"`.
- **Thresholds and methodology prose come from `lib/market/classify.ts`** —
  `marketVerdict()`, `MOS_METHODOLOGY_CLAUSE`, `MOS_THRESHOLD_CLAUSE`. `ci:market-formula`
  forbids inlining the thresholds. The migration also found `MOS_THRESHOLD_CLAUSE` reading
  *"Under 4 months is a seller's market"* while `marketVerdict` classifies 4.0 as a seller's
  market — a publishable contradiction on five public pages. One canonical sentence now, and
  the FAQ builder uses it instead of its own.
- **The fixer writes the gate.** The boundary cases are locked in
  `lib/site/market-faq.test.ts` (4.02 must read balanced, 5.97 must read balanced), and the
  assertion names the verdict clause — `'which is a balanced market'` — not a bare
  `"seller's market"` substring, which the shared threshold sentence legitimately contains.

### 3.2 One trace per query, one stamp per trace

A page with three populations has three traces and three stamps. **No section prints a figure
its own trace does not cover, and no section dates its figures with another query's clock.**

```ts
// The city Ledger's own freshness stamp, from the city rows themselves. The region row
// refreshes on its own schedule, so borrowing its timestamp would date one query's
// figures with another query's clock.
const cityRefreshedAt = citySnapshots
  .map((s) => s.updated_at)
  .filter((v): v is string => typeof v === 'string' && v.length > 0)
  .sort()
  .at(-1)
```

And a stamp that would be render-time is **dropped, not printed**:

```tsx
// Only a mart row carries a real computed_at. getCoMarketAnnual falls back to a live
// aggregate that stamps now(), which would print "updated today" over a closed
// calendar year.
updated={closed.source === 'mart' && closed.computedAt ? v3Text(formatDate(closed.computedAt)) : undefined}
```

The trace itself is one sentence naming source, geography, property scope, window, and any
methodology clause:

```ts
const regionTrace =
  'live MLS through Oregon Data Share, single-family homes across the Central Oregon region. ' +
  MOS_METHODOLOGY_CLAUSE + ' ' + MOS_THRESHOLD_CLAUSE
```

### 3.3 Absent is not zero

A covered entity with no live row is **not** printed as `0` under a live-MLS source line. It
keeps its door and states the reason **derived from its own data** — the three cases are not
the same claim:

```ts
const cityFootnotes = CITY_LABELS.filter((label) => CITY_SLUG[label] !== undefined && !rowed.has(label))
  .map((label) => {
    const snapshot = snapshotByLabel.get(label)
    if (!snapshot) return { label, fact: `${label} returned no market row in the latest sync` }
    if (snapshot.active_count === 0) return { label, fact: `${label} shows no active single-family listings` }
    return { label, fact: `${label} shows ${snapshot.active_count.toLocaleString('en-US')} active with no published median` }
  })
```

Those footnotes then render in the closing Quiet block, each city still linked to its report.
The KB page rendered Tumalo as "0 active" under a live-MLS source line; that is the defect.

### 3.4 No read left in that is not rendered

Four reads, four rendered. A discarded read in a `Promise.all` positional hole is a real cost
(a live query on every request) buying nothing, and it misleads the next reader about what the
page publishes. Delete it — and then handle the module it orphaned (§7).

### 3.5 The verdict must match the rounded number on screen

The last check before you claim done is visual, not static: read the H1 and the figure beside
it in a browser. The shipped page's verification reads *"H1 'a balanced market', figure 5.8,
FAQ '5.8 months of supply, which is a balanced market', Dataset variable 5.8."* If the
headline and the number disagree, or the visible answer and the JSON-LD disagree, you have two
derivations no matter what the code looks like.

**Related, and the same class:** every figure that names a linkable thing carries an `href`.
Dead text naming a node is a defect in this program. All three closed-sales figures are doors
into the explorer, and the property-type figure carries its own `&type=` filter — validated
against the codes the destination actually reads (`HISTORY_TYPE_CODES`), because a figure door
carrying an unknown code silently drops its filter and lands on an unfiltered page.

---

## 4. Chrome

Three primitives, all reading every `href` from `lib/site-nav.ts` at module load, so no
destination can drift by being copied into the chrome.

| Primitive | Who renders it | Rule |
|---|---|---|
| **`V3Chrome`** | `app/layout.tsx` **only** | The page must **never** mount it. `ci:kb-shared-shell` fails any page that re-mounts the header. Today the layout still mounts `PublicNav` (which resolves to `KbNav`); the gate's layout arm accepts `PublicNav`, `KbNav`, **or** `V3Chrome`, so the swap does not have to happen behind a failing gate. Until it does, a migrated page is a **mixed page** in the `ci:public-ui` ledger by design. |
| **`V3Breadcrumb`** | the page, first flow element of `<main>` | Surface tone by default, and the below-nav offset defaults **ON**: the public header is `position: fixed`, and without the offset 52px of a 52px strip renders behind the wordmark (measured at 390 **and** 1280 on the first attempt). `belowNav={false}` is the documented escape. On a dark `V3Stage` opening, pass `tone="on-media"` — `ci:kb-breadcrumb-overlay` now enforces that pairing for v3 exactly as it enforced `overlay` for KB. |
| **`V3Footer`** | the page, **outside `<main>`** | Carries no button: the one valuation primary belongs to the sticky header. |

Two facts that are easy to get wrong and that no gate will tell you:

**A migrated page carries exactly one footer.** `ci:default-chrome-footer` now accepts
`V3Footer`/`V3_ROOT_CLASS` as a footer register, *and* fails a page that renders both
`KbFooter` and `V3Footer`, or a register footer beside `SiteFooter`, unless the route is in
`DUAL_REGISTER`.

**The footer renders outside `<main>`, and the comment explaining it stays in the file:**

```tsx
    </main>

    {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
        when it is NOT nested in sectioning content, and <main> is sectioning
        content, so inside it the element is a generic and the page ships no
        contentinfo landmark. ci:default-chrome-footer counts footers without
        checking placement. */}
    <V3Footer columns={V3_FOOTER_COLUMNS} />
```

**Drop `kb-root`.** The page's outermost element opens the v3 token scope instead:

```tsx
<main className={V3_ROOT_CLASS}>
```

`V3_ROOT_CLASS` is `'v3'`. Two consequences you must handle:

1. **`KbSectionTracker` observes both registers now** (`'.kb-root section[id], .v3 section[id]'`).
   It did not, and the first migrated page silently stopped emitting `section_view` — analytics
   that goes quiet looks exactly like a page nobody scrolls. If you add a new register root,
   teach the tracker in the same change.
2. **Keep rendering `<KbSectionTracker pageType="…">` and `<MetadataBlock>`.** Both are wiring,
   not visual language; the barrel ships no equivalent; and `ci:kb-page-contract` accepts
   either register's tracker. On the shipped page those two imports are the *entire* remaining
   non-v3 count (16 → 2). Say so in `decisions.md`.

**One primary CTA per viewport** (PUBLIC_UI.md §1) survives the register change and is the
rule most likely to fail at 1280. While the sticky header carries a filled CTA at every scroll
position, the page's own ask is `variant: 'ghost'`:

```tsx
action={{ label: v3Text('Get a free written valuation'), href: valuationPath(), variant: 'ghost' }}
```

Also: `V3Sheet`'s advance control is a primary and is not the thing to change. Any Sheet on
any public page shares a viewport with the header's filled CTA at desktop widths — that
conflict is the chrome unit's to resolve and is recorded as open in `decisions.md`, not
worked around per page.

**Rhythm rule** (PUBLIC_UI.md §3): no two adjacent sections share a pattern, and no page uses
more than four of the six. Chrome is exempt. The shipped order is Breadcrumb → Instrument
(level 1) → Ledger (cities) → Instrument (level 2) → Ledger (guides) → Quiet (FAQ) → Sheet
(ask) → Quiet (edges) → Footer. `level` is required on Instrument so two of them cannot both
emit an `<h1>` because a default chose for them.

**If a control you need does not exist, add a primitive to the barrel.** Do not reach back
into `components/site/kb`, `components/site/primitives`, `components/site/explore`,
`components/ui`, or a flat `@/components/site/<File>` — `ci:public-v3` forbids it, and one such
import puts two visual languages on one page, which is the defect this rebuild exists to end.
The six *patterns* are closed (growing them needs Matt); the *atoms* are not.

---

## 5. Gate contracts to move IN THE SAME CHANGE

`ci:gates` runs the whole chain before any ref moves, so a page edit and its contract edits
must land in one commit or the push is blocked. Two categories, and the second is the
dangerous one.

### 5.1 Blockers — the page cannot pass without the edit

| Gate | File to edit | The edit |
|---|---|---|
| `ci:default-chrome-footer` | `scripts/check-default-chrome-footer.mjs` | Add `const hasV3 = (c) => /\bV3Footer\b/.test(c) \|\| /\bV3_ROOT_CLASS\b/.test(c)` and use it in all three places `hasKb` is used; extend the double-footer rule to the v3 pairings. *(Already done — verify, don't redo.)* |
| `ci:breadcrumb` | `scripts/check-breadcrumb.mjs` (~136) | `V3Breadcrumb` joins the recogniser literal set. Label canon and on-navy scoping untouched. *(Already done.)* |
| `ci:seo-shell` | `scripts/check-seo-shell.mjs` (~83 and ~222) | Per-route required check asserts the **head term** in either register's spelling, both arms **exact literals** (a loose `[Hh]ousing [Mm]arket` regex is a *weaker* lock than the KB rule it replaces); and `extractLayerAShell()` learns `<V3Heading>` + `headline=` so the banned-poetry scan is not blind. |
| `ci:mockup-parity` | `design_system/ryan-realty/ui_kits/<surface>/parity.json` | Rewrite `requiredComponents` to the v3 sections, **and** `sectionOrder`, `note`, `jsonLd`, `dataLayer` in the same edit — they are the human half and go stale silently. Do not delete a `parity.json` whose directory holds `index.html` (`ci:mockup-coverage` fails); label the `index.html` as the retired mockup instead. Never `--write-baseline`. |
| `ci:public-ui` | `scripts/public-ui-baseline.json` | Re-seed **after** the code is final: `node scripts/check-public-ui.mjs --write-baseline`. `nonV3ImportSites` and `legacyPages` may only shrink; `mixedPages` is tracked, not gated. Commit the baseline in the same commit. |
| `ci:file-size-budget` | your route | A NEW file over the LOC floor is a hard fail, not a ratchet warning. The gate's own instruction is **split, not re-baseline**: route-local constants go to `app/<route>/_v3/<name>-constants.ts`. |
| `ci:page-dal` | `scripts/page-dal-baseline.json` | *Remove* your route if it now imports the DAL cleanly. Re-seed from the gate; never hand-edit the totals. |

### 5.2 Silent-loss closures — the page passes, and the protection is gone

These do not block. They stop protecting, and nothing announces it. **Each is closed in the
same commit that migrates the first page of a family**, or it will not be closed for months.

| Gate | File to edit | What stops being protected |
|---|---|---|
| `ci:kb-page-contract` (G52) | `scripts/check-kb-page-contract.mjs` | Page predicate accepts `V3_ROOT_CLASS` / `className="v3"`; tracker predicate accepts either register's tracker. Without it a migrated page could ship with no metadata, no tracking, no JSON-LD, green. |
| `ci:kb-shared-shell` (G53) | `scripts/check-kb-shared-shell.mjs` | Layout arm accepts `V3Chrome`; per-page arm pairs `V3_ROOT_CLASS` with `V3Footer` instead of lapsing. |
| `ci:kb-breadcrumb-overlay` | `scripts/check-kb-breadcrumb-overlay.mjs` | Pair-driven: `V3Stage` + `V3Breadcrumb tone="on-media"` beside the KB pair. Vacuous on a page with no Stage — that is the point: it is in place before the first dark v3 opening ships. |
| `ci:naked-verb-headings` (G62) | `scripts/check-naked-verb-headings.mjs` | `V3Heading` in the tag arm; `headline` and `eyebrow` in the prop arm, including the `{v3Text('…')}` form. Otherwise `headline={v3Text('Explore')}` ships silently — C-07 with a new prop name. |
| `ci:kb-a11y-static` | `scripts/check-kb-a11y-static.mjs` | Check 1 runs **per token layer** and scans **every** `components/site/v3/*.css`, not just `tokens.css` (that would cover 16 of 84 color declarations). Declaring a faint stop is not the defect; painting text with one is. |
| `ci:market-chart-honesty` | `scripts/check-market-chart-honesty.mjs` | `existsSync` guards, so deleting the chart fails with the honest message rather than an ENOENT stack trace. The spline ban is a §0 rule and must never lapse during a swap. |
| `ci:market-section-nesting` | — | **Deliberately not given a v3 pair**, and that is recorded as a lapse in `decisions.md`, not an oversight: no v3 pattern nests inside another, so a naive pair would fail correct authoring. Revisit when a real v3 nesting relationship exists. |

### 5.3 The comment-stripper defect — check this before you trust any gate's scope

`check-kb-page-contract.mjs`, `check-kb-shared-shell.mjs`, and
`check-default-chrome-footer.mjs` decided "is this page in scope" on comment-stripped source,
stripping **block comments before line comments**. A glob like `@/app/actions/*` inside a `//`
comment carries the literal `/*`, which opened a phantom block comment that ran to the next
`*/` and swallowed the body of the file — including the `kb-root` the gate was looking for.
**Four public pages were invisible to G52/G53**, three of them the flagship market routes, for
as long as one line of prose existed in each.

The fix is one line per gate, and the order is the whole point:

```js
const stripComments = (src) =>
  src.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '')
```

Break-test by watching the checked-page count rise (G52 60 → 64, G53 62 → 66) and confirming
every newly visible page passes on today's source. **If you are migrating a family whose gates
you have not personally re-scoped, assume nothing about what is protecting you.**

### 5.4 What you may never do to make a gate green

No baseline entry, no opt-out comment (`// @data-free`, `// @no-breadcrumb`,
`// @no-static-params`, `// heading-display-ok`, `// @no-parity` — that last one is inert
prose no gate reads), no allowlist row, no `--write-baseline` to paper over a real gap, and no
prop written purely to satisfy a regex (writing `titleBottom` on a v3 page is gate-gaming, not
compliance). **If a gate is wrong about the destination, change the gate and say why in its
docblock.** Every gate edit gets break-tested: introduce the defect, watch it fire, restore,
watch it pass.

---

## 6. Carry-through: what a migration never changes

State each of these in the route file header as "the page contract, carried across
unchanged", and verify each in the rendered output:

- `generateMetadata` / `metadata`, including the exact `title:` string a gate may pin.
- `revalidate`, `generateStaticParams` (and its core slug set), and the route itself.
- The JSON-LD **meaning**: same types, same payloads. Emission may move (`FAQPage` moved out
  of `FAQBlock` into the page's `MetadataBlock` schemas array) but the payload does not.
- The analytics tracker and its `pageType`.
- Every metric's filter, window, and units.
- **The capture contract.** Same server action, same payload shape, same field names. The
  shipped Sheet wraps `V3Sheet` and calls `submitMarketPageInquiry` with `variant: 'inquiry'`
  and fields `name` / `email` / `message`; the payload is written as an object literal rather
  than typed through the legacy `LeadCapturePayload` so the file imports nothing from the
  legacy register, and TypeScript still matches it structurally so a renamed field is a
  compile error.

---

## 7. Declaring deletions

**Any section, control, or component the migration drops is named — in the commit message and
in the parity contract's `note`.** A migration that quietly loses a feature is indistinguishable
from a migration that forgot it, and the reviewer cannot tell which. Attempt one silently
dropped `KbHero`'s property search and voice-search button.

The shipped page names seven, in the route header and in `parity.json`:

> The KB-era deletions this migration made: KbHero's property search and voice-search button,
> KbSell's address prefill field, RegionalSfrAlertsBand, CoMarketSizeStrip, CoMarketComposition,
> KbArticles thumbnails, MarketSources, SmoothScrollProvider.

Each deletion states where the information went, if it went anywhere. The Oregon Data Share
citation `MarketSources` used to render now lives as an edge in the closing Quiet block.

**An orphaned module is deleted or rewired, never left.** When the hub stopped importing
`CoMarketComposition`, `ci:reachable-exports` refused the tree — correctly. The follow-up
commit `4fa982be` deleted the file and declared what replaced it:

> The v3 hub no longer renders CoMarketComposition, so the module was orphaned and the
> reachable-exports gate was right to refuse the tree. The deletion is deliberate and the
> information survives with a door: the closed-sales Instrument prints the lead property
> type's share (85.0% single-family) linked to `/housing-market/history?year=2024&type=A`, and
> the FAQ still answers what property types made up the year. Verified all three on the
> rendered page. The pattern set is closed and holds no chart pattern, which is why this
> becomes a figure rather than a restyled chart.

Before deleting a shared component, check whether another route still renders it. `KbHero`,
for example, is pinned alive by `ci:seo-shell`'s existence lock: deleting it while any page
still renders it fails with `hero-missing`. `CoMarketSizeStrip` and `getCoMarketAnnualSeries`
were left untouched for exactly that reason — `/housing-market/central-oregon` still renders
them.

Also declare, in `decisions.md`, anything you deliberately **left on a non-v3 register**
(`MetadataBlock`, `KbSectionTracker`) and anything you **left open for another unit**, with
the file and line. Leaving a red shared gate for someone else is how the invisible-CTA-text P0
lived for weeks.

---

## 8. Verification checklist — run before claiming done

### 8.0 Before editing: baseline the tree

```bash
cd /Users/matthewryan/RyanRealty
for g in mockup-parity mockup-coverage seo-shell seo-routes kb-breadcrumb-overlay \
         kb-page-contract kb-single-source kb-shared-shell default-chrome-footer \
         kb-a11y-static market-formula market-narrative-integrity market-section-nesting \
         page-dal static-params ods-compliance public-ui public-v3 breadcrumb \
         heading-display naked-verb-headings market-chart-honesty days-to-pending-source \
         sitemap-resolvable nav-reachability ai-crawler-access no-explore-route \
         no-report-rpc report-geo-registry reachable-exports file-size-budget \
         css-cascade-layers date-format currency-format; do
  node scripts/check-$g.mjs >/dev/null 2>&1; echo "$g exit=$?"
done
```

Anything non-zero here is pre-existing. Write the list down; it is the only way to tell your
failures from someone else's.

### 8.1 Static — the fast loop while you work

```bash
npx tsc --noEmit                                   # v3Text/V3Text errors surface here first
npx vitest run lib/site/market-faq.test.ts         # or whichever shared builder you touched
node scripts/check-public-v3.mjs                   # barrel law: no cross-register import, no raw color, no format in a primitive
node scripts/check-mockup-parity.mjs               # NEW missing must be 0 on your route
node scripts/check-breadcrumb.mjs --json           # newMissing must be []
node scripts/check-default-chrome-footer.mjs
node scripts/check-kb-page-contract.mjs
node scripts/check-kb-shared-shell.mjs
node scripts/check-public-ui.mjs                   # A and B must be <= the recorded ceilings
node scripts/check-reachable-exports.mjs           # catches the module your deletion orphaned
node scripts/check-file-size-budget.mjs            # a NEW file over the floor is a hard fail: split
node scripts/check-css-cascade-layers.mjs          # new v3 CSS must be inside @layer base
```

### 8.2 Break-test every gate you edited

For each: introduce the defect, run the gate, watch it fire; restore, run it, watch it pass.
Paste the two verdicts into the commit message or `decisions.md`. A gate edit that was never
seen to fail is a gate edit that may not work — `feedback_gate_green_for_wrong_reason`.

### 8.3 Re-seed the ratchets, after the code is final

```bash
node scripts/check-public-ui.mjs --write-baseline   # refuses to write a grown A or B; commit the JSON in the same commit
node scripts/check-page-dal.mjs --write-baseline    # only if your route left the debt list
```

Never re-seed speculatively — the seed also rewrites the per-page map rule C reads.

### 8.4 The full chain

```bash
npm run ci:gates
```

This is what `npm run push` materializes before any ref moves. **Never pipe it** if you care
about the verdict (`npm run push | tail` reports tail's status; an aborted push reads as
exit 0). Read the last printed line.

### 8.5 Browser verification at 390 and 1280 — not optional

Static gates cannot see any of these, and each one shipped broken once:

- [ ] Exactly **one** `<main>` and **one** `<footer>`; the accessibility tree shows
      `contentinfo` (it will not if the footer is inside `<main>`).
- [ ] The breadcrumb is not occluded by the fixed header. Measure it:
      `document.elementFromPoint(x, y)` on the first crumb must return the crumb link, not
      `IMG.logo-img`.
- [ ] **One** solid-filled control in the first viewport at **both** widths. Count
      `a.v3-btn--primary` plus the chrome's `a.nav-cta`, visible, at `scrollY = 0`.
- [ ] No horizontal overflow at 390.
- [ ] The verdict in the H1 matches the rounded figure beside it, and both match the visible
      FAQ answer and the JSON-LD payload. Read all four.
- [ ] `section_view` analytics fire on scroll (the tracker must observe your root class).
- [ ] Every figure that names a node is clickable and lands on the filtered destination —
      follow each door, including query-string filters.
- [ ] The empty-state branch renders honestly: force the null path if you can, and confirm no
      section prints a fabricated zero.

### 8.6 Commit

One commit carrying: the page, its route-local `_v3/` files, every gate-contract edit, every
re-seeded baseline, the parity contract, and the `decisions.md` entry. The commit message
names the section order, **the deletions**, the ratchet movement (e.g. `688 -> 674` non-v3
import sites, `84 -> 83` legacy pages, this route `16 -> 2`), every gate contract moved, and
the browser verification you ran. Then `npm run push`, and confirm the ref actually moved
against origin.

---

## 9. The trap list

Nine things that will bite, in the order they bit.

1. **A gate that goes quiet is worse than a gate that fails.** Check §5.2 before you check §5.1.
2. **`v3Text` on a DB string is a 500 waiting for one blank row.** §2.5.
3. **Rounding before classifying moves the verdict.** §3.1.
4. **`formatPrice` rounds to $1,000 and your JSON-LD publishes it.** §2.2.
5. **A fallback that stamps `now()` prints "updated today" over a closed year.** §3.2.
6. **The fixed header eats the breadcrumb** unless the offset defaults on. §4.
7. **Two filled CTAs at 1280** — the header's plus the page's. Make the page's ghost. §4.
8. **`<footer>` inside `<main>` ships no `contentinfo` landmark**, and the footer gate counts
   footers without checking placement. §4.
9. **A deletion you did not declare** reads as a deletion you did not notice, and the module it
   orphaned will fail `ci:reachable-exports` in the next agent's session, not yours. §7.


## Addendum, 2026-08-11: two defects the first parallel wave produced on every route

Both were recipe errors, not page errors. Fixing the recipe is the fix.

### 1. The valuation link must carry its origin, and there is now one way to build it

`?from=<originating path>` becomes CRM source attribution
(`app/lp/seller-home-value/actions.ts`, `sourceUrl`). The KB pages built that query
string inline, so a rewrite of the section silently dropped it on four routes at once.
Attribution loss is invisible in QA: the lead still arrives, it just stops saying which
page produced it, and completed valuations per page is this program's KPI.

**Use `valuationHref(pathname)` from `lib/site/valuation-href.ts` for every valuation link
on a content surface.** It carries the path, keeps the anchor last, and drops anything
that is not a simple site-relative path. The spine's own on-page form does not need it.

### 2. A migrated page carries its own visible primary ask at 390

The first wave demoted every page's ask to ghost on the reasoning that the sticky header
holds the one filled CTA. Measured at 390 on a migrated route, the header's CTA sits at
`top: -107` inside the collapsed menu: the first viewport shipped no ask at all. The
one-primary rule counts VISIBLE filled controls
(`design_system/public/PUBLIC_UI.md` section 3), so the opening Instrument's action stays
`primary` and the chrome's CTA counts only where the chrome actually shows it.
