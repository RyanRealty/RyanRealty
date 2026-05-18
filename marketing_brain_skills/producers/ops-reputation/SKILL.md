---
name: ops-reputation
description: >
  Drafts and publishes reputation-management actions for Ryan Realty.  GBP
  review responses, review request outreach, GBP posts, and GBP Q&A answers.
  Loads Matt's 22-response voice corpus before drafting anything. Surfaces
  every draft to Matt for review before any API call posts publicly. Uses
  matt-review-draft approval for all actions; nothing posts without Matt's
  explicit word.
action_types:
  - ops:review_response
  - ops:review_request
  - ops:gbp_post
  - ops:gbp_qna
output_type: operational
target_platforms: []
asset_destination: no asset; state mutation only (logged in marketing_decisions)
auto_inputs: ["current campaign/account state"]
required_inputs: ["account_id OR campaign_id"]
optional_inputs: ["budget_delta_pct", "pause_reason"]
estimated_runtime_min: 3
cost_usd_estimate: $0.01-$0.10 per call (mostly API quota; minimal Anthropic)
thumbnail_uri: out/proof/2026-05-17/exemplars/sample.html
example_outputs: []
---

# ops-reputation.  Reputation Management Operational Producer

**Scope:** Manages Ryan Realty's public reputation touchpoints across GBP
(Google Business Profile), and can extend to Zillow and Yelp via their
respective APIs. Drafts review responses in Matt's voice, sends review-request
outreach to recent clients, creates GBP posts, and answers GBP Q&A questions.
Every public-facing draft goes through voice validation and Matt's explicit
review before posting.

Does NOT create social media posts for Instagram, Facebook, or LinkedIn (those
go through the publisher capability). Does NOT manage the GBP profile fields
(name, hours, categories, attributes).  those are manual edits in the GBP
dashboard. Does NOT pull GBP performance analytics (that is `snapshot-channels`
+ `audit-website`).

**Status:** Canonical
**Locked:** 2026-05-13
**Exemplar output:** `out/reputation/<slug>/` containing `draft.md`, `citations.json`,
and the posted content reference in `executor_response`.

---

## 1. Scope

### In scope
- `ops:review_response`.  draft a response to a GBP (or Zillow/Yelp) review in
  Matt's voice, surface for review, post on approval
- `ops:review_request`.  send review-request emails to recent closed clients via
  Resend + log task in FUB
- `ops:gbp_post`.  draft a GBP "What's New" or "Offer" post (80-150 words + photo),
  surface for review, publish on approval
- `ops:gbp_qna`.  draft an answer to a GBP user question, surface for review,
  post on approval

### Out of scope
- Social media posts (IG, FB, LinkedIn, TikTok).  publisher capability
- Responding to Zillow or Yelp reviews without first confirming the API is
  connected (check `marketing_brain_skills/platforms/gbp/SKILL.md` for status)
- Profile attribute edits (hours, description, categories).  manual GBP dashboard
- Responding to Facebook Page reviews or recommendations.  separate Facebook API
  path; flag to Matt if encountered

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `ops:review_response` | `source_id`, `source`, `source_content`, `rationale` | `source`: 'gbp' \| 'zillow' \| 'yelp' |
| `ops:review_request` | `source_id`, `lead_ids`, `rationale` | `lead_ids`: FUB person IDs of recent closed clients |
| `ops:gbp_post` | `source_id`, `post_type`, `payload.body`, `payload.photo_path`, `rationale` | `post_type`: 'whats_new' \| 'offer' |
| `ops:gbp_qna` | `source_id`, `source_content`, `rationale` | `source_content`: the user's question text |

### Payload schema

```typescript
interface ReputationPayload {
  action: 'review_response' | 'review_request' | 'gbp_post' | 'gbp_qna';
  source: 'gbp' | 'zillow' | 'yelp';
  source_id: string;
  // review_response: the review ID from the platform API
  // review_request: the FUB closed transaction ID or MLS ID for context
  // gbp_post: the GBP location name (e.g. 'accounts/123/locations/456')
  // gbp_qna: the GBP question name from the Q&A API
  source_content?: string;       // The review text or question text verbatim
  rationale: string;             // Why this action was triggered
  payload: {
    // review_response: { reviewer_name?: string, rating?: number }
    // review_request: { client_name: string, close_date: string, agent_name: string }
    // gbp_post: { body: string, photo_path?: string, post_type: 'whats_new' | 'offer',
    //             offer_title?: string, offer_start?: string, offer_end?: string }
    // gbp_qna: { question_name: string }
    [key: string]: unknown;
  };
}
```

---

## 3. Full action row schema

```typescript
interface ReputationActionRow {
  id: string;
  action_type: string;           // 'ops:review_response' | 'ops:review_request' | etc.
  target: string;                // 'gbp:location:<location_id>' or 'fub:person:<id>'
  assigned_producer: string;     // 'marketing_brain_skills/producers/ops-reputation'
  payload: ReputationPayload;
  data_evidence: {
    audit_source?: string;       // e.g. 'snapshot-channels' | 'gbp-media-refresh cron'
    opportunity_area?: string;   // e.g. 'new 5-star review unresponded 3+ days'
    signal_evidence?: string;    // e.g. 'review posted 2026-05-10, no response as of 2026-05-13'
  };
  generation_reason: string;
  status: 'pending';
}
```

---

## 4. The recipe

### Step 1.  Read the action row

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<action_id>' AND status = 'pending';
```

### Step 2.  Load mandatory references

Before drafting anything:
- `CLAUDE.md` §0.  Data Accuracy mandate
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last
- `marketing_brain_skills/brand-voice/voice_guidelines.md`.  voice rules
- `marketing_brain_skills/brand-voice/corpus/gbp_responses.md`.  22 canonical
  Matt responses; read at least 5 examples before drafting a review response
- `marketing_brain_skills/platforms/gbp/SKILL.md`.  GBP post best practices,
  API endpoints, review response guidelines

### Step 3 (review_response).  Draft in Matt's voice

**Voice pattern from the corpus.  the 4-element structure:**

1. **First-name opening.** Use the reviewer's name if available. "Audra," not
   "Dear Valued Customer." Never "Hey".  "Thank you, [name]" or direct name.
2. **Genuine acknowledgment.** Reference a specific detail from the review.
   Not "thanks for the kind words." Matt says "that kind of trust makes all the
   difference" (Doug G response), "you made the process easy on my end too" (Audra
   response). Specific, not generic.
3. **Forward-looking close.** "Please don't hesitate to reach out if there's ever
   anything I can do." Or "I hope you're settling into your new chapter well."
   Never promotional. Never "call us for all your real estate needs."
4. **Small-business humanity.** Matt closes with something like "Reviews like this
   mean the world to a small business like ours" or "This means a lot to me and
   to our team." Use it when the review is particularly warm; omit for brief reviews.

**Response length:** 80-140 words. Longer than a tweet, shorter than a paragraph.
Never a wall of text. Never a bulleted list.

**Banned in responses:** exclamation marks (Matt uses them sparingly.  1 max per
response, only in genuine moments), emoji, promotional language, keywords stuffed
for SEO ("best real estate agent in Bend"), promises about future outcomes.

**Negative review protocol:** If `payload.rating` < 4:
1. Never argue. Never defend.
2. Acknowledge the experience. "I'm sorry to hear this didn't meet your
   expectations.  that's not the experience I want anyone to have with our team."
3. Offer a direct resolution path. "Please reach out to me directly at
   541.213.6706 so we can make it right."
4. Keep it short (40-60 words). Do not explain or justify.
5. Surface to Matt with an extra flag: "Negative review draft.  please review
   carefully before posting."

### Step 4 (review_response).  Voice validation

Run the draft against the voice rules. Specifically:
- No banned words (from the full banned vocabulary in `voice_guidelines.md` + CLAUDE.md)
- No exclamation marks in body (1 max if genuinely warranted)
- No emoji
- No promotional language ("best," "premier," "top-rated")
- Subject must be the client, not Ryan Realty ("You made the process easy" not
  "We provide exceptional service")
- First-name used correctly (if available from `source_content`)

If validation fails: fix and re-validate. Max 2 auto-fix attempts. After 2,
surface the specific violation to Matt with the rule cited.

### Step 5 (gbp_post).  Draft a GBP post

Per `marketing_brain_skills/platforms/gbp/SKILL.md` §4 (Posts):
- Length: 80-150 words (Google truncates at ~100 on mobile; lead with the key fact)
- Post type: "What's New" for market data, listings, team news; "Offer" for
  specific promotions with start/end dates (rare for Ryan Realty)
- Photo: required for max engagement; select from existing assets at
  `design_system/ryan-realty/assets/` or `public/images/`; never AI-generated
- Lead with a specific, local, data-backed fact: "Bend's median sold price
  reached $695,000 in April.  the highest since Q3 2024."
- Call to action: "Learn more at ryan-realty.com".  no phone number in body
  (it's already in the profile)
- No banned vocabulary. No exclamation marks. No emoji.

**Photo selection rule:** Use an existing asset (listing photo with rights,
neighborhood photo, team photo). If no suitable asset exists, use
`design_system/ryan-realty/assets/hero-poster.webp` as default. Log the
photo_path in `citations.json`.

### Step 6 (review_request).  Draft review-request email

Loads the client record from FUB by `lead_ids[0]`:
```
GET https://api.followupboss.com/v1/people/<person_id>
    ?fields=id,firstName,lastName,name,emails,stage,closeDate
Authorization: Basic <base64(FOLLOWUPBOSS_API_KEY:)>
```

Compose the email using the voice guidelines (warm, specific, no pressure):

**Subject:** "Quick favor.  could you share your experience with Matt?"

**Body pattern (from corpus voice):**
```
[First name],

It was genuinely a pleasure working with you on [address or "your home sale/purchase"].
If you have a minute, a quick Google review makes a real difference for a small
business like ours. Here's the direct link: [GBP review link]

No obligation.  I just wanted to ask. And please reach out anytime I can help.

Matt Ryan
Ryan Realty · 541.213.6706
```

Send via Resend (`mail.ryan-realty.com`). Log a FUB task "Review requested.  [date]"
on the person record.

GBP review link format:
```
https://g.page/r/<PLACE_ID>/review
```
`PLACE_ID` is the GBP location's Google Place ID.  pull from `GBP_PLACE_ID`
env var or from `marketing_brain_skills/platforms/gbp/SKILL.md`.

### Step 7 (gbp_qna).  Draft a Q&A answer

Read the question text from `payload.source_content`. Draft a direct, factual
answer. Rules:
- 40-80 words (GBP Q&A truncates at ~100 chars in Maps preview)
- Answer the question directly in sentence one
- No fluff, no upsell, no exclamation marks
- If the question requires a number, verify from Supabase before including it
- End with: "Feel free to reach out directly: 541.213.6706."

### Step 8.  Write draft file and citations.json

**`out/reputation/<slug>/draft.md`**
Full draft text, formatted for easy reading:

```markdown
# [action_type].  [source_id]

**Source content:**
[reviewer's text or question verbatim]

**Proposed response / post:**
[draft text]

**Voice validation:** [PASS / FLAG: specific rule + phrase]
```

**`out/reputation/<slug>/citations.json`**
One entry per verified fact in the draft (for gbp_post and gbp_qna):
```json
[
  {
    "figure": "$695,000 median",
    "source": "Supabase market_stats_cache",
    "filter": "city='Bend', stat_type='median_close_price'",
    "value": 695000,
    "fetched_at": "2026-05-13T14:00:00Z"
  }
]
```

For review responses with no numeric claims: `citations.json` can be `[]`.

### Step 9.  Update action row to ready, surface to Matt

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = '{"draft_path": "out/reputation/<slug>/draft.md"}'::jsonb
WHERE id = '<action_id>';
```

Surface format:

```
Reputation draft ready.  [action_type] on [source]

  SOURCE
    [Platform: GBP / Zillow / Yelp]
    [Review ID or Question ID: source_id]
    [Rating: N stars (if review)]

  ORIGINAL CONTENT
    "[source_content verbatim.  truncated to 200 chars if long]"

  PROPOSED [RESPONSE / POST / ANSWER]
    "[draft text in full]"

  VOICE VALIDATION
    [✓ PASS or FLAG: specific rule + phrase + suggested fix]

  [For gbp_post only:]
    Photo: [photo_path]
    Post type: [whats_new / offer]

  CITATIONS
    [one line per verified fact, or "(no market stats in this response)"]

  Draft file: out/reputation/<slug>/draft.md
  citations.json: out/reputation/<slug>/citations.json

Reply "ship it" / "approved" / "go" to post.
Reply "edit: [change]" to revise before posting.
Reply "no" or "kill" to cancel.
```

Stop. Wait for Matt.

### Step 10.  Post via API (post-approval only)

After Matt's explicit approval:

```sql
UPDATE marketing_brain_actions
SET status = 'approved', approved_by = 'matt', approved_at = now()
WHERE id = '<action_id>';
```

**GBP review response:**
```
PUT https://mybusiness.googleapis.com/v4/<accountId>/locations/<locationId>/reviews/<reviewId>/reply
Authorization: Bearer <GBP_ACCESS_TOKEN>
Body: { "comment": "<draft_text>" }
```

**GBP post:**
```
POST https://mybusiness.googleapis.com/v4/<accountId>/locations/<locationId>/localPosts
Authorization: Bearer <GBP_ACCESS_TOKEN>
Body: {
  "languageCode": "en-US",
  "summary": "<body>",
  "topicType": "STANDARD",
  "media": [{ "mediaFormat": "PHOTO", "sourceUrl": "<photo_url>" }]
}
```

**GBP Q&A answer:**
```
POST https://mybusiness.googleapis.com/v4/<accountId>/locations/<locationId>/questions/<questionId>/answers
Authorization: Bearer <GBP_ACCESS_TOKEN>
Body: { "answer": { "text": "<draft_text>" } }
```

**Review request email:** Send via Resend per the recipe in §4 Step 6.
After send, create the FUB task via:
```
POST https://api.followupboss.com/v1/tasks
Body: {
  "personId": <person_id>,
  "type": "follow_up",
  "note": "Review request sent via email on [date]. Link: [gbp_link]",
  "dueDate": "<7 days from now>",
  "priority": "normal"
}
```

### Step 11.  Capture response, update action row

```sql
UPDATE marketing_brain_actions
SET status = 'executed',
    executor_response = '{
      "action": "<action>",
      "source": "<source>",
      "source_id": "<source_id>",
      "api_response": <full_response>,
      "post_url": "<url_if_available>",
      "executed_at": "<iso>"
    }'::jsonb
WHERE id = '<action_id>';
```

Confirm to Matt:
```
Posted.  [action_type]

  [Human-readable summary of what was posted and where]
  [post_url if available]

Action row [action_id] → status: executed.
```

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| GBP My Business API v4 | Review replies, posts, Q&A | `GBP_ACCESS_TOKEN`, `GBP_LOCATION_NAME` |
| `lib/google-business-profile.ts` | GBP OAuth, token refresh, API helpers | imported |
| Resend API | Review request emails | `RESEND_API_KEY` |
| FUB REST API v1 | Client lookup + task creation | `FOLLOWUPBOSS_API_KEY` |
| Supabase MCP | Action row updates + stat verification | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

---

## 6. Output format

**Draft lands at:** `out/reputation/<slug>/`

```
out/reputation/<slug>/
├── draft.md
└── citations.json
```

Slug format: `<action>-<source>-<YYYY-MM-DD>`
Example: `review-response-gbp-2026-05-13`

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-review-draft` | Matt sees the draft and says "ship it" / "approved" / "go" | Matt only |

**This producer uses:** `matt-review-draft` for all reputation actions.

A successfully drafted response is not approval. A passing voice validation is
not approval. Only Matt's explicit word grants post permission.

**Edit path:** Matt can say "edit: [change]" and the producer revises and
re-surfaces without resetting the entire pipeline.

---

## 8. Status flow

```
pending         ← producer reads row here
  │
  ▼
in_production   ← set immediately; executed_at = now()
  │
  ▼ (corpus loaded, draft written, voice validated, citations written)
ready           ← set when draft surfaced to Matt
  │
  ▼ (Matt says "ship it")
approved        ← approved_by='matt', approved_at=now()
  │
  ▼ (platform API confirms post)
executed        ← executor_response with post confirmation
  │
  ▼ (optional: 7-day engagement check for GBP posts)
measured

killed          ← voice validation fails after 2 attempts, Matt says "no",
                   API error on post, GBP token expired
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| GBP OAuth token expired | 401 from GBP API | Flag to Matt: "GBP access token expired. Re-auth required at `/api/gbp/authorize/`." Set status='killed'. |
| Review already responded | 409 from GBP reply endpoint | Set status='killed'. Surface: "Review [id] already has a response.  no action taken." |
| Review not found | 404 from GBP review endpoint | Set status='killed'. "Review [id] not found on GBP. It may have been deleted." |
| Voice validation fails (fixable) | Banned word or punctuation | Auto-fix, re-validate. Max 2 attempts. After 2, surface the specific violation. |
| Voice validation fails (unfixable) | Brand conflict that can't be resolved automatically | Surface to Matt with specific rule + phrase. Do NOT present the draft. |
| Market stat unverifiable | Supabase returns 0 rows | Remove stat from gbp_post. Note removal in surface message. No estimates. |
| GBP Place ID missing | `GBP_PLACE_ID` env var not set | Halt review_request. Surface: "GBP_PLACE_ID not set.  cannot construct review link. Set this in.env.local." |
| Resend failure on review_request | Non-200 from Resend | Retry once. If second failure, set status='killed'. Surface with Resend error. |
| Client has no email in FUB | FUB person record has no email | Skip that person. Note in executor_response. If all skip: report "No email found for any requested client.  review request not sent." |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0.  Data Accuracy mandate
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last
- `marketing_brain_skills/brand-voice/voice_guidelines.md`.  voice enforcement
- `marketing_brain_skills/brand-voice/corpus/gbp_responses.md`.  22 Matt GBP
  responses; read at least 5 before drafting any review response
- `marketing_brain_skills/platforms/gbp/SKILL.md`.  full GBP playbook (algorithm
  primer, review response guidelines, post best practices, metric deep-dive)

**Capabilities used:**
- `lib/google-business-profile.ts`.  OAuth token management, GBP API helpers
- `lib/fub.ts` / `lib/followupboss.ts`.  client lookup, task creation
- Resend API.  review request email delivery

**Brain components that generate ops:review_* and ops:gbp_* action rows:**
- `marketing_brain_skills/snapshot-channels/`.  flags new unresponded reviews
- `marketing_brain_skills/audit-website/`.  surfaces GBP engagement drops that
  trigger post creation
- `automation_skills/triggers/listing_trigger/`.  triggers review_request when
  a listing closes

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md`.  Section D, row `ops-reputation`

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

