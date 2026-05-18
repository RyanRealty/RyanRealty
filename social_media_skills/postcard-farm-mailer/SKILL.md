---
name: postcard-farm-mailer
description: >
  USPS direct-mail postcard producer for the 0.5-mile farm radius around a Ryan Realty listing.
  Two variants discriminated by `postcard_moment` payload: (a) `at_list`.  "Your neighbor at
  <street> just hit the market" with hero exterior + price + QR to the property page; (b)
  `at_sold`.  "Your neighbor's home just sold for $<sold_price>" with hero + sale-to-list pct
  + DOM + QR + "thinking about your home's value? scan or call." Doubles as a market-proof
  piece that seeds future seller leads in the farm. 6×9 (default) or 4×6 format at 300dpi
  USPS-compliant print. Emits front PDF, back PDF, PNG digital proofs, geocoded mailing-list
  CSV, and citations.json. Use whenever Matt asks for direct-mail to the listing's farm.
when_to_use: |
  Trigger when Matt says any of:
  - "build a postcard for <address>"
  - "farm mailer for <MLS#>"
  - "postcard at listing"
  - "postcard at sold"
  - "neighborhood postcard for <address>"
  - "direct mail for the listing"
  - "neighbor mailer for <address-or-MLS#>"
  - "/postcard <address>"
action_types:
  - content:postcard_mailer
output_type: image
target_platforms: ["ig_feed", "ig_carousel", "fb_feed"]
asset_destination: Supabase asset-library bucket + public/list-kits/<address>/
auto_inputs: ["listing photos from Spark", "brand tokens", "design system v2"]
required_inputs: ["mls_id OR topic"]
optional_inputs: ["aspect_ratio_overrides", "color_palette_override"]
estimated_runtime_min: 5
cost_usd_estimate: $0.05-$0.50 per image
thumbnail_uri: out/proof/2026-05-17/exemplars/<slug>/sample.png
example_outputs: []
    label: "past approved renders"
    surface: "ig_carousel"
---

# Postcard Farm Mailer.  Ryan Realty At-List / At-Sold Direct Mail

**Status:** Canonical  
**Locked:** 2026-05-17  


**Scope.** Produce one print-ready USPS direct-mail postcard for the 0.5-mile farm radius
around a single listing, in one of two moments.  `at_list` (neighbor announcement when the
property hits the market) or `at_sold` (neighbor announcement when it closes). Output is a
front PDF, back PDF, digital-proof PNGs, a geocoded mailing-list CSV, and a citations.json
for every figure shown. Does NOT execute the print order, place mail with USPS, dedup against
prior mailing cohorts beyond the radius query, or wire into the FUB lead capture flow.  those
are handled by `ops/postcard-print-order/` (TODO) and the FUB inbound webhook respectively.

**Status.** Canonical (v1). Locked 2026-05-14.

**Producer category.** Section B.  Content Producer.

**Exemplar output:** `out/postcard/<slug>/`.

---

## 1. Required references.  load before any work

| Reference | Why |
|---|---|
| `CLAUDE.md` §0.  Data Accuracy mandate | Every figure shown (price, sold price, DOM, sale-to-list pct) traces to live Supabase / Spark. Outranks everything. |
| `CLAUDE.md` §0.5.  Draft-First, Commit-Last | Render PDFs to `out/`, surface to Matt, wait for explicit approval before any print order is placed or any tracked file commits. |
| `CLAUDE.md` "Voice + content" | Phone discipline (`541.213.6706` direct vs `541.703.3095` FUB-tracked inbound), web `ryan-realty.com`, banned vocab union. |
| `CLAUDE.md` "Supabase listings Schema" | Mixed-case quoted column names. PostGIS on `"Latitude"` / `"Longitude"`. |
| `design_system/ryan-realty/SKILL.md` | Heritage register (navy `#102742` monochrome on cream `#faf8f4`), Amboqia display, Geist body, pre-rendered wordmark. |
| `design_system/ryan-realty/colors_and_type.css` | Authoritative color + type tokens. |
| `marketing_brain_skills/brand-voice/voice_guidelines.md` | Banned vocab union; voice attributes (honest, transparent, neighborly). |
| `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` | Matt's writing fingerprint. |
| `automation_skills/content_engine/SKILL.md` | Content routing bus.  every `content:*` action dispatches through here. |
| `video_production_skills/ANTI_SLOP_MANIFESTO.md` | Banned-content gate. No "stunning," no manufactured urgency, no AI-generated property photos. |
| `marketing_brain_skills/producers/TEMPLATE.md` | Producer skeleton (10 sections). |
| `marketing_brain_skills/producers/REGISTRY.md` | Section B row pointer. |

USPS reference (external, version-locked at build time):
- USPS Direct Mail design specs: [PDF Form 3602-R Postage Statement](https://pe.usps.com/).  6×9 and 4×6 dimensions, indicia placement, address-block clear zone, IMb barcode space.

---

## 2. Action types handled

| action_type | required payload | notes |
|---|---|---|
| `content:postcard_mailer` | `mls_id`, `postcard_moment` | Plus optional `mailing_radius_miles`, `size` |

### Payload schema

```typescript
type PostcardMoment = 'at_list' | 'at_sold'
type PostcardSize = '6x9' | '4x6'

interface PostcardFarmMailerPayload {
  mls_id: string                      // required.  e.g. "220189422"
  postcard_moment: PostcardMoment     // required.  at_list or at_sold
  mailing_radius_miles?: number       // default 0.5
  size?: PostcardSize                 // default '6x9'
}
```

The brain populates `payload` when it writes the action row (e.g. when a listing transitions
to Active or Closed in Supabase). For manual invocations via `marketing_brain_skills/produce/`,
Matt provides these in natural language and produce parses them.

---

## 3. Brief payload schema (action row shape)

```typescript
interface PostcardFarmMailerActionRow {
  id: string
  action_type: 'content:postcard_mailer'
  target: string                      // e.g. "mls:220189422"
  assigned_producer: 'social_media_skills/postcard-farm-mailer'
  payload: PostcardFarmMailerPayload
  data_evidence: {
    audit_source?: string             // e.g. "listing_status_watcher"
    opportunity_area?: string         // e.g. "farm:nw-crossing"
    signal_evidence?: string          // e.g. "MLS 220189422 transitioned to Active 2026-05-14"
  }
  generation_reason: string
  status: 'pending'
}
```

---

## 4. The recipe

**Step 1.  Read the action row.**
Query `marketing_brain_actions` by `id`. Confirm `status='pending'`. Immediately UPDATE
`status='in_production'` and `executed_at=now()`.

```sql
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<action_id>' AND status='pending';
```

**Step 2.  Load mandatory references.** Per §1.

**Step 3.  Pull and verify the listing record (live Supabase, this session).**

```sql
SELECT "MlsId", "StreetNumber", "StreetName", "City", "PostalCode",
       "ListPrice", "ClosePrice", "CloseDate", "StandardStatus",
       "CumulativeDaysOnMarket", "BedroomsTotal", "BathroomsTotal",
       "TotalLivingAreaSqFt", "Latitude", "Longitude", "PhotoURL",
       "ListAgentFullName", "ListAgentEmail", "SubdivisionName"
FROM listings
WHERE "MlsId" = '<mls_id>'
LIMIT 1;
```

Verify:
- Row exists. If not → surface to caller, set `status='killed'`.
- For `at_sold`: `"StandardStatus"` is `'Closed'` and `"ClosePrice"` is non-null. If missing
  → surface to caller; do not invent a sold price.
- For `at_list`: `"StandardStatus"` is `'Active'` (or `'Coming Soon'`). If missing →
  surface to caller.
- `"Latitude"` and `"Longitude"` are present and finite (PostGIS radius query needs them).
- `"ListAgentEmail"` resolves to one of three brokers (matt-ryan / paul-stevenson /
  rebecca-peterson). If not, surface.  never substitute.

**Step 4.  Compute derived figures.**

For `at_sold`:
- `sale_to_list_pct = round(("ClosePrice" / "ListPrice") * 100, 1)`.
- `dom_total = "CumulativeDaysOnMarket"`.
- Round `"ClosePrice"` to nearest $1,000 for display.

For `at_list`:
- Round `"ListPrice"` to nearest $1,000 for display.

Every derived figure must show its computation in citations.json (raw query result + formula).

**Step 5.  Generate the mailing list (PostGIS radius query).**

`mailing_radius_miles` defaults to `0.5`. Convert to meters: `radius_m = miles * 1609.344`.

```sql
SELECT address, city, state, zip, latitude, longitude
FROM parcels                              -- or whatever address table is wired in
WHERE ST_DWithin(
  ST_Transform(geom, 3857),
  ST_Transform(
    ST_SetSRID(ST_MakePoint(<listing_lng>, <listing_lat>), 4326),
    3857
  ),
  <radius_m>
)
  AND mailing_eligible = true             -- skip vacant, business-only, etc.
ORDER BY ST_Distance(
  geom,
  ST_SetSRID(ST_MakePoint(<listing_lng>, <listing_lat>), 4326)
)
LIMIT 2000;
```

If the parcels table isn't wired, fall back to a geocoding-service radius query (see §5
Tools used).  document the source in citations.json under a top-level `mailing_list` key.

NCOA-compliant address normalization runs as a post-step if the brokerage's USPS NCOA
subscription is active (env var `USPS_NCOA_ENABLED=true`). Otherwise skip and flag in
the surface format.

Write `out/postcard/<slug>/mailing-list.csv` with the header `address,city,state,zip`.

If the radius query returns 0 rows → surface to caller (Failure §9). Do not render the
postcard for a mailing list of zero.

**Step 6.  Resolve assets.**

| Asset | Path |
|---|---|
| Heritage wordmark | `design_system/ryan-realty/assets/brand/logo-blue.png` |
| Hero exterior photo | First exterior shot from `"PhotoURL"` array (front elevation if discoverable) |
| Listing-agent headshot | `design_system/ryan-realty/assets/team/<slug>.png` (transparent.  for back side) |
| Fonts | `design_system/ryan-realty/fonts/Amboqia_Boriango.otf`, Geist via next/font |

If any required asset is missing on disk: stop, surface to caller, do not substitute.

**Step 7.  Generate the QR code.**

QR target URL: `https://ryan-realty.com/listing/<mls_id>?utm_source=postcard&utm_medium=mail&utm_campaign=<postcard_moment>_<slug>`.

QR rendered at 300×300 px, ECC level M (15% error correction.  survives postal handling),
black on cream `#faf8f4` background, no logo overlay, no rounded modules (compatibility >
prettiness for print scanning).

Save to `out/postcard/<slug>/qr.png`.

**Step 8.  Build the front PDF.**

See §6 Front design spec for full layout coordinates. Render via the compositor script
(see §5 Tools). Output: `out/postcard/<slug>/<moment>-front.pdf` + `<moment>-front.png`
(digital proof, same pixel canvas exported as PNG).

**Step 9.  Build the back PDF.**

See §7 Back design spec. Reserve the USPS-compliant address block area and Imb barcode
clear zone. Output: `out/postcard/<slug>/<moment>-back.pdf` + `<moment>-back.png`.

**Step 10.  Write citations.json.**

One entry per figure shown on the front or back, plus a `mailing_list` block with the
PostGIS query and row count.

```json
{
  "figures": [
    {
      "figure": "$895,000",
      "source": "Supabase listings",
      "filter": "MlsId='220189422'",
      "column": "ListPrice",
      "value": 895000,
      "fetched_at": "2026-05-14T14:32:00Z"
    },
    {
      "figure": "98.5% of list",
      "source": "Supabase listings",
      "filter": "MlsId='220189422'",
      "computation": "round((ClosePrice / ListPrice) * 100, 1)",
      "raw": {"ClosePrice": 882000, "ListPrice": 895000},
      "value": 98.5,
      "fetched_at": "2026-05-14T14:32:00Z"
    }
  ],
  "mailing_list": {
    "source": "Supabase parcels (PostGIS ST_DWithin)",
    "center_lat": 44.0521,
    "center_lng": -121.3153,
    "radius_miles": 0.5,
    "row_count": 487,
    "ncoa_normalized": false,
    "fetched_at": "2026-05-14T14:32:00Z"
  }
}
```

**Step 11.  Run the QA gate.** See §8. Write `out/postcard/<slug>/design_scorecard.json`.

**Step 12.  UPDATE the action row.**

```sql
UPDATE marketing_brain_actions
SET status='ready',
    executor_response='{
      "draft_path": "out/postcard/<slug>/",
      "front_pdf": "out/postcard/<slug>/<moment>-front.pdf",
      "back_pdf": "out/postcard/<slug>/<moment>-back.pdf",
      "mailing_list_count": <count>,
      "scorecard": {...}
    }'::jsonb
WHERE id='<action_id>';
```

**Step 13.  Surface draft to Matt.** Per §6 surface format. Stop. Wait for explicit approval.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | listing pull + action row updates | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Spark MLS API | listing fallback if Supabase row is stale | `SPARK_API_BASE_URL`, `SPARK_API_KEY` |
| PostGIS (Supabase) | radius query against `parcels` (or fallback geocoder) | same Supabase creds |
| Geocoding fallback | radius if `parcels` table absent | TBD.  Google Geocoding or Mapbox (env: `GEOCODER_API_KEY`) |
| USPS NCOA | address normalization (optional) | `USPS_NCOA_API_KEY`, `USPS_NCOA_ENABLED` |
| QR codegen | property page QR | `node lib/qr-generate.mjs` (build if absent.  uses `qrcode` npm package) |
| Compositor | PDF + PNG render at 300dpi | `node lib/render-postcard.mjs` (build if absent.  same canvas/fonts pipeline as `lib/render-just-listed-flyer.mjs` per `flyer-design/SKILL.md`) |
| Heritage wordmark | brand stamp | `design_system/ryan-realty/assets/brand/logo-blue.png` |
| Listing-agent headshot | back-side credit | `design_system/ryan-realty/assets/team/<slug>.png` |

---

## 6. Front design spec

**Canvas (6×9 portrait, default).** `1800 × 2700 px` at 300dpi. Bleed `0.125"` (38 px) on
every side; trim is the 1800×2700 box. Safe zone is `0.25"` (75 px) inset from trim.

**Canvas (4×6 portrait, alternate).** `1200 × 1800 px` at 300dpi. Bleed 38 px. Safe zone 75 px.

All coordinates below are for 6×9. The compositor scales proportionally for 4×6.

### Layout (6×9, top to bottom)

| Block | Y range | Spec |
|---|---|---|
| **Hero photo** | `y = 0 → y = 1620` (top 60%) | `object-fit: cover`, 1.15 zoom on the structure. Bleeds full-width. Source: first exterior from `"PhotoURL"`. |
| **Heritage wordmark** | `x = 1500 → x = 1700, y = 60 → y = ~140` | `logo-blue.png` 200 px wide (or `logo-white.png` 200 px wide if the hero photo is light-dominant at top-right.  auto-detect via luminance sample). |
| **Headline** | `y = 1700 → y = 1820` | Amboqia Boriango, 96 px, navy `#102742` on cream `#faf8f4`, line-height 1.05, left-aligned at `x = 75`. **at_list:** `Just listed on <street name>.` **at_sold:** `Sold on <street name>.` NO address number.  neighbors already know which house. |
| **Price line** | `y = 1860 → y = 1940` | Amboqia Boriango, 56 px, navy, tabular-nums, left-aligned at `x = 75`. **at_list:** `$895,000` (rounded). **at_sold:** `$<sold_price>` (rounded). |
| **at_sold subline** | `y = 1960 → y = 2010` | Geist 500, 28 px, navy 0.75 opacity, tabular-nums. Format: `98.5% of list  ·  38 days`. (Skipped on at_list.) |
| **CTA line (at_sold)** | `y = 2200 → y = 2300` | Geist 500, 32 px, navy. `Curious what your home is worth?` |
| **QR code** | `x = 1400 → x = 1700, y = 2280 → y = 2580` | 300 × 300 px, black on cream, ECC level M. Scans to `ryan-realty.com/listing/<mls_id>?utm_source=postcard&...`. |
| **Bottom strip.  phone + web** | `y = 2600 → y = 2640` | Geist 500, 24 px, navy, tabular-nums, centered. Format: `541.213.6706  ·  ryan-realty.com`. |

Background: cream `#faf8f4` fills any area not covered by the hero photo. No gradient. No
texture. No drop shadow on the wordmark. No drop shadow on the QR.

### Headline rules

- **No address number on the front.** "Just listed on NW Riverview Drive.".  not "1234 NW
  Riverview Drive." Neighbors know the house from the photo + street name.
- **Sentence case + period.** Not "JUST LISTED" or "Just Listed!".  declarative.
- **No exclamation marks anywhere on the postcard.**
- **No "stunning," "must-see," "won't last," "hidden gem,"** any banned-vocab union word.
  See `marketing_brain_skills/brand-voice/voice_guidelines.md`.

---

## 7. Back design spec

**Canvas (6×9 portrait.  USPS standard layout).** Same `1800 × 2700 px` at 300dpi.
Address-block side per USPS Domestic Mail Manual section 202.4. Reference: USPS Form 3602-R.

### Layout (6×9, top to bottom)

| Block | Y range | Spec |
|---|---|---|
| **Indicia placeholder** | `x = 1430 → x = 1730, y = 75 → y = 285` | Geist 500, 22 px, navy, right-aligned, 4-line block: `FIRST-CLASS MAIL` / `US POSTAGE PAID` / `PERMIT NO. XXXX` / `BEND OR`. Replace `XXXX` with active permit number at print time (TBD.  flagged in surface format if missing). |
| **Return address** | `x = 75 → x = 700, y = 75 → y = 280` | Geist 500, 22 px, navy, left-aligned, 4-line block: `Ryan Realty` / `<office street>` / `Bend, OR 97701` / blank or website. Office street pulled from `app_config.ryan_realty_office_address` (Supabase). |
| **Heritage wordmark** | `x = 75 → x = 350, y = 320 → y = 410` | `logo-blue.png` 280 px wide. |
| **Listing-agent headshot** | `x = 400 → x = 540, y = 320 → y = 460` | `assets/team/<slug>.png` (transparent), 140 px wide, vertically centered next to the wordmark. |
| **Agent name + role** | `x = 560 → x = 1100, y = 340 → y = 440` | Geist 500, 26 px, navy, two lines: `<Full Name>` / `Principal Broker` (or `Broker`). |
| **Ask copy block** | `x = 75 → x = 1100, y = 540 → y = 940` | Amboqia Boriango, 48 px, navy, line-height 1.15. **at_list:** `Your neighbor's home just hit the market. Curious what yours is worth? Scan or call us.` **at_sold:** `Your neighbor's home just sold for $<sold_price>. Curious what yours is worth? Scan or call us.` |
| **FUB-tracked phone CTA** | `x = 75 → x = 1100, y = 980 → y = 1040` | Geist 500, 36 px, navy, tabular-nums. Format: `541.703.3095  ·  ryan-realty.com`. **MUST be the FUB-tracked phone, NOT the direct `541.213.6706`.** This is an inbound-lead surface. |
| **USPS address-block clear zone** | `x = 900 → x = 1700, y = 1700 → y = 2200` | **RESERVED.  no graphics, no text, no background fill other than cream.** This is the recipient address area; the mail house prints into it. Must be at least 4 5/8 × 1 7/8 inches (1387 × 562 px at 300dpi). 6×9 has room; 4×6 is tighter. |
| **IMb barcode clear zone** | `x = 900 → x = 1700, y = 2220 → y = 2440` | **RESERVED.  no graphics.** Intelligent Mail barcode space per USPS DMM 708.4.0. Min 4 5/8 × 5/8 inches. |
| **Bottom border** | `y = 2640 → y = 2680` | Hairline navy rule, 2 px tall, full width minus 75 px insets, 0.85 opacity. Aesthetic only. |

### Back-side rules

- **Phone discipline.** Direct phone `541.213.6706` is used on the FRONT only. The BACK uses
  the FUB-tracked `541.703.3095` because the back is the inbound-CTA surface.  calls must
  route through Follow Up Boss for attribution.
- **No banned vocab.** "Curious," "scan," "call us".  neighbor-tone. Not "Don't miss out,"
  "Act fast," "Find out today!"
- **Indicia is a placeholder.** Real permit number comes from the mail house. If unset,
  surface the missing field to Matt.
- **Address-block clear zone is sacred.** Nothing in that rectangle. The USPS automated mail
  sorter reads it.

---

## 8. QA gate

Run before surfacing the draft. Write results to `out/postcard/<slug>/design_scorecard.json`.
Any `fail` = non-ship.

| # | Check | Pass condition |
|---|---|---|
| 1 | Canvas dimensions | Exactly 1800×2700 (6×9) or 1200×1800 (4×6) at 300dpi |
| 2 | Bleed | 38 px (0.125") bleed on every side, trim marks on the PDF |
| 3 | Safe zone | All critical content within 75 px (0.25") of trim |
| 4 | USPS address-block clear zone | The reserved rectangle (back side) is empty of all graphics |
| 5 | IMb barcode clear zone | Reserved rectangle is empty |
| 6 | Indicia present | Indicia block in correct location (top-right of back), permit number set OR flagged missing |
| 7 | Return address present | Ryan Realty + office street + city/state/zip on back top-left |
| 8 | Front wordmark | `logo-blue.png` (or `logo-white.png` if photo is light-dominant) at 200 px wide top-right |
| 9 | QR scans | Decode QR with a QR reader; URL matches `ryan-realty.com/listing/<mls_id>?utm_source=postcard&...` |
| 10 | Phone discipline | Front uses `541.213.6706` (direct). Back uses `541.703.3095` (FUB-tracked). Never reversed |
| 11 | Headline format | Sentence case, ends with period, no exclamation, no address number |
| 12 | Banned vocab clean | Grep all on-canvas text against voice_guidelines.md §6 union.  zero hits |
| 13 | Data verified | Every figure traces to `citations.json` with source/filter/value/fetched_at |
| 14 | Sold variant has sold_price | If `postcard_moment='at_sold'`, `"ClosePrice"` is non-null in source |
| 15 | Font integrity | Amboqia Boriango + Geist loaded from disk; no system fallback in render |
| 16 | Color compliance | Navy `#102742` + cream `#faf8f4` only. No gold. No off-brand hex |
| 17 | Photo integrity | Hero photo is from MLS / approved source; traced in `provenance.json`; no AI generation; no watermarks |
| 18 | Tabular numerals | Every price / pct / day count uses tabular-nums |
| 19 | Mailing list count | >= 50 addresses (else surface for radius adjustment) |
| 20 | File size | Each PDF < 25 MB (USPS DM upload tolerance) |

If S14 fails (sold variant missing ClosePrice), stop and surface.  never invent a sold price.

---

## 9. Output format

**Draft lands at:** `out/postcard/<slug>/`

**Slug convention:** `<mls_id>-<postcard_moment>` (e.g. `220189422-at_list`).

```
out/postcard/<slug>/
├── payload.json                       ← the action row's payload field
├── <moment>-front.pdf                 ← print-ready front (300dpi, CMYK, with bleed + trim marks)
├── <moment>-back.pdf                  ← print-ready back
├── <moment>-front.png                 ← digital proof (1800×2700 sRGB PNG)
├── <moment>-back.png                  ← digital proof
├── qr.png                             ← 300×300 QR
├── mailing-list.csv                   ← geocoded addresses within radius
├── citations.json                     ← one entry per figure + mailing_list block
├── provenance.json                    ← photo source + license
├── fonts_used.json                    ← exact font files embedded in PDFs
└── design_scorecard.json              ← QA gate results
```

### Surface format (present to Matt exactly like this)

```
Postcard ready for review.  <postcard_moment> · <street name>

  FRONT
    Path: out/postcard/<slug>/<moment>-front.pdf
    Proof: out/postcard/<slug>/<moment>-front.png
    Size: <6x9 | 4x6> · 300dpi · bleed 0.125"

  BACK
    Path: out/postcard/<slug>/<moment>-back.pdf
    Proof: out/postcard/<slug>/<moment>-back.png

  MAILING LIST
    Path: out/postcard/<slug>/mailing-list.csv
    Radius: 0.5 miles
    Center: <lat>, <lng>
    Addresses: <count>
    NCOA normalized: <true | false (flag if subscription off)>

  VERIFICATION TRACE
    - $895,000.  Supabase listings, MlsId='220189422', column ListPrice, fetched 2026-05-14T14:32:00Z
    - 98.5% of list.  derived (ClosePrice 882000 / ListPrice 895000), fetched 2026-05-14T14:32:00Z
    - 38 days.  Supabase listings, column CumulativeDaysOnMarket, fetched 2026-05-14T14:32:00Z

  citations.json: out/postcard/<slug>/citations.json
  scorecard.json: out/postcard/<slug>/design_scorecard.json

  PRINT ORDER (pending approval): not placed
  PERMIT NUMBER: <set | MISSING.  flag>

Reply "ship it" / "approved" / "go" to commit + push and queue the print order.
```

Then stop. Do not commit. Do not push. Do not place the print order. Wait for explicit approval.

---

## 10. Approval gate

`matt-review-draft`.  Matt sees the front + back PDFs, the digital proofs, the mailing-list
count, and the verification trace; replies "ship it" / "approved" / "go" before any commit,
publish, or print order.

Per CLAUDE.md §0.5: silence is not approval. A passing QA gate is not approval. A successful
render is not approval.

---

## 11. Status flow

```
     pending
        │ producer picks up row
        ▼
  in_production   ← executed_at = now()
        │ draft complete, QA passed
        ▼
      ready        ← executor_response populated with draft_path + mailing_list_count + scorecard
        │ Matt says "ship it"
        ▼
    approved       ← approved_by='matt', approved_at=now()
        │ commit + push of design assets; print order queued separately
        ▼
    executed       ← terminal success for the producer
        │ 48h post-mail-drop
        ▼
    measured       ← performance_loop attaches QR-scan + inbound-call attribution from FUB

    killed         ← terminal failure; set if Matt cancels or QA fails after 2 auto-iterations
```

SQL transitions:

```sql
-- On pickup:
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';

-- On draft ready:
UPDATE marketing_brain_actions
SET status='ready',
    executor_response='{
      "draft_path":"out/postcard/<slug>/",
      "front_pdf":"out/postcard/<slug>/<moment>-front.pdf",
      "back_pdf":"out/postcard/<slug>/<moment>-back.pdf",
      "mailing_list_count":487,
      "scorecard":{}
    }'::jsonb
WHERE id='<id>';

-- On Matt approval:
UPDATE marketing_brain_actions
SET status='approved', approved_by='matt', approved_at=now()
WHERE id='<id>';
```

The print-order step (queuing the PDFs + CSV to the mail house) is a separate `ops:postcard_print_order`
action, dispatched by the orchestrator AFTER `approved`. This producer does not place orders.

---

## 12. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Mailing radius returns 0 addresses | PostGIS query result empty | Surface to Matt with center coords + radius; offer to widen radius or pause. Do not render the postcard. |
| Mailing radius returns < 50 addresses | row_count below threshold | Surface to Matt with count + radius; ask whether to widen or proceed with small cohort. |
| Geocoding service down | Fallback geocoder API 4xx/5xx | Retry once; if still failing, surface the error and the suggested manual fallback. |
| USPS NCOA disabled | `USPS_NCOA_ENABLED=false` or no API key | Skip normalization; flag `ncoa_normalized: false` in surface format and citations. |
| USPS spec check fails | Address-block or IMb clear zone has overlapping content | Stop. Auto-fix by snapping back-side blocks to reserved coordinates. Re-render. Max 2 iterations; then surface. |
| Sold_price missing for at_sold | `"ClosePrice"` null in Supabase row | Stop. Surface to Matt with the row contents. Do NOT invent a sold price. |
| Listing row missing | Supabase query returns 0 rows for `mls_id` | Stop. Set `status='killed'`. Report MLS# and query. |
| List agent not resolved | `"ListAgentEmail"` doesn't map to one of three brokers | Stop. Surface; ask Matt to disambiguate or override. |
| Hero photo missing or non-exterior | `"PhotoURL"` empty or first photo is interior | Surface; offer to fetch from Spark fallback or pause for Matt to pick a photo. |
| AI-generated photo detected | `provenance.json` source flagged AI | Hard fail per ANTI_SLOP_MANIFESTO. Do not render. |
| Banned vocab on canvas | grep hit on headline / ask copy / source line | Stop. Re-write copy. Re-validate. Max 2 iterations; then surface. |
| Permit number missing | `app_config.usps_permit_number` unset | Render with `PERMIT NO. XXXX` placeholder; flag in surface format. Print order cannot proceed until permit is set. |
| Office return address missing | `app_config.ryan_realty_office_address` unset | Stop. Surface; ask Matt to set the value in app_config. |
| Font fallback at render | Amboqia or Geist not on disk | Stop. Report missing file. Do not ship with system fonts. |
| PDF > 25 MB | Render output too large for typical mail-house upload | Re-export at 300dpi with optimized JPEG compression on the hero photo (quality 92). Re-validate size. |

### Open spec questions (resolved at first run; noted here for the record)

- **Permit number.** Held in `app_config.usps_permit_number` (key TBD). If absent at first
  render, producer flags it in the surface format and the print-order action gates on it.
- **Office address source.** Held in `app_config.ryan_realty_office_address`. If absent,
  hard fail per §12.
- **Parcels table.** If `parcels` is not yet wired in Supabase at first run, the producer
  falls back to a third-party geocoding-radius service. The mailing-list source is named
  explicitly in `citations.json` either way.

---

## 13. What not to do

1. **Never invent a sold price.** If `"ClosePrice"` is null, stop and surface. No "approximately."
2. **Never use the direct phone on the back.** Inbound CTAs route through FUB-tracked
   `541.703.3095`. Direct `541.213.6706` is front-side display only.
3. **Never put text in the USPS address-block or IMb clear zones.** The mail sorter reads
   those rectangles.
4. **Never use AI-generated property photos.** Hard fail per ANTI_SLOP_MANIFESTO.
5. **Never re-typeset the wordmark.** Always use the pre-rendered PNG.
6. **Never use exclamation marks** on the front or back.
7. **Never use em-dashes or semicolons** in body copy. (Em-dash is allowed as a no-data
   placeholder, not in display copy.)
8. **Never use gold** (`#D4AF37`, `#C8A864`). Monochrome navy on cream only.
9. **Never include the address number on the front headline.** Neighbors know the house from
   the photo + street name.
10. **Never place a print order without explicit Matt approval.** The producer surfaces and
    waits; the `ops:postcard_print_order` action handles the order, also gated by Matt.
11. **Never substitute the listing-agent headshot for a generic broker photo.** Resolve from
    `"ListAgentEmail"` to the matching `assets/team/<slug>.png`. If unresolved, surface.
12. **Never widen the radius silently.** If the default 0.5 mile cohort is too small,
    surface and ask before widening.

---

## 14. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0.  Data Accuracy (outranks everything)
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last (outranks everything)
- `CLAUDE.md` "Voice + content".  phone discipline (direct vs FUB-tracked)
- `CLAUDE.md` "Supabase listings Schema".  mixed-case quoted columns
- `design_system/ryan-realty/SKILL.md`.  heritage register
- `marketing_brain_skills/brand-voice/voice_guidelines.md`.  banned vocab + tone

**Sibling producers:**
- `social_media_skills/flyer-design/SKILL.md`.  print/digital flyer companion (Just Listed,
  Feature Sheet, Open House)
- `social_media_skills/ig-single-post/SKILL.md`.  S1 Just Listed / S2 Just Sold variant for
  the IG feed
- `social_media_skills/list-kit/SKILL.md`.  at-Active orchestrator (may include this producer
  in a future kit expansion)

**Capabilities used:**
- PostGIS radius query on `parcels` (or geocoder fallback)
- QR codegen via `lib/qr-generate.mjs`
- Compositor via `lib/render-postcard.mjs` (PDF + PNG)

**Downstream actions:**
- `ops:postcard_print_order`.  mail-house upload + print + USPS drop (separate producer, TBD)
- FUB inbound webhook.  calls to `541.703.3095` attributed to this campaign via UTM stamps
  on the QR target URL and the FUB phone-call ingestion pipeline

**Playbooks and pipeline docs:**
- `automation_skills/content_engine/SKILL.md`.  content routing bus
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`.  banned-content gate
- `marketing_brain_skills/producers/TEMPLATE.md`.  producer skeleton
- `marketing_brain_skills/producers/REGISTRY.md`.  Section B row

**External references:**
- USPS Direct Mail design specs (DMM 202.4.  address block; DMM 708.4.0.  IMb barcode)
- USPS Form 3602-R (postage statement reference for permit indicia layout)

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

## Content-producer additional references

- `automation_skills/content_engine/SKILL.md`
- `social_media_skills/platform-best-practices/SKILL.md`
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`
- `video_production_skills/VIRAL_GUARDRAILS.md`
