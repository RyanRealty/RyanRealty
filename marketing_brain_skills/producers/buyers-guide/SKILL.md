---
name: buyers-guide
description: >
  Produces and delivers the per-community buyer's guide PDF that is offered
  as the "Soft start" third card on every community/subdivision/city LP's
  buyer track. Each guide is a 14-20 page branded PDF covering the community's
  HOA tier structure, club membership reality, sub-neighborhood profiles,
  builder roster, school assignment, drive times, recent close history, and
  what each price tier actually buys. Use this skill when Matt says "build
  the Tetherow buyer's guide", "make the Pronghorn buyer's guide", "create
  the Sunriver buyers guide", "we need a guide PDF for <community>", or any
  time a community LP promises a downloadable buyer's guide that needs the
  actual asset to back it. Use this skill (NOT the marketing brain producer
  cma or the generic comms-email producer) any time the deliverable is a
  per-community-branded PDF buyer's guide. This skill ALSO handles the
  request-handler endpoint that captures buyer's guide form submissions,
  enriches them with FUB lead routing, and emails the PDF via Resend with
  a personalized cover note. Each guide has a canonical web version at
  /lp/<community>/buyers-guide/ for SEO + AEO, and the PDF is generated
  from that same page via Puppeteer so they never drift apart.
action_types:
  - content:buyers_guide_create
  - content:buyers_guide_update
  - ops:buyers_guide_setup
  - ops:buyers_guide_send
output_type: pdf-document
target_platforms: []
asset_destination: app/lp/[community]/buyers-guide/page.tsx (canonical web version) + public/guides/<community>/<community>-buyers-guide.pdf (generated PDF)
auto_inputs: ['market_stats_cache', 'listings', 'data/resort-communities.json']
required_inputs: ['community_slug']
optional_inputs: ['sections_to_update']
estimated_runtime_min: 35
cost_usd_estimate: $0.10 per email send (Resend pricing) + ~$0.02 per PDF gen
thumbnail_uri: null
example_outputs:
  - label: Tetherow buyer's guide (first exemplar)
    surface: pdf + web
    path: app/lp/tetherow/buyers-guide/page.tsx
---

# buyers-guide

**Scope.** Author and deliver the per-community buyer's guide that backs the
"Soft start" card on every community/subdivision/city LP's buyer track.
The guide is a 14-20 page branded PDF that gives a prospective buyer enough
detail about a specific resort community (Tetherow / Pronghorn / Sunriver /
etc.) to decide whether to engage further. It is intentionally information-
dense and low-pressure: not a brochure, not a sales pitch. Real numbers,
real diligence items, real photo references.

The canonical version of each guide is a public web page at
`/lp/<community>/buyers-guide/` — this serves SEO + AEO (Google + LLM
citations: "what's in the Tetherow buyer's guide?"). The PDF is generated
from that same web page via Puppeteer so the two never drift. The PDF is
what gets emailed to a subscriber who fills out the "Send the guide" form
on the community LP.

This producer also owns the request-handler API endpoint at
`/api/buyers-guide/request` that the LP form submits to: it validates the
request, creates a FUB lead with the right tags, regenerates the PDF if
older than 7 days (so guide numbers stay fresh), and emails the PDF as an
attachment via Resend.

**Status:** Canonical
**Locked:** 2026-05-18
**Exemplar output:** First exemplar is the Tetherow buyer's guide:
- Web: `app/lp/tetherow/buyers-guide/page.tsx`
- PDF: `public/guides/tetherow/tetherow-buyers-guide.pdf`

---

## 1. Scope

### In scope

- `content:buyers_guide_create`: new per-community guide. Authors the web
  page at `app/lp/<slug>/buyers-guide/page.tsx`, generates the PDF, opens a PR.
- `content:buyers_guide_update`: refresh sections (numbers, sub-neighborhood
  profiles, builder roster) on an existing guide; regenerate the PDF.
- `ops:buyers_guide_setup`: one-time setup of the Puppeteer PDF generation
  + Resend template + request handler. Idempotent.
- `ops:buyers_guide_send`: triggered by the LP form submission. Validates
  request, creates FUB lead, regenerates PDF if stale, emails it.
- Both the web page and the PDF share the same data pipeline: pulled live
  from Supabase at PDF-generation time, with `pdf_generated_at` timestamp
  stamped onto the cover so the reader knows when the data was current.
- JSON-LD: the web page renders a `Book` schema (or `DigitalDocument`)
  + sub-section `RealEstateAgent` for SEO.
- Brand: Web register (Geist + Amboqia, navy on cream). PDF is rendered
  to print-friendly margins (letter-size, 0.6" margins) but with the same
  type and color register.

### Out of scope

- The criteria-based alerts backend (use `listing-alerts`).
- The seller CMA (use `cma`).
- Per-listing one-pager PDFs (use `site-listing-page` or `listing-tour-video`).
- Generic email campaigns (use `ops-email-send`).
- The community LP itself (use `site-community-page`).
- Editorial content authoring for the resort itself — facts come from
  `data/resort-communities.json`. This skill does NOT make up facts; if a
  field is missing, the section is omitted with a placeholder.

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `content:buyers_guide_create` | `community_slug` | New guide. Web page must not already exist. |
| `content:buyers_guide_update` | `community_slug`, `sections_to_update[]`, `reason` | Web page must exist. Regenerates PDF after section edits. |
| `ops:buyers_guide_setup` | none | One-time. Idempotent. Sets up Puppeteer + Resend template + request handler. |
| `ops:buyers_guide_send` | `subscriber_email`, `subscriber_name`, `community_slug`, `utm` | Triggered by the LP form submission. Sends PDF via Resend. |

### Payload schema for the request handler (the form submission, not an action_type):

```typescript
interface BuyersGuideRequestPayload {
  email: string;                     // required
  name?: string;                     // optional (the form allows "First name (optional)")
  community_slug: string;            // 'tetherow' | 'pronghorn' | etc.
  source_lp: string;                 // 'lp-tetherow-v1' | etc.
  consent_marketing: boolean;        // must be true
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
  };
}
```

---

## 3. Full action row schema

```typescript
interface BuyersGuideActionRow {
  id: string;
  action_type:
    | 'content:buyers_guide_create'
    | 'content:buyers_guide_update'
    | 'ops:buyers_guide_setup'
    | 'ops:buyers_guide_send';
  target: string;                    // 'guide:tetherow' for content actions; 'system:buyers_guide' for setup; 'subscriber:<email>' for sends
  assigned_producer: 'marketing_brain_skills/producers/buyers-guide';
  payload: Record<string, unknown>;
  generation_reason: string;
  status: 'pending';
}
```

---

## 4. The recipe

### 4.1 content:buyers_guide_create (per-community)

**Step 1.** Read action row, set `status='in_production'`.

**Step 2.** Load mandatory references:

- `CLAUDE.md` §0, §0.5, brand voice
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `data/resort-communities.json` — the row for `community_slug`
- `public/lp/<slug>/index.html` (or the dynamic version, if `site-community-page`
  has already ported it) — the buyer's guide reuses the same content
  scaffolding as the LP, just deeper

**Step 3.** Confirm the web route doesn't exist:
`app/lp/<slug>/buyers-guide/page.tsx`. If it does, kill the action with
"Use content:buyers_guide_update instead."

**Step 4.** Pull live data for the figures that go in the guide:

```sql
-- KPI section (same as the LP):
SELECT * FROM market_stats_cache
WHERE geo_slug = '<slug>' AND period_type = 'rolling_365d'
LIMIT 1;

-- Recent closings (last 90 days, for "What homes recently traded"):
SELECT * FROM listings
WHERE "SubdivisionName" = ANY('<aliases>'::text[])
  AND "StandardStatus" IN ('Closed', 'Sold')
  AND "CloseDate" >= NOW() - INTERVAL '90 days'
ORDER BY "CloseDate" DESC LIMIT 12;

-- Active inventory at the time of guide generation:
SELECT COUNT(*) AS active_count, MIN("ListPrice") AS min_price, MAX("ListPrice") AS max_price
FROM listings
WHERE "SubdivisionName" = ANY('<aliases>'::text[])
  AND "StandardStatus" = 'Active'
  AND "PropertyType" = 'A';
```

**Step 5.** Author the web page at `app/lp/<slug>/buyers-guide/page.tsx`.
ISR config: `export const revalidate = 21600` (6h, same as the LP).

Page structure (14-20 page equivalent in PDF):

1. **Cover** — Title, community name, "Buyer's Guide", date stamp ("Generated <Month Year>"), Ryan Realty white-horizontal-logo footer.
2. **Letter from the broker** — One-page personal intro from Matt, with the canonical headshot.
3. **What is <Community>** — The same overview paragraphs from the LP About section, expanded slightly.
4. **The location** — Drive times + the Google Static Map + an additional schools-and-shopping-distance block.
5. **The HOA reality** — Full table from `resort-communities.json` + the master fee + the disclosure-doc list.
6. **The course / amenity profile** — One full page on the signature golf course or anchor amenity.
7. **Sub-neighborhoods, by character** — One page per sub-neighborhood, with the typical lot size, common architectural pattern, builder roster, the "feels like" sentence.
8. **The membership question** — Two pages on club membership: golf vs sport vs social, costs not public, the transfer-on-resale issue (the #1 buyer mistake), the right diligence questions to ask the membership office.
9. **What each price tier actually buys** — 2-3 pages bucketed by tier ($1M-$1.5M, $1.5M-$2.5M, $2.5M-$4M, $4M+). For each tier: typical sqft, typical lot, typical sub-neighborhood, typical HOA bracket, typical age of build, typical views.
10. **Recent closings** — A page with the verified close-history table (from Step 4 above).
11. **Schools** — Bend-La Pine assignment, neighborhood school proximity, summer programs.
12. **The builder roster** — From the LP, with the addition of "questions to ask before signing a build contract."
13. **The financing reality** — Jumbo loan thresholds, typical down-payment expectations, the LO referral list.
14. **What buyers say afterward** — 3-4 testimonial blocks (sourced from existing testimonial JSON or omitted).
15. **What happens next** — How to schedule a showing, how to set custom alerts, how to read a Tetherow comp set, the next 30 days if you decide to write an offer.
16. **Disclaimers + methodology** — Full source citations, fair-housing notice, broker license number, address, contact.

Each "page" is a server component that renders within a `<section>` wrapper.
The PDF renderer (Step 7) treats CSS `@page` breaks as page boundaries.

Design system:
- Letter-size (8.5" x 11") layout via `@page { size: letter; margin: 0.6in; }`
- Geist body, Amboqia for section H1s
- Navy `#102742` on cream `#faf8f4`
- Footer on every page: page number + canonical URL + brokerage attribution
- Image-heavy where possible (sub-neighborhood photos, the signature hole, course aerial)

**Step 6.** Voice-validate all generated body copy. Hard fail on the
banned-word list (see `voice_guidelines.md`).

**Step 7.** Generate the PDF via Puppeteer (Step 4.3 below handles the
Puppeteer setup script; this step calls it).

```bash
node scripts/buyers-guide/generate-pdf.mjs --community <slug> --out public/guides/<slug>/<slug>-buyers-guide.pdf
```

The script spins up Puppeteer, hits
`http://localhost:3000/lp/<slug>/buyers-guide?print=true` (the `print=true`
flag activates the print CSS), waits for the page to fully render, then
exports the PDF.

**Step 8.** TypeScript compile check, sitemap update, branch + commit + PR.

PR body lists:
- Web route
- PDF path
- File size
- Page count
- Live data sources + verification trace
- Voice validation status
- TypeScript clean

### 4.2 content:buyers_guide_update

Same as create, but:
- Targets specific sections from `payload.sections_to_update`
- Only re-runs queries for the data backing those sections
- Always regenerates the PDF (full re-render)
- Updates `pdf_generated_at` so the request handler picks up the fresh version

### 4.3 ops:buyers_guide_setup (one-time)

**Step 1.** Check if Puppeteer is installed:
```bash
node -e "require('puppeteer')" 2>&1
```

If error, install: `npm install puppeteer --save`

**Step 2.** Author the PDF-generation script at
`scripts/buyers-guide/generate-pdf.mjs`:

```javascript
import puppeteer from 'puppeteer'
import { argv } from 'process'

const community = argv[argv.indexOf('--community') + 1]
const outPath = argv[argv.indexOf('--out') + 1]

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.goto(`http://localhost:3000/lp/${community}/buyers-guide?print=true`, {
  waitUntil: 'networkidle0'
})
await page.pdf({
  path: outPath,
  format: 'letter',
  printBackground: true,
  margin: { top: '0.6in', right: '0.6in', bottom: '0.6in', left: '0.6in' },
  displayHeaderFooter: false
})
await browser.close()
```

**Step 3.** Author the request handler at
`app/api/buyers-guide/request/route.ts`:

- POST handler accepts BuyersGuideRequestPayload
- Validates required fields
- Looks up the PDF at `public/guides/<community_slug>/<slug>-buyers-guide.pdf`. If file doesn't exist OR is older than 7 days, kicks off a regeneration job (or returns a "not yet available" error)
- Creates a FUB lead with tags: `buyer-intent-soft`, `buyers-guide-requested`, `resort:<community_slug>`, `lp:<source_lp>`
- Sends the PDF as an email attachment via Resend, with a personalized cover note (Matt's voice, brand-validated)
- Returns 200 with `{ success: true, lead_id }`
- Fires gtag + fbq events

**Step 4.** Author the Resend email template at
`lib/buyers-guide/email-template.tsx` (React Email). The cover email is short:
- Personalized greeting if name provided
- One paragraph: "Here's the Tetherow buyer's guide as a PDF. The data inside was current as of <date>. If you have questions, reply to this email — it lands in our inbox, not a queue."
- Sign-off: Matt's signature block
- Footer with unsubscribe link

**Step 5.** Add the Vercel cron at `/api/cron/buyers-guide-regenerate` running
weekly (Sunday 3am PT) to regenerate all guide PDFs:

```json
{
  "path": "/api/cron/buyers-guide-regenerate",
  "schedule": "0 10 * * 0"
}
```

The cron walks every community in `resort-communities.json` and regenerates
the PDF if `pdf_generated_at` is older than 7 days.

**Step 6.** Author the admin queue at
`app/admin/(protected)/buyers-guide/page.tsx` showing all guides, their
last-generated timestamp, their file size, the request count last 30 days.

### 4.4 ops:buyers_guide_send (triggered by LP form)

This is the runtime action when a visitor submits the buyer's guide form.

**Step 1.** Validate the payload (see schema in §2).

**Step 2.** Check the PDF freshness:
```bash
test $(($(date +%s) - $(stat -f %m public/guides/<slug>/<slug>-buyers-guide.pdf))) -lt 604800
```

If older than 7 days, regenerate.

**Step 3.** Create FUB lead:
```typescript
await fubCreatePerson({
  email,
  name,
  tags: ['buyer-intent-soft', 'buyers-guide-requested', `resort:${community_slug}`, `lp:${source_lp}`],
  source: 'Buyers Guide Request',
  customFields: {
    buyers_guide_community: community_slug,
    buyers_guide_requested_at: new Date().toISOString()
  }
})
```

**Step 4.** Send the email via Resend with the PDF attached.

**Step 5.** Log to `marketing_brain_actions` as executed.

**Step 6.** No surface to Matt — runtime ops doesn't need approval.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | data queries for guide content | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Puppeteer | PDF generation from the web page | `npm install puppeteer` |
| Resend | email delivery with PDF attachment | `RESEND_API_KEY`, `RESEND_FROM='Ryan Realty <hello@mail.ryan-realty.com>'` |
| FUB API | lead create on each request | `FOLLOWUPBOSS_API_KEY` |
| Vercel cron | weekly PDF regeneration | registered in `vercel.json` |

---

## 6. Output format

**Draft lands at:** GitHub PR.

```
app/lp/<slug>/buyers-guide/page.tsx          (new or updated)
app/sitemap.ts                               (updated to include the guide URL)
public/guides/<slug>/<slug>-buyers-guide.pdf (generated)
scripts/buyers-guide/generate-pdf.mjs        (added by setup action only)
app/api/buyers-guide/request/route.ts        (added by setup action only)
app/api/cron/buyers-guide-regenerate/route.ts (added by setup action only)
lib/buyers-guide/email-template.tsx          (added by setup action only)
out/buyers-guide/<slug>/citations.json
```

**Surface format (chat reply to Matt):**

```
Buyer's guide ready: <community_name>

  PR
    URL: <pr_url>
    Branch: buyers-guide/<slug>-<prefix>

  WEB
    Route: /lp/<slug>/buyers-guide/
    Page count: <n> sections
    ISR: revalidate every 6h

  PDF
    Path: public/guides/<slug>/<slug>-buyers-guide.pdf
    File size: <n> MB
    Page count: <n>
    Generated at: <iso>

  VERIFICATION TRACE
    <one line per live data source>

  VALIDATION
    Voice: PASS
    TypeScript: PASS
    PDF render: PASS (Puppeteer, 0 errors)
    Resend template: validated

  TEST PLAN
    1. Open the web version at https://ryan-realty.com/lp/<slug>/buyers-guide/
    2. POST to /api/buyers-guide/request with a test email
    3. Confirm PDF attached, FUB lead created, voice-validated cover note

Matt merges the PR in GitHub to ship.
```

Then stop. Wait for Matt to merge.

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-review-PR` | Matt merges the GitHub PR (for create/update/setup) | Matt only |
| `none` | Send action runs autonomously (LP form -> email) | N/A |

This producer uses **`matt-review-PR`** for create/update/setup, **`none`**
for runtime sends.

---

## 8. Status flow

For `content:buyers_guide_create` and `content:buyers_guide_update`:

```
pending -> in_production -> ready (PR open) -> approved (PR merged) -> executed (deploy + first PDF available)
```

For `ops:buyers_guide_setup`:

```
pending -> in_production -> ready (PR open) -> approved -> executed
```

For `ops:buyers_guide_send`:

```
pending -> in_production -> executed (email sent successfully)
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Community not in resort-communities.json | No matching row | Kill; surface to Matt |
| Puppeteer install fails | npm error during setup | Kill with the error; suggest Node version or alternate install path |
| PDF render fails | Puppeteer goto returns 4xx | Kill; surface to Matt with the URL and the Puppeteer error |
| PDF file too large | > 25 MB | Reduce image resolution; if still too large, split into a "Part 1" and "Part 2" |
| Resend attachment size limit | > 40 MB | Switch to "Download link" mode: store PDF in Supabase Storage, send link instead of attachment |
| FUB lead create fails | API 5xx | Send the email anyway; log the FUB failure; retry FUB on next cron tick |
| Voice fail | banned word in cover letter or section | Kill; surface specific token + rule |
| Sub-neighborhood data missing | resort-communities.json incomplete | Omit that section; note in PR |

---

## 10. Related skills and references

**Required reading before executing:**

- `CLAUDE.md` §0, §0.5
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `data/resort-communities.json`
- `public/lp/tetherow/index.html` — content reference for the parallel LP
- `marketing_brain_skills/research/asset-library-map.md` — hero + sub-neighborhood photo paths

**Producers this integrates with:**

- `marketing_brain_skills/producers/site-community-page/SKILL.md` — renders the "Send the guide" form that POSTs to this producer's /request endpoint
- `marketing_brain_skills/producers/site-subdivision-page/SKILL.md` (pending) — same at the subdivision tier
- `marketing_brain_skills/producers/site-city-page/SKILL.md` (pending) — same at the city tier
- `marketing_brain_skills/producers/ops-fub-crm/SKILL.md` — FUB lead pattern
- `marketing_brain_skills/producers/ops-email-send/SKILL.md` — Resend send pattern
- `marketing_brain_skills/producers/listing-alerts/SKILL.md` — sibling backend producer (same lead-routing pattern)

**Registry entry:**

- `marketing_brain_skills/producers/REGISTRY.md` — Section A (content producers), row `buyers-guide`. Note: although this is a content producer in spirit, it ALSO owns the ops:buyers_guide_send runtime, which is unusual. Registry listing notes this dual nature.

---

## 11. Tool gap suggestions

1. **Per-buyer personalization.** Today every guide is the same PDF for every recipient. A future iteration could inject the recipient's name in the cover letter, attach a custom "homes you've already viewed" appendix from FUB tracking, or pre-fill the "next 30 days" plan with their stated timeline.

2. **Multi-language.** Bend gets occasional out-of-country buyer interest. A Spanish-language Tetherow guide would unlock LATAM HNW prospect engagement.

3. **Print-on-demand.** Some buyers want a physical copy mailed. Add an `/api/buyers-guide/print-request` endpoint that hands the PDF to Lulu or Mixam for direct mail.

4. **Annual editions.** Add a `pdf_year` field and archive previous editions. "Tetherow 2025 Buyer's Guide" vs "2026 Buyer's Guide" — useful for historical reference and shows the broker doing the work year over year.

5. **Auto-refresh when a section changes upstream.** When `resort-communities.json` is edited for a particular slug, trigger `content:buyers_guide_update` automatically. Today this requires manual triggering.

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `marketing_brain_skills/research/asset-library-map.md`
- `data/resort-communities.json`
