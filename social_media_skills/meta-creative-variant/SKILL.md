---
name: meta-creative-variant
description: >
  Generates 3-5 Meta ad creative variants (headline + primary text + image concept) for
  an active ad set in the Facebook seller-growth funnel. Voice-validated headlines <=40
  chars and primary text <=125 chars. Outputs a contact sheet for Matt's approval before
  any ad-set update. Drops variants into marketing_brain_actions.executor_response.
  Reads docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md before any campaign mutation.
action_types:
  - content:meta_creative_variant
output_type: paid-ad
output_type: paid-ad
target_platforms: []
asset_destination: "out/meta-creatives/<campaign_id>/"
auto_inputs: ['existing_ad_performance', 'listing_photos', 'brand_assets']
required_inputs: "['campaign_id', 'variant_type (copy|visual|headline|cta)']"
optional_inputs: ['budget_usd (default inherits parent)', 'audience_override']
estimated_runtime_min: 10
cost_usd_estimate: $0 (ad spend separate)
thumbnail_uri: out/proof/2026-05-17/exemplars/meta-creative-variant/sample.jpg
example_outputs: []
    label: Phase 7.5 exemplar placeholder
    surface: facebook_ads

---

# Meta Creative Variant Producer

**Scope:** Generates a set of 3-5 creative variants for an existing Meta (Facebook and
Instagram) ad set. Each variant consists of a headline (40 chars max), primary text (125
chars max for in-feed display), a description (40 chars max), and an image concept
specification (with asset library source or generation prompt). The producer does NOT
create new campaigns, ad sets, or change targeting or budget. It operates strictly on
the creative layer. All variants land in `marketing_brain_actions.executor_response` and
a contact sheet for Matt's review before anything touches the live ad account. No ad-set
update executes without Matt's explicit "ship it" per the ops-meta-ads approval gate.

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** `out/meta-creative-variant/<campaign-slug>-<YYYY-MM-DD>/`
**Pipeline doc:** `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md` (read before any campaign work)

---

## 1. Scope

### In scope

- 3-5 creative variants per run, covering a range of angles (price stat, neighborhood, testimonial framing, social proof, market insight)
- Headline (40 chars max, per Meta in-feed truncation threshold)
- Primary text (125 chars max for preview display; full text can be longer but preview must read as complete)
- Description (40 chars max)
- Image concept specification (which asset to use OR what to generate, with enough detail for ops-meta-ads to execute the creative swap)
- Voice validation on all ad copy (no banned words, no em-dashes, no semicolons)
- Fair-housing compliance check (Special Ad Category: HOUSING - no demographic targeting signals in copy)
- Contact sheet for Matt's approval before any live account touch

### Out of scope

- Creating new campaigns or ad sets (use ops-meta-ads producer with matt-explicit approval)
- Budget or targeting changes (ops-meta-ads producer)
- Actually uploading creatives to Meta or swapping the live ad set (that is the ops-meta-ads producer executing AFTER Matt approves this contact sheet)
- Boosted posts (separate flow)
- Retargeting or lookalike audience design

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `content:meta_creative_variant` | `campaign_id` OR `ad_set_id`; `objective`; optional `variant_count`, `angles`, `market_context` | `variant_count` defaults to 4; `objective` is the seller-funnel goal this set serves |

### Payload schema

```typescript
interface MetaCreativeVariantPayload {
  // One of these is required:
  campaign_id?: string             // Meta campaign ID (act_XXXXXX pattern)
  ad_set_id?: string               // Meta ad set ID (more specific)

  // What this creative is for:
  objective: string                // 'seller_lead_capture' | 'market_report_download'
                                   // | 'home_valuation' | 'listing_awareness'

  // Optional creative guidance:
  variant_count?: number           // 3-5; defaults to 4
  angles?: string[]                // e.g. ['price-stat', 'urgency-free', 'neighborhood', 'social-proof']
                                   // Producer selects from the angle menu (§4 Step 5) if omitted
  market_context?: string          // e.g. 'Bend MoS 4.1, median $699K, down 13.4% YoY'
                                   // Producer pulls fresh if omitted

  // The listing or topic this creative is about (optional):
  listing_key?: string             // For listing-specific creative sets
  city?: string                    // Defaults to 'Bend'
  month_label?: string             // e.g. 'May 2026' for market-report creative
}
```

---

## 3. Brief payload schema

```typescript
interface MetaCreativeVariantActionRow {
  id: string
  action_type: 'content:meta_creative_variant'
  target: string                   // 'campaign:<campaign_id>' or 'ad_set:<ad_set_id>'
  assigned_producer: 'social_media_skills/meta-creative-variant'
  payload: MetaCreativeVariantPayload
  data_evidence: {
    cpl_trend?: string             // e.g. 'CPL rising 22% WoW - creative fatigue signal'
    creative_age_days?: number     // How old the current winning creative is
    impressions?: number           // Current creative total impressions
    frequency?: number             // Current creative frequency (goal: <3.5 before swap)
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

Before generating any copy:
- `CLAUDE.md` §0 (Data Accuracy - all market stats cited in copy trace to live queries)
- `CLAUDE.md` §0.5 (Draft-First, Commit-Last)
- `design_system/ryan-realty/SKILL.md` (brand voice, navy/cream palette, banned vocabulary)
- `marketing_brain_skills/brand-voice/voice_guidelines.md` (inline rules plus full §6.2 banned list)
- `marketing_brain_skills/research/tool-inventory.md` (Meta API token status before any call)
- `marketing_brain_skills/research/platform-bible.md` §5 (Facebook Feed ad spec: 125-char primary text, 40-char headline, 40-char description, HOUSING special category, fair housing compliance)
- `marketing_brain_skills/research/asset-library-map.md` (image asset sourcing hierarchy)
- `marketing_brain_skills/research/bend-market-bible.md` §4 (fair housing, Oregon disclosure)
- `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md` (live seller-funnel pipeline: CAPI, FUB wiring, campaign structure, approved budget bands, weekly optimization loop)
- `docs/MARKETING_LEAD_FLOW.md` (webhook path, FUB dedup, lead routing detail)
- `automation_skills/content_engine/SKILL.md` (content routing)
- `social_media_skills/platform-best-practices/SKILL.md` (2026 Meta algorithm context)

**Step 3 - Pull current campaign metadata from Meta Graph API**

```
GET /v18.0/<ad_set_id>?fields=id,name,status,daily_budget,optimization_goal,
    targeting,ads{id,name,creative{id,body,title,description,image_url},
    insights{impressions,reach,cpm,frequency,cost_per_result,actions}}
Access-Token: <META_USER_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN>
```

Extract:
- Current winning creative body, title, description
- Current impressions, frequency, CPL
- Campaign objective and optimization goal
- Targeting summary (city geo, age range, interests)

Note: Special Ad Category HOUSING restricts the targeting fields available. The variants must be compliant with this constraint. Do not generate copy that would violate Meta's housing ad policy by targeting or excluding based on demographics. Per platform-bible.md §5 Facebook Feed: the HOUSING special ad category must be declared on every real estate ad set; age, gender, and zip-code targeting restrictions apply.

**Step 4 - Pull fresh market context if not in payload**

If `payload.market_context` is not provided:
```sql
SELECT median_sale_price, active_count, months_supply, median_dom,
       median_sale_price_yoy_pct, stats_date
FROM market_stats_cache
WHERE city = '<payload.city or Bend>'
  AND property_type = 'A'
ORDER BY stats_date DESC LIMIT 1;
```

Apply the MoS verdict threshold (<=4 seller, 4-6 balanced, >=6 buyer). Use this for any "market insight" angle variants. Every stat used in ad copy traces to this query.

**Step 5 - Select creative angles for this variant set**

Angle menu (select `payload.variant_count` angles from this list, diversifying):

1. **Price-stat anchor**: Lead with the specific median price or YoY change. Hard number is the hook. "Bend homes are selling for $699K on average. Here is what that means for your home's value."
2. **Days-to-close specificity**: Use DOM or pending speed as the credibility signal. "Homes in Bend are going pending in 38 days on average. Is yours priced to compete?"
3. **Market-verdict framing**: Use the MoS verdict to frame urgency without false pressure. "Bend is a seller's market with just 4 months of supply. More buyers than available homes."
4. **Question-led curiosity**: Open with a question the reader is already asking. "What is your Bend home worth right now? The market shifted in 2026."
5. **Neighborhood specificity**: Name a specific neighborhood where something notable happened in the data. "NW Crossing homes sold above list price in April. What is driving it?"
6. **Social-proof framing**: Reference the number of homes Ryan Realty has helped sell in the area (verified from Supabase). "We have helped 47 Bend families sell this year. Here is what we learned about timing."
7. **No-pressure CTA**: Lead with what the reader gets, not what Ryan Realty wants. "Get your free Bend market analysis - no commitment required."

Each variant combines: angle choice + headline + primary text + description + image concept.

**Step 6 - Generate the creative variants**

Format per variant:

```
VARIANT <N> - Angle: <angle name>

Headline (<=40 chars): <text>
Primary text (<=125 chars preview): <text>
  (Full primary text if >125 chars): <continuation>
Description (<=40 chars): <text>
CTA button: <LEARN_MORE | GET_QUOTE | SIGN_UP | CONTACT_US>

Image concept:
  Asset: <path in asset-library OR "generate"> 
  If generate: <Imagen/Flux prompt or Shutterstock search term>
  Aspect: 1:1 for Feed / 9:16 for Reels (specify which)
  On-image text (if any): <text> [note: Meta penalizes >20% text coverage]
  Brand note: navy #102742 on cream #faf8f4; no logo in image (logo-is-a-closer rule)

Fair housing check: PASS / <flag any issues>
Voice check: PASS / <flag any issues>
```

Voice rules for paid-ad copy (from voice_guidelines.md and ANTI_SLOP_MANIFESTO):
- No em-dashes. No semicolons. No exclamation marks.
- No banned words (the full §6.2 list applies equally to ad copy as to editorial content)
- No fake urgency: "act fast", "don't miss out", "won't last long", "limited time"
- No hype openings: "get ready to fall in love", "introducing", "you won't believe"
- No "approximately", "roughly", "about" - use the actual number or omit the claim
- "You/your" is the subject. Never "I" in ad copy (brokerage speaks, not Matt personally)
- Phone format if used: 541.213.6706 (dotted). Bio phone for ads: 541.703.3095 (FUB-tracked)
- No emoji in headlines or primary text

Fair housing rules for HOUSING category ads (from platform-bible.md §5 and bend-market-bible.md §4):
- No demographic language in copy or image concepts
- No neighborhood descriptors that map to protected-class composition
- No language suggesting preference for buyer or seller demographic profiles
- "Family-friendly" - avoid in ad copy (familial status)
- School names are permissible as factual geographic descriptors
- Any copy referencing a specific neighborhood must use only physical/geographic facts

**Step 7 - Image concept resolution**

For each variant's image concept, check the asset library first (per asset-library-map.md §16 reuse contract):

1. Query `data/asset-library/manifest.json` for existing assets matching the concept
2. If found: reference the asset path and confirm the license is current
3. If not found: specify the Shutterstock search term or the Imagen 4 generation prompt
4. For Kling v2.1 or other AI video generation: reference `video_production_skills/media-sourcing/SKILL.md` decision tree

Image concepts must follow the logo-is-a-closer doctrine (from design_system/ryan-realty/SKILL.md §26): no logo in the ad image itself. The Ryan Realty name appears in the Facebook Page identity attached to the ad. The image is for stopping scroll, not for brand attribution.

**Step 8 - Voice and fair housing self-check across all variants**

Run the mandatory scan on every headline, primary text, description, and on-image text:
- Em-dash (U+2014), en-dash (U+2013): zero allowed
- Semicolons: zero allowed
- Banned words (voice_guidelines.md §6.2 complete list): zero allowed
- Fake urgency phrases: zero allowed
- Protected-class language or demographic descriptors: zero allowed

Do not surface a variant that fails any check. Auto-fix and re-check.

**Step 9 - Write citations.json**

For each market stat used in any variant's copy:
```json
{
  "deliverable": "out/meta-creative-variant/<slug>/contact-sheet.html",
  "variants": [
    {
      "variant_id": "v1",
      "figures": [
        {
          "figure": "$699K median price",
          "source": "Supabase market_stats_cache",
          "filter": "city='Bend', property_type='A', ORDER BY stats_date DESC LIMIT 1",
          "column": "median_sale_price",
          "value": 699000,
          "fetched_at": "<ISO>"
        }
      ]
    }
  ]
}
```

**Step 10 - Build contact sheet**

```
out/meta-creative-variant/<campaign-slug>-<YYYY-MM-DD>/
├── variants.json          <- all variant specs in structured format
├── citations.json
└── contact-sheet.html     <- MANDATORY review surface
```

The contact sheet for ad creative variants is a grid layout. Each variant occupies one card:
- Simulated ad preview: rendered HTML showing the approximate Facebook Feed layout (headline below image, primary text above, CTA button)
- Image concept description alongside an actual image if an asset-library match exists, or a placeholder if generating
- Char counts for headline, primary text, description (color-coded: green = within limit, red = over)
- Fair housing check badge (PASS green / FAIL red)
- Voice check badge (PASS green / FAIL red)
- Verification trace for any figures used

Below the grid: ops instructions for Matt explaining that approving this contact sheet authorizes ops-meta-ads to execute the creative swap in the live ad set.

**Step 11 - UPDATE action row to ready and surface to Matt**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = jsonb_build_object(
      'draft_path', 'out/meta-creative-variant/<slug>/contact-sheet.html',
      'variants_count', <count>,
      'campaign_id', '<id>',
      'ad_set_id', '<id>',
      'all_voice_checks', 'pass',
      'all_fair_housing_checks', 'pass',
      'variants', '<variants json array>'
    )
WHERE id = '<id>';
```

Standard surface format per TEMPLATE.md §6. Emphasize:
- "These are creative variants only. Approving this will queue the creative swap in ops-meta-ads. No targeting or budget changes."
- "Ops-meta-ads requires matt-explicit approval before executing the swap in the live account."

Stop. Do not touch the live ad account. Wait for Matt's explicit approval.

**Step 12 - On Matt's approval**

Transition this action row to `approved`. Create a new `ops:meta_creative_swap` action row targeting the approved variant(s), assigned to `marketing_brain_skills/producers/ops-meta-ads/SKILL.md`. That producer requires `matt-explicit` approval before executing the swap.

```sql
INSERT INTO marketing_brain_actions (
  action_type, target, assigned_producer, payload, generation_reason, status
) VALUES (
  'ops:meta_creative_swap',
  'ad_set:<ad_set_id>',
  'marketing_brain_skills/producers/ops-meta-ads',
  '{"approved_variant_ids": ["v1", "v3"], "source_action_id": "<this_id>"}'::jsonb,
  'Matt approved creative variants from content:meta_creative_variant <this_id>',
  'pending'
);
```

Set this action row to `executed` after the ops action row is created.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Meta Graph API | Pull current ad set metadata, creative performance | `META_USER_ACCESS_TOKEN` or `META_PAGE_ACCESS_TOKEN` (both set), `META_AD_ACCOUNT_ID` (set) |
| Supabase MCP | Market data pull, action row transitions, asset library | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Asset library | Image asset reuse query | `data/asset-library/manifest.json`, `video_production_skills/asset-library/SKILL.md` |
| Shutterstock API | Stock image sourcing for new concepts | `SHUTTERSTOCK_API_KEY` (set), `SHUTTERSTOCK_API_SECRET` (set) |
| Imagen 4 / Replicate | AI image generation for concepts without stock match | `REPLICATE_API_TOKEN` (set) |

---

## 6. Output format

**Draft lands at:** `out/meta-creative-variant/<campaign-slug>-<YYYY-MM-DD>/`

```
out/meta-creative-variant/<slug>/
├── variants.json
├── citations.json
└── contact-sheet.html    <- MANDATORY
```

**Variants.json structure:**
```json
[
  {
    "id": "v1",
    "angle": "price-stat anchor",
    "headline": "Bend homes: $699K median",
    "headline_chars": 28,
    "primary_text": "The Bend real estate market shifted in 2026. Get your free home valuation and see where your property stands.",
    "primary_text_preview_chars": 108,
    "description": "Free market analysis",
    "cta": "GET_QUOTE",
    "image_concept": {
      "asset_path": "photos/shutterstock/old-mill-exterior-001.jpg",
      "or_generate": null,
      "aspect": "1:1",
      "on_image_text": null
    },
    "voice_check": "pass",
    "fair_housing_check": "pass"
  }
]
```

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-review-draft` | Matt reviews the contact sheet and approves the variant set | Matt only |

**This producer uses:** `matt-review-draft` for the creative variants.

The downstream `ops:meta_creative_swap` action row that this producer creates uses `matt-explicit` (ops-meta-ads standard). Two gates: Matt approves the creative, then Matt explicitly names the swap action before it touches the live account.

---

## 8. Status flow

```
pending
  |
  v
in_production     <- immediately on pickup
  |
  v
ready             <- variants generated, all gates pass, contact sheet built
  |
  v (Matt says "ship it" / "use v1 and v3")
approved          <- this row approved; ops:meta_creative_swap row created
  |
  v (ops action row created)
executed          <- set after the ops action row is queued

killed            <- Matt rejects all variants, or any gate fails after 2 auto-fixes
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Meta API returns 401 | Token expired or invalid | Check `META_USER_ACCESS_TOKEN` status (per env-manifest.md, token has data_access re-grant until 2026-07-13). Surface the exact error. Do not attempt a creative variant set without knowing the current campaign data. |
| Meta API returns no ad sets | Campaign ID not found or wrong account | Verify `META_AD_ACCOUNT_ID` matches the active seller-funnel campaign. Surface to Matt. |
| All 3-5 variants fail voice gate | Banned words pervasive in all drafts | Auto-fix up to 2 iterations. If still failing, surface the specific failing patterns to Matt with rewrite suggestions. |
| Fair housing flag in variant | Copy references demographic | Rewrite to use only geographic and factual property descriptors. No demographic angle is acceptable under any circumstance for HOUSING category ads. |
| Image asset not in library and Shutterstock search returns no clear match | No appropriate licensed image | Generate with Imagen 4 via Replicate. Surface the generation prompt to Matt in the contact sheet for review before the image is used in a live ad. |
| Market stat delta >1% between Supabase and payload | Reconciliation triggers | Use the Supabase live query result. Surface the discrepancy in the contact sheet. |
| ops-meta-ads producer requires matt-explicit | Matt says "ship it" but ops requires another confirmation | Explain clearly: "I have queued the creative swap in ops-meta-ads. That action requires your explicit confirmation before touching the live ad account. Reply 'execute creative swap' to authorize it." |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0 - Data Accuracy (all stats in copy trace to live queries)
- `CLAUDE.md` §0.5 - Draft-First, Commit-Last
- `design_system/ryan-realty/SKILL.md` - brand voice, logo-is-a-closer doctrine, navy/cream palette
- `marketing_brain_skills/brand-voice/voice_guidelines.md` - inline rules (banned words, punctuation, fake urgency)
- `marketing_brain_skills/research/tool-inventory.md` - Meta API token status
- `marketing_brain_skills/research/platform-bible.md` - §5 Facebook Feed (ad copy specs: headline 40 chars, primary text 125 chars preview, HOUSING special category, fair housing compliance)
- `marketing_brain_skills/research/asset-library-map.md` - image asset sourcing hierarchy
- `marketing_brain_skills/research/bend-market-bible.md` - §4 Oregon regulatory environment, §5 COCAR rules
- `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md` - live seller-funnel pipeline (read before any Meta campaign work)
- `docs/MARKETING_LEAD_FLOW.md` - lead routing detail (webhook, FUB dedup)

**Pipeline:**
- `automation_skills/content_engine/SKILL.md` - content routing
- `social_media_skills/platform-best-practices/SKILL.md` - 2026 Meta algorithm context
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` - banned content gate
- `video_production_skills/VIRAL_GUARDRAILS.md` - scorecard and format minimums

**Downstream:**
- `marketing_brain_skills/producers/ops-meta-ads/SKILL.md` - executes the creative swap (matt-explicit gate)
- `social_media_skills/facebook-lead-gen-ad/SKILL.md` - creates new lead-gen campaigns (separate from this variant producer)

**Fair housing authority:**
- Fair Housing Act 42 U.S.C. § 3604 (federal protected classes)
- Meta Housing Ad Policy: https://www.facebook.com/business/m/special-ad-categories
- Oregon ORS 659A.421 (state extensions)

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md` - Section B, row `meta-creative-variant`
- Approval: `matt-review-draft` (creative variants) then `matt-explicit` (via ops-meta-ads for live swap)
- Meta API: https://developers.facebook.com/docs/marketing-api/reference/ad-creative

## 12. Tool gap suggestions

What would make this 10x better:

1. **Meta Creative Performance API**: before generating a variant, pull the existing ad's relevance score, CTR, and CPA from the Graph API to understand which dimension to test first.
2. **Dynamic creative optimization (DCO)**: instead of single variants, submit a DCO bundle with multiple headlines + images + CTAs and let Meta's algorithm find the winner automatically.
3. **Creative fatigue detector**: monitor frequency (impressions / reach) and auto-trigger a creative swap when frequency exceeds 3.0, the threshold at which Meta research shows engagement decay begins.

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

