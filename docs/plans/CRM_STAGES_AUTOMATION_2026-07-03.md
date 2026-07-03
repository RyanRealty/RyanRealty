# CRM Stage Model + Stage Automation (2026-07-03)

> Researched recommendation for simplifying Ryan Realty's pipeline stages (16 → 6) and automating
> movement between them. Seller-farm-tuned. Sources cited. Companion to the tag/smart-list streamline
> plan (`CRM_TAG_SMARTLIST_STREAMLINE_PLAN_2026-07-03.md`) — stage = journey axis, tag = segment axis,
> priority = temperature axis.

## Research basis (real-estate-specific sources)

- **Follow Up Boss** default stages = Lead → Attempted Contact → Appointment Set → Hot / Warm / Cold.
  FUB folds *temperature* (Hot/Warm/Cold) INTO stages and drives follow-up cadence from it (hots weekly,
  warms bi-weekly, colds monthly). This is the exact conflation to avoid — temperature is a cadence/
  priority signal, not a journey position. [followupboss.com/blog/real-estate-lead-management]
- **Seller pipeline (multiple sources)** = New Lead → Contacted → Consultation/Appointment Scheduled →
  Active (listing prep) → Under Contract / Listed → Closed. Solo residential agents run **5–6 stages**.
  [prospeo.io/s/real-estate-pipeline-stages · realoffice360.com · keap.com small-business-automation-blog]
- **Stage count**: 5–7 is the consistent best-practice band; <5 loses visibility, >8 is unmaintained
  overhead. A stage needs explicit **entry + exit criteria** (that's what separates it from a status/tag)
  and should mark a **commitment milestone (the contact's action)**, not an internal task.
  [teamgate.com · onpipeline.com · forecastio.ai · hubspot lifecycle-vs-status]
- **Automation**: advance stage on a **completed event** (e.g. appointment completed → auto-move +
  create the next task), not a soft signal. Re-engage/demote on **inactivity** (≈10 days no engagement →
  re-nurture sequence; Cold/Unresponsive → month 1/3/6 touches). **Behavior-based triggers beat pure
  time-based**, but the behavior must be a real action, not an email open.
  [ihomefinder.com/blog real-estate-crm-automation · realgeeks.com/blog/real-estate-crm-automations ·
  keetechnology.com/blog/crm-workflow-templates-for-real-estate]

## Recommended stages — 6 + terminal (seller farm)

| # | Stage | Entry (what puts them here) | Exit (what moves them out) | Owns the record |
|---|---|---|---|---|
| 1 | **New** | lead created, zero contact | first outbound attempt logged | pipeline entry |
| 2 | **Nurture** | contacted, on the farm, no listing intent yet (90% of the 18K live here) | a hard intent signal → Engaged | the long-hold bucket |
| 3 | **Engaged** | **hard signal**: inbound reply (text/email/call), seller-LP form, or valuation/CMA request | appointment set → Appointment; OR stale (no activity 45d) → back to Nurture | the "work these now" list |
| 4 | **Appointment** | listing appointment booked (`crm_appointments`) | listing agreement signed → Listed; OR no-show/lost → Nurture | pre-listing |
| 5 | **Listed / Under Contract** | listing agreement or `crm_deals` row created | closing date passes | the transaction |
| 6 | **Closed → Past Client** | deal closes | (rarely; re-enters Engaged on new intent) | repeat + referral |
| — | **Lost / Trash** (terminal) | opt-out, hard-stop, bad contact, or dead after long inactivity | manual reactivation only | dead |

**Seller-farm difference vs a buyer funnel:** the mass sits in **Nurture** for years; the pipeline's job
is to *detect the few who move to Engaged*, not march everyone forward. Optimize for cheap warm-hold +
sharp intent detection, not velocity.

**6 vs 7:** keep **New** separate ONLY with a speed-to-lead SLA (contact within X hours); if leads sit
uncontacted regardless, merge New into Nurture (→ 5 stages). Decision for Matt.

## Stage automation — trigger table

**AUTOMATE (the event is unambiguous; the CRM already emits these):**

| Move | Trigger (real signal) | Reliability |
|---|---|---|
| New → Nurture | first outbound sent + no reply in ~7d | high |
| New/Nurture → **Engaged** | inbound reply · seller-LP submit · valuation/CMA request | high — a real action |
| Engaged → **Appointment** | `crm_appointments` row created for this person | high |
| Appointment → Listed/Under Contract | listing agreement / `crm_deals` created | high |
| Under Contract → Closed → Past Client | `crm_deals` close date passes / marked closed | high |
| **Engaged/Appointment → Nurture (DEMOTE)** | no logged activity in **45 days** | high — the load-bearing automation |
| any → Lost/Trash | opt-out · `compliance:hard-stop` · bounce · dead after long silence | high |

**DO NOT AUTOMATE — route to priority instead:**

| Signal | Why not | Do this |
|---|---|---|
| email open | Apple/Gmail prefetch inflates opens → false positive | raise priority to Warm; do not move stage |
| website / IDX visit | interest ≠ intent | Warm flag + a follow-up task, not a stage move |
| Nurture → Engaged on soft signals | manufactures fake pipeline | only a reply/form/request auto-advances |
| Appointment → Listed | signing is a deliberate act you control | manual or deal-driven |

**Principle:** automate **demotions** and **transaction-side** moves (driven by hard events); gate
**intent-side promotions** on an actual reply / form / booked appointment. Temperature (Hot/Warm/Cold)
absorbs every soft signal (opens, visits, lead score) so they inform *who to call* without corrupting
*where they are*.

## Anti-stuck rules (from the research)

- **45-day inactivity demote** on Engaged/Appointment → Nurture prevents those lists from silting up
  and becoming meaningless (the #1 failure mode). This matters more than any promotion rule.
- **Re-nurture sequence** on demote: month 1 value email, month 3 "still thinking about selling?" text,
  month 6 market report — the researched cadence.
- **No stage is a dead end except Lost/Trash**, and even Lost re-enters Engaged on a fresh inbound.

## Implementation (against existing infra, when Matt approves)

- Migration: map the 16 current stages → the 6 (Seller Prospect → Nurture + `segment:seller`;
  Real Estate Agent → Sphere/Nurture + `industry:realtor` [stages are for the sales journey — realtors/
  vendors carry a segment tag and sit in Nurture/Sphere]; A/B/C → priority; Renter → Buyer segment;
  Archive → Trash; empties dropped). Reversible, dry-run first.
- Automation: stage transitions fire from the existing signals — inbound webhooks (Twilio/Gmail),
  LP form actions, `crm_appointments`, `crm_deals`, and a daily inactivity sweep (`last_activity_at`).
  Build the **demotion sweep + the transaction-side auto-moves first** (highest value, lowest risk).
- Temperature: a `priority` signal (Hot/Warm/Cold) derived from recent engagement + lead score, sortable
  within a stage — replaces the A/B/C stages.

## Open for Matt

1. 6 stages vs 5 — is **New** real (do you have a speed-to-lead SLA) or merge into Nurture?
2. Confirm the **45-day** demotion window (or set your own).
3. Where do realtors/vendors sit — a **Sphere** stage, or Nurture with their segment tag? (They're not in
   the sales pipeline; recommend a light "Sphere/Network" holding stage so they don't clutter Nurture.)
