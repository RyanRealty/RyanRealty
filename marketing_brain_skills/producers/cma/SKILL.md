---
name: cma
description: >
  Builds a branded multi-page Comparative Market Analysis (CMA) for a specific
  property.  subject details, improvements, comp grid + table, one-page flyers
  per comp, location map, and pricing strategy.  signed by the broker handling
  the listing. Triggered by `content:cma` action rows or direct invocation
  ("create a CMA for 21042 Robin Ave"). Every finalized CMA is recorded in
  `public.cmas` and the HTML lives at `public/cmas/<slug>/cma.html`.
action_types:
  - content:cma
output_type: document
target_platforms: ["email"]
asset_destination: public/cmas/<slug>/ + Gmail-draft delivery (Resend fallback)
auto_inputs: ["comparable listings from Spark", "broker resolved from public.brokers"]
required_inputs: ["mls_id OR address"]
optional_inputs: ["comp_count", "methodology_override"]
estimated_runtime_min: 15
cost_usd_estimate: $1-$3 per CMA (Anthropic + comp pulls + Mapbox)
thumbnail_uri: public/cmas/cma-21042-robin/cma.html
example_outputs: []
    label: "CMA exemplar"
    surface: "email"
---

# CMA Producer

**Scope:** Per-property Comparative Market Analysis as a 15-page branded HTML deliverable (print-ready as PDF). Subdivision-first comp set, full property flyers per comp, branded location map, and a pricing range with recommended list price. Signed by the broker handling the listing (resolved from `public.brokers`).

**Status:** Canonical
**Locked:** 2026-05-14
**Exemplar outputs (two.  use the one that matches your situation):**

- `public/cmas/cma-19496-tumalo-reservoir/cma.html` + `/api/cma/cma-19496-tumalo-reservoir/pdf`.  **canonical exemplar for the current rules** (finalized 2026-05-17). Rural acreage subject, 5 closed comps via distance-based RPC, 13 pages with the N+1 / N+2 / Final pricing+rationale+disclosure split, layout-discipline-compliant (zero footer/header bleed), 10.66 MB PDF. Use this as the structural reference for any new CMA.
- `public/cmas/cma-21042-robin/cma.html` + `/api/cma/cma-21042-robin/pdf`.  earlier reference (Whispering Pines subdivision, 8 closed comps via SubdivisionName filter). Predates the layout discipline rules + the empirical image budget.  useful for sub-division-based comp selection but the page-fit and image-tier work was solved later in the Tumalo build.

Draft lives at `public/drafts/cma-<slug>/cma.html` during creation; moves to `public/cmas/<slug>/cma.html` on Matt's ship-it.

**Primary deliverable format:** PDF, generated server-side at `/api/cma/[slug]/pdf` via puppeteer-core + @sparticuz/chromium-min. The PDF uses the same Chrome engine that displays the HTML preview, so formatting is identical.  no print-CSS surprises. The HTML is the source-of-truth, but anything that goes to a client (or to a broker who's signing it) is delivered as PDF. Append `?download=1` to force a download. Append `?info=1` to get a JSON metadata response (size in bytes, finalized-flag) without the binary body.

**HARD CAP.  25 MB attachment limit (non-negotiable):** Every CMA PDF must come in under **25 MB** so it can be attached to a Gmail/Outlook email without compression or external links. Both `/api/cma/[slug]/pdf` and `/api/cma/[slug]/email` enforce this and reject with HTTP 413 if the render exceeds the cap. The cap is set by `MAX_PDF_BYTES = 25 * 1024 * 1024` in `app/api/cma/[slug]/pdf/route.ts`.

Puppeteer's PDF backend re-encodes every image during render; the empirical bloat ratio is ~5× the raw image bytes per the Tumalo CMA (5.6 MB raw → 28 MB PDF). To stay under 25 MB the raw image budget is roughly **~5 MB total**, which sets the default tiers:

| Use | Spark CDN variant | Displayed size | Notes |
|---|---|---|---|
| Cover hero | `800×600` | full-bleed at 100% page width | drop to `640×480` for >8 comps |
| Per-flyer hero | `800×600` | full-bleed at 100% page width | same |
| Comp-grid thumbnails (5-up) | `320×240` | 58 px tall × ~140 px wide | 640×480 is ~7× oversize for this display |
| Per-flyer photo grid (3-up) | `320×240` | 91 px tall × ~220 px wide | same |
| Subject gallery grid | `320×240` | 91 px tall | same |
| Map | Google Static API at 640×640 | full-width body block | inlined as data URI by the PDF render |

Spark CDN supports `320×240`, `640×480`, `800×600`, `1024×768`, `1280×960`, `1600×1200`. If a build still comes back over 25 MB, **drop one tier across all gallery uses first** (320 is the floor.  any smaller looks visibly degraded in PDF), then drop heroes one tier. Target landing: 5-14 MB.

**Repository lookup:** Every finalized CMA appears at `/admin/cmas`.  the canonical place to find old CMAs, filter by broker or client, and re-open the PDF or HTML for any row.

---

## 0. Execution architecture: deterministic + judgment hybrid (LOCKED 2026-07-11, enforced in code)

**Every CMA build runs through `lib/cma/build.ts` (`buildCma`). This is the only path. The retired LLM producer-runtime and the retired `scripts/build_cma_wrapper.py` are both dead (G47). The pipeline is a hybrid, and the process is enforced by code, not by this document:**

1. **Deterministic data + math (§0-safe).** Subject resolution, tiered comp selection, market context from the cache tables, time/size adjustments, and the three-method pricing reconciliation are pure code (`lib/cma/{subject,comps,market,pricing}.ts`). No LLM touches a number.
2. **LLM comparability judgment (`lib/cma/judge.ts`).** One Claude pass (Sonnet, ~$0.02 to $0.15 on `ANTHROPIC_API_KEY`, fail-open) reviews the FULL feature set of subject + every candidate comp: beds/baths, year built, lot, garage, view, tax, list-vs-sold, days-to-offer, DOM, and public-remarks condition/renovation language. It classifies each comp `strong` / `weak` / `exclude` with a per-comp reason plus a client-grade comparability narrative. This is the judgment layer the deterministic math cannot provide.
3. **Verdicts change the math.** `exclude` comps are dropped before any pricing (never below the comp floor). `weak` comps carry half weight in the Method 3 reconciliation. The narrative renders with the pricing rationale. Verdicts, cost, and model are recorded in `build_summary.judgment` and `citations.comp_judgment`.
4. **Adversarial accuracy audit (`lib/cma/audit.ts`). Every CMA is attacked before release (Matt directive 2026-07-11).** A second, independent LLM pass that shares no prompt with the builder receives the finished analysis (subject, priced comps with adjustments/weights/tiers, exclusions + reasons, the three methods, the narrative) and tries to REFUTE it: non-comparable comps that survived, unsupported exclusions, adjustment/weight inconsistencies, a recommendation the comps do not support (especially at or above the subject's failed list price), narrative claims that do not trace to data, market-verdict mismatches. Verdict `pass` / `review` / `fail` with per-finding severity + evidence, recorded in `build_summary.audit` and `citations.adversarial_audit`, and stamped into the rendered pricing notes. Anything but a clean `pass`, or the audit being unavailable, forces `needs_review`.
4.5. **Authoritative site data (`lib/cma/county.ts`, `resolveCmaSiteData`): zoning, water, septic — GIS-authoritative, never LLM-inferred (§0, restored 2026-07-14).** Every build resolves, from the source of record, the parcel's **zoning** (Deschutes County GIS LandFD zoning layer `ZONE` field), the **nearest domestic well** (Oregon OWRD well-logs, ~250m envelope, presented as area context to confirm against the seller's own log), and **septic** status (Deschutes DIAL onsite-wastewater permits), plus wildfire-hazard and the municipal-vs-private determination. Pure `fetch` against public GIS.  no model touches these facts (CLAUDE.md §0 forbids LLM-inferring zoning/well). Fail-open: any source that errors leaves its field unknown with a note. Recorded in `build_summary.site` + `citations.site`, rendered as the "Site & utilities (county / state records)" block on the subject page, and fed to the adversarial auditor so it can attack a buildability claim on a resource zone. **The judge + audit reason OVER this verified data; they never generate it.**
5. **Accuracy contract (`lib/cma/contract.ts`): the enforcement.** Every build evaluates a mechanical checklist recorded in `build_summary.accuracy_contract`:
   - **Hard checks fail the build** (no clean draft persists): comp floor, per-comp data sanity (price, sqft, close date within 24 months), all three methods computed, conservative ≤ recommended ≤ high-end, dispersion CV computed.
   - **Review checks force `needs_review`** (build proceeds, broker must confirm before a client sees it): LLM judgment ran, per-comp verdict coverage, comp $/sqft dispersion within 18% CV, adversarial audit ran, adversarial audit verdict clean, market context present, **site data resolved for non-municipal parcels (`site-data-resolved`), and restrictive/resource zoning entitlement flag (`restrictive-zoning-entitlement`.  EFU/EFUTRB/F1/F2/SM force a buildability review)**.
   - **Info checks (recorded, never gate):** method convergence (a >5% spread already lowers the displayed confidence tier. The confidence field IS the signal, so it does not raise the flag).
   - **Audit verdict is deterministic and DISCRIMINATING (`computeAuditVerdict`, calibrated v3 2026-07-12).** The LLM reports categorized findings; code decides. `fail` = a critical data-integrity / comp-selection / narrative finding. `review` = a major data-integrity (a wrong FACT), a critical market-verdict, or a CLUSTER of comp doubt (2+ comp-selection majors). Everything else is **advisory**, recorded and shown, but not gated: price-opinion disagreements (broker judgment), a lone comp-selection major (the auditor reflex, it always names one comp it would tweak; self-repair already dropped the worst), a lone narrative rewording, market/other majors, all minors. An adversarial reviewer emits a comp-major + a narrative-major on ~100% of analyses, so gating on a single one flags everything (v1/v2 fired on 83% of a real batch).
6. **Dispersion guard backstop.** When the judge is unavailable (no key/credits), pricing falls back to the full comp set and the CV guard + the contract's `llm-judgment-ran` check force `needs_review`. An unvetted CMA can never present as vetted.
7. **Draft-first, always.** Output lands as `status='draft'` in `public.cmas`, reviewed at `/admin/cmas` (flagged rows show a "Needs review" badge). Nothing is ever auto-sent.

**Rule for agents:** do not bypass `buildCma`, do not hand-compute pricing, and do not weaken a contract check without Matt's explicit sign-off recorded in the commit message. If a new accuracy failure mode is found, the fix is a new contract check (gates not prose).

---

## 1. Scope

### In scope
- Single-property Comparative Market Analysis.  for a specific subject address
- 15-page HTML deliverable, print-ready at 8.5×11" letter, exported as PDF via browser ⌘P
- Subdivision-first comp set (last 24 months), with broader same-zip fallback if subdivision is sparse
- One-page flyer per comp (hero photo + 6-photo grid + MLS public_remarks + key features)
- Branded location map via `/api/maps/cma-<slug>` showing subject + all comps with numbered pins matching flyer order
- Pricing range with **two methods** (per-sqft tier + un-renovated baseline + improvement value-add) that converge on a recommended list price
- Improvements ledger when seller has invested capital between MLS listings (per the seller's documented spend)
- Per-broker branding: signature block pulls broker headshot, name, license #, email, phone from `public.brokers`
- Storage in `public.cmas` table with `cma_comps` linking the comps used

### Out of scope
- Formal appraisal (this is an estimate, not a USPAP appraisal).  disclaim explicitly on the last page
- Listing agreement, seller net sheet, transaction coordination.  those are separate producers
- Marketing flyer for the subject after it's listed.  that's `flyer-design` for `content:just_listed_flyer` etc.
- Email delivery of the finalized PDF.  on finalization the canonical delivery is a **Gmail DRAFT** created via `POST /api/cma/[slug]/gmail-draft` (addressed to the lead, CMA PDF attached, BCC `ryan.realty@followupboss.me` so FUB logs it the moment it's sent). The signing broker reviews the draft in Gmail and sends it personally.  keeps a human on the pricing numbers (CLAUDE.md §0) and lands the email from a real mailbox instead of a no-reply. The Resend path (`ops-email-send` / `/api/cma/[slug]/email`) is the fallback when the `gmail.modify` DWD scope is unavailable. (This also satisfies the old "wire delivery to FUB" item.  the BCC logs the sent email on the lead's record.)

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `content:cma` | `subject_address` OR `subject_listing_key`; `client_name`; optional `client_email`, `broker_email`, `client_notes`, `seller_improvements` | If `broker_email` omitted, defaults to the listing's `ListAgentEmail` (resolves to `public.brokers`); if no match, default to `matt@ryan-realty.com` |

### Payload schema

```typescript
interface CMAPayload {
  // One of these is required:
  subject_address?: string         // '21042 Robin Ave, Bend, OR 97703'
  subject_listing_key?: string     // '20220425183424852391000000' (Spark)

  // Client (recipient of the CMA):
  client_name: string              // 'Kelly Hansen'
  client_email?: string            // for delivery; optional at create time

  // Broker who signs the CMA (resolves to public.brokers):
  broker_email?: string            // 'paul@ryan-realty.com'.  if omitted,
                                   // resolves to ListAgentEmail of the subject;
                                   // if subject not in our listings, defaults
                                   // to matt@ryan-realty.com
  broker_slug?: string             // alternative to broker_email

  // Seller-reported improvements (free text or structured):
  seller_improvements?: string     // pasted email/sms from seller listing
                                   // what they've done since last MLS listing
  seller_improvements_total?: number  // total invested capital (USD)

  // Structured seller-reported details from the LP "About your home" section
  // (locked 2026-06-13). Optional. When present, USE THEM in the recipe:
  //  - bedrooms / bathrooms      → fill the subject profile when DIAL lacks them
  //                                (label "seller-reported, confirm at listing")
  //  - roof_age / furnace_age /  → effective-age read + Method 2 value-add
  //    ac_age                      (Remodeling Magazine recovery rates, Step 9)
  //  - condition                 → governs the High-End tier (Step 9 high-end check)
  home_details?: {
    bedrooms?: string
    bathrooms?: string
    roof_age?: string
    furnace_age?: string
    ac_age?: string
    condition?: string
  }

  // Optional notes from Matt:
  client_notes?: string
}
```

**Using `home_details` + `seller_improvements` (locked 2026-06-13, Matt directive).** The seller LP form has an optional "About your home" section. When the action row's `payload.home_details` or `payload.seller_improvements` is populated, the producer MUST use it:
- **Beds/baths:** if DIAL/MLS does not expose the subject's bedroom/bathroom count, use the seller-reported values from `home_details` and label them "seller-reported, confirm at listing". Do not leave the subject as unknown when the seller told us.
- **System ages (roof / furnace / AC):** factor into the subject's effective-age read and the Method 2 value-add. A recent roof or HVAC is documented capital to credit; aging systems temper the High End.
- **Condition:** the seller-reported condition is a direct input to the Step 9 High-End check. "Excellent / renovated" supports the ceiling. "Needs work" pulls the recommended and high tiers in. State the basis ("seller-reported condition") in the pricing rationale.
- Still verify everything verifiable against records (§0). Seller-reported facts are an input, not a substitute for the authoritative record where one exists. Label seller-reported values as such.

---

## 3. Brief payload schema

```typescript
interface CMAActionRow {
  id: string
  action_type: 'content:cma'
  target: string                   // 'address:21042-robin-ave-bend-or' or 'listing:<key>'
  assigned_producer: 'marketing_brain_skills/producers/cma'
  payload: CMAPayload
  data_evidence: {
    request_source?: 'matt-direct' | 'broker-paul' | 'broker-rebecca' | 'lead-form'
    client_relationship?: string   // 'existing-client' | 'referral' | 'cold-lead'
  }
  generation_reason: string        // 'Kelly Hansen requested CMA via SMS to Matt.  wants to list within 60 days'
  status: 'pending'
}
```

---

## 4. The recipe

**Step 1.  Read the action row + transition to in_production**

```sql
SELECT * FROM marketing_brain_actions WHERE id = '<id>' AND status = 'pending';
-- if found:
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<id>';
```

Compute `slug` from the subject address (e.g. `cma-21042-robin`).  kebab-case, ≤40 chars, prefix `cma-`.

**CANONICAL SLUG + SINGLE PATH (locked 2026-06-13, Matt directive, enforced by G47 `scripts/check-cma-routing.mjs`).** Every CMA routes through THIS skill, and a property gets exactly ONE slug. Rules:
- **The canonical slug IS the action row's `target` slug** (`target = 'cma:<slug>'`). Use it verbatim. Do NOT re-derive a second slug from the address. That is how a duplicate was created (`cma-62285-deer` vs `cma-62285-deer-usa`). If you are building from an address with no action row, create the action row first (via `marketing_brain_skills/produce/`), then use its target slug.
- **Before building, check for an existing CMA for this property:** look in `public.cmas` (by address), `public/cmas/<slug>/`, and `public/drafts/<slug>/`. If one exists, UPDATE it in place at its existing slug. Never create a parallel slug for the same property.
- One property = one slug = one CMA. The gate fails the build if two committed slugs normalize to the same address (including the `-usa`/country-suffix alias case).
- CMAs are produced ONLY by this skill, never by `scripts/build_cma_wrapper.py` (retired stub) or any copy-and-relabel path.

**Client-doc hygiene (locked 2026-06-13):** never expose internal revision history or prior-draft numbers in the client-facing CMA (no "v1 said $975k", no "the earlier estimate"). Present the current valuation confidently. Internal change-tracking lives in `out/<slug>/build-spec*.json`, not the deliverable. And never INFER a water source. State well type (community vs private) and septic from the authoritative record or the seller, never from an area guess (Step 3.6).

**Step 2.  Load mandatory references**

- `CLAUDE.md` §0 (Data Accuracy) and §0.5 (Draft-First, Commit-Last)
- `design_system/ryan-realty/SKILL.md`.  brand register
- `marketing_brain_skills/brand-voice/voice_guidelines.md`.  voice enforcement (banned words apply to the CMA narrative)
- This file (you are here)

**Step 3.  Resolve subject from Supabase, ALWAYS the MOST RECENT listing of the property**

**HARD RULE (Matt directive 2026-07-10): a CMA must use the most recent listing's photos AND information for the subject.** A property is usually in `listings` MORE THAN ONCE (every list attempt is its own row, with its own MLS number, photos, specs, and sometimes a re-split/corrected zip). You must pick the newest one. Never trust `ModificationTimestamp` for "newest". A bulk MLS re-sync stamps every relisting with the same near-identical last-modified time, so ordering by it once surfaced a 1998 listing (1 photo, stale 97701 zip) as the subject over the true 2021 relisting (59 photos, correct 97703 zip) on 1204 NW Iowa. Rank by real listing-activity date instead: currently-on-market first, then the latest of `OnMarketDate` / `ListDate` / `CloseDate` / `status_change_timestamp` / `pending_timestamp`, then the richest `photos_count`.

The in-house builder does this for you: `resolveCmaSubject` (`lib/cma/subject.ts`) gathers every relisting of the property (no zip filter, zips drift across relistings) and calls `pickMostRecentListing`. Locked by `lib/cma/subject.test.ts`. If you resolve a subject in raw SQL for any reason, replicate the rule:

```sql
-- if subject_listing_key provided: resolve that row, then gather ALL relistings
-- of the SAME property (street number + street name + city, NO zip filter) and
-- pick the most recent. An old key must still upgrade to the newest listing.

-- by address parts:
SET statement_timeout = '120s';
SELECT * FROM listings
WHERE "StreetNumber" = '<num>'
  AND "StreetName" ILIKE '<street>%'      -- Central Oregon MLS stores names WITHOUT the directional
  AND "City" ILIKE '<city>'               -- do NOT filter PostalCode: relistings carry different zips
ORDER BY GREATEST(
  COALESCE("OnMarketDate", 'epoch'), COALESCE("ListDate", 'epoch'),
  COALESCE("CloseDate", 'epoch'), COALESCE(status_change_timestamp, 'epoch')
) DESC
LIMIT 15;   -- then prefer an Active/Pending/Coming-Soon row, else this newest one
```

Capture from the CHOSEN (newest) row: `SubdivisionName`, `BedroomsTotal`, `BathroomsTotal`, `TotalLivingAreaSqFt`, `year_built`, `lot_size_acres`, `garage_spaces`, `Latitude`, `Longitude`, `PhotoURL` (the newest listing's photo), `PostalCode` (the newest listing's zip), `public_remarks`. If subject isn't in the MLS at all (never listed), Matt provides the values directly in `payload.client_notes`. (Note: the listings agent fields are `list_agent_name` / `list_agent_email`, NOT `ListAgentEmail`.  the older field name in this skill was wrong.)

**Step 3.5.  Verify zoning + land-use entitlements from the AUTHORITATIVE county record (never the MLS, never an inference)**

Zoning is a top-three value driver for land and the MLS zoning field is routinely blank or wrong. Pull it from the authoritative county source before stating any zoning on a CMA (CLAUDE.md §GIS-authoritative).

- **Deschutes County:** Deschutes County DIAL (`dial.deschutes.org`) by tax account number.  `/Real/Index/<account>` confirms address/acreage/owner, and `/Real/DevelopmentSummary/<account>` gives the zoning. Capture the exact zoning code(s) INCLUDING combining/overlay zones, the map/taxlot, and owner of record.
- Codes you will see: base zones EFU / **EFUTRB** (Exclusive Farm Use, Tumalo-Redmond-Bend subzone), MUA10, RR10, UAR10, F1/F2; overlays **LM** (Landscape Management), **WA** (Wildlife Area), FP (Flood Plain), SMIA, AS (Airport Safety).
- Record each in citations.json with the source URL + fetched date.

**Buildability is NOT automatic on EFU or restrictive zones.** A dwelling on EFU land requires a qualifying entitlement (farm dwelling, lot-of-record dwelling, or an approved Conditional Use Permit). If a CMA's value rests on buildability, verify the CURRENT status of any CUP / partition / dwelling approval with the County.  CUPs lapse if not acted on (often 2-4 years). Never state "buildable" on an EFU parcel without a verified, current entitlement.  label it conditional and surface to Matt.

(Matt directive 2026-06-04: the first 18705 Tumalo Reservoir draft mislabeled an EFU/LM/WA parcel as "RR10" and called it freely buildable. This step exists so that never ships.)

**Step 3.6.  Resolve water + sewer (well / septic) from the authoritative record (MANDATORY for any property not on municipal water/sewer.  locked 2026-06-13, Matt directive)**

Every CMA states the property's water source and waste system, verified from records, never assumed. Rural and acreage homes in Central Oregon are almost always on a private well + onsite septic, and buyers and lenders ask. Resolve both and state them plainly:

- **Septic:** Deschutes County DIAL Permits (`dial.deschutes.org/Real/Permits/<account>`). Distinguish a **finaled installed system** (a finaled onsite-wastewater construction permit, e.g. `247-S#####`) from a **site evaluation / feasibility only** (soil test passed, nothing built.  buyer still installs ~$15-30k). State which.
- **Well:** Oregon OWRD well-log GIS (`https://arcgis.wrd.state.or.us/arcgis/rest/services/dynamic/wl_well_logs_qry_WGS84/MapServer/0/query`). Spatial-query an envelope around the subject lat/lng (and the taxlot polygon when available) for the on-parcel domestic well log.  capture well number, completion date, completed depth, first-water depth, static water level, use. If the subject's own log does not surface by coordinate/address (older wells are logged by TRS or owner and often do not geocode onto the parcel), state the area-confirmed context (neighboring domestic well logs with depths + dates) and flag the seller to provide the OWRD well log + a recent flow test for the listing packet. Never assert a specific well you have not located.
- **Adjustment:** well + septic are typically NEUTRAL between an improved subject and improved acreage comps (all share well + septic), so there is no relative $ adjustment.  but STATE them as confirmed facts because a finaled installed septic removes buyer uncertainty. If the subject lacks one (septic only site-evaluated, or no well) where comps have it, that IS a downward adjustment.  apply it.
- Record both in citations.json with source URL + fetched date. Municipal-water/sewer properties: state "city water / city sewer" and skip the lookup.

**Step 4.  Pull subdivision comps**

Default filter (matches the 21042 Robin exemplar):
- `SubdivisionName = '<subject subdivision>'`
- `PropertyType = 'A'` (SFR)
- `StandardStatus = 'Closed'`
- `CloseDate >= now() - interval '24 months'`
- `TotalLivingAreaSqFt BETWEEN <subject_sqft × 0.77> AND <subject_sqft × 1.23>` (±25%)
- `lot_size_acres BETWEEN <subject_acres − 1.0> AND <subject_acres + 1.5>` (geography-dependent)

Target 6-10 comps. If subdivision returns fewer than 6, expand to same-zip + same property class. Exclude obvious outliers (off-market arms-length sales, $/sqft >2 std deviations from cluster).

Also pull every comp's `pending_timestamp`, `OnMarketDate`, `CloseDate`, `DaysOnMarket`, `days_to_pending`. The CMA reports **Days to Offer** (active days = `pending_timestamp - OnMarketDate`) as the primary recency signal, with the Spark-reported DOM (which includes time under contract) as a secondary number. See §10.  this is a known Oregon Data Share quirk.

**Step 4.5.  Pull the subject's market-conditions context (makes the valuation time-aware)**

A comp that closed 11 months ago in a moving market is not the same data point as one that closed last month. Treating them identically is the single biggest way a CMA goes stale. Before pricing, pull the subject geo's verified market context. Use the cache, never aggregate raw `listings` (CLAUDE.md §Supabase): `market_stats_cache` (6-hour freshness) for the tightest matching geo, and `market_pulse_live` (10-min) for the city/region.

```sql
-- Resolve subject geo tightest-first: subdivision/neighborhood slug, then city.
SELECT geo_type, geo_slug, median_price_per_sqft_closed, yoy_median_price_delta_pct,
       median_dom, avg_sale_to_list_ratio, months_of_supply,
       pct_sold_over_asking, pct_sold_under_asking, methodology_version, computed_at
FROM market_stats_cache
WHERE geo_slug = '<subject geo slug>'   -- neighborhood e.g. 'bend-awbrey-butte', else city 'bend'
ORDER BY computed_at DESC
LIMIT 1;
```

Capture and trace (citations.json) for the subject's geo:
- `median_price_per_sqft_closed`.  the market $/sqft rate, the anchor for Step 9 Method 3
- `yoy_median_price_delta_pct`.  the time-trend rate that drives the per-comp market-conditions adjustment (Step 9)
- `median_dom` + days-to-offer, `avg_sale_to_list_ratio`, `months_of_supply`, `pct_sold_over_asking` / `pct_sold_under_asking`.  the Market-context page

This context drives three things: (1) the per-comp market-conditions (time) adjustment in Step 9, (2) the new Market-context page in the layout, and (3) the defensibility of the High-End tier.  a buyer's market (MoS ≥ 6, homes closing under asking) does not support an aggressive High End, and the CMA must say so out loud. If no cache row exists at any geo level (rare), note it explicitly and price on physically-adjusted comps alone with no time adjustment.  never fabricate a trend rate (CLAUDE.md §0).

**Step 5.  Pull photo arrays for subject + comps**

For each `ListingKey`, call `GET /api/listings/<key>/photos` (this is the Spark `_expand=Photos` endpoint added 2026-05-14). Cache the primary URL + 5 supplementary URLs per comp. If `PhotoURL` is null in Supabase but the listing has photos via this endpoint, use what Spark returns.

**If the subject has no MLS photos (never listed) or only stale photos: use an AERIAL VIEW of the property, never a blank or branded placeholder panel (locked 2026-06-13, Matt directive).** Generate a Google Static Maps satellite/hybrid image centered on the subject lat/lng with an `S` marker (`maptype=satellite` or `hybrid`, zoom 15-16, key `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) and save it to the draft `assets/` folder. Use it as the cover hero AND the subject-flyer hero, captioned "Aerial view · subject parcel". Note on the flyer that no MLS photos exist and pro photography is recommended before list. The old navy "no photo" panel is retired.

**Photo-card quality (locked 2026-06-13, Matt directive): every card that shows a photo must show it well.** Comp-summary cards display the photo at a usable height (~90-100 px, not a 58 px sliver), `object-fit: cover`. Pull thumbnails at the next Spark CDN tier up from the floor (`640x480`, not `320x240`) so cards and flyer photo grids render crisp.  the floor tier looks degraded in PDF. Heroes stay `800x600`. Re-check the 25 MB PDF cap after bumping tiers and drop back only if over.

**Step 6.  Resolve broker from `public.brokers`**

```sql
-- Preferred path:
SELECT id, slug, display_name, title, license_number, email, phone, photo_url
FROM brokers
WHERE email = '<broker_email>' OR slug = '<broker_slug>';

-- Fallback to subject's ListAgentEmail:
SELECT... FROM brokers WHERE email = (SELECT "ListAgentEmail" FROM listings WHERE "ListingKey" = '<key>');

-- Final fallback:
SELECT... FROM brokers WHERE slug = 'matt-ryan';
```

The broker row supplies the signature block (page 15): display_name, title, license_number, email, phone. The headshot loads from `design_system/ryan-realty/assets/team/<slug>.png` (transparent PNG; the canonical version per CLAUDE.md §"Broker headshots"). Never re-frame the transparent portrait.  no circle crop, no border, no drop shadow.

**Step 7.  Build the CMA HTML**

Copy assets to `public/drafts/cma-<slug>/assets/`:
- `logo-blue.png` (from `design_system/ryan-realty/assets/brand/`)
- `Amboqia_Boriango.otf` (display font)
- `<broker_slug>.png` (transparent headshot from `design_system/ryan-realty/assets/team/`)

The canonical layout (clone from the 21042 Robin exemplar at `public/drafts/cma-21042-robin/cma.html`):

| Page | Content (one purpose per page) |
|------|---------|
| 1 | **Cover**.  subject hero photo · value range · key stats · "Presented by" line |
| 2 | **Subject narrative**.  at-a-glance · site & structure · why this matters · listing history |
| 3 | **Subject flyer**.  hero + 6-photo grid + current/historical MLS remarks + features (off-market badge if not currently Active) |
| 4 | **Comp location map**.  Google Maps Static via `/api/maps/cma-<slug>` · numbered legend · pin order matches comp flyer order |
| 5 | **Comp summary**.  subject row at top + 4×2 thumbnail grid + full data table + per-comp adjustment grid (market-conditions / size / beds-baths / lot-garage-condition → adjusted $) |
| 6 → N | **Comp flyers**.  one full page per comp (hero + 6-photo grid + public_remarks + features). N scales with comp count (6 comps → flyers 6-11; 8 comps → flyers 6-13). |
| N+1 | **Market context**.  the subject geo's verified conditions from `market_stats_cache` / `market_pulse_live`: months of supply + seller/balanced/buyer verdict, median days to offer, sale-to-list ratio, YoY $/sqft trend, % sold over/under asking.  with the source trace. Frames why the recommended list sits where it does. |
| N+2 | **Pricing strategy**.  Method 1 ($/sqft tier) + Method 2 (baseline + value-add) + Method 3 (time-and-physically-adjusted comp reconciliation) + converged range (3 tiers: Conservative / Recommended / High End) + the confidence statement |
| N+3 | **Why this list price**.  outlier explanations (if any high or low comps need context) + market-conditions rationale + listing-history rationale + verification trace (data sources) |
| Final | **Disclosure + broker signature**.  disclosure paragraphs + Amboqia-script broker signature + transparent headshot + license # |

Page numbers in the comp flyer area scale with the number of comps. 6 comps → 13 pages, 8 comps → 15 pages, etc. Always renumber footers. NEVER hardcode a `Page X of 15`.  count actual pages.

**Step 7a.  Layout discipline (HARD RULES.  non-negotiable)**

Every page is purposeful and self-contained. Never split a single conceptual section across page breaks. Never let content bleed into another page's header or footer band. These rules outrank "include more detail".  if a section is too long, split or trim, never spill.

1. **One section per page.** A page = one purpose with a single H2 / SUBJECT PROPERTY / WHERE THE COMPS SIT subhead. If the section's narrative + tables + visuals can't fit one page, split it into two purposeful pages with distinct subheads (e.g., "Pricing strategy" → page A with the methods + range; page B with outlier explanation + verification trace). Never overflow.

2. **Footer + header are sacrosanct.** Body content lives in the inner box only. For 8.5×11" letter at 96 DPI = 1056 px tall × 816 px wide, the usable inner region is bounded by the page padding (top) and the rendered footer's top edge (bottom). The footer band typically sits at y ≈ 1025 relative to its containing `.page`. **The bleed-check authority is the rendered footer's top edge, not a hardcoded constant**.  page-layout styles drift across CMAs, so always read the actual footer position at QA time. No non-footer / non-header descendant's bounding-box bottom may exceed `footerTop − 4` relative to its containing `.page`.

3. **Width tolerance: zero.** Body content stays within the page padding box. Horizontal overflow gets cropped by `overflow: hidden` on the page container, which silently truncates and looks broken in PDF. Keep all column widths summed under the inner-box width (816 − 64 padding = ~752 px usable).

4. **What gets trimmed first if a section is too long:** narrative adjectives and editorial prose. The DATA must stay (numbers, dates, addresses, $/sqft, lot sizes, listing-history rows, citations). Cut "stunning view" → "view"; cut "well-executed renovation" → "renovated"; never cut a comp's close price or date.

5. **Never use orphan / widow content.** A heading at the bottom of a page with no body under it = the page break is wrong. Move the heading to the next page OR pull the first paragraph up onto the current page. Same for a single-line caption stranded on a fresh page.  pull the visual up with it.

6. **The verification trace lives on the "Why this list price" page**, not stapled to the bottom of the pricing-strategy page. If both narrative + trace won't fit one page, that's exactly when to use the N+2 split.

**Mandatory QA: page-fit check (must pass before declaring draft ready)**

After build, run this in a headless browser load of the HTML:

```javascript
// Run inside a headless browser load (puppeteer / playwright) of the rendered CMA HTML.
// Reads each page's actual footer position rather than trusting a hardcoded ceiling,
// and skips footer/header descendants so we don't flag the footer against itself.
const pages = document.querySelectorAll('.page')
const bleed = []
pages.forEach((p, i) => {
  const pageTop = p.getBoundingClientRect().top
  const footer = p.querySelector('.pg-footer, footer')
  // Fall back to 1056 - 31 (typical footer band height) if the page somehow has no footer.
  const footerTop = footer ? footer.getBoundingClientRect().top - pageTop : 1025
  p.querySelectorAll('*').forEach((el) => {
    // Don't flag footers/headers (or their descendants) against themselves.
    if (el.tagName === 'FOOTER' || el.closest('.pg-footer, footer')) return
    if (el.tagName === 'HEADER' || el.closest('.pg-header, header')) return
    const r = el.getBoundingClientRect()
    const bottom = r.bottom - pageTop
    if (bottom > footerTop - 4) {
      bleed.push({
        page: i + 1,
        tag: el.tagName,
        text: (el.textContent || '').trim().slice(0, 60),
        overshoot: Math.round(bottom - (footerTop - 4)),
        footerTop: Math.round(footerTop),
      })
    }
  })
})
if (bleed.length > 0) throw new Error(`Page-fit bleed: ${JSON.stringify(bleed)}`)
```

If `bleed.length > 0`, the CMA is NOT ready. Either split the offending section across N+2 (per the layout table) or trim the narrative. Re-run until zero bleed. Only then surface to Matt.

Note: this check is **self-calibrating**.  it reads each page's actual footer position rather than assuming a fixed ceiling, so it works whether the per-CMA stylesheet uses 1056 px letter portrait, 1100 px legal stretch, or anything in between. The 4 px buffer below `footerTop` is the minimum gap between body content and the footer band; widen it to 8-12 px if you want stricter visual breathing room.

**Step 7b.  Land / acreage CMA additions (PropertyType D, required when subject is raw land or acreage)**

When the subject's `PropertyType = 'D'` (land), the standard SFR layout (Steps 7 and 9) applies with the following mandatory additions. These were locked 2026-06-04 based on the 18705 Tumalo Reservoir Road CMA build, the first full zoning-aware land CMA produced under this skill. Reference: `public/cmas/cma-18705-tumalo-reservoir/cma.html` (finalized 2026-06-06, 25 pages.  see Step 7c for the deeper learnings from the full rebuild).

**Addition 1: Zoning Analysis & Comp Weighting (two pages, placed immediately before the Pricing Strategy page)**

For land CMAs, zoning is the primary value driver. A comp in the wrong zone (even at the same acreage and price per acre) is misleading, not informative. Insert two dedicated pages:

*Page A: Per-comp zoning pros/cons table.* Columns:
- Parcel (address + acreage)
- Zone (from authoritative GIS, see Step 3.5, never from MLS)
- Dwelling pathway (by-right / conditional use / lot-of-record / none confirmed)
- Subdividable? (yes/no, with governing code reference)
- Irrigation / high-value farmland status
- Weight & why (PRIMARY / FLOOR ANCHOR / SIZE-TREND SUPPORT / CONTEXT ONLY / EXCLUDED)

Weighting logic:
- **PRIMARY weight:** comps in the identical base zone (e.g., EFUTRB matching an EFUTRB subject) and the same entitlement class. These are the only true matches. List all primary comps.
- **FLOOR ANCHOR:** a zone-matched comp with the worst comparable conditions (no water, no confirmed CUP, poor location). Sets the conservative low end. Always include if one exists.
- **SIZE-TREND SUPPORT:** zone-matched comps outside the primary size range (e.g., 65-80 ac supporting a 40-ac subject). Show how large-parcel compression anchors the low end and confirms the subject's tier is above that band.
- **CONTEXT ONLY:** zone-matched comps with a small-lot premium (e.g., 11-ac EFUTRB with replacement dwelling) that does not extrapolate to the subject's acreage. Show but do not use for sizing.
- **EXCLUDED:** comps in a different zone class (MUA-10, RR-10, TUR-5, UAR-10, residential). Do not apply a haircut and use them. Exclude them entirely. The reason: by-right dwelling + subdivision optionality is the core of the premium those zones command, and there is no defensible way to strip it out with a numerical adjustment. State the exclusion reason explicitly in the table.

*Page B: Weighting narrative.* Plain-language explanation of:
1. Why the matching base zone comps are the only true matches (entitlement class logic).
2. Why non-EFU / by-right / subdivisible comps are excluded rather than discounted (the optionality premium is not separable with paired-sales logic).
3. How irrigation and farming value interact with the subject's water-rights status (especially relevant if subject has no irrigation: explain the dual effect, discount vs. enabling condition for dwelling CUP pathway under DCC 18.16).
4. Any subdivision floor imposed by overlay zones (e.g., WA 40-acre minimum under DCC 18.88) and what it means for buyer optionality.
5. The explicit value conclusion: where the subject lands in the $/acre range, which comps anchor the low and high ends, and the recommended list price. This narrative ties directly to the Pricing Strategy page that follows.

**Addition 2: Supplemental Documentation exhibit appendix (two pages, placed after the Disclosure + Signature page)**

A professional exhibit list of every authoritative county record backing the CMA. Required for any land CMA where zoning, entitlement, or parcel boundary is a value driver (which is always). Each exhibit entry must include:
- Exhibit number (EX-1, EX-2, ...)
- Document name
- Source + authoritative URL + document/account ID
- Date pulled
- Key finding (verbatim quote where the fact is decisive)

Required exhibits for a Deschutes County land CMA (adapt for other counties):

| # | Document | Source |
|---|---|---|
| EX-1 | Zoning of record | Deschutes County DIAL Development Summary (`dial.deschutes.org/Real/DevelopmentSummary/<account>`): captures base zone, overlays, Legal Lot of Record status |
| EX-2 | Dwelling entitlement / Declaratory Ruling | Deschutes County WebLink F&D document (if a CUP or DR exists): include verbatim condition language confirming the entitlement |
| EX-3 | Permit history | Deschutes County DIAL Permits (`dial.deschutes.org/Real/Permits/<account>`): lists finaled building/electrical/plumbing, land-use permits, CUP extensions |
| EX-4 | Parcel boundary / aerial | Deschutes County GIS taxlot layer (`maps.deschutes.org/arcgis/rest/services/Dial2_Taxlots/MapServer/0`): acreage computed from authoritative polygon, not MLS or assessor estimate |
| EX-5 | Comp zoning | Deschutes County GIS Summary_Information layer spatial query per comp taxlot: confirms zone for every comp included or excluded |
| EX-6 | Applicable zoning code | Deschutes County Code Title 18 refs for each overlay (DCC 18.16 EFU, 18.84 LM, 18.88 WA, etc.) with deschutescounty.gov URLs |

Note: source PDFs (F&D, permit printouts) are available from the county portal at the exhibit URLs and should be offered as attachments when the CMA is delivered.

Write all six exhibits (or the applicable subset) into `out/cma-<slug>/citations.json` under a `supplemental_exhibits` key in addition to the standard `sources` array.

**Cross-references:**
- Step 3.5 of this skill: authoritative zoning pull (GIS, not MLS). The exhibit list is the public-facing record of that step.
- CLAUDE.md §GIS-authoritative: polygons/KML/boundaries must come from City/County GIS or Census TIGER. Never approximate or infer from memory.
- CLAUDE.md §0 (Data Accuracy): every exhibit entry carries a source URL, date pulled, and key finding so the trace is auditable.

**Step 7c.  Land CMA v2.  data-verification, valuation, and QA learnings (locked 2026-06-06, 18705 Tumalo Reservoir deep build)**

Step 7b (2026-06-04) fixed zoning + entitlement. The full rebuild that followed surfaced a second tier of land rules. Exemplar: `public/cmas/cma-18705-tumalo-reservoir/cma.html` (25 pages.  twin-anchored dry-EFUTRB valuation, hunting/landowner-tags page, OWRD well log, building-constraints, per-comp listing history, exhibit appendix).

1. **NEVER trust `listings.price_per_acre` (or any DB-computed $/ac). Compute it yourself: `ClosePrice ÷ lot_size_acres`.** The stored column is inconsistent.  list-based on some rows, close-based on others, and occasionally on an acreage that disagrees with `lot_size_acres`. Trusting it put three comps' $/ac wrong by 5-15% (93rd showed $33,649 from its list price; the actual close was $30,590/ac). Every $/ac on the grid, table, and narrative is `ClosePrice ÷ lot_size_acres`, recomputed in-session, traced in citations.json. This is a §0 figure.

2. **Land time-adjustment comes from PAIRED / REPEAT SALES, not the SFR cache, and the trend is NOT linear.** `market_stats_cache.yoy_median_price_delta_pct` (Step 4.5 / Step 9) is an SFR $/sqft rate.  it does not describe raw-land $/acre and is often absent for a land geo. For land, derive the market-conditions adjustment empirically: pull repeat sales of comparable parcels (same parcel sold twice, or close substitutes) and measure the annualized change. Central Oregon acreage **boomed ~2020→2022 (20-60%/yr) then plateaued 2022→2026 (~1-9%/yr)**.  a flat rate across that span is wrong in both directions. Adjust each comp by the rate for ITS period, weight recent comps (which need little adjustment) highest, and never extrapolate a boom rate forward onto an older sale. Trace the paired-sales basis in citations.json.

3. **The "twin" anchor.** When a near-identical adjacent parcel has sold (same zone, acreage, entitlement, frontage, BLM adjacency), it is the single strongest indicator.  it needs essentially no physical adjustment, only time (and any one concrete difference, e.g. a barn). Anchor on it and let the rest of the set bracket. (18705's value rests on 18715, the next-door 40-ac dry-EFUTRB twin that sold over ask in 10 days.) Plot the subject and the twin as adjacent pins.  it shows the comparison at a glance.

4. **Verify site improvements against PRIMARY records, and never overstate them. A drilled well ≠ an installed septic ≠ buildable-tomorrow.**
   - **Well:** Oregon logs every drilled well. Query the OWRD well-log GIS (`https://arcgis.wrd.state.or.us/arcgis/rest/services/dynamic/wl_well_logs_qry_WGS84/MapServer`) and point-in-polygon the parcel boundary for the on-parcel log (well number, completed depth, first-water depth, completion date, use). A confirmed domestic well is a real, citable value factor.
   - **Septic:** onsite status is in the county permit record (`dial.deschutes.org/Real/Permits/<account>`). Distinguish **"site evaluation / feasibility approved"** (soil test passed, nothing built) from **"installed system"** (a finaled onsite-wastewater construction permit). The first draft said "approved septic" when the permit record shows NO onsite permit.  the buyer still installs (~$15-30k). If no onsite permit exists, the system is not installed.  say so.
   - **Structures:** finaled electrical/plumbing permits confirm the utilities are legal; structures ≤200 sqft are typically building-permit-exempt in Oregon (legit, not a liability). Reconcile to the permit record, not an owner claim alone.

5. **Buildability constraints.  verify with county GIS and state them plainly.** Beyond the dwelling entitlement (Step 3.5), check the parcel against FEMA flood (`WaterFD/1`), wetland inventory (`WaterFD/5`), slope >25% (`EnvironmentFD/3`), and wildfire hazard (`LandFD/9`). State what governs WHERE a home can sit: the WA deer-winter-range setback (often 300 ft from the road centerline), the LM scenic setback (100 ft) + design review, irrigation-canal easements crossing the parcel, and wildfire defensible space. Answer "can a home be built?" explicitly.  the entitlement says yes, here is the buildable envelope. No floodplain / no wetland / no steep slope is a positive worth stating.

6. **Hunting + landowner tags (rural recreational land.  a real value driver, handled with a caveat).** For acreage that backs public land or sits in a game unit, research and state: the ODFW game unit, deer/elk winter-range status, whether the parcel is inside a No Shooting District (county GIS `BoundaryFD`), BLM adjacency, and Landowner Preference (LOP) tag eligibility. Oregon LOP (OAR 635-075): **40 acres qualifies for antlerless deer + antlerless elk; a buck-deer / bull-elk / either-sex / pronghorn tag needs 160 acres.** Genuine selling point for a buyer who hunts.  but eligibility has conditions, so **state it clearly caveated and recommend the buyer confirm with ODFW.** When the report goes to the seller, an open ODFW inquiry is an honest "we are confirming this" line, not a guarantee.

7. **Map pins use each comp's VERIFIED lat/lng from the DB.  never approximated.** A rebuild that "placed comps near the subject to keep the map readable" put every pin in the wrong location. Pull `Latitude` / `Longitude` per comp and let the static map auto-fit. A wide Bend-area view with correct pins is right; a tidy-but-wrong cluster is a §0 failure.

8. **Per-comp listing-history "story."** Sellers want the journey to the sale, not just the close price. One line per comp: original list → price cuts (with the cut) → days on market → relistings → final sale. The pattern teaches the pricing lesson.  the parcel that priced right sold fast and over ask; the over-listers sat 400-700+ days and cut 20-40%. Pull from `listing_history` + the orig-list / list / close spread.

9. **Pricing.  list with negotiation room above the supported range, and let the DOM evidence make the case.** The three-method reconciliation gives a supported value range; the recommended LIST can sit a step above it for negotiation room.  but that is the broker's call. Surface the supported range and the list options; do not unilaterally set a list above support. Use the comp listing-history and current competing-supply DOM (active dry acreage sitting 300-560 days at aspirational asks) to show why over-listing risks a long sit. The seller decides the list; the CMA gives the honest range plus the strategy.

10. **QA.  fact-check every figure against the source yourself. A subagent's self-report is not verification.** When a sub-pass rebuilds the analytical pages it WILL miss things (this rebuild left "no water" remnants, mis-placed every map pin, and introduced 78 em-dashes while reporting "done"). Re-grep the rendered HTML for every old/wrong figure (must be 0) and every new figure (must be present), re-measure pagination after ANY edit (each `.page` fits one sheet.  `overflow:hidden` silently CLIPS, so the Step 7a page-fit check is mandatory again), and confirm the map renders with correct pins. **Brand voice on a client doc: em-dashes are banned in prose** (period or comma); the ONLY allowed em-dash is the data-placeholder for an unavailable value in a stats cell. Scan and fix before surfacing.

11. **Delivery reality.  the broker often sends the final client message himself.** A land-CMA lead frequently arrives by text and the broker answers by text. The canonical delivery is still the Gmail draft (Step 15), but the broker may prefer to text the lead a link to the CMA in his own voice. Stage a reviewable draft (a FUB note + task on the lead's record), present the exact wording for review, and let him send it. **A text the broker sends from his phone logs into the FUB timeline but does NOT appear in the FUB `/textMessages` API**.  so "the API shows no sent text" does not mean it was not sent. Read the person's timeline before assuming, and never send a duplicate.

**Step 8.  Build the comp location map endpoint**

Create `app/api/maps/cma-<slug>/route.ts` (or generalize to a parameterized endpoint after the second CMA). The route proxies a Google Maps Static API call with:
- Subject pin: `color:red|label:S` at the subject lat/lng
- Comp pins: `color:0x102742|label:<n>` for n = 1..N matching flyer order

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is the live env var on Vercel. Mapbox (`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`) is not provisioned as of 2026-05-14.  stick with Google.

**Step 9.  Pricing methodology**

Two methods, both must converge within ±5% for the range to be defensible:

**Method 1.  Tiered $/sqft.** Sort closed comps into "renovated/turnkey" tier and "un-renovated/dated" tier by $/sqft. Apply the renovated tier range to the subject's sqft. Allow a small lot-premium adjustment if subject is materially larger than comps.

**Method 2.  Un-renovated baseline + improvement value-add.** Anchor baseline on the closest-vintage unimproved comps. Add value-add for documented seller improvements using Remodeling Magazine Cost-vs-Value Pacific-region recovery rates (kitchen 65-75%, roof 60-70%, paint 60-80%, landscape 60-100%, HVAC 60-80%, window coverings 25-40%).

**Market-conditions (time) adjustment.  apply to EVERY comp before any method.** Normalize each comp's close price to today using the verified YoY trend from Step 4.5:

```
months_since_close  = (today − comp.CloseDate) / 30.44
time_adjustment     = comp.ClosePrice × (yoy_median_price_delta_pct / 100) × (months_since_close / 12)
time_adjusted_price = comp.ClosePrice + time_adjustment
```

This is the appraiser "market conditions adjustment".  the single most important reason two CMAs of the same house can differ, and the gap the old recipe ignored. Show it as an explicit line in the adjustment grid. The YoY rate traces to `market_stats_cache` (Step 4.5).  never estimate it.

**Per-comp adjustment grid (appraiser-style.  required on the comp summary page).** Every comp gets a transparent ledger, not just a final number. A seller reading this CMA should see exactly how each comp was reconciled to their home:

| Comp | Close $ | Market-conditions (time) | Size ($/sqft) | Beds / baths | Lot / garage / condition | Adjusted $ |
|------|---------|--------------------------|---------------|--------------|--------------------------|------------|

Size, bed/bath, lot, garage, and condition adjustments follow standard paired-sales logic against the subject. Keep every adjustment defensible.  if you cannot justify it from the data, do not make it.

**Method 3.  time-and-physically-adjusted comp reconciliation.** The similarity-weighted average of the adjusted prices from the grid (weight by size proximity, distance, and recency). This is the third independent estimate, and the one that carries the market-conditions correction.

**Convergence + confidence.** All three methods (tiered $/sqft, baseline + value-add, adjusted-comp reconciliation) must land within ±5%. If they diverge more than that, do not average through it.  state which method governs and why, and lower the stated confidence. Confidence (High / Moderate / Supportable-only) is a function of: comp count (≥5 is strong), range dispersion, median comp age (>9 months caps at Moderate), median comp distance (>4 mi caps at Moderate), and method divergence. State the confidence and a one-line reason on the pricing page.  honest uncertainty beats false precision (CLAUDE.md §0).

The converged range gets three tiers:
- **Conservative**.  quick-sale entry, ~30-day close
- **Recommended List**.  what to actually list at; usually the upper-middle of the range
- **High End**.  supportable ceiling with all condition + photo issues resolved

Check the High-End tier against the Step 4.5 market context before committing to it. A buyer's market (months of supply ≥ 6) or a geo where homes are closing under asking does not support an aggressive ceiling.  say so plainly and pull the High End in. A seller's market (MoS ≤ 4, homes closing over asking, low days-to-offer) supports it. The market verdict belongs in the pricing rationale, not just the recommended number.

**Step 10.  Subject row in the comp table**

The subject row at the top of the comp summary table should populate List with the recommended list price and $/sqft with `recommended_list / subject_sqft`. Sold / Close / Active stay as em-dash. This way the subject reads in context against the comps, not as a row of placeholders.

**Step 11.  QA gate (per CLAUDE.md §0)**

- Every figure in the deliverable traces to a Supabase query run in this session.  write `out/cma-<slug>/citations.json`
- Every comp number (close price, $/sqft, lot, beds/baths, close date, DOM/days-to-offer) matches Supabase exactly, AND every market-context figure (months of supply, YoY $/sqft trend, sale-to-list, % over/under asking, median DOM) traces to `market_stats_cache` / `market_pulse_live` with `geo_slug` + `methodology_version` + `computed_at` recorded in citations.json. The market verdict (seller / balanced / buyer) must match the months-of-supply number against the thresholds (≤ 4 seller, 4-6 balanced, ≥ 6 buyer)
- Per-comp adjustment grid: each line (market-conditions/time, size, beds-baths, lot/garage/condition) is shown and defensible, and the math foots to the adjusted price. The market-conditions adjustment uses the verified YoY rate from Step 4.5, never an estimate
- Three-method convergence: Methods 1, 2, and 3 land within ±5%, or the divergence is explained on the pricing page and confidence is lowered accordingly. The stated confidence (High / Moderate / Supportable-only) matches the comp count, dispersion, recency, and distance per Step 9
- Brand voice check: banned words from CLAUDE.md §"Voice + content" (`stunning`, `nestled`, `breathtaking`, `must-see`, etc.) must not appear in CMA narrative.  they're fine in MLS-pulled `public_remarks` (those are quoted text)
- **DOM is ALWAYS shown (locked 2026-06-13, Matt directive).** Every comp carries DOM on the comp-summary table (a `DOM (DTO)` column) AND on its own comp flyer (a "Days on Market" line). Display Days to Offer (active days = `pending_timestamp - OnMarketDate`) alongside the Spark DOM. A same-day off-market sale (DOM 0) gets a footnote. Never omit DOM. See §10.
- Map renders successfully (hit `/api/maps/cma-<slug>` and confirm 200)
- All flyer hero photos load (HEAD-check each Spark CDN URL)
- Page numbers in footers correct (no `X of Y` mismatches)
- **PDF under 25 MB**.  hit `/api/cma/<slug>/pdf?info=1` and confirm `under_attachment_cap: true`. If over, drop the next image tier (heroes `800→640` or gallery `320→240` if any are still at a larger variant) and re-render. The Tumalo CMA landed at ~12 MB with 800×600 heroes and 320×240 thumbnails.

**Step 12.  Write citations.json**

```json
{
  "deliverable": "public/drafts/cma-<slug>/cma.html",
  "generated_at": "2026-05-14T03:52:00Z",
  "subject": {
    "address": "21042 Robin Ave, Bend OR 97703",
    "listing_key": "20220425183424852391000000",
    "source": "Supabase listings",
    "fetched_at": "2026-05-14T01:30:00Z"
  },
  "comps": [
    {
      "listing_key": "20260102150903067179000000",
      "address": "65258 Old Bend Redmond Hwy",
      "close_price": 1200000,
      "close_date": "2026-02-23",
      "days_to_offer": 14,
      "dom_total": 44,
      "source_query": "SELECT... FROM listings WHERE SubdivisionName = 'Whispering Pines' AND..."
    }
  ],
  "broker": {
    "slug": "matt-ryan",
    "source": "Supabase brokers"
  }
}
```

**Step 12b.  Independent Verification Review (MANDATORY substantive-accuracy gate.  the draft does NOT surface to Matt until this passes)**

Step 11's QA gate checks FORMAT and provenance (page-fit, brand voice, "figures trace to a query"). It does NOT catch substantive valuation errors.  a fabricated zoning code, a non-comparable comp, a "bare land" mischaracterization, or an unverified entitlement all render cleanly and pass Step 11. Those are §0 failures that risk Matt's license if they reach a client. (Verified failure modes from the 18705 Tumalo Reservoir build, 2026-06-04: the first draft labeled an EFU/LM/WA parcel "RR10," leaned on MUA10/TUR5 comps that inflated the value, and called an improved parcel with a confirmed dwelling right "bare land".  all three passed Step 11. Only manual scrutiny caught them. This step exists so the producer catches them, not Matt.)

Before the draft surfaces (Step 13), an **independent reviewer.  a SEPARATE agent pass, NEVER the agent that built the CMA.  runs an adversarial verification** whose job is to FALSIFY each value-driving claim against the authoritative record, not to admire the layout. Spawn it as its own subagent (fresh context) and hand it the draft HTML, `citations.json`, and the source records (Supabase pulls + the county DIAL / GIS / permit records + the comp set). Its mandate: find what is WRONG, default to "flag it" when uncertain.

**Verification checklist (a verdict + evidence for every item):**

1. **Zoning** comes from the authoritative county record (Deschutes DIAL DevelopmentSummary per Step 3.5), NOT inferred or from the MLS, and every base zone + overlay (LM / WA / FP / SMIA / AS) is captured and correctly stated. Pull it fresh and compare.
2. **Comp comparability**.  every comp is zoning-matched (same entitlement class as the subject). Any comp in a different or easier zone (MUA10 / RR10 / UAR10 / TUR5 vs an EFU subject) is EXCLUDED or explicitly down-weighted with the reason, never silently averaged in. Pull each comp's zone from the county GIS and flag any mismatch used at weight.
3. **Property profile**.  bare-vs-improved, structures, utilities, and dwelling status reconcile to the permit + assessor record (DIAL Permits + Land & Structures), not just the MLS or an owner claim.
4. **Value drivers traced to PRIMARY records**.  every fact that moves the number (dwelling right / CUP / DR, water rights, buildability, lot-of-record, partition) traces to a primary county record cited in `citations.json`, not asserted.
5. **No inference stated as fact**.  scan for any definitive claim (zoning, acreage, buildability, entitlement) that lacks a primary-source citation. This is the exact RR10 failure mode.
6. **Narrative reconciles to data**.  every verdict / pill / sentence is consistent with the number beside it (market verdict matches MoS, the $/acre conclusion matches the comp weighting, the recommended list sits correctly within the range, the methods converge within ±5% or the divergence is explained).
7. **Math foots**.  the adjustment grid, weighted average, $/acre, range, and tier prices all compute from the cited inputs.

**Output:** the reviewer returns a verdict.  **PASS** (every item verified) or **FAIL** with a numbered punch list, each flag carrying the claim, why it is wrong or unverified, and the authoritative source that should govern.

**The gate (hard):** the CMA does NOT advance to Step 13 until the verification PASSES. On FAIL, the producer fixes every flagged item.  re-pulling the authoritative record where needed.  and re-runs the reviewer. A draft may surface to Matt only with the verdict attached: PASS, or PASS-with-dispositioned-flags where a flag was reviewed and explicitly resolved with the basis recorded. Matt's review (§7 `matt-review-draft`) stays the FINAL gate.  this step makes the draft trustworthy before it reaches him, so he approves a vetted document instead of doing the QA himself.

Record the verdict + any resolved flags in `citations.json` under a `verification_review` block, and include it in the `executor_response` surfaced with the draft (Step 13). This is `engineering:code-review` for a valuation.  the same enforce-it-don't-eyeball-it gate. Non-negotiable for land / complex CMAs; it still runs for a simple in-subdivision SFR CMA but typically passes quickly.

**Step 13.  UPDATE the action row to `ready` and surface to Matt**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = jsonb_build_object(
      'draft_path', 'public/drafts/cma-<slug>/cma.html',
      'preview_url', 'https://...vercel.app/drafts/cma-<slug>/cma.html?_vercel_share=<token>',
      'recommended_list', <number>,
      'value_low', <number>,
      'value_high', <number>,
      'comps_count', <number>,
      'broker_slug', '<slug>'
    )
WHERE id = '<id>';
```

**Step 14.  On Matt's "ship it"**

1. Move the draft from `public/drafts/cma-<slug>/` → `public/cmas/<slug>/` (the tracked permanent location).
2. Insert (or upsert) into `public.cmas`:

```sql
INSERT INTO public.cmas (
  slug, subject_address, subject_listing_key, subject_subdivision, subject_city,
  client_name, client_email, broker_id, broker_slug,
  value_low, value_high, recommended_list, comps_count,
  html_path, status, finalized_at, created_at
) VALUES (
  'cma-21042-robin', '21042 Robin Ave, Bend OR 97703', '20220425...', 'Whispering Pines', 'Bend',
  'Kelly Hansen', '<email>', '<broker_uuid>', 'matt-ryan',
  1150000, 1267500, 1225000, 8,
  'public/cmas/cma-21042-robin/cma.html', 'finalized', now(), '<original_created_at>'
)
ON CONFLICT (slug) DO UPDATE SET
  status = EXCLUDED.status,
  finalized_at = now(),
  recommended_list = EXCLUDED.recommended_list,
  value_low = EXCLUDED.value_low,
  value_high = EXCLUDED.value_high;
```

3. Insert one row per comp into `public.cma_comps`:

```sql
INSERT INTO public.cma_comps (cma_id, comp_listing_key, comp_order, sold_price, sold_date)
VALUES...
```

4. Git commit + push the `public/cmas/<slug>/` files. Do not commit the `public/drafts/cma-<slug>/` version.  that's the draft scratch space.
5. Set `marketing_brain_actions.status = 'approved'` then `'executed'` once the push completes.
6. **Immediately after the git push (step 4 above), call the finalize-deliver endpoint** (Step 15 below) to fire the Gmail draft + Matt notification. Do not wait for a separate manual trigger.

---

**Step 15.  Fire Gmail draft + Matt notification (the delivery wiring)**

Once the HTML is at `public/cmas/<slug>/cma.html` and the git push is done, call:

```bash
curl -X POST https://ryan-realty.com/api/cma/<slug>/finalize-deliver \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Or, from within the same agent session that just did the push:

```typescript
import { finalizeAndDeliverCma } from '@/lib/cma-deliver'
const result = await finalizeAndDeliverCma({ slug: 'cma-<slug>' })
```

**What this does (in order, all best-effort):**

1. Renders the CMA HTML to a PDF buffer via `renderCmaPdfBuffer(slug)` (puppeteer + @sparticuz/chromium-min, same engine as `/api/cma/<slug>/pdf`). Errors if the PDF exceeds the 25 MB Gmail cap.
2. Creates a **Gmail DRAFT** in the signing broker's mailbox (`matt@ryan-realty.com` by default, or the broker resolved from `public.cmas.broker_slug` if they're on the `@ryan-realty.com` domain) via `createGmailDraft` (Google DWD / `gmail.modify` scope, verified live 2026-05-29). The draft is addressed to the lead, has the CMA PDF attached, and BCC's `ryan.realty@followupboss.me` so FUB logs it the moment Matt hits Send. **Matt reviews and sends personally.** This is a DRAFT, never an auto-send to the lead.
3. **Fallback:** if the Gmail DWD scope is unavailable, Resend delivers the PDF to the broker (not the lead) with context to forward manually. The response field `fellBackToResend: true` signals this.
4. Notifies Matt via Resend (`MATT_ALERT_EMAIL` env var, defaults to `matt@ryan-realty.com`) that the CMA is ready: Gmail-draft confirmation, recommended list price, PDF link at `/api/cma/<slug>/pdf`.

**Response shape:**

```json
{
  "ok": true,
  "slug": "cma-<slug>",
  "gmail_draft_id": "r8765432109",
  "fell_back_to_resend": false,
  "matt_notified": true,
  "pdf_bytes": 8453120,
  "warnings": []
}
```

**Auth:** the route accepts either `Authorization: Bearer <CRON_SECRET>` or an active admin Supabase session cookie (same pattern as `/api/admin/run-producer/[id]`).

**Canonical implementation files:**
- `lib/cma-deliver.ts`: `finalizeAndDeliverCma()`, the core logic
- `app/api/cma/[slug]/finalize-deliver/route.ts`: the HTTP trigger

**Note:** The CMA HTML build itself is agentic. The agent-in-the-loop runs this SKILL.md recipe (Steps 1-14) to produce the HTML. This step (15) covers everything *after* the HTML exists: PDF render, Gmail draft, Matt notify.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | data pull, broker resolve, action row + cmas table writes | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `/api/listings/[key]/photos` | Spark photo array per listing | `SPARK_API_KEY`, `SPARK_API_BASE_URL` |
| `/api/maps/cma-<slug>` | Google Maps Static map | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Vercel MCP | get preview URL for the draft branch | (no env var; uses MCP token) |
| `lib/cma-deliver.ts` | Gmail draft + Matt notification on finalization | `GOOGLE_SERVICE_ACCOUNT_*`, `RESEND_API_KEY`, `CRON_SECRET` |
| Resend (ops-email-send) | Resend fallback + Matt alert | `RESEND_API_KEY`, `RESEND_FROM`, `MATT_ALERT_EMAIL` |

---

## 6. Output format

**Draft HTML lands at:** `public/drafts/cma-<slug>/cma.html` (+ assets in `assets/`).
**On finalization HTML moves to:** `public/cmas/<slug>/cma.html`.
**PDF endpoint (primary deliverable):** `/api/cma/<slug>/pdf`.  automatically resolves the HTML at either path and renders to PDF via headless Chrome. Append `?download=1` for force-download.

**Surface format (present to Matt exactly like this):**

```
Draft ready: CMA.  <subject address> for <client name>

  DELIVERABLE
    PDF (primary): <host>/api/cma/<slug>/pdf
    HTML preview: <vercel preview url with _vercel_share token>
    Draft path: public/drafts/cma-<slug>/cma.html
    Repository:  /admin/cmas (row visible to anyone with admin access)

  VALUATION
    Range: $X.XXM.  $X.XXM
    Recommended list: $X,XXX,XXX
    Comps: N closed in <subdivision> over last 24 mo

  BROKER
    Signed by: <Display Name> · OR Lic. # <license>
    (Resolved from public.brokers by <email or slug>)

  VERIFICATION TRACE
    Subject: ListingKey <key>, last MLS listing <date> at <price> (<status>)
    Comp set: <count> rows, SubdivisionName='<sub>', PropertyType='A', CloseDate >= <date>
    Photos: all hero URLs HEAD-checked 200 OK
    Map: /api/maps/cma-<slug> returned 200

  citations.json: out/cma-<slug>/citations.json

Reply "ship it" / "approved" / "go" to commit + push to public/cmas/<slug>/ and insert into public.cmas.
```

Then stop. Do not commit. Wait for Matt's explicit approval.

---

## 7. Approval gate

**This producer uses:** `matt-review-draft`

---

## 8. Status flow

```
pending → in_production → ready → approved → executed → measured
                                    │
                          killed ◄──┘ (Matt cancels or QA fails)
```

The `measured` step for a CMA is light.  90 days after delivery, the `performance_loop` checks whether the property went under contract and at what price relative to the recommended list. That feedback informs the calibration of future CMAs.

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Subject not in MLS | listings query returns 0 rows | Surface to Matt: ask for manual subject specs (beds/baths/sqft/lot/year) in `payload.client_notes`. Continue with comp pull using same-zip filter only. |
| Comp set < 3 rows | subdivision-only filter returns sparse | Expand to same-zip + same-property-class. If still < 3, surface to Matt.  a credible CMA needs at least 3 closed comps. |
| Photo endpoint 404 for a comp | Spark returns "Listing not found" | Use the "No MLS photo on file" placeholder card. Don't block the CMA over a single missing comp photo. |
| Broker not in `public.brokers` | broker_email/slug doesn't match | Default to `matt-ryan`. Surface a one-line note that broker fell back to Matt; ask if a new broker record should be created. |
| Map endpoint 500 | Google Maps Static API error or missing env var | Surface the actual error from the route's JSON response. Don't ship the CMA without the map. If `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is missing, that's a Matt-side env fix; pause and report. |
| Banned word in narrative | brand-voice check hits | Rewrite the offending sentence and re-validate before surfacing. |
| `pending_timestamp` missing for a comp | Days to Offer cannot be computed | Show DOM only for that comp, footnote explaining missing pending data. Don't fabricate a days-to-offer number. |

---

## 10. Related skills, references, and known quirks

**Required reading before executing:**
- `CLAUDE.md` §0.  Data Accuracy (outranks everything)
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last (outranks everything)
- `design_system/ryan-realty/SKILL.md`.  brand visual system + headshot composite rule
- `marketing_brain_skills/brand-voice/voice_guidelines.md`.  voice enforcement

**Capabilities used:**
- `app/api/listings/[listingKey]/photos/route.ts`.  Spark photo fetcher (added 2026-05-14)
- `app/api/maps/cma-<slug>/route.ts`.  Google Maps Static proxy (replicate per CMA until generalized)
- `app/api/cma/[slug]/pdf/route.ts`.  server-side PDF renderer (puppeteer-core + @sparticuz/chromium-min). Same Chrome engine as the HTML preview, so formatting is identical.
- `app/admin/(protected)/cmas/page.tsx`.  repository lookup UI; lists every row in `public.cmas` with broker / client / status / pricing range and links to both PDF and HTML.

**Tables touched:**
- READ: `listings`, `brokers`, `listing_history`, `status_history`, `price_history`
- WRITE: `marketing_brain_actions` (status transitions), `cmas`, `cma_comps`

**Exemplars (clone the one that matches your situation):**
- `public/cmas/cma-19496-tumalo-reservoir/cma.html`.  **canonical exemplar for current rules** (finalized 2026-05-17). Rural acreage subject signed by Matt Ryan, 5 closed comps via PostGIS distance RPC, 13 pages with the layout-discipline split, 10.66 MB PDF. The structural reference for any new CMA built under the post-2026-05-17 layout + image-budget rules.
- `public/cmas/cma-21042-robin/cma.html`.  earlier reference for Kelly Hansen, signed by Matt Ryan (locked 2026-05-14). Whispering Pines subdivision subject, 8 closed comps via SubdivisionName filter. Useful for the sub-division-based comp-selection pattern; the page-fit and image-tier work was solved later in the Tumalo build.

**Known data quirks:**

1. **Oregon Data Share DOM includes time under contract.** The `DaysOnMarket` field reports list-date → close-date (not list-date → pending). For active-marketing analysis, compute `days_to_pending = pending_timestamp - OnMarketDate`. Always show **Days to Offer** alongside DOM in the CMA.  the active number is the more useful read of buyer demand.

2. **`listings.PhotoURL` can be null even when photos exist.** Some MLS records (especially recent ones or those where the media sync hasn't completed) have a null PhotoURL despite Spark returning 30-70 photos via `_expand=Photos`. Always fall back to `/api/listings/<key>/photos` rather than trusting `PhotoURL` alone.

3. **`BathroomsTotal` is a fixture count, not a "X.5 baths" decimal.** Pre-renovation a "3.5 BA" home shows as `BathroomsTotal=4` (3 full + 1 half = 4 fixtures). After a half-bath addition it would become 5. The MLS doesn't update until the property is re-listed. Default the CMA to the actual current bath count per the seller's improvement list, not the stale MLS value.

4. **Spark CDN photo URLs are stable but not forever.** Once a listing is closed or expired, photos may be retained for several years but eventually purged. For finalized CMAs that need to survive long-term, download the hero images locally to `public/cmas/<slug>/assets/`. For draft + short-term review, hot-linking the Spark URL is fine.

5. **`listings.price_per_acre` is computed inconsistently.  do not use it.** The column is list-based on some rows and close-based on others, and occasionally on an acreage that disagrees with `lot_size_acres`. For any land CMA, compute $/acre yourself.  `ClosePrice ÷ lot_size_acres` for sold comps, `ListPrice ÷ lot_size_acres` for active-supply context.  recomputed in-session and traced in citations.json. This caused three comps' $/ac to read 5-15% wrong in the first 18705 draft. See Step 7c.1. (Same class of trap as trusting `PhotoURL`.  the convenience column lies, go to the source fields.)

**Brain wiring:**
- Registry entry: `marketing_brain_skills/producers/REGISTRY.md` Section B, row `cma`
- Action type: `content:cma`
- Approval: `matt-review-draft`
- Default broker: `matt-ryan` (override via `payload.broker_email` or `payload.broker_slug`)

**Future generalizations:**
- Parameterize the map endpoint to a single `/api/maps/cma/[slug]` route that reads coordinates from the `cmas` + `cma_comps` tables (rather than copying the hardcoded route per CMA).
- Build a `/admin/cmas` page that lists every row in `public.cmas` with filters by broker and client and links to each `cma.html`.
- Wire delivery to FUB: when a CMA is finalized, automatically create an FUB note on the client's lead record with a link to the CMA URL.

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `marketing_brain_skills/research/tool-inventory.md`
- `marketing_brain_skills/research/platform-bible.md`
- `marketing_brain_skills/research/asset-library-map.md`
- `marketing_brain_skills/research/bend-market-bible.md`

---

## Validator stub sections (canonical 11-section structure)

## 11. Tool gap suggestions

Tool gap suggestions: see tool-acquisition-recommendations.md for the aggregated list across all producers.

## Content-producer additional references

- `automation_skills/content_engine/SKILL.md`
- `social_media_skills/platform-best-practices/SKILL.md`
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`
- `video_production_skills/VIRAL_GUARDRAILS.md`
