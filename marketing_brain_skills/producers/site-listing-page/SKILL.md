---
name: site-listing-page
description: >
  Scaffolds or updates a per-listing landing page at /lp/listings/<mls-slug>/
  for every Tetherow / Pronghorn / Broken Top / Sunriver / Bend-wide
  single-family residential listing in the Oregon RMLS feed. This is the
  Tier 4 (deepest) page in the four-tier search-authority stack
  (city → community → subdivision → listing). The right producer for ANY
  per-property page: our own listings, OPM listings we want to compete for
  on the address query, listings under contract, recently sold listings.
  Use this skill when Matt says "build the 61594 Hosmer page", "create a
  page for this MLS#", "make the listing pages for every Tetherow home",
  "compete with Zillow on this address", or any time a single property
  address needs an authoritative search-result page. Use this skill (NOT
  site-property-landing which is a separate older producer for our own
  listings only) any time the goal is to win the SERP for an MLS-listed
  address regardless of listing brokerage. The skill outputs a Next.js
  dynamic route with strict IDX-compliant attribution (listing
  brokerage + agent name on every page per Oregon RMLS Internet Display
  Rules). For our own listings: full broker-of-record block and direct
  showing CTA. For OPM listings: MLS-required attribution + a "Schedule
  a showing with Ryan Realty" CTA routed to our buyer's agent. ISR every
  1 hour because listing data turns over fast. Opens a GitHub PR.
action_types:
  - site:listing_page_create
  - site:listing_page_update
  - site:listing_page_archive
  - ops:listing_pages_batch_sync
output_type: web-page
target_platforms: []
asset_destination: app/lp/listings/[mls_slug]/page.tsx
auto_inputs: ['listings', 'listing_history', 'market_stats_cache', 'data/resort-communities.json']
required_inputs: ['mls_listing_id']
optional_inputs: ['sections_to_update']
estimated_runtime_min: 20
cost_usd_estimate: $0-$0.50
thumbnail_uri: null
example_outputs:
  - label: First active Tetherow listing (TBD on execution)
    surface: website
---

# site-listing-page

**Scope.** Creates or updates a per-listing landing page at
`/lp/listings/<mls-slug>/` for every relevant single-family residential
listing in the Oregon RMLS feed. The page is the deepest tier in the
search-authority stack and is designed to win the SERP for the address
query — beating Zillow, Realtor.com, Redfin, and the listing brokerage's
own page for any address inside our defined geo focus (Bend, Tetherow,
Pronghorn, Sunriver, Broken Top, etc.).

What makes our listing page better than Zillow's:
- Sub-neighborhood + parent community context (we link up to the community LP)
- Verified HOA dues table (from `resort-communities.json`)
- Drive-time anchors from the property (computed via Google Routes API or estimated from the community page)
- Schools assignment (Bend-La Pine Schools + GreatSchools cited)
- Recent comp set filtered to the same sub-plat (last 12 months from `listings`)
- Builder identity if we can identify it (from `listings.ListAgentEmail` heuristics + parent community's builder roster)
- Verified figures (no Zestimate estimates; only MLS data)
- One-click "Schedule a showing" routing to our broker (or our buyer's agent for OPM)
- IDX-compliant attribution so the page is MLS-legal

The skill operates in two modes per the listing's brokerage:

1. **Our listings (ListAgentEmail belongs to Ryan Realty):** Full broker-of-record block. Showing CTA routes to the listing agent. Marketing language permitted (within brand voice). "Listed by Ryan Realty" badge.

2. **OPM listings (other people's listings):** Mandatory IDX-compliant attribution: listing brokerage name + listing agent name at the top of the page. Showing CTA routes to our buyer's agent ("Schedule a tour with Ryan Realty"). Editorial language only — no marketing claims for the home itself. Listing photos via the IDX broker license. "Listed by <Other Brokerage>" badge.

Both modes share the same page template and live data flow.

**Status:** Canonical
**Locked:** 2026-05-18
**Exemplar output:** GitHub PR at `site-listing/<mls-slug>-<prefix>` branch.

---

## 1. Scope

### In scope

- `site:listing_page_create`: new route at `app/lp/listings/<mls_slug>/page.tsx`. Triggered per listing.
- `site:listing_page_update`: refresh on price change, status change (Active → Pending → Closed), new photos, or 30-day cadence.
- `site:listing_page_archive`: when a listing closes, mark the page as archived but keep it live for SEO (with a "This home sold for $X on Y" header).
- `ops:listing_pages_batch_sync`: nightly cron that walks the listings table and dispatches create/update/archive actions for every relevant SFR.
- ISR config: `export const revalidate = 3600` (1 hour) at the route level. Listing data turns over fast — even price changes mid-day should reflect within an hour.
- Live Supabase data: the single `listings` row + `listing_history` rows + filtered comps query.
- JSON-LD `RealEstateListing` schema with full property facts.
- IDX attribution component: server-rendered listing brokerage + listing agent name per Oregon RMLS rules. NON-NEGOTIABLE.
- "Schedule a showing" CTA routed correctly per mode (our listings → listing agent; OPM → buyer's agent).
- Linked-up parent community page: `/lp/listings/<mls>/` page shows the parent community context block in a sidebar.
- Photo gallery from `listings.PhotoURL` and additional URLs in the related photos table (if exposed via the feed).
- Map: property point pin on a Google Static Map, zoom 16.
- Schools: hard-coded Bend-La Pine assignment based on geo, with GreatSchools links.
- Comp set: 6-8 recent closings in the same sub-plat or same school district + price tier.
- Property fact table: bedrooms, bathrooms, total living sqft, lot size, year built, garage spaces, HOA dues, taxes, MLS number, status, days on market, price-per-sqft, original list, list price.
- Listing history: price changes, status changes from `listing_history` rows.
- Brand voice validation on all generated copy (NOT on the listing's own MLS Public Remarks — that's the listing brokerage's words and we display them verbatim).

### Out of scope

- Authoring the listing's MLS Public Remarks (that's for `listing-description` producer, only for our own listings).
- Mass photo enhancement or staging (use `virtual_staging` producer).
- The 3D tour or Matterport embed (use `site-matterport-embed`).
- The video tour (use `listing-tour-video`).
- Listing broker dashboard or transaction coordination (separate Vault-integrated tools).
- Off-market listings (no MLS row, no page).
- Land or commercial listings (SFR only for now; commercial is a future scope).

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `site:listing_page_create` | `mls_listing_id` | Creates new route. Must not exist. Listing must be in `listings` table with `PropertyType='A'`. |
| `site:listing_page_update` | `mls_listing_id`, `sections_to_update[]`, `reason` | Refreshes existing route. |
| `site:listing_page_archive` | `mls_listing_id` | Marks as archived after close. Page stays live. |
| `ops:listing_pages_batch_sync` | none | Triggered by nightly cron. Walks listings table; dispatches per-listing actions. |

### Payload schema

```typescript
interface SiteListingPagePayload {
  mls_listing_id: string;            // e.g. '220189422'
  sections_to_update?: Array<
    | 'price'
    | 'status'
    | 'photos'
    | 'remarks'
    | 'history'
    | 'comps'
    | 'meta'
    | 'jsonld'
  >;
  reason?: string;
}
```

---

## 3. Full action row schema

```typescript
interface SiteListingPageActionRow {
  id: string;
  action_type:
    | 'site:listing_page_create'
    | 'site:listing_page_update'
    | 'site:listing_page_archive'
    | 'ops:listing_pages_batch_sync';
  target: string;                    // e.g. 'mls:220189422'
  assigned_producer: 'marketing_brain_skills/producers/site-listing-page';
  payload: SiteListingPagePayload | Record<string, unknown>;
  generation_reason: string;
  status: 'pending';
}
```

---

## 4. The recipe

### 4.1 site:listing_page_create

**Step 1.** Read action row. Set `status='in_production'`.

**Step 2.** Load mandatory references:
- `CLAUDE.md` §0, §0.5, design system, brand voice
- `marketing_brain_skills/research/platform-bible.md` §24 — real-estate compliance (IDX, fair housing, NAR)
- `data/resort-communities.json` — for parent community linking
- The parent community route file IF the listing is inside one of our tracked resort communities

**Step 3.** Pull the listing row + history:

```sql
SELECT
  "ListingId", "MLSNumber", "ListPrice", "OriginalListPrice", "ClosePrice",
  "StandardStatus", "PropertyType", "PropertySubType",
  "StreetNumber", "StreetName", "City", "StateOrProvince", "PostalCode",
  "Latitude", "Longitude",
  "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt", "LotSizeAcres",
  year_built, "GarageSpaces", "PublicRemarks", "PrivateRemarks",
  "CumulativeDaysOnMarket", "DaysOnMarket",
  "AssociationFee", "AssociationFeeFrequency", "TaxAnnualAmount",
  "ListingAgentFullName", "ListAgentEmail", "ListAgentMlsId",
  "ListOfficeName", "ListOfficeMlsId",
  "PhotoURL", "AdditionalPhotoURLs",
  "SubdivisionName", "ModificationTimestamp", "ListingContractDate", "OnMarketDate",
  "VirtualTourURLUnbranded", "VirtualTourURLBranded"
FROM listings
WHERE "ListingId" = '<mls_id>';

SELECT * FROM listing_history
WHERE "ListingId" = '<mls_id>'
ORDER BY change_timestamp DESC;
```

If `listings` query returns 0 rows: kill with "Listing not found in feed. Confirm MLS# is correct and feed sync is current."

If `PropertyType != 'A'`: kill with "Non-SFR listing. Out of scope for v1."

**Step 4.** Determine mode (our listing vs OPM):

```typescript
const isOurListing = listing.ListOfficeMlsId === '<RYAN_REALTY_MLS_OFFICE_ID>'
  || listing.ListAgentEmail.endsWith('@ryan-realty.com')
```

**Step 5.** Resolve parent community (if any):

Match `listing.SubdivisionName` against `resort-communities.json` sub_neighborhoods aliases. If match found, the parent community = the community containing that sub-plat. If no match, parent = city (`bend` if `listing.City === 'Bend'`, etc.).

**Step 6.** Pull comp set:

```sql
SELECT
  "ListingId", "ClosePrice", "CloseDate",
  "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt",
  ROUND(("ClosePrice" / NULLIF("TotalLivingAreaSqFt", 0))::numeric, 0) AS price_per_sqft,
  "StreetNumber", "StreetName", "SubdivisionName"
FROM listings
WHERE "StandardStatus" IN ('Closed', 'Sold')
  AND "PropertyType" = 'A'
  AND "SubdivisionName" = ANY('<sub_aliases>'::text[])
  AND "CloseDate" >= NOW() - INTERVAL '365 days'
  AND ABS("TotalLivingAreaSqFt" - <subject_sqft>) <= 800
  AND ABS("BedroomsTotal" - <subject_beds>) <= 1
ORDER BY ABS(EXTRACT(EPOCH FROM ("CloseDate" - NOW())))
LIMIT 8;
```

If less than 3 comps available with tight criteria, widen the search progressively (drop the sub-plat filter, then the bedroom filter).

**Step 7.** Brand-voice-validate any copy this skill generates (page H1, subhead, school-block text, community context block). The MLS PublicRemarks are displayed verbatim — those are the listing brokerage's content, not ours.

**Step 8.** Scaffold the page at `app/lp/listings/<mls_slug>/page.tsx`.

The `<mls_slug>` is computed from `<MLS_NUMBER>-<URL-safe-street-address>` to give us SEO-friendly URLs that still uniquely identify the listing (e.g. `/lp/listings/220189422-61594-hosmer-lake/`).

ISR config: `export const revalidate = 3600` (1 hour).

Page structure:

1. **Topbar** (inherited from layout)
2. **Sticky scroll CTA** — "Schedule a showing" (routes per mode)
3. **Breadcrumb** — Home › Bend › <Parent Community> › <Sub-Plat> › <Address>
4. **Hero** — full-width gallery (12-20 photos from listings.PhotoURL + AdditionalPhotoURLs), photo nav arrows + keyboard, modal lightbox on click. Eyebrow shows status pill (Active / Pending / Closed). H1 shows the address. Subhead shows the price + key stats (beds/baths/sqft/lot).
5. **IDX attribution strip** — "Listed by <ListOfficeName> · <ListingAgentFullName>" on a thin navy strip. NON-NEGOTIABLE. Renders even for our own listings (where it says "Listed by Ryan Realty · Matt Ryan").
6. **Property fact table** — full MLS facts in a clean two-column layout
7. **Price + history strip** — current price + status pill + original list + days on market. If price has changed: a small "Price history" expandable with `listing_history` rows.
8. **MLS Public Remarks** — verbatim, no edits, attribution footer ("Description provided by listing brokerage")
9. **Map + drive times** — single point pin + drive-time anchors to community amenities (inherited from parent community page if exists)
10. **Schools** — Bend-La Pine school assignment with GreatSchools links
11. **Comp set** — table of 6-8 recent closings (from Step 6)
12. **Parent community context block** — compact sidebar with the parent community's master HOA, course recognition, sub-neighborhood character; "See all <Community> homes" back-link
13. **CTA section** — "Schedule a tour" form (routes to listing agent OR buyer's agent per mode)
14. **Methodology footer** — data sources, refresh cadence ("ISR 1h"), MLS attribution
15. **JSON-LD** `RealEstateListing` schema with full property facts; `RealEstateAgent` for the listing agent (our agent OR the OPM listing agent per IDX rules)

Design system: Web register (shadcn/ui only). Navy on cream. Photo gallery uses shadcn `<Dialog>` for the lightbox.

For status='Closed' listings: render an "ARCHIVED" banner at top: "This home sold for $X on <date>. Currently archived. See current Tetherow listings →"

**Step 9.** TypeScript compile, sitemap update (priority 0.6, changeFrequency 'daily'), branch + commit + PR.

**Step 10.** Write citations.json. Surface to Matt.

### 4.2 site:listing_page_update

Triggered when:
- `listings.ListPrice` changes
- `listings.StandardStatus` changes (Active → Pending or → Closed)
- New photos added
- `ModificationTimestamp` is more than 7 days newer than the page's last update

Reruns the relevant queries from Step 3 + Step 6, updates only the changed sections, commits the targeted change.

For status='Closed': automatically dispatch `site:listing_page_archive` as the update outcome.

### 4.3 site:listing_page_archive

```typescript
// Set page status to 'archived'
// Update H1 to show closed price + close date
// Hide the "Schedule a showing" CTAs
// Add the "See current listings" back-link prominently
// Keep the page live for SEO retention (closed comps are valuable)
```

### 4.4 ops:listing_pages_batch_sync (cron)

Triggered by Vercel cron `0 8 * * *` (8am UTC daily). Walks the `listings`
table and dispatches per-listing actions:

```sql
-- For every active listing not yet on the site:
SELECT "ListingId", "StreetName", "SubdivisionName"
FROM listings l
WHERE "StandardStatus" = 'Active'
  AND "PropertyType" = 'A'
  AND ("SubdivisionName" = ANY('<tracked_communities>'::text[]) OR "City" = 'Bend')
  AND NOT EXISTS (
    SELECT 1 FROM listing_pages_index WHERE listing_id = l."ListingId"
  );

-- For every listing whose row was modified in the last 24 hours:
SELECT "ListingId", "StandardStatus", "ListPrice", "ModificationTimestamp"
FROM listings
WHERE "ModificationTimestamp" > NOW() - INTERVAL '24 hours'
  AND EXISTS (SELECT 1 FROM listing_pages_index WHERE listing_id = "ListingId");

-- For every listing that closed in the last 24 hours:
SELECT "ListingId"
FROM listings
WHERE "StandardStatus" IN ('Closed', 'Sold')
  AND "ContractStatusChangeDate" >= NOW() - INTERVAL '24 hours'
  AND EXISTS (SELECT 1 FROM listing_pages_index WHERE listing_id = "ListingId");
```

For each result row, insert a new action into `marketing_brain_actions` with
the appropriate `site:listing_page_*` type. The brain picks them up and runs
this producer.

`listing_pages_index` is a small Supabase table this skill maintains
(created in the setup phase) that tracks which listings have site pages and
when they were last updated.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | listings + history + comps queries; listing_pages_index | standard |
| Read | resort-communities.json, parent community page, brand voice | repo |
| Write / Edit | listing route, sitemap | working tree |
| Bash: curl | Google Static Maps + Google Routes API | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Bash: tsc | TypeScript compile | repo |
| Bash: git, gh | branch + PR | gh session |

---

## 6. Output format

**Draft lands at:** GitHub PR (one per listing for create; one per batch for batch sync).

```
app/lp/listings/<mls_slug>/page.tsx
app/sitemap.ts (one entry added per page)
public/lp/listings/<mls_slug>/img/<slug>-map.png
out/site-listing/<mls_slug>/citations.json
```

**Surface format (chat reply to Matt):**

```
Listing page ready: /lp/listings/<mls_slug>/

  PR
    URL: <pr_url>
    Branch: site-listing/<mls_slug>-<prefix>

  LISTING
    MLS#: <number>
    Address: <full address>
    Price: $<list_price> (status: <Active|Pending|Closed>)
    Beds/Baths/Sqft: <b>/<ba>/<sqft>
    Year built: <year>
    Subdivision: <sub_name>
    Parent community: <community_name OR "Bend (no resort community)">
    Mode: <"Our listing" | "OPM (Listed by <broker>)">

  DATA SOURCES (ISR 1h)
    listings row -> 1
    listing_history rows -> <n>
    Comp set (last 12mo, sub-plat-tight) -> <n>

  VALIDATION
    Voice: PASS (generated copy only; MLS Remarks display verbatim)
    TypeScript: PASS
    IDX attribution: PASS (listing brokerage + agent shown)
    JSON-LD: RealEstateListing + RealEstateAgent

Matt merges the PR in GitHub to ship.
```

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-review-PR` | Matt merges the GitHub PR | Matt only |

For batch sync mode, each individual page is its own PR (or grouped into a daily batch PR with up to 20 pages). Matt reviews and merges.

---

## 8. Status flow

Same as `site-community-page`: pending → in_production → ready → approved → executed → measured.

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Listing not in feed | listings query 0 rows | Kill |
| Non-SFR | PropertyType != 'A' | Kill |
| Route already exists (create) | File found | Kill; suggest update |
| Photo URL dead | PhotoURL returns 404 | Use placeholder gray card; note in PR |
| IDX attribution data missing | ListAgentFullName or ListOfficeName null | Kill — cannot ship without attribution |
| Comp set empty | < 1 comp after widening | Render with "No recent comps available" note |
| Voice fail | banned word in generated copy | Kill after 2 iterations |
| TypeScript fail | type error | Kill after 2 iterations |
| Parent community unresolvable | SubdivisionName doesn't match resort-communities.json AND City != 'Bend' | Render without the community context block; note in PR |

---

## 10. Related skills and references

**Required reading:**

- `CLAUDE.md` §0, §0.5
- `marketing_brain_skills/research/platform-bible.md` §24 — IDX + fair housing + NAR compliance (NON-NEGOTIABLE)
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `data/resort-communities.json`
- `docs/DATABASE_FOR_AI_AGENTS.md` — listings table columns

**Sibling producers:**

- `site-community-page` — parent of this skill's output (Tier 2 → Tier 4)
- `site-subdivision-page` — between this skill and the community page
- `site-property-landing` — older sibling, for OUR listings only (this skill supersedes it; site-property-landing handles single-page-only conversion-optimized layouts for active OUR listings only; this skill handles SEO-authority layouts for ALL listings)

**Related content producers (one tier up — content created for the same listing):**

- `listing-tour-video` — the video that can embed on the listing page
- `listing_reveal` — short reel that can embed
- `flyer-design` — for the flyer download CTA
- `site-matterport-embed` — for the 3D tour embed
- `virtual_staging` — if the listing has empty rooms

**Registry entry:**

- `marketing_brain_skills/producers/REGISTRY.md` — Section D, row `site-listing-page`.

---

## 11. Tool gap suggestions

1. **Auto-stitched 3D tour from photos.** Use a photogrammetry pipeline to generate a basic 3D tour from the listing photos when no Matterport exists. Lifts every OPM listing into the visual quality tier of our own listings.

2. **Address-level GeoCoder consistency.** Today the listing's lat/lng comes from the MLS feed which sometimes geocodes to the wrong side of a street. A second-pass geocode via Google Maps API would give a more accurate pin.

3. **Owner identity badge from public records.** For OPM listings where the owner is a builder or a recognizable brand (Pahlisch, etc.), surfacing that on the page adds authority. Sourced from county assessor records.

4. **Per-listing analytics dashboard.** A small admin view at `/admin/listings/<mls_slug>` showing impressions (GA4), clicks (GSC), showing requests (FUB), and time-on-page. Lets Matt see which OPM listings are winning the SERP.

5. **Daily SERP delta tracker.** A small cron that checks Google for each listing's address query and reports our SERP position vs. Zillow, Realtor.com, Redfin, and the listing brokerage. Surface to Matt as a weekly digest.

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `marketing_brain_skills/research/platform-bible.md` §24 (IDX/fair housing/NAR compliance)
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `data/resort-communities.json`
- `docs/DATABASE_FOR_AI_AGENTS.md`
