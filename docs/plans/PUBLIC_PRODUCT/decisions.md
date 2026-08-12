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
