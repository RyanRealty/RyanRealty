# Public Product OS — decisions (append-only)

This file is the ONLY place a lock counts. Chat approval without a line here is not a lock.

## Lock status

- Process lock (P3): **GRANTED 2026-08-11** (see below). Still binds.
- IA lock (P5): **GRANTED 2026-08-11**. Still binds.
- Visual lock (P6): **GRANTED 2026-08-11**. Still binds.
- Litmus sign-off (P8): measured; not a reopen.
- **Plan of record (2026-08-12):** folded into Broker OS. Locks above still bind.
  Implementation is quarry. Tracker: `docs/plans/ADMIN_PRODUCT/EXECUTION.md`.

---

## 2026-08-11 — Program directives (Matt, chat — founding requirements)

1. **Every page has an objective and the information required to meet it.** Recorded as the
   dual-objective ledger: `visitor_objective` + `machine_objective` + `exits` per route in
   `page-inventory.json` (completed at P5). A page that cannot articulate all three is
   merged or killed.
2. **Seamless exploration of Central Oregon real estate.** The site is one exploration
   graph; pages are nodes; dead ends (legal aside) are defects.
3. **The whole site is one lead-generation machine that never acts like it.** Every page
   drives viewers toward becoming clients — by fully serving the visitor objective, never
   instead of it. The machine objective is only ever achieved through the visitor objective.
4. **Explorable market knowledge — present, past, and future.** Visitors can explore what
   Ryan Realty knows about the Central Oregon housing market from the sales data and data
   at large: present (live pulse), past (sales history by geography and time), future
   (outlook with a named basis ONLY; §0 bans invented forecasts). A first-class pillar.
5. **Continuous and fluid, naturally.** Established context (place, search state, intent)
   follows the visitor across nodes instead of resetting; transitions flow; progression
   toward conversion is gradual and natural. A P5 IA requirement and a P6 visual
   requirement, not polish.
6. **Minimum 3 distinct section display patterns** (floor, not target — constitution sets
   target 5–8 as a CLOSED set). Simplicity by constraint, replicating the admin precedent.
7. **Replicate the Admin Product OS process** — process truth before IA before visuals,
   filesystem memory, design amnesia, Matt locks, cut-list discipline, ratchet gates.

## 2026-08-11 — Supersession (BOOT)

This program is the sole process authority for the public site. Demoted to evidence:
`docs/plans/PUBLIC_SITE_UX_OVERHAUL/` (statuses void — its "done" claims failed disk
verification; ledgers are inventory only; scores/dispositions dead), `docs/EXPERIENCE_SYSTEM.md`
+ the `experience-rollout` skill, `KB_SITE_CONVERSION_GOAL.md`, `docs/plans/seo-voice/` IA
docs. Its ADVERSARIAL_REVIEW.md diagnoses (C1–C5, H1–H8, gates G1–G10) are absorbed as
evidence and remain unfixed until this program fixes them.

## 2026-08-11 — Absorbed Matt-granted PRODUCT decisions (from PUBLIC_SITE_UX_OVERHAUL/decisions.md — binding here)

These are product decisions Matt granted in the prior program. They bind this program as
recorded decisions (not phase locks). The old file is input evidence only from now on.

- **Brand (sacred):** navy `#102742` / cream `#faf8f4`; Amboqia display + Geist body.
  Nothing else about the current site is sacred.
- **KPI (90-day):** completed valuations (E2) week over week. Seller priority is real but
  not a mandate to only ship `/sell`.
- **Valuation capture:** step 1 address only; step 2 email required, phone optional,
  Google + Facebook continue offered. **No save until contact exists** (no orphan address
  leads). Global valuation CTA → one spine (`/sell#get-value` today; P5 may re-home the
  spine, not fork it).
- **Written CMA within 24 hours, every day including weekends.** No fixed follow-up count
  promised on site.
- **Fees:** market ONE plan — 3%, comprehensive expandable feature list (Option A,
  Enhanced column). The comparison matrix is dead. 2.5%/3.5% tiers off the public site.
  Silent on negotiability.
- **Differentiator D1:** "Free written home valuation with the comps behind it — in 24
  hours. No listing agreement." Supporting: live market instrument + single 3% plan.
- **Copy bans:** no AI-slop hype AND no stripped "government-form beige"; no comp counting
  in marketing voice; no em dashes in public copy; no fake quotes; no same-broker/no-hand-off
  pitch; no fee matrix; no negotiability line; no fixed follow-up count; no explaining the
  UI to the user. Tone: calm, low pressure, expert — Buffett voice per VOICE.md.
- **Motion-first (design authority):** the upgraded UI is not a text/layout refresh; visual
  lock requires a MOVING prototype. `MOTION_FIRST_RETHINK.md` direction endorsed; static
  screens are wireframe scrap.
- **Mobile-first: 390 is truth.**
- **Anti-patterns:** no horizontal-scroll section rails; no navy-on-navy review walls; no
  overexplaining free value; judge live pixels before calling a section done.

**Explicitly NOT carried as settled:** IA "Option 1" nav (it was the already-shipped bar —
adversarial C3; P5 re-derives IA under amnesia and Matt re-locks), every wave/order claim,
the ~106-name V2* section library, all ledger scores and dispositions, the three false
"done" statuses.

## 2026-08-11 — OBSERVED, NOT YET RATIFIED

- The prior program's static mockups used Georgia/system-ui instead of brand fonts; noted
  so no future session treats them as brand reference.
- `components/site/v2/` has zero imports anywhere; `ui_kits/` referenced by
  MOTION_FIRST_RETHINK §2 is empty on disk. Cleanup timing is a P5/P9 call, not now.

## 2026-08-11 — OBSERVED addendum: components/site/v2 deleted at BOOT

The design-token ratchet (verified against the materialized push tree) flagged
`components/site/v2/Button.tsx` as a raw-element regression. The register had zero imports
anywhere (verified by grep this session) and was already superseded by this program, so it
was deleted rather than exempted — one of the five design languages is gone. This narrows
the earlier "cleanup timing is a P5/P9 call" note: DEAD registers (zero imports) may be
deleted when a gate forces the question; LIVE registers (kb, legacy flat, primitives,
explore) still wait for P5/P9.

## 2026-08-11 — P3 PROCESS LOCK — GRANTED BY MATT (in-session structured answers)

Process lock granted 2026-08-11. The registry is LOCKED at **28 processes** (34 − 6 merges).
Matt's answers to the package questions:

1. **All six merges APPROVED:** get-home-value.instant-cma → get-home-value.written-cma ·
   evaluate-a-place-poi → evaluate-a-place · hunt-price-cuts → find-a-home ·
   broker-attributed-lead → get-home-value.written-cma · sms-shortlink-click →
   track-outbound-engagement · compare-homes → find-a-home.
2. **Video browse: keep /videos, fold /feed.** The grid is the indexable canonical surface;
   the vertical feed becomes a mode of it, not a second page. (Route disposition is P5;
   the process truth is one video-browse lens inside find-a-home.)
3. **PWA offline: minimal recovery only.** The live recovery half stays; full offline
   browsing is explicitly NOT a workstream this wave.
4. **Scope: keep everything in scope.** Client-service processes (sign-transaction-documents,
   view-client-valuation-doc) and thin personas (refer-out-of-area, join-the-brokerage) all
   receive this program's IA + design language.

All 28 KEEP verdicts from p3-process-lock-package.md are locked as recorded there.
state.json: locks.process = 2026-08-11, awaiting_lock cleared, phase → P4_DATA.

## 2026-08-11 — P5 IA LOCK — GRANTED BY MATT (in-session structured answers)

The IA in `ia-lock.md` is LOCKED. Matt's answers:

1. **Destinations: all six names approved as proposed** — top bar **Homes · Places ·
   Market · Sell · About**, with **Saved** as the account affordance (not a nav word).
   Places (not Areas) is locked: the job is evaluating a place.
2. **Folds approved:** `/buy` + `/buy/[intent]` fold into **Homes** as the buyer-education
   layer (zero organic equity). The `/tools` calculators dissolve into context — payment
   math on listings, underwrite on the investor lens, hold math on the valuation spine —
   **with one amendment: `/tools/appreciation` KEEPS STANDING as a real page** (608
   impressions / 90d). The other two calculators lose their standalone pages and 301.
3. **Deal signals: `/price-drops` is the survivor.** `/motivated-sellers` and its 10 city
   URLs 301 into the matching price-drops URLs (buyer-framed URL for a buyer job). The
   "Sell on a deadline" nav label re-homes to the Sell destination regardless.
4. **Ad LPs: noindex all of them.** `/lp/*` become pure paid-arrival surfaces off the
   organic graph; city and community nodes own their keywords. Ends the Tetherow, Bend,
   and golf dual-role cannibalization.

`cut-list.md` is FROZEN with these amendments applied (appreciation removed from the cut
set; motivated-sellers family confirmed as the losing side; LP rows reclassified from cut
to noindex-off-graph). state.json: `locks.ia = 2026-08-11`, `awaiting_lock` cleared,
phase → `P6_VISUAL`.

## 2026-08-11 — P6 VISUAL LOCK — GRANTED BY MATT

Matt judged the MOVING prototype live in production at
`https://ryan-realty.com/dev/public-v3` (real Bend data, 390 and 1280, reduced-motion path)
and granted the lock: "yes looks good on visual".

LOCKED as the public visual language: `design_system/public/PUBLIC_UI.md` in full — the
calm-instrument thesis, the externally-cited foundations, the **SIX closed section
patterns** (Instrument · Field · Ledger · Stage · Sheet · Quiet) with the rhythm rule (no
two adjacent sections share a pattern, no page uses more than four), the per-destination
openings, the computed AA contrast table, the motion rule (movement must encode a state
change; reduced motion resolves instantly), and the recorded amnesia test.

The pattern set is CLOSED. A section that fits none of the six does not get an exception —
the language changes by editing PUBLIC_UI.md, never by exempting a page.

state.json: `locks.visual = 2026-08-11`, `awaiting_lock` cleared, phase → `P7_PRIMITIVES`.
P7 builds `components/site/v3/` as the 1:1 pattern barrel (accessible name required in the
type). The barrel is the pressure valve: a migration needing a control it lacks ADDS the
primitive, never reaches back into kb/legacy/primitives/explore.

## 2026-08-11 — OBSERVED: the KB gates encode the OLD destination (P9 blocker)

The first attempted family migration (/housing-market onto the v3 barrel) was built,
adversarially verified, REFUTED, and reverted unshipped. Two fresh-context verifiers found
17 defects. Four were commit-blocking gate failures, and together they are the real finding:

- `ci:mockup-parity` requires `<KbHero> <KbExploreTowns> <KbArticles> <ContentSection>` on
  this route, per `design_system/ryan-realty/ui_kits/market-report/parity.json`.
- `ci:seo-shell` requires the H1 to come from KbHero's `titleBottom="Housing Market"`.
- `ci:kb-breadcrumb-overlay` requires `overlay` on the breadcrumb of any KbHero page.

**Those gates enforce the KB era as the destination.** Any page migration therefore has a
prerequisite the plan did not name: update the route's gate contracts to the NEW
destination IN THE SAME CHANGE (the rollout rule the prior Experience program already
learned: gates enforce the destination, never the past). A migration that does not do this
cannot commit, no matter how good the page is.

Also learned, and now written into the P9 unit definition:
- A page migration must state which sections it DELETES. The attempt silently dropped
  KbHero's property search and voice-search button.
- A migrated page must not leave a discarded data read behind (getSurfaceImage stayed in
  the Promise.all with its result dropped into a positional hole, paying for a fetch on
  every revalidation that nothing renders).
- Zero-value rows synthesized for missing cities may not render under a live-MLS source
  line. Absent is not zero (CLAUDE.md section 0).
- The verdict on the page and the verdict inside its FAQ JSON-LD are computed in two
  different places and can disagree. One derivation, one number.

## 2026-08-11 — ci:public-ui rule C corrected by the fixer

Rule C originally failed any page importing BOTH v3 and an old register. That fails the
migration front itself: a family being rebuilt necessarily holds v3 sections beside chrome
that has not moved yet, so the rule as written blocked the only path off the old registers.
C now fails the REAL defect: once a page imports the barrel, its non-v3 import count may
never grow. Mixed pages are still counted and printed, as the visible migration front.
Break-tested: a v3 page that adds a kb import fires; the clean tree is green.

## 2026-08-12 — P9 roll 1 SHIPPED: /housing-market (R1) is on the v3 barrel

Second attempt. The first was reverted because it left the gate contracts pointing at the
KB era. This one moved the contracts in the same change, which is the rollout rule the
Experience program already learned: **gates enforce the destination, never the past.**

**The page.** `app/housing-market/page.tsx`, four of the six patterns, no two adjacent
alike, chrome exempt: Breadcrumb, Instrument (region answer), Ledger (cities), Instrument
(closed sales), Ledger (guides), Quiet (FAQ), Sheet (one ask), Quiet (edges), Footer.
Metadata, revalidate, route, JSON-LD meaning, every metric's filter/window/units, and the
capture contract (`submitMarketPageInquiry`, variant `inquiry`, fields name/email/message)
are unchanged. Register count on this route went 16 non-v3 import sites to 2.

**Every attempt-one defect, and how it is closed:**
- *Two verdict derivations.* The months-of-supply figure is rounded ONCE on the page,
  `marketVerdict()` reads that rounded value for the H1, and the SAME rounded value is what
  `buildMarketFaq` receives. Verified in the live render: H1 "a balanced market", figure
  5.8, FAQ "5.8 months of supply, which is a balanced market", Dataset variable 5.8.
- *A trace that did not cover its figures.* Three populations, three sections, three
  traces, three stamps: region pulse (updated Aug 12), city snapshots (own newest
  `updated_at`, Aug 12), closed sales (own `computedAt`, Aug 10). No section prints a
  figure its own trace does not cover.
- *A stamp borrowed from another query.* Closed by the same split above.
- *Zero synthesized for a missing city.* Tumalo returns a live row with no active listings
  and no median. It leaves the Ledger and appears in the closing Quiet block as
  "Tumalo shows no active single-family listings" with its report still linked. The reason
  is derived per city from its own row (no row / nothing active / active with no median),
  not assumed.
- *A discarded read.* `getSurfaceImage` and `getCoMarketAnnualSeries` are gone from the
  Promise.all. Four reads, four rendered.
- *A silent deletion.* Seven deletions are enumerated in the route file's header and in
  `parity.json`. KbHero's property search and voice-search button are among them, deleted
  for the reason V3Chrome already recorded for itself.
- *Three consecutive capture bands, two solid primaries at 390.* One on-page ask. Five
  controls render: one primary at the top (the valuation ask), three ghosts, one primary on
  the Sheet near the bottom. At 390 the KB nav CTA is `display:none`, so no viewport holds
  two solid primaries.
- *Dead stat text.* Every figure with a node links to it.

**Gate contracts moved in the same change.** Four blockers plus six silent-loss closures,
each break-tested:
- `check-default-chrome-footer.mjs` (B1): `hasV3` accepts `V3Footer` / `V3_ROOT_CLASS`, and
  the double-footer rule now covers the v3 pairings.
- `check-breadcrumb.mjs` (B2): `V3Breadcrumb` joins the recogniser. Label canon and
  on-navy scoping untouched.
- `check-seo-shell.mjs` (B3): `extractLayerAShell` learns `<V3Heading>` and `headline=`, so
  the banned-poetry scan is not blind on migrated pages; R1's required check asserts the
  head term "Housing Market" in either register's spelling instead of the KB prop name.
- `market-report/parity.json` (B4): `requiredComponents`, `sectionOrder`, `note`, `jsonLd`,
  and `dataLayer` rewritten to the v3 sections. The directory keeps its `index.html`, which
  is now labelled in the contract as the retired KB mockup, not the visual target.
- `check-kb-page-contract.mjs`, `check-kb-shared-shell.mjs`, `check-default-chrome-footer.mjs`:
  line comments are stripped BEFORE block comments. **The section 2.1 defect is real and
  larger than mapped: four pages were invisible, not three.** `app/oregon/[city]/page.tsx`
  carries the same phantom-comment swallow. G52 went 60 to 64 checked pages, G53 62 to 66,
  and every newly visible page passes on today's source.
- `check-kb-page-contract.mjs`: page predicate accepts `V3_ROOT_CLASS`, tracker predicate
  accepts either register's tracker, and `app/dev` is excluded the way every other
  public-surface gate excludes it.
- `check-kb-shared-shell.mjs`: the layout arm accepts `V3Chrome`, and the per-page arm now
  pairs `V3_ROOT_CLASS` with `V3Footer` instead of lapsing when a page leaves KB.
- `check-kb-breadcrumb-overlay.mjs`: pair-driven, with the v3 arm `V3Stage` +
  `V3Breadcrumb tone="on-media"`. Vacuous on this page (no Stage), which is the point:
  the protection is in place before the first dark v3 opening ships.
- `check-naked-verb-headings.mjs`: `V3Heading`, `headline`, `eyebrow`, and the
  `{v3Text('...')}` form. Break-tested with `headline={v3Text('Explore')}`.
- `check-kb-a11y-static.mjs`: check 1 runs per token layer and now reads
  `components/site/v3/tokens.css`, where the sub-AA stops are deliberately absent.
- `check-market-chart-honesty.mjs`: `existsSync` guards, so deleting the chart fails with
  the honest message instead of an ENOENT stack trace.

**`ci:public-ui` re-seed guard corrected (second half of the 2026-08-11 rule-C fix).** The
CHECK path already treated `mixedPages` as tracked rather than gated. The WRITE path did
not, so the first real migration shrank A by 14 and B by 1 and then could not record the
result, because C went 0 to 1 exactly as designed. `--allow-growth` would have unlocked it
by loosening A and B at the same time, which is the opposite of a ratchet. The shrink-only
guard now names the two ratcheted numbers. Baseline re-seeded: **688 to 674, 84 to 83,
mixedPages 1.** `app/housing-market/page.tsx` also left `page-dal-baseline.json`.

**`ci:market-section-nesting` deliberately NOT given a v3 pair.** The KB rule is decidable
because `MarketCoreCharts` belongs INSIDE `KbMarketHud`. No v3 pattern nests inside another
that way, so `{open:'<V3Instrument', child:'<V3Ledger'}` would fail this page for rendering
a Ledger after a self-closing Instrument, which is correct authoring. A bare count of
`<V3Instrument` would contradict the barrel's own documented design (V3Instrument.tsx: a
Places node renders a place verdict and a parent-market verdict on one page). The gate stays
KB-shaped and vacuous for v3 until a v3 nesting relationship actually exists. **This is a
recorded lapse, not an oversight.**

**Kept on a non-v3 register, deliberately:** `MetadataBlock` (JSON-LD emission) and
`KbSectionTracker` (analytics wiring). Neither carries visual language and the barrel ships
no equivalent. Those two are R1's entire remaining non-v3 count.

**Deleted:** `components/site/analytics/CoMarketComposition.tsx`. The hub was its only
consumer, and `ci:reachable-exports` asked the question the moment the hub stopped
importing it. Its numbers survive in the composition FAQ answer, word for word.
`CoMarketSizeStrip` and `getCoMarketAnnualSeries` are untouched and still render the 2016
to 2024 series on `/housing-market/central-oregon`.

**Left for the chrome unit, not fixed here.** `ci:css-layers` fails on 9 NEW un-layered
element color rules in `components/site/v3/V3Chrome.css` (353, 365, 385, 419) and
`components/site/v3/V3Footer.css` (44, 60, 75, 131, 173). Those files belong to the chrome
unit and were being written in the same session, so they were not edited from here. The fix
is the one the gate names: wrap each rule in `@layer base { ... }`. This is the
invisible-CTA-text P0 class (2026-07-08) and it now sits under a shipped page's footer, so
it is the chrome unit's next task, not a someday item.

---

## 2026-08-12 — the R1 repair pass (two fresh-context verifiers, 17 findings)

The migration above shipped green on the gates it ran and was then refuted on the ones it
did not. Everything below is closed on `main` unless it says otherwise.

**§0 REGRESSION, THE ONE THAT MATTERED.** The migration reversed the KB page's documented
data-accuracy fix. The KB source classified the RAW months-of-supply with a comment naming
the reason ("rounding first ... could flip a genuinely-balanced 4.05 into seller's market");
the new code did `const mos = Math.round(raw * 10) / 10` and then `marketVerdict(mos)`. That
walks the verdict across a canonical threshold in BOTH directions: raw in (4.00, 4.05]
rounds to 4.0 and `4.0 <= 4` prints "a seller's market", and raw in [5.95, 6.00) rounds to
6.0 and `6.0 >= 6` prints "buyer's" — in the H1, the visible FAQ answer, and the FAQPage
JSON-LD. `lib/site/market-faq.ts` had the identical bug inside it, so "one derivation" was
one derivation of a wrong verdict. **Fixed in both consumers: classify the raw value, round
only at display.** The page now hands `buildMarketFaq` the RAW figure. Locked by two new
boundary cases in `lib/site/market-faq.test.ts` (4.02 must read balanced, 5.97 must read
balanced) — the fixer writes the gate.

**Guard mismatch, same figure.** The page printed the MoS figure and a verdict whenever
`mos != null`, while `buildMarketFaq` emits the question and the Dataset variable only when
the value is above 0. At a stored 0 the H1 asserted "a seller's market" beside "0.0 months
of supply" with no FAQ answer behind it. The page now uses the builder's own guard.

**Published payload moved while the header claimed it had not.** `formatPrice` rounds to
the nearest $1,000 (`lib/format/money.ts`), so substituting it for the KB page's
`$${Math.round(n).toLocaleString()}` published a $627,450 median as $627,000 inside the
FAQPage JSON-LD. Whole dollars restored, and the level-2 Instrument prints the SAME string,
so the figure on screen and the figure in the markup are one string, not two roundings.

**Runtime 500 risk on the flagship market URL.** `v3Text(post.title)` was the one DB-sourced
string reaching the barrel unguarded, and `v3Text` throws on empty by design. A guide row
with a blank title or slug is now dropped.

**Freshness stamp could be render-time.** `getCoMarketAnnual` falls back to
`fetchLiveAggregate`, which stamps `computedAt: new Date()`. The level-2 stamp now renders
only when `source === 'mart'`, so a closed calendar year can never print "updated today".

**Doors.** All three level-2 figures are now doors into the closed-sales explorer
(`?year=`, and `&type=` on the property-type figure, which
`app/housing-market/history/page.tsx` reads). The `#faq` Quiet block carries four outbound
edges — pattern 6 is defined as the block that carries the graph's outbound edges and it
was shipping none.

**CHROME — breadcrumb was 100% occluded at 390 AND 1280.** The public header is
`position: fixed`, the trail was the first flow element of `<main>`, and 52px of a 52px
strip rendered behind the wordmark (`elementFromPoint` on the "Home" crumb returned
`IMG.logo-img`). `KbBreadcrumb` solved this on the other register in the 2026-07-15 audit
with a `belowNav` prop and then shipped it again on its ten `overlay` callers. **V3Breadcrumb
therefore defaults the offset ON for the surface tone** rather than making the caller opt in,
with `belowNav={false}` as the documented escape. Re-measured: crumb top 84, bar bottom 76,
`elementFromPoint` returns `A.v3-breadcrumb__link` at both widths.

**ONE PRIMARY — failed at 1280.** The chrome's filled `a.nav-cta` and the Instrument's
filled `a.v3-btn--primary` were both visible at scrollY 0. The Instrument's ask is now
`variant: 'ghost'`, which is the reasoning `V3Footer.tsx` already recorded for itself.
Verified: exactly one solid-filled control in the first viewport at 1280.

**`<footer>` was inside `<main>`,** so per HTML-AAM it mapped to a generic and the page
shipped no contentinfo landmark. It renders outside `<main>` now, and the accessibility tree
shows `contentinfo`. `ci:default-chrome-footer` counts footers without checking placement,
which is why nothing said so.

**Gate contracts — repaired, not loosened.**
- `check-seo-shell.mjs`: the v3 arm had been written as `[Hh]ousing [Mm]arket` anywhere
  inside any headline literal, which is LOOSER than the KB rule it replaced. Both arms are
  exact literals again: KB keeps `titleBottom="Housing Market"`, v3 pins the sentence-case
  `Central Oregon housing market` the page opens with.
- `check-kb-a11y-static.mjs`: the v3 arm read only `tokens.css` — 16 of the register's 84
  color declarations. It now scans every `components/site/v3/*.css`, which is what the KB
  arm has always done for `kb.css`. Break-tested with `color: var(--v3-navy-50)` in
  `V3Instrument.css`.
- `page-dal-baseline.json` was hand-edited to `total: 81` over an 80-entry array. Re-seeded
  from the gate: 51 and 51, which also ratchets 29 fixed pages out of the debt list.
- `app/dev/sell-film/page.tsx` was the chain's one NEW `ci:page-dal` violator. The other
  public-surface gates exclude `app/dev`; `check-page-dal.mjs` does not, and widening it
  would have licensed every future dev page to read data raw. The page carries `@data-free`
  instead, with the verification behind it written on the line: it renders `<SellFilm />`
  and that component holds no fetch, no `@/lib/data` import, no supabase client, no async.

**`ci:css-layers` closed, including the adjacent files.** All 9 v3 chrome rules are wrapped
in `@layer base`, and so are the 5 in `components/site/sell/spine/sell-spine.css` — one of
which was `.sell-root a { color: inherit }`, the invisible-CTA-text P0 rule verbatim, one
register over. Leaving a red shared gate for another unit is how that P0 lived for weeks.

**`ci:file-size-budget`.** The route crossed the 600-LOC floor as a NEW file, which is a hard
fail, not a ratchet warning. The gate's own instruction is to split rather than re-baseline,
so the route-local constants moved to `app/housing-market/_v3/hub-constants.ts` and the
header prose that duplicated the parity contract was deleted rather than reworded. 591 LOC.

**Still open, and NOT this unit's to close:**
- `app/lp/seller-home-value/SellerLPForm.tsx` grew 618 to 626 (`ci:file-size-budget`). That
  is a live product change in another unit's file (a `skipPartialLead` prop implementing
  Matt's 2026-08-11 directive that public /sell does not save until contact exists). Its
  owner splits it or re-baselines it with the reason. `npm run ci:gates` cannot pass until
  then.
- `ci:reachable-exports` (2 orphans under `components/site/sell/`), `ci:hydration-safety`
  (1 NEW, `SellSectionTracker.client.tsx:12`), `ci:broker-facts` (2 hardcoded phone literals
  in `app/dev/sell-film/SellFilm.client.tsx`). All in the sell/dev unit's files.
- **The chrome's filled CTA vs a Sheet's submit.** With the KB topbar's `a.nav-cta` solid and
  sticky, ANY `V3Sheet` on ANY public page shares a viewport with it at desktop widths — on
  this page, at scrollY ~3490. `V3Sheet.tsx:889` states "the advance control is the only
  primary a Sheet renders", so the Sheet is not the thing to change. The chrome unit decides
  whether the header's ask is a primary or a secondary; PUBLIC_UI.md's CTA table already says
  "Global chrome: primary buy path + secondary Value my home".

---

## 2026-08-12 — `/subdivisions/[slug]` ships on v3 (P9, plat node)

**Route:** `app/subdivisions/[slug]/page.tsx`, 13 non-v3 import sites down to 2
(`MetadataBlock`, `KbSectionTracker` — both wiring, neither visual language, barrel ships no
equivalent). Order: Breadcrumb, Instrument L1 (or Quiet when the count is unknown), Field
(always), Instrument L2 (conditional), Ledger (conditional), Quiet (always), Footer.

**Rhythm proved for every dropout, not just the full page.** The two conditional sections are
an Instrument and a Ledger, which cannot collide with each other, and the always-rendered
Field sits before them with the always-rendered Quiet after them. That is also why the
assigned schools render INSIDE the closing Quiet (`SubdivisionSchools` owns that section): a
second Quiet would sit adjacent to the closing one whenever both conditionals dropped out, and
`ci:subdivision-stats-integrity` requires `<SubdivisionSchools>` be rendered by name.

**Four populations, four traces, four stamps.** All four sentences live in
`app/subdivisions/[slug]/_v3/subdivision-traces.ts`. Two KB defects closed by writing them:
the boundary RPC filters status only, so the plat's active count holds every property type
while the Field is `propertyType: 'A'` — the KB page printed the first under a subtitle reading
"Every active single-family listing". And the market band now reads ONE row
(`_v3/subdivision-figures.ts`); the KB page took a median from whichever pulse row carried one
and a days-to-pending from whichever carried that, so a community median could print beside a
city days-to-pending under one heading.

**Absent is not zero, extended to the registry path.** `getCommunityListings` timing out and a
plat with nothing for sale both leave `[]`, and the count is that array's length, so the KB
page published "0 homes for sale" under a live-MLS trace on every slow query. The read is now
`withTimeoutFallbackResult` and the count is `null` on a miss, which is the guard the boundary
path already carried.

**Known defect carried forward, not introduced:** on the registry path the active count is
`getCommunityListings(..., 14)`, capped at 14 rows. The value is unchanged from the KB page
and the trace for that path now says the count stops at fourteen. Fixing it is a metric
change and belongs to whoever owns that decision.

**Gap reported to the barrel:** there is no map primitive, so `V3Field`'s `mapSlot` is filled
by a route-local `_v3/SubdivisionFieldMap.client.tsx` (dynamic ssr:false, `useV3FieldBinding`,
draws the recorded plat polygon plus one pin per plotted listing). Three routes have now
written the same file. There is also no media-rail primitive, which is why `VideoTourRail` was
dropped rather than restyled.

**Deletions, all declared in `design_system/ryan-realty/ui_kits/subdivision/parity.json`:**
KbHero's parent-city photo + caption + the `cityHero` read, its property search and
voice-search button, its two-button CTA pair; KbSell's address-capture field and that whole
section (destination and `?from=` attribution survive on the Instrument's ghost action);
KbFeatured; VideoTourRail; LifestyleNearSection / PlaceParentsSection / KbExploreTowns as
sections (every link is an edge in the closing Quiet); the stats strip inside the sales-history
section; SmoothScrollProvider and `kb.css`. Three modules were orphaned by those deletions and
deleted rather than left: `components/site/explore/SubdivisionExploreTail.tsx`,
`components/site/VideoTourRail.tsx`, and `components/site/VideoSlider.client.tsx` (whose only
importer was the rail).

**Gate contract added:** `design_system/ryan-realty/ui_kits/subdivision/parity.json`, a new
contract binding this route only (11 required components, 0 missing). The directory holds no
`index.html`, so `ci:mockup-coverage` is unaffected.

**Verified:** `tsc --noEmit` clean, every gate in the battery green except the three this unit
does not own (`ci:file-size-budget` on `SellerLPForm.tsx`, `ci:hydration-safety` on
`SellSectionTracker.client.tsx`, `ci:reachable-exports` on 12 orphans from the cities /
communities / zip / sell units in flight). Browser-UA curl on localhost:3000 returned 200 for
`sunrise-village`, `golden-butte`, `the-ridge`, `shevlin-bluffs`, `ridge-at-eagle-crest` and
`skyliner-summit`, with real figures, one `<main>`, one `<footer>`, zero `v3-btn--primary` on
the page, and BreadcrumbList + Place JSON-LD matching the KB payloads. **Transient 404s under
load are a dev-server artifact, not the route:** during the run `/communities/tetherow` and
`/zip/97701` (other units' routes) 404ed the same way and recovered on retry.

---

## 2026-08-12 — `/subdivisions/[slug]` repair pass (six defects, all found on the rendered page)

A verifier read the migrated route in a browser rather than in the diff and found six. Every
one passed `ci:gates`, which is the recipe's own warning made concrete: green is necessary,
never sufficient.

**1. A door that opened a different year than it named, plus the sentence claiming otherwise.**
The Ledger made every year a link to `/housing-market/history?year=<year>`, and that page
clamps: `Math.min(2030, Math.max(1998, …))`. A 1997 row opened 1998 aggregates under a note
reading "Each year opens the Central Oregon closed-sales explorer at that year." **7,553 closed
single-family sales across 497 plats predate 1998** (verified live: `public.listings`,
`PropertyType='A'`, `StandardStatus like '%closed%'`, `ClosePrice > 0`; earliest year 1993), so
this was on hundreds of pages, not an edge case. Years outside the explorer's range are now
split out in `_v3/history-door.ts`, get no row, and are stated as a count in the note — the
section total still covers every year the RPC returned, so no figure left the page. The KB
table's rows were plain `<td>`s with no destination; both the door and the claim were
introduced by the migration.

**2. A synthesized zero under a live trace.** `parentPulseFigures` pushed the closings figure
with no guard while the two figures above it were null-guarded.
`lib/data/market/getMarketPulse.ts:60` reads `(row.sold_count_30d as number) ?? 0`, so a NULL
column arrives as the number 0 and this page cannot tell it from a real zero — the exact hazard
the page's own "ABSENT IS NOT ZERO" header names and applies to `activeCount`. The figure is
now guarded, and `parentMarketTrace` composes its basis sentence from the figures that
survived, so no trace names a number the page suppressed. **Left open for whoever owns the
DAL:** `MarketPulse.closedLast30Days` should be `number | null`. Until it is, this route cannot
publish a true zero, and it prefers fewer numbers to one wrong one (CLAUDE.md §0).

**3. A read whose result could not reach the screen, under a comment saying it did.**
`fetchSubdivMarketExtras` (two `getMarketPulse` queries, 3000ms each) ran in the page's
`Promise.all`, but `parentFigures` was `[]` whenever the plat carried its own
`market_stats_cache` row — two live queries per request, discarded. The parent read is now
conditional and sits after that decision (migration-recipe §3.4).

**4. An undeclared deletion of every listing photograph.** `parity.json` named only "KbFeatured's
photo rail", while the boundary path rendered `PlaceMapListSplit` with a 72×54 photo per row
(`PlaceMapListSplit.client.tsx:114`) and the deleted page advertised the map's photo stamps in
its own subtitle. Three surfaces, declared as one. All three are now named in the contract with
where the information went (the listing page behind each row). `V3FieldItem` carries no image
field, so restoring a photo here needs a barrel change, not a page change.

**5. Two thresholds restated in public copy with nothing binding them.** The schools sentence
spelled "70 percent" and "ten"; both live as exported constants in
`getSubdivisionSchools.ts`. The sentence is now built from `SCHOOL_MIN_AGREEMENT` and
`SCHOOL_MIN_SAMPLES`, which is a compile-time binding and stronger than a gate.

**6. A figure with no antecedent noun.** "The map plots all 26 that carry coordinates" sat under
a count of 24 and an Instrument counting 26 of a *different* population. The sentence now names
its population: "all 26 active single-family listings that carry coordinates."

**The fixer wrote the gate** (§6, `feedback_gate_written_by_the_fixer`).
`ci:subdivision-stats-integrity` gained three invariants, each break-tested — introduced the
defect, watched it fire, restored, watched it pass:
`HISTORY_MIN_YEAR`/`HISTORY_MAX_YEAR` are parsed out of the explorer's own clamp and compared
(fired: "HISTORY_MIN_YEAR is 1997, the explorer clamps to 1998"); the Ledger must route through
`splitByExplorerRange` + `historyYearHref` and may not build a raw `?year=` URL (fired); the
closings push must sit inside a guard on `closedLast30Days` (fired); and the schools section
must read both DAL constants and may not spell either in prose (fired twice).

**Two route-local files** were added under `_v3/` (`history-door.ts`, `subdivision-registry.ts`);
the registry helpers moved out of `page.tsx` to keep it under the `ci:file-size-budget` floor
(595 → 582 LOC) rather than re-baselining, which is the gate's own instruction.

**Verified on the rendered page, browser UA, localhost:3000, all HTTP 200:**
`sunrise-village` — earliest year door is 1998, no 1997 link anywhere, note reads "The explorer
runs from 1998 to 2030, so the 6 closings recorded here outside those years are in the total
above and have no row", schools sentence reads "at least 70 percent of at least 10", zero
`<img>` inside `<main>`. `tollgate` — parent band with all three figures and the full basis
sentence. `hillman` (parent Terrebonne, whose pulse row carries `sold_count_30d = 0` and a NULL
days-to-pending) — one figure, and the trace reads "List price comes from active inventory.
These are Terrebonne figures, not plat-level ones", with no closings figure and no orphan
clause; before the guard this page published "0 closed in the last 30 days". The door itself:
`/housing-market/history?year=1998&city=Bend` renders "Active query 1998 · Bend". The two
conditional branches were forced to render rather than reasoned about — `MAX_LISTED` temporarily
2 printed "The map plots all 3 active single-family listings that carry coordinates", and
`HISTORY_MIN_YEAR` temporarily 2027 printed the empty-Ledger branch with its stated reason
instead of throwing. Both constants restored, gate green.

**Not this unit's, unchanged:** `ci:file-size-budget` on `SellerLPForm.tsx` (+8) and
`ci:reachable-exports` on the same 12 orphans from the cities / communities / zip / sell units.

## 2026-08-12 — `/communities/[slug]` repair pass (five defects, one of them live in an H1)

Five findings against the v3 community node, every one of them published copy, none of them
visible to a gate. Fixed in `app/communities/[slug]/page.tsx`, its `_v3/` modules, and the
parity contract.

**1. Three values of one statistic on one page.** The Instrument printed months of supply
through `Math.round(mos * 10) / 10` + `toFixed(1)` — the exact expression
`lib/site/market-faq.ts` had replaced in this same changeset, for the reason written in its own
comment. At a raw 4.02 the figure read 4.0 under a threshold clause saying 4 or less is a
seller's market, while the FAQ answer and the Dataset variable, which go through
`formatMonthsOfSupply`, both read 4.1. The page now calls the canonical formatter and the
builder takes a preformatted string.

**2. A verdict and a count that refuted each other, in the H1.** `/communities/vandevert-ranch`
rendered "Vandevert Ranch homes for sale: a buyer's market" over "0 homes for sale" and "72.0
months of supply", with the formula printed underneath. The pulse row computes the ratio from
ITS own active count, and that has never been the count this page publishes: vandevert-ranch 12
against 0, tetherow 20 against 36, broken-top 205 against 21 (verified against
`market_pulse_live`, geo_type `neighborhood`, 2026-08-12). Tetherow's own 36 actives against the
same denominator give 9.0 months, a buyer's market, under an H1 that said balanced. Months of
supply and the H1 verdict now publish ONLY when the row's numerator is the count on screen —
which is exactly the communities whose count came from that row. `/communities/three-rivers` is
the one that still prints it: 91 actives, 16.1 months, "a buyer's market", the same 16.1 in the
figure, the FAQ answer, and the Dataset variable. Every other community drops the figure, the
verdict, the FAQ question, and the variable together, from the one `buildMarketFaq` call. Days
to pending survives the same disagreement: no printed formula, no verdict, and its own named
source in the trace.

**3. Doors and denominators that named sets the page does not hold.** The count linked to
`/homes-for-sale/<city>/<subdivision>`, which filters on the literal MLS SubdivisionName and
published 30 where this page published 36 — the undercount the alias-aware count exists to
correct, proved by this page's own link to 19504 Century Drive under the subdivision "Roald
West". A tile-sourced count now links to the Field on this page, which holds those exact homes;
the browse door stays with a label that names the search rather than claiming completeness. The
footnote's new sentence "Every one of them is on the browse page" was false and is gone, its
denominator is the list's own set rather than the plotted subset (which had named rows that are
not on the map, and had gone silent entirely whenever fewer than 24 homes plotted), and the map
discloses the plotted subset in its own note. The Field is also fed the COUNTED set now, so the
count, the map, and the list cannot describe three populations.

**4. An undeclared user-facing deletion: the freshness signal.** The KB page rendered "Market
data updated <label>"; the migration replaced it with the Instrument's `updated` prop, which
reads the live pair's stamp — null on the alias, boundary, and subdivision-name branches, so it
never rendered on a resort or a plain subdivision while the Dataset went on publishing
`dateModified`. The line is back in the closing block's note, off the same `asOfLabel`/`asOfIso`
pair, and `parity.json` now names it (it was in no `removedComponents` entry).

**5. Two more things left with the honeypot, and only the honeypot was declared.** The sheet had
also lost "One email per new listing. Unsubscribe any time." and the post-success route to
manage the subscription. `V3Sheet` has a sheet-level `trap` prop, so the honeypot is restored
through the barrel and the sheet forwards the trap's own answer instead of a hardcoded
`company: ''`; both disclosure lines are step prose; and the manage route is a door in the
closing block, because V3Sheet renders prose rather than nodes. That last one is the section's
one remaining barrel gap.

**The fixer wrote the gates** (§6, `feedback_gates_not_prose`), both break-tested in both
directions:

- **G68**, check 3 of `ci:market-formula`: no public surface rounds months of supply itself.
  Case-sensitive matching on purpose — under `/i` the guard `mos(?![a-z])` also rejects an
  uppercase next character, so `mosRaw` and `mosDisplay`, the two identifiers the rule exists to
  catch, fell silently out of scope. Frozen shrink-only ledger: 19 call sites across 14 files,
  video and CMA included.
- **G67**, `ci:alert-capture-disclosure`: every surface calling `submitSearchAlertSignup` renders
  a honeypot (register-aware: the v3 `trap` prop or the KB hidden input), forwards its value,
  states a send frequency in copy a visitor reads, and states an unsubscribe path. An earlier cut
  accepted the bare token `daily` as the frequency statement, which every one of these files
  carries as `buildAlertCreatePayload('daily')` — a code literal no visitor reads — so the rule
  passed on all eight surfaces and meant nothing. Ledger names which requirement each of the five
  pre-existing surfaces fails; `/communities` passes all four.

**Verified on the rendered page, browser UA, localhost:3000, 17 community routes, all HTTP 200.**
`tetherow`: H1 with no verdict, 36 / $1,475,000 / 20.5 days to pending, trace naming only days to
pending from the pulse row with no months-of-supply formula or thresholds, "Listed here: the 24
highest-priced of the 36 active single-family homes in Tetherow", no Months of Supply variable in
the Dataset, `name="company"` inside `.v3-sheet-trap`, "Market data updated August 2026".
`vandevert-ranch`: H1 with no verdict, "0 homes for sale", and the Field reading "No single-family
home is listed for sale in Vandevert Ranch right now" instead of a sentence that read like an
outage. `three-rivers`: all four surfaces agree at 16.1 and "a buyer's market", and its empty
Field states why it is empty — the count came from a mart row that carries no listings, because
its homes are not filed under its registry city. `eagle-crest` in one render: 95 in the
Instrument, 95 on the map, 95 in the footnote, 95 in the FAQ.

**Not this unit's, unchanged from the pre-edit baseline:** `ci:file-size-budget` on
`SellerLPForm.tsx` (+8), `ci:design-tokens` on the same file, and `ci:reachable-exports` on the
11 orphans from the cities / communities / zip / sell units. Reported, not touched: the browse
route has no alias-aware mode, so `/homes-for-sale/<city>/<subdivision>` will keep publishing a
smaller number than the community page until that route learns the alias set.

## 2026-08-11 — INCIDENT: a sibling session committed and pushed this program's work

While the ten-route migration was being committed, a concurrent session on the same
working tree ran a broad `git add` and pushed. The result is on origin as `16f0361f`
under the message **"docs: lock D1-D3, SMS voice, and person header"**, which describes
that session's docs work and says nothing about the 108 files and ~16,300 insertions it
actually carried: the Market and Places migrations, the v3 chrome primitives, the shared
orphan cleanup, and all three re-seeded ratchet baselines.

**The code is correct and verified** (every route smoke-tested, gates re-run, ratchets
re-seeded), but its history is mislabeled, and the commit was already public before this
was noticed, so it is not being rewritten with another session live.

Two things this cost, both fixed:
1. One type error reached origin: `app/pulse/page.tsx` referenced `valuationHref` where
   the page exposes the `VALUATION_HREF` constant built from it. A broken build was on
   main until the follow-up commit.
2. The migration's real commit message, which carried the reasoning for three systemic
   fixes, exists only in this program's progress log rather than in git history.

**Rule going forward for this repo, which already had the lesson in a weaker form:** this
program's commits stage explicit paths, never `-A` from the repo root, and a push is
verified by reading back what the remote actually received rather than trusting the local
exit code. When two sessions share a tree, the second one's broad `add` is indistinguishable
from a merge, and the first one's message is what gets lost.

## 2026-08-12 — FOLDED INTO BROKER OS (Matt)

The public program is no longer a second plan of record. Plan:
`docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md` v0.13.
Board (the only "where we are"): `docs/plans/ADMIN_PRODUCT/EXECUTION.md`.

Process / IA / visual locks above still bind. Dual objectives still bind.
The v3 barrel, ratchet, migration recipe, and gate contracts stay as tools.

Implementation on disk is quarry, not a final product. The 11 mixed routes
(v3 body under KB chrome) are starting points. Sibling routes in Market and
Places are still legacy. Chrome unit = `app/layout.tsx` PublicNav → V3Chrome.

`state.json` and `work-queue.json` in this folder are not authority.
Do not start Public Product OS 2.

## 2026-08-16 — Page-grade process KILLED (Matt)

Matt: the whole process is fucked. Get rid of it.

The 2026-08-14 grind deleted photography, maps, and listing facts so a
caption rule could pass. Agents called Looks green. The phone looked
like a 1998 template. That is the class.

**Dead:** `/page-grade`, "run the grind", "run the grade", grade-universe
capture, grade-ledger scoring, fix-every-open-class, regrade. The skill
files are refuse stubs. `PAGE-GRADE.md` is evidence, not instructions.

**Still binding:** six v3 patterns, one shop / five place rhythms, brand,
voice, §0, PRODUCT.md. Public look is Matt keep/kill on real pages.

Do not invent a replacement rubric in the same delivery.

## 2026-08-15 — Ban new UI components (Matt)

The public shop does not grow a new component for a new job. Six patterns.
No seventh. No arrival island, no sentence widget, no comms card as a new
surface. Wire the job into Field / Instrument / Ledger / Stage / Sheet /
Quiet, or into the search and auth that already exist. A new
`components/**/*.tsx` that draws its own chrome is a lock break.

Leftover files that already shipped against this (`SentenceSearch.tsx`,
`GoogleCommsCard.tsx`) do not license a next one. ArrivalIntent.client.tsx
was deleted 2026-08-17 (Matt CHANGE / R-218) — do not recreate it.
Do not migrate orphan charts onto V3Chart just to keep a component alive.

## 2026-08-14 — Visual lock amendment: one shop, five place rhythms (Matt)

Matt asked to move the lock, the rubric, and the page-grade skill in that order.
The 2026-08-11 visual lock still binds: six closed patterns, no page exemption,
no seventh pattern, chrome stays `V3Chrome`.

What changed in `design_system/public/PUBLIC_UI.md` §3: the line
"Places → Instrument then Field" is retired. City, neighborhood, master-plan,
subdivision, and listing each have a named opening. Same shop (chrome, type,
tokens, Field/Ledger language). Different first pattern. Master-plan is not a
neighborhood. Tetherow is the master-plan exemplar, not a one-off product.
Listing opens on Stage (this house's media). A listing that looks like another
product is a lock break.

Page Grade v2.4 scores this. The skill grades unique pages plus one exemplar
per template, then a family strip at merge. Fix is a later wave in the same
grind, not product code inside a grade.

## 2026-08-14 — Arrival, intent, Google comms (Matt, chat)

Plan of record for the public product is `PRODUCT.md`. LOOK-PLAN is the display
chapter only.

**Let them go** when they came from Google search, an ad, an email, a text, or a
shared listing. Do not ask what they are trying to do. The click is the job.

**Always map them first.** Google account email → `crm_people`, then person ids,
then `rr_vid`. Continue with Google is identity, not an intent quiz.

**Ask Buy · Sell · Look** is retired on public `/` (Matt CHANGE 2026-08-16).
It is not a nav. Do not render it as a second bar. Intent belongs on the
Google sign-on screen, not first paint. Do not remount ArrivalIntent. Do not
ship a new modal for it. Welcome back names the thing they left when that
island is mounted. No modal on land.

**Continue with Google is the comms door.** Phone + unchecked email + unchecked
carrier SMS sentence on the same card, before the redirect. Consent is not the
price of the account or the report. Kill the CMA Almost there page once checks
persist across `/auth/callback`.

**Both boards.** Classic search and AI citation. Same URL per job. Track
intent + welcome-back + stitch + opt-in first-party and in GA4. Do not stamp
CRM buyer from a cookie alone.

**Look (stamped same evening):** PropXYZ cards/map, Tremor instruments, HouseMe
report shape on our stamps. Stripe/Linear density revoked for Field and
Instrument. Do not run page-grade as the ship gate.

## 2026-08-10 — Sales cube / reporting (Matt)

Matt: deep CO closed-sales reporting; then vs now from first thick year; composition;
unique cuts (fireplaces in 1998); expose on the site; competitor share; no bottlenecks.

Shipped under `analytics_mart_*`, not the planned `sales_cube_*` names.
Public competitor names locked off forever (I6).

**Locked 2026-08-15:** public `getCoMarketAnnual` and `getCoFeatureAnnual` are
mart-only. A missing year is missing. Do not scan `listings` on those request
paths. Mart rows exist 1998–present. `CLOSED_SALES_FROM_YEAR` is 1998.
2024 region `all` stays 5,707 / $3.931B. 1990 is zero rows and does not publish.

Weekly full rebuild is registered (`/api/cron/rebuild-analytics-marts-full`,
Sunday 09:15 UTC) and heartbeats `assertMartFloorYear`. Nightly last-2-years
stays. City / CMA market board read the mart. Market family uses V3Chart.

## 2026-08-14 — One chart grammar (Matt, chat)

Standardize UIs from admin to public so we are not using two charting
systems. The new cube (analytics_mart_*) and every document we create
(CMA, packets, market pages, admin analytics) draw the same series.

**Locked:** one geometry module (`lib/charts/plot.ts`). Public skin is
V3Chart (navy/cream, Amboqia/Geist). Admin skin is AChart (`--a-*`,
Inter). Print documents use `lib/charts/print-svg.ts` with navy/cream.
No `@tremor/react`. No recharts on a live series. Field stays
photography. Do not paint the public site Inter/slate. Do not paint
admin Amboqia/navy.

## 2026-08-14 — Search is both (Matt, chat)

Classic search is not a sunset. AI answers are not a side bet. Lead both.
Sentence search writes the same filter params. No chat widget.

