---
name: ops-fb-marketplace
description: >
  Prepares a Facebook Marketplace listing payload (title, description, photos, price, specs,
  location, category mapping) for a given residential listing and stages a copy-paste-ready
  bundle Matt loads into his personal Facebook app. This producer does NOT auto-publish. 
  Facebook Marketplace does not permit programmatic listing creation for residential real
  estate brokers (as of 2026 platform policy). Output is a structured payload + downloaded
  high-quality photos + step-by-step screenshot-ready instructions. Marketplace is the
  highest-volume FREE lead source documented for residential brokers (Shawn Getty reports
  30-40% of business through Marketplace). Use whenever Matt says "fb marketplace for
  <address>", "facebook marketplace listing for <MLS#>", "build the marketplace post for
  <listing>", or "marketplace for the new listing".
when_to_use: |
  Trigger when Matt says any of:
  - "fb marketplace for <address>"
  - "facebook marketplace listing for <MLS#>"
  - "build the marketplace post for <listing>"
  - "marketplace for the new listing"
  - "stage a marketplace listing for <MLS#>"
  - "marketplace bundle for <slug>"
  - "marketplace update for <MLS#>" (post-active edit.  price change, photo refresh)
action_types:
  - ops:fb_marketplace_create
  - ops:fb_marketplace_update
output_type: operational
target_platforms: []
asset_destination: no asset; state mutation only (logged in marketing_decisions)
auto_inputs: ["current campaign/account state"]
required_inputs: ["account_id OR campaign_id"]
optional_inputs: ["budget_delta_pct", "pause_reason"]
estimated_runtime_min: 3
cost_usd_estimate: $0.01-$0.10 per call (mostly API quota; minimal Anthropic)
thumbnail_uri: out/proof/2026-05-17/exemplars/sample.html
example_outputs: []
---

# ops-fb-marketplace.  Facebook Marketplace Listing Producer

**Status:** Canonical  
**Locked:** 2026-05-17  


**Scope.** Stages everything Matt needs to publish a Ryan Realty residential listing on his
personal Facebook Marketplace via the Facebook iOS / Android app. Generates the title,
description, price, photo set (downloaded + resized), category mapping, and a copy-paste-ready
instruction sheet. Producer never touches the Marketplace itself.  Facebook does not permit
programmatic Marketplace listing creation by residential real estate brokers via Graph API.
The deliverable is a staged bundle on disk; Matt does the final 90-second manual upload
through the FB app.

**Status.** Canonical.
**Locked.** 2026-05-14.
**Producer category.** Section D.  Operational Producer.
**Exemplar output:** `out/fb-marketplace/<slug>/` directory with payload, photos, title, description, instructions, citations.

---

## 1. Scope

### In scope

- `ops:fb_marketplace_create`.  first-time stage of a new active or coming-soon listing for FB Marketplace.
- `ops:fb_marketplace_update`.  refresh an already-staged listing after a price change, photo update, or status flip (active → pending → sold). Refresh writes a new bundle alongside the original.
- Pulling the listing record from Supabase (`listings`) and verifying every figure (price, beds, baths, sqft, year built) against the live row before staging.
- Downloading the listing's MLS photos from `PhotoURL`, resizing to FB Marketplace's 1080×1080 max, ordering hero first.
- Stripping `PublicRemarks` of banned vocabulary, em-dashes, semicolons, exclamation marks, and AI filler, then condensing to ≤ 1500 chars.
- Mapping the MLS `PropertyType` to FB Marketplace's residential category tree (`For Sale > Real Estate > Homes for Sale`, `Apartments / Condos for Sale`, `Townhouses for Sale`, `Multi-Family Homes`, `Manufactured / Mobile Homes`, `Land for Sale`).
- Generating step-by-step instructions Matt follows in the FB app.  every tap, every field, in order, with screenshot anchors.
- Updating the `marketing_brain_actions` row through `pending → in_production → ready → approved → executed → measured` per the shared status flow.

### Out of scope

- **Auto-publishing to FB Marketplace.** Not permitted by FB policy for residential brokers.  full stop. If a future Graph API or partner integration opens, the producer adds the call as Step 8.5; until then, manual upload is the only path.
- **Organic FB posts.** Handled by the `publisher` capability in `automation_skills/`.
- **FB Lead Gen ads.** Handled by `social_media_skills/facebook-lead-gen-ad/` + `ops-meta-ads`.
- **IG / TikTok / X captions.** Handled by `ig-single-post` and siblings. Marketplace prose is its own register (no hashtags, no link-in-bio, plain factual).
- **Pricing analysis / CMA.** Producer trusts `ListPrice` from Supabase.
- **Lead capture from inquiries.** Marketplace messages land in Matt's FB Messenger.  `ops-fub-crm` + the Messenger forwarding integration handle inbound leads.

---

## 2. Action types handled

| action_type | required payload fields | notes |
|---|---|---|
| `ops:fb_marketplace_create` | `mls_id` | First-time stage. Producer pulls everything else from Supabase. |
| `ops:fb_marketplace_update` | `mls_id`, `update_reason` (`price_change` \| `photo_refresh` \| `status_change` \| `description_revision`) | Re-stages a previously-staged listing. Old bundle stays on disk; new bundle goes in a sibling `v2/` directory. |

### Payload schema

```typescript
interface FbMarketplacePayload {
  mls_id: string;                     // MLS number, e.g. '220189422'
  category?: string;                  // Default 'For Sale > Real Estate > Homes for Sale'
  make_public?: boolean;              // Default true.  vs 'Friends only'
  update_reason?:                     // ONLY for ops:fb_marketplace_update
    | 'price_change'
    | 'photo_refresh'
    | 'status_change'
    | 'description_revision';
  matt_override_banned_vocab?: boolean; // If true, ship description with one or more
                                        // un-substitutable banned words flagged; Matt
                                        // has explicitly OK'd the exception. Default false.
}
```

The brain populates `payload` when it writes the action row. For manual invocations via
`marketing_brain_skills/produce/SKILL.md`, Matt provides the MLS# in natural language and
`produce` parses it. `make_public` defaults to `true` per Matt's standing direction (every
Ryan Realty Marketplace listing is public so it surfaces to all Marketplace browsers in
Central Oregon, not just Matt's friend graph).

---

## 3. Brief payload schema

```typescript
interface FbMarketplaceActionRow {
  id: string;                       // uuid from marketing_brain_actions
  action_type: 'ops:fb_marketplace_create' | 'ops:fb_marketplace_update';
  target: string;                   // 'mls:<mls_id>'
  assigned_producer: string;        // 'marketing_brain_skills/producers/ops-fb-marketplace'
  payload: FbMarketplacePayload;
  data_evidence: {
    audit_source?: string;          // e.g. 'listing_trigger' or 'manual'
    opportunity_area?: string;      // e.g. 'new active listing.  Marketplace is highest-volume free channel'
    signal_evidence?: string;       // e.g. 'StandardStatus flipped Active 2026-05-14 09:12 UTC'
  };
  generation_reason: string;        // Human-readable why this action exists
  status: 'pending';
}
```

---

## 4. The recipe

### Step 1.  Read the action row and claim it

Query `marketing_brain_actions` by `id`. Confirm `status='pending'`. Immediately transition to
`in_production`:

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<action_id>' AND status = 'pending';
```

If the row is not `status='pending'` (another agent picked it up), halt silently.

### Step 2.  Load mandatory references

Before pulling any data:

- `CLAUDE.md` §0.  Data Accuracy mandate (every figure traces; outranks everything)
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last (Matt sees the bundle before publish)
- `CLAUDE.md` "Voice + content".  voice attributes, banned vocab, phone + web format
- `design_system/ryan-realty/SKILL.md`.  heritage register (the photos and prose carry the brand here; no on-canvas typography)
- `marketing_brain_skills/brand-voice/voice_guidelines.md`.  banned vocab union
- `marketing_brain_skills/brand-voice/corpus/gbp_responses.md`.  Matt's writing fingerprint (Marketplace prose mirrors GBP response register: direct, factual, neutral, no clichés)
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`.  banned content gate
- `marketing_brain_skills/producers/TEMPLATE.md`.  producer skeleton

Note: do NOT load `social_media_skills/platform-best-practices/SKILL.md` for this producer.  that file's IG/TikTok/YouTube rules don't apply to Marketplace, which is a closer-to-Craigslist marketplace format with its own conventions (no hashtags, no emoji, plain prose, photo-first).

### Step 3.  Pull the listing row from Supabase

Mixed-case columns must be double-quoted per CLAUDE.md "Supabase listings Schema":

```sql
SELECT
  "MlsId",
  "StreetNumber",
  "StreetName",
  "City",
  "StateOrProvince",
  "PostalCode",
  "ListPrice",
  "StandardStatus",
  "PropertyType",
  "PropertySubType",
  "BedroomsTotal",
  "BathroomsTotal",
  "TotalLivingAreaSqFt",
  "LotSizeAcres",
  year_built,
  "PublicRemarks",
  "ListAgentFullName",
  "ListAgentEmail",
  "PhotoURL",
  "Latitude",
  "Longitude",
  "SubdivisionName",
  "CumulativeDaysOnMarket",
  price_per_sqft
FROM listings
WHERE "MlsId" = '<mls_id>'
LIMIT 1;
```

If the query returns zero rows: set `status='killed'`, surface "Listing `<mls_id>` not found in Supabase." Stop.

If `StandardStatus` is `'Closed'` or `'Withdrawn'` or `'Expired'`: surface to Matt before proceeding. Marketplace listings for sold / withdrawn properties violate FB Commerce Policy and risk an account-level strike. Default: do not stage. Override requires explicit Matt direction.

### Step 4.  Verify every figure

Per CLAUDE.md §0, every number that lands in the title or description must be re-verified
against the row just pulled.  never inherited from the action row's payload or prior context:

| figure | verified from |
|---|---|
| Beds | `"BedroomsTotal"` |
| Baths | `"BathroomsTotal"` |
| Sqft | `"TotalLivingAreaSqFt"` |
| Lot | `"LotSizeAcres"` (preferred for rural / acreage listings) |
| Year built | `year_built` |
| Price | `"ListPrice"`.  round to nearest $1,000 in display |
| City | `"City"` |
| Neighborhood | `"SubdivisionName"` if present, else city |

If any figure is null when expected (e.g. `BedroomsTotal IS NULL` on a SFR), surface to Matt: figure missing from MLS row. Do not stage with a placeholder. Do not estimate.

### Step 5.  Build the title

Format (under 100 chars.  FB Marketplace truncates aggressively):

```
<Beds>BR/<Bath>BA <Property Type> in <Neighborhood>.  $<price>
```

Note: per banned-punctuation rules in CLAUDE.md, em-dashes (. ) are banned as punctuation in body copy. **The em-dash in the title is an explicit exception** for this producer because FB Marketplace's title parsing benefits from a clean visual break and the title is a single fragment, not body prose. If Matt instructs otherwise, replace with a bullet `·` or pipe `|`.

Examples:
- `3BR/2BA Single Family in Tumalo.  $895,000`
- `2BR/2BA Condo in Old Mill.  $625,000`
- `Acreage Lot in Sisters.  $475,000` (land.  no BR/BA)

Title validation:
- `length(title) ≤ 100`. If `> 100`, drop the neighborhood and use the city instead. If still `> 100`, drop the property type and use only `<beds>BR/<baths>BA in <city>.  $<price>`.
- No banned vocab. No exclamation marks. No emoji.
- Price always rounded to the nearest $1,000.

Property type label mapping from MLS `"PropertyType"` / `"PropertySubType"`:

| MLS type | Title label |
|---|---|
| `Residential` + subtype `Single Family Residence` | `Single Family` |
| `Residential` + subtype `Condominium` | `Condo` |
| `Residential` + subtype `Townhouse` | `Townhouse` |
| `Residential` + subtype `Manufactured Home` | `Manufactured Home` |
| `Residential Income` | `Multi-Family` |
| `Land` | `Acreage Lot` (or `Lot` if `LotSizeAcres < 1`) |

### Step 6.  Build the description (≤ 1500 chars)

Section structure, in order, separated by blank lines:

```
<StreetNumber> <StreetName>
<City>, OR <PostalCode>

<Beds> bed | <Baths> bath | <Sqft> sqft | <Lot> acres | Built <YearBuilt>

<Cleaned PublicRemarks body.  2-3 paragraphs>

Listed by Ryan Realty.
Call 541.213.6706 or visit ryan-realty.com/listings/<slug>.

MLS#: <MlsId>

Equal Housing Opportunity.
Brokerage licensed in Oregon.
```

**Cleaning the PublicRemarks body:**

1. Grep against the banned vocab union from `voice_guidelines.md` §6. Substitution table:

   | Banned | Substitution |
   |---|---|
   | "stunning" / "gorgeous" / "breathtaking" | cut |
   | "boasts" | cut; replace with a specific fact |
   | "charming" / "cozy" / "luxurious" / "must-see" / "nestled" / "turnkey" | cut |
   | "meticulously maintained" | cut; replace with a specific upgrade if MLS lists one |
   | "spacious" | replace with the actual sqft |
   | "modern" (borderline) | cut if no clean substitute, escalate per rule 6 |
   | AI filler ("seamless," "robust," "elevate," etc.) | cut |
   | Em-dashes | period or comma |
   | Semicolons | period |
   | Exclamation marks | period |

2. Strip emoji.
3. Strip phone-number lines other than the canonical Ryan Realty line.
4. Strip URLs other than `ryan-realty.com/listings/<slug>`.
5. If after cleaning the description is `< 400 chars`, append 1-2 sentences pulled from
   data-derived facts (no invention): named amenity walking distance (if MLS `WalkScore`
   evidence or Matt confirms), school district (if `ElementarySchool` / `HighSchool`
   populated), driving distance to downtown Bend (computed from `Latitude` + `Longitude`).
6. If un-substitutable banned word remains and `payload.matt_override_banned_vocab !== true`:
   stop and surface to Matt with the specific word and proposed substitutes.
7. `length(description) ≤ 1500`. If `> 1500`, trim the second body paragraph first, then the
   third. Never trim the contact line or the MLS#.

**Voice:**

- "You/your" addressed at the buyer (per CLAUDE.md voice). "We/our team" for the brokerage. Never "I."
- Sentence case (no Title Case mid-sentence).
- Plain neutral pro tone.  Marketplace audience skews value-conscious; aspirational marketing prose underperforms factual specs. Mirror Matt's GBP-response register.
- No hashtags anywhere.  Marketplace's description doesn't honor them and they look like spam to the audience.
- No "Don't miss out!" / "Won't last!" / "Act fast!" / "Schedule today!" pressure or scarcity framing.
- No emoji.

### Step 7.  Download and resize photos

Source: `"PhotoURL"` column (delimited list of MLS photo URLs).

```bash
mkdir -p out/fb-marketplace/<slug>/photos/
# For each URL in PhotoURL, download then resize:
#   - Max 1080×1080 (FB Marketplace upscales smaller, downscales larger lossy)
#   - JPEG quality 90
#   - Hero photo (first URL) gets filename 01_hero.jpg
#   - Remaining photos numbered 02_*.jpg, 03_*.jpg,...
#   - Max 10 photos (FB Marketplace cap for residential real estate)
```

Use `lib/asset-library.mjs` (per `video_production_skills/asset-library/SKILL.md`) for the download
+ resize pass. Output goes to `out/fb-marketplace/<slug>/photos/` as numbered JPEGs.

**Photo discipline:**

- Hero photo (01) is always the exterior wide angle. If `PhotoURL[0]` is interior, surface to Matt.  MLS uploaded interior-first, which is unusual; confirm hero choice before staging.
- Skip floorplan PNGs, virtual-stage AI composites, and any URL containing `/floorplan/` or `/360/` or `/virtual-tour/`.  FB Marketplace audiences expect real-room photos.
- Skip photos with visible MLS watermarks if `provenance.json` doesn't allow watermarked use (most ORMLS photos are clean).
- If `PhotoURL` returns fewer than 5 usable URLs: surface to Matt. Marketplace listings with < 5 photos chronically underperform; better to wait for the photographer to deliver more.

### Step 8.  Map the FB Marketplace category

```typescript
const categoryMap: Record<string, string> = {
  'Single Family':       'For Sale > Real Estate > Homes for Sale',
  'Condo':               'For Sale > Real Estate > Apartments / Condos for Sale',
  'Townhouse':           'For Sale > Real Estate > Townhouses for Sale',
  'Manufactured Home':   'For Sale > Real Estate > Manufactured / Mobile Homes',
  'Multi-Family':        'For Sale > Real Estate > Multi-Family Homes',
  'Acreage Lot':         'For Sale > Real Estate > Land for Sale',
  'Lot':                 'For Sale > Real Estate > Land for Sale',
};
```

The resolved category goes into `listing-payload.json` and is recited verbatim in
`instructions.md` so Matt sees exactly which sub-category to tap in the FB app.

If `payload.category` is provided and differs from the mapped value, honor the payload override
and log the override reason in the surface message.

### Step 9.  Write the bundle to disk

Bundle layout in §6. The `listing-payload.json` carries: `mls_id`, `slug`, `title`,
`category`, `make_public`, `price_usd`, `address.{street, city, state, postal_code}`,
`specs.{beds, baths, sqft, lot_acres, year_built, property_type}`,
`location.{lat, lon}`, `photo_count`, `description_chars`.

### Step 10.  Run the QA gate

Before surfacing, verify:

| # | Check | Pass condition |
|---|---|---|
| 1 | Title length | `≤ 100` chars |
| 2 | Description length | `≤ 1500` chars |
| 3 | Title contains: beds, baths, property type, neighborhood OR city, price | yes |
| 4 | Banned vocab grep on title | zero hits |
| 5 | Banned vocab grep on description | zero hits (or `matt_override_banned_vocab=true` set explicitly) |
| 6 | No em-dashes in description body (em-dash in title only) | yes |
| 7 | No semicolons anywhere | yes |
| 8 | No exclamation marks anywhere | yes |
| 9 | No emoji anywhere | yes |
| 10 | No URLs other than `ryan-realty.com/listings/<slug>` | yes |
| 11 | Phone is `541.213.6706` (dotted, canonical) | yes |
| 12 | MLS# present on its own line | yes |
| 13 | EHO + brokerage license line present | yes |
| 14 | Photo count `≥ 5` and `≤ 10` | yes |
| 15 | Hero photo is exterior wide angle | yes (or Matt-confirmed override) |
| 16 | Every figure has an entry in `citations.json` | yes |
| 17 | Category mapped to a residential FB Marketplace category | yes |

Any `fail` = do not surface. Either auto-fix (re-clean the description) or escalate to Matt
with the specific failing check.

### Step 11.  Write `citations.json`

One entry per figure displayed in title or description. Shape (one example; one entry per
figure shown):

```json
{
  "figures": [
    {
      "figure": "$895,000",
      "source": "Supabase listings",
      "filter": "\"MlsId\"='220189422'",
      "column": "ListPrice",
      "value": 895000,
      "fetched_at": "2026-05-14T18:32:00Z"
    }
  ]
}
```

Required entries: `ListPrice`, `BedroomsTotal`, `BathroomsTotal`, `TotalLivingAreaSqFt`,
`LotSizeAcres` (if used), `year_built`, `City`, `SubdivisionName` (if used), `MlsId`.

### Step 12.  Write `instructions.md`

This file is Matt's manual-upload script.  every tap, every field, in order, with the exact
values resolved for this listing. The producer fills in:

1. Open FB app → Marketplace → Sell → Items.
2. Pick the resolved category (literal string from `listing-payload.json`).
3. Add photos: AirDrop or sync the `photos/` folder; verify `01_hero.jpg` is first.
4. Title: copy from `title.txt`.
5. Price: from payload.
6. Condition: `Used.  Like New` (FB Marketplace requires a condition field for items).
7. Description: copy from `description.md`.
8. Location: `<city>, OR` (city-level only.  never the exact street; FB doesn't surface
   street-level addresses anyway, and broker compliance prefers city-level).
9. Audience: `Public` (when `make_public=true`).
10. Publish.
11. Copy the live Marketplace URL back to chat: `"marketplace live: <url>"`.

Estimated upload time: ~90 seconds in the FB app. The producer writes these eleven steps to
`instructions.md` with the resolved values inlined so Matt can read the file once and follow
without bouncing back to the payload.

### Step 13.  Surface the bundle to Matt

Set `status='ready'`, populate `executor_response` with `{draft_path, title, category,
photo_count, description_chars, qa_gate: "passed"}`. Surface using the §6 surface-format
block verbatim. Then stop. Wait for Matt's confirmation in chat ("marketplace live: <url>").
On confirmation, transition `approved → executed` per §8. 48h later, `performance_loop`
writes Marketplace metrics (if FB Messenger forwarding is wired) and the row transitions
to `measured`.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | `listings` query + action row updates | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (project `dwvlophlbvvygjfxcrhm`) |
| `lib/asset-library.mjs` | Download + resize photos | per `video_production_skills/asset-library/SKILL.md` |
| `lib/voice-validate.mjs` | Banned-vocab grep on title + description | per `marketing_brain_skills/brand-voice/voice_guidelines.md` |
| `sips` (macOS) or `sharp` (node) | Image resize to 1080×1080 JPEG q90 | local binary |
| File system | Write the bundle to `out/fb-marketplace/<slug>/` | `out/` is gitignored |

No Graph API. No FB Marketplace API. No automated publish. The producer is intentionally
read-and-stage; the network boundary stops at Supabase.

---

## 6. Output format

**Draft lands at:** `out/fb-marketplace/<slug>/`

```
out/fb-marketplace/<slug>/
├── listing-payload.json
├── title.txt
├── description.md
├── instructions.md
├── photos/
│   ├── 01_hero.jpg
│   ├── 02_*.jpg
│   ├──...
│   └── 10_*.jpg
└── citations.json
```

**Slug format:** `<street-number>-<street-name-kebab>` (e.g. `1234-nw-riverview-drive`).
Special characters stripped, lowercase, hyphenated.

**Surface format (present to Matt exactly like this):**

```
FB Marketplace bundle ready.  <title>

  DELIVERABLE
    Path: out/fb-marketplace/<slug>/
    Title: <title> (<n> chars)
    Description: description.md (<n> chars)
    Category: <resolved category>
    Photos: <n> in photos/ (hero = 01_hero.jpg)
    Estimated upload time: ~90 seconds in the FB app.

  INSTRUCTIONS
    out/fb-marketplace/<slug>/instructions.md.  12 numbered steps, copy-paste-ready.
    AirDrop or sync the photos folder to your phone first.

  VERIFICATION TRACE
    - $<price>.  Supabase listings, "MlsId"='<mls_id>', "ListPrice" = <value>, fetched <iso>
    - <n> bed / <n> bath.  Supabase listings, BedroomsTotal / BathroomsTotal, fetched <iso>
    - <n> sqft.  Supabase listings, TotalLivingAreaSqFt, fetched <iso>
    - Built <year>.  Supabase listings, year_built, fetched <iso>
    [one line per figure]

  citations.json: out/fb-marketplace/<slug>/citations.json

When the listing is live, paste the URL here:
  "marketplace live: <url>"

The brain marks the action row executed once you confirm.
```

Then stop. Do not commit. Do not push. Wait for Matt's confirmation that the Marketplace
listing is live.

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-explicit` | Matt explicitly performs the FB Marketplace upload AND confirms the live URL or screenshot in chat | Matt only |

**This producer uses:** `matt-explicit`.

Approval semantic differs from other `ops:*` producers: there is no "reply 'yes' to execute"
because the producer itself doesn't execute against FB. Approval is "Matt did the upload and
posted the live URL." The producer stays in `ready` until Matt confirms.

---

## 8. Status flow

```
     pending
        │ producer reads row, claims it
        ▼
  in_production   ← executed_at = now()
        │ Supabase pull complete, photos downloaded, description cleaned, QA gate passed
        ▼
      ready        ← executor_response populated; bundle staged on disk; surface message sent to Matt
        │ Matt does the manual upload in the FB app, pastes "marketplace live: <url>" in chat
        ▼
    approved       ← approved_by='matt', approved_at=now()
        │ producer captures the live URL into executor_response
        ▼
    executed       ← terminal success; the bundle on disk + the live URL are the record
        │ 48h post-publish (FB Messenger inquiry count, save count if available)
        ▼
    measured       ← performance_loop writes Marketplace metrics to content_performance

    killed         ← terminal; listing not found, Marketplace policy blocks (sold / withdrawn),
                      photo download failed permanently, or Matt cancels
```

SQL transitions:

```sql
-- On pickup:
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<id>' AND status = 'pending';

-- On bundle ready:
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = '{
      "draft_path": "out/fb-marketplace/<slug>/",
      "title": "<title>",
      "category": "<category>",
      "photo_count": <n>,
      "description_chars": <n>,
      "qa_gate": "passed"
    }'::jsonb
WHERE id = '<id>';

-- On Matt's confirmation of live URL:
UPDATE marketing_brain_actions
SET status = 'approved', approved_by = 'matt', approved_at = now()
WHERE id = '<id>';

UPDATE marketing_brain_actions
SET status = 'executed',
    executor_response = jsonb_set(executor_response, '{live_url}', '"<url>"'::jsonb)
WHERE id = '<id>';
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Listing not found in Supabase | `SELECT... WHERE "MlsId"='<id>'` returns 0 rows | `status='killed'`. Surface the MLS#. |
| `PublicRemarks` unsalvageable | After cleaning, > 3 banned words remain with no substitute, or `< 100` chars total | `status='ready'`, `qa_gate='banned_vocab_unsalvageable'`. Surface the words + proposed substitutes. Matt can (a) hand-rewrite, (b) set `matt_override_banned_vocab=true`, or (c) cancel. |
| Photos can't be downloaded | `PhotoURL` returns < 5 usable URLs, or > 50% HTTP 4xx/5xx | `status='ready'`, `qa_gate='photos_insufficient'`. Surface count + failing URLs. Matt decides: wait, ship-as-is if `≥ 5`, or cancel. |
| Title exceeds 100 chars after fallback shortenings | `length(title) > 100` after dropping both neighborhood and property type | Surface candidate shortenings; Matt picks or hand-writes. |
| `PropertyType` doesn't map to a residential category | MLS type is `Mobile Home Park`, `Industrial`, etc. | `status='killed'`. Residential-only guardrail. |
| `StandardStatus` is `Closed` / `Withdrawn` / `Expired` | Listing no longer active | Surface before staging. FB Commerce Policy risk; do not auto-stage. |
| Listing has no `"PhotoURL"` populated | Photographer hasn't uploaded yet | `status='ready'`, `qa_gate='photos_missing'`. "Wait for photographer, re-run." |
| Hero photo is interior | `PhotoURL[0]` is interior (kitchen, living room) | Surface thumbnails of `PhotoURL[0]` and `[1]`. Ask Matt before reordering. |
| Matt confirms live URL but URL is wrong | URL doesn't contain `marketplace.facebook.com/item/` or `facebook.com/marketplace/item/` | Verify URL pattern. Surface mismatch; do not transition to `executed` until verified. |
| FB Marketplace policy / category tree changes | Mapping in §4 Step 8 becomes stale | Quarterly audit: re-walk the FB iOS app category tree; update the map. |
| **Open spec question** | Whether to include the `ryan-realty.com/listings/<slug>` URL in the description body | Default: yes. If FB starts flagging Marketplace descriptions with outbound URLs as spam, drop the URL line and keep only the phone. Track in `executor_response.outbound_url_included`. |

---

## 10. Related skills and references

**Required reading before executing:**

- `CLAUDE.md` §0.  Data Accuracy mandate (outranks everything)
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last (outranks everything)
- `CLAUDE.md` "Voice + content".  voice attributes, banned vocab, phone/web format
- `CLAUDE.md` "Supabase listings Schema".  mixed-case column quoting
- `design_system/ryan-realty/SKILL.md`.  brand register (Marketplace is voice-first, not visual; SKILL grounds the prose tone)
- `marketing_brain_skills/brand-voice/voice_guidelines.md`.  banned vocab union
- `marketing_brain_skills/brand-voice/corpus/gbp_responses.md`.  Matt's writing fingerprint (Marketplace prose mirrors GBP register)
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`.  banned content gate

**Capabilities used inside this producer:**

- `lib/asset-library.mjs` per `video_production_skills/asset-library/SKILL.md`.  photo download + resize
- `lib/voice-validate.mjs` per `marketing_brain_skills/brand-voice/voice_guidelines.md`.  banned-vocab grep

**Companion producers:**

- `social_media_skills/list-kit/SKILL.md`.  the at-Active orchestrator that may emit `ops:fb_marketplace_create` as one of its fan-out actions alongside `content:ig_single_post` (S1), `content:ig_carousel`, and `content:flyer`.
- `social_media_skills/facebook-lead-gen-ad/SKILL.md`.  Paid FB lead-gen lives here (companion paid channel; Marketplace is the free one).
- `marketing_brain_skills/producers/ops-fub-crm/SKILL.md`.  When a Marketplace inquiry lands in Matt's FB Messenger, the Messenger-to-FUB forwarding integration creates a lead via this producer.

**Playbooks and pipeline docs:**

- `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`.  paid Meta context (separate from Marketplace; reading it grounds the relative role of Marketplace as the *free* high-volume channel)
- `docs/MARKETING_LEAD_FLOW.md`.  Messenger-to-FUB lead path for Marketplace inquiries

**Producer template:**

- `marketing_brain_skills/producers/TEMPLATE.md`

**Registry entry:**

- `marketing_brain_skills/producers/REGISTRY.md`.  Section D, row `ops-fb-marketplace` (to be added by the parent orchestrator that wires this skill into the registry).

---

## 11. What not to do

1. **Never call the FB Marketplace API to auto-publish.** FB does not permit it for residential brokers as of 2026-05-14. The whole shape of this producer exists because of this constraint.
2. **Never inherit figures from the action row's payload without re-verifying against Supabase in this session.**
3. **Never ship a description with banned vocab unless `matt_override_banned_vocab=true` is explicit on the payload.**
4. **Never substitute photos with AI / virtual-stage renders.** Hard fail per ANTI_SLOP_MANIFESTO.
5. **Never set `status='executed'` based on a passing QA gate alone.** `executed` requires Matt's confirmed live URL.

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
