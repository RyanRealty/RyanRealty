---
name: testimonial_card
description: >
  Produces a branded single-image testimonial quote card for a verified client review. Use when
  Matt asks for "make a testimonial card", "turn this review into a graphic", "quote card for
  Google review", "client testimonial image", "GBP review card", or any request to turn a
  client's words into a shareable image. Outputs both a 4:5 (IG/FB feed) and a 9:16
  (Story/Reel cover) variant. Validates the quote against voice guidelines before rendering
  to ensure no pandering or cliche language appears in the final image.
action_types:
  - content:testimonial_card
output_type: image
target_platforms: ['email']
asset_destination: out/testimonial_card/<review-slug>/
auto_inputs: ['brand voice rules']
required_inputs: ['topic']
optional_inputs: []
estimated_runtime_min: 3
cost_usd_estimate: "$0.00 - local rendering only"
thumbnail_uri: out/proof/2026-05-17/exemplars/testimonial_card/sample.png
example_outputs: []
---

# Testimonial Card

**Scope:** Renders a branded testimonial quote card from a verified client review. Outputs two
aspect variants - 4:5 for IG/FB feed and 9:16 for Stories and Reel posters. The card shows the
quote, reviewer first name, city (optional), and source attribution (Google, Zillow, etc.).
A Jax mascot badge (brand-led) or broker headshot (agent-led, requires `include_agent_headshot=true`)
appears in a corner accent. Does NOT pull review text from Google's API autonomously - the quote
must be provided by Matt or the action row payload to prevent fabrication. Does NOT publish the
card; it renders to `out/` and awaits Matt's approval.

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** `out/testimonial_card/<review-slug>/`

---

## 1. Scope

### In scope
- 4:5 PNG (1080x1350) for IG and FB feed
- 9:16 PNG (1080x1920) for Stories and Reel poster frame
- Navy-on-cream, cream-on-navy, or photo-overlay background styles
- Ryan Realty wordmark in the footer
- Jax mascot badge OR broker headshot in a corner accent (not both)
- Voice validation before render (no banned phrases in quote caption or attribution)
- "Source: Google Review" attribution line below the reviewer name

### Out of scope
- Pulling review text autonomously from Google Business Profile API (that is an ops action, not content)
- Cards with reviewer last names unless Matt explicitly approves
- Cards with star ratings rendered as star icons (text attribution only: "via Google")
- Cards for reviews that have not been verified as real (Matt must confirm the quote is authentic)
- Video testimonials (that is a separate future producer)

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `content:testimonial_card` | `quote_text`, `reviewer_first_name` | Voice-validated before render |

### Payload schema

```typescript
interface TestimonialCardPayload {
  quote_text: string              // verbatim client quote, unedited
  reviewer_first_name: string     // first name only
  review_source?: "google" | "zillow" | "realtor_com" | "direct"  // default "google"
  reviewer_city?: string          // optional - adds "Bend homebuyer" style attribution
  listing_agent_email?: string    // resolve to broker headshot if include_agent_headshot=true
  include_agent_headshot?: boolean  // default false
  background_style?: "cream_navy" | "navy_cream" | "photo_overlay"  // default "cream_navy"
  photo_url?: string              // required if background_style="photo_overlay"
}
```

---

## 3. Brief payload schema

```typescript
interface TestimonialCardActionRow {
  id: string
  action_type: "content:testimonial_card"
  target: string                  // e.g. "review:<reviewer_first_name>-<date>" or "review:google-<id>"
  assigned_producer: "social_media_skills/testimonial_card"
  payload: TestimonialCardPayload
  data_evidence: {
    audit_source?: string
    opportunity_area?: string
    signal_evidence?: string
  }
  generation_reason: string
  status: "pending"
}
```

---

## 4. The recipe

**Step 1 - Read the action row**

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<action_id>' AND status = 'pending';
```

**Step 2 - Load mandatory references**

- `CLAUDE.md` §0 - Data Accuracy. The quote is verbatim. No paraphrasing. No editing for polish.
  If the quote contains a typo, preserve it. If the quote is unclear, surface the raw text to Matt
  and ask whether to use it as-is or trim with ellipsis.
- `CLAUDE.md` §0.5 - Draft-First, Commit-Last.
- `design_system/ryan-realty/SKILL.md` - brand visual system.
- `marketing_brain_skills/brand-voice/voice_guidelines.md` - the voice validation pass at Step 3
  applies to any caption text or attribution line the producer generates, not to the client quote
  itself (clients can use any language they choose).

**Step 3 - Voice validation pass**

The client quote is reproduced verbatim. The producer generates three text elements that ARE
subject to voice validation:

1. Attribution line (e.g. "Sarah B., Bend homebuyer")
2. Source attribution (e.g. "via Google Review")
3. Any caption text written for the social post that accompanies the card (if requested)

Run `lib/punctuation-guard.ts` `assertNoDashes` on all producer-generated text.
Run a banned-word grep against `voice_guidelines.md` §6.2 on all producer-generated text.

Banned patterns that would make a testimonial card non-ship:
- Adding words Matt wrote that were not in the original review (fabrication)
- Adding "5 stars!" or exclamation-heavy attribution
- Adding phrases like "our clients love us" or "truly exceptional service" as framing copy
- Truncating the quote in a way that changes its meaning

If the raw quote contains a banned Ryan Realty phrase (e.g., a reviewer happened to write
"stunning"), that is acceptable in a verbatim quote. Do not redact the client's words.

**Step 4 - Resolve broker headshot (if include_agent_headshot=true)**

If `listing_agent_email` is provided and `include_agent_headshot=true`:

```sql
SELECT full_name, headshot_path
FROM brokers
WHERE email = '<listing_agent_email>'
LIMIT 1;
```

Map to:
- Matt Ryan: `design_system/ryan-realty/assets/team/matt-ryan.png`
- Paul Stevenson: `design_system/ryan-realty/assets/team/paul-stevenson.png`
- Rebecca Peterson: `design_system/ryan-realty/assets/team/rebecca-peterson.png`

Use the `.png` (transparent background) version. If `include_agent_headshot=false` (default),
use `design_system/ryan-realty/assets/brand/blue-dog.png` (Jax mascot) instead.

**Step 5 - Render 4:5 variant (1080x1350)**

Layout (cream `#faf8f4` background, cream_navy style):

```
[ top padding: 64 px ]
[ quote mark glyph: Amboqia, 120 px, navy, opacity 0.15, top-left flush ]
[ quote text block: Geist 400, 22 px, navy, max-width 880 px, centered horizontally,
  line-height 1.6, vertically centered in the middle zone ]
[ bottom zone: 200 px tall ]
  [ left: Jax or broker headshot, 72x72 px circle crop if JPG, transparent PNG at 72 px ]
  [ center: reviewer attribution: "reviewer_first_name, reviewer_city (if set)"
    Geist 600, 15 px, navy ]
  [ center: source attribution: "via Google Review" (or Zillow, etc.)
    Geist 400, 13 px, navy 60% opacity ]
  [ right: Ryan Realty wordmark, logo-blue.png, height 32 px ]
[ bottom padding: 40 px ]
```

For navy_cream style: swap background to `#102742`, all text to cream `#faf8f4`.
For photo_overlay: place the photo as a full-bleed background at 40% opacity overlay of navy,
then use cream text throughout.

**Step 6 - Render 9:16 variant (1080x1920)**

Same layout logic, vertically centered in the taller frame. The quote block expands to use the
additional vertical space gracefully. The bottom zone is fixed at 200 px from the bottom edge.

**Step 7 - QA gate**

- Confirm quote text is verbatim (compare character-by-character if under 200 words).
- Confirm "Virtually staged" watermark is NOT on these cards (wrong producer, just being thorough).
- Confirm the Ryan Realty wordmark is present in both variants.
- Confirm no banned phrase appears in attribution or any caption text.
- Confirm 4:5 is exactly 1080x1350 and 9:16 is exactly 1080x1920.
- Confirm contrast ratio meets WCAG AA on the dominant text zone.

**Step 8 - Write citations.json**

```json
[
  {
    "figure": "Client quote verbatim",
    "source": "payload.quote_text - provided by Matt or action row",
    "filter": "reviewer_first_name='<name>', source='<source>'",
    "column": "quote_text",
    "value": "<first 80 chars of quote>...",
    "fetched_at": "<ISO of when this action row was created>"
  }
]
```

**Step 9 - Update the action row**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = '{"draft_path": "out/testimonial_card/<slug>/", "variants": ["4x5", "9x16"]}'::jsonb
WHERE id = '<action_id>';
```

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Sharp (Node) or `@napi-rs/canvas` | PNG compositing | `scripts/composite-social-assets.mjs` |
| `lib/punctuation-guard.ts` | Em-dash and en-dash ban enforcement on generated text | local module |
| `design_system/ryan-realty/assets/brand/logo-blue.png` | Wordmark | local file |
| `design_system/ryan-realty/assets/brand/blue-dog.png` | Jax mascot (default) | local file |
| `design_system/ryan-realty/assets/team/*.png` | Broker headshots (if include_agent_headshot=true) | local files |
| Supabase (service role) | Broker lookup by email (if include_agent_headshot=true) | `SUPABASE_SERVICE_ROLE_KEY` |

---

## 6. Output format

**Draft lands at:** `out/testimonial_card/<review-slug>/`

```
out/testimonial_card/<review-slug>/
├── testimonial-4x5.png         (1080x1350, IG/FB feed)
├── testimonial-9x16.png        (1080x1920, Stories/Reels poster)
├── citations.json
└── contact-sheet.html
```

**Surface format:**

```
Draft ready: testimonial_card - <reviewer_first_name> via <source>

Contact sheet:
  → file:///Users/matthewryan/RyanRealty/out/testimonial_card/<slug>/contact-sheet.html

  DELIVERABLES
    testimonial-4x5.png  - IG/FB feed, cream-navy style
    testimonial-9x16.png - Stories/Reel poster

  QUOTE (verbatim - confirm this is what you want displayed)
    "<quote_text>"
    - <reviewer_first_name><, reviewer_city if set>, via <source>

  VOICE CHECK
    Producer-generated attribution text: PASS (no banned phrases)
    Client quote: reproduced verbatim (not subject to voice rules)

  citations.json: out/testimonial_card/<slug>/citations.json

Reply with one of:
  • approve <slug>          - ready to queue for posting
  • revise <slug>: <note>   - e.g. "use navy background instead"
  • kill <slug>             - drop this deliverable
```

---

## 7. Approval gate

**This producer uses:** `matt-review-draft`

Every testimonial card requires Matt to confirm the quote is authentic and the reviewer has
implicitly or explicitly consented to their words being shared publicly. Matt's approval is
the consent record for the published card.

---

## 8. Status flow

```
pending  ->  in_production  ->  ready  ->  approved  ->  executed  ->  measured
                                                 killed (Matt cancels or QA fails 2x)
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Quote text is empty | payload.quote_text is null or whitespace | Stop and surface to Matt. Never fabricate a quote. |
| Quote is suspiciously short | <10 words | Flag to Matt. Very short quotes can appear fabricated. Confirm authenticity before proceeding. |
| Broker headshot not found | No matching row in brokers table | Fall back to Jax mascot. Flag the lookup failure in contact sheet. |
| Banned phrase in attribution | punctuation-guard or banned-word grep fires on generated text | Fix the attribution line. Do not surface until clean. |
| Font not available | Sharp throws on Geist rendering | Confirm Geist font file path in `design_system/ryan-realty/fonts/`. |

---

## 10. Related skills and references

**Required reading before executing:**

1. `CLAUDE.md` §0 - Data Accuracy (verbatim quote is the data; no editing)
2. `CLAUDE.md` §0.5 - Draft-First, Commit-Last (non-negotiable)
3. `design_system/ryan-realty/SKILL.md` - brand visual system
4. `marketing_brain_skills/brand-voice/voice_guidelines.md` - banned tropes in attribution text; pandering patterns banned in §6.3
5. `marketing_brain_skills/research/tool-inventory.md` - Sharp, napi-rs/canvas packages (§3.4), Supabase (§1.4)
6. `marketing_brain_skills/research/platform-bible.md` - review-content legal guidance; FTC endorsement rules for real estate
7. `marketing_brain_skills/research/asset-library-map.md` - where testimonial PNGs live after approval
8. `marketing_brain_skills/research/bend-market-bible.md` - local context for reviewer attributions
9. `automation_skills/content_engine/SKILL.md` - content routing
10. `social_media_skills/platform-best-practices/SKILL.md` - 2026 platform rule layer (4:5 is peak IG engagement format)
11. `video_production_skills/ANTI_SLOP_MANIFESTO.md` - no fake or fabricated social proof; AI-generated testimonial text is absolutely banned
12. `video_production_skills/VIRAL_GUARDRAILS.md` - quote card cover discipline: the first 0.5 s must communicate the value, not be decorative

**Related producers:**
- `marketing_brain_skills/producers/ops-reputation/SKILL.md` - pulls GBP reviews that feed into testimonial card payloads
- `social_media_skills/ig-single-post/SKILL.md` - testimonial card is a common S-template variant
- `social_media_skills/instagram-carousel/SKILL.md` - testimonial cards appear as closing slides in listing carousels

**Registry entry:** `marketing_brain_skills/producers/REGISTRY.md` - Section B, row `testimonial_card`

## 12. Tool gap suggestions

What would make this 10x better:

1. **GBP API auto-import**: poll Google Business Profile for new 5-star reviews on a cron and auto-create a produce action row for each one, eliminating the manual trigger step.
2. **Review sentiment validation**: before generating the card, run the review text through a sentiment classifier to confirm it is positive and does not contain any suppressed claims.
3. **Multi-platform publish routing**: after Matt approves the card, auto-post it to IG, LinkedIn, and Facebook in sequence using the publish skill rather than requiring separate dispatches.

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

