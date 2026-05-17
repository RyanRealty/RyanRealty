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
**Exemplar outputs (two — use the one that matches your situation):**

- `public/cmas/cma-19496-tumalo-reservoir/cma.html` + `/api/cma/cma-19496-tumalo-reservoir/pdf` — **canonical exemplar for the current rules** (finalized 2026-05-17). Rural acreage subject, 5 closed comps via distance-based RPC, 13 pages with the N+1 / N+2 / Final pricing+rationale+disclosure split, layout-discipline-compliant (zero footer/header bleed), 10.66 MB PDF. Use this as the structural reference for any new CMA.
- `public/cmas/cma-21042-robin/cma.html` + `/api/cma/cma-21042-robin/pdf` — earlier reference (Whispering Pines subdivision, 8 closed comps via SubdivisionName filter). Predates the layout discipline rules + the empirical image budget — useful for sub-division-based comp selection but the page-fit and image-tier work was solved later in the Tumalo build.

Draft lives at `public/drafts/cma-<slug>/cma.html` during creation; moves to `public/cmas/<slug>/cma.html` on Matt's ship-it.

**Primary deliverable format:** PDF, generated server-side at `/api/cma/[slug]/pdf` via puppeteer-core + @sparticuz/chromium-min. The PDF uses the same Chrome engine that displays the HTML preview, so formatting is identical — no print-CSS surprises. The HTML is the source-of-truth, but anything that goes to a client (or to a broker who's signing it) is delivered as PDF. Append `?download=1` to force a download. Append `?info=1` to get a JSON metadata response (size in bytes, finalized-flag) without the binary body.

**HARD CAP — 25 MB attachment limit (non-negotiable):** Every CMA PDF must come in under **25 MB** so it can be attached to a Gmail/Outlook email without compression or external links. Both `/api/cma/[slug]/pdf` and `/api/cma/[slug]/email` enforce this and reject with HTTP 413 if the render exceeds the cap. The cap is set by `MAX_PDF_BYTES = 25 * 1024 * 1024` in `app/api/cma/[slug]/pdf/route.ts`.

Puppeteer's PDF backend re-encodes every image during render; the empirical bloat ratio is ~5× the raw image bytes per the Tumalo CMA (5.6 MB raw → 28 MB PDF). To stay under 25 MB the raw image budget is roughly **~5 MB total**, which sets the default tiers:

| Use | Spark CDN variant | Displayed size | Notes |
|---|---|---|---|
| Cover hero | `800×600` | full-bleed at 100% page width | drop to `640×480` for >8 comps |
| Per-flyer hero | `800×600` | full-bleed at 100% page width | same |
| Comp-grid thumbnails (5-up) | `320×240` | 58 px tall × ~140 px wide | 640×480 is ~7× oversize for this display |
| Per-flyer photo grid (3-up) | `320×240` | 91 px tall × ~220 px wide | same |
| Subject gallery grid | `320×240` | 91 px tall | same |
| Map | Google Static API at 640×640 | full-width body block | inlined as data URI by the PDF render |

Spark CDN supports `320×240`, `640×480`, `800×600`, `1024×768`, `1280×960`, `1600×1200`. If a build still comes back over 25 MB, **drop one tier across all gallery uses first** (320 is the floor — any smaller looks visibly degraded in PDF), then drop heroes one tier. Target landing: 5–14 MB.

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

The canonical layout (clone from the 21042 Robin exemplar at `public/drafts/cma-21042-robin/cma.html`):

| Page | Content (one purpose per page) |
|------|---------|
| 1 | **Cover** — subject hero photo · value range · key stats · "Presented by" line |
| 2 | **Subject narrative** — at-a-glance · site & structure · why this matters · listing history |
| 3 | **Subject flyer** — hero + 6-photo grid + current/historical MLS remarks + features (off-market badge if not currently Active) |
| 4 | **Comp location map** — Google Maps Static via `/api/maps/cma-<slug>` · numbered legend · pin order matches comp flyer order |
| 5 | **Comp summary** — subject row at top + 4×2 thumbnail grid + full data table |
| 6 → N | **Comp flyers** — one full page per comp (hero + 6-photo grid + public_remarks + features). N scales with comp count (6 comps → flyers 6–11; 8 comps → flyers 6–13). |
| N+1 | **Pricing strategy** — Method 1 ($/sqft tier) + Method 2 (un-renovated baseline + value-add) + Converged range (3 tiers: Conservative / Recommended / High End) |
| N+2 | **Why this list price** — outlier explanations (if any high or low comps need context) + listing-history rationale + verification trace (data sources) |
| Final | **Disclosure + broker signature** — disclosure paragraphs + Amboqia-script broker signature + transparent headshot + license # |

Page numbers in the comp flyer area scale with the number of comps. 6 comps → 13 pages, 8 comps → 15 pages, etc. Always renumber footers. NEVER hardcode a `Page X of 15` — count actual pages.

**Step 7a — Layout discipline (HARD RULES — non-negotiable)**

Every page is purposeful and self-contained. Never split a single conceptual section across page breaks. Never let content bleed into another page's header or footer band. These rules outrank "include more detail" — if a section is too long, split or trim, never spill.

1. **One section per page.** A page = one purpose with a single H2 / SUBJECT PROPERTY / WHERE THE COMPS SIT subhead. If the section's narrative + tables + visuals can't fit one page, split it into two purposeful pages with distinct subheads (e.g., "Pricing strategy" → page A with the methods + range; page B with outlier explanation + verification trace). Never overflow.

2. **Footer + header are sacrosanct.** Body content lives in the inner box only. For 8.5×11" letter at 96 DPI = 1056 px tall × 816 px wide, the usable inner region is bounded by the page padding (top) and the rendered footer's top edge (bottom). The footer band typically sits at y ≈ 1025 relative to its containing `.page`. **The bleed-check authority is the rendered footer's top edge, not a hardcoded constant** — page-layout styles drift across CMAs, so always read the actual footer position at QA time. No non-footer / non-header descendant's bounding-box bottom may exceed `footerTop − 4` relative to its containing `.page`.

3. **Width tolerance: zero.** Body content stays within the page padding box. Horizontal overflow gets cropped by `overflow: hidden` on the page container, which silently truncates and looks broken in PDF. Keep all column widths summed under the inner-box width (816 − 64 padding = ~752 px usable).

4. **What gets trimmed first if a section is too long:** narrative adjectives and editorial prose. The DATA must stay (numbers, dates, addresses, $/sqft, lot sizes, listing-history rows, citations). Cut "stunning view" → "view"; cut "well-executed renovation" → "renovated"; never cut a comp's close price or date.

5. **Never use orphan / widow content.** A heading at the bottom of a page with no body under it = the page break is wrong. Move the heading to the next page OR pull the first paragraph up onto the current page. Same for a single-line caption stranded on a fresh page — pull the visual up with it.

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

Note: this check is **self-calibrating** — it reads each page's actual footer position rather than assuming a fixed ceiling, so it works whether the per-CMA stylesheet uses 1056 px letter portrait, 1100 px legal stretch, or anything in between. The 4 px buffer below `footerTop` is the minimum gap between body content and the footer band; widen it to 8–12 px if you want stricter visual breathing room.

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
- **PDF under 25 MB** — hit `/api/cma/<slug>/pdf?info=1` and confirm `under_attachment_cap: true`. If over, drop the next image tier (heroes `800→640` or gallery `320→240` if any are still at a larger variant) and re-render. The Tumalo CMA landed at ~12 MB with 800×600 heroes and 320×240 thumbnails.

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

**Exemplars (clone the one that matches your situation):**
- `public/cmas/cma-19496-tumalo-reservoir/cma.html` — **canonical exemplar for current rules** (finalized 2026-05-17). Rural acreage subject signed by Matt Ryan, 5 closed comps via PostGIS distance RPC, 13 pages with the layout-discipline split, 10.66 MB PDF. The structural reference for any new CMA built under the post-2026-05-17 layout + image-budget rules.
- `public/cmas/cma-21042-robin/cma.html` — earlier reference for Kelly Hansen, signed by Matt Ryan (locked 2026-05-14). Whispering Pines subdivision subject, 8 closed comps via SubdivisionName filter. Useful for the sub-division-based comp-selection pattern; the page-fit and image-tier work was solved later in the Tumalo build.

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
