# Public Product OS — decisions (append-only)

This file is the ONLY place a lock counts. Chat approval without a line here is not a lock.

## Lock status

- Process lock (P3): **PENDING**
- IA lock (P5): **PENDING**
- Visual lock (P6): **PENDING**
- Litmus sign-off (P8): **PENDING**

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
