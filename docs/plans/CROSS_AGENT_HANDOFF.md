> **NEWEST, START HERE: CMA/report depth + valuation correctness + degraded-read class (2026-07-30, Claude Code).** Prior: Brain Dump 2 — prospecting/CMA workflow + site IA.

# Current — 2026-07-30 (Claude Code)

| Field | Value |
|---|---|
| Surface | Claude Code |
| `main` @ | `1e647e67` pushed, 190 gates green, 340 test files / 4257 tests passing |
| Prior plan | [`PROSPECT_TO_CMA_AND_SITE_IA_2026-07-28.md`](PROSPECT_TO_CMA_AND_SITE_IA_2026-07-28.md) — the 18 Brain Dump 2 items, all closed |

## Shipped this session

| Item | Commit | Evidence |
|---|---|---|
| **Zoning, development, rental, income sections** | `9f061b0b` | Every CMA/audit/BPO now answers: what zone the property is in, whether the lot can be subdivided, whether additional units or an ADU are allowed, what a buyer could develop, HOA and CC&Rs, and long-/mid-/short-term rental rules with income potential. Five legally wrong facts were corrected during the build, including the Deschutes WA overlay (40/160/320 acres, independently verified) which would otherwise have told a seller a 160-acre parcel supports 4 divisions when it supports 1 or zero. |
| **Report rebuild + truncation fix** | `9f061b0b` | `.page` was fixed at 11in with `overflow:hidden`, so any section taller than a page was silently cut — the rental page measured 196% of its page. Long sections now chunk ("Renting It Out 1 of 3"). 922 Ogden renders 29 sections / 237,313 bytes. |
| **Published CMA on listing pages** | `618754b8` | Broker-operated publish control on the review page. Three states; the confirm dialog splits what becomes public from what stays private. **The recommended list price and every sold comp stay private.** Verified as matt@ against the real DB: publish → listing page renders the range with the ODS §7-3 period notice → take-down removes it and kills outstanding download tokens. Left `published_now = 0`. |
| **Comps must match product type** | `83a50f89` `6354d87f` | `PropertyType='A'` is the SFR convention but it is a *bucket*. Measured on 1,000 closed Bend sales: 818 Single Family Residence, 75 Townhouse, 43 Manufactured On Land, 22 Condominium, 3 Tenancy in Common. **14.3% of the pool offered to a detached subject was a different product and the selector took it.** On 922 Ogden that put two townhomes into a 4-comp detached analysis behind a $640,000 recommendation the auditor called indefensible. Now a hard exclusion at every tier, fail-open on unknown, locked by tests. |
| **A degraded read must not publish a zero** | `1e647e67` | `/cities/bend/southeast-bend` showed "0 homes for sale" beside a real $810,000 median. Operator precedence: `??` binds looser than `>`, so `pulse?.activeCount ?? pins.length > 0 ? … : …` made the pulse count a truthiness test and the answer was always `pins.length`. **Six more pages had the same class**, including `/zip` fabricating the 0 inside the Dataset JSON-LD Google reads. `withTimeoutFallbackResult` now returns `{ value, ok }`; counts are `number \| null`; consumers suppress rather than print 0. Gated by `ci:count-degraded-read` (AST). |

## The CMA corpus, as of now

227 documents. **22 archived** (17 were `zztest`/`zz-test` residue from integration tests writing to production — 5 of them sat in `delivered` status and were inflating the delivered count). **205 live.**

- **178 rebuilt successfully** on the new pricing, comp ladder, and section set.
- **23 could not be priced**: 18 lacked 3 qualifying comps, 5 have no matching MLS row. No exceptions, no bugs — these are honest data limits. Verified that product type is *not* the binding constraint (one failing subject had 84 same-product candidates citywide); the binding constraints are the market-area and lot-character rules that predate this session.
- **7 deliberately untouched** — 5 `finalized`, 2 `delivered`. Rebuilding a document a client already has would silently reprice it.
- Judge spend for the whole rebuild: **$4.06** over 178 builds.

## Open for Matt — one real decision

**164 of 198 rebuilt documents (83%) carry `needs_review`.** The adversarial auditor is doing its job, but at that rate the flag does not discriminate, and because `needs_review` blocks publishing, only ~17% of documents can feed the listing-page funnel.

The findings cluster as: narrative mismatch 90%, price unsupported 63%, condition/quality tier 51%, location/subdivision 41%, product type 13% (down from the pre-fix state), too few comps 7%. **53% of flagged documents sit at exactly 3 comps**, the bare minimum — with three comps, one questionable comp makes the price unsupportable.

Findings already carry `[critical]` / `[major]` / `[minor]` severity, but the publish gate is binary on the verdict. **A severity-aware gate — block on `critical`, flag `major`, ignore `minor` — would be the obvious fix.** It was deliberately NOT applied unilaterally: loosening what goes public under a principal broker's license is Matt's call, and the strict default blocks nothing that matters while it waits.

## Known gaps

- The comp trace is not persisted into `build_summary`, so tier-by-tier exclusion counts cannot be audited after a build. Add it before the next comp-logic change.
- Integration tests still write to production (`zztest` rows). Archiving is a cleanup, not a fix — the tests need their own teardown or a non-production target.
- Three page files (neighborhood 598, city 695, community 1029 lines) sit exactly at their file-size ceilings. The next addition needs a real extraction, not comment trimming.
