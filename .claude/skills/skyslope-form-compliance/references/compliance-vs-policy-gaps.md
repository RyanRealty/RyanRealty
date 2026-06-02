# "Required" ≠ "legally required" — compliance-vs-policy gap taxonomy

When to read: classifying compliance gaps in an audit's `flags.json`;
deciding whether a missing checklist activity is a real legal exposure
or just a brokerage best-practice miss; deciding which gaps actually
need outside-ask follow-up.

## The distinction

SkySlope's checklist marker `status: 'Required'` is a **brokerage-policy
audit setting**, NOT a legal requirement. Many SkySlope "Required"
activities are best-practice file-completion items that are
informational / advisory in nature and do not trigger any actual legal
obligation when left empty.

## Activities whose empty state is OK absent specific facts

| SkySlope activity | Legal status if empty | Notes |
|---|---|---|
| Initial Agency Disclosure (042 \| 10.4) | Compliant if pamphlet was delivered (ORS 696.820 requires DELIVERY, not signed acknowledgment). A standing pamphlet link in the broker's email signature satisfies delivery. The acknowledgment form is best-practice but not statutory. | OREF 042 |
| FIRPTA Advisory | Only required when seller is foreign person (IRC §1445). For US-domestic sellers (verified by recorded deed + US addresses), FIRPTA cert is not required. | Title's call |
| Electronic Funds Advisory | No Oregon statutory requirement. Title's Wire Fraud Scam Alert Flyer (informational) covers the warning. | Best practice |
| Real Estate Forms Advisory | Embedded in BBSA / OREF 040/041/050. Standalone signed advisory not required. | OREF or N/A |
| Smoke Alarms Advisory | OREF 080 is the advisory; the actual legal requirement is that alarms work at closing (verified via SPD smoke-alarm section or external compliance check). Standalone signed OREF 080 not legally required. | Verify alarms working |
| Broker Commission Demand from Title | OREF 091 Notice of Real Estate Compensation language ("Request is hereby made the compensation be paid in that amount and on those terms, out of Escrow") serves the same legal function as a CDA. | OREF 091 = the demand |
| Broker Notes | Internal notes only. Fill with the transaction-summary PDF per [broker-notes-generation.md](broker-notes-generation.md). | Always upload summary |

## Gap classification taxonomy

Every gap in `flags.json` MUST be classified by this taxonomy. Don't
lump them all as "missing required docs" — Matt's principal broker
license is only at risk for `legal_gap`s.

- **`legal_gap`** — fails a statutory requirement (ORS chapter, IRC §,
  etc.). These are the only gaps that genuinely threaten the license.
- **`policy_gap`** — fails SkySlope or brokerage best-practice but no
  legal risk. Worth fixing for audit cleanliness, not urgent.
- **`false_positive`** — checklist activity flagged but the
  doc-or-equivalent exists in a different slot.
- **`not_applicable`** — the doc isn't required for THIS transaction's
  facts (e.g. FIRPTA on a US-domestic seller).

## Statutory sources (sticky)

- **ORS 696.820** — Agency disclosure pamphlet; rules
- **ORS 105.464–105.490** — Seller's Property Disclosure
- **ORS 479.255** — Smoke alarm or smoke detector required
- **IRC §1445** — FIRPTA withholding (foreign sellers only)
- **OREF 080** — Residential Advisory Smoke/CO Alarms (advisory form,
  not certification)
