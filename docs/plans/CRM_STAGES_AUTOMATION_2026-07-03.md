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

## Recommended stages — ONE unified pipeline, 6 + terminal (buyers AND sellers)

Matt directive 2026-07-03: buyers and sellers move through the **same** stages (simple, one pipeline).
Stage names are side-neutral; the `segment:buyer`/`segment:seller` tag says which side, the stage says
where. This is more maintainable than two pipelines and both journeys share the same shape.

Matt removed **New** 2026-07-03 → **5 stages** (new leads land directly in Nurture; a `New`/uncontacted
flag or the Speed-to-Lead priority handles first-touch instead of a stage).

| # | Stage | Entry (what puts them here) | Seller = | Buyer = | Exit |
|---|---|---|---|---|---|
| 1 | **Nurture** | lead created (new leads start here), on the database, no active intent (90% of the 18K live here) | farming, no sell intent | no active buy intent | a hard intent signal → Engaged |
| 2 | **Engaged** | **hard signal**: inbound reply, seller-LP/buyer form, valuation/CMA or showing request, or appointment booked | wants to sell, working to the listing appt | wants to buy, consult / pre-approval | signed agreement → Active; OR stale 30d (no two-way) → Nurture |
| 3 | **Active** | signed representation / actively in-market | listed & marketing | signed buyer-rep, touring + offering | goes under contract → Under Contract; OR lost → Nurture |
| 4 | **Under Contract** | `crm_deals` row / accepted offer | listing pending | offer accepted | closing date passes |
| 5 | **Closed → Past Client** | deal closes | sold | bought | (rarely; re-enters Engaged on new intent) |
| — | **Lost / Trash** (terminal) | opt-out, hard-stop, bad contact, or dead after long inactivity | — | — | manual reactivation only |

**UI (Matt 2026-07-03):** on `/admin/crm`, the 5 stages render as a **Stages strip ABOVE the Pipeline
Collection** in the left sidebar — clickable stage chips w/ live counts (like the mobile Stages strip),
filtering the list by stage.

**Why Engaged AND Active are both kept:** Engaged = intent shown, no signed agreement yet; Active =
signed & in-market (listed / touring). Different work, different next actions — collapsing them hides
"chasing the listing" vs "selling the listing." If Matt wants leaner, drop Active into Under Contract
→ 5 stages; recommend keeping Active (most of the real work lives there).

**Farm note:** the mass sits in **Nurture** for years; the pipeline's job is to *detect the few who move
to Engaged*, not march everyone forward. Optimize for cheap warm-hold + sharp intent detection.

**New separate?** Keep it ONLY with a speed-to-lead SLA; if leads sit uncontacted regardless, merge into
Nurture. Decision for Matt.

## Stage automation — trigger table

**AUTOMATE (the event is unambiguous; the CRM already emits these):**

| Move | Trigger (real signal) | Reliability |
|---|---|---|
| New → Nurture | first outbound sent + no reply in ~7d | high |
| New/Nurture → **Engaged** | inbound reply · seller-LP submit · valuation/CMA request | high — a real action |
| Engaged → **Appointment** | `crm_appointments` row created for this person | high |
| Appointment → Listed/Under Contract | listing agreement / `crm_deals` created | high |
| Under Contract → Closed → Past Client | `crm_deals` close date passes / marked closed | high |
| **Engaged/Appointment → Nurture (DEMOTE)** | no TWO-WAY activity in **30 days** (Engaged only; Active/UC never demote) | high — the load-bearing automation |
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

- **30-day two-way-inactivity demote** on Engaged → Nurture (Active/UC exempt) prevents those lists from silting up
  and becoming meaningless (the #1 failure mode). This matters more than any promotion rule.
- **Re-nurture sequence** on demote: month 1 value email, month 3 "still thinking about selling?" text,
  month 6 market report — the researched cadence.
- **No stage is a dead end except Lost/Trash**, and even Lost re-enters Engaged on a fresh inbound.

## Execution spec — stage migration + Stages strip (PLANNED, not yet run; awaiting Matt's go)

**A. Stage set + reversible remap** (dry-run + before/after report FIRST, then apply; back up every
contact's current `stage` to `out/stage-migration-backup.json` + `scripts/_stage-migration-restore.mjs`):

New active `crm_stages` (this order): **Nurture · Engaged · Active · Under Contract · Closed · Past
Client · Sphere** + **Trash** (terminal). Deactivate (don't delete) the old 16.

Old → new `crm_people.stage` map (touches only `stage` + `crm_stages`; tags/points/timeline/compliance
untouched; idempotent):

| Old stage (count) | → New |
|---|---|
| Lead (8,265) · Seller Prospect (7,524) · Renter-future buyer · old Nurture | **Nurture** |
| A-Hot / B-Warm / C-Cold (temperature → becomes priority, not a stage) | **Nurture** |
| Active Client (12) | **Active** |
| Pending | **Under Contract** |
| Closed | **Closed** |
| Past Client (32) | **Past Client** |
| Real Estate Agent (2,342) · Vendor (1) | **Sphere** (non-pipeline network) |
| Archive (2) · Trash | **Trash** |

Reconcile totals (no contact lost/duped) before applying. Big visible change (every contact's stage) →
report the before→after distribution + one-command restore.

**B. Stages strip on `/admin/crm`** — add ABOVE the Pipeline Collection in
`components/admin/crm/people-list/PeopleSidebar.tsx` (collection grouping in `saved-view-grouping.ts`,
label 'Pipeline'; page `app/admin/(protected)/crm/page.tsx` already computes stage counts + filters on
`?stage=`): the 5 pipeline stages as clickable chips w/ live broker-scoped `count:'exact'` counts,
linking to `?stage=<stage>`. Match the sidebar's design-system language; mirror the mobile Stages strip
(`ptab='stages'`); don't break mobile. Verify live at 1440×900 + screenshot.

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

## Resolved (Matt 2026-07-03)

1. **New removed** → 5 pipeline stages (leads start in Nurture).
2. **Realtors/vendors → Sphere.** One non-pipeline "Sphere" stage holds all network contacts (realtors,
   vendors, personal sphere); the segment tag sub-classifies. Keeps the 5-stage pipeline purely
   buyer/seller.
3. **Demotion = 30 days, Engaged ONLY.** Engaged → Nurture after 30 days of no **two-way** activity
   (inbound reply / held call / kept appointment — NOT email opens, NOT outbound drip sends). **Active and
   Under Contract never auto-demote** (a signed client isn't stale) — they exit only on deal events (deal
   lost = manual; Under Contract → Closed on the close date). Demotion is a scalpel on the intent phase,
   not a blanket inactivity rule.
