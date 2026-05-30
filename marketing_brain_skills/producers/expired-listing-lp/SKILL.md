---
name: expired-listing-lp
description: >
  Produces empathy-driven landing-page copy + audit deliverables for expired,
  withdrawn, or canceled listings in Central Oregon. Triggered by either the
  hourly /api/cron/detect-expired-listings detection cron OR direct
  invocation ("create an expired-listing audit for 1234 Main St"). Voice is
  honest + transparent + never pandering + never editorializing per
  voice_guidelines.md §4.7.
action_types:
  - content:expired-listing-audit
  - content:expired-listing-lp-update
output_type: document
target_platforms: ['email']
asset_destination: "public/expired-listings/<slug>/"
auto_inputs: ['supabase listings row by ListingKey', 'broker_headshot from public.brokers']
required_inputs: ['listing_key OR street_address']
optional_inputs: ['owner_name', 'owner_email', 'broker_email (defaults to matt@ryan-realty.com)']
estimated_runtime_min: 8
cost_usd_estimate: $0.05-$0.20 per audit (Anthropic + Supabase reads)
thumbnail_uri: app/lp/expired-listing/page.tsx
example_outputs:
  - uri: "app/lp/expired-listing/page.tsx"
    label: "The live LP at /lp/expired-listing"
    surface: "email"
---

# Expired Listing Audit + Landing Page Producer

**Scope:** Two related deliverables:

1. **The shared `/lp/expired-listing` landing page.** Empathy-driven, brand-voice-compliant, framework for the audit. Lives at `app/lp/expired-listing/`. Already shipped.
2. **Per-listing written audit.** A 1-page email-deliverable that runs the 5-cause diagnostic on a specific expired property: price thesis vs comps, photo quality, MLS description, syndication, agent responsiveness. Triggered by the cron OR direct ask.

**Status:** Canonical
**Locked:** 2026-05-18
**Voice:** docs/voice_guidelines.md §4.7 "Authentic, not salesy". Never pander, never editorialize, honest + transparent, never overtly state value, let language speak for itself.

---

## 0. The voice rules that govern every output

**Read these BEFORE writing any expired-listing copy:**

1. `marketing_brain_skills/brand-voice/voice_guidelines.md`. Especially §4.7.
2. `docs/FUB_AGENT_LINK_AND_EXPIRED_LP_RESEARCH_2026-05-17.md` task 2. Sentiments to address + reference URLs.
3. `CLAUDE.md` §0.3. Banned words, em-dashes, etc.

**Hard rules for THIS producer specifically:**

- **No "most agents do X, we do Y"** comparison framing. Banned by voice §6.4 dramatic before-and-after.
- **No urgency language.** "Act fast", "won't last", "limited consultations" are banned.
- **No editorializing the prior agent.** Don't name names. Don't say "your last agent failed you." Don't say "they should have done X." Just describe what an honest re-list looks like.
- **No promising to sell the home.** "We can sell your home" is a claim, not a fact. Describe the process, not the outcome.
- **Name the feeling once, then move on.** The reader is not here for therapy. They want to know what to do.
- **Data over adjectives.** "The audit pulls 8 closed comps from your immediate neighborhood" beats "we do a thorough analysis."
- **CTA is low-friction.** "Get a free written audit" or "20-minute call, no pitch." Never "schedule your free strategy session" or similar marketing-script language.

---

## 1. Scope

### In scope

- The shared `/lp/expired-listing` landing page (empathy-driven, brand-voice-compliant, lives at `app/lp/expired-listing/`)
- Per-listing written audit: a 1-page email-deliverable running the 5-cause diagnostic on a specific expired property
- Triggered by the hourly cron at `/api/cron/detect-expired-listings` OR direct invocation
- Output: `public/expired-listings/<slug>/audit.html`

### Sentiments mapped to empathetic responses

From the research doc, the 7 things expired-listing owners feel + the response that lands:

| Feeling | Response that lands |
|---|---|
| Frustration the home didn't sell | "Your home was on the market for X months. It didn't sell. That's a real outcome to sit with, not a small thing." Then pivot to what's fixable. |
| Embarrassment toward neighbors / family | Reframe as data. Withdrawn means property + market + strategy didn't line up. Most expired listings re-list and sell within 90 days under the right plan. |
| Distrust of agents | Don't position against the prior agent. Describe what an honest re-list looks like: weekly written updates, a specific price thesis, every offer reviewed in writing. |
| Anger at price drops they were pushed into | "Price isn't the only lever. Bend has homes that sat at $895K for 90 days and sold at $890K under different photography, staging, and timing." |
| Confusion about what marketing actually got done | "Offer a free marketing audit of the prior listing. One-page review of photos, MLS description, syndication, social posts, open houses, agent showings." |
| Fatigue | "Re-listing isn't always right. A 20-minute conversation can tell you whether re-list, rent, or hold is the move." |
| Market may have changed under them | "Show the actual MoS data for their neighborhood at time of original list vs now. Specific number, specific source." |

### Out of scope

- Transaction coordination or listing agreement creation (separate producers)
- Full CMA deliverable (use `cma` producer for that)
- Any surface other than email delivery and the shared web LP

---

## 2. Action types handled

| action_type | payload | notes |
|---|---|---|
| `content:expired-listing-audit` | `listing_key` (text), `owner_name` (text), `owner_email` (text), `broker_email` (default matt@) | Generates the 1-page audit, optionally emails it |
| `content:expired-listing-lp-update` | none (rebuilds LP from current data) | Run when sentiment research updates or Bend stats refresh |

### The 5-cause audit framework

Every per-listing audit covers these five things, in this order. Each section is 1-2 paragraphs max. Each section is sourced.

1. **Price thesis vs comps.** Pull the closed comps in the property's immediate neighborhood (subdivision or 0.5 mi radius) during the window the property was active. Compare median $/sqft to the listing's last list price. Verdict: was the price at, above, or below market? Source: Supabase listings table, filtered to closed within DateRange + within radius.
2. **Photo and staging quality.** Audit the Spark MLS photo set (we have them via Spark API). Check for: dark interior shots, no widely-angled hero, missing room types, dated furniture not staged out. Verdict: photos drove buyers away or were neutral.
3. **MLS description quality.** Pull `public_remarks` from listings table. Check for: generic openers, missing unique features (the things that make THIS home different), word count under 100 (too short) or over 300 (too long), realtor-speak red flags ("must see", "won't last", "stunning"). Verdict: description sold the home or was forgettable.
4. **Syndication and exposure.** From the Spark MLS data and the timestamps in `listings.status_change_count` / `status_change_timestamp`, check: was the listing actively updated? Multiple price drops with timing? Days between updates? Verdict: listing was actively marketed or sat quietly.
5. **Agent responsiveness.** This is the hardest to audit programmatically. We can sometimes pull `ShowingsCount` and `LastShownDate` from Spark. If those are present + showings count is below median for area, the agent didn't drive the buyer pool. Verdict: agent engaged or absent.

For each cause, write 2-3 sentences. Don't editorialize ("the agent failed you"). Just present what we found and what it means. Let the data tell the story.

---

## 3. Brief payload schema

```typescript
interface ExpiredListingAuditPayload {
  // One of these is required:
  listing_key?: string       // Spark/Supabase ListingKey
  street_address?: string    // '1234 Main St, Bend, OR 97701'

  // Owner (recipient of the audit):
  owner_name?: string
  owner_email?: string       // for delivery; optional at create time

  // Broker who signs (defaults to matt@ryan-realty.com):
  broker_email?: string
}

interface ExpiredListingActionRow {
  id: string
  action_type: 'content:expired-listing-audit' | 'content:expired-listing-lp-update'
  target: string             // e.g. 'listing:<key>' or 'address:<slug>'
  assigned_producer: 'marketing_brain_skills/producers/expired-listing-lp'
  payload: ExpiredListingAuditPayload
  data_evidence: {
    detected_by?: 'hourly-cron' | 'matt-direct'
    days_expired?: number
    last_list_price?: number
  }
  generation_reason: string
  status: 'pending'
}
```

---

## 4. The recipe

```typescript
// Pseudocode for action_type='content:expired-listing-audit'
1. Read action row + payload → listing_key
2. Pull listing record from Supabase by ListingKey (quoted column names per CLAUDE.md)
3. Pull closed comps from same subdivision (or 0.5mi radius) during property's active window
4. Compute the 5-cause diagnostic:
   a. Price thesis: median $/sqft of comps vs listing's last $/sqft
   b. Photo quality: count, distribution, types (via Spark API)
   c. MLS description: word count + banned-word scan + uniqueness signal
   d. Syndication: status_change_count + days between updates
   e. Agent responsiveness: showings count vs area median (if available)
5. Generate the 1-page audit HTML (template at marketing_brain_skills/producers/expired-listing-lp/templates/audit-template.html)
6. Apply brand voice lint (em-dashes banned, banned words, pandering check via scripts/_producer_lib.has_hard_fail())
7. Render to PDF if needed (puppeteer-core + chromium-min, same pattern as CMA producer)
8. Save to public/expired-listings/<slug>/audit.html
9. If owner_email present, queue an email via ops-email-send producer
10. Update the action row with executor_response { audit_path, comps_count, verdict }
```

### Verification trace (mandatory before any audit ships)

Per CLAUDE.md §0 Data Accuracy mandate, every figure in the audit must trace to a primary source. Format:

```
$895,000 median sale price. Supabase listings, City='Bend', SubdivisionName='Awbrey Glen',
  CloseDate between 2026-01-01 and 2026-04-19, median(ClosePrice) = $895,000 over 14 rows.
  Verified 2026-05-17.
```

No trace. No figure. Cut, don't estimate.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | listings pull + comps query + action row updates + expired_listing_intake writes | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Spark API | photo arrays per listing, ShowingsCount, LastShownDate | `SPARK_API_KEY`, `SPARK_API_BASE_URL` |
| puppeteer-core + @sparticuz/chromium-min | PDF render if requested | same pattern as CMA producer |
| ops-email-send producer | outbound delivery of the audit once approved | `RESEND_API_KEY`, `mail.ryan-realty.com` sender |
| scripts/_producer_lib.py | `has_hard_fail()`, `grep_banned_categorized()` for voice lint | in-repo |
| comms-matt-alert producer | fires when detection cron creates a new FUB record | in-repo |

---

## 6. Output format

**Draft lands at:** `public/expired-listings/<slug>/audit.html`

**Files produced:**
```
public/expired-listings/<slug>/
├── audit.html
├── citations.json
└── contact-sheet.html    (MANDATORY per "Contact sheet required" rule 2026-05-14)
```

**Surface format (present to Matt exactly like this):**

```
Draft ready: expired-listing-audit. <address>

  DELIVERABLE
    HTML: public/expired-listings/<slug>/audit.html
    Contact sheet: file:///Users/matthewryan/RyanRealty/public/expired-listings/<slug>/contact-sheet.html

  VERIFICATION TRACE
    - <figure>. <source>, <filter>, fetched <iso>
    [one line per figure]

  citations.json: public/expired-listings/<slug>/citations.json

Reply "ship it" / "approved" / "go" to commit + push and queue email delivery.
```

Then stop. Do not commit. Wait for Matt's explicit approval.

---

## 7. Approval gate

`content:expired-listing-audit` uses `matt-review-draft` per the standard content engine flow. Draft lands in `public/expired-listings/<slug>/audit.html`. Matt approves, then ops-email-send takes over for delivery.

The LP itself (`/lp/expired-listing`) is web-published once. Updates go through the standard draft-first commit-last workflow per CLAUDE.md §0.5.

---

## 8. Status flow

```
pending -> in_production -> ready -> [Matt review] -> approved -> executed -> measured
```

Same as every content producer.

SQL to transition:
```sql
-- On pickup:
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';

-- On draft ready:
UPDATE marketing_brain_actions
SET status='ready',
    executor_response='{"draft_path":"...","comps_count":N,"verdict":"..."}'::jsonb
WHERE id='<id>';
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| No comps in window | fewer than 4 comps closed in the property's immediate neighborhood during the active window | Expand to 0.5mi radius. If still under 4, write the audit with "limited comp set" caveat surfaced in the verification trace. |
| No photo access | Spark photo URLs are gone (listing too old) | Skip cause #2 and mark "photo audit not available." |
| Banned-word lint fails | `has_hard_fail()` returns true | Refuse to ship. Re-write the offending section. |
| Owner email missing | no `owner_email` in payload | The audit lives in `public/expired-listings/<slug>/audit.html` and on the FUB person record as a Note. Matt can manually deliver via Gmail or direct mail. |
| Supabase query returns 0 rows | listing too old or ListingKey mismatch | Report to Matt with the exact query. Set `status='killed'` with error in `executor_response`. |
| Voice validation fails | brand voice checker returns violations | Do not present draft. Fix violations and re-validate. |

---

## 10. Related skills and references

- `marketing_brain_skills/producers/cma/SKILL.md`. Same architecture pattern (per-property HTML deliverable with verification trace + PDF render)
- `marketing_brain_skills/producers/ops-email-send/SKILL.md`. For outbound delivery once audit is approved
- `marketing_brain_skills/producers/comms-matt-alert/SKILL.md`. Fires when the detection cron creates a new FUB record so Matt sees it immediately
- `marketing_brain_skills/brand-voice/voice_guidelines.md` §4.7. Voice rules this producer is gated against
- `docs/FUB_AGENT_LINK_AND_EXPIRED_LP_RESEARCH_2026-05-17.md`. Research that drove the LP voice + content
- `app/lp/expired-listing/page.tsx`. Live LP source
- `app/api/cron/detect-expired-listings/route.ts`. Hourly cron that creates FUB records + alerts Matt
- `public.expired_listing_intake` Supabase table. Dedupe + audit trail

---

*The producer's first job is to make sure the expired-listing OWNER feels seen without being sold to. Every sentence is checked against §4.7 before ship.*

---

## 11. Tool gap suggestions

Tool gap suggestions: see tool-acquisition-recommendations.md for the aggregated list across all producers.

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
