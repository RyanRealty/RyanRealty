# Gate contracts binding the Market family

**Owner of this file:** the gate-contract cartographer unit (P9). It is a map, not a plan.
It answers exactly one question for the next migration agent: *for each Market route, which
gates fire, what does each one demand of the source today, and what must the contract become
so a `components/site/v3` page satisfies it honestly.*

**Why it exists.** The first `/housing-market` migration was built, refuted, and reverted
unshipped. `decisions.md` (2026-08-11, "the KB gates encode the OLD destination") names three
gates as the root finding. That list is incomplete. This file is the exhaustive version.

---

## 0. Method — how every claim below was produced

Every gate named in the brief was **executed** against the working tree on 2026-08-12, and
every gate script was **read**. Nothing here is inferred from a gate's name or docblock alone.

```
for g in mockup-parity seo-shell seo-routes kb-breadcrumb-overlay kb-page-contract \
         kb-single-source kb-shared-shell default-chrome-footer kb-a11y-static \
         market-formula market-narrative-integrity market-section-nesting page-dal \
         static-params ods-compliance public-ui breadcrumb heading-display \
         naked-verb-headings market-chart-honesty public-v3 kb-overlay-hidden; do
  node scripts/check-$g.mjs
done
```

Result on the current tree: **21 of 22 exit 0**. The single failure is `check-page-dal`
(`app/dev/sell-film/page.tsx`, one NEW violator) — pre-existing untracked work, unrelated to
the Market family. Treat the Market family as **green today**: every failure the next attempt
sees is a failure the next attempt introduced.

Beyond the 20 named gates, `scripts/check-*.mjs` was grepped for every Market route literal.
That surfaced **eight more binding gates** the brief did not name. They are in §C too.

**Chain membership.** All gates below are in `package.json` → `ci:gates` (which
`npm run push` materializes before any ref moves), **except** `ci:lead-funnels`,
`ci:route-smoke`, `ci:page-payload`, and `ci:data-access`, which are live-server or
DB-dependent and run outside the static chain. A gate outside `ci:gates` cannot block the
commit but can still block the deploy verification.

---

## 1. The 15 routes, as they exist today

| # | Route file | URL | Register today | Notes |
|---|---|---|---|---|
| R1 | `app/housing-market/page.tsx` | `/housing-market` | KB (`kb=11 legacy=5`) | The flagship. 503 lines. |
| R2 | `app/housing-market/[...slug]/page.tsx` | `/housing-market/<city>` and `/<city>/<community>` | **dual-register** (`legacy=16 kb=12 primitives=1`) | 1-seg = KB city report; 2-seg = legacy wave-2 render. 893 lines. |
| R3 | `app/housing-market/central-oregon/page.tsx` | `/housing-market/central-oregon` | KB (`kb=11 legacy=5`) | Region report; owns the Dataset + FAQPage JSON-LD. |
| R4 | `app/housing-market/annual-review/page.tsx` | `/housing-market/annual-review` | KB (`legacy=5 kb=6 primitives=1`) | `kb-root` **without** `KbHero`. |
| R5 | `app/housing-market/history/page.tsx` | `/housing-market/history` | KB (`kb=5 primitives=1`) | `kb-root` without `KbHero`. Already in `.design-token-lint-ignore`. |
| R6 | `app/housing-market/reports/page.tsx` | `/housing-market/reports` | **re-export only** (2 lines) | `export { metadata, default } from '@/app/reports/page'` |
| R7 | `app/housing-market/reports/[slug]/page.tsx` | `/housing-market/reports/<slug>` | **re-export only** (2 lines) | re-exports `app/reports/[slug]` |
| R8 | `app/housing-market/reports/[slug]/[geoName]/page.tsx` | — | **re-export of a redirect** (4 lines) | re-exports R14 |
| R9 | `app/housing-market/reports/archive/[city]/page.tsx` | `/housing-market/reports/archive/<city>` | KB (`legacy=2 kb=5`) | no `KbHero`. Has real `generateStaticParams`. |
| R10 | `app/months-of-supply/page.tsx` | `/months-of-supply` | **legacy + primitives** (`legacy=4 primitives=1`) | NOT a KB page. Renders `PageBreadcrumb` + `SiteFooter`. `kb-root` appears only inside a comment. |
| R11 | `app/pulse/page.tsx` | `/pulse` | KB (`kb=6`) | `KbHero` + `KbBreadcrumb overlay`. `pageType="feed"`. |
| R12 | `app/reports/page.tsx` | `/reports` | KB (`legacy=1 kb=7`) | R6 re-exports this. |
| R13 | `app/reports/[slug]/page.tsx` | `/reports/<slug>` | KB (`kb=6`) | no `KbHero`. R7 re-exports this. |
| R14 | `app/reports/[slug]/[geoName]/page.tsx` | — | **redirect-only** (37 lines) | `permanentRedirect` to `/housing-market/<city>`. |
| R15 | `app/reports/sales/[city]/[period]/page.tsx` | `/reports/sales/<city>/<period>` | KB (`legacy=1 kb=5`) | no `KbHero`. Decade sales archive. |

Register counts are the live `scripts/public-ui-baseline.json` numbers. **All 15 routes are
in `knownPages`**, so none of them trips the public-ui new-page tripwire.

---

## 2. Route × gate binding matrix

`●` = binds and will fire on a bad edit. `○` = in scope but currently vacuous for this route
(the trigger condition is absent). blank = out of scope.

| Gate | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | R11 | R12 | R13 | R14 | R15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `ci:mockup-parity` | ● | ● | ● | | | | | | | | | | | | |
| `ci:mockup-coverage` | ● | | | | | | | | | | | | | | |
| `ci:seo-shell` | ● | ● | ● | ● | ● | ● | ● | ● | ● | | | | | | |
| `ci:seo-routes` (+`seo-authoring`) | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `ci:kb-breadcrumb-overlay` | ● | ● | ● | ○ | ○ | | | | ○ | | ● | ● | ○ | | ○ |
| `ci:kb-page-contract` | ✗† | ✗† | ✗† | ● | ● | | | | ● | ○ | ● | ● | ● | | ● |
| `ci:kb-single-source` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `ci:kb-shared-shell` | ✗† | ✗† | ✗† | ● | ● | | | | ● | ○ | ● | ● | ● | | ● |
| `ci:default-chrome-footer` | ● | ● | ● | ● | ● | ● | ● | exempt | ● | ● | ● | ● | ● | ● | ● |
| `ci:kb-a11y-static` | ● | ● | ● | ● | ● | | | | ● | ● | ● | ● | ● | | ● |
| `ci:market-formula` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `ci:market-narrative-integrity` | | | | | | | | | | | | | | | |
| `ci:market-section-nesting` | ○ | ● | ● | ○ | | | | | | | | | | | |
| `ci:page-dal` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `ci:static-params` | | ● | | | | | ● | ● | ● | | | | ● | ● | ● |
| `ci:ods-compliance` | | | | | | | | | | | | | | | |
| `ci:public-ui` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `ci:public-v3` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `ci:breadcrumb` | ● | ● | ● | ● | ● | exempt | exempt | exempt | ● | ● | ● | ● | ● | exempt | ● |
| `ci:heading-display` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `ci:naked-verb-headings` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `ci:market-chart-honesty` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| **not in the brief:** | | | | | | | | | | | | | | | |
| `ci:days-to-pending-source` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `ci:sitemap-resolvable` | ● | ● | ● | | | ● | ● | | | | ● | | | | |
| `ci:nav-reachability` | ● | | | | | ● | | | | | | | | | |
| `ci:ai-crawler-access` | | | | | | ● | ● | | | | | | | | |
| `ci:no-explore-route` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `ci:no-report-rpc` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `ci:report-geo-registry` | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `ci:lead-funnels` *(not in ci:gates)* | | | | | | | | | | | | | | | ● |
| `ci:route-smoke` *(not in ci:gates)* | ● | | | | | | | | | | | | | | |

`ci:market-chart-honesty`, `ci:market-formula`, `ci:days-to-pending-source`,
`ci:no-report-rpc`, `ci:report-geo-registry`, `ci:no-explore-route` and `ci:public-v3` bind
every row because they scan whole trees or pin shared modules — they do not name routes.
They are marked `●` everywhere so nobody assumes a route is out of their reach.

**† = the gate believes the route is not a KB page and skips it. This is a live defect, not a
design choice. See §2.1.**

---

## 2.1 Live defect: G52 and G53 are already blind on the three flagship Market pages

Found while mapping, verified three ways. **`ci:kb-page-contract` (G52) and
`ci:kb-shared-shell` (G53) do not check `app/housing-market/page.tsx`,
`app/housing-market/[...slug]/page.tsx`, or `app/housing-market/central-oregon/page.tsx`
today.** They have been invisible to both gates for as long as one line of comment prose has
existed in each file.

**Mechanism.** Both gates decide "is this a KB page" on the **comment-stripped** source:

```js
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
...
if (!/kb-root/.test(code)) continue
```

Block comments are stripped **before** line comments. All three files carry this line comment:

```
app/housing-market/page.tsx:136              // Data — all via @/lib/data (G8). No @/app/actions/* imports.
app/housing-market/central-oregon/page.tsx:214   (identical)
app/housing-market/[...slug]/page.tsx:346        (identical)
```

The glob `actions/*` contains the literal `/*`. The lazy block-comment regex opens there and
runs forward to the **next** `*/` in the file, which is the closing of the JSX comment above
`<MetadataBlock>`:

```
app/housing-market/page.tsx:329-330
      {/* AI-citability structured data: BreadcrumbList + WebPage + Dataset.
          KbBreadcrumb has no JSON-LD of its own. FAQPage emitted by FAQBlock. */}
```

That single "comment" swallows lines 136–330, and `<main className="kb-root">` sits at line
**328**, inside it. Stripped source has no `kb-root`; the gate skips the page.

**Verification.** Re-running each gate's own page-selection logic reproduces its own printed
count exactly — G52 selects **60** pages (its output says "60 KB page(s) checked"), G53 selects
**62** ("all 62 KB page(s)") — and neither list contains R1, R2, or R3. The only Market rows
either gate actually checks are R4, R5, R9, R11, R12, R13, R15.

**What it means for the migration.** Two things, and they pull in opposite directions:

1. *Good news for the schedule.* Whatever the rebuilt R1/R2/R3 do about `kb-root`, `KbFooter`
   and `KbSectionTracker`, G52 and G53 will not block the commit. The four blockers in §4 are
   still four, not six.
2. *Bad news for honesty.* The page contract those three pages are documented as carrying —
   SEO metadata, a rendered section tracker, emitted `MetadataBlock` JSON-LD with a
   `pulse ??` timeout fallback — is enforced on them **by nothing**. They happen to satisfy it
   today (verified: all three export `generateMetadata`, render `<KbSectionTracker>`, render
   `<MetadataBlock>`, and call `buildMarketFaq`), but a rebuild could drop any of it silently.
   Migrating without fixing this ships the exact class of regression G52 exists to stop, on the
   highest-traffic market URL on the site.

**Honest fix, and it is small.** Strip line comments **before** block comments in both gates
(and in `check-default-chrome-footer.mjs`, which uses the same `code()` helper and is saved
today only by the separate `KbFooter` token):

```js
// Line comments first: a glob like `@/app/actions/*` inside a `//` comment otherwise
// opens a phantom block comment that swallows the rest of the file, and the page falls
// out of the gate's scope entirely (found 2026-08-12 on the three flagship market pages).
const code = (src) => src.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '')
```

Break-test it by confirming the KB page count rises from 60 to 63 (G52) and 62 to 65 (G53),
and that all three newly-visible pages **pass** — they should, on today's source.

Do this in **Phase A**, before the migration, so the three pages are actually under contract
when they are rewritten. Doing it after means rewriting them unprotected and then discovering
what the rewrite dropped.

---

## 3. Per-gate contract

Each entry: **how it binds** · **the rule, quoted** · **what it demands of the Market family
today** · **what the contract must become** · **the exact file + change**.

---

### 3.1 `ci:mockup-parity` — `scripts/check-mockup-parity.mjs`

**Binds:** R1, R2, R3 only. Binding is by the existence of a `parity.json` whose `route` field
names the page. Nothing else binds a route to this gate — a `// @no-parity` comment in a page
is **inert prose that no gate reads** (verified: zero matches for `no-parity` across
`scripts/`).

Three contracts bind the family:

| contract file | route |
|---|---|
| `design_system/ryan-realty/ui_kits/market-report/parity.json` | `app/housing-market/page.tsx` |
| `design_system/ryan-realty/ui_kits/market-report-detail/parity.json` | `app/housing-market/[...slug]/page.tsx` |
| `design_system/ryan-realty/ui_kits/market-report-region/parity.json` | `app/housing-market/central-oregon/page.tsx` |

**The rule:**

> ```js
> const pattern = new RegExp(
>   `import\\s+(?:\\{[^}]*\\b${escapeRegex(comp.name)}\\b[^}]*\\}|${escapeRegex(comp.name)}(?:\\s*,|\\s+from))`,
> )
> if (pattern.test(src)) continue
> // KbNav lives in layout via PublicNav — do not require page-level import.
> if (comp.name === 'KbNav' && publicNavGlobal) continue
> missing.push(comp)
> ```

It is a **source-text import check**, not a render check. `blocking: true/false` in the JSON
is documentation — the gate ignores it and requires *every* entry in `requiredComponents`.

**Demanded today:**

- R1 (13 required): `MetadataBlock`, `KbNav`*, `KbSectionTracker`, `KbBreadcrumb`,
  `SmoothScrollProvider`, `KbHero`, `KbExploreTowns`, `KbArticles`, `ContentSection`,
  `KbSell`, `RegionalSfrAlertsBand`, `LeadCaptureBlock`, `KbFooter`.
- R2 (24 required): the R1 KB set **plus** the whole legacy 2-segment stack —
  `PageBreadcrumb`, `DisplayHeading`, `HeroBlock`, `MarketSnapshot`, `PriceChart`,
  `MarketDetailStats`, `PriceBandTable`, `CityComparisonTable`, `ContentSection`,
  `LeadCaptureBlock`, `RelatedAreas`, `CTABar`, `FAQBlock`, `KbMarketHud`.
- R3 (11 required): `MetadataBlock`, `KbNav`*, `KbSectionTracker`, `KbBreadcrumb`,
  `SmoothScrollProvider`, `KbHero`, `KbMarketHud`, `KbExploreTowns`, `FAQBlock`, `KbSell`,
  `KbFooter`.

\* `KbNav` is auto-satisfied by `layoutOwnsPublicNav()` while `app/layout.tsx` mounts
`<PublicNav />`.

`scripts/mockup-parity-baseline.json` holds **only** `app/page.tsx`. The Market routes have
zero baselined gaps, so **every dropped import fails immediately** — this is the gate that
killed attempt one.

**What the contract must become:** the `requiredComponents` array becomes the v3 section list
for the route. Nothing about the mechanism changes; only the destination.

**Exact change:**

1. Edit `design_system/ryan-realty/ui_kits/market-report/parity.json` — replace
   `requiredComponents` with the v3 set the rebuilt page actually imports, e.g.
   `V3Instrument`, `V3Field`, `V3Ledger`, `V3Quiet`, plus whatever survives unmoved
   (`MetadataBlock` is a legacy flat file and may legitimately stay). Update `note` and
   `sectionOrder` in the same edit — they are the human half of the contract and go stale
   silently.
2. Same for `market-report-region/parity.json` (R3).
3. `market-report-detail/parity.json` (R2) is the awkward one: it encodes **two** renders in
   one array. Migrating only the 1-segment KB branch means the legacy 2-segment entries must
   stay. Split the contract, or migrate both branches, or state in `note` which entries belong
   to which branch — do not silently delete half the array.
4. **Do not delete `market-report/parity.json`.** Its directory holds `index.html`, and
   `ci:mockup-coverage` fails any `ui_kits/<dir>` that has `index.html` but no `parity.json`
   unless the dir is in `scripts/mockup-coverage-allowlist.json`.
   `market-report-detail/` and `market-report-region/` hold **only** `parity.json` (no
   `index.html`), so those two may be deleted outright without tripping coverage.

**Do not** run `--write-baseline` to make this green. That records the gap as accepted debt
for `app/page.tsx`-style pages and hides exactly what the gate exists to show.

---

### 3.2 `ci:seo-shell` — `scripts/check-seo-shell.mjs` — **HARD BLOCKER**

**Binds:** every `page.tsx` under `app/housing-market` (R1–R9), because `MONEY_PATHS` includes
the directory `'app/housing-market'` and the gate walks it. R10–R15 are out of scope.
R1 additionally carries an exact-match contract.

**The rule — R1's required contract:**

> ```js
> {
>   file: 'app/housing-market/page.tsx',
>   checks: [
>     { re: /titleBottom\s*=\s*["']Housing Market["']/, msg: 'market hub H1 titleBottom must be exact "Housing Market"' },
>     { re: /title:\s*['"]Central Oregon Housing Market['"]/i, msg: 'market hub title must be "Central Oregon Housing Market"' },
>   ],
> },
> ```

**The rule — the KbHero existence lock (applies to the whole repo, not one route):**

> ```js
> const HERO = join(ROOT, 'components/site/kb/KbHero.client.tsx')
> ...
> if (top !== 'Central Oregon' || bot !== 'Homes for Sale') {
>   violations.push({ ... msg: `KbHero defaults must be titleTop="Central Oregon" titleBottom="Homes for Sale"` })
> }
> } else {
>   violations.push({ ... msg: 'KbHero component missing — cannot lock Layer A defaults' })
> }
> ```

**Demanded today:** the literal token `titleBottom="Housing Market"` must appear in R1's
source, and `components/site/kb/KbHero.client.tsx` must exist with those two exact default
strings.

**Why a v3 page cannot satisfy it honestly.** The v3 barrel has no `titleTop`/`titleBottom`.
`V3Instrument` takes `headline`, `V3Stage` takes `headline`, `V3Heading` takes `children`
(verified in `components/site/v3/V3Instrument.tsx:149`, `V3Stage.tsx`, `atoms.tsx:~350`).
Writing a prop literally named `titleBottom` on a v3 page to appease a regex is gate-gaming,
not compliance. Separately, `extractLayerAShell()` harvests `<h1>`, `<H1>`, `titleTop`,
`titleBottom`, `lead`, `title:` and `aria-label` — it has **no case for `V3Heading`**, so the
banned-poetry scan (rule 1) goes **completely blind** on a v3 page. Retargeting the required
check without also teaching the extractor would trade a false failure for a silent hole.

**Honest change — `scripts/check-seo-shell.mjs`, three edits in one commit:**

1. In `extractLayerAShell()` (~line 199), add harvesting for the v3 heading so Layer A copy on
   a v3 page is still scanned:
   ```js
   // v3 barrel headings: <V3Heading level={1}>…</V3Heading> and the headline props
   // the six patterns take (V3Instrument/V3Stage). Without these the banned-poetry
   // scan is blind on every migrated page.
   pushAll(/<V3Heading\b[^>]*>([\s\S]*?)<\/V3Heading>/g, 1)
   pushAll(/\bheadline\s*=\s*\{?\s*(?:v3Text\()?\s*(["'`])([\s\S]*?)\1/g, 2)
   ```
2. Replace R1's `titleBottom` check with one that asserts the same *fact* against the v3
   authoring shape. The page should hold the H1 text in one named constant so the gate has a
   stable anchor:
   ```js
   { re: /titleBottom\s*=\s*["']Housing Market["']|headline\s*=\s*\{?\s*v3Text\(['"`][^'"`]*Housing Market/i,
     msg: 'market hub H1 must carry the exact head term "Housing Market"' },
   ```
   Keep the metadata-title check unchanged — `title: 'Central Oregon Housing Market'` is
   register-independent and R1 already satisfies it (`app/housing-market/page.tsx:114`).
3. **Leave the KbHero existence lock alone until the last KbHero consumer is gone.** Deleting
   `components/site/kb/KbHero.client.tsx` while any page still renders it fails this gate with
   `hero-missing`. When that day comes, retarget rule 3 at the v3 opening pattern's default
   props instead of deleting the rule — the rule's job (a component default cannot smuggle
   poetry into an H1) survives the register change.

---

### 3.3 `ci:kb-breadcrumb-overlay` — `scripts/check-kb-breadcrumb-overlay.mjs`

**Binds:** any public `page.tsx` rendering **both** `KbHero` and `<KbBreadcrumb`. In this
family that is **R1, R2, R3, R11, R12** — verified by grep. R4, R5, R9, R13, R15 render
`KbBreadcrumb` **without** `KbHero`, so the gate skips them today; add a `KbHero` to any of
them and it starts firing.

**The rule:**

> ```js
> if (!/\bKbHero\b/.test(src)) continue // only dark-hero pages
> if (!/<KbBreadcrumb\b/.test(src)) continue
> const re = /<KbBreadcrumb\b([\s\S]*?)\/>/g
> ...
> if (!/\boverlay\b/.test(m[1])) { fails.push(...) }
> ```

**Demanded today:** every `<KbBreadcrumb … />` on those five pages carries `overlay`.
Confirmed present at `app/housing-market/page.tsx:336`, `[...slug]/page.tsx:578`,
`central-oregon/page.tsx:414`, `pulse/page.tsx:150`, `reports/page.tsx:395`.

**Why it self-releases, and why that is the trap.** A page that drops `KbHero` **and**
`KbBreadcrumb` leaves the gate's scope entirely — no edit required, no failure. That is the
cheap answer and it is wrong: the defect this gate exists to stop (a cream bar rendering as a
white strip above a dark immersive hero — the `/housing-market/sisters` regression, 2026-06-20)
is a **class**, and the v3 register has the same dark-opening pattern (`V3Stage` with an
`overlayStrength` scrim). Migrating out of scope silently unships the protection.

**Honest change — `scripts/check-kb-breadcrumb-overlay.mjs`:** generalize the predicate before
the first v3 page ships a dark opening. Add the v3 arm alongside the KB arm:

```js
const darkHero = /\bKbHero\b/.test(src) || /<V3Stage\b/.test(src)
if (!darkHero) continue
const crumb = /<KbBreadcrumb\b/.test(src) || /<V3Breadcrumb\b/.test(src)
if (!crumb) continue
```

...and require the v3 breadcrumb's on-dark tone prop by whatever name the chrome unit gives
it. **This gate cannot be written until the v3 chrome primitive exists** (see §5). If the
migration ships before the chrome unit, record the deferral in `decisions.md` explicitly —
do not let it fall off.

---

### 3.4 `ci:kb-page-contract` (G52) — `scripts/check-kb-page-contract.mjs` — **SILENT-LOSS RISK**

**Binds:** every `app/**/page.tsx` whose **comment-stripped** source contains `kb-root`
(`app/search/**` excluded). In this family, **as the gate actually runs today**: R4, R5, R9,
R11, R12, R13, R15 — **R1, R2 and R3 are silently excluded by the comment-stripper defect in
§2.1** and R10 is correctly excluded (its only `kb-root` is inside a comment at
`app/months-of-supply/page.tsx:268`). Fix §2.1 first, or the three flagship pages are rewritten
with no page contract enforced on them at all.

**The rule:**

> ```js
> const hasSeo = /export\s+const\s+metadata\b/.test(s) || /export\s+(?:async\s+)?function\s+generateMetadata\b/.test(s)
> // Tracker must be RENDERED, not merely imported — an unused import tracks nothing.
> const hasTrackerRendered = /<KbSectionTracker[\s/>]/.test(s)
> ...
> if (s.includes('buildMarketFaq')) {
>   if (!/<MetadataBlock[\s/>]/.test(s)) fails.push(`… computes market FAQ/Dataset but does not render <MetadataBlock>`)
>   const resilient = /buildMarketFaq\([^)]*\bpulse\s*\?\?/.test(s) || /pulse\s*\?\?\s*\{[\s\S]*?\}/.test(s)
>   if (!resilient) fails.push(`… market structured data has no pulse-timeout fallback (pulse ?? snapshot)`)
> }
> ```

**Demanded today:** SEO metadata export + a **rendered** `<KbSectionTracker>`; and for the
four pages that call `buildMarketFaq` (R1, R2, R3, R4) a rendered `<MetadataBlock>` plus a
`pulse ??` timeout fallback.

**The trap.** Detection is `kb-root`. A v3 page renders `V3_ROOT_CLASS` (`'v3'`, verified at
`components/site/v3/atoms.tsx:28`), not `kb-root` — so **the moment a page migrates, G52 stops
checking it.** The page can then ship with no metadata, no section tracking, and no JSON-LD
and the gate stays green. This is the single largest silent-integrity loss in the migration.

**Honest change — `scripts/check-kb-page-contract.mjs`:**

1. Widen the page predicate (~line 39) so a v3 page stays in scope:
   ```js
   return /kb-root/.test(code) || /\bV3_ROOT_CLASS\b/.test(code) || /className=["'`]v3\b/.test(code)
   ```
2. Widen the tracker check so it accepts either register's tracker:
   ```js
   const hasTrackerRendered = /<KbSectionTracker[\s/>]/.test(s) || /<V3SectionTracker[\s/>]/.test(s)
   ```
   If the v3 barrel gets no tracker of its own, the honest answer is that a migrated page keeps
   rendering `<KbSectionTracker>` — it is analytics wiring, not visual language, and importing
   it costs one `kb` import site the ratchet already counts. Say which choice was made in
   `decisions.md`.
3. Leave the `buildMarketFaq` arm exactly as written. It is register-independent and it is the
   §0 protection for the Dataset/FAQPage numbers.

---

### 3.5 `ci:kb-single-source` (G50) — `scripts/check-kb-single-source.mjs`

**Binds:** all of `app/`, `components/`, `lib/`. Every route in the family.

**The rule:**

> ```js
> const RE = /export\s+(?:async\s+)?(?:function|const)\s+(Kb[A-Z][A-Za-z0-9]*)/g
> // …fails if any Kb<Name> component is DEFINED outside components/site/kb/
> ```

**Demanded today:** nothing of the Market routes — they import `Kb*`, never define them.

**What must change:** nothing. This gate is orthogonal to the destination and will not fire
during a v3 migration. **One footgun:** do not name a v3 helper `KbSomething` while parking it
outside `components/site/kb/`. A file called `components/site/v3/KbMarketBridge.tsx` exporting
`export function KbMarketBridge` would fail this gate for a reason that has nothing to do with
the migration. Name v3 things `V3*`.

---

### 3.6 `ci:kb-shared-shell` (G53) — `scripts/check-kb-shared-shell.mjs` — **SELF-RELEASING**

**Binds:** `app/layout.tsx` always; plus every `page.tsx` whose comment-stripped source
contains `kb-root` — same set as G52, and carrying the same §2.1 defect: **R4, R5, R9, R11,
R12, R13, R15 only. R1, R2 and R3 are silently excluded; R10 is correctly excluded.**

**The rule:**

> ```js
> if (!/<PublicNav\b/.test(layoutSrc) && !/<KbNav\b/.test(layoutSrc)) {
>   fails.push(`${LAYOUT} must mount <PublicNav /> (or <KbNav />) — the single public header`)
> }
> if (/<SiteHeader\b/.test(layoutSrc)) { fails.push('… dual chrome is retired') }
> ...
> if (!/kb-root/.test(code)) continue
> const hasFooter = /<KbFooter\b/.test(src) || /\bKbFooter\b/.test(code)
> if (!hasFooter) fails.push(`${file} renders .kb-root but does NOT render <KbFooter>`)
> if (/<KbNav\b/.test(code)) fails.push(`${file} re-mounts <KbNav> — remove it`)
> ```

**Demanded today:** every KB Market page renders `<KbFooter>` and does not re-mount `KbNav`.
All ten comply.

**What changes for v3:** the per-page arm self-releases (no `kb-root` → skipped). **The layout
arm does not.** `app/layout.tsx` currently mounts `<PublicNav />`
(`app/layout.tsx:6, :149`), which renders `KbNav` internally with a route-based self-hide
(`components/site/PublicNav.client.tsx:15-27, :43`). Swapping the layout to a v3 nav **fails
this gate** on `must mount <PublicNav /> (or <KbNav />)`.

**Honest change — `scripts/check-kb-shared-shell.mjs`:** when the chrome unit lands, widen the
layout assertion to accept the v3 nav and keep asserting *exactly one* header:

```js
const mountsHeader = /<PublicNav\b/.test(layoutSrc) || /<KbNav\b/.test(layoutSrc) || /<V3Nav\b/.test(layoutSrc)
if (!mountsHeader) fails.push(`${LAYOUT} must mount exactly one public header`)
```

Keep the `SiteHeader` ban. Until the chrome unit lands, **do not touch `app/layout.tsx`** —
the Market migration does not need to.

---

### 3.7 `ci:default-chrome-footer` (G58) — `scripts/check-default-chrome-footer.mjs` — **HARD BLOCKER**

**Binds:** every public `page.tsx` (all 15 rows; R8 is exempt by name). It uses the same
`code()` comment stripper as G52/G53, so on R1/R2/R3 the `kb-root` half of `hasKb` is
swallowed by the §2.1 defect — those three pass **only** because `KbFooter` also appears in
their stripped source. Fixing the stripper order restores both halves; it changes no verdict
today.

**The rule:**

> ```js
> const hasKb = (c) => /kb-root/.test(c) || /\bKbFooter\b/.test(c)
> const hasSiteFooter = (c) => /\bSiteFooter\b/.test(c)
> ...
> if (kb && site && !DUAL_REGISTER.has(rel)) { fails.push('… renders BOTH the KB footer and SiteFooter') ; continue }
> if (kb || site) continue
> if (ancestorLayoutHasFooter(file)) continue
> const imported = importedCode(file, c)          // one level of local imports
> if (hasKb(imported) || hasSiteFooter(imported)) continue
> fails.push(`${rel} renders no footer: not a KB page (no kb-root/KbFooter), no SiteFooter …`)
> ```

Named allowlists in the file today:

- `REDIRECT_ONLY` = `app/reports/[slug]/[geoName]/page.tsx` (R14),
  `app/housing-market/reports/[slug]/[geoName]/page.tsx` (R8),
  `app/listing/by-key/[listingKey]/page.tsx`.
- `DUAL_REGISTER` = `app/housing-market/[...slug]/page.tsx` (R2) — the one page allowed to
  render both footers, one per branch.

**Why a v3 page fails.** A migrated page has no `kb-root`, no `KbFooter`, no `SiteFooter`. The
one-level import escape does not save it: the barrel specifier `@/components/site/v3` resolves
against the candidates `v3`, `v3.tsx`, `v3.ts`, `v3/index.tsx`, `v3/page.tsx` — the real barrel
is `components/site/v3/index.ts`, which is **not** in that candidate list, and even if it were
it contains none of the three tokens. **`ci:default-chrome-footer` fails on the very first
v3 Market page.** This is a genuine blocker with no honest page-side workaround.

**Honest change — `scripts/check-default-chrome-footer.mjs`, one edit:**

```js
// The public v3 register carries its own footer (docs/plans/PUBLIC_PRODUCT/decisions.md,
// visual lock 2026-08-11). A v3 page satisfies rule 2 the same way a KB page does.
const hasV3 = (c) => /\bV3Footer\b/.test(c) || /\bV3_ROOT_CLASS\b/.test(c)
```

...then use it in the three places `hasKb` is used (the double-footer check, the pass-through,
and the imported-code fallback). Rule 3 must extend too: a page rendering **both** `V3Footer`
and `SiteFooter` is the same double-footer defect and should fail unless it is in
`DUAL_REGISTER`.

**R2 is a special case worth planning for now.** It is in `DUAL_REGISTER` because its two
branches use different registers. Migrating only the 1-segment branch produces a page holding
`V3Footer` **and** `SiteFooter` — legitimate, but only if `DUAL_REGISTER` is taught the v3
pairing. Migrating both branches lets R2 drop out of `DUAL_REGISTER` entirely, which is the
cleaner end state.

---

### 3.8 `ci:kb-a11y-static` — `scripts/check-kb-a11y-static.mjs`

**Binds:** `components/site/kb/kb.css` (checks 1–2) and **every `.tsx` under
`components/site/`** (check 3) — including `components/site/v3/**`. Routes are not scanned
directly, so it binds the family only through the components those pages render.

**The rule (check 3, the one that reaches v3):**

> ```js
> const navyText = /\bcolor\s*:\s*['"]rgba\(\s*16\s*,\s*39\s*,\s*66\s*,\s*(0?\.\d+|0|1)\s*\)['"]/g
> ...
> if (alpha >= 0.64) continue
> failures.push(`… color rgba(16,39,66,${mm[1]}) used as TEXT — navy < 0.64 alpha on cream/white fails WCAG 1.4.3`)
> ```

**Demanded today:** no inline `color: 'rgba(16,39,66,<0.64)'` in any `components/site/**.tsx`.
Green.

**v3 relevance:** the v3 barrel is CSS-token-driven (`ci:public-v3` forbids raw color outside
`tokens.css`), so this check is naturally satisfied — but only for *classes*. An inline
`style={{ color: 'rgba(16,39,66,0.5)' }}` in a v3 file would fail both this gate and
`ci:public-v3`. **No contract change needed.** Note the asymmetry to close later: check 1
(sub-AA text tokens) pins `kb.css` by path and does **not** examine
`components/site/v3/tokens.css`. If v3 grows a low-contrast token it will not be caught. That
is a gate-widening item, not a migration blocker.

---

### 3.9 `ci:market-formula` — `scripts/check-market-formula.mjs`

**Binds:** all of `app/`, `lib/`, `components/`. Every row.

**The rule:**

> ```js
> const BAD_FORMULA = /closed last 30 days (times 2|\* ?2)/i
> // …plus, in lib/data + lib/site only:
> const THRESHOLD = /\bmos\b\s*(<=\s*4|<\s*6|>=\s*6)/i
> ```

**Demanded today:** no page or component publishes the wrong MoS methodology string, and no
data-layer file inlines the verdict thresholds. Verdicts come from `marketVerdict()` and
methodology prose from `MOS_METHODOLOGY_CLAUSE` / `MOS_THRESHOLD_CLAUSE`, all in
`lib/market/classify.ts`.

**What must change:** nothing. **The migration obligation is behavioural, not contractual:** a
v3 page that prints a months-of-supply figure and a verdict must import both from
`lib/market/classify.ts`, and must derive the verdict from the **same rounded value it
displays**. The P6 prototype already hit this defect once ("verdict derived from raw MoS while
display rounded → could print 4.0 beside balanced", `progress.txt` 2026-08-11T08:00). The
first migration attempt hit its cousin: "the verdict on the page and the verdict inside its
FAQ JSON-LD are computed in two different places and can disagree" (`decisions.md`). One
derivation, one number, passed to both the `V3Instrument` headline and `buildMarketFaq`.

---

### 3.10 `ci:market-narrative-integrity` — `scripts/check-market-narrative-integrity.mjs`

**Binds: no route.** It bundles and **executes** `lib/data/market/market-narrative.ts` against
seven fixtures.

> ```js
> const MODULE = 'lib/data/market/market-narrative.ts'
> ...
> } else if (!problems.length) {
>   problems.push(`${MODULE}: does not export buildMarketNarrative — the generator is missing.`)
> }
> ```

**Demanded of the family:** nothing directly. It fires only if the migration edits or deletes
the narrative generator. **Do not delete `lib/data/market/market-narrative.ts`** — the gate
hard-fails on a missing module or a missing `buildMarketNarrative` export.

**What must change:** nothing. Listed here so the next agent does not go looking for a route
contract that does not exist.

---

### 3.11 `ci:market-section-nesting` — `scripts/check-market-section-nesting.mjs`

**Binds:** any file under `app/` rendering **both** `<KbMarketHud` and `<MarketCoreCharts`.
Two such pages exist repo-wide today; in this family the candidates are R2 and R3 (both render
`KbMarketHud`; neither currently renders `MarketCoreCharts` — R4 renders `KbMarketHud` once).

**The rule:**

> ```js
> if (hudAt === -1 || chartsAt === -1) continue
> const closeAt = src.indexOf(HUD_CLOSE, hudAt)
> if (closeAt === -1) { fails.push('… <KbMarketHud> is self-closing but the page also renders <MarketCoreCharts>') ; continue }
> if (chartsAt > closeAt) { fails.push('… <MarketCoreCharts> renders AFTER </KbMarketHud> — a second stacked market section') }
> ```

**Demanded today:** if both appear, the charts are children of the HUD. One market section per
page (Matt, 2026-07-29).

**What must change:** the gate self-releases when `KbMarketHud` leaves the page. **The rule
does not.** "One market section per page" is a product decision, not a KB implementation
detail, and the v3 register can stack two separately-headed market sections just as easily
(`V3Instrument` level 2 beside a `V3Ledger`).

**Honest change — `scripts/check-market-section-nesting.mjs`:** when the Market family lands
on v3, add the v3 pair to the same decidable check:

```js
const PAIRS = [
  { open: '<KbMarketHud', close: '</KbMarketHud>', child: '<MarketCoreCharts' },
  { open: '<V3Instrument', close: '</V3Instrument>', child: '<V3Ledger' },   // name per the real page
]
```

If the v3 page genuinely renders one section, the pair is vacuous and costs nothing. Record the
decision either way — a gate that silently stops applying is how C-17 shipped (eight days of
stacked sections on `/cities/[slug]` because nothing checked).

---

### 3.12 `ci:page-dal` (G8) — `scripts/check-page-dal.mjs`

**Binds:** every `app/**/page.tsx` outside `api/` and `admin/`. All 15 rows.

**The rule:**

> ```js
> const dataFree = /@data-free/.test(firstNonImportLine)   // first 10 lines only
> const importsDal =
>   /from\s+['"]@\/lib\/data(?:\/[^'"]*)?['"]/.test(src) ||
>   /from\s+['"]\.\.\/.+\/lib\/data['"]/.test(src)
> ```

Ratcheted against `scripts/page-dal-baseline.json`. **Eleven of the fifteen Market routes are
in that baseline** — R1, R2, R3, R7, R8, R11, R12, R13, R14, R15, and `app/reports/page.tsx`.
Baselined means "may violate"; it does **not** mean "must violate".

**Demanded today:** a NEW violator fails. R4, R5, R9, R10 are **not** baselined, so if a
migration strips their `@/lib/data` import (e.g. by moving the fetch into a client component)
they fail immediately.

**What must change:** nothing. The v3 barrel is explicitly format-free and fetch-free
(`ci:public-v3` rule 3 + the barrel header: "no primitive here fetches, formats, rounds, or
parses a date"), so the page keeps its `@/lib/data` imports by construction. **Opportunity:**
the migration should *remove* routes from `page-dal-baseline.json` as it fixes them; the gate
prints `Fixed since baseline` to make that visible.

**Do not** add `// @data-free` to a Market page. Every one of them renders live figures.

---

### 3.13 `ci:static-params` — `scripts/check-static-params.mjs`

**Binds:** dynamic routes only — R2, R7, R8, R9, R13, R14, R15.

**The rule:**

> ```js
> const optOut = /@no-static-params/.test(src.slice(0, 600))
> const declaresStaticParams = /\bgenerateStaticParams\s*[\(=]/.test(src)
> // An unconditional `return []` body is a hollow stub, not a real implementation
> const isEmptyStub = /generateStaticParams[\s\S]{0,400}?\breturn\s*\[\s*\]\s*(?:;|\n|\r|\})/.test(src)
> const hasStaticParams = declaresStaticParams && !isEmptyStub
> ```

Baselined violators in the family: R7, R8, R13, R14, R15. **R2 and R9 are compliant and not
baselined** — dropping or hollowing their `generateStaticParams` fails CI.

R2's parity contract also pins the slug set independently:

> ```json
> "generateStaticParams": { "required": true, "coreSlugs": ["bend","redmond","sisters","sunriver","la-pine","tumalo","prineville","terrebonne","black-butte-ranch","eagle-crest","crooked-river-ranch"] }
> ```

(That JSON key is documentation — `check-mockup-parity.mjs` reads only `route` and
`requiredComponents`. The enforcement is `check-static-params.mjs`.)

**What must change:** nothing. Carry `generateStaticParams` through the rewrite verbatim, and
keep the 11 core slugs in R2.

---

### 3.14 `ci:ods-compliance` (G54) — `scripts/check-ods-compliance.mjs`

**Binds: no route in this family.** Every assertion targets
`components/listing/ListingAttribution.tsx`, `app/listing/[listingKey]/page.tsx`,
`lib/data/listings/getListingDetail.ts`, the newest `listing_tile_mv` / `listing_search_mv`
migrations, `lib/search-presets.ts`, `lib/seo-routing.ts`, and `vercel.json`.

**Demanded of the Market family:** nothing. Verified by reading every `must(...)` call.

**The one thing to not do:** §5-4 A.4 bans an indexable public **sold** surface. A v3 Market
page may show closed-sale *aggregates* (that is what `market_stats_cache` is) but must not grow
a per-listing sold results view or a `sold` search preset — `lib/search-presets.ts` is where
that would fail, not the page.

---

### 3.15 `ci:public-ui` — `scripts/check-public-ui.mjs`

**Binds:** all 123 public pages. All 15 rows. This is the ratchet the whole roll runs against.

**The rule (the three ratcheted numbers):**

> ```
> A. nonV3ImportSites  every import declaration on a public page that reaches a non-v3 register
> B. legacyPages       public pages importing at least one non-v3 register and zero v3
> C. mixedPages        public pages importing BOTH v3 and a non-v3 register
> ```
> A and B **may only shrink**. C is tracked, not gated — except:
> ```js
> // once a page imports the barrel, its non-v3 count may never grow
> if (typeof was === 'number' && now > was) regressed.push(`${page}: on v3 and its non-v3 imports grew ${was} -> ${now}.`)
> ```
> Plus the new-page tripwire: a public page absent from `knownPages` that imports any non-v3
> register fails regardless of totals.

**Baseline today:** `nonV3ImportSites: 688`, `legacyPages: 84`, `mixedPages: 0`. Per-route
counts are in §1. All 15 Market routes are in `knownPages`, so no tripwire risk.

**Demanded of the migration:** A and B must come in at or below 688 / 84. Migrating R1
(`kb=11 legacy=5` = 16 import sites) to v3 while keeping, say, `MetadataBlock` and
`KbSectionTracker` moves A from 688 to ~674 and B from 84 to 83. Rule C then locks R1: from
that commit on, R1's non-v3 count may never rise above whatever the re-seed records.

**Exact change:** after the migration commit's code is final, run
`node scripts/check-public-ui.mjs --write-baseline` and commit
`scripts/public-ui-baseline.json` **in the same commit**. The re-seed refuses to write a
number that grew (`--allow-growth` is the deliberate escape and must be defended in review).
Do not re-seed speculatively before the code is final — the seed also rewrites the per-page
map that rule C reads.

---

### 3.16 `ci:public-v3` — `scripts/check-public-v3.mjs`

**Binds:** `components/site/v3/**` only, not routes. Listed because the migration will add
primitives to the barrel, and every addition is checked.

**The rule:** (1) no import from `components/site/kb`, `components/site/primitives`,
`components/site/explore`, `components/ui`, or a flat `@/components/site/<File>`; (2) no hex
or `rgb()/hsl()/oklch()` outside `tokens.css`; (3) no `toLocaleDateString`,
`toLocaleTimeString`, currency `toLocaleString`, or `Intl.NumberFormat` inside a primitive;
(4) every `V3*.tsx` is exported from `index.ts`.

**Demanded of the migration:** any new primitive (the chrome unit's nav/footer/breadcrumb, a
tracker, a market band) obeys all four. Rule 3 in particular means **the page formats every
figure through `lib/format` and passes strings** — which is also what keeps §0's "the number on
screen is the number the source trace covers" true.

**What must change:** nothing in the gate. Green today (8 files, 6 primitives).

---

### 3.17 `ci:breadcrumb` — `scripts/check-breadcrumb.mjs` — **HARD BLOCKER**

**Binds:** every public `page.tsx`. In this family R6, R7, R8, R14 are exempt by explicit
regex; the other eleven are in scope.

**The rule:**

> ```js
> // KbBreadcrumb is the KB-era breadcrumb … It counts as a real breadcrumb
> const hasBreadcrumb = isReExportOnly || /BreadcrumbNav|PageBreadcrumb|KbBreadcrumb/.test(src)
> ```

Plus six hard-fail arms: no deprecated import; no direct `<BreadcrumbNav>` beyond baseline;
`tone="on-navy"` only on `app/search/[...slug]/page.tsx`; banned crumb labels
(`'Ryan Realty'`, Title-Case `'Homes for Sale'`, `'Search'`); no `border-b border-border py-3`
band wrapper.

Current state: `Missing (total): 0`, `Missing baseline (debt): 0`, `NEW missing: 0`. **The
baseline is empty**, so a single crumbless page is an immediate CI blocker.

**Why a v3 page fails.** The recogniser is a three-name literal list. A v3 page rendering
`<V3Breadcrumb>` matches none of them, so it is classified `missing`, is not in the (empty)
baseline, and fails as a NEW missing crumb.

**Honest change — `scripts/check-breadcrumb.mjs`, line ~136:**

```js
// V3Breadcrumb is the v3-era breadcrumb (components/site/v3) — the public-product
// destination register. Same canon (Home root baked in, sentence case), different
// implementation. See docs/plans/PUBLIC_PRODUCT/decisions.md, visual lock 2026-08-11.
const hasBreadcrumb = isReExportOnly || /BreadcrumbNav|PageBreadcrumb|KbBreadcrumb|V3Breadcrumb/.test(src)
```

The label canon (arm 4) and the on-navy scoping (arm 5) are register-independent and should be
left alone — a v3 page must still not emit a `'Ryan Realty'` crumb. **Do not** add
`// @no-breadcrumb` to a Market page and **do not** `--write-baseline`; either move re-creates
the ~19-crumbless-page defect the gate was written for.

**Dependency:** this change requires the v3 breadcrumb primitive to exist. See §5.

---

### 3.18 `ci:heading-display` — `scripts/check-heading-display.mjs`

**Binds:** every `.tsx`/`.jsx` under `app/` and `components/` (minus admin/account/dashboard/
console/mockup-preview). All 15 rows, plus the v3 barrel itself.

**The rule:**

> ```js
> if (!/<h[12](\s|>)/.test(lines[i])) continue          // raw lowercase <h1/<h2 only
> const display = /font-display/.test(tagOpen)
> if (display) continue
> const isDisplayHeading = WEIGHT_TOKEN.test(tagOpen) || hasHeadingScaleSize(tagOpen)
> if (isDisplayHeading) violations.push(`${rel}:${i + 1}`)
> ```
> `WEIGHT_TOKEN = /\bfont-(bold|semibold|medium)\b/`,
> `HEADING_SIZE_TOKEN = /\btext-(xl|2xl|…|9xl)\b/`, plus `text-[≥20px]`.

Live count 0, ceiling 2, tracked debt 2. **Both a NEW path and any rise above the count ceiling
fail.**

**Does v3 pass?** Yes, verified. `V3Heading` renders
`<h1 id={id} className={cn('v3-heading','v3-heading--1', …)}>` at
`components/site/v3/atoms.tsx:362` — plain CSS class names, **no Tailwind weight or size
token**, so `isDisplayHeading` is false and it is never flagged. The gate is currently green
with the barrel in the tree.

**What must change:** nothing — **provided v3 pages render headings through `V3Heading` and
never hand-roll `<h1 className="text-5xl font-bold …">`.** The gate's suggested fix names
`@/components/site/primitives`, which `ci:public-ui` counts as a non-v3 register; following
that advice on a v3 page trades one gate for another. The correct fix on a v3 page is
`V3Heading`, not the primitives package. Worth a one-line note in the gate's failure text so
the next reader does not take the wrong branch:

> `Fix: on a v3 page use <V3Heading> from @/components/site/v3; elsewhere use the H1/H2/DisplayHeading primitives.`

---

### 3.19 `ci:naked-verb-headings` (G62) — `scripts/check-naked-verb-headings.mjs` — **SILENT-LOSS RISK**

**Binds:** all of `app/` + `components/`. All 15 rows.

**The rule:**

> ```js
> const NAKED = new Set(['explore','discover','learn more','browse','get started','welcome','our story','read more','find out more','see more'])
> const HEADING_TAG = /<(h[1-6]|H[1-6]|DisplayHeading)[^>]*>\s*([A-Za-z][A-Za-z ]{0,24})\s*<\/\1>/g
> const HEADING_PROP = /\b(title|heading)\s*=\s*(?:"([^"]{1,25})"|'([^']{1,25})')/g
> ```

**Demanded today:** no `title="Explore"`-class placeholder. Green (1810 files scanned).

**The trap.** The tag arm does not know `V3Heading`, and the prop arm knows only `title` and
`heading`. The v3 patterns take **`headline`** (`V3InstrumentProps.headline`,
`V3StageProps.headline` — verified in the barrel). A migrated page could ship
`headline={v3Text('Explore')}` and the gate stays silent — which is precisely how C-07 shipped
(`KbExploreTowns` defaulted `title = 'Explore'`, the homepage inherited it, and it rendered as
an H2 for months).

**Honest change — `scripts/check-naked-verb-headings.mjs`:**

```js
const HEADING_TAG = /<(h[1-6]|H[1-6]|DisplayHeading|V3Heading)[^>]*>\s*([A-Za-z][A-Za-z ]{0,24})\s*<\/\1>/g
const HEADING_PROP = /\b(title|heading|headline|eyebrow)\s*=\s*(?:"([^"]{1,25})"|'([^']{1,25})'|\{\s*v3Text\(\s*(?:"([^"]{1,25})"|'([^']{1,25})')\s*\)\s*\})/g
```

(and widen the `check()` call sites to read the new capture groups). This costs nothing today
and closes the hole before the first v3 page ships.

---

### 3.20 `ci:market-chart-honesty` — `scripts/check-market-chart-honesty.mjs` — **DELETION BLOCKER**

**Binds:** two files by path, no routes:

> ```js
> const CHART = 'components/site/kb/KbMarketChart.client.tsx'
> const SERIES = 'lib/kb/year-series.ts'
> const chart = readFileSync(CHART, 'utf8')     // throws if the file is gone
> const series = readFileSync(SERIES, 'utf8')
> ```

**The four invariants:** `LINE_INK === '#faf8f4'`; each line's `color: LINE_INK`; no multi-hue
palette array; the path is built by `brokenPath()` with no `C/Q/S/T` curve command; a
`VOLUME_FLOOR` constant with a `soldCount >= VOLUME_FLOOR` filter; and `soldCount` carried
through `buildYearSeries`.

**Demanded of the Market family:** nothing at the route level — but `KbMarketChart` is what
`KbMarketHud` renders on R2, R3 and R4. **Deleting `components/site/kb/KbMarketChart.client.tsx`
crashes this gate with an unhandled `ENOENT`, not a clean failure message.**

**Honest change — required only if the v3 market chart replaces it:**

1. Point `CHART` at the v3 chart file and re-express the four invariants in that file's terms
   (the cream-ink rule becomes `var(--v3-…)` ink; the spline ban and the volume floor are
   register-independent and transfer verbatim).
2. Guard the reads so a missing file produces the honest message rather than a stack trace:
   ```js
   if (!existsSync(CHART)) { console.error(`✗ ${CHART} is missing — the market chart's honesty invariants are unenforced.`); process.exit(1) }
   ```
   The spline ban is a §0 rule ("smoothing invents medians that don't exist"), so it must never
   lapse during the swap.
3. `lib/kb/year-series.ts` is data, not design. **Keep it.** If it moves, update `SERIES`.

---

### 3.21 `ci:seo-routes` + `check-seo-authoring.mjs`

**Binds:** `ci:seo-routes` runs `check-seo-routes.mjs && check-seo-authoring.mjs`.

`check-seo-routes.mjs` scans `app/`, `components/`, `lib/` for three banned literal paths:

> `'/listings'` → use `listingsBrowsePath()` · `'/agents'` → use `teamPath()` ·
> `'/home-valuation'` → use `valuationPath()`

A v3 Market page must not hand-write any of those three strings. Trivially satisfiable.

`check-seo-authoring.mjs` binds the **`app/reports` prefix only** in this family (R12, R13,
R14, R15 — `PUBLIC_ROUTE_PREFIXES` contains `'app/reports'`; `app/housing-market` is **not**
in the list). It requires an exported `metadata` or `generateMetadata`, and for a dynamic
route, `alternates.canonical` — satisfied either literally or by returning `pageMetadata(...)`
/ `generate*Metadata(...)`.

**What must change:** nothing. **The obligation:** the migrated R12/R13/R15 keep their
metadata export and canonical. R14's `metadata` (`robots: { index: false }`,
`canonical: '/housing-market/reports'`) exists purely to satisfy this gate on a
redirect-only route — do not remove it.

---

### 3.22 Eight more gates the brief did not name

| Gate | Binds | What it demands | Change needed |
|---|---|---|---|
| `ci:days-to-pending-source` | all of `app/`, `lib/`, `components/` — AST | A field named `*daysToPending*` may never be bound to an active-inventory DOM aggregate (`medianDom`, `median_active_dom`, `avgDom`, …). Docblock names `/housing-market` as one of the two live defects it was written for ("Sisters at 85 against a real 16"). | **None.** A v3 page carries the same obligation: read `market_pulse_live.median_days_to_pending`, or pass `null` and label the active figure "Median on market · active". |
| `ci:no-report-rpc` | all pages — AST | No public surface may call `get_city_period_metrics` / `get_city_price_bands` / `get_city_metrics_timeseries`, nor import a banned wrapper from `@/app/actions/reports` (the wrapper list is **derived**, so a new wrapper is caught). `/reports` is the docblock's founding defect: cache cards above an RPC table, publishing two contradictory Bend verdicts on one screen. | **None.** The v3 page reads the cache through `@/lib/data`. |
| `ci:report-geo-registry` | `app/`, `lib/`, `components/` — AST set comparison | No file outside `lib/data/geo/report-cities.ts` may inline an array/Set/object literal whose slug-normalized member set exactly equals one of the registry's owned city sets. | **None.** Import the city set; never retype it into a v3 page. |
| `ci:no-explore-route` | route dirs + link scan | `app/reports/explore/` and `app/housing-market/explore/` must not exist, and nothing may link `/reports/explore` or `/housing-market/explore`. | **None.** Do not resurrect an explore surface under a v3 name at those paths. |
| `ci:sitemap-resolvable` | `app/sitemap.ts` + resolver existence | The `housing-market` family declares five resolvers that must exist on disk: R1, R2, R6, R7, R3. The `static-singles` family declares `app/pulse/page.tsx` (R11). | **Only if a route file is deleted or renamed.** Deleting R6 or R7 (the re-export shims) fails here — update `FAMILIES` in `scripts/check-sitemap-resolvable.mjs` in the same change. |
| `ci:nav-reachability` | `lib/site-nav.ts` | `'/housing-market'` and `'/housing-market/reports'` must appear as `href:` literals in the nav source. | **Only if the URLs change.** They should not. |
| `ci:ai-crawler-access` | `app/llms.txt/route.ts` | The route must still reference `'/housing-market/reports/'` and `listMarketReports`. | **Only if the reports family is restructured.** |
| `ci:mockup-coverage` | `design_system/ryan-realty/ui_kits/*` | Every mockup dir holding `index.html` needs a `parity.json` or an allowlist entry. | **Only if `market-report/parity.json` is deleted** — that dir has an `index.html`. Add `"market-report"` to `scripts/mockup-coverage-allowlist.json` with a reason, or keep the contract and rewrite it (preferred). |

Two more, outside `ci:gates` but able to block a deploy verification:

- **`ci:lead-funnels`** (live HTTP) probes `/reports/sales/<city>/<period>` (R15) and requires
  HTTP 200, ≥3,000 bytes, and the literal marker `"Closed sales"`. A v3 rewrite of R15 that
  renames that stat-card label breaks the smoke gate. Either keep the label or update
  `REPORT_MARKERS` in `scripts/check-lead-funnels.mjs`.
- **`ci:route-smoke`** (live HTTP) probes `/housing-market` (R1) for HTTP 200, a non-empty
  `<title>`, ≥5,000 bytes, and no `"Page not found"` / `"Application error"`. A v3 page must
  render ≥5KB of HTML — an over-lean page fails.

---

## 4. The blockers — gates that cannot be satisfied by a v3 page without editing the gate

Four, in the order they will bite.

| # | Gate | Why the page cannot fix it | The honest gate change | File |
|---|---|---|---|---|
| B1 | `ci:default-chrome-footer` | The footer recogniser is the literal set `kb-root` / `KbFooter` / `SiteFooter`. A v3 page has none; the one-level import escape cannot reach the barrel (`index.ts` is not among the resolver's candidate filenames). | Add `hasV3` (`V3Footer` / `V3_ROOT_CLASS`) as a third accepted footer register, and extend the double-footer rule to the v3 pairing. | `scripts/check-default-chrome-footer.mjs` |
| B2 | `ci:breadcrumb` | `hasBreadcrumb` is the literal set `BreadcrumbNav|PageBreadcrumb|KbBreadcrumb`. Baseline is empty, so a v3 crumb reads as a NEW crumbless page. | Add `V3Breadcrumb` to the recogniser. Leave the label canon and on-navy scoping untouched. | `scripts/check-breadcrumb.mjs:136` |
| B3 | `ci:seo-shell` | Requires the literal token `titleBottom="Housing Market"` in R1. The v3 barrel has no `titleBottom` — its patterns take `headline`. Writing the prop anyway is gate-gaming. Separately, `extractLayerAShell` cannot see a `V3Heading`, so the banned-poetry scan goes blind on migrated pages. | Teach `extractLayerAShell` about `V3Heading` and `headline`; rewrite R1's required check to assert the head term "Housing Market" in either register. Keep the KbHero existence lock until the last consumer is migrated. | `scripts/check-seo-shell.mjs` (~199 and ~83) |
| B4 | `ci:mockup-parity` | Requires 13 / 24 / 11 named KB component imports on R1 / R2 / R3, with zero baselined gaps. Any v3 page fails on the first missing name. | Rewrite `requiredComponents` (+ `sectionOrder`, `note`) in the three parity.json files to the v3 sections. Split or annotate R2's dual-branch array. | `design_system/ryan-realty/ui_kits/market-report{,-detail,-region}/parity.json` |

**B1 and B2 both depend on the v3 chrome primitives existing.** They are the reason
`p9-chrome-unit` unblocks every family at once: the barrel today exports only `atoms` plus the
six patterns (Instrument, Field, Ledger, Quiet, Sheet, Stage) — **no nav, no footer, no
breadcrumb** (verified against `components/site/v3/index.ts` and the directory listing).
Attempting the Market migration before the chrome unit means either shipping a v3 body under
KB chrome (legitimate — rule C explicitly permits the mixed migration front) or blocking on
B1/B2.

**The path of least resistance, and it is legitimate:** migrate the *body sections* to v3 while
the page keeps `KbBreadcrumb` and `KbFooter`. Then B1 and B2 do not fire at all, `ci:public-ui`
counts a real shrink, and the page appears in the `mixedPages` column as the visible migration
front. Only B3 and B4 remain, and both are contract edits with no dependency on the chrome
unit.

---

## 5. Gates that go SILENT when a page leaves KB

These do not block. They stop protecting, which is worse, because nothing announces it. Each
must be widened in the same commit that migrates the first page, or the protection is gone and
nobody will notice for months.

| Gate | Trigger it loses | What stops being protected | Fix |
|---|---|---|---|
| `ci:kb-page-contract` (G52) | `kb-root` in the page | SEO metadata export, **rendered** `<KbSectionTracker>`, `<MetadataBlock>` emission, and the `pulse ??` JSON-LD timeout fallback. A migrated page could ship untitled and untracked, green. **Already lost on R1/R2/R3 — see §2.1.** | Fix the comment-stripper order (§2.1), then widen the page predicate to `V3_ROOT_CLASS` / `className="v3"` and widen the tracker check. §3.4. |
| `ci:kb-shared-shell` (G53) | `kb-root` in the page | The single-footer / no-double-nav pairing. **Already lost on R1/R2/R3 — see §2.1.** | Fix the stripper order; the per-page arm can then lapse once B1 covers footers, but the **layout arm must be widened** before any v3 nav lands. §3.6. |
| `ci:kb-breadcrumb-overlay` | `KbHero` + `KbBreadcrumb` in the page | The cream-bar-over-dark-hero regression, on a register that has the same dark opening (`V3Stage` + `overlayStrength`). | Generalize the dark-hero and crumb predicates. §3.3. |
| `ci:naked-verb-headings` (G62) | `title=` / `heading=` props | `headline={v3Text('Explore')}` ships silently. This is C-07 with a new prop name. | Add `V3Heading` to the tag arm and `headline` to the prop arm. §3.19. |
| `ci:market-section-nesting` | `KbMarketHud` + `MarketCoreCharts` | "One market section per page" (Matt, 2026-07-29). Two stacked v3 market sections would pass. | Make the gate pair-driven and add the v3 pair. §3.11. |
| `ci:seo-shell` rule 1 | `<h1>` / `titleTop` / `titleBottom` in the shell extractor | The banned-poetry scan across all nine `app/housing-market/**` pages. | Teach `extractLayerAShell` about `V3Heading` / `headline`. §3.2. |
| `ci:kb-a11y-static` check 1 | pinned to `components/site/kb/kb.css` by path | Sub-AA text tokens in `components/site/v3/tokens.css` are unexamined. | Add the v3 token file to the check-1 scan. §3.8. Not a blocker; do it while the context is loaded. |

---

## 6. Change checklist, in dependency order

**Phase A — gate widenings that are free today (no dependency, no behaviour change, do first):**

0. **`scripts/check-kb-page-contract.mjs`, `scripts/check-kb-shared-shell.mjs`,
   `scripts/check-default-chrome-footer.mjs`** — strip line comments **before** block comments,
   so R1/R2/R3 come back into scope. This is the §2.1 defect and it comes first: it is the
   difference between rewriting the three flagship pages under contract and rewriting them
   unwatched. Break-test: KB page count 60 → 63 (G52), 62 → 65 (G53), all three newly-visible
   pages pass on today's source.
1. `scripts/check-naked-verb-headings.mjs` — add `V3Heading`, `headline`, `eyebrow`. (§3.19)
2. `scripts/check-seo-shell.mjs` — `extractLayerAShell` learns `V3Heading` + `headline`. (§3.2 step 1)
3. `scripts/check-kb-page-contract.mjs` — page predicate + tracker predicate learn v3. (§3.4)
4. `scripts/check-kb-a11y-static.mjs` — check 1 also reads `components/site/v3/tokens.css`. (§3.8)
5. `scripts/check-market-chart-honesty.mjs` — `existsSync` guards so a deletion fails honestly instead of throwing. (§3.20 step 2)

Each of these must be **break-tested** (introduce the defect, watch it fire, restore, watch it
pass) per the canon rule that the fixer writes the gate.

**Phase B — the R1 migration commit (all in one commit, or `ci:gates` blocks the push):**

6. `design_system/ryan-realty/ui_kits/market-report/parity.json` — `requiredComponents`,
   `sectionOrder`, `note` rewritten to the v3 sections. (§3.1)
7. `scripts/check-seo-shell.mjs` — R1's required check rewritten to assert the "Housing Market"
   head term in either register. (§3.2 step 2)
8. `app/housing-market/page.tsx` — the rebuild. Keep: `metadata.title = 'Central Oregon Housing
   Market'`; `@/lib/data` imports; `MetadataBlock` + the `pulse ??` fallback; a rendered
   section tracker; one derivation for the MoS verdict feeding both the headline and
   `buildMarketFaq`. State explicitly which sections are **deleted** (the prior attempt silently
   dropped `KbHero`'s property search and voice-search button). Leave no discarded data read in
   a `Promise.all` positional hole. Never synthesize zero rows for a missing city under a
   live-MLS source line.
9. `scripts/public-ui-baseline.json` — re-seeded via
   `node scripts/check-public-ui.mjs --write-baseline` **after** the code is final. (§3.15)
10. Optionally drop `app/housing-market/page.tsx` from `scripts/page-dal-baseline.json` if it
    now imports the DAL cleanly.

**Phase C — only when the v3 chrome primitives exist:**

11. `scripts/check-default-chrome-footer.mjs` — `hasV3`. (B1)
12. `scripts/check-breadcrumb.mjs` — `V3Breadcrumb`. (B2)
13. `scripts/check-kb-shared-shell.mjs` — layout header assertion accepts the v3 nav. (§3.6)
14. `scripts/check-kb-breadcrumb-overlay.mjs` — v3 dark-hero + crumb arms. (§3.3)

**Phase D — the rest of the family**, R3 then R2 (dual-register, hardest), then R11/R12/R13/R15,
then R4/R5/R9. R6/R7/R8/R14 are re-export and redirect shims: migrate their targets, not them.
R10 is already off KB and on `legacy + primitives` — it needs the same v3 treatment but binds a
different, smaller gate set (no KB gate touches it).

---

## 7. Verification recipe for the next agent

```bash
# 1. Baseline the tree BEFORE editing, so you can tell your failures from pre-existing ones.
for g in mockup-parity mockup-coverage seo-shell seo-routes kb-breadcrumb-overlay \
         kb-page-contract kb-single-source kb-shared-shell default-chrome-footer \
         kb-a11y-static market-formula market-narrative-integrity market-section-nesting \
         page-dal static-params ods-compliance public-ui public-v3 breadcrumb \
         heading-display naked-verb-headings market-chart-honesty days-to-pending-source \
         sitemap-resolvable nav-reachability ai-crawler-access no-explore-route \
         no-report-rpc report-geo-registry; do
  node scripts/check-$g.mjs >/dev/null 2>&1; echo "$g exit=$?"
done
# Expected on 2026-08-12: all 0 except page-dal=1 (app/dev/sell-film, unrelated).

# 2. After the change, the full chain — this is what npm run push materializes.
npm run ci:gates

# 3. Ratchet direction, explicitly.
node scripts/check-public-ui.mjs           # A and B must be <= 688 / 84
node scripts/check-mockup-parity.mjs       # NEW missing must be 0 on R1/R2/R3
node scripts/check-breadcrumb.mjs --json   # newMissing must be []
```

Do not make a gate green by adding a baseline entry, an opt-out comment
(`// @data-free`, `// @no-breadcrumb`, `// @no-static-params`, `// heading-display-ok`), or an
allowlist row. Every one of those exists for a real exception, and none of the Market routes is
one. If a gate is wrong about the destination, **change the gate and say why in its docblock** —
that is the rollout rule this family already learned once.
