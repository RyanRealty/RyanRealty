# Pricing backtest — the containment ladder (2026-09-09)

`scripts/pricing-backtest.mjs`, N=600, stride sample of closed detached SFR in `sale_pricing_facts`
(2024-01-01..2026-07-01, 800–4,000 sqft, > $150,000), as-of each subject's own close date, comps
path only, predicted close vs actual close. Before = main at 63e78f72 (the ladder without the
adjacent-plat rungs); after = 7cfa339a (subdivision to 12 months → adjacent plats 3–12 months →
rings inside the boundary → beyond-boundary only under five sales). The after run also gives the
ladder each sale's plat (`geo_assign_batch`) and the subject's ring (`cma_subdivision_ring`).

| | before | after |
|---|---|---|
| priced | 461 | 479 |
| starved (refused) | 139 | 121 |
| mape | 9.9% | 9.9% |
| median_abs_err | 6.8% | 6.8% |
| within_2pct | 16.7% | 18.6% |
| within_5pct | 39.9% | 38.4% |
| within_8pct | 55.7% | 57.4% |
| within_10pct | 63.8% | 64.5% |

Reading: accuracy is unchanged inside the sample's noise (median absolute error identical at
6.8%, MAPE 9.9% both ways, within-5% down 1.5 points, within-8% and within-10% up 1.7 and 0.7);
coverage rose by 18 subjects (139 → 121 starved), which is the 12-month subdivision rung and the
disclosed boundary exit reaching homes the old ladder refused. The metric that the containment
rule is for — a comp set a buyer for that house would actually consider — is not a closed-price
error and is not measured here; the seller-facing evidence is the rung trace on each document
(Merle Lookabaugh's 1617 NW 8th: subdivision-12mo → adjacent-subdivision-6mo →
adjacent-subdivision-12mo → neighborhood-6mo, six sales, all inside River West).

Raw outputs: the two JSON blocks below are the scripts' own summaries, verbatim.

## before

```json
{
  "cite": "docs/DATABASE_FOR_AI_AGENTS.md \u00a72b sale_pricing_facts; comps-path only; predictedClose; last_ask is report-only",
  "fetched_at": "2026-09-09T11:50:45.425Z",
  "facts": 149754,
  "sample": 600,
  "starved": 139,
  "refused": 139,
  "close": {
    "priced": 461,
    "mape": 0.0986,
    "within_2pct": 0.167,
    "within_5pct": 0.399,
    "within_8pct": 0.557,
    "within_10pct": 0.638,
    "median_abs_err": 0.0683
  },
  "seller_net": {
    "priced": 461,
    "mape": 0.1009,
    "within_2pct": 0.167,
    "within_5pct": 0.388,
    "within_8pct": 0.549,
    "within_10pct": 0.633,
    "median_abs_err": 0.0713
  }
}
```

## after

```json
{
  "cite": "docs/DATABASE_FOR_AI_AGENTS.md \u00a72b sale_pricing_facts; comps-path only; predictedClose; last_ask is report-only",
  "fetched_at": "2026-09-09T13:23:46.340Z",
  "facts": 149754,
  "sample": 600,
  "starved": 121,
  "refused": 121,
  "close": {
    "priced": 479,
    "mape": 0.0992,
    "within_2pct": 0.186,
    "within_5pct": 0.384,
    "within_8pct": 0.574,
    "within_10pct": 0.645,
    "median_abs_err": 0.0683
  },
  "seller_net": {
    "priced": 479,
    "mape": 0.1019,
    "within_2pct": 0.173,
    "within_5pct": 0.378,
    "within_8pct": 0.547,
    "within_10pct": 0.639,
    "median_abs_err": 0.0713
  }
}
```
