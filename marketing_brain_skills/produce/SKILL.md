---
name: marketing-brain-produce
description: >
  Direct producer invocation. Bypasses the weekly cycle to call a specific
  producer for a specific deliverable. Use when Matt says "make a listing
  video for", "create a flyer for", "update the copy on", "draft a GBP post",
  "send an email to", "run the listing reel for", "make a news clip about",
  "write a blog post on", "create a carousel for", or any request naming a
  specific deliverable + specific target. Also fires on "produce <anything>"
  and "/produce <anything>".
action_types: []
---

# Marketing Brain — Produce

**Scope:** Parses Matt's natural-language request into a structured action row,
writes it to `marketing_brain_actions`, then dispatches the matching producer.
No weekly cycle runs. No audits fire. This is point-to-point: Matt names what
he wants, the brain routes it immediately.

**Status:** Canonical. Locked 2026-05-13.

---

## 1. When to use this skill

Matt says any of:
- "make a listing video for 1234 NW Foo St"
- "create a flyer for the Tetherow listing"
- "update the home page hero copy"
- "draft a GBP post for the new listing"
- "run the listing reel for MLS 220189422"
- "make a news clip about the wildfire risk story"
- "write a blog post on the Bend inventory spike"
- "create a market report video for Bend"
- "make a carousel for the Awbrey Butte listing"
- "produce a just-listed flyer for..."
- "send a seller alert email to the list"
- "/produce <anything>"

**Do NOT use this skill for:**
- "run the brain" → `marketing_brain_skills/run/SKILL.md`
- "what should we make this week" → `marketing_brain_skills/run/SKILL.md`
- Any request that is purely analytical with no deliverable

---

## 2. Required reading before executing

| Reference | Why |
|---|---|
| `marketing_brain_skills/producers/REGISTRY.md` | The lookup table: action_type → assigned_producer |
| `CLAUDE.md` §0 — Data Accuracy | All figures in the deliverable must trace to verified sources |
| `CLAUDE.md` §0.5 — Draft-First, Commit-Last | Nothing committed until Matt approves |

---

## 3. Procedure

### Step 1 — Parse Matt's request

Extract three things from Matt's message:

**action_type:** Match Matt's words to an `action_type` from
`marketing_brain_skills/producers/REGISTRY.md`. Use Sections A–F.

Common mappings:
| Matt says | action_type |
|---|---|
| "listing video", "listing tour", "tour video" | `content:listing_video` |
| "listing reel", "just-listed reel", "listing reveal" | `content:listing_reel` |
| "full listing package", "list kit" | `content:list_kit` |
| "market report video", "market video" | `content:market_video` |
| "market data short" | `content:market_data_short` |
| "YouTube market report", "long-form market" | `content:market_youtube_longform` |
| "news clip", "news video" | `content:news_clip` |
| "neighborhood tour", "area guide" | `content:neighborhood_tour` |
| "blog post", "blog" | `content:blog_post` |
| "Facebook ad", "FB ad", "lead gen ad" | `content:fb_lead_gen_ad` |
| "flyer", "just-listed flyer" | `content:just_listed_flyer` |
| "open house flyer" | `content:open_house_flyer` |
| "feature sheet", "property sheet" | `content:feature_sheet` |
| "Instagram carousel", "carousel" | `content:ig_carousel` |
| "GBP post", "Google Business post" | `ops:gbp_review_response` |
| "update home page", "edit site copy" | `site:copy_update` |

**target:** What the action is about. Format:
- For listings: `mls:<MlsId>` (e.g. `mls:220189422`) — resolve from address if Matt gives one
- For city/market: `city:<CityName>` (e.g. `city:Bend`)
- For neighborhoods: `neighborhood:<name>` (e.g. `neighborhood:Awbrey Butte`)
- For website pages: page path (e.g. `/listings`, `/`)
- For news: `topic:<slug>` (e.g. `topic:wildfire-risk-2026`)
- For email: `segment:<name>` or `contact:<email>`
- Unknown: `manual:<slug>` (derive from Matt's words)

**payload:** Any specifics Matt gave. Common fields:
- `address` — if Matt gave an address instead of MLS#
- `city` — for market reports
- `open_house_date` — for open house flyers
- `topic` — for blog posts and news clips
- `campaign_id` — for Meta Ads
- `target_audience` — if Matt specified
- Any other detail Matt included

### Step 2 — Resolve address to MLS# (if needed)

If Matt gave an address instead of an MLS# and the action needs a listing:

```sql
SELECT "MlsId", "StreetNumber", "StreetName", "City", "StandardStatus", "ListPrice"
FROM listings
WHERE CONCAT("StreetNumber", ' ', "StreetName") ILIKE '%<street>%'
  AND ("City" ILIKE '%<city>%' OR '%<city>%' = '%')
ORDER BY "StandardStatus" = 'Active' DESC, created_at DESC
LIMIT 10;
```

If multiple matches: present candidates to Matt and ask him to pick one.
Never guess. Never pick the most recent or highest-priced without asking.

### Step 3 — Disambiguate if action_type is ambiguous

If the request could map to more than one action_type, ask Matt ONE
clarifying question before proceeding:

Examples:
- "listing video or listing reel? (video = 60–90s tour, reel = 40–48s viral)"
- "short-form market video or YouTube long-form?"
- "just-listed flyer or full feature sheet?"
- "GBP post or Instagram carousel?"

Never guess. One disambiguation question, then proceed.

### Step 4 — Look up assigned_producer

Read `marketing_brain_skills/producers/REGISTRY.md`. Find the row where
`action_types` contains the resolved `action_type`. Copy the `path` value
as `assigned_producer`.

If no matching row exists in the registry: surface to Matt that this
action_type has no registered producer yet and offer the closest alternative.

### Step 5 — Write the action row

```sql
INSERT INTO public.marketing_brain_actions (
  topic,
  format,
  platforms,
  hook,
  body,
  cta,
  target_audience,
  data_sources,
  predicted_outcome,
  status,
  generated_by,
  generation_reason,
  action_type,
  target,
  assigned_producer,
  payload,
  data_evidence
) VALUES (
  '<derived topic from Matt''s words>',
  '<format from action_type>',
  '{}'::text[],   -- platforms populated by producer based on action_type
  '',             -- hook generated by producer
  null,
  null,
  'brand_default',
  '[]'::jsonb,
  '{}'::jsonb,
  'pending',
  'marketing_brain:produce',
  'manual_request: <Matt''s verbatim request>',
  '<action_type>',
  '<target>',
  '<assigned_producer>',
  '<payload>'::jsonb,
  '{}'::jsonb
)
RETURNING id;
```

Capture the returned `id` as `<action_id>`.

### Step 6 — Dispatch the producer

**For content actions** (`action_type LIKE 'content:%'`):
Route through `automation_skills/content_engine/SKILL.md` with the action row id.

> Subagent: Load `automation_skills/content_engine/SKILL.md`.
> Action row id: `<action_id>`. Action type: `<action_type>`.
> Target: `<target>`. Payload: `<payload>`.
> Execute per content_engine procedure. Surface draft when ready.

**For non-content actions** (`site:*`, `ops:*`, `comms:*`, `analyze:*`):
Route directly to the producer at `<assigned_producer>/SKILL.md`.

> Subagent: Load `<assigned_producer>/SKILL.md`.
> Action row id: `<action_id>`. Action type: `<action_type>`.
> Target: `<target>`. Payload: `<payload>`.
> Execute per that SKILL.md. Surface output when ready.

### Step 7 — Surface draft and wait

When the producer reports the draft is ready, surface it to Matt using the
producer's standard surface format (see §6 of that producer's SKILL.md).

Then STOP. Do not commit. Do not push. Wait for Matt's explicit approval.

### Step 8 — On approval

Matt says "ship it" / "approved" / "go":

1. Move deliverable from `out/` to the appropriate publish path
2. UPDATE action row: `status='approved'`, `approved_by='matt'`, `approved_at=now()`
3. Execute any publish steps (git add, commit, push; or API call)
4. UPDATE action row: `status='executed'`

---

## 4. Disambiguation conversation patterns

### Pattern: ambiguous listing format
```
Matt: "make a video for 1234 NW Foo St"
Brain: "Listing reel (40–48s viral, no VO captions only) or listing tour
       (60–90s with Victoria VO)? Both use the same MLS photos."
Matt: "reel"
Brain: → action_type='content:listing_reel', dispatches listing_reveal producer
```

### Pattern: address with multiple matches
```
Matt: "flyer for the Bend listing"
Brain: "Found 3 active listings in Bend — which one?
       1. 1234 NW Riverview Dr — $849,000
       2. 567 SW Canyon Blvd — $625,000
       3. 890 Brookswood Blvd — $1,150,000"
Matt: "the Riverview one"
Brain: → target='mls:220189422', proceeds
```

### Pattern: site action
```
Matt: "update the home page hero copy to mention the spring market"
Brain: → action_type='site:copy_update', target='/', payload={section:'hero', notes:'spring market angle'}
       → dispatches site-edit producer (pending build)
```

### Pattern: news clip
```
Matt: "make a news clip about the wildfire risk story I saw on KTVZ"
Brain: → action_type='content:news_clip', target='topic:wildfire-risk-2026'
       → payload={source_url:'<URL Matt provides or WebSearch result>', topic:'wildfire risk Bend 2026'}
       → dispatches news-video producer
```

### Pattern: ops action
```
Matt: "pause the Facebook seller campaign"
Brain: → action_type='ops:meta_ads_pause', target='campaign_id:<id>'
       → This requires EXPLICIT Matt approval — confirms before executing.
       → "Confirm: pause campaign '<name>' (campaign_id: <id>)? This stops all ad delivery."
```

---

## 5. What produce does NOT do

- Does not run audits or diagnose channels (that is the brain's job in the cycle)
- Does not invent action_types not in the registry — surface to Matt if needed
- Does not skip the draft-first approval gate, ever
- Does not commit or push without Matt's explicit approval
- Does not dispatch multiple producers in parallel for a single request
  (that is what run/SKILL.md does for the full cycle)

---

## 6. See also

- `marketing_brain_skills/run/SKILL.md` — full brain cycle invocation
- `marketing_brain_skills/producers/REGISTRY.md` — producer lookup (action_type → path)
- `automation_skills/content_engine/SKILL.md` — content action dispatch bus
- `CLAUDE.md` §0 — Data Accuracy (outranks everything)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last (outranks everything)
