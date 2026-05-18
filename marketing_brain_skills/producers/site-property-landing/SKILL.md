---
name: site-property-landing
description: >
  Scaffolds a per-listing landing page on ryan-realty.com at the slug route
  `/listings/<address-slug>` (e.g. `/listings/1234-nw-riverview-dr`). The page is a
  dedicated marketing surface for one MLS-active listing: hero photo + Amboqia
  headline + price line + 4-spec row, sticky right-rail showing-request form posting
  to FUB, full MLS photo gallery with lightbox, video embed (if a listing video
  exists), 3D Matterport tour embed (if available), floor plan PDF embed (if
  available), sanitized PublicRemarks, full specs grid, neighborhood + market +
  school context blocks, and an embedded ManyChat widget. Pulled from MLS, Zillow,
  Realtor.com, IG bio, email blast, and GBP post. Stays live through close and
  remains as an archived "Sold" page after close.  URL preserved for SEO long-tail.
  Voice and data accuracy enforced per CLAUDE.md §0 (every figure traces) and
  voice_guidelines.md (banned vocab stripped from PublicRemarks). shadcn/ui only
  per CLAUDE.md "Design System Rules.  MANDATORY." Use whenever Matt says "property
  landing page for <address>", "build the landing page for <MLS#>", "listing landing
  page for <address>", or "property page for <address>". For a brand-new informational
  page route (not per-listing), use `site-page-create` instead.
when_to_use: |
  Trigger when Matt says any of:
  - "property landing page for <address>"
  - "build the landing page for <MLS#>"
  - "listing landing page for <address>"
  - "property page for <address>"
  - "make the landing page for <MLS#>"
  - "/property-landing <address-or-MLS#>"
  - "update the landing page for <address>" (action_type: `site:property_landing_update`)
  - "refresh the landing page for <MLS#>" (action_type: `site:property_landing_update`)
action_types:
  - site:property_landing_create
  - site:property_landing_update
output_type: web-page
target_platforms: ["agentfire_blog"]
asset_destination: app/ (Next.js) via GitHub PR; opens PR to main for matt-review-PR approval
auto_inputs: ["design system v2 tokens", "shadcn/ui components", "site routing"]
required_inputs: ["page_slug OR neighborhood_slug"]
optional_inputs: ["hero_image_override", "schema_overrides"]
estimated_runtime_min: 20
cost_usd_estimate: $0.50-$2 per page (Anthropic for copy + JSON-LD scaffold)
thumbnail_uri: out/proof/2026-05-17/exemplars/<slug>/sample.html
example_outputs: []
    label: "live neighborhood pages"
    surface: "agentfire_blog"
---

# Site Property Landing Producer

**Status:** Canonical  
**Locked:** 2026-05-17  


**Scope.** Creates (or updates) a per-listing marketing landing page at
`/listings/<address-slug>` on ryan-realty.com. Page contains hero + sticky
showing-request form + photo gallery + video/3D-tour/floor-plan embeds + sanitized
description + specs grid + neighborhood/market/school context + ManyChat widget +
footer. Every figure on the page traces to a verified Supabase listing row per
CLAUDE.md §0. PR opened on `main` per single-checkout workflow; Matt merges via
GitHub UI.

**Status.** Canonical. Locked 2026-05-14.

**Producer category.** Section C.  Site Producer (PR-based).

**Exemplar output.** GitHub PR URL in `executor_response.pr_url`.

---

## 1. Scope

### In scope
- `site:property_landing_create`.  scaffold a new page at `app/listings/<slug>/page.tsx`
  with per-listing components in `app/listings/<slug>/_components/`
- `site:property_landing_update`.  refresh an existing per-listing page (price,
  specs, photos, status, schema) when the underlying Supabase row has drifted
- Adding the new URL to `app/sitemap.ts`
- Mirroring MLS photos into `public/listings/<slug>/` if not served via Spark CDN
- Setting `export const metadata` for SEO (title, description, OG, canonical, Twitter)
- Emitting `RealEstateListing` JSON-LD with verified property data
- Sanitizing `PublicRemarks` against the banned vocab union before render
- Wiring the showing-request form to `app/actions/lead-capture.ts` with FUB tag
- Embedding the ManyChat widget (DETAILS / SHOWING / OPENHOUSE keyword triggers)
- TypeScript compile verification (`npx tsc --noEmit`) before PR opens
- Branch + PR creation; Matt merges via GitHub UI

### Out of scope
- Editing the generic `/listings/[listingKey]` dynamic route → that lives in
  `app/listings/[listingKey]/page.tsx` and is not this producer's surface
- Status transitions (Active → Pending → Sold) after the page is live.  handled by
  a separate `site-property-landing-status` workflow or by `site-property_landing_update`
  on the next scheduled refresh
- Per-listing video production → `video_production_skills/listing-tour-video`
- Matterport tour creation → `marketing_brain_skills/producers/ops-matterport-embed`
- ManyChat flow configuration → `marketing_brain_skills/producers/ops-manychat`
- Generic informational pages (not per-listing) → `site-page-create`
- Performance fixes / redirects / schema on existing pages → `site-performance`

---

## 2. Action types handled

| action_type | required payload fields | notes |
|---|---|---|
| `site:property_landing_create` | `mls_id` | Scaffolds new page; fails fast if `app/listings/<slug>/page.tsx` already exists |
| `site:property_landing_update` | `mls_id` | Refreshes existing page; fails fast if route does not exist |

### Payload schema

```typescript
interface SitePropertyLandingPayload {
  mls_id: string                  // required.  the "MlsId" value (e.g. "220189422")
  // No other payload fields are required. The producer pulls every other field
  // (address, price, beds, baths, sqft, photos, etc.) from Supabase in this session.
  // Per CLAUDE.md §0: never inherit numbers from the action row's payload.
}
```

Per CLAUDE.md "Supabase listings Schema": every mixed-case column must be
double-quoted in SQL or the query returns "column does not exist."

---

## 3. Full action row schema

```typescript
interface SitePropertyLandingActionRow {
  id: string                              // uuid
  action_type: 'site:property_landing_create' | 'site:property_landing_update'
  target: string                          // 'mls:<MlsId>' (e.g. 'mls:220189422')
  assigned_producer: 'marketing_brain_skills/producers/site-property-landing'
  payload: SitePropertyLandingPayload
  data_evidence?: {
    audit_source?: string                 // e.g. 'listing_trigger', 'audit-website'
    opportunity_area?: string             // e.g. 'new at-Active listing needs a landing page'
    signal_evidence?: string              // e.g. 'listings INSERT fired 2026-05-14T14:30Z'
  }
  generation_reason: string
  status: 'pending'
}
```

---

## 4. The recipe

### Step 1.  Claim the action row

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<id>' AND status = 'pending'
RETURNING id;
```

If `RETURNING` is empty, another producer claimed the row. Stop and report.

### Step 2.  Load mandatory references

Before reading the Supabase row:
- `CLAUDE.md` §0.  Data Accuracy mandate (outranks everything)
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last (PR is the draft)
- `CLAUDE.md` "Design System Rules.  MANDATORY".  shadcn/ui only; no raw HTML UI
- `CLAUDE.md` "Design System v2.  Heritage + Web Registers".  Web register applies
- `CLAUDE.md` "Supabase listings Schema".  mixed-case column quoting
- `design_system/ryan-realty/SKILL.md`.  color tokens, type tiers, asset paths
- `design_system/ryan-realty/colors_and_type.css`.  CSS variable definitions
- `marketing_brain_skills/brand-voice/voice_guidelines.md`.  voice + banned vocab union
- `app/actions/lead-capture.ts`.  server-action signature for the showing form
- `app/sitemap.ts`.  existing sitemap structure to extend
- `app/listings/[listingKey]/page.tsx`.  reference for the listing data-pull pattern

### Step 3.  Pull the listing record from Supabase

```sql
SELECT
  "MlsId",
  "StreetNumber", "StreetName", "City", "PostalCode",
  "ListPrice",
  "StandardStatus",
  "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt",
  "Latitude", "Longitude",
  year_built,
  "PhotoURL",
  "PublicRemarks",
  "ListAgentFullName", "ListAgentEmail",
  "ListOfficeName",
  "SubdivisionName",
  "CumulativeDaysOnMarket",
  price_per_sqft,
  "LotSizeAcres",
  "PropertyType"
FROM listings
WHERE "MlsId" = '<mls_id>'
LIMIT 1;
```

If zero rows: `status='killed'`, `executor_response={"error":"MLS# <mls_id> not found in listings"}`, stop.

If `"StandardStatus"` is not in the at-Active set (`'Active'`, `'Active Under Contract'`,
`'Pending'`, `'Closed'`): surface the status and confirm Matt wants a landing page
for a non-active listing before proceeding. `Closed` is allowed.  sold-archive pages
preserve URL for SEO long-tail.

### Step 4.  Compute the slug

```
<street-number>-<street-name-kebab-lowercase>
# Example: "1234" + " NW Riverview Dr" → "1234-nw-riverview-dr"
```

Slug rules:
- Lowercase everything
- Replace whitespace with `-`
- Strip every character outside `[a-z0-9-]`
- Collapse double hyphens
- Trim leading/trailing hyphens

Confirm the slug is unique within `app/listings/`:
- For `site:property_landing_create`: if `app/listings/<slug>/page.tsx` already exists,
  set `status='killed'`, `executor_response={"error":"Route already exists","route":"/listings/<slug>"}`,
  stop. Suggest `site:property_landing_update` instead.
- For `site:property_landing_update`: if the route does NOT exist, set `status='killed'`,
  surface; suggest `site:property_landing_create` instead.
- For genuine slug collisions (different MlsId, same address), append the last 4 chars
  of the MlsId: `1234-nw-riverview-dr-9422`. Document in PR description.

### Step 5.  Verify every figure (data accuracy gate)

Per CLAUDE.md §0, produce one verification trace per figure that will render on the page:

```
$895,000.  Supabase listings, MlsId='220189422', ListPrice=895000, fetched 2026-05-14T14:32:00Z
4 bd.  Supabase listings, MlsId='220189422', BedroomsTotal=4
3 ba.  Supabase listings, MlsId='220189422', BathroomsTotal=3.0
2,840 sqft.  Supabase listings, MlsId='220189422', TotalLivingAreaSqFt=2840
1.20 acres.  Supabase listings, MlsId='220189422', LotSizeAcres=1.20
Built 1998.  Supabase listings, MlsId='220189422', year_built=1998
$315/sqft.  Supabase listings, MlsId='220189422', price_per_sqft=315
12 days.  Supabase listings, MlsId='220189422', CumulativeDaysOnMarket=12
```

Every figure that appears anywhere on the page (hero, specs grid, market context,
schema.org JSON-LD) gets a trace. Numbers that can't be verified are omitted.  not
estimated, not "approximately." Per CLAUDE.md §0 forbidden list.

**Rounding rules (per voice_guidelines.md):**
- Currency rounded to the nearest thousand: `$895,000` not `$894,750`
- Days = integer + "days": `12 days`
- Acres to 2 decimals: `1.20 acres`
- Sqft with commas: `2,840 sqft`
- Percents: one decimal, signed arrow: `↑ 4.2% YoY`
- Unavailable data → em-dash `. ` placeholder (the only allowed em-dash usage)

### Step 6.  Sanitize PublicRemarks

`PublicRemarks` is MLS-supplied prose. Run it through the banned vocab union before
rendering. Banned word list (voice_guidelines.md + CLAUDE.md):

- Real-estate clichés: stunning, nestled, boasts, charming, pristine, gorgeous,
  breathtaking, must-see, dream home, meticulously maintained, entertainer's dream,
  tucked away, hidden gem, truly, spacious, cozy, luxurious, updated throughout,
  turnkey, immaculate, captivating, exquisite, premier, luxury, boutique, concierge,
  white-glove, passionate, dedicated
- AI filler: delve, leverage, tapestry, navigate, robust, seamless, comprehensive,
  elevate, unlock, holistic, dynamic, vibrant, bustling, eclectic, curated, bespoke,
  foster
- Vague qualifiers: approximately, roughly, about, around, fairly, somewhat, may,
  could, potentially
- Punctuation: em-dashes (as punctuation), semicolons, exclamation marks in body
- Banned phrases: "your real estate journey", "won't last long", "act fast",
  "won't last", "don't worry"

**Sanitization rule.** Strip entire sentences containing banned vocab.  do not
paraphrase MLS content (rewriting another agent's listing prose is non-compliant and
introduces MLS dispute risk). If sanitization leaves the field empty, render an
empty description block.  do not invent prose. Per CLAUDE.md "Voice + content":
"Honest. Transparent. Trustworthy. Direct and kind. Show, don't tell."

### Step 7.  Pull neighborhood, market, and school context

**Neighborhood context** (1-2 paragraphs):

```sql
SELECT description
FROM subdivision_descriptions
WHERE subdivision_slug = lower(replace('<SubdivisionName>', ' ', '-'))
LIMIT 1;
```

If no row: skip the section (do not invent prose).

**Attractions** (3-5 nearby points of interest):

```sql
SELECT name, category, distance_miles
FROM place_attractions
WHERE city = '<City>'
ORDER BY ST_Distance(
  ST_MakePoint(longitude, latitude)::geography,
  ST_MakePoint(<Longitude>, <Latitude>)::geography
) ASC
LIMIT 5;
```

**Market context** (1-2 city/neighborhood stats):

```sql
SELECT median_sale_price, median_days_on_market, yoy_price_pct, period_label
FROM market_pulse_live
WHERE city = '<City>'
  AND property_type = 'A'
ORDER BY period_end DESC
LIMIT 1;
```

Every stat used on the page gets a verification trace per Step 5. If the row is
missing or stale (`period_end` older than 60 days), skip the market section.

**School district info.** Resolve via `place_attractions` rows where
`category = 'school'`, or via an external schools API if configured (`GREATSCHOOLS_API_KEY`).
If neither is available, render only the school district name (from the listing
row if present).  do not invent ratings.

### Step 8.  Scaffold the page files

Create the file tree under `app/listings/<slug>/`:

```
app/listings/<slug>/
├── page.tsx                          ← main route component (server component)
├── _components/
│   ├── PropertyHero.tsx              ← hero photo + headline + price + 4-spec row
│   ├── ShowingScheduler.tsx          ← sticky right-rail / bottom-drawer FUB form
│   ├── PhotoGallery.tsx              ← lightbox-enabled MLS gallery
│   ├── VideoEmbed.tsx                ← conditional listing-tour-video iframe
│   ├── MatterportEmbed.tsx           ← conditional 3D tour iframe + fallback CTA
│   ├── FloorPlanEmbed.tsx            ← conditional PDF embed
│   ├── PropertyDescription.tsx       ← sanitized PublicRemarks block
│   ├── SpecsGrid.tsx                 ← full feature list from listings row
│   ├── NeighborhoodContext.tsx       ← subdivision_descriptions + place_attractions
│   ├── MarketContext.tsx             ← city/neighborhood stats from market_pulse_live
│   ├── SchoolDistrict.tsx            ← schools block
│   ├── ManychatWidget.tsx            ← embedded chat with keyword triggers
│   └── PropertyFooter.tsx            ← navy band, broker contact, MLS#, Equal Housing
└── _data/
    └── listing.json                  ← snapshot of the Supabase row + verification traces
```

Mirror photos (if MLS CDN not used):

```
public/listings/<slug>/
├── photo-001.jpg
├── photo-002.jpg
└──... (one file per "PhotoURL" array entry)
```

### Step 9.  Build the page structure

**Top-of-file metadata block** (in `app/listings/<slug>/page.tsx`):

```typescript
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
// per-page components from./_components/*

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const slug = '<slug>'
const address = '<StreetNumber> <StreetName>'
const fullAddress = `${address}, <City>, OR <PostalCode>`
const price = '$<price-rounded>'
const ogImage = `${siteUrl}/listings/${slug}/photo-001.jpg`

export const metadata: Metadata = {
  title: `${address}.  ${price} · <City>, OR | Ryan Realty`,
  description: '<first 160 chars of sanitized PublicRemarks>',
  alternates: { canonical: `${siteUrl}/listings/${slug}` },
  openGraph: {
    title: `${address}.  ${price} · <City>, OR`,
    description: '<first 160 chars of sanitized PublicRemarks>',
    url: `${siteUrl}/listings/${slug}`,
    type: 'website',
    siteName: 'Ryan Realty',
    images: [{ url: ogImage, width: 1200, height: 630, alt: `${address}.  ${price}` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${address}.  ${price}`,
    description: '<first 160 chars of sanitized PublicRemarks>',
    images: [ogImage],
  },
}
```

**Page body order (top → bottom):**

| # | Section | Component | Notes |
|---|---|---|---|
| 1 | Hero | `<PropertyHero>` | Full-bleed photo + Amboqia H1 address + Geist 28px price line + 4-spec row (bd · ba · sqft · acres) |
| 2 | Sticky scheduler | `<ShowingScheduler>` | Right rail on desktop (`lg:` breakpoint), bottom drawer on mobile via `<Sheet>` |
| 3 | Photo gallery | `<PhotoGallery>` | Lazy-loaded grid, lightbox via `<Dialog>` |
| 4 | Video embed | `<VideoEmbed>` | Conditional on `listing_videos` row presence |
| 5 | 3D tour embed | `<MatterportEmbed>` | Conditional; falls back to "Schedule a virtual showing" `<Button>` |
| 6 | Floor plan | `<FloorPlanEmbed>` | Conditional PDF embed |
| 7 | Description | `<PropertyDescription>` | Sanitized PublicRemarks (banned vocab stripped per Step 6) |
| 8 | Specs grid | `<SpecsGrid>` | Full feature list.  2-column responsive grid using `<Card>` cells |
| 9 | Neighborhood | `<NeighborhoodContext>` | Conditional on `subdivision_descriptions` row + `place_attractions` |
| 10 | Market context | `<MarketContext>` | Conditional on fresh `market_pulse_live` row (≤60 days) |
| 11 | Schools | `<SchoolDistrict>` | Conditional on data availability |
| 12 | ManyChat widget | `<ManychatWidget>` | Keyword triggers: DETAILS, SHOWING, OPENHOUSE |
| 13 | Footer | `<PropertyFooter>` | Navy band, broker contact, MLS# disclosure, Equal Housing |

**Design system constraints (shadcn/ui only.  CLAUDE.md):**

- Background: `bg-background` (cream `#faf8f4` via CSS var)
- Hero H1: Amboqia Boriango.  apply via `font-display` utility or the `--font-display` CSS var
- All other text: Geist (default `font-sans`.  loaded via `next/font/geist` in `app/layout.tsx`)
- Primary CTA: `<Button variant="default">`.  `bg-primary text-primary-foreground`
- Cards: `<Card>` from `@/components/ui/card`.  never raw `<div className="rounded...">`
- Form inputs: `<Input>`, `<Textarea>`, `<Label>`.  never raw `<input>` / `<textarea>` / `<label>`
- Lightbox: `<Dialog>` from `@/components/ui/dialog`.  never custom modal divs
- Mobile drawer: `<Sheet>` from `@/components/ui/sheet`
- Numbers: every `<span>` containing a price/count/day/pct gets `font-variant-numeric: tabular-nums`
- Navy `#102742`: `text-primary` / `bg-primary`.  never `text-[#102742]` or `bg-[#102742]`
- No gold (`#D4AF37`, `#C8A864`) anywhere.  retired in v2 brand
- Radii: `rounded-lg` (10px), `rounded-xl` (14px), `rounded-2xl` (18px)
- Shadows: `shadow-sm`, `shadow-md` (navy-tinted via CSS var)
- Focus ring: 3px warm stone (already configured in tokens.  do not override)
- Broker headshot: resolve `ListAgentEmail` → `matt-ryan` / `paul-stevenson` / `rebecca-peterson`,
  use the transparent PNG from `design_system/ryan-realty/assets/team/<slug>.png`

### Step 10.  Wire the showing-request form to FUB

Inspect `app/actions/lead-capture.ts` for the current server-action signature.
Use a server action (`'use server'`) pattern matching the existing codebase. Do NOT
write a custom fetch to an API route if a server action exists.

Form fields (5-field FUB form):

| field | type | required | FUB mapping |
|---|---|---|---|
| `name` | `<Input type="text">` | yes | `firstName` + `lastName` (split on space) |
| `email` | `<Input type="email">` | yes | `emails[0].value` |
| `phone` | `<Input type="tel">` | yes | `phones[0].value` |
| `preferred_time` | `<Input type="datetime-local">` | yes | `notes` prefix `"Preferred showing time:..."` |
| `message` | `<Textarea>` | no | `notes` body |

Tag the FUB lead with `landing-<slug>` and `mls-<MlsId>` for attribution. Source
field: `Property Landing Page`. Pipeline: `Buyer Lead` (or whichever the existing
lead-capture action uses by default).

Success message (no clichés, no exclamation marks): `Got it. <Broker first name> will be in touch within the day.`

### Step 11.  Emit RealEstateListing JSON-LD

Inject a `<script type="application/ld+json">` block in the page head with the
`RealEstateListing` schema (schema.org `RealEstateListing` extends `Product`):

```typescript
const schema = {
  '@context': 'https://schema.org',
  '@type': 'RealEstateListing',
  url: `${siteUrl}/listings/${slug}`,
  name: address,
  description: sanitizedPublicRemarks,
  image: photoUrls,
  offers: {
    '@type': 'Offer',
    price: listPrice,
    priceCurrency: 'USD',
    availability: standardStatusToSchema(standardStatus),
  },
  address: {
    '@type': 'PostalAddress',
    streetAddress: address,
    addressLocality: city,
    addressRegion: 'OR',
    postalCode: postalCode,
    addressCountry: 'US',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: latitude,
    longitude: longitude,
  },
  numberOfRooms: bedroomsTotal,
  numberOfBathroomsTotal: bathroomsTotal,
  floorSize: { '@type': 'QuantitativeValue', value: totalLivingAreaSqFt, unitCode: 'FTK' },
  yearBuilt: yearBuilt,
}
```

`standardStatusToSchema()` maps: `Active` → `InStock`, `Pending` → `PreOrder`,
`Closed` → `OutOfStock`. Every field in the schema traces to a Step 5 verification
trace.  no fabricated geo, no fabricated yearBuilt.

### Step 12.  Add the URL to sitemap

Read `app/sitemap.ts`. Append:

```typescript
{
  url: `${siteUrl}/listings/${slug}`,
  lastModified: new Date(),
  changeFrequency: 'weekly',
  priority: 0.8,
}
```

Property landing pages get `priority: 0.8` (between home `1.0` and informational `0.7`).
`changeFrequency: 'weekly'` reflects status / price drift cadence.

### Step 13.  TypeScript compile check

```bash
cd /Users/matthewryan/RyanRealty && npx tsc --noEmit 2>&1
```

If TypeScript errors:
- Do NOT push the branch
- Fix errors (type imports, missing return types, invalid props)
- Max 2 auto-iterations. After 2 failures, `status='killed'`, surface tsc output

### Step 14.  Write citations.json and the data snapshot

Write `app/listings/<slug>/_data/listing.json` containing:
- The full Supabase row (immutable snapshot for the page render)
- The list of `verification_traces` from Step 5
- `fetched_at_iso` timestamp
- `design_system_version` reference

This file is checked into the repo with the page. The page renders from this
snapshot, not from a live query on every request. The next `site:property_landing_update`
action refreshes the snapshot.

### Step 15.  Branch, commit, push, open PR

```bash
# Branch name: site-property-landing/<slug>
git checkout -b site-property-landing/<slug>

git add app/listings/<slug>/ \
        app/sitemap.ts \
        public/listings/<slug>/

git commit -m "$(cat <<'EOF'
site-property-landing(<slug>): scaffold landing page for <address>

MLS#: <MlsId>
Status: <StandardStatus>
Price: $<price>
Specs: <bd> bd · <ba> ba · <sqft> sqft · <acres> acres
Route: /listings/<slug>
Action row: <action_id>

Verification:
- Every figure traces to Supabase listings row (see _data/listing.json)
- PublicRemarks sanitized against banned vocab union
- TypeScript clean (npx tsc --noEmit)
- shadcn/ui only; no raw HTML UI
- RealEstateListing JSON-LD emitted
- Sitemap updated

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

git push origin site-property-landing/<slug>

gh pr create \
  --title "site-property-landing(<slug>): <address>.  <price>" \
  --body "$(cat <<'EOF'
## Summary
- New route: `/listings/<slug>`
- Address: <StreetNumber> <StreetName>, <City>, OR <PostalCode>
- Price: $<price-rounded>
- Specs: <bd> bd · <ba> ba · <sqft> sqft · <acres> acres
- MLS#: <MlsId>
- Status: <StandardStatus>
- Action row: <action_id>

## Files
- `app/listings/<slug>/page.tsx` (new)
- `app/listings/<slug>/_components/*.tsx` (new.  13 components)
- `app/listings/<slug>/_data/listing.json` (data snapshot + verification traces)
- `app/sitemap.ts` (updated)
- `public/listings/<slug>/photo-*.jpg` (MLS photo mirror)

## Page sections
1. Hero (full-bleed photo, Amboqia H1, price, 4-spec row)
2. Sticky showing-request form (right rail desktop, bottom drawer mobile)
3. Photo gallery (lightbox)
4. Video embed: <yes.  listing-tour-video / no>
5. 3D tour embed: <yes.  Matterport / no.  falls back to virtual showing CTA>
6. Floor plan: <yes.  PDF / no>
7. Description (PublicRemarks, sanitized)
8. Specs grid
9. Neighborhood context: <yes.  <subdivision> + N attractions / no>
10. Market context: <yes.  <City> · <period_label> / no.  data stale or missing>
11. School district info
12. ManyChat widget (DETAILS / SHOWING / OPENHOUSE)
13. Footer (broker contact, MLS#, Equal Housing)

## Data accuracy (CLAUDE.md §0)
<N> figures verified against Supabase listings row MlsId='<MlsId>'. Full traces in
`app/listings/<slug>/_data/listing.json` → `verification_traces`. No "approximately,"
no estimates, no inherited numbers.

## Voice (voice_guidelines.md)
PublicRemarks sanitized.  <N> banned-word sentences stripped. Page copy direct,
specific, no clichés, no exclamation marks in body, no em-dashes or semicolons.

## Design system
shadcn/ui only. No raw HTML UI elements. No hex overrides. Navy primary + cream
background per v2 spec. No gold. Hero uses Amboqia Boriango display; all other text
uses Geist. Tabular numerals on every numeric span.

## SEO
- Title: `<address>.  $<price> · <city>, OR | Ryan Realty`
- Description: first 160 chars of sanitized PublicRemarks
- Canonical: `https://ryan-realty.com/listings/<slug>`
- OG image: `photo-001.jpg`
- JSON-LD: `RealEstateListing` with verified property data

## TypeScript
`npx tsc --noEmit` returned zero errors.

## Approval gate
Matt merges this PR via GitHub UI. The page goes live on the next Vercel deploy.

Generated with Claude Code / marketing brain.  site-property-landing producer
EOF
)"
```

### Step 16.  Update the action row to 'ready'

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = jsonb_build_object(
      'branch_name', 'site-property-landing/<slug>',
      'pr_url', '<pr_url>',
      'route', '/listings/<slug>',
      'mls_id', '<MlsId>',
      'address', '<full address>',
      'files_changed', jsonb_build_array(
        'app/listings/<slug>/page.tsx',
        'app/sitemap.ts'
      ),
      'verification_trace_count', <N>,
      'voice_sanitized', true,
      'tsc_clean', true
    )
WHERE id = '<id>';
```

### Step 17.  Surface to Matt

See §6 for the exact surface format. Then stop. Wait for Matt to merge the PR.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | listing pull, market/attractions/subdivision pulls, action row updates | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Read (file) | `app/actions/lead-capture.ts`, `app/sitemap.ts`, `app/listings/[listingKey]/page.tsx` |.  |
| Write (file) | create `app/listings/<slug>/page.tsx` and 13 `_components/*.tsx` files |.  |
| Edit (file) | append entry to `app/sitemap.ts` |.  |
| Bash: `npx tsc --noEmit` | TypeScript compile check | runs in `/Users/matthewryan/RyanRealty` |
| Bash: `curl` or fetch | mirror MLS photos into `public/listings/<slug>/` |.  |
| Bash: git checkout / add / commit / push | branch and stage |.  |
| Bash: `gh pr create` | open GitHub PR | active `gh` session |
| Optional: `GREATSCHOOLS_API_KEY` | school district context | `.env.local` |

---

## 6. Output format

**Draft lands at:** GitHub PR (branch `site-property-landing/<slug>`).

**Files produced:**

```
app/listings/<slug>/
├── page.tsx                          (new)
├── _components/
│   ├── PropertyHero.tsx              (new)
│   ├── ShowingScheduler.tsx          (new)
│   ├── PhotoGallery.tsx              (new)
│   ├── VideoEmbed.tsx                (new)
│   ├── MatterportEmbed.tsx           (new)
│   ├── FloorPlanEmbed.tsx            (new)
│   ├── PropertyDescription.tsx       (new)
│   ├── SpecsGrid.tsx                 (new)
│   ├── NeighborhoodContext.tsx       (new)
│   ├── MarketContext.tsx             (new)
│   ├── SchoolDistrict.tsx            (new)
│   ├── ManychatWidget.tsx            (new)
│   └── PropertyFooter.tsx            (new)
└── _data/
    └── listing.json                  (new.  data snapshot + verification traces)

app/sitemap.ts                        (modified.  one new entry)
public/listings/<slug>/photo-*.jpg    (new.  MLS photo mirror)
```

**Surface format (present to Matt exactly like this):**

```
Draft ready: site-property-landing.  <address>

  PR
    URL: <pr_url>
    Branch: site-property-landing/<slug>

  PAGE
    Route: /listings/<slug>
    MLS#: <MlsId>
    Status: <StandardStatus>
    Price: $<price-rounded>
    Specs: <bd> bd · <ba> ba · <sqft> sqft · <acres> acres
    Year built: <year_built>
    DOM: <CumulativeDaysOnMarket> days
    Listing agent: <ListAgentFullName>

  EMBEDS
    Video:       <yes / no>
    3D tour:     <yes / no.  fallback CTA in place>
    Floor plan:  <yes / no>
    ManyChat:    yes (DETAILS, SHOWING, OPENHOUSE)

  VERIFICATION TRACE
    <N> figures verified.  app/listings/<slug>/_data/listing.json:
    - $<price> ListPrice.  Supabase listings, MlsId='<MlsId>', fetched <iso>
    - <N> bd.  Supabase listings, BedroomsTotal=<N>
    - <N> ba.  Supabase listings, BathroomsTotal=<N>
    - <N> sqft.  Supabase listings, TotalLivingAreaSqFt=<N>
    - <N> acres.  Supabase listings, LotSizeAcres=<N>
    - Built <year>.  Supabase listings, year_built=<N>
    - $<N>/sqft.  Supabase listings, price_per_sqft=<N>

  VOICE
    PublicRemarks: <N> banned-word sentences stripped
    Page copy:     PASS.  no clichés, no banned punctuation

  SITEMAP
    app/sitemap.ts updated with /listings/<slug>

  VALIDATION
    TypeScript:    PASS (npx tsc --noEmit, zero errors)
    Design tokens: PASS.  shadcn/ui only, no hex overrides
    JSON-LD:       PASS.  RealEstateListing emitted with verified data

Matt merges the PR via GitHub UI to ship. The page goes live on the next Vercel deploy.
```

Then stop. Do not commit to `main`. Do not push to `main`. Wait for the GitHub merge.

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-review-PR` | Matt merges the PR via GitHub UI | Matt only |

**This producer uses:** `matt-review-PR`.

Per CLAUDE.md "Draft-First, Commit-Last": the PR IS the draft. A successful
TypeScript compile is not approval. A passing voice validation is not approval.
The branch sitting on GitHub awaiting merge is the surface. Matt's merge is the
go-ahead.

Per CLAUDE.md "Always push directly to main": this is the one exception.  site
producers open a PR (single-checkout, PR-based workflow for ryan-realty.com
changes). The branch lives on `origin/site-property-landing/<slug>` until merged
back to `main`. The local checkout stays on `main` per the single-checkout rule. 
the producer pushes the branch, then immediately returns to `main`.

---

## 8. Status flow

```
     pending
        │ producer claims row
        ▼
  in_production   ← executed_at = now()
        │
        │ ┌─ MLS# not found in listings           → killed
        │ ├─ Route exists (create) / missing (update) → killed
        │ ├─ Voice sanitize wipes entire PublicRemarks → continue with empty description
        │ ├─ TypeScript fail (after 2 fix iterations) → killed
        │ └─ Supabase auth / connectivity error  → killed
        │
        ▼ (PR opened on GitHub)
      ready        ← executor_response = {branch_name, pr_url, files_changed,...}
        │ Matt merges PR via GitHub UI
        ▼
    approved       ← approved_by='matt', approved_at=now()
        │ Vercel build + deploy completes
        ▼
    executed       ← terminal success
        │ 48h post-publish
        ▼
    measured       ← performance_loop writes impressions/clicks/leads to content_performance

    killed         ← terminal failure
```

SQL transitions:

```sql
-- On pickup:
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending'
RETURNING id;

-- On PR open:
UPDATE marketing_brain_actions
SET status='ready',
    executor_response='{"branch_name":"site-property-landing/<slug>","pr_url":"...","route":"/listings/<slug>","mls_id":"<MlsId>","files_changed":["..."]}'::jsonb
WHERE id='<id>';

-- On Matt merge (set by the orchestrator that watches GitHub webhooks, not by
-- this producer):
UPDATE marketing_brain_actions
SET status='approved', approved_by='matt', approved_at=now()
WHERE id='<id>';

-- On Vercel deploy complete:
UPDATE marketing_brain_actions
SET status='executed'
WHERE id='<id>';
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| MLS# not in listings | `WHERE "MlsId"='<mls_id>'` returns 0 rows | `status='killed'`. `executor_response={"error":"MLS# not found in listings","mls_id":"<mls_id>"}`. Surface to Matt.  likely a stale brain audit or wrong MLS#. |
| Route already exists (create) | `app/listings/<slug>/page.tsx` found on disk | `status='killed'`. Suggest `site:property_landing_update` instead. Surface the route and the existing PR (if any). |
| Route missing (update) | `app/listings/<slug>/page.tsx` not on disk | `status='killed'`. Suggest `site:property_landing_create` instead. |
| Slug collision (different MLS#) | Two listings hash to same slug | Append last 4 chars of MlsId to slug: `1234-nw-riverview-dr-9422`. Document in PR description. Do not silently overwrite the existing page. |
| Photos missing from PhotoURL | `"PhotoURL"` is null or empty array | Surface to Matt. Offer: pull from Spark API (`SPARK_API_BASE_URL`), wait for MLS photo upload, or scaffold the page with a hero placeholder + flag. Never invent or AI-generate property photos (ANTI_SLOP_MANIFESTO hard fail). |
| PublicRemarks empty after sanitize | All sentences contained banned vocab | Continue. Render the description block as empty. Per voice_guidelines.md: do not rewrite MLS prose to fill gaps.  that introduces MLS dispute risk and violates the "honest" voice rule. |
| TypeScript error unfixable in 2 iterations | Persistent type mismatch (e.g. shadcn/ui Form API changed) | `status='killed'`. Surface the full `tsc` output. Explain what needs manual resolution. Do not push a branch that fails to compile. |
| Lead-capture action signature drift | `app/actions/lead-capture.ts` changed since producer was written | Read the current action file in this session. Adapt the form server action call. If the API changed in a breaking way (renamed export, new required arg), escalate to Matt before guessing. |
| Sitemap parse error | `app/sitemap.ts` uses an unexpected structure | Read the file. Adapt the append logic to match the current structure. Never rewrite the whole sitemap from scratch. |
| Matterport URL invalid | `listing_videos.matterport_url` returns 404 | Omit the 3D tour section. Render only the "Schedule a virtual showing" fallback CTA. Document in PR. |
| Market context stale | `market_pulse_live.period_end` older than 60 days | Skip the market section entirely. Do not show stale data. Document in PR. |
| ManyChat widget ID missing | `MANYCHAT_WIDGET_ID` env var not set | Render the page without the widget. Document in PR. Do not block the build. |
| Photo download fails | MLS CDN returns 4xx/5xx | Retry once with 5s backoff. If still failing, use the MLS CDN URL directly (no local mirror) and document in PR. |
| **Open spec question**.  sold-archive transitions | When `"StandardStatus"='Closed'` is reached, who transitions the page to "Sold" archive state? | This producer accepts an `update` action for a `Closed` listing.  the page renders a "Sold" pill in the hero and updates the schema.org availability to `OutOfStock`. The trigger for emitting that update action is owned by a separate listing-status watcher (out of scope here). Document as a known follow-up in PR. |
| **Open spec question**.  multiple listings at same address (e.g. duplex / re-listed) | Slug collision policy beyond first appendage | First collision: append last-4 MlsId chars. Second+ collision: surface to Matt with both rows.  manual disambiguation only. |
| **Open spec question**.  RESO / Spark photo TOS | Some MLS rules require photos to be served only via the source CDN, not mirrored locally | Default to direct MLS CDN URLs (skip the `public/listings/<slug>/` mirror) unless Matt confirms mirror rights for this MLS. Document the choice in PR. |

---

## 10. Related skills and references

**Required reading before executing:**

- `CLAUDE.md` §0.  Data Accuracy mandate (outranks everything)
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last (PR is the draft)
- `CLAUDE.md` "Design System Rules.  MANDATORY".  shadcn/ui only; no raw HTML UI
- `CLAUDE.md` "Design System v2.  Heritage + Web Registers".  Web register for product surfaces
- `CLAUDE.md` "Supabase listings Schema".  mixed-case quoting
- `CLAUDE.md` "Always push directly to main".  single-checkout exception for site PRs
- `design_system/ryan-realty/SKILL.md`.  brand register, type tiers, asset paths
- `design_system/ryan-realty/colors_and_type.css`.  CSS variable tokens
- `marketing_brain_skills/brand-voice/voice_guidelines.md`.  voice attributes + banned vocab union
- `marketing_brain_skills/brand-voice/corpus/gbp_responses.md`.  Matt's writing fingerprint
- `marketing_brain_skills/producers/TEMPLATE.md`.  producer template
- `marketing_brain_skills/producers/REGISTRY.md`.  Section C entry

**Codebase patterns to match:**

- `app/listings/[listingKey]/page.tsx`.  the existing generic listing detail route (data-pull pattern)
- `app/sell/page.tsx`.  server component page with metadata and shadcn components
- `app/page.tsx`.  complex page with Suspense boundaries
- `app/sitemap.ts`.  existing sitemap structure to extend
- `app/actions/lead-capture.ts`.  server action for FUB form posting

**Sibling site producers:**

- `marketing_brain_skills/producers/site-edit/SKILL.md`.  edit existing page copy/meta/CTA
- `marketing_brain_skills/producers/site-page-create/SKILL.md`.  scaffold generic info pages
- `marketing_brain_skills/producers/site-performance/SKILL.md`.  perf fixes, redirects, schema on existing pages

**Related listing-moment producers** (separate triggers, not in this scope):

- `social_media_skills/list-kit/SKILL.md`.  at-Active marketing kit orchestrator (this landing page is a sibling deliverable, not a sub-deliverable)
- `marketing_brain_skills/producers/ops-matterport-embed/`.  Matterport tour provisioning
- `marketing_brain_skills/producers/ops-manychat/`.  ManyChat flow configuration
- `marketing_brain_skills/producers/ops-fb-marketplace/`.  FB Marketplace cross-post

**Registry entry:**

- `marketing_brain_skills/producers/REGISTRY.md`.  Section C, row `site-property-landing` (add when committing this producer).

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

