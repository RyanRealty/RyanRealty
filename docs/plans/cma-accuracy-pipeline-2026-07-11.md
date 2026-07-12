# CMA accuracy pipeline — progress log (2026-07-11)

**Directive (Matt):** 100% accuracy on CMAs using the best possible reasoning over ALL features of subject vs comps; write and ENFORCE the process so every CMA build follows it.

## Shipped (in order)

| Commit | What |
|---|---|
| `af572804` | Comp-dispersion guard: $/sqft CV > 18% floors confidence + sets `needs_review` + "Needs review" badge in /admin/cmas. Validated on 5 real expired CMAs (caught Redrose 0.21 that manual review missed). |
| `bd43dbb5` | LLM comparability judge (`lib/cma/judge.ts`): Sonnet pass classifies each comp strong/weak/exclude with reasons + narrative. Proven on Greenwood: excluded $414/$236/$218-per-sqft non-comparables for $0.024. Fail-open. |
| `886fdd44` | Full-feature reasoning + enforcement: judge sees beds/baths/year/lot/garage/view/tax/DOM/remarks for subject + every comp; weak comps half-weight in Method 3; excluded dropped pre-math; `lib/cma/contract.ts` accuracy contract on EVERY build (hard checks fail the build; review checks force needs_review). 23/23 CMA tests. |

## Architecture (locked in SKILL.md §0)

deterministic data/math (§0-safe) → LLM comparability judgment (full features) → verdict-weighted pricing → accuracy contract (hard-fail / force-review) → draft in /admin/cmas. Judge unavailable ⇒ needs_review forced; unvetted never presents as vetted.

## Verification status

- [x] Unit: 23/23 lib/cma tests (contract hard-fail, force-review, weights, dispersion, fail-open)
- [x] Live judge run on real Greenwood comps (excluded exactly the out-of-tier sales)
- [ ] E2E on prod: rebuild the 5 seeded expired CMAs with judgment active, verify build_summary.judgment.used_llm + accuracy_contract in DB
- [ ] Browser: /admin/cmas badges + narrative visible in a rebuilt document
- [ ] Final review pass

## Context for the wider expired-listing effort

- SMS template saved: crm_templates id 116 `expired-first-touch-sell-v1` (%address%, no name)
- Expired backlog: 135 rows, 23 with phones; skip-trace blocked on BatchData balance (Matt funding). Owner-name + demographics capture shipped in `ce31efe0`.
- Next after CMAs: batch-build remaining ~110 expired CMAs, manual approve-and-send queue, pause Plan 71 auto-fire.
