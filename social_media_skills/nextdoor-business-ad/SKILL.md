---
name: nextdoor-business-ad
description: >
  Drafts a Nextdoor for Business sponsored post or local awareness ad targeting
  Bend-area homeowners in the seller funnel. Hyperlocal tone, brokerage as subject,
  neighbor as audience. Publish step is manual: draft handed off to Matt who pastes
  into the Nextdoor Business dashboard because the Nextdoor API is not yet wired.
action_types:
  - content:nextdoor_business_ad
output_type: paid-ad
output_type: paid-ad
target_platforms: ['nextdoor']
asset_destination: "out/nextdoor/<campaign_id>/"
auto_inputs: ['recent_listings', 'brand_assets']
required_inputs: ['neighborhood_slug or zip_code']
optional_inputs: "['ad_format (awareness|listing_spotlight)', 'budget_usd']"
estimated_runtime_min: 8
cost_usd_estimate: $0 (ad spend separate)
thumbnail_uri: out/proof/2026-05-17/exemplars/nextdoor-business-ad/sample.jpg
example_outputs: []
    label: Phase 7.5 exemplar placeholder
    surface: nextdoor

---

# nextdoor-business-ad

**Scope:** Produces a Nextdoor for Business sponsored-post copy bundle targeting
seller-intent homeowners in specific Bend neighborhoods. Deliverable is the post body,
headline, call-to-action label, and a suggested image brief for Matt to source or
approve. The publish step is manual: Matt pastes the draft into the Nextdoor Business
dashboard. No Nextdoor API call is made by this producer because
`NEXTDOOR_CLIENT_ID`, `NEXTDOOR_CLIENT_SECRET`, and `NEXTDOOR_REDIRECT_URI` are
unset per `marketing_brain_skills/research/env-manifest.md`.

Does NOT post to Nextdoor (API not wired; see §9 failure modes). Does NOT produce
Meta, Google, or any other paid-ad copy. Does NOT write organic neighborhood posts
(those route through `ops-reputation` for GBP or through the organic social pipeline).

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** `out/nextdoor-business-ad/<slug>/post-bundle.txt` + `contact-sheet.html`

---

## 1. Scope

### In scope

- `content:nextdoor_business_ad`: sponsored post or local awareness ad copy bundle
- Targeting Bend neighborhoods listed in `marketing_brain_skills/research/bend-market-bible.md` §1
- Post body (up to 500 chars for sponsored posts; 280 chars for awareness ads)
- Headline (under 60 chars)
- CTA label (up to 20 chars)
- Image brief (one paragraph describing the ideal photo; producer does not source the image)
- Neighborhood targeting spec for the Nextdoor dashboard
- Voice-validated against neighbor-tone rules: brokerage is the subject, neighbor is the audience, no first-person agent voice, no pressure language

### Out of scope

- Posting to Nextdoor (API not wired; Matt pastes manually)
- Organic neighborhood posts (Nextdoor recommendations or free posts)
- Image sourcing (image brief only; Matt chooses final photo)

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `content:nextdoor_business_ad` | `target_neighborhoods`, `ad_type`, `campaign_goal`, `market_stat` | `market_stat` must be pre-verified or left null |

### Payload schema

```typescript
interface NextdoorBusinessAdPayload {
  target_neighborhoods: string[];   // from bend-market-bible.md §1 slugs
                                    // e.g. ['nw_crossing', 'old_bend', 'tetherow']
  ad_type: 'sponsored_post' | 'local_awareness';
  campaign_goal: 'seller_leads' | 'brand_awareness';
  market_stat?: string;             // verified stat to include, e.g. "homes in NW Crossing sold in 28 days YTD"
  cta_url: string;                  // e.g. 'https://ryan-realty.com/sell'
}
```

---

## 3. Full action row schema

```typescript
interface NextdoorBusinessAdActionRow {
  id: string;
  action_type: 'content:nextdoor_business_ad';
  target: string;                   // e.g. 'neighborhood:nw_crossing'
  assigned_producer: string;        // 'social_media_skills/nextdoor-business-ad'
  payload: NextdoorBusinessAdPayload;
  data_evidence: {
    audit_source?: string;
    opportunity_area?: string;      // e.g. 'High seller-intent searches in NW Crossing'
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

**Step 2: Load mandatory references**

- `CLAUDE.md` §0: Data Accuracy (any market stat must trace to a live Supabase query)
- `CLAUDE.md` §0.5: Draft-First, Commit-Last
- `design_system/ryan-realty/SKILL.md`: brand register
- `marketing_brain_skills/brand-voice/voice_guidelines.md`: full banned-word list and neighbor-tone rules
- `marketing_brain_skills/research/tool-inventory.md`: Nextdoor API status (currently unset)
- `marketing_brain_skills/research/platform-bible.md`: §19 Nextdoor surface rules
- `marketing_brain_skills/research/asset-library-map.md`: image brief context
- `marketing_brain_skills/research/bend-market-bible.md`: §1 for each target neighborhood facts
- `automation_skills/content_engine/SKILL.md`: routing context
- `social_media_skills/platform-best-practices/SKILL.md`: §19 Nextdoor + §24 compliance
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`: banned-content gate (applies to all copy)
- `video_production_skills/VIRAL_GUARDRAILS.md`: banned-word check §12

**Step 3: Load neighborhood facts**

For each neighborhood in `payload.target_neighborhoods`, read the relevant §1.x
subsection of `marketing_brain_skills/research/bend-market-bible.md`. Extract:
- Typical price range (note the source and its date; re-verify before use)
- Key amenities to reference as neighborhood anchors
- HOA reality (relevant for seller content)
- Buyer profile (use in reverse: what do current owners value?)

**Step 4: Verify any market stat**

If `payload.market_stat` is provided, verify it live before including it in copy.

For a DOM stat:
```sql
SELECT
  AVG("CumulativeDaysOnMarket")::int AS avg_dom,
  COUNT(*) AS closed_count,
  "SubdivisionName"
FROM listings
WHERE "StandardStatus" = 'Closed'
  AND "PropertyType" = 'A'
  AND "CloseDate" >= date_trunc('year', now())
  AND "City" = 'Bend'
GROUP BY "SubdivisionName"
ORDER BY closed_count DESC;
```

Match against neighborhood subdivision aliases from the Supabase
`neighborhood_subdivisions` table (populated by migration 20260515170000). If the
figure in the payload does not match the live query within 5%, use the live figure.
If no verifiable stat exists for the target neighborhood, omit the stat from copy.

**Step 5: Draft the post body**

Nextdoor neighbor-tone rules (hard rules for this surface):
- The brokerage speaks, not an individual agent. Use "Ryan Realty" or "our team" not "I."
- No first-person agent voice.
- The reader is a neighbor, not a lead. Open with a neighborhood-specific anchor (the park, the trail, the school) not a sales hook.
- No pressure language ("Don't wait," "Act now," "Won't last").
- No vague qualifiers ("approximately," "roughly," "about"). Use the verified number or omit.
- No exclamation marks in the post body.
- No em-dashes, no semicolons.
- One genuine fact about the neighborhood must appear in the first sentence.
- If market data is included, it follows the fact, not leads with it.

**Sponsored post body (500 chars max):**

Structure:
1. Neighborhood anchor sentence. One factual detail (trail access, school proximity, walkability).
2. Market signal sentence. One verified stat or a factual observation from the MLS data.
3. Value offer sentence. What Ryan Realty provides. Direct and specific. No hype.
4. CTA. One sentence. "If you're curious what your home is worth, ryan-realty.com has a free estimate tool."

**Local awareness ad body (280 chars max):**

Condensed to: neighborhood anchor + market signal + CTA URL. No four-sentence structure; every word must earn its place.

**Step 6: Draft the headline (60 chars max)**

Direct, place-specific, factual. No banned words. No exclamation. Sentence case.
Examples of the right register:
- "Homes in NW Crossing are selling in 28 days this year"
- "Old Bend inventory is down 14% from last spring"
- "Tetherow: what sellers need to know in 2026"

**Step 7: Draft the CTA label (20 chars max)**

One action phrase. "See your home value" or "Get a free estimate" or "Learn more."

**Step 8: Write the image brief**

One paragraph. Describe the ideal photo without naming a banned source. Reference the
canonical hero photo or neighborhood-specific imagery from
`design_system/ryan-realty/assets/hero/` if applicable:
- NW Crossing: trail-adjacent craftsman exterior, green space visible, no text overlay.
- Old Bend: Drake Park water view or Craftsman bungalow detail, natural light.
- Tetherow: golf course ridge line or mountain view behind a contemporary home exterior.

Do not source the photo. Matt chooses the final image. The brief tells Matt what to look for.

**Step 9: Write the neighborhood targeting spec**

```
NEXTDOOR TARGETING SPEC
  Neighborhoods: <list from payload.target_neighborhoods>
  Radius: Primary neighborhood + adjacent neighborhoods (1 ring)
  Audience: Homeowners 35-65 (if Nextdoor allows demographic filter)
  Duration: Recommend 7-14 days per flight
  Budget: Matt sets in Nextdoor Business dashboard
```

**Step 10: Voice self-check (mandatory)**

Grep every field for:
- Em-dash (U+2014), en-dash (U+2013): hard fail
- Semicolons: hard fail
- Exclamation marks in body: hard fail
- All words in voice_guidelines.md §6.2 banned list
- First-person "I" in brand-voice context: hard fail for this surface
- "approximately," "roughly," "about": hard fail
- "passionate," "dedicated," "premier," "boutique": hard fail

Fix every hit. Recount character limits.

**Step 11: Write post-bundle.txt**

```
NEXTDOOR BUSINESS AD BUNDLE
Target neighborhoods: <list>
Ad type: <sponsored_post / local_awareness>
Goal: <campaign_goal>
Generated: <ISO date>

=== HEADLINE (XX chars) ===
<headline text>

=== POST BODY (XX chars) ===
<post body text>

=== CTA LABEL (XX chars) ===
<cta label>

=== CTA URL ===
<payload.cta_url>

=== IMAGE BRIEF ===
<image brief paragraph>

=== NEIGHBORHOOD TARGETING SPEC ===
<targeting spec>

=== VERIFICATION TRACE ===
<figure>: <source>, <filter>, fetched <iso>

=== PUBLISH INSTRUCTIONS ===
Nextdoor API is not yet wired (NEXTDOOR_CLIENT_ID unset per env-manifest.md).
Matt pastes this copy into Nextdoor Business dashboard manually:
  1. Go to business.nextdoor.com
  2. Create a new sponsored post or local awareness ad
  3. Paste headline, body, CTA label, and CTA URL from above
  4. Upload the sourced image
  5. Apply the neighborhood targeting spec
  6. Set budget and flight dates
  7. Submit for Nextdoor review (typically 24-48h)
```

**Step 12: Write contact-sheet.html and citations.json**

Contact sheet: brand v2 navy on cream, Geist body. Show all fields with char-count
badges. Include verification trace table. Status pill: DRAFT. Include publish
instructions section. Approval prompt at bottom.

Citations.json: one entry per verified figure.

**Step 13: Update action row and surface to Matt**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = '{
      "draft_path": "out/nextdoor-business-ad/<slug>/post-bundle.txt",
      "contact_sheet": "out/nextdoor-business-ad/<slug>/contact-sheet.html",
      "publish_method": "manual",
      "api_wired": false,
      "voice_validated": true
    }'::jsonb
WHERE id = '<id>';
```

Surface format:

```
Draft ready: nextdoor-business-ad: <slug>

Contact sheet:
  -> file:///Users/matthewryan/RyanRealty/out/nextdoor-business-ad/<slug>/contact-sheet.html

  DELIVERABLE
    Path: out/nextdoor-business-ad/<slug>/post-bundle.txt
    Ad type: <ad_type>
    Target neighborhoods: <list>
    Publish method: MANUAL (Nextdoor API not yet wired)

  VERIFICATION TRACE
    <one line per market figure, or "No market stats in this ad.">

  NOTE
    Nextdoor API credentials are unset. Matt pastes this draft into the
    Nextdoor Business dashboard manually. Publish instructions are in the bundle.

Reply with one of:
  - approve <slug>  : marks approved; Matt publishes manually
  - revise <slug>: <note>
  - kill <slug>
```

Then stop. Do not push. Wait for Matt.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | action row updates; market stat verification | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Read (file) | bend-market-bible, brand voice, platform-bible | paths above |
| Write (file) | `post-bundle.txt`, `citations.json`, `contact-sheet.html` | `out/nextdoor-business-ad/<slug>/` |
| Nextdoor for Business API | NOT used (credentials unset; manual publish) | `NEXTDOOR_CLIENT_ID`, `NEXTDOOR_CLIENT_SECRET`, `NEXTDOOR_REDIRECT_URI` (all unset) |

---

## 6. Output format

**Draft lands at:** `out/nextdoor-business-ad/<slug>/`

```
out/nextdoor-business-ad/<slug>/
├── post-bundle.txt
├── citations.json
└── contact-sheet.html
```

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-review-draft` | Matt sees the bundle, approves, then publishes manually in Nextdoor Business dashboard | Matt only |

---

## 8. Status flow

```
pending           <- producer reads row here
  |
  v
in_production     <- set immediately; executed_at=now()
  |
  +-- Neighborhood not in bend-market-bible -> note in bundle; continue
  +-- Market stat unverifiable -> cut stat; continue
  +-- Voice fail -> fix and re-check; max 2 auto-iterations; then kill
  |
  v (bundle written, voice validated)
ready             <- executor_response populated
  |
  v (Matt says "approve")
approved          <- approved_by='matt', approved_at=now()
  |
  v (Matt publishes manually in Nextdoor dashboard)
executed          <- Matt confirms publish; action row updated
  |
  v (7-14 days: impressions and click data noted manually)
measured
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Nextdoor API unset | `NEXTDOOR_CLIENT_ID` missing | Expected. Note in contact sheet. Publish is manual. This is not an error. |
| Neighborhood not in bend-market-bible | `target_neighborhoods` contains a slug with no §1.x entry | Note "neighborhood data not in bible" in the targeting spec. Generate copy with geo name only; omit neighborhood-specific facts. |
| Market stat unverifiable | Supabase returns 0 rows for subdivision | Cut the stat; note in contact sheet; continue |
| Character count overflow | Post body exceeds 500 chars (sponsored) or 280 chars (awareness) | Auto-trim at last full sentence within limit; flag in contact sheet |
| Voice fail after 2 iterations | Banned word persists in draft | Set `status='killed'`; surface the specific violation and the rule citation |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0: Data Accuracy
- `CLAUDE.md` §0.5: Draft-First, Commit-Last
- `design_system/ryan-realty/SKILL.md`: brand register
- `marketing_brain_skills/brand-voice/voice_guidelines.md`: voice enforcement + neighbor-tone rules
- `marketing_brain_skills/research/tool-inventory.md`: Nextdoor API status
- `marketing_brain_skills/research/platform-bible.md`: §19 Nextdoor, §24 compliance
- `marketing_brain_skills/research/asset-library-map.md`: image brief context
- `marketing_brain_skills/research/bend-market-bible.md`: §1 neighborhood facts
- `automation_skills/content_engine/SKILL.md`: routing context
- `social_media_skills/platform-best-practices/SKILL.md`: 2026 platform rules
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`: banned-content gate
- `video_production_skills/VIRAL_GUARDRAILS.md`: banned-word check

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md`: Section B, row `nextdoor-business-ad`

## 12. Tool gap suggestions

What would make this 10x better:

1. **Nextdoor Business API** (currently not connected): once Nextdoor opens API access, auto-create and submit ad creative directly rather than requiring manual upload in the Nextdoor Business dashboard.
2. **Neighborhood radius targeting**: use the listing lat/lng to auto-select the Nextdoor neighborhoods within a 1-mile radius rather than requiring Matt to specify them manually.
3. **Engagement notification webhook**: pipe Nextdoor ad comment notifications to the inbox skill so Matt sees buyer questions in the same inbox triage as IG comments.

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

