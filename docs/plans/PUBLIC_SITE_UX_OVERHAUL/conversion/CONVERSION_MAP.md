# Conversion map — Public Site (P3)

**Date:** 2026-08-11  
**Status:** complete for process lock (recommended)

## North-star events

| ID | Event | Success |
|---|---|---|
| E1 | `valuation_start` | Address/step1 on seller path |
| E2 | `valuation_complete` | Full CMA/valuation request to CRM |
| E3 | `alert_subscribe` | Listing alert / saved search email |
| E4 | `tour_intent` | Schedule tour / text / call from listing |
| E5 | `contact_submit` | Contact or work-with-broker |
| E6 | `account_create` | Soft membership (secondary) |

## Template → job → primary CTA → events

| Template | Job | Primary CTA | Events | CRM destination |
|---|---|---|---|---|
| home | Orient + start buy or sell | **Buy default:** Search homes · **Sell affordance:** Value my home (secondary style) | E3 path, E1 path | alerts / valuation |
| search | Find homes | Open listing · Save/Get alerts | E3 | listing_alerts / saved_searches |
| listing | Decide tour | Schedule tour / Text / Call (one broker) | E4 | FUB lead + task |
| sell | Get value → list conversation | Hero valuation form | E1, E2 | CMA queue + FUB |
| sell/valuation | Written CMA only | Submit valuation | E1, E2 | CMA queue |
| buy-hub | Choose buyer path into product | Search / Alerts | E3 | alerts |
| brokerage about/team | Trust → pick path | Work with X / Contact | E5 | FUB |
| reviews | Proof | Contact / Search / Value | E5 | FUB |
| contact | Reach human | Call + Text + form | E5 | FUB |
| geo | Place decision | Homes in place / Alerts / Value | E3, E1 | alerts / valuation |
| market | Understand market | Explore / Value (if owner) | E1 | valuation |
| hub (OH, price drops) | Act on list | Open listing / Alerts | E3, E4 | alerts |
| tool | Complete calc | Result → Contact/Value | E5, E1 | FUB |
| content | Learn | Soft CTA end of article | E3, E5 | — |
| lp | Ad conversion | Single form | E1 or E3 per LP | attributed sourceUrl |
| legal | Comply | none | — | — |
| account | Return visit | Sign in / saved | E6 | auth |

## CTA grammar (process)

1. Exactly **one** primary button style per viewport.  
2. Global chrome: **Search homes** (buy) + **Value my home** (sell) — sell never equal-weight on buyer pages.  
3. Listing: sticky **tour/text/call** only; one named broker.  
4. No five equal ghost buttons in any hero.  
5. Post-submit: always say what happens next + when.

## Instrumentation gaps (fix in P6–P8)

| Gap | Action |
|---|---|
| Section engagement may exist (`KbSectionTracker`) but not unified to north-star events | Map E1–E6 to first-party + CRM |
| Alert subscribe criteria inheritance from active search | Verify wire; fix if broken |
| Valuation duplicate entry points | One component; many mounts |
| GA4 untrusted | Dual-source: FP + CRM until parity |
| Speed-to-lead unmeasured for all web leads | Funnel metric in baseline snapshots |

## Baseline capture checklist

See `BASELINE.md`. Before claiming conversion lift, snapshot 14d/30d E2, E3, E4, E5 counts.

## Process lock recommendation

**Adopt this map as the conversion process of record.** Family rebuilds may not invent alternate primary CTAs without updating this doc.
