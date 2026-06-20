# Page Review & Redesign — Runbook + Handoff

> **Purpose:** a repeatable process that takes every public page, *actually renders and looks at it* (not "reads the code and declares it fixed"), tears down the best competitor's equivalent page for content + structure, then rebuilds our page to beat that competitor while conforming to the kinetic‑brutalist design system — and *proves* each fix with before/after artifacts so nothing is ever "claimed fixed but isn't" again.
>
> **How to run in a new session:** open an **ultracode** session and paste the prompt in **§0**. Everything the session needs is baked into this file (design checklist, QA rubric, chart spec, page backlog, competitor bars). No external lookups required to start.

---

## 0. THE PROMPT — paste this into a new ultracode session

```
ultracode

Read docs/plans/PAGE_REVIEW_REDESIGN_RUNBOOK.md in full, then run the Page Review &
Redesign process it defines, ONE page-class at a time, in the priority order in §6.

Non‑negotiable operating rules:
- RENDER, DON'T READ. A page is never "good," "fixed," or "conformant" until a
  screenshot proves it AND a named check passes. Reading the code and concluding
  "the fix is in place" is exactly the failure that created this backlog — the code
  said the market chart was linear and the JSON leak was fixed while the live page
  showed wavy spaghetti and `Style ("Northwest": true)`. Trust the rendered pixels,
  not the source.
- Verify against the LIVE Vercel prod deploy (local dev is Windows‑only here). Use
  the Playwright + axe harness in §8 at 390 / 768 / 1366 widths. Look at the
  screenshots yourself (multimodal) before scoring.
- Every finding = (check ID, pass|fail, artifact path). Every "fixed" = a
  before‑failing artifact + an after‑passing artifact on the POST‑FIX deploy SHA.
  No artifact, no claim.
- Conform to the brutalist checklist (§3), clear the visual‑QA rubric ≥80/100 with
  all crash/correctness/chrome gates green (§4), and beat the competitor bar for
  that page‑class (§6). Reuse the shared components/site/kb/* sections — never fork
  (no‑fork rule). Honor CLAUDE.md §0 (data accuracy), Draft‑First, and the Video
  Review Gate.
- When you fix a class of bug, lock it behind a standing gate (gates‑not‑prose, §7).
- ANTI‑REGRESSION IS THE ENTIRE POINT (§1.5). Anything fixed once must never break
  again. A fix lands WITH its gate in the SAME commit, and every run re‑executes the
  full prior‑fix regression suite BEFORE touching new work — if a previously‑fixed
  check is red, stop and restore it first. A fix that isn't render‑proven and
  gate‑locked WILL regress. That is exactly how the chart, the JSON leak, and the
  listing layout backslid. We do not claim — we prove, then lock.

For each page run the six‑phase loop in §2 (Render → Teardown → Synthesize → Redesign
→ Verify → Lock). Surface each page's before/after + score for my approval before you
move to the next page. Start with page‑class #1 in §6 and work down.
```

> Run it as a **Workflow** (suggested shape in §8) so each page pipelines through the
> six phases and "fixed" claims get adversarially re‑verified. Fan out one page‑class
> per pipeline item; keep me in the loop between page‑classes.

---

## 1. Why this exists — the core failure mode

The site keeps getting things "claimed fixed but they aren't." Concrete, current evidence (Matt's 2026‑06‑18/19 screenshots):

- **Market chart** — the "5‑year overlay" renders as **over‑smoothed wavy spaghetti** on dense geos and **jagged zigzags** on sparse geos, and the current year's line **ends mid‑axis** while prior years run full‑width ("lines end at different points, very confusing"). A pure code audit concluded "linear polyline, NOT a bug." The rendered page disagrees. **One of them is wrong, and only rendering tells you which.**
- **Listing page** — the chrome is KB, but the body is a **patchwork**: only 13 of 23 `components/site/listing-detail/*` sections use the KB section system, several lean on ad‑hoc inline `style={{…}}`, and data‑empty sections degrade to bare‑text fallbacks ("the rental analysis is not formatted at all"). A code audit called every one "KB‑conformant." The screenshots show drift.
- **MLS JSON leak** — `Style ("Northwest": true)` printed raw on a live listing while the code's `formatMlsMultiSelect()` "covered" it. The field on the page wasn't the field the formatter was wired to.

**The lesson baked into this process: "renders / compiles / gate‑green" ≠ "looks good and is correct."** The only authority is the rendered page at real breakpoints, looked at, with falsifiable checks. This runbook makes that the law.

---

## 1.5 The anti‑regression law — the whole point of this exercise

**We started regressing when the entire purpose was to never regress.** The chart got "fixed" and went wavy again. The `Style ("Northwest": true)` leak got "fixed" and reappeared. The listing layout got "unified" and drifted into a patchwork. That is unacceptable, and it has a single root cause: **fixes were *claimed* (at the code level) instead of *proven* (at the render level) and *locked* (behind a gate).** A fix that is only a code change is a fix with a half‑life — the next refactor, data shape, or cache bust silently undoes it.

The law, enforced on every page and every fix:

1. **Proven, not claimed.** A fix does not exist until a rendered before‑failing artifact and a rendered after‑passing artifact of the same check, on the post‑fix deploy SHA, both exist. "The code now does X" is not a fix. Open the screenshot.
2. **Locked in the same commit.** Every fixed bug‑class ships *with* its mechanical gate in the same commit (§7). A fix without a gate is not done — it is a future regression with a delay timer. No gate, no green; no green, no ship.
3. **The regression suite runs first, every time.** Before any new work in a run, re‑execute the full suite of every prior fix's check across all affected routes. If any previously‑green check is red, **stop and restore it before doing anything else.** New features never get built on top of a silent regression.
4. **One standing "fixed‑things stay fixed" gate set.** Maintain `out/page-qa/REGRESSION_MANIFEST.json` — every fixed defect → its check ID, the routes it covers, and the gate that locks it. The suite reads this manifest; adding a fix appends to it; the manifest can only grow. (Baseline ratchets only ever loosen with Matt's explicit approval cited in the commit — same rule as the other ratcheted gates.)
5. **Gate the class, not the instance.** Fixing `Style` on one listing is worthless if `roof` leaks on another. Gates target the *class* (e.g. "no raw `{"…":true}` JSON renders in any PropertySpec field on any listing"), verified by rendering representative + edge‑case data, not one happy‑path row.
6. **Render‑truth beats code‑truth, always.** When a code audit says "fixed" and a screenshot says "broken," the screenshot wins and the audit is the bug. This is non‑negotiable and is why every claim in this process carries an artifact.

If you ever catch yourself about to write "the code shows the fix is in place, so it's fixed" — that sentence is the regression. Stop, render it, grade the pixels, then lock it.

---

## 2. The process — the six‑phase per‑page loop

Run this for each page‑class. Each phase produces artifacts; later phases cite them.

### Phase A — RENDER & SEE (evidence first, before any opinion)
1. Pin the deploy SHA being graded (`x-vercel-id` / build hash) and stamp it into every artifact path: `out/page-qa/<sha>/<route-slug>/<viewport>/`.
2. For each viewport **390 / 768 / 1366** (§4.1): full‑page screenshot + above‑the‑fold + **one bounded screenshot per major section** (hero, every `section`, nav, footer, chart, form, map).
3. Run the **functional checks F1–F12** (§4.2) — all binary, all evidenced (console, HAR, axe JSON, CWV, DOM probes).
4. **Actually look** at the screenshots (multimodal). Score the page against the **rubric** (§4.3). Write `findings.json`: every check ID → `pass|fail` + artifact path + one‑line note.
   - *A grade with no `findings.json` is void. "Hero looks good" with no section crop is rejected.*

### Phase B — COMPETITOR TEARDOWN
1. Pull the 2–3 best competitor equivalents for this page‑class from §6 (URLs baked in). Fetch where allowed; reconstruct from search snapshots where they 403 (Redfin/Zillow/Realtor block direct fetch).
2. Extract **CONTENT** (what data/sections they show) and **STRUCTURE** (order, hierarchy, density, CTAs).
3. Name their **weaknesses/gaps** (where we can win) and write the **specific bar** our page must clear to beat them.

### Phase C — GAP SYNTHESIS
Diff our *rendered* page against three references and produce one prioritized fix list, each item = `{defect, evidence artifact, target state, which reference it fails}`:
1. **Brutalist conformance checklist** (§3) — design‑system fidelity.
2. **Visual‑QA rubric + functional checks** (§4) — quality + correctness.
3. **Competitor bar** (§6) — content + structure parity‑plus.

### Phase D — REDESIGN & FIX
- Implement the fix list. **Reuse `components/site/kb/*` sections (no‑fork)** so improvements propagate everywhere; parameterize via props rather than copy. New section types get built as KB sections (`.section`/`.wrap`/`.sec-head`/`.sec-title display`/`.eyebrow sec-index`/`.mono-num`).
- Apply the **brutalist checklist** (§3). Apply the **market‑chart spec** (§5) to every chart surface.
- Honor **CLAUDE.md §0** — every number traces to its source, recompute YoY/MoS, verdict pills match their numbers.
- Listing‑detail specifically: bring all 23 sub‑components onto the KB section system, replace inline `style` with KB classes, and give every data‑driven section a **designed empty state** (no bare‑text fallback). Re‑order to the decision order in §6.3.

### Phase E — VERIFY (fail→pass, on the new build)
- Re‑render on the **post‑fix deploy SHA** (not the one the bug was reported on).
- For each fixed check, record the **before‑failing** and **after‑passing** artifact pair. A fix without that pair is a claim, not a fix.
- Page must hit **≥80/100** AND F1/F2/F4/F11/F12 all green (crash/correctness/chrome gates can't be bought past by a high cosmetic score).
- Re‑confirm the competitor bar is cleared with a side‑by‑side.

### Phase F — LOCK
- Turn each fixed bug‑class into a **standing gate** (gates‑not‑prose, §7) so it can't silently regress. The screenshot is the evidence; the gate is the lock; a green grep never substitutes for the rendered shot.
- Commit with the evidence referenced. Surface before/after + score to Matt for approval before moving to the next page‑class.

---

## 3. Brutalist design conformance checklist (baked in)

The kinetic‑brutalist system is **the existing navy/cream KB system rendered with harder edges and bigger type** — not a new palette. Source of truth: prototype `out/concept/v2/kinetic-brutalist.html`; production port `components/site/kb/kb.css` (`.kb-root`); reusable impl `components/site/kb/Kb*`. Grade every page against these 15 items (each pass/fail, each evidenced by a section screenshot):

1. **Two inks only** — navy `#102742` + cream `#faf8f4` (+ opacity steps). Utility‑only: `#0b1c30` (image/card placeholder), `#fff` (nav text on photo + shadow). **Any third hue, any gray, or gold = fail.**
2. **Muted text token** — muted text on navy uses `--cream-muted` (`rgba(250,248,244,.60)`, 5.99:1). `--cream-40` is dividers only, **never** a text color. (Locked by `ci:kb-a11y-static`, G54.)
3. **Display face = Amboqia Boriango** (`var(--font-amboqia)`), single weight (never faux‑bold), `line-height .86–.96`, `letter-spacing -.01em`, **UPPERCASE**, sized in viewport units (hero `clamp(2.4rem,8.5vw,7rem)`, section title `clamp(1.9rem,5.4vw,3.6rem)`). Every heading, price, stat, town/listing name.
4. **Body/UI = Geist** (`var(--font-sans)`, 400/500/600/700). Numbers carry `.mono-num` (tabular‑nums, `letter-spacing -.02em`). Eyebrows: `.eyebrow` `letter-spacing .28em`, weight 600, uppercase. The tight‑Amboqia / wide‑tracked‑Geist tension is the type signature.
5. **The 3px edge** — `--edge: 3px solid` borders on section heads, cards, buttons, rows, ticker, team cells. Hairlines (`1px var(--*-12/40)`) for sub‑rows. Hard rectangles; radii near‑zero on structural elements (only chips/inputs get 5–7px, search dials 50%).
6. **Section‑head pattern** on every section: `.sec-head` = baseline‑aligned flex, `border-bottom: var(--edge) solid currentColor`, left = **mono index/eyebrow** (`01 / Explore`, `02 / Communities`, …) or a labeled eyebrow, right = big Amboqia `.sec-title`. **Every section head carries an index number or an eyebrow.**
7. **Alternating navy/cream bands** — sections hard‑alternate ground color; a run of same‑ground sections is broken deliberately.
8. **Asymmetric bento/poster grids** — featured uses 6‑col with spans 6/3/3/4/2; communities = horizontal scroll‑snap rail; team = `--edge` right borders with `last-child` reset. Deliberate asymmetry, not a uniform card grid.
9. **Every section ends in a CTA** (`.sec-cta` → `.btn`): uppercase `.78rem` weight 700 `letter-spacing .1em`, `--edge` border, **fill‑invert on hover** + `translateY(-2px)` + arrow `translateX(4px)`. Variants `.btn` / `.btn.alt` / `.btn.ghost`.
10. **Motion stack** — Lenis 1.1.20 (inertial smooth scroll) + GSAP 3.12.5 + ScrollTrigger (reveals, parallax, count‑ups, chart draw) + MapLibre GL 4.7.1. Scroll‑reveals via GSAP; **`prefers-reduced-motion: reduce` fully honored** (no reveal/parallax when set).
11. **Signature moments present + correct** — kinetic hero (auto‑fit display lines to ~98% column), ticker/marquee, kinetic stat reveal (count‑up), listings map, footer "Let's talk." close.
12. **Type‑clip safety (ship‑blocker)** — display type uses `overflow:visible`; reveal masks clip **bottom‑only** (`clip-path: inset(-0.5em 0 0 0)`), never cap‑tops; `fitShrink()` self‑corrects overflow. **Never wrap display type in bare `overflow:hidden`.** (9‑width clip gate `shots/_cliptest.mjs`.)
13. **Container** — `.wrap` max‑width 1500px, responsive padding 18→40→56px.
14. **Mobile caps** — `@media (max-width:760px)` hard‑caps display sizes (`!important`) so nothing overflows a phone. Confirm at 390px.
15. **Single chrome** — exactly one `KbNav` + one `KbFooter`; the route is in `HideChrome` (HideOnLP) so global `SiteHeader/SiteFooter` don't double‑render.

> Relationship to existing components: the brutalist system is an **evolution of KB, not a replacement.** Most `Kb*` sections already conform; the work is (a) bringing non‑KB sections (listing‑detail sub‑components, hand‑rolled `/buy` & `/team/[slug]` sections) onto these primitives, and (b) replacing inline styles with KB classes.

---

## 4. Visual + functional QA — the falsifiable loop (baked in)

**Core principle:** a page is not good until a screenshot proves it and a named check passes. Every grade cites an artifact.

### 4.1 Environment & viewports
- Target = **live Vercel prod URL**, never localhost. Pin + stamp the deploy SHA.
- Playwright Chromium, one browser per run, fresh context per viewport. Inject `node_modules/axe-core/axe.min.js`, run `axe.run()`.
- Determinism: `prefers-reduced-motion: reduce`, locale `en-US`, timezone `America/Los_Angeles`, wait `networkidle` + settle for late‑mounting charts/maps.
- Viewports: **Mobile 390×844** (dominant RE traffic; where clipping/overflow bite), **Tablet 768×1024** (the 3→2→1 reflow hinge), **Desktop 1366×768** (real laptop width; 1920 hides cramped layouts). A desktop pass never implies a mobile pass.

### 4.2 Functional checks (binary, evidenced)
| ID | Check | Pass condition |
|---|---|---|
| F1 | Console/page errors | Zero error‑level + zero uncaught; React #418/#423 hydration = hard fail |
| F2 | Failed requests | No 4xx/5xx own‑origin; no failed JS/CSS/font |
| F3 | Broken images | Every img/bg has `naturalWidth>0`, not the placeholder |
| F4 | Overflow/clipping | No horizontal scroll (`scrollWidth>clientWidth` on body); no clipped display heading; all 3 widths |
| F5 | Forms submit | Renders, validates, 2xx; `<SmsConsentDisclosure>` on every phone form (A2P lock) |
| F6 | Maps load | Tiles paint; no `google.maps`‑before‑load; container nonzero height |
| F7 | Video plays | Mounts nonzero box, `readyState≥2`, no CSP `frame-src` block; tour iframes `w-full` |
| F8 | Filters/interactive | Filters/tabs/accordions change state + update results (guards "filter silently returns 0") |
| F9 | LCP/CWV | Lab LCP≤2.5s, CLS≤0.1, INP≤200ms — lab advisory; reconcile vs `web_vitals` field p75 |
| F10 | axe a11y | Zero critical/serious; moderate logged |
| F11 | Single chrome | Exactly one header + one footer |
| F12 | Data correctness | Every visible stat/price/count traces to source (§0); no trace = fail |

### 4.3 Visual quality rubric — 0–100 weighted
Score each 0–10 × weight; a dimension score is invalid without its citing artifact.

| Dimension | Wt | 9/10 | 4/10 |
|---|--:|---|---|
| Design‑system conformance | 18 | §3 fully met; matches mockup | off‑token greys, Geist where Amboqia belongs, hand‑rolled controls |
| Hierarchy & legibility | 14 | clear H1→H2→body, one focal point, ≥4.5:1, sentence case | competing headings, flat scale, low‑contrast on photos |
| Content completeness | 12 | every section real content, no empty/orphaned | empty modules, placeholder, half‑loaded |
| **Data correctness** | 16 | every figure traced + math recomputes; pills match | **any wrong/untraceable number caps the page ≤5/10 overall** |
| Responsiveness | 14 | clean reflow 390/768/1366, no overflow/clip, ≥44px touch | overflow, clipped type, crushed grids |
| Interaction | 10 | F5–F8 pass; visible focus rings; hover/active | dead form, collapsed map, broken filter |
| Performance | 8 | F9 green in field p75; no load shift | CLS jank, field‑confirmed slow LCP |
| Accessibility | 8 | F10 zero critical/serious; full keyboard path | critical axe, unlabeled controls, traps |

**Page gate:** ship floor **80/100** AND F1/F2/F4/F11/F12 green. **Auto‑zero ship‑blockers** (wrong number, hydration crash, double chrome, broken public form) override any headline score.

### 4.4 Anti‑"claimed‑fixed" protocol
Every claim = (check ID, pass/fail, artifact). A fix = before‑failing + after‑passing artifacts of the same check on the same route+viewport, re‑run on the **post‑fix SHA**. A reviewer can replay every artifact. Fixed bug‑classes become standing gates.

---

## 5. Market‑chart fix spec (baked in)

The visible broken chart is the **KB year‑overlay** (`components/site/kb/KbMarketChart.client.tsx`, rendered via `KbMarketHud` on homepage / city / community / neighborhood). Other chart surfaces to bring onto the same spec (or, better, the same single component — no‑fork): `components/site/PriceChart.client.tsx`, `components/search/MarketSnapshotChart.tsx`, `components/seller-lp/MarketVisuals.client.tsx`, `components/geo-page/GeoMarketOverview.tsx`.

```
DATA
- Source: market_stats_cache via getPriceHistory() ONLY. Render, never recompute (§0).
- Per year: { year, points:[{ month:1..12, median:number|null, soldCount:number }] }.
- Current year: months after lastClosedMonth are ABSENT (not null-filled-then-drawn).

INTERPOLATION  (this is the wavy-spaghetti fix)
- curve = linear (default). Permitted escalation: monotone/PCHIP ONLY. Natural/cubic spline BANNED
  (it overshoots and INVENTS medians a month never had — a §0 violation).
- Invariant (unit test): rendered y at month m == source median (linear), and never exceeds
  [min,max] of adjacent real points (monotone). Overshoot test must pass.

INCOMPLETE YEAR  (this is the "lines end at different points" fix)
- Current year solid Jan..lastClosedMonth, then NOTHING. connectNulls:false. No Dec phantom,
  no stretch to year-end, no interpolation across the gap — empty future reads as "not finished."
- Cutoff: vertical reference line + 'As of <Mon YYYY>' at lastClosedMonth.
- Caption: '<Year> reflects Jan–<Mon>; full-year not yet complete.'
- Any YoY stat beside the chart = YTD-through-SAME-month vs prior year same window. Never YTD-vs-full-year.
- Forecast (if ever): dashed + desaturated + 'projected' label. Off by default.

SERIES  (this is the spaghetti-legibility fix)
- Max 5 years overlaid; EMPHASIZE one. Emphasis (current/subject year) = navy #102742, 2.5px, solid,
  right-end direct label (bold). Prior years = navy tints rgba(16,39,66,a) stepped 0.18..0.55 by
  recency (oldest faintest), 1.5px, direct-labelled. No legend-only hunting. Grayscale-distinguishable.
- mode: 'overlay' | 'small-multiple'. A dense geo that still reads as spaghetti -> 'small-multiple'
  (one mini-panel per year, shared Y, year as panel title).

SPARSE GEO  (this is the jagged-zigzag fix)
- Drop any month with soldCount < N (default 5); break the line (no segment through 2 sales).
- Optional honest smoothing = 3-month trailing MEDIAN (a real statistic), axis labelled '3-mo median'.
- Still too thin -> quarterly points, axis labelled quarterly. Never interpolate a gap.

AXIS
- X: shared Jan..Dec all years. Y: data-range padded to nearest $25k, domain = min/max across ALL
  plotted years (one shared scale; mandatory for honest comparison + small-multiples).
- Numbers tabular-nums; currency to nearest $1k; compact ticks ($895k / $1.2M).

HONESTY GATE (lock it, gates-not-prose)
- No drawn point/segment may represent a value absent from market_stats_cache.
- CI check: render year-overlay for one dense + one sparse geo; assert (a) no horizontal overflow,
  (b) current-year path ends at lastClosedMonth x, (c) every vertex y == a source median,
  (d) months below the volume floor have no vertex.
```

**Beyond fixing:** the competitor teardown says a clean interactive multi‑year median chart is the single biggest win in Bend (every local competitor ships static PNGs or no chart). Once correct, make it the best chart in Bend: hover tooltips, property‑type/bed toggles, recency + source stamp.

---

## 6. Page backlog + per‑page competitor bar (priority order, baked in)

Work top‑down. For each: the route, what to render‑verify first (the suspected defect), and the competitor bar to beat. **Treat the "current state" as unverified until you render it — the code‑audit verdicts have already been wrong.**

### 6.1 — `/housing-market/*` market reports + the chart  ★ highest leverage
- Routes: `/housing-market`, `/housing-market/central-oregon`, `/housing-market/[...slug]`, `/housing-market/reports/[slug]`. Chart via `KbMarketChart`/`KbMarketHud`.
- Render‑verify first: the **year‑overlay chart** on a dense geo (Bend) AND a sparse geo (e.g. Sunriver) at all 3 widths. Confirm interpolation, endpoint behavior, legibility against §5. This is the #1 reported defect.
- **Competitors:** Redfin `redfin.com/city/1543/OR/Bend/housing-market`, Zillow `zillow.com/home-values/50962/bend-or/`, **bendpropertysource.com/market-statistics-and-data/** (local gold standard), justinbend.com (editorial).
- **Bar to beat:** working interactive multi‑year chart (nobody local has one) + Redfin's full metric battery (median+YoY, sold, DOM, sale‑to‑list, %‑above‑list, %‑price‑drops) + bendpropertysource's local‑MLS depth (absorption, months‑of‑supply, seller‑concession trend, cash‑vs‑financed, sale‑to‑original‑list) + a forecast (beats Zillow's only edge) + recency/source stamp + a Bend‑specific "what this means for you" position + neighborhood link mesh.

### 6.2 — `/listing/[listingKey]` listing detail  ★ Matt's active complaint
- Render‑verify first: every one of the 23 `components/site/listing-detail/*` sections — confirm KB‑section conformance, **empty‑data states** (the "rental analysis not formatted" case), and **no raw MLS JSON** (`Style ("Northwest": true)`); load a listing that actually populates roof/fencing/lot_features/view/style/construction and a listing with sparse data.
- **Competitors:** Zillow property page (post‑2024 single‑scroll magazine redesign), Redfin listing (climate + GreatSchools + rental estimate), bendpropertysource IDX (local baseline).
- **Bar to beat (decision order):** (1) media‑first gallery (photos+video+3D, one dedup'd source, `w-full` embeds) → (2) "What's Special" narrative chips → (3) key facts in large type → (4) monthly payment calc → (5) full feature list → (6) price & tax history → (7) neighborhood (Walk/Transit/Bike, reuse neighborhood mini‑stats) → (8) schools → (9) climate risk → (10) comps/nearby‑sold → (11) the ONE attributed local broker. Single‑scroll, deliberate font hierarchy, KB sections throughout, designed empty states.

### 6.3 — `/cities/[slug]` + `/communities/[slug]` + `/cities/[slug]/[neighborhoodSlug]`
- Render‑verify first: hero (scenic video where present), the market chart (§5), the neighborhood/community sub‑ledgers, live counts.
- **Competitors:** bendpropertysource.com/guides/, movetobend.com neighborhood roundups, Redfin neighborhood pages.
- **Bar to beat (the unclaimed fusion):** hero + character editorial → embedded mini market‑stats (reuse the chart) → schools → lifestyle/amenities/walkability/commute → honest "who it suits / trade‑offs" → map → live IDX filtered to the geo → cross‑links to adjacent neighborhoods + parent city market page. Nobody local combines all of these.

### 6.4 — `/` homepage  (editorial brand bar)
- Render‑verify first: the hero (kinetic‑brutalist prototype `out/concept/v2/`, iStock‑1330945786.mp4 clip), the homepage chart's missing "as of" cue, Amboqia display fidelity.
- **Competitors:** Sotheby's/Compass (luxury editorial), boutique: kinkwinder.com (Bend‑perfect sketched‑mountain + drone), buse.agency, baruhteam.com.
- **Bar to beat:** cinematic place‑specific hero + editorial restraint + Amboqia hierarchy + national‑luxury brand bar PLUS the local data authority they lack (live mini market chart + real listings) + credibility surface (brokerage‑level real reviews + success stories).

### 6.5 — then `/sell`, `/buy`, `/about`, `/team` (+`/team/[slug]`), `/guides`, `/search`/results, `/blog`
- Render‑verify first: `/buy` and `/team/[slug]` sections are **hand‑rolled (not KB components)** — prime drift suspects. `/search` results: filters (F8) + map (F6) + the "filter silently returns 0" class.
- Bar: match the relevant competitor bar above; bring all sections onto KB primitives; reuse the chart/metrics components.

---

## 7. Ground rules (CLAUDE.md anchors — do not violate)
- **§0 Data Accuracy (outranks everything):** every number that leaves the shop is verified against source, pulled fresh, raw‑printed, math recomputed, narrative reconciled. A wrong number is a ship‑blocker regardless of looks. The chart honesty‑gate (§5) is the chart‑level expression of this.
- **Draft‑First, Commit‑Last:** build to drafts/screenshots, show Matt, get explicit approval before commit/push. Surface each page's before/after + score and wait.
- **Video Review Gate:** any video MP4 to a public path (e.g. scenic heroes) needs Matt's explicit "ship it" first.
- **No‑fork KB:** adjust the shared `components/site/kb/*` sections via props; never copy a section. (`ci:kb-single-source` G50, `ci:kb-shared-shell` G53.)
- **Gates‑not‑prose:** every fixed bug‑class becomes a mechanical gate. Existing locks to respect/extend: `ci:kb-a11y-static` (G54, contrast/focus), `ci:design-tokens`, `ci:type-clip` (`shots/_cliptest.mjs`), `ci:sms-consent`, `ci:breakpoint`/responsive, hydration‑safety. Add: the chart honesty‑gate (§5), a listing‑section KB‑conformance gate, a per‑page render‑QA gate.
- **Opus orchestrator:** delegate enumeration/bulk render sweeps to subagents; keep architecture + the final visual judgment on Opus.

---

## 8. Tooling

### 8.1 The live render + axe harness (proven this session)
Put a scratch `.mjs` **inside the repo dir** (ESM resolves `node_modules` from there), inject the axe bundle, scan/screenshot the live deploy. Pattern:
```js
import { chromium } from 'playwright'
import fs from 'node:fs'
const AXE = fs.readFileSync('node_modules/axe-core/axe.min.js','utf8')
const b = await chromium.launch({ args:['--enable-unsafe-swiftshader'] })
// per viewport: fresh context (390/768/1366), prefers-reduced-motion, en-US, America/Los_Angeles
// goto(url, {waitUntil:'load'}); settle; click "Accept All"; evaluate(AXE); axe.run({runOnly:tags wcag2a/2aa/21aa/22aa})
// screenshot full-page + per-section (locator.screenshot); collect console/HAR/CWV; write findings.json
```
Deploy‑gate before scanning: poll a build marker (a literal route attribute, or the `/_next/static/css/<hash>.css` hash changing) so you grade the NEW build, not a cached old one — a fix on an old build read as live is exactly the trap to avoid.

### 8.2 Suggested Workflow shape (ultracode)
```
pipeline(PAGE_CLASSES,                      // §6, priority order
  p => agent(renderAndScore(p), {schema: PAGE_QA})         // Phase A: render @3 widths + functional + rubric
                                                            //         (subagent screenshots; Opus looks + scores)
  qa => agent(teardown(qa.pageClass), {schema: BAR}),      // Phase B: competitor content+structure bar
  bar => agent(synthAndFix(bar), {schema: FIXSET}),        // Phase C+D: gap list -> implement KB+brutalist+chart spec
  fix => parallel(fix.checks.map(c =>                      // Phase E: adversarial re-verify each "fixed" check
           agent(verifyFailToPass(c), {schema: VERDICT}))) //          on the post-fix SHA, before+after artifacts
)
// Phase F (lock + commit + Matt approval) stays in the main loop between page-classes.
```
Keep Matt in the loop between page‑classes (Draft‑First). Adversarially re‑verify "fixed" — majority of skeptics must confirm the after‑artifact passes, or it isn't fixed.

### 8.3 Artifact layout
`out/page-qa/<sha>/<route-slug>/<viewport>/{fullpage.png, atf.png, <section>.png, findings.json, console.log, network.har, axe.json, cwv.json}` — gitignored; the audit trail anyone can replay.

---

## 9. Definition of done (per page)
A page is done when: rendered at 390/768/1366 with artifacts; **≥80/100** rubric with F1/F2/F4/F11/F12 green and zero auto‑zero hits; brutalist checklist (§3) all‑pass; competitor bar (§6) cleared with a side‑by‑side; every "fixed" carries a before→after artifact pair on the post‑fix SHA; each fixed bug‑class locked behind a gate; Matt has seen the before/after and said ship.

> **Reminder that started this whole thing:** if you find yourself writing "the code shows the fix is in place, so it's fixed" — stop, open the screenshot, and grade the pixels. That sentence is how we got here.
