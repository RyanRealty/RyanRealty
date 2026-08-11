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
