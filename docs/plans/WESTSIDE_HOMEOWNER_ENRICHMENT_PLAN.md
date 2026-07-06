# Ryan Realty CRM — Comprehensive Westside Farm, Enrichment & Organization Plan (2026-07-04)

## System of record (corrected)
**The in-house CRM is the system of record — NOT Follow Up Boss.** FUB is being
decommissioned. Everything below executes directly against:
- `public.crm_people` (Supabase) — the contacts.
- `public.crm_saved_views` — the smart lists (rendered in `/admin/crm`, compiled by the
  `buildCrmPeopleQuery` AST engine).
- `crm_people.tags` (text[]) — the tag taxonomy.
- `crm_people.neighborhood_slug / subdivision / is_resort` — canonical geo (added today).
- Comms: **Twilio** (SMS/call), Resend (email), Meta (ad audiences).

Because it's our own DB, the agent inserts/enriches/tags/builds-lists **directly** (service role,
draft-first, backed up). No FUB import, no field-mapping, no re-mapping bug.

## What we're actually doing
Build a **Westside Bend seller farm**: get every westside homeowner into the CRM, fully enriched
(mailing + property address, absentee, tenure, equity, property facts, contact info), tagged by
neighborhood/subdivision, scored for seller-propensity, and organized into working smart lists +
automation — while keeping the existing buyer / expired / FSBO / realtor / client segments clean
and de-Frankensteining the book.

## Current state (audited 2026-07-04)
- **Book:** 18,227 contacts, from 19 legacy imports (the Frankenstein).
- **Stages:** Nurture · Engaged · Active Client · Pending · Closed · Past Client · Sphere · Trash.
- **Tag taxonomy (live):** `segment:*` (seller/buyer/expired/fsbo/out-of-area/vendor) · `owner:absentee|occupied`
  (9,964 — absentee already tagged) · `location:local|out-of-area|out-of-state` · `seller:*` lifecycle
  (hot/in-conversation/listing-intent/long-nurture/nurture/expired-untouched) · `audience:buyer|seller`
  (FB) · `realtor:local|migration` · `compliance:hard-stop|dnc-registry|deceased` + `contact:do-not-*`
  + `tcpa:litigator` · `exclude:*-automation|fb-cas` (suppression) · `source:*`.
- **Smart lists:** 12 canonical `crm_saved_views` (Sellers, Buyers, Expired, FSBO, Out-of-Area,
  Local/Migration Realtors, Vendors, Active/Past Clients, Pending, Compliance Blocked) — all
  single-condition on a tag or stage.
- **Geo:** `neighborhood_slug` populated on 10,053 (mine); 28 canonical neighborhoods/resorts.
- **NOT captured yet:** neighborhood/subdivision as a filterable list dimension, **tenure**, **equity band**,
  a data-driven **seller-score**. Legacy junk tags remain (`Bounced`, `Unsubscribed`, `do_not_email`).
- **Westside source of truth:** exports **23 + 24** = **17,665 parcels**. In CRM already **9,868 (56%)**;
  **net-new 7,797 (44%)**.
- **Enrichment already bought:** westside farm 75% BatchData-matched; phone 89% / email 92%;
  deep demographics (equity/age) persisted on only 687 — recoverable from BatchData's dashboard lists.

## Target per-contact data model (westside homeowner)
| Group | Fields | Source | Where it lives |
|---|---|---|---|
| Property | site addr, **mailing addr**, beds/baths/sqft, year built, lot, subdivision, APN | assessor CSV (free) | `custom.*` |
| Ownership | **absentee** (Owner-Occupied N), **tenure** (today−purchase), purchase price, owner-type (person/trust/LLC) | assessor + derived | tags + `custom.*` |
| Value | assessed/market value, **equity band**, appreciation | assessor + BatchData | tags + `custom.*` |
| Geo | neighborhood, subdivision, city, out-of-state | boundaries pipeline (mine) | `neighborhood_slug` col + tags |
| Person | phone, email, owner age, household, income band, life events | BatchData (mostly bought) | `emails/phones/custom.*` |
| Scoring | **seller-score** hot/warm/cold | derived | tag |

## Tag taxonomy v2 (extend the live system, don't replace it)
Keep everything live. ADD a controlled, **one-value-per-contact** set (no multi-tag pollution):
```
neighborhood:<slug>      subdivision:<slug>      (canonical, from the resolver)
tenure:0-2 … tenure:25plus                       (from purchase date)
equity:low|medium|high|very-high                 (from BatchData / value − basis)
seller-score:hot|warm|cold                        (derived — see §Score)
farm:westside                                     (the master westside membership)
owner:absentee|occupied  (already live)  ·  location:out-of-state (already live)
```
Neighborhood/subdivision **also** stay as the indexed `neighborhood_slug` column so smart lists can
compile via the AST engine (extend it with a `neighborhood` condition) — cleaner than tag-only.

## Smart-list architecture (`crm_saved_views`)
- **Keep** the 12 canonical.
- **Add master:** `Westside Homeowners` (`farm:westside`).
- **Add neighborhood farms:** one per neighborhood (`neighborhood_slug = bend-awbrey-butte`, …) — 28.
- **Add priority lists (multi-condition AST):**
  - `Absentee Owners` = `owner:absentee`
  - `Hot Sellers` = `seller-score:hot`
  - `Move-Up Candidates` = `equity:high|very-high` AND `tenure:13plus` AND `owner:occupied`
  - `Tired Landlords` = `owner:absentee` AND `location:out-of-state`
- **Every list excludes** `compliance:hard-stop` (the AST supports NOT groups — bake it into the
  compiler default for outbound-facing lists).

## The build — all direct against Supabase, draft-first, reversible
0. **Master load:** load exports 23+24 → `westside_parcels` table (APN key). Absentee = Owner-Occupied N.
1. **Clean:** dedup `crm_people`; retire legacy junk tags (`Bounced`→bounce state, `Unsubscribed`→
   `contact:do-not-email`, `do_not_*`→`contact:do-not-*`); collapse duplicate compliance tags.
2. **Reconcile:** match parcels ↔ contacts (address-exact, then Hoffman-safe name) → matched / net-new.
3. **Enrich (matched + net-new):** attach property + mailing + absentee + tenure + geo (free);
   re-map the BatchData results you already bought; skip-trace only the true net-new (smoke-test 25 ≈ $1 first).
4. **Tag:** apply the v2 controlled tags + `neighborhood_slug`.
5. **Net-new insert:** create the 7,797 as `crm_people` rows (stage Nurture, `farm:westside`, full enrichment).
6. **Lists + automation:** build the smart lists; wire nurture (email/SMS) + Meta audiences, all with
   `exclude:*` + `compliance:hard-stop` suppression.
7. **Maintain:** quarterly assessor re-pull → refresh `westside_parcels` → re-enrich deltas;
   new leads auto-enrich on intake (geocode-on-intake already exists).

## Seller-propensity score
`seller-score = hot` when **tenure ≥ 10y AND equity ≥ high AND (absentee OR out-of-state OR age ≥ 60 OR a life event)**;
`warm` on any two; `cold` otherwise. This turns 17,665 names into a ranked "list these owners first."

## Guardrails (carried throughout)
Hoffman-safe matching (unique parcel only) · empty-only enrichment (never clobber Matt-authored data) ·
backup before every mutation · draft-first (review each bulk write) · smoke-test before any paid spend ·
compliance:hard-stop excluded from every outbound list; A2P/TCPA respected on SMS/call.

## Open decisions for Matt
1. **Net-new (7,797):** create them as contacts now (true "all westside in"), or enrich-existing-only first?
2. **Deep enrichment:** re-pull your BatchData dashboard lists (free) to recover equity/age, then skip-trace
   only net-new — OK to spend on that net-new slice (I smoke-test $1 first)?
3. **Geo lists:** neighborhood farms via the `neighborhood_slug` column (extend the AST engine) — confirm.
