---
name: newsletter
description: >
  Produces the monthly Ryan Realty email newsletter sent to past clients and leads
  via Resend on mail.ryan-realty.com. Pulls live market stats, recent listings, a
  neighborhood feature, and a community event into a voice-validated HTML email with
  plain-text fallback. This is the Phase 10 smoke-test producer.
action_types:
  - content:newsletter
output_type: text
output_type: text
target_platforms: ['email']
asset_destination: "out/newsletters/<date>/"
auto_inputs: ['market_stats_cache', 'recent_listings', 'content_performance']
required_inputs: "['newsletter_date_iso', 'segment (buyer|seller|general)']"
optional_inputs: ['featured_listing_mls_id', 'custom_cta_url']
estimated_runtime_min: 20
cost_usd_estimate: $0-$0.05 (Resend API)
thumbnail_uri: out/proof/2026-05-17/exemplars/newsletter/sample.html
example_outputs: []
    label: Phase 10 smoke test draft
    surface: email

---

# Newsletter Producer

**Scope:** Monthly email newsletter delivered via Resend to the past-client and lead list
maintained in Follow Up Boss. Produces one HTML email body, one plain-text fallback, and
registers both as assets in the content library. Does not handle list segmentation or
per-recipient merge fields beyond first name. Does not send without Matt's explicit
sign-off. The newsletter is brokerage-brand content; no individual broker headshot
appears unless a specific broker transaction is featured.

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** `out/newsletter/<YYYY-MM>/` (HTML + plain-text + contact-sheet.html)

---

## 1. Scope

### In scope

- One HTML email per calendar month, approximately 600-900 words
- Market snapshot section (median price, months of supply, days on market for Bend SFR)
- Featured listing or recent sale section (one property, data verified against Supabase)
- Neighborhood spotlight section (one neighborhood from bend-market-bible.md §1)
- Community event or local news item (sourced from local press or Matt's input)
- Plain-text fallback (all links spelled out, no HTML formatting)
- Asset library registration after Matt's approval
- Resend send via `mail.ryan-realty.com` (RESEND_API_KEY set; RESEND_FROM unset pending domain verification - see §9)

### Out of scope

- List management (use FUB CRM directly for segmentation changes)
- Transactional emails (showing confirmations, automated drip) - those are ops-email-send
- The monthly market report blog post - that is market-report-blog producer
- Video scripts or social captions - separate producers

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `content:newsletter` | `month_label`, `neighborhood_slug`, optional `featured_listing_key` | `month_label` e.g. "May 2026"; `neighborhood_slug` matches bend-market-bible.md §1 slugs |

### Payload schema

```typescript
interface NewsletterPayload {
  month_label: string              // "May 2026"
  neighborhood_slug: string        // "nw-crossing" | "old-bend" | "tetherow" etc.
  featured_listing_key?: string    // Spark ListingKey - if omitted, use most recently closed
  community_event?: string         // Free text from Matt; if omitted, source from local press
  subject_line?: string            // Override subject; producer drafts one if omitted
  preview_text?: string            // Email preview snippet; producer drafts if omitted
}
```

---

## 3. Brief payload schema

```typescript
interface NewsletterActionRow {
  id: string
  action_type: 'content:newsletter'
  target: string                   // e.g. 'month:2026-05'
  assigned_producer: 'social_media_skills/newsletter'
  payload: NewsletterPayload
  data_evidence: {
    market_signal?: string         // e.g. 'MoS dropped below 4 - seller shift'
    listing_performance?: string
  }
  generation_reason: string
  status: 'pending'
}
```

---

## 4. The recipe

**Step 1 - Read the action row and transition to in_production**

```sql
SELECT * FROM marketing_brain_actions WHERE id = '<id>' AND status = 'pending';
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<id>';
```

**Step 2 - Load mandatory references**

Before producing any copy:
- `CLAUDE.md` §0 (Data Accuracy - every market figure traces to a live query)
- `CLAUDE.md` §0.5 (Draft-First, Commit-Last)
- `design_system/ryan-realty/SKILL.md` (brand register: navy `#102742`, cream `#faf8f4`, Geist body, Amboqia display)
- `marketing_brain_skills/brand-voice/voice_guidelines.md` (full load required for long-form)
- `marketing_brain_skills/research/tool-inventory.md` (API status before any call)
- `marketing_brain_skills/research/platform-bible.md` §21 (email surface rules)
- `marketing_brain_skills/research/asset-library-map.md` (asset registration on approval)
- `marketing_brain_skills/research/bend-market-bible.md` §1 (neighborhood spotlight content)

**Step 3 - Pull and verify market data from Supabase**

Pull the three headline stats for Bend SFR, current month:

```sql
-- Median close price (current month YTD):
SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice") AS median_price,
       COUNT(*) AS closed_count
FROM listings
WHERE "PropertyType" = 'A'
  AND "City" = 'Bend'
  AND "StandardStatus" = 'Closed'
  AND "CloseDate" >= date_trunc('year', now())
  AND "CloseDate" < now();

-- Active inventory count:
SELECT COUNT(*) AS active_count
FROM listings
WHERE "PropertyType" = 'A'
  AND "City" = 'Bend'
  AND "StandardStatus" = 'Active';

-- Months of supply (active / avg monthly closes over last 6 months):
SELECT COUNT(*) AS closed_last_6
FROM listings
WHERE "PropertyType" = 'A'
  AND "City" = 'Bend'
  AND "StandardStatus" = 'Closed'
  AND "CloseDate" >= now() - interval '6 months';
-- MoS = active_count / (closed_last_6 / 6)
-- Thresholds: <=4 seller, 4-6 balanced, >=6 buyer

-- Median days on market:
SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "CumulativeDaysOnMarket") AS median_dom
FROM listings
WHERE "PropertyType" = 'A'
  AND "City" = 'Bend'
  AND "StandardStatus" = 'Closed'
  AND "CloseDate" >= now() - interval '90 days';
```

Cross-check against `market_stats_cache` for reconciliation. If delta exceeds 1%, surface to Matt before proceeding (per CLAUDE.md §0 Spark x Supabase reconciliation gate).

**Step 4 - Pull featured listing data**

If `payload.featured_listing_key` is provided:
```sql
SELECT "StreetNumber", "StreetName", "ListPrice", "ClosePrice", "CloseDate",
       "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt",
       "SubdivisionName", "City", "PhotoURL", "ListAgentFullName", "ListAgentEmail"
FROM listings
WHERE "ListingKey" = '<key>';
```

If not provided, use the most recently closed Ryan Realty listing (where `ListAgentEmail` IN the brokers table).

Resolve listing agent from `public.brokers` to determine whose transaction this was. If it is a specific broker's deal, include that broker's name in the featured listing blurb. Do not use the broker headshot in the newsletter (brokerage-brand content).

**Step 5 - Pull neighborhood spotlight content**

Read the matching section from `marketing_brain_skills/research/bend-market-bible.md`. Pull current price range from Supabase `market_stats_cache` filtered to that neighborhood's subdivision aliases (from `neighborhood_subdivisions` table). Do not use the bible's prices verbatim - re-verify live.

```sql
SELECT ns.neighborhood_slug, ns.subdivision_name
FROM neighborhood_subdivisions ns
WHERE ns.neighborhood_slug = '<payload.neighborhood_slug>';

-- Then pull stats for those subdivision names:
SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "ClosePrice") AS median_price,
       COUNT(*) as sold_count
FROM listings
WHERE "SubdivisionName" = ANY('<subdivision_array>')
  AND "PropertyType" = 'A'
  AND "StandardStatus" = 'Closed'
  AND "CloseDate" >= now() - interval '12 months';
```

**Step 6 - Source community event**

Use `payload.community_event` if provided. Otherwise, search the local press (Bend Bulletin, Visit Bend, Bend Park and Recreation District website) for an upcoming event this month. Surface the raw event details to Matt in the contact sheet for confirmation before including in the newsletter body.

**Step 7 - Draft the newsletter copy**

Structure:

1. Subject line (50 chars max, no em-dash, no banned words, specific stat or place name)
2. Preview text (90 chars max, extends the subject line's thought)
3. Opening paragraph (2-3 sentences, "you/your" subject, current month context)
4. Market snapshot section (3 stats with verification trace, market verdict matching MoS)
5. Featured listing or recent sale (5-7 sentences, no banned adjectives, verified figures)
6. Neighborhood spotlight (4-6 sentences, factual, sourced from bible + live query)
7. Community event item (2-3 sentences, no promotional language, factual)
8. Closing (2-3 sentences in Matt's voice - see canonical phrases in voice_guidelines.md)
9. Signature block: Matt Ryan, Principal Broker, Ryan Realty, 541.213.6706, ryan-realty.com

Voice self-check before proceeding to Step 8:
- Grep for em-dash (U+2014), en-dash (U+2013) - replace with period or comma
- Grep for every banned word from voice_guidelines.md §6.2 (stunning, nestled, boasts, charming, pristine, gorgeous, breathtaking, must-see, dream home, meticulously maintained, entertainer's dream, tucked away, hidden gem, truly, spacious, cozy, luxurious, updated throughout, turnkey, immaculate, captivating, exquisite, delve, leverage, tapestry, navigate, robust, seamless, comprehensive, elevate, unlock, holistic, dynamic, vibrant, bustling, eclectic, curated, bespoke, foster)
- Grep for semicolons - replace with period
- Grep for exclamation marks - maximum one per newsletter, none in market-data sections
- Verify "you/your" is the subject throughout
- Verify phone format 541.213.6706 and URL ryan-realty.com (hyphenated)

**Step 8 - Build the HTML email**

HTML email template rules (from design_system/ryan-realty/SKILL.md, web register):
- Max width 600px, centered, white background inside, cream `#faf8f4` outer wrapper
- Fonts: Geist via web-safe fallback stack (system-ui, -apple-system, sans-serif) since web fonts do not render reliably in email clients
- Headlines: navy `#102742`, 24px, bold
- Body: charcoal `#1A1A1A`, 16px, line-height 1.6
- CTA button: navy background `#102742`, cream text `#faf8f4`, border-radius 8px, padding 12px 24px
- No emoji in email body
- Unsubscribe link at bottom (Resend handles this via list management)
- Physical address in footer (CAN-SPAM compliance): Ryan Realty, Bend, OR

Also produce plain-text fallback with all links spelled out fully.

**Step 9 - Write citations.json**

One entry per market figure used in the newsletter:

```json
{
  "deliverable": "out/newsletter/<YYYY-MM>/newsletter.html",
  "generated_at": "<ISO timestamp>",
  "figures": [
    {
      "figure": "$699,000 median price",
      "source": "Supabase listings",
      "filter": "PropertyType='A', City='Bend', StandardStatus='Closed', CloseDate YTD",
      "column": "ClosePrice median",
      "value": 699000,
      "row_count": 142,
      "fetched_at": "<ISO timestamp>"
    }
  ]
}
```

**Step 10 - Build the contact sheet**

Produce `out/newsletter/<YYYY-MM>/contact-sheet.html` per the template spec. The contact sheet for a newsletter renders the HTML email inline in an iframe (or copied HTML block), shows the plain-text fallback in a `<pre>` block, lists the verification trace table (one row per figure), shows the subject line and preview text clearly, and includes the approval prompt at the bottom.

**Step 11 - UPDATE action row to ready and surface to Matt**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = jsonb_build_object(
      'draft_path', 'out/newsletter/<YYYY-MM>/newsletter.html',
      'plain_text_path', 'out/newsletter/<YYYY-MM>/newsletter.txt',
      'contact_sheet', 'out/newsletter/<YYYY-MM>/contact-sheet.html',
      'subject_line', '<subject>',
      'word_count', <count>,
      'figures_count', <count>
    )
WHERE id = '<id>';
```

Surface to Matt in the standard format:

```
Draft ready: Monthly Newsletter - <month_label>

Contact sheet:
  file:///Users/matthewryan/RyanRealty/out/newsletter/<YYYY-MM>/contact-sheet.html

  DELIVERABLE
    HTML: out/newsletter/<YYYY-MM>/newsletter.html
    Plain text: out/newsletter/<YYYY-MM>/newsletter.txt
    Subject: <subject line>
    Preview text: <preview text>
    Word count: <N> words

  VERIFICATION TRACE
    - <figure> - Supabase listings, <filter>, fetched <ISO>
    [one line per market figure]

  citations.json: out/newsletter/<YYYY-MM>/citations.json

Reply with one of:
  approve newsletter  - send via Resend and register in asset library
  revise newsletter: <note>  - feedback I will act on
  kill newsletter  - drop this send
```

Stop. Do not send. Wait for Matt's explicit approval.

**Step 12 - On Matt's approval, send via Resend**

```javascript
// Using Resend Node SDK:
const { data, error } = await resend.emails.send({
  from: process.env.RESEND_FROM,  // 'Ryan Realty <mail@mail.ryan-realty.com>'
  to: '<recipient list from FUB export or Resend audience>',
  subject: payload.subject_line,
  html: htmlBody,
  text: plainTextBody,
  tags: [{ name: 'type', value: 'monthly-newsletter' },
         { name: 'month', value: payload.month_label }]
});
```

After successful send, register the assets:
- Upload HTML and plain text to Supabase Storage `asset-library` bucket
- Insert row into `public.asset_library` (if table exists) or log to `marketing_brain_actions.executor_response`

Transition action row: `approved` then `executed` after send confirmation.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | market data pull, action row transitions, brokers table | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Resend API | email send | `RESEND_API_KEY` (set), `RESEND_FROM` (UNSET - see §9) |
| FUB API | resolve broker, optional recipient list export | `FOLLOWUPBOSS_API_KEY` |
| Spark API | Supabase reconciliation cross-check | `SPARK_API_KEY`, `SPARK_API_BASE_URL` |

---

## 6. Output format

**Draft lands at:** `out/newsletter/<YYYY-MM>/`

```
out/newsletter/<YYYY-MM>/
├── newsletter.html       ← HTML email body
├── newsletter.txt        ← plain-text fallback
├── citations.json
└── contact-sheet.html   ← MANDATORY review surface
```

**Surface format:** See Step 11 above.

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-review-draft` | Matt sees the contact sheet and says "ship it" / "approved" / "go" / "send it" | Matt only |

**This producer uses:** `matt-review-draft`

Silence is not approval. A complete draft is not approval. The newsletter does not send until Matt's explicit word.

---

## 8. Status flow

```
pending           <- producer reads row here
  |
  v (producer starts work)
in_production     <- producer sets immediately; executed_at=now()
  |
  v (draft complete, citations written, contact sheet built)
ready             <- producer sets after surfacing draft; executor_response populated
  |
  v (Matt says "send it" / "approved")
approved          <- set after Matt's explicit approval word
  |
  v (Resend send completes, asset library registered)
executed          <- set after successful send + asset registration
  |
  v (7-day open/click metrics pulled from Resend)
measured          <- set by performance_loop with open rate, click rate, unsubscribes
```

SQL transitions follow the TEMPLATE.md standard.

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| `RESEND_FROM` unset | Send call fails with "invalid from address" | BLOCKING. Surface to Matt: "RESEND_FROM is unset. Verify mail.ryan-realty.com domain in Resend dashboard (add DNS TXT + DKIM records), then set RESEND_FROM=Ryan Realty <mail@mail.ryan-realty.com> in .env.local and Vercel env." Do not send. Set status='killed' with explanation. |
| `mail.ryan-realty.com` domain unverified | Resend returns 422 unverified sender | Same as above - cannot send from unverified domain. Draft can still be built and previewed. |
| Market data returns 0 rows | Supabase query returns empty | Report exact query and filters to Matt. Do not estimate figures. Set status='killed'. |
| Spark/Supabase delta >1% | Reconciliation gate fails | Surface both values and the delta to Matt. Do not proceed until resolved. |
| Banned word found in draft | Voice self-check in Step 7 hits | Rewrite offending sentence. Re-validate. Never show a failing draft to Matt. |
| Featured listing not in Supabase | ListingKey returns 0 rows | Fall back to most recently closed Ryan Realty listing. Surface the fallback choice to Matt in the contact sheet. |
| Community event cannot be sourced | Local press search returns nothing | Surface the gap to Matt in the contact sheet. Ask Matt to provide an event or a replacement community note. Hold the newsletter until filled. |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0 - Data Accuracy (outranks everything)
- `CLAUDE.md` §0.5 - Draft-First, Commit-Last (outranks everything)
- `design_system/ryan-realty/SKILL.md` - brand visual system (v2 two-color palette: navy + cream)
- `marketing_brain_skills/brand-voice/voice_guidelines.md` - voice enforcement (full load for long-form)
- `marketing_brain_skills/research/tool-inventory.md` - API and tool status before any call
- `marketing_brain_skills/research/platform-bible.md` - §21 email surface rules (Resend / mail.ryan-realty.com)
- `marketing_brain_skills/research/asset-library-map.md` - asset registration protocol on approval
- `marketing_brain_skills/research/bend-market-bible.md` - neighborhood spotlight source data

**Pipeline docs:**
- `automation_skills/content_engine/SKILL.md` - content routing; all content:* actions go through here
- `social_media_skills/platform-best-practices/SKILL.md` - 2026 platform rule layer
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` - banned content gate (applies to all copy)
- `video_production_skills/VIRAL_GUARDRAILS.md` - scorecard and format minimums

**Related producers:**
- `marketing_brain_skills/producers/ops-email-send/SKILL.md` - operational email sends (not monthly newsletters)
- `social_media_skills/market-report-blog/SKILL.md` - companion blog post (same market data, different surface)
- `marketing_brain_skills/producers/cma/SKILL.md` - CMA delivery email uses ops-email-send, not this producer

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md` - Section B, row `newsletter`
- **Phase 10 smoke test producer.** The pipeline routes a synthetic action row through this producer to verify end-to-end: Supabase data pull, voice validation, Resend send path. RESEND_FROM being unset is the expected smoke-test blocker to surface.

---

## 11. Notes for Phase 10 smoke test

The synthetic action row payload will be:
```json
{
  "month_label": "May 2026",
  "neighborhood_slug": "nw-crossing",
  "featured_listing_key": null,
  "community_event": null
}
```

Expected smoke-test outcome: producer executes Steps 1-10 successfully (builds draft, citations.json, contact sheet), surfaces draft to Matt, then halts at Step 12 when Resend send is attempted because `RESEND_FROM` is unset. Producer sets `status='killed'` with `executor_response` containing: `{"smoke_test": true, "blocker": "RESEND_FROM_UNSET", "resolution": "verify mail.ryan-realty.com in Resend, set RESEND_FROM env var"}`. This is the expected result - smoke test passes if the producer surfaces the correct blocker message.

## 12. Tool gap suggestions

What would make this 10x better:

1. **Resend email domain verification** (action required): verify mail.ryan-realty.com in the Resend dashboard to unlock custom "From" addresses and domain reputation.
2. **FUB segment sync**: pull segment membership directly from FUB rather than maintaining a separate list, so buyers who close automatically drop off the buyer newsletter and join the post-close segment.
3. **Dynamic open-time personalization**: use Resend send-time optimization to send each recipient's email at the hour they historically open emails, lifting open rates 10-20% per Resend benchmark data.

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
