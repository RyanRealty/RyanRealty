---
name: google-ads-copy
description: >
  Drafts Google Ads Responsive Search Ad headlines, descriptions, sitelinks, and
  Performance Max asset groups for Ryan Realty campaigns. Pulls current SEO target
  queries from the Q3-2026 strategy doc, voice-validates every asset against brand
  rules, and surfaces a complete ads-copy bundle for Matt's approval before any
  asset is uploaded to Google Ads.
action_types:
  - content:google_ads_copy
output_type: paid-ad
output_type: paid-ad
target_platforms: []
asset_destination: "out/google-ads/<campaign_id>/"
auto_inputs: ['existing_ad_performance', 'keywords', 'landing_page_url']
required_inputs: ['campaign_id or goal_slug']
optional_inputs: "['ad_type (rsa|esa)', 'headline_count (default 15)', 'description_count (default 4)']"
estimated_runtime_min: 8
cost_usd_estimate: $0 (ad spend separate)
thumbnail_uri: out/proof/2026-05-17/exemplars/google-ads-copy/sample.txt
example_outputs: []
    label: Phase 7.5 exemplar placeholder
    surface: google_ads

---

# google-ads-copy

**Scope:** Produces a complete Google Ads copy bundle covering Responsive Search Ads
(RSA), Performance Max (PMax) asset groups, and four sitelinks for one campaign or
ad group. Deliverable is a text file and contact sheet showing all headlines,
descriptions, and sitelinks. No Google Ads API call fires until Matt approves and
explicitly triggers the ops producer. This producer writes copy only.

Does NOT upload assets to Google Ads (that is `ops-google-ads`). Does NOT run paid
reporting or bid analysis. Does NOT produce Meta ad copy (that is `facebook-lead-gen-ad`).

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** `out/google-ads-copy/<campaign-slug>/ads-bundle.txt` + `contact-sheet.html`

---

## 1. Scope

### In scope

- `content:google_ads_copy`: full RSA + PMax asset group + sitelinks copy bundle
- Pulling the current SEO target query set from `marketing_brain_skills/strategy/Q3-2026-strategy.md` §SEO strategy
- Generating up to 15 RSA headlines (30 chars max each), 4 RSA descriptions (90 chars max each)
- Generating one PMax asset group (5 headlines, 5 long headlines up to 90 chars, 5 descriptions)
- Generating 4 sitelinks (25-char title, 2 × 35-char description lines each)
- Voice-validating every character against `marketing_brain_skills/brand-voice/voice_guidelines.md`
- Producing `ads-bundle.txt` and `contact-sheet.html` for Matt's review
- Producing `citations.json` tracing any market figure used in copy to a live Supabase query

### Out of scope

- Uploading copy to Google Ads API (that is `ops-google-ads`)
- Keyword research or bid strategy (feed into the payload as `target_queries` array)
- Image or video creative for PMax (those are separate asset types)
- Any copy for Meta, Nextdoor, LinkedIn, or any other platform

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `content:google_ads_copy` | `campaign_slug`, `campaign_goal`, `target_queries`, `geo_focus`, `cta_action` | `market_stat_override` optional |

### Payload schema

```typescript
interface GoogleAdsCopyPayload {
  campaign_slug: string;           // e.g. 'seller-leads-bend-q3-2026'
  campaign_goal: 'seller_leads' | 'buyer_leads' | 'brand_awareness' | 'listing_traffic';
  target_queries: string[];        // 1-10 SEO queries from Q3-2026-strategy.md §SEO strategy
  geo_focus: string;               // e.g. 'Bend, OR' or 'Central Oregon'
  cta_action: string;              // e.g. 'Get a free home value estimate'
  market_stat_override?: string;   // if provided, use this verified stat in at least one headline
}
```

---

## 3. Full action row schema

```typescript
interface GoogleAdsCopyActionRow {
  id: string;
  action_type: 'content:google_ads_copy';
  target: string;                  // e.g. 'campaign:seller-leads-bend-q3-2026'
  assigned_producer: string;       // 'social_media_skills/google-ads-copy'
  payload: GoogleAdsCopyPayload;
  data_evidence: {
    audit_source?: string;         // e.g. 'audit-website'
    opportunity_area?: string;     // e.g. 'GSC: 1,400 impressions for "sell my home bend"'
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

If not `pending`, halt. Another agent claimed the row.

**Step 2: Load mandatory references**

Before writing a single word of copy:
- `CLAUDE.md` §0: Data Accuracy (any market stat in copy must trace to a live query)
- `CLAUDE.md` §0.5: Draft-First, Commit-Last
- `design_system/ryan-realty/SKILL.md`: brand register
- `marketing_brain_skills/brand-voice/voice_guidelines.md`: full banned-word and banned-phrase list
- `marketing_brain_skills/research/tool-inventory.md`: check Google Ads env var status
- `marketing_brain_skills/research/platform-bible.md`: no platform-specific section for Google Ads, but cross-cutting compliance §24 applies
- `marketing_brain_skills/research/asset-library-map.md`: not required for copy-only builds; note for future PMax image handoff
- `marketing_brain_skills/research/bend-market-bible.md`: §1 neighborhood names, §10 competitor brokerage names
- `automation_skills/content_engine/SKILL.md`: routing context
- `social_media_skills/platform-best-practices/SKILL.md`: §21 cross-cutting compliance
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`: banned-content gate (applies to all copy surfaces)
- `video_production_skills/VIRAL_GUARDRAILS.md`: not a video, but the banned-word §12 still applies

**Step 3: Pull target queries from Q3-2026 strategy**

Read `marketing_brain_skills/strategy/Q3-2026-strategy.md` §SEO strategy. Extract the
ranked target query list. If the payload provides `target_queries`, use those directly
(the brain populated them from the strategy doc). If the file does not yet exist (Phase
5B has not completed), surface a blocked message to Matt and set `status='killed'`:

```
BLOCKED: marketing_brain_skills/strategy/Q3-2026-strategy.md not found.
Phase 5B must complete the strategy doc before google-ads-copy can execute.
Action row killed.
```

**Step 4: Verify any market stat used in copy**

If `payload.market_stat_override` is set, or if the recipe would naturally include a
figure (e.g., "Bend homes sold in X days"), verify the figure live:

```sql
SELECT
  AVG("CumulativeDaysOnMarket")::int AS avg_dom,
  COUNT(*) AS closed_count
FROM listings
WHERE "StandardStatus" = 'Closed'
  AND "PropertyType" = 'A'
  AND "CloseDate" >= date_trunc('year', now())
  AND "CloseDate" < now()
  AND "City" = 'Bend';
```

Produce a one-line verification trace per figure. Unverifiable stats are cut, not
estimated. Per CLAUDE.md §0 rule 7.

**Step 5: Draft RSA headlines (up to 15, 30 chars max each)**

Write with intent signals from `target_queries`. Each headline must:
- Be direct and specific. Use a place name, a number, or a factual claim.
- Avoid all banned words from voice_guidelines.md §6.2 and CLAUDE.md brand voice section.
- Use sentence case (no ALL CAPS except abbreviations like OR).
- Not contain em-dashes, semicolons, or exclamation marks.
- Include the geo modifier in at least 3 headlines (e.g., "Bend, OR").
- Include a price or time signal in at least 2 headlines (e.g., "See current home values").
- Include at least one CTA-oriented headline (e.g., "Request a free home value estimate").

Google counts headline characters excluding the dynamic keyword insertion wrapper. Do
not use DKI unless the payload explicitly requests it.

**Step 6: Draft RSA descriptions (4 max, 90 chars each)**

Each description:
- Expands on one benefit. No hype, no pressure, no urgency language.
- Ends with a soft CTA matching `payload.cta_action`.
- Stays within 90 characters exactly. Count before submitting.
- Passes the same banned-word and banned-punctuation check as headlines.

**Step 7: Draft PMax asset group**

Five short headlines (30 chars max each), five long headlines (90 chars max), five
descriptions (90 chars max). Follow the same voice rules as Steps 5-6. Long headlines
must stand alone as complete, compelling statements.

**Step 8: Draft sitelinks (4 total)**

Each sitelink:
- Title: 25 chars max. Action verb + subject (e.g., "See Bend homes for sale").
- Description line 1: 35 chars max. One factual benefit.
- Description line 2: 35 chars max. One supporting detail.
- URL path: relative path on ryan-realty.com appropriate to the sitelink topic.

Sitelink topics to cover: home valuation tool, active listings search, neighborhood
guides, meet the brokers.

**Step 9: Voice self-check (mandatory before surfacing)**

Grep every headline, description, long headline, and sitelink text for:
- Em-dash (U+2014), en-dash (U+2013): hard fail
- Semicolons: hard fail
- Exclamation marks: hard fail
- Every word in voice_guidelines.md §6.2 banned list
- Every phrase in §6.3 banned phrase list
- Hedging words ("approximately," "roughly," "about")
- Marketing slop ("premier," "boutique," "passionate," "dedicated")

Fix every hit. Do not surface a draft with a single violation. After fixing, recount
all character lengths.

**Step 10: Write ads-bundle.txt**

```
GOOGLE ADS COPY BUNDLE
Campaign: <campaign_slug>
Goal: <campaign_goal>
Geo: <geo_focus>
Generated: <ISO date>

=== RSA HEADLINES (15) ===
H01 (XX chars): <text>
...

=== RSA DESCRIPTIONS (4) ===
D01 (XX chars): <text>
...

=== PMAX ASSET GROUP ===
Short headlines (5):
  SH01 (XX chars): <text>
  ...
Long headlines (5):
  LH01 (XX chars): <text>
  ...
Descriptions (5):
  PD01 (XX chars): <text>
  ...

=== SITELINKS (4) ===
SL01 Title (XX chars): <text>
     Desc1 (XX chars): <text>
     Desc2 (XX chars): <text>
     URL: /...
...

=== VERIFICATION TRACE ===
<figure>: <source>, <filter>, fetched <iso>
```

**Step 11: Write citations.json**

```json
[
  {
    "figure": "38 days avg. DOM",
    "source": "Supabase listings",
    "filter": "PropertyType='A', City='Bend', CloseDate YTD, StandardStatus='Closed'",
    "column": "CumulativeDaysOnMarket",
    "value": 38,
    "fetched_at": "<ISO>"
  }
]
```

**Step 12: Write contact-sheet.html**

Brand v2 (navy `#102742` on cream `#faf8f4`, Geist body). Include:
- Every headline in a monospace block with character count badge.
- Every description and sitelink.
- Verification trace table.
- Status pill: DRAFT.
- Approval prompt at bottom.

**Step 13: Update action row**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = '{
      "draft_path": "out/google-ads-copy/<campaign_slug>/ads-bundle.txt",
      "contact_sheet": "out/google-ads-copy/<campaign_slug>/contact-sheet.html",
      "headline_count": 15,
      "rsa_desc_count": 4,
      "pmax_asset_group": true,
      "sitelink_count": 4,
      "voice_validated": true
    }'::jsonb
WHERE id = '<id>';
```

**Step 14: Surface to Matt**

```
Draft ready: google-ads-copy: <campaign_slug>

Contact sheet:
  -> file:///Users/matthewryan/RyanRealty/out/google-ads-copy/<campaign_slug>/contact-sheet.html

  DELIVERABLE
    Path: out/google-ads-copy/<campaign_slug>/ads-bundle.txt
    Headlines: 15 RSA + 5 short PMax + 5 long PMax
    Descriptions: 4 RSA + 5 PMax
    Sitelinks: 4

  VERIFICATION TRACE
    <one line per market figure>

  citations.json: out/google-ads-copy/<campaign_slug>/citations.json

Reply with one of:
  - approve <campaign_slug>  : commits bundle; ops-google-ads can then upload
  - revise <campaign_slug>: <note>
  - kill <campaign_slug>
```

Then stop. Do not upload. Do not touch Google Ads API. Wait for Matt.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | action row updates; market stat verification | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Read (file) | strategy doc, brand voice, bibles | paths above |
| Write (file) | `ads-bundle.txt`, `citations.json`, `contact-sheet.html` | `out/google-ads-copy/<slug>/` |
| Google Ads API | NOT used by this producer; used by `ops-google-ads` | `GOOGLE_ADS_CLIENT_ID` etc. (see ops-google-ads) |

---

## 6. Output format

**Draft lands at:** `out/google-ads-copy/<campaign_slug>/`

```
out/google-ads-copy/<campaign_slug>/
├── ads-bundle.txt
├── citations.json
└── contact-sheet.html
```

Contact sheet is mandatory per the "Contact sheet required" memory rule (2026-05-14).

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-review-draft` | Matt sees the copy bundle and says "approve," "ship it," or "go" | Matt only |

Silence is not approval. A passing voice-check is not approval.

---

## 8. Status flow

```
pending           <- producer reads row here
  |
  v
in_production     <- set immediately; executed_at=now()
  |
  +-- Strategy doc missing -> killed
  +-- Unverifiable market stat -> stat cut; continue
  +-- Voice fail -> fix and re-check; max 2 auto-iterations; then kill
  |
  v (bundle written, QA passed)
ready             <- executor_response populated with draft_path
  |
  v (Matt says "approve")
approved          <- approved_by='matt', approved_at=now()
  |
  v (ops-google-ads uploads to Google Ads after Matt's separate explicit approval)
executed
  |
  v (48h: click/conversion data from Google Ads)
measured
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Strategy doc missing | `Q3-2026-strategy.md` not found | Set `status='killed'`; surface BLOCKED message; request Phase 5B completion |
| Market stat unverifiable | Supabase returns 0 rows | Cut the stat from copy; document in contact sheet; continue |
| Character count overflow | A headline exceeds 30 chars | Auto-truncate at last full word; flag in contact sheet; re-validate |
| Voice validation fail | Banned word or banned punctuation in draft | Fix and re-check; max 2 auto-iterations; if 3rd fail, kill and report |
| Supabase MCP error | Action row update fails | Retry once; if second attempt fails, surface to Matt with the raw error |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0: Data Accuracy (outranks everything)
- `CLAUDE.md` §0.5: Draft-First, Commit-Last
- `design_system/ryan-realty/SKILL.md`: brand visual system
- `marketing_brain_skills/brand-voice/voice_guidelines.md`: voice enforcement
- `marketing_brain_skills/research/tool-inventory.md`: API and env var status
- `marketing_brain_skills/research/platform-bible.md`: compliance cross-cutting §24
- `marketing_brain_skills/research/asset-library-map.md`: asset reuse context
- `marketing_brain_skills/research/bend-market-bible.md`: neighborhood names, competitor names
- `automation_skills/content_engine/SKILL.md`: content routing
- `social_media_skills/platform-best-practices/SKILL.md`: 2026 platform rule layer
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`: banned-content gate
- `video_production_skills/VIRAL_GUARDRAILS.md`: scorecard format minimums

**Ops producer that uploads the approved bundle:**
- `marketing_brain_skills/producers/ops-google-ads/SKILL.md`

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md`: Section B, row `google-ads-copy`

## 12. Tool gap suggestions

What would make this 10x better:

1. **Google Keyword Planner API** (requires Google Ads API token): pull real search-volume data for target keywords before writing copy, so headline choices reflect actual query volume.
2. **RSA performance feedback loop**: after 14 days, pull the pinned-asset performance report from the Google Ads API and surface which headlines/descriptions scored Best vs. Low, feeding that back to the next copy cycle.
3. **Landing page score integration**: pull the landing page experience score from the Google Ads Quality Score API and flag when it is Below Average, triggering a site-performance action row.

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

