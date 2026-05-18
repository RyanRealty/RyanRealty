---
name: neighbor-outreach-note
description: >
  Pre-Active handwritten-style outreach producer. Given an MLS# and an expected Active date,
  geocodes the property, finds the 20-40 closest neighbor addresses, drafts a short
  handwritten-style note (~80 words) signed by the listing agent, generates a single-page
  enclosure flyer (heritage register, navy on cream, delegated to flyer-design), and produces
  an Avery 5160 label sheet pre-populated with the neighbor addresses. The message: "You
  probably know someone who wants to live in your neighborhood.  thought you'd want to know
  before we officially hit the market." Activates the neighbor referral loop and drives the
  highest per-contact conversion of any listing-launch action. Use whenever Matt says
  "neighbor outreach note for <address>", "build the neighbor note", "handwritten card for
  the neighbors at <MLS#>", "pre-active neighbor outreach", or "neighbor cards for <listing>".
when_to_use: |
  Trigger when Matt says any of:
  - "neighbor outreach note for <address>"
  - "build the neighbor note"
  - "handwritten card for the neighbors at <MLS#>"
  - "pre-active neighbor outreach"
  - "neighbor cards for <listing>"
  - "do the neighbor mailer for <MLS#>"
  - "20 neighbor cards for <address>"
  - "warm-up the neighbors at <MLS#> before we go active"
action_types:
  - content:neighbor_note
output_type: text
target_platforms: ["email", "agentfire_blog"]
asset_destination: Supabase asset-library bucket + out/proof/<date>/<slug>/
auto_inputs: ["brand voice rules", "market data from Supabase"]
required_inputs: ["topic OR mls_id"]
optional_inputs: ["tone_override", "length_override"]
estimated_runtime_min: 8
cost_usd_estimate: $0.10-$0.50 per piece (Anthropic tokens for drafting + voice check)
thumbnail_uri: out/proof/2026-05-17/exemplars/<slug>/sample.html
example_outputs: []
    label: "past approved drafts"
    surface: "email"
---

# Neighbor Outreach Note.  Pre-Active Handwritten Card + Flyer

**Status:** Canonical  
**Locked:** 2026-05-17  


**Scope.** Pre-Active producer. One MLS# and one expected Active date in → one printable card,
one enclosure flyer, one geocoded address list, and one Avery 5160 label template out. Delivered
to the listing agent 2-3 days before MLS Active. Activates the neighbor referral loop
(neighbors know relocation-motivated contacts), the highest per-contact conversion action in
the listing-launch playbook. Does NOT mail anything itself.  the listing agent prints, addresses,
hand-signs (or hand-writes), and drops at the post office or walks the block. The producer's
job ends at "Matt approves the draft package."

**Status.** Canonical. Locked 2026-05-14.

**Producer category.** Section B.  Content Producer.

**Exemplar output:** `out/neighbor-note/<slug>/`

---

## 1. Required references

| Reference | Why |
|---|---|
| `CLAUDE.md` §0.  Data Accuracy | All numbers trace to live Supabase. Outranks every other rule. |
| `CLAUDE.md` §0.5.  Draft-First, Commit-Last | Render to `out/`, surface, wait for approval. Outranks every other rule. |
| `CLAUDE.md` "Voice + content" | Voice rules; FUB-tracked bio phone `541.703.3095`; banned vocab. |
| `design_system/ryan-realty/SKILL.md` | Heritage register, navy `#102742` on cream `#faf8f4`, Amboqia/Geist, headshots. |
| `design_system/ryan-realty/colors_and_type.css` | Authoritative color + type tokens. |
| `marketing_brain_skills/brand-voice/voice_guidelines.md` | Banned vocab union; voice attributes. |
| `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` | Matt's writing fingerprint. |
| `social_media_skills/flyer-design/SKILL.md` | Delegated enclosure flyer render. |
| `automation_skills/content_engine/SKILL.md` | Content routing bus. Never bypass. |
| `video_production_skills/ANTI_SLOP_MANIFESTO.md` | Banned-content gate. |
| `marketing_brain_skills/producers/TEMPLATE.md` + `REGISTRY.md` | Producer skeleton + Section B row. |

---

## 2. Action types handled

| action_type | required payload fields | notes |
|---|---|---|
| `content:neighbor_note` | `mls_id`, `expected_active_date_iso` | One call → one full draft package (note text, flyer PDF, flyer PNG, address CSV, label PDF, citations) |

### Payload schema

```typescript
interface NeighborOutreachNotePayload {
  mls_id: string                      // Required. The "MlsId" value from listings table
  expected_active_date_iso: string    // Required. ISO 8601 date when listing goes MLS Active (e.g. "2026-05-17"). Note copy references this
  custom_message?: string             // Optional. Overrides default body. Validated against banned vocab before use
  neighbor_count?: number             // Optional. Range 20-40. Default 30. Producer pulls the N closest addresses by distance_meters
}
```

The brain populates `payload` when it writes the action row. For manual invocations via
`marketing_brain_skills/produce/SKILL.md`, Matt names the address or MLS# and the active
date in plain English; the produce skill parses these fields.

---

## 3. Brief payload schema

The row this producer reads from `marketing_brain_actions`:

```typescript
interface NeighborOutreachNoteActionRow {
  id: string
  action_type: 'content:neighbor_note'
  target: string                                            // 'mls:<MlsId>' or 'address:<slug>'
  assigned_producer: 'social_media_skills/neighbor-outreach-note'
  payload: NeighborOutreachNotePayload
  data_evidence: { audit_source?: string; days_to_active?: number }
  generation_reason: string
  status: 'pending'
}
```

---

## 4. The recipe

### Step 1.  Read the action row, load refs, validate payload

Query `marketing_brain_actions` by `id`. Confirm `status='pending'`. Immediately UPDATE to
`status='in_production'`, `executed_at=now()` (see §8 SQL). Open the references in §1.  CLAUDE.md
§0 and §0.5 are ship-blockers.

Validate payload:

- `mls_id` present, non-empty.
- `expected_active_date_iso` parses as a real ISO date AND is in the future. Past → surface
  (note copy references it as upcoming).
- `neighbor_count` (if provided) in `[20, 40]`. Out of range → surface.
- `custom_message` (if provided) passes banned-vocab grep BEFORE any render. Hit → surface
  offending words.

### Step 2.  Pull and verify the listing record

Single Supabase query against `listings`. Mixed-case columns double-quoted per CLAUDE.md schema
rules:

```sql
SELECT
  "MlsId",
  "StreetNumber", "StreetName", "City", "PostalCode",
  "ListPrice",
  "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt", "LotSizeAcres",
  "Latitude", "Longitude",
  "StandardStatus",
  "ListAgentFullName", "ListAgentEmail",
  "SubdivisionName"
FROM listings
WHERE "MlsId" = '<mls_id>'
LIMIT 1;
```

Hard checks: exactly 1 row returned; `"Latitude"` + `"Longitude"` non-null (else cannot geocode
neighbors); `"ListAgentFullName"` non-null (else cannot sign). Any miss → surface to Matt.

**Verification trace.** One line per figure that will appear on the flyer or note.  e.g.
`$849,000 ListPrice.  Supabase listings, MlsId='220189422', fetched 2026-05-14T14:32Z, 1 row`.
Every figure also goes into `citations.json` (Step 8).

### Step 3.  Resolve the listing agent

Map `"ListAgentFullName"` (`"ListAgentEmail"` as tiebreaker) to one of: `matt-ryan` (Matt Ryan,
Owner / Principal Broker), `paul-stevenson` (Paul Stevenson, Broker), `rebecca-peterson`
(Rebecca Peterson, Broker). First name → note sign-off; transparent PNG at
`design_system/ryan-realty/assets/team/<slug>.png` → flyer enclosure.

Unresolved → surface raw `"ListAgentFullName"`; ask Matt to map, or confirm the listing is
non-Ryan-Realty (in which case stop).

### Step 4.  Build the neighbor address list

Find the N closest residential addresses around `(Latitude, Longitude)` where `N = neighbor_count`
(default 30, range 20-40). The `listings` table is not a parcel database.  use these sources, in
priority order:

1. **Supabase `parcels` table** (if present in `dwvlophlbvvygjfxcrhm` for the listing's county).
   Bounding box ~0.5 mile, compute haversine, sort ascending, take closest N.
2. **Deschutes County GIS API** (Bend / Redmond / Sisters / La Pine). Bounding-box query
   returns address + lat/lng per parcel. Same sort + take-N.
3. **County parcel shapefile** as a last resort.

If none resolve N ≥ 20, surface to Matt with the count found and offer: (a) accept fewer
(down to 15 floor), (b) widen radius (1 mile cap), (c) pause. Never auto-pad.

For each neighbor capture `address, city, state, zip, distance_meters` (haversine, nearest
integer meter). **Self-exclude the subject**.  exact address match AND distance < 5 m as
belt-and-suspenders. **De-duplicate** multi-unit parcels by mailing address (keep first).

Write to `out/neighbor-note/<slug>/address-list.csv` with header
`address,city,state,zip,distance_meters`, UTF-8, no BOM, LF line endings, rows sorted ascending
by `distance_meters`.

### Step 5.  Draft the note text

Build the handwritten-style card text. Target: **~80 words max**, conversational, signed by the
listing agent's first name.

**Default template** (used if `custom_message` is not provided):

```
Hi neighbor. 

We're listing <StreetName> in a few days. You probably know someone who wants
to live in your neighborhood.  thought you'd want to know before we officially
hit the market.

The home is <N> bedrooms, <N> baths, <sqft_or_acres>, listed at $<price>.

If you (or anyone you know) want a private look before <expected_active_date_pretty>,
give us a call. <ListAgentFirstName>, Ryan Realty
   541.703.3095
```

Substitutions:

- `<StreetName>`.  `"StreetName"` only (strip the number; neighbors know which house).
- `<N> bedrooms, <N> baths`.  `"BedroomsTotal"` / `"BathroomsTotal"`. Null → omit that fragment
  cleanly (no em-dash placeholder in body).
- `<sqft_or_acres>`.  if `"LotSizeAcres" >= 1`, use acres (e.g. "12 acres"); else
  `"TotalLivingAreaSqFt"` as `1,847 sqft`. Both null → omit.
- `<price>`.  `"ListPrice"` rounded to nearest thousand: `$849,000`.
- `<expected_active_date_pretty>`.  `<Month> <day>` (e.g. "May 17"). No year if same year.
- `<ListAgentFirstName>`.  resolved listing agent (Step 3).

**Phone.** FUB-tracked bio phone `541.703.3095` only.  this note IS a lead-capture surface, so
calls route through Follow Up Boss for attribution.

**Voice rules (HARD).** Warm but specific.  sounds genuinely written, not "marketing." "We"
for brokerage voice (never "I" except in a Matt-authored `custom_message`). Zero exclamation
marks, em-dashes in body (single greeting em-dash allowed), semicolons, or dramatic colons.
Zero hits against the banned vocab union in `voice_guidelines.md` §6 (clichés, AI filler,
hedging, brand-corrosive phrases). Never "off-market".  use "before we officially hit the
market" (MLS Clear Cooperation). Zero Fair Housing trip phrases ("great for families," "young
professionals," "walkable to your church," "adult neighborhood," etc.).

Write the rendered note to `out/neighbor-note/<slug>/note-text.md` with leading frontmatter
recording `mls_id`, `list_agent_first_name`, `expected_active_date_iso`,
`expected_active_date_pretty`, `word_count`, `generated_at`. (See § 6 Draft surface for the
fully rendered example.)

Verify `50 <= word_count <= 90`. Outside that band → surface for review (too short reads as a
flyer; too long stops feeling handwritten).

### Step 6.  Build the enclosure flyer

Delegate to `social_media_skills/flyer-design/SKILL.md` with the **neighbor-note enclosure**
variant. Specs:

- **Format:** 8.5 × 11 in portrait, single page, 300 DPI CMYK print PDF; 1080 × 1400 sRGB PNG
  digital proof.
- **Register:** Heritage.  navy `#102742` on cream `#faf8f4`. No gold. Amboqia Boriango display,
  Geist body. No Azo Sans Medium eyebrows (this is "neighborhood resource" voice, not "FOR
  SALE" signage).
- **Top third:** Exterior hero from `"PhotoURL"`. 14 px corner radius, 0.25 in bleed.
- **Middle:** Address (Amboqia 40 pt: street line 1, city/state/zip line 2). Price `$849,000`
  (Amboqia 56 pt, tabular-nums, navy). Specs row `3 bd · 2 ba · 1,847 sqft` (Geist 500 18 pt,
  tabular-nums, middle-dot separators).
- **Lower-middle:** Context paragraph (Geist 400 14 pt navy): "Coming to the market <Month>
  <day>. If you know someone who's been waiting for the right place in <SubdivisionName or
  City>, we'd love to introduce them." Same banned-vocab grep as the note.
- **Bottom band:** Listing agent's transparent headshot (100 px circular crop) left; name +
  role (Geist 500 14 pt) center; `541.703.3095` + `ryan-realty.com` right.
- **QR code:** 120 × 120 px navy-on-cream ECC-M to `https://ryan-realty.com/listings/<mls_id>`,
  bottom-right above the agent footer. URL reachability verified BEFORE rendering.  dead-link
  QR = non-ship.
- **Heritage wordmark:** `design_system/ryan-realty/assets/brand/logo-blue.png` (pre-rendered
  image, never re-typeset), 120 px wide, top-left, 30 px inset.

Outputs: `flyer.pdf` + `flyer.png`. Sub-skill writes `design_review_checklist.json`; copy into
`out/neighbor-note/<slug>/`.

### Step 7.  Generate the Avery 5160 label template

5160 layout: 30 labels per US Letter, 3 across × 10 down, 1 × 2⅝ in per label, 0.5 in top/bottom
margin, 0.1875 in side margin, 0.125 in row gap, 0.1875 in column gap. Per row in
`address-list.csv`: line 1 `<address>` (Geist 500 10 pt navy); line 2 `<city>, <state> <zip>`
(Geist 400 10 pt navy). Pagination: ≤ 30 → 1 sheet (remaining cells blank); 30-40 → 2 sheets.
Return-address sheet OFF by default; ON only if `custom_message` contains the literal flag
"include return address." Output: `envelope-label-template.pdf`.

### Step 8.  Write citations.json

One entry per figure that appears in the note, flyer, or label sheet. Write to
`citations.json`. Schema: `{ figures: [{ figure, source, filter, column?, value, fetched_at }] }`.
Sources are `"Supabase listings"` (with `MlsId` filter + column name), `"Deschutes County GIS"`
(bbox filter), or `"payload.<field>"` for fields like `expected_active_date_iso`.

### Step 9.  Run the QA gate and surface

Run all checks in §8. Any failure → halt and surface to Matt with the specific reason. Set
`status='ready'` with `executor_response` populated (see §8 SQL block). Present the draft per
§6 surface format. Stop. Wait for explicit "ship it" / "approved" / "go." Do not commit, push,
print, or mail.

### Step 10.  On approval, publish

On approval: move deliverables to `public/marketing-collateral/neighbor-notes/<slug>/` (the
address CSV stays gitignored in `data/neighbor-lists/<slug>/`; it is NEVER committed to a
public path). Set `status='executed'`, `approved_by='matt'`, `approved_at=now()`. Notify the
listing agent (iMessage or Matt-named channel) with the print-ready PDF + label-sheet PDF, one
line: "Drop in mailboxes 2-3 days before <expected_active_date_pretty>."

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | `listings` pull + action row updates | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (project `dwvlophlbvvygjfxcrhm`) |
| Supabase `parcels` OR Deschutes County GIS API | Neighbor address geocoding | `DESCHUTES_GIS_BASE_URL` or SQL against `public.parcels` |
| `social_media_skills/flyer-design` sub-skill | Enclosure flyer render | `npm run flyer:neighbor-note -- --config <flyer-config.json> --out <flyer.png>` |
| QR codec | Property URL → print-ready PNG/SVG | Node `qrcode` or `qrencode` CLI |
| Avery 5160 PDF compositor | Label sheet render | Node `pdfkit` or puppeteer HTML template |
| Banned-vocab + FH validator | Pre-render grep | `scripts/check-banned-vocab.mjs` against `voice_guidelines.md` §6 union |

---

## 6. Output format

**Draft lands at:** `out/neighbor-note/<slug>/`

**File structure:**

```
out/neighbor-note/<slug>/
├── note-text.md                    ← exact text to be handwritten or letterhead-printed
├── flyer.pdf                       ← print-ready 1-page flyer enclosure (US Letter, CMYK)
├── flyer.png                       ← digital proof, 1080 × 1400, sRGB
├── flyer-config.json               ← config passed to flyer-design sub-skill
├── address-list.csv                ← geocoded list of 20-40 nearest addresses
├── envelope-label-template.pdf     ← Avery 5160 layout, pre-populated
├── citations.json                  ← one entry per figure
├── design_review_checklist.json    ← copied from flyer-design sub-skill output
└── qa-scorecard.json               ← per §8
```

### Slug

```
<city-lowercase>-<street-number>-<street-name-kebab>
# Example: bend-1234-nw-riverview-dr
```

Same slug pattern used by `list-kit` so the two producers' outputs can co-locate by listing.

### Draft surface format (present to Matt exactly like this)

```
Neighbor outreach note ready for review.  <StreetNumber> <StreetName>, <City>

  NOTE TEXT (~80 words, signed by <ListAgentFirstName>)
    Path: out/neighbor-note/<slug>/note-text.md
    Word count: 78 ✓ (50-90 band)
    Voice check: pass · Phone: 541.703.3095 (FUB-tracked) ✓

    > Hi neighbor.  We're listing NW Riverview Drive in a few days. You
    > probably know someone who wants to live in your neighborhood. 
    > thought you'd want to know before we officially hit the market.
    > The home is 3 bedrooms, 2 baths, 1,847 sqft, listed at $849,000.
    > If you (or anyone you know) want a private look before May 17,
    > give us a call. Matt, Ryan Realty   541.703.3095

  FLYER (US Letter)
    Print PDF:   out/neighbor-note/<slug>/flyer.pdf
    Digital PNG: out/neighbor-note/<slug>/flyer.png
    Heritage register, navy on cream ✓ · QR reachable ✓ · headshot ✓

  NEIGHBOR ADDRESSES
    Count: 30 ✓ (range 20-40, subject parcel excluded)
    CSV: out/neighbor-note/<slug>/address-list.csv
    Avery 5160 PDF: out/neighbor-note/<slug>/envelope-label-template.pdf

  VERIFICATION TRACE (from citations.json)
    - $849,000.  Supabase listings, MlsId='220189422', ListPrice, fetched 2026-05-14T14:32Z
    - 3 bd / 2 ba / 1,847 sqft.  Supabase listings, MlsId='220189422'
    - 30 neighbor addresses.  Deschutes GIS, bbox query, fetched 2026-05-14T14:33Z
    - Expected Active May 17.  payload.expected_active_date_iso

  CITATIONS: out/neighbor-note/<slug>/citations.json

Reply "ship it" to move to public/marketing-collateral/neighbor-notes/<slug>/ and notify
<ListAgentFirstName> with the print-ready PDFs.
```

Then stop. Wait.

---

## 7. Approval gate

**`matt-review-draft`**.  Matt sees the rendered note text + flyer PDF + flyer PNG + address
list + label PDF and says "ship it" / "approved" / "go."

This is a physical send: a wrong address on the label sheet, a typo in the price, or a neighbor
from the wrong subdivision can't be rolled back the way a social post can. Matt audits the
address list and note copy before printing.

---

## 8. Status flow

```
pending → in_production → ready → approved → executed → measured
                                                          │
                       killed ◄──────────────────────────┘  (Matt cancels OR QA fails after 2 auto-iterations)
```

- `pending → in_production` on pickup; `executed_at = now()`.
- `in_production → ready` once note + flyer + addresses + labels + citations are all built and
  QA passes; populate `executor_response` with `draft_path` + scorecard.
- `ready → approved` only on Matt's explicit "ship it" / "approved" / "go."
- `approved → executed` after files move to `public/marketing-collateral/neighbor-notes/<slug>/`
  and the listing agent is notified.
- `executed → measured` after 14 d (FUB inbound calls tagged `neighbor-note-<slug>` write to
  `content_performance`).

SQL transitions:

```sql
UPDATE marketing_brain_actions SET status='in_production', executed_at=now()
  WHERE id='<id>' AND status='pending';

UPDATE marketing_brain_actions SET status='ready',
  executor_response='{"draft_path":"out/neighbor-note/<slug>/","note_word_count":78,"neighbor_count":30,"agent":"matt-ryan","scorecard":{"qa_pass":true}}'::jsonb
  WHERE id='<id>';

UPDATE marketing_brain_actions SET status='approved', approved_by='matt', approved_at=now()
  WHERE id='<id>';

UPDATE marketing_brain_actions SET status='executed' WHERE id='<id>';
```

### QA gate (write results to `out/neighbor-note/<slug>/qa-scorecard.json`)

Any `fail` = non-ship.

| # | Check | Pass condition |
|---|---|---|
| 1 | Address list | `20 <= count <= 40` (or `neighbor_count`), subject parcel excluded, sorted asc by `distance_meters`, CSV header exact `address,city,state,zip,distance_meters` (UTF-8, no BOM) |
| 2 | Note word count | `50 <= count <= 90` |
| 3 | Banned vocab clean | Grep note + flyer copy against `voice_guidelines.md` §6.  zero hits |
| 4 | Punctuation clean | Zero `!`, zero `;`, zero em-dashes in body (single greeting "Hi neighbor. " allowed) |
| 5 | Listing agent | Resolved to `matt-ryan` / `paul-stevenson` / `rebecca-peterson`; headshot PNG on disk |
| 6 | Expected Active in future | `expected_active_date_iso > now()` |
| 7 | Phone is FUB-tracked | Note + flyer footer use `541.703.3095`, never `541.213.6706` |
| 8 | QR target reachable | HTTP HEAD on `https://ryan-realty.com/listings/<mls_id>` returns 200 (or 301→200) |
| 9 | All figures traced | Every number on note or flyer has a row in `citations.json` |
| 10 | Brand compliance | Navy `#102742` + cream `#faf8f4` only (no gold); Amboqia + Geist from disk (no system fallback); flyer uses `logo-blue.png` (not re-typeset) |
| 11 | Fair Housing clean | Note + flyer contain none of: "great for families," "young professionals," "walkable to church," "adult neighborhood," etc. |
| 12 | Label sheet pagination | `count > 30` → 2 pages; `count <= 30` → 1 page; max 2 sheets |

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Listing not found | `WHERE "MlsId"=...` returns 0 rows | Report exact `mls_id`, ask Matt to verify; `status='killed'` if confirmed wrong. |
| Lat/lng null | `"Latitude"` or `"Longitude"` null | Surface row to Matt. Offer: manually geocode via one-shot Google/Mapbox call, or pause. Never estimate. |
| < 20 addresses in radius | Parcels query returns < 20 within bbox | Surface count found. Options: widen to 1 mile cap, accept down to 15 floor, or pause. Never auto-pad. |
| Listing agent unresolved | `"ListAgentFullName"` doesn't match the three brokers | Surface raw value; ask Matt to map, or confirm non-Ryan-Realty (stop). |
| `expected_active_date_iso` in past | Parsed date < today | Surface parsed date; re-prompt for future date. Past date breaks the "before we hit the market" framing. |
| `custom_message` banned vocab | Grep hits in payload | Stop. Surface offending words; offer strip+re-validate or fall back to default template. |
| QR target dead | HTTP HEAD on property URL ≠ 200 | Surface. Options: drop QR (still ship flyer), target a different URL, or pause. |
| Asset missing | Headshot PNG / Amboqia / Geist not on disk | Stop. Report which file. Never substitute stock, AI portrait, or system fonts. |
| `PublicRemarks` banned vocab (if flyer block uses remarks) | Grep hit | Strip offending sentence; if empty, leave description blank.  never paraphrase or invent. |
| Render timeout | Flyer compositor or label PDF generator hangs > 5 min | Kill; report log; retry once; second failure → surface. |
| Missing env var | Supabase URL / service-role key / GIS base URL absent | Report which var. Never guess or hard-code. |
| Subject parcel in CSV | Failsafe distance check fails | Hard halt before write. Re-run with explicit self-exclusion. |
| Open spec question.  print-and-mail vendor integration | n/a | v1 is "Matt gets the print-ready PDFs"; Lob.com / auto-mail is a future `ops:mail-merge` producer, not in scope here. |

---

## 10. Related skills and references

**Required reading:** see §1 (full table). CLAUDE.md §0 + §0.5 outrank everything else.

**Format sub-skill delegated to:** `social_media_skills/flyer-design/SKILL.md`.  enclosure flyer
(neighbor-note variant). Sub-skill owns layout, typography, photo cropping, and
`design_review_checklist`.

**Registry entry:** `marketing_brain_skills/producers/REGISTRY.md`.  Section B (Content
Producer), row `neighbor-outreach-note`.

**Related listing-moment producers (separate triggers):**
`social_media_skills/coming-soon-teaser/` (pre-Active Reel sibling) ·
`social_media_skills/list-kit/` (at-Active full kit, 2-3 days after this note) ·
`social_media_skills/ig-single-post/` S4 Coming Soon (digital sibling) ·
`social_media_skills/under-contract-announcement/` · `social_media_skills/sold-deal-summary/`.

---

## 11. What not to do

1. **Never mail anything.** Terminal state is "Matt has the print-ready PDFs." Physical send is
   the listing agent's job. No Lob.com / print-and-mail vendor integration in v1.
2. **Never include the subject property in the neighbor list.** Hard failsafes: distance < 5 m
   AND exact address match. **Never invent neighbor addresses** to pad to N.  surface the gap.
3. **Never widen the radius silently.** Closest 20 addresses > 0.5 mile out → surface (this
   would mail "neighborhood" outreach across a freeway or river).
4. **Never use `541.213.6706`.** This is a lead-capture surface.  FUB-tracked `541.703.3095`
   only.
5. **Never use exclamation marks, em-dashes in body, or semicolons.** Single greeting em-dash
   "Hi neighbor. " is the one allowance.
6. **Never use "off-market."** Use "before we officially hit the market" (MLS Clear Cooperation).
7. **Never insert Fair Housing trip phrases.** QA #11 catches; never bypass.
8. **Never deviate from brand visuals.** No gold (`#D4AF37`, `#C8A864`); no re-typeset wordmark
   (`logo-blue.png` only); no system-font fallback; no AI-generated property photos (hero comes
   from `"PhotoURL"`; AI fakes are ship-blockers per ANTI_SLOP_MANIFESTO.md).
9. **Never inherit numbers from prior chat, briefs, or other agent sessions.** Pull fresh from
   Supabase this session. Never auto-publish.  approval gate is `matt-review-draft`; silence is
   not approval, a passing QA gate is not approval.

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
