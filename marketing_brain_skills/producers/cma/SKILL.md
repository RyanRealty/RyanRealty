---
name: cma
description: >
  Builds a branded multi-page Comparative Market Analysis (CMA) for a specific
  property — subject details, improvements, comp grid + table, one-page flyers
  per comp, location map, and pricing strategy — signed by the broker handling
  the listing. Triggered by `content:cma` action rows or direct invocation
  ("create a CMA for 21042 Robin Ave"). Every finalized CMA is recorded in
  `public.cmas` and the HTML lives at `public/cmas/<slug>/cma.html`.
action_types:
  - content:cma
---

# CMA Producer

**Scope:** Per-property Comparative Market Analysis as a 15-page branded HTML deliverable (print-ready as PDF). Subdivision-first comp set, full property flyers per comp, branded location map, and a pricing range with recommended list price. Signed by the broker handling the listing (resolved from `public.brokers`).

**Status:** Canonical
**Locked:** 2026-05-14
**Exemplar output:** `public/cmas/cma-21042-robin/cma.html` (the source HTML, when finalized) + `/api/cma/cma-21042-robin/pdf` (the primary deliverable: a server-rendered PDF). Draft lives at `public/drafts/cma-<slug>/cma.html` during creation. The 21042 Robin Ave CMA is the canonical exemplar; clone its structure for new CMAs.

**Primary deliverable format:** PDF, generated server-side at `/api/cma/[slug]/pdf` via puppeteer-core + @sparticuz/chromium-min. The PDF uses the same Chrome engine that displays the HTML preview, so formatting is identical — no print-CSS surprises. The HTML is the source-of-truth, but anything that goes to a client (or to a broker who's signing it) is delivered as PDF. Append `?download=1` to force a download. Append `?info=1` to get a JSON metadata response (size in bytes, finalized-flag) without the binary body.

**HARD CAP — 25 MB attachment limit (non-negotiable):** Every CMA PDF must come in under **25 MB** so it can be attached to a Gmail/Outlook email without compression or external links. Both `/api/cma/[slug]/pdf` and `/api/cma/[slug]/email` enforce this and reject with HTTP 413 if the render exceeds the cap. The cap is set by `MAX_PDF_BYTES = 25 * 1024 * 1024` in `app/api/cma/[slug]/pdf/route.ts`. To stay under: cover/flyer hero photos at **1280×960** Spark CDN variant, comp grid + flyer-thumbnail photos at **800×600**, comp-summary card photos at **640×480** or smaller. Spark CDN supports `320×240`, `640×480`, `800×600`, `1024×768`, `1280×960`, `1600×1200` — drop one tier if a build comes back over 25 MB. Target landing: 5–10 MB.

**Repository lookup:** Every finalized CMA appears at `/admin/cmas` — the canonical place to find old CMAs, filter by broker or client, and re-open the PDF or HTML for any row.

---

## 1. Scope

### In scope
- Single-property Comparative Market Analysis — for a specific subject address
- 15-page HTML deliverable, print-ready at 8.5×11" letter, exported as PDF via browser ⌘P
- Subdivision-first comp set (last 24 months), with broader same-zip fallback if subdivision is sparse
- One-page flyer per comp (hero photo + 6-photo grid + MLS public_remarks + key features)
- Branded location map via `/api/maps/cma-<slug>` showing subject + all comps with numbered pins matching flyer order
- Pricing range with **two methods** (per-sqft tier + un-renovated baseline + improvement value-add) that converge on a recommended list price
- Improvements ledger when seller has invested capital between MLS listings (per the seller's documented spend)
- Per-broker branding: signature block pulls broker headshot, name, license #, email, phone from `public.brokers`
- Storage in `public.cmas` table with `cma_comps` linking the comps used

### Out of scope
- Formal appraisal (this is an estimate, not a USPAP appraisal) — disclaim explicitly on the last page
- Listing agreement, seller net sheet, transaction coordination — those are separate producers
- Marketing flyer for the subject after it's listed — that's `flyer-design` for `content:just_listed_flyer` etc.
- Email delivery of the finalized PDF — that goes through `ops-email-send` after the CMA is finalized

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
  broker_email?: string            // 'paul@ryan-realty.com' — if omitted,
                                   // resolves to ListAgentEmail of the subject;
                                   // if subject not in our listings, defaults
                                   // to matt@ryan-realty.com
  broker_slug?: string             // alternative to broker_email

  // Seller-reported improvements (free text or structured):
  seller_improvements?: string     // pasted email/sms from seller listing
                                   // what they've done since last MLS listing
  seller_improvements_total?: number  // total invested capital (USD)

  // Optional notes from Matt:
  client_notes?: string
}
```

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
  generation_reason: string        // 'Kelly Hansen requested CMA via SMS to Matt — wants to list within 60 days'
  status: 'pending'
}
```

---

## 4. The recipe

**Step 1 — Read the action row + transition to in_production**

```sql
SELECT * FROM marketing_brain_actions WHERE id = '<id>' AND status = 'pending';
-- if found:
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<id>';
```

Compute `slug` from the subject address (e.g. `cma-21042-robin`) — kebab-case, ≤40 chars, prefix `cma-`.

**Step 2 — Load mandatory references**

- `CLAUDE.md` §0 (Data Accuracy) and §0.5 (Draft-First, Commit-Last)
- `design_system/ryan-realty/SKILL.md` — brand register
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — voice enforcement (banned words apply to the CMA narrative)
- This file (you are here)

**Step 3 — Resolve subject from Supabase**

```sql
-- if subject_listing_key provided:
SELECT * FROM listings WHERE "ListingKey" = '<key>';

-- else, query by address parts (PostalCode is indexed):
SET statement_timeout = '120s';
SELECT * FROM listings
WHERE "PostalCode" = '<zip>'
  AND "StreetNumber" = '<num>'
  AND "StreetName" ILIKE '<street>%';
```

Capture: `SubdivisionName`, `BedroomsTotal`, `BathroomsTotal`, `TotalLivingAreaSqFt`, `year_built`, `lot_size_acres`, `garage_spaces`, `Latitude`, `Longitude`, `PhotoURL`, `public_remarks`. If subject isn't in the MLS (e.g. never been listed), Matt provides the values directly in `payload.client_notes`.

**Step 4 — Pull subdivision comps**

Default filter (matches the 21042 Robin exemplar):
- `SubdivisionName = '<subject subdivision>'`
- `PropertyType = 'A'` (SFR)
- `StandardStatus = 'Closed'`
- `CloseDate >= now() - interval '24 months'`
- `TotalLivingAreaSqFt BETWEEN <subject_sqft × 0.77> AND <subject_sqft × 1.23>` (±25%)
- `lot_size_acres BETWEEN <subject_acres − 1.0> AND <subject_acres + 1.5>` (geography-dependent)

Target 6–10 comps. If subdivision returns fewer than 6, expand to same-zip + same property class. Exclude obvious outliers (off-market arms-length sales, $/sqft >2 std deviations from cluster).

Also pull every comp's `pending_timestamp`, `OnMarketDate`, `CloseDate`, `DaysOnMarket`, `days_to_pending`. The CMA reports **Days to Offer** (active days = `pending_timestamp - OnMarketDate`) as the primary recency signal, with the Spark-reported DOM (which includes time under contract) as a secondary number. See §10 — this is a known Oregon Data Share quirk.

**Step 5 — Pull photo arrays for subject + comps**

For each `ListingKey`, call `GET /api/listings/<key>/photos` (this is the Spark `_expand=Photos` endpoint added 2026-05-14). Cache the primary URL + 5 supplementary URLs per comp. If `PhotoURL` is null in Supabase but the listing has photos via this endpoint, use what Spark returns.

If the subject has no MLS photos (never listed) or has only stale photos, note it explicitly on the subject flyer ("Most recent MLS listing photo · pre-renovation — updated photos pending") and surface to Matt that pro photography is required before list.

**Step 6 — Resolve broker from `public.brokers`**

```sql
-- Preferred path:
SELECT id, slug, display_name, title, license_number, email, phone, photo_url
FROM brokers
WHERE email = '<broker_email>' OR slug = '<broker_slug>';

-- Fallback to subject's ListAgentEmail:
SELECT ... FROM brokers WHERE email = (SELECT "ListAgentEmail" FROM listings WHERE "ListingKey" = '<key>');

-- Final fallback:
SELECT ... FROM brokers WHERE slug = 'matt-ryan';
```

The broker row supplies the signature block (page 15): display_name, title, license_number, email, phone. The headshot loads from `design_system/ryan-realty/assets/team/<slug>.png` (transparent PNG; the canonical version per CLAUDE.md §"Broker headshots"). Never re-frame the transparent portrait — no circle crop, no border, no drop shadow.

**Step 7 — Build the CMA HTML**

Copy assets to `public/drafts/cma-<slug>/assets/`:
- `logo-blue.png` (from `design_system/ryan-realty/assets/brand/`)
- `Amboqia_Boriango.otf` (display font)
- `<broker_slug>.png` (transparent headshot from `design_system/ryan-realty/assets/team/`)

The 15-page layout (clone from the 21042 Robin exemplar at `public/drafts/cma-21042-robin/cma.html`):

| Page | Content |
|------|---------|
| 1 | Cover · subject hero photo · value range · key stats · "Presented by" line |
| 2 | Subject property details + improvements ledger (if seller invested capital) |
| 3 | Subject flyer (one-page format matching comp flyers; off-market badge) |
| 4 | Comp location map (Google Maps Static via `/api/maps/cma-<slug>`) + legend |
| 5 | Comp summary — 4×2 thumbnail grid + full data table |
| 6–13 | One-page flyer per comp (hero + 6-photo grid + public_remarks + features) |
| 14 | Pricing strategy — two methods, converged range with three tiers |
| 15 | Disclosure + broker signature block (transparent headshot, full contact, license #) |

Page numbers in the comp flyer area scale with the number of comps. If there are 6 comps instead of 8, the CMA is 13 pages instead of 15; renumber footers accordingly.

**Step 8 — Build the comp location map endpoint**

Create `app/api/maps/cma-<slug>/route.ts` (or generalize to a parameterized endpoint after the second CMA). The route proxies a Google Maps Static API call with:
- Subject pin: `color:red|label:S` at the subject lat/lng
- Comp pins: `color:0x102742|label:<n>` for n = 1..N matching flyer order

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is the live env var on Vercel. Mapbox (`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`) is not provisioned as of 2026-05-14 — stick with Google.

**Step 9 — Pricing methodology**

Two methods, both must converge within ±5% for the range to be defensible:

**Method 1 — Tiered $/sqft.** Sort closed comps into "renovated/turnkey" tier and "un-renovated/dated" tier by $/sqft. Apply the renovated tier range to the subject's sqft. Allow a small lot-premium adjustment if subject is materially larger than comps.

**Method 2 — Un-renovated baseline + improvement value-add.** Anchor baseline on the closest-vintage unimproved comps. Add value-add for documented seller improvements using Remodeling Magazine Cost-vs-Value Pacific-region recovery rates (kitchen 65–75%, roof 60–70%, paint 60–80%, landscape 60–100%, HVAC 60–80%, window coverings 25–40%).

The converged range gets three tiers:
- **Conservative** — quick-sale entry, ~30-day close
- **Recommended List** — what to actually list at; usually the upper-middle of the range
- **High End** — supportable ceiling with all condition + photo issues resolved

**Step 10 — Subject row in the comp table**

The subject row at the top of the comp summary table should populate List with the recommended list price and $/sqft with `recommended_list / subject_sqft`. Sold / Close / Active stay as em-dash. This way the subject reads in context against the comps, not as a row of placeholders.

**Step 11 — QA gate (per CLAUDE.md §0)**

- Every figure in the deliverable traces to a Supabase query run in this session — write `out/cma-<slug>/citations.json`
- Months of supply check is not required (this is a CMA, not a market report), but $/sqft, lot sizes, beds/baths, close dates, and DOM/days-to-offer must all match Supabase exactly
- Brand voice check: banned words from CLAUDE.md §"Voice + content" (`stunning`, `nestled`, `breathtaking`, `must-see`, etc.) must not appear in CMA narrative — they're fine in MLS-pulled `public_remarks` (those are quoted text)
- Days to Offer must be displayed alongside any DOM number — see §10
- Map renders successfully (hit `/api/maps/cma-<slug>` and confirm 200)
- All flyer hero photos load (HEAD-check each Spark CDN URL)
- Page numbers in footers correct (no `X of Y` mismatches)
- **PDF under 25 MB** — hit `/api/cma/<slug>/pdf?info=1` and confirm `under_attachment_cap: true`. If over, drop the next image tier (1280→1024 heroes, or 800→640 thumbs) and re-render.

**Step 12 — Write citations.json**

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
      "source_query": "SELECT ... FROM listings WHERE SubdivisionName = 'Whispering Pines' AND ..."
    }
  ],
  "broker": {
    "slug": "matt-ryan",
    "source": "Supabase brokers"
  }
}
```

**Step 13 — UPDATE the action row to `ready` and surface to Matt**

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

**Step 14 — On Matt's "ship it"**

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
VALUES ...
```

4. Git commit + push the `public/cmas/<slug>/` files. Do not commit the `public/drafts/cma-<slug>/` version — that's the draft scratch space.
5. Set `marketing_brain_actions.status = 'approved'` then `'executed'` once the push completes.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | data pull, broker resolve, action row + cmas table writes | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `/api/listings/[key]/photos` | Spark photo array per listing | `SPARK_API_KEY`, `SPARK_API_BASE_URL` |
| `/api/maps/cma-<slug>` | Google Maps Static map | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Vercel MCP | get preview URL for the draft branch | (no env var; uses MCP token) |
| Resend (ops-email-send) | post-finalization email delivery to client | `RESEND_API_KEY`, `mail.ryan-realty.com` sender |

---

## 6. Output format

**Draft HTML lands at:** `public/drafts/cma-<slug>/cma.html` (+ assets in `assets/`).
**On finalization HTML moves to:** `public/cmas/<slug>/cma.html`.
**PDF endpoint (primary deliverable):** `/api/cma/<slug>/pdf` — automatically resolves the HTML at either path and renders to PDF via headless Chrome. Append `?download=1` for force-download.

**Surface format (present to Matt exactly like this):**

```
Draft ready: CMA — <subject address> for <client name>

  DELIVERABLE
    PDF (primary): <host>/api/cma/<slug>/pdf
    HTML preview: <vercel preview url with _vercel_share token>
    Draft path: public/drafts/cma-<slug>/cma.html
    Repository:  /admin/cmas (row visible to anyone with admin access)

  VALUATION
    Range: $X.XXM — $X.XXM
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

The `measured` step for a CMA is light — 90 days after delivery, the `performance_loop` checks whether the property went under contract and at what price relative to the recommended list. That feedback informs the calibration of future CMAs.

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Subject not in MLS | listings query returns 0 rows | Surface to Matt: ask for manual subject specs (beds/baths/sqft/lot/year) in `payload.client_notes`. Continue with comp pull using same-zip filter only. |
| Comp set < 3 rows | subdivision-only filter returns sparse | Expand to same-zip + same-property-class. If still < 3, surface to Matt — a credible CMA needs at least 3 closed comps. |
| Photo endpoint 404 for a comp | Spark returns "Listing not found" | Use the "No MLS photo on file" placeholder card. Don't block the CMA over a single missing comp photo. |
| Broker not in `public.brokers` | broker_email/slug doesn't match | Default to `matt-ryan`. Surface a one-line note that broker fell back to Matt; ask if a new broker record should be created. |
| Map endpoint 500 | Google Maps Static API error or missing env var | Surface the actual error from the route's JSON response. Don't ship the CMA without the map. If `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is missing, that's a Matt-side env fix; pause and report. |
| Banned word in narrative | brand-voice check hits | Rewrite the offending sentence and re-validate before surfacing. |
| `pending_timestamp` missing for a comp | Days to Offer cannot be computed | Show DOM only for that comp, footnote explaining missing pending data. Don't fabricate a days-to-offer number. |

---

## 10. Related skills, references, and known quirks

**Required reading before executing:**
- `CLAUDE.md` §0 — Data Accuracy (outranks everything)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last (outranks everything)
- `design_system/ryan-realty/SKILL.md` — brand visual system + headshot composite rule
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — voice enforcement

**Capabilities used:**
- `app/api/listings/[listingKey]/photos/route.ts` — Spark photo fetcher (added 2026-05-14)
- `app/api/maps/cma-<slug>/route.ts` — Google Maps Static proxy (replicate per CMA until generalized)
- `app/api/cma/[slug]/pdf/route.ts` — server-side PDF renderer (puppeteer-core + @sparticuz/chromium-min). Same Chrome engine as the HTML preview, so formatting is identical.
- `app/admin/(protected)/cmas/page.tsx` — repository lookup UI; lists every row in `public.cmas` with broker / client / status / pricing range and links to both PDF and HTML.

**Tables touched:**
- READ: `listings`, `brokers`, `listing_history`, `status_history`, `price_history`
- WRITE: `marketing_brain_actions` (status transitions), `cmas`, `cma_comps`

**Exemplar:**
- `public/cmas/cma-21042-robin/cma.html` — the 21042 Robin Ave CMA for Kelly Hansen, signed by Matt Ryan (locked 2026-05-14). Clone its structure verbatim for new CMAs.

**Known data quirks:**

1. **Oregon Data Share DOM includes time under contract.** The `DaysOnMarket` field reports list-date → close-date (not list-date → pending). For active-marketing analysis, compute `days_to_pending = pending_timestamp - OnMarketDate`. Always show **Days to Offer** alongside DOM in the CMA — the active number is the more useful read of buyer demand.

2. **`listings.PhotoURL` can be null even when photos exist.** Some MLS records (especially recent ones or those where the media sync hasn't completed) have a null PhotoURL despite Spark returning 30–70 photos via `_expand=Photos`. Always fall back to `/api/listings/<key>/photos` rather than trusting `PhotoURL` alone.

3. **`BathroomsTotal` is a fixture count, not a "X.5 baths" decimal.** Pre-renovation a "3.5 BA" home shows as `BathroomsTotal=4` (3 full + 1 half = 4 fixtures). After a half-bath addition it would become 5. The MLS doesn't update until the property is re-listed. Default the CMA to the actual current bath count per the seller's improvement list, not the stale MLS value.

4. **Spark CDN photo URLs are stable but not forever.** Once a listing is closed or expired, photos may be retained for several years but eventually purged. For finalized CMAs that need to survive long-term, download the hero images locally to `public/cmas/<slug>/assets/`. For draft + short-term review, hot-linking the Spark URL is fine.

**Brain wiring:**
- Registry entry: `marketing_brain_skills/producers/REGISTRY.md` Section B, row `cma`
- Action type: `content:cma`
- Approval: `matt-review-draft`
- Default broker: `matt-ryan` (override via `payload.broker_email` or `payload.broker_slug`)

**Future generalizations:**
- Parameterize the map endpoint to a single `/api/maps/cma/[slug]` route that reads coordinates from the `cmas` + `cma_comps` tables (rather than copying the hardcoded route per CMA).
- Build a `/admin/cmas` page that lists every row in `public.cmas` with filters by broker and client and links to each `cma.html`.
- Wire delivery to FUB: when a CMA is finalized, automatically create an FUB note on the client's lead record with a link to the CMA URL.
