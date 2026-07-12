# CMA accuracy pipeline — progress log (2026-07-11)

**Directive (Matt):** 100% accuracy on CMAs using the best possible reasoning over ALL features of subject vs comps; write and ENFORCE the process so every CMA build follows it.

## Shipped (in order)

| Commit | What |
|---|---|
| `af572804` | Comp-dispersion guard: $/sqft CV > 18% floors confidence + sets `needs_review` + "Needs review" badge in /admin/cmas. Validated on 5 real expired CMAs (caught Redrose 0.21 that manual review missed). |
| `bd43dbb5` | LLM comparability judge (`lib/cma/judge.ts`): Sonnet pass classifies each comp strong/weak/exclude with reasons + narrative. Proven on Greenwood: excluded $414/$236/$218-per-sqft non-comparables for $0.024. Fail-open. |
| `886fdd44` | Full-feature reasoning + enforcement: judge sees beds/baths/year/lot/garage/view/tax/DOM/remarks for subject + every comp; weak comps half-weight in Method 3; excluded dropped pre-math; `lib/cma/contract.ts` accuracy contract on EVERY build (hard checks fail the build; review checks force needs_review). 23/23 CMA tests. |

## Architecture (locked in SKILL.md §0)

deterministic data/math (§0-safe) → LLM comparability judgment (full features) → verdict-weighted pricing → **adversarial accuracy audit (independent second pass, tries to refute; Matt directive 2026-07-11)** → accuracy contract (hard-fail / force-review; audit-ran + audit-clean are contract checks) → draft in /admin/cmas. Judge or auditor unavailable ⇒ needs_review forced; unvetted/unaudited never presents as vetted.

## Adversarial audit — calibration journey (same day)

| Round | Outcome | Action taken |
|---|---|---|
| 1 (raw) | All 5 fail, 6–14 findings each — auditor re-derived arithmetic (LLMs can't) + misread under-labeled fields | Re-chartered: arithmetic out of scope (machine-verified layer owns it), every prompt field labeled, failed-list nuance (`d0cdeebb`) |
| 2 (calibrated) | All 5 fail, 4–5 findings — now SUBSTANTIVE: townhome kept by judge, premium-feature comps, age/solar mismatch | Findings made machine-actionable (compListingKey) + bounded self-repair loop: drop flagged comps → re-price → re-audit once (`03ac779c`) |
| 3 (self-repair) | Repair fired (Slate −4 comps, Fairfield −1). Audit caught a REAL §0 data bug: year_built=2146 (sqft duplicated into year field by MLS entry on the re-listed Slate row) + stale narrative indices | saneYearBuilt() mapper guard both sites + regression test; narrative may not use comp indices; repair disclaimer note (`2b95df0f`) |

**Operational learnings:**
- 20606 Slate RE-LISTED (Active $599K, on market 2026-07-11) → the expired-outreach queue MUST exclude expired rows whose property has a newer Active listing (ethics: never solicit a listed property). Build this check into the send queue.
- Worker route budget: each build now runs up to 3 LLM passes — drain the queue at limit≤2 per invocation (limit=5 exceeded 300s).
- Auditor verdicts remain harsh (fail on debatable-but-defensible recommendations). All flagged CMAs land needs_review, which is the correct fail-safe posture: Matt reviews at /admin/cmas before anything releases. Severity calibration can continue iterating; the gate itself is sound.

## Round 4 — deterministic verdicts + BPO rollout (same day, Matt directives)

- **Deterministic audit verdicts** (`computeAuditVerdict`): the LLM reports categorized findings (data-integrity / comp-selection / price-opinion / narrative / market-verdict); CODE decides the verdict. Rationale: live calibration showed the adversarial reviewer attacks any configuration from whichever side is open (demanded premium-comp exclusions, then attacked the exclusions). Rules: critical data-integrity ⇒ fail; comp/narrative/market/price-opinion ⇒ review; minors ⇒ pass. Model's own verdict stored as advisory `llm_verdict`.
- **BPO accuracy architecture** (`61b94a72`): buildBpo runs the shared judge → weak-half-weighted pricing → opinion → adversarial audit in finalOpinion mode (attacks the OPINION with ceiling/listing-pressure context) → bounded self-repair (re-derives pricing AND opinion) → `evaluateBpoAccuracyContract` (base + hard: opinion-in-range, active-ceiling-held; review: opinion-confidence downgrade). `finalizeBpoAction` refuses a needs_review build without explicit broker acknowledgment (confirm flow in BpoReviewActions).
- **Live E2E (real UI, Matt's session)**: built `bpo-1652-redrose-bend` through /admin/bpo/new — opinion $530K ($505–545K), judge excluded 6 candidates, audit `llm_verdict=fail` demoted to `verdict=review` by code, needs_review=true, contract pass, draft. The deterministic-verdict demotion observed working in production.
- Year-guard verified live: rebuilt Slate persists `subject_year_built=null` (was 2146).
- CMA repair loop verified live: Fairfield −1 comp, 22nd −2 comps, both re-audited.

## Verification status

- [x] Unit: 23/23 lib/cma tests (contract hard-fail, force-review, weights, dispersion, fail-open)
- [x] Live judge run on real Greenwood comps (excluded exactly the out-of-tier sales)
- [ ] E2E on prod: rebuild the 5 seeded expired CMAs with judgment active, verify build_summary.judgment.used_llm + accuracy_contract in DB
- [ ] Browser: /admin/cmas badges + narrative visible in a rebuilt document
- [ ] Final review pass

## Re-list guard (MANDATORY in the outreach send queue — never solicit a listed property)

Verified 2026-07-11: **22 of 135 expired rows (~16%) have re-listed** (Active/Pending with `status_change_timestamp` after the expired event). Texting any of them = soliciting another broker's active listing (NAR Art. 16 / OAR ethics exposure). The send queue MUST exclude via this join (same-address newer on-market listing):

```sql
-- exclude when EXISTS a newer on-market listing at the same address
join listings l on l."StreetNumber" = split_part(e.street_address,' ',1)
  and upper(l."StreetName") like upper(substring(e.street_address from position(' ' in e.street_address)+1))||'%'
  and upper(l."City") = upper(e.city)
  and l."StandardStatus" in ('Active','Pending','Coming Soon')
  and l.status_change_timestamp > e.status_change_timestamp
```

Run at SEND time (not queue-build time) — a property can re-list between queueing and sending.

## Context for the wider expired-listing effort

- SMS template saved: crm_templates id 116 `expired-first-touch-sell-v1` (%address%, no name)
- Expired backlog: 135 rows, 23 with phones; skip-trace blocked on BatchData balance (Matt funding). Owner-name + demographics capture shipped in `ce31efe0`.
- Next after CMAs: batch-build remaining ~110 expired CMAs, manual approve-and-send queue, pause Plan 71 auto-fire.
