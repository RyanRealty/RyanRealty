---
name: site-neighborhood-page
description: >
  Scaffolds or updates the canonical per-neighborhood landing page at
  /neighborhoods/<slug> on ryan-realty.com. Sources neighborhood facts from
  bend-market-bible.md, wires JSON-LD Place schema, lead-capture form, dynamic
  active-listing grid, and canonical hero image. Opens a GitHub PR for Matt to merge.
action_types:
  - site:neighborhood_page_create
  - site:neighborhood_page_update
output_type: web-page
output_type: web-page
target_platforms: []
asset_destination: app/neighborhoods/[slug]/page.tsx
auto_inputs: ['market_stats_cache', 'neighborhood_boundaries', 'recent_listings']
required_inputs: ['neighborhood_slug']
optional_inputs: ['include_schools (default true)', 'include_poi_map (default true)']
estimated_runtime_min: 25
cost_usd_estimate: $0-$1
thumbnail_uri: out/proof/2026-05-17/exemplars/site-neighborhood-page/screenshot.jpg
example_outputs: []
    label: Phase 7.5 exemplar placeholder
    surface: website

---

# site-neighborhood-page

**Scope:** Creates or updates a per-neighborhood SEO landing page at
`/neighborhoods/<slug>`. Each page includes: an Amboqia Boriango hero H1, a
fact-rich body in Geist, a dynamic active-listing grid wired to Supabase, a
lead-capture form wired to `app/actions/lead-capture.ts`, the canonical Old Mill
District hero image, and JSON-LD `Place` + `RealEstateListing` structured data.
All shadcn/ui components. Every copy claim traces to `bend-market-bible.md` or a
live Supabase query. Opens a PR on a feature branch for Matt to merge.

Does NOT edit the global `/sell`, `/buy`, or homepage (that is `site-edit`).
Does NOT create any other page type (use `site-page-create` for landing pages
without a neighborhood context).

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** GitHub PR at `site-neighborhood/<action_id>` branch

---

## 1. Scope

### In scope

- `site:neighborhood_page_create`: net-new page at `app/neighborhoods/<slug>/page.tsx`
- `site:neighborhood_page_update`: update copy, stats, or schema on an existing page
- Adding or refreshing the route in `app/sitemap.ts`
- JSON-LD `Place` schema with neighborhood-level `geo` coordinates from `bend-market-bible.md`
- Dynamic active-listing grid (server component that queries Supabase `listings` at render time)
- Lead-capture form wired to `app/actions/lead-capture.ts`
- Canonical hero image: `design_system/ryan-realty/assets/hero/banner-1024x576-gbp.jpg` as the section header
- TypeScript compile verification before PR opens
- Brand voice validation on all copy before file creation

### Out of scope

- Editing global navigation, header, or footer (escalate to Matt)
- Creating API routes or server actions beyond `lead-capture.ts` (escalate)
- Market video embeds (those are produced by `content:market_data_short` and embedded separately)
- SEO blog posts about a neighborhood (that is `blog-post` producer)

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `site:neighborhood_page_create` | `neighborhood_slug`, `neighborhood_name`, `hero_headline`, `meta_description`, `lead_form_cta` | Page must not already exist |
| `site:neighborhood_page_update` | `neighborhood_slug`, `sections_to_update[]`, `reason` | Page must exist at `app/neighborhoods/<slug>/page.tsx` |

### Payload schema

```typescript
interface SiteNeighborhoodPagePayload {
  neighborhood_slug: string;       // e.g. 'nw-crossing' | 'old-bend' | 'tetherow'
                                   // must match a §1.x section slug in bend-market-bible.md
  neighborhood_name: string;       // Display name, e.g. 'NW Crossing'
  hero_headline: string;           // Amboqia H1: direct, no clichés, sentence case
                                   // e.g. 'NW Crossing real estate: facts and active listings'
  meta_description: string;        // 150-160 chars; must contain neighborhood name and "Bend, OR"
  lead_form_cta: string;           // Label for the lead form submit button, e.g. 'Request neighborhood info'
  sections_to_update?: string[];   // For updates only: ['stats', 'school', 'hoa', 'listings_grid']
  reason?: string;                 // For updates only: why this section is being refreshed
}
```

---

## 3. Full action row schema

```typescript
interface SiteNeighborhoodPageActionRow {
  id: string;
  action_type: 'site:neighborhood_page_create' | 'site:neighborhood_page_update';
  target: string;                  // e.g. 'neighborhood:nw-crossing'
  assigned_producer: string;       // 'marketing_brain_skills/producers/site-neighborhood-page'
  payload: SiteNeighborhoodPagePayload;
  data_evidence: {
    audit_source?: string;         // e.g. 'audit-website'
    opportunity_area?: string;     // e.g. 'GSC: 340 impressions for "nw crossing homes for sale"'
    signal_evidence?: string;
  };
  generation_reason: string;
  status: 'pending';
}
```

---

## 4. The recipe

**Step 1: Read the action row and claim it**

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<id>' AND status = 'pending';
```

Confirm `status` was `pending`. If not, halt silently.

**Step 2: Load mandatory references**

- `CLAUDE.md` §0: Data Accuracy (all stats verified live)
- `CLAUDE.md` §0.5: Draft-First, Commit-Last
- `CLAUDE.md` "Design System Rules: MANDATORY": shadcn/ui only
- `CLAUDE.md` "Design System v2: Heritage + Web Registers": Web register
- `design_system/ryan-realty/SKILL.md`: color tokens, type families, shadow ladder
- `design_system/ryan-realty/colors_and_type.css`: CSS variable definitions
- `marketing_brain_skills/brand-voice/voice_guidelines.md`: voice enforcement
- `marketing_brain_skills/research/tool-inventory.md`: Supabase and env var status
- `marketing_brain_skills/research/platform-bible.md`: §24 real-estate compliance
- `marketing_brain_skills/research/asset-library-map.md`: hero image location confirmation
- `marketing_brain_skills/research/bend-market-bible.md`: §1 for the target neighborhood
- `app/actions/lead-capture.ts`: read before implementing the lead form

**Step 3: Route check (create vs. update)**

For `site:neighborhood_page_create`: confirm `app/neighborhoods/<slug>/page.tsx` does
NOT exist. If it does, set `status='killed'`:

```
Route already exists: app/neighborhoods/<slug>/page.tsx.
Use site:neighborhood_page_update to modify it.
Action row killed.
```

For `site:neighborhood_page_update`: confirm the file DOES exist. If missing, set
`status='killed'` and suggest `site:neighborhood_page_create` instead.

**Step 4: Load neighborhood facts from bend-market-bible.md**

Open `marketing_brain_skills/research/bend-market-bible.md` and read the §1.x
subsection matching `payload.neighborhood_slug`. Extract:
- Typical price range and the source citation
- Dominant home types
- Key amenities
- School assignment (school names only; never enrollment or rating figures without re-verification)
- HOA reality
- Buyer profile

All figures from the bible are starting-point references. Per CLAUDE.md §0, every
figure that appears on the page must be re-verified against Supabase before commit.

**Step 5: Pull live market stats for the neighborhood**

For the neighborhood price median:
```sql
SELECT
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice") AS median_close,
  COUNT(*) AS closed_count,
  MIN("CloseDate") AS window_start,
  MAX("CloseDate") AS window_end
FROM listings l
JOIN neighborhood_subdivisions ns
  ON l."SubdivisionName" = ANY(ns.mls_aliases)
WHERE ns.neighborhood_slug = '<neighborhood_slug>'
  AND l."StandardStatus" = 'Closed'
  AND l."PropertyType" = 'A'
  AND l."CloseDate" >= date_trunc('year', now());
```

For active listings:
```sql
SELECT COUNT(*) AS active_count
FROM listings l
JOIN neighborhood_subdivisions ns
  ON l."SubdivisionName" = ANY(ns.mls_aliases)
WHERE ns.neighborhood_slug = '<neighborhood_slug>'
  AND l."StandardStatus" = 'Active'
  AND l."PropertyType" = 'A';
```

If fewer than 3 closed sales exist for the YTD window, expand to the trailing 12
months. Note the window in `citations.json`. If still fewer than 3, omit the price
median from the page and note "insufficient closed sales for a median" in the
contact sheet.

**Step 6: Voice-validate all copy**

Before generating any file, validate `payload.hero_headline`, `payload.meta_description`,
`payload.lead_form_cta`, and every body paragraph extracted from the bible against
`marketing_brain_skills/brand-voice/voice_guidelines.md`:

Banned words check: stunning, nestled, boasts, charming, pristine, gorgeous, breathtaking,
must-see, dream home, meticulously maintained, tucked away, hidden gem, truly, spacious,
cozy, luxurious, updated throughout.

Banned punctuation: em-dash as punctuation, semicolons in body, exclamation marks,
dramatic colons in prose.

Banned filler: delve, leverage, tapestry, navigate, robust, seamless, comprehensive,
elevate, unlock, passionate, dedicated, premier, boutique.

If copy fails: set `status='pending'` with `generation_reason` prefixed `VOICE_FAIL:`.
Fix and re-validate. Max 2 auto-iterations. If fail persists after iteration 2, kill.

**Step 7: Scaffold or update the page file**

For create: generate `app/neighborhoods/<slug>/page.tsx`.

File structure conventions (matching `app/sell/page.tsx` and `app/page.tsx`):

```typescript
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import Image from 'next/image'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: '<neighborhood_name> Real Estate | Ryan Realty',
  description: '<meta_description>',
  alternates: { canonical: `${siteUrl}/neighborhoods/<slug>` },
  openGraph: { ... },
  twitter: { ... },
}
```

JSON-LD `Place` schema (inline script tag in the page):
```json
{
  "@context": "https://schema.org",
  "@type": "Place",
  "name": "<neighborhood_name>, Bend, OR",
  "description": "<meta_description>",
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "<from bend-market-bible if available>",
    "longitude": "<from bend-market-bible if available>"
  },
  "containedInPlace": {
    "@type": "City",
    "name": "Bend",
    "addressRegion": "OR"
  }
}
```

Page section order:
1. Hero: full-width with Amboqia H1, Geist subhead, canonical GBP banner image, primary Button CTA.
2. Stats bar: active count + median price (if verified) in tabular numerals. `<Card>` components.
3. Neighborhood overview: 2-3 fact paragraphs from bible, no bullets, no lists of clichés.
4. Schools section: school names only. No rating claims. Link to Bend-La Pine Schools website.
5. HOA reality section: factual HOA fee range if available. Source cited.
6. Active listings grid: server component fetching from Supabase. 6-listing cap on initial load.
7. Lead-capture form: `<Card>` wrapper, shadcn/ui `<Input>`, `<Textarea>`, `<Label>`, `<Button>` wired to `lead-capture.ts`.
8. Adjacent neighborhoods: 2-3 links to sibling neighborhood pages.

Design system rules (Web register):
- `bg-background` for page background (cream `#faf8f4`)
- `bg-primary text-primary-foreground` for CTAs (navy)
- `<Card>`, `<CardContent>` for all containers. No raw divs.
- `font-display` class for hero H1 (Amboqia Boriango). All other text Geist.
- Radii: `rounded-xl` for cards (14px), `rounded-lg` for buttons (10px).
- No gold. No off-brand hex. No custom CSS classes.
- Shadows: `shadow-sm` resting, `shadow-md` hover.

Hero image path: `design_system/ryan-realty/assets/hero/banner-1024x576-gbp.jpg`
(or the full-width 4K variant at `hero-old-mill-master-4k.jpg` if the layout needs it).

For update: read the existing file, identify the sections listed in
`payload.sections_to_update`, replace only those sections, preserve all others verbatim.

**Step 8: Update sitemap**

For creates only: add entry to `app/sitemap.ts`:
```typescript
{
  url: `${siteUrl}/neighborhoods/<slug>`,
  lastModified: new Date(),
  changeFrequency: 'monthly',
  priority: 0.7,
}
```

**Step 9: TypeScript compile check**

```bash
cd /Users/matthewryan/RyanRealty && npx tsc --noEmit 2>&1
```

Zero-error requirement. If errors: fix within 2 iterations. If unfixable after 2, kill.

**Step 10: Branch, commit, and open PR**

Branch: `site-neighborhood/<first-8-chars-of-action-id>`

```bash
git checkout -b site-neighborhood/<action_id_prefix>
git add app/neighborhoods/<slug>/page.tsx app/sitemap.ts
git commit -m "site-neighborhood-page(<slug>): <create/update> <neighborhood_name> landing page

Action row: <id>
Neighborhood: <neighborhood_name>
Route: /neighborhoods/<slug>
Rationale: <generation_reason>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin site-neighborhood/<action_id_prefix>
```

Open PR with `gh pr create`. PR body includes:
- Route, neighborhood name, action row ID
- Files created/modified
- Market stats with verification trace per CLAUDE.md §0
- Voice validation: PASS
- TypeScript: PASS (zero errors)
- Design tokens: PASS (shadcn/ui only)
- JSON-LD schema: Place included
- Approval gate note: "Matt merges this PR in GitHub to make the page live."

**Step 11: Write citations.json**

One entry per stat on the page.

**Step 12: Update action row to ready**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = '{
      "branch_name": "site-neighborhood/<prefix>",
      "pr_url": "<pr_url>",
      "files_changed": ["app/neighborhoods/<slug>/page.tsx", "app/sitemap.ts"],
      "page_route": "/neighborhoods/<slug>",
      "voice_validated": true,
      "tsc_clean": true,
      "json_ld": true
    }'::jsonb
WHERE id = '<id>';
```

Surface to Matt:

```
Draft ready: site-neighborhood-page: /neighborhoods/<slug>

  PR
    URL: <pr_url>
    Branch: site-neighborhood/<prefix>

  PAGE
    Route: /neighborhoods/<slug>
    Neighborhood: <neighborhood_name>
    H1: <hero_headline>
    Active listings at render: <count>
    Median close price: <figure or "omitted: insufficient closed sales">

  VERIFICATION TRACE
    <one line per stat>

  VALIDATION
    Voice: PASS
    TypeScript: PASS
    Design tokens: PASS (shadcn/ui only)
    JSON-LD: Place schema included

Matt merges the PR in GitHub to ship.
```

Then stop. Wait for Matt to merge.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | market stat queries; action row updates | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Read (file) | bend-market-bible, brand voice, lead-capture.ts, existing page | paths above |
| Write / Edit (file) | `app/neighborhoods/<slug>/page.tsx`, `app/sitemap.ts` | repo working tree |
| Bash: `npx tsc --noEmit` | TypeScript compile check | `/Users/matthewryan/RyanRealty` |
| Bash: git + gh | branch, commit, push, PR open | active gh session |

---

## 6. Output format

**Draft lands at:** GitHub PR (Web register page on branch)

```
app/neighborhoods/<slug>/page.tsx      (new or updated)
app/sitemap.ts                         (updated for creates)
out/site-neighborhood/<slug>/citations.json
```

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-review-PR` | Matt merges the GitHub PR | Matt only, via GitHub UI |

---

## 8. Status flow

```
pending           <- producer reads row here
  |
  v
in_production     <- set immediately; executed_at=now()
  |
  +-- Route conflict -> killed
  +-- Voice fail after 2 iterations -> killed
  +-- TypeScript fail after 2 iterations -> killed
  +-- Insufficient stat data -> stat omitted; continue
  |
  v (PR open)
ready             <- executor_response = {branch_name, pr_url, ...}
  |
  v (Matt merges PR)
approved
  |
  v (Vercel deploy completes)
executed
  |
  v (48h: audit-website captures first impressions and clicks)
measured
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Route already exists (create) | `app/neighborhoods/<slug>/page.tsx` found on disk | Kill; suggest `site:neighborhood_page_update` |
| Route missing (update) | File not found on disk | Kill; suggest `site:neighborhood_page_create` |
| Neighborhood not in bible | No §1.x match for slug | Generate page with geo name only; omit fact claims; note in PR |
| Insufficient closed sales | Fewer than 3 closed in YTD + 12-month window | Omit median price; note in PR |
| Voice fail after 2 iterations | Banned word persists | Kill; surface specific violation and rule |
| TypeScript error after 2 iterations | Persistent type error | Kill; surface tsc output; explain what needs manual resolution |
| `lead-capture.ts` signature changed | Form binding breaks | Read current action; adapt; if breaking API change, escalate to Matt |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0: Data Accuracy
- `CLAUDE.md` §0.5: Draft-First, Commit-Last
- `CLAUDE.md` "Design System Rules: MANDATORY": shadcn/ui only
- `CLAUDE.md` "Design System v2: Heritage + Web Registers"
- `design_system/ryan-realty/SKILL.md`: color tokens, type families, radii
- `design_system/ryan-realty/colors_and_type.css`: CSS variable definitions
- `marketing_brain_skills/brand-voice/voice_guidelines.md`: voice enforcement
- `marketing_brain_skills/research/tool-inventory.md`: API and env var status
- `marketing_brain_skills/research/platform-bible.md`: §24 compliance
- `marketing_brain_skills/research/asset-library-map.md`: hero image location
- `marketing_brain_skills/research/bend-market-bible.md`: §1 neighborhood facts
- `app/actions/lead-capture.ts`: read before implementing lead form
- `app/sell/page.tsx`: server-component pattern reference
- `app/sitemap.ts`: sitemap structure to extend

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md`: Section C, row `site-neighborhood-page`

## 12. Tool gap suggestions

What would make this 10x better:

1. **Deschutes County GIS boundary auto-import**: fetch the official neighborhood polygon on page creation rather than relying on a manually specified boundary_slug.
2. **Google Maps Places API POI layer**: auto-populate the amenity list (schools, parks, restaurants, trailheads) from a live Places API call rather than hard-coded content.
3. **Listing count live badge**: embed a Supabase Realtime subscription so the active listing count on the neighborhood page updates in real time without a rebuild.

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

