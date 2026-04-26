---
name: engagement_bot
description: Pulls comments and DMs from 5 platforms every 15 minutes, classifies them by lead intent, drafts replies from voice templates, and pushes high-intent leads to FUB CRM — all for Matt's approval before any reply sends.
---

# Engagement Bot

## What it is

This is NOT an autonomous reply bot. It is a triage assistant. Every drafted reply sits in Matt's
inbox waiting for approval. The bot pulls comments and DMs from Instagram, Facebook, TikTok,
YouTube, and LinkedIn every 15 minutes via their APIs. It classifies each message by lead intent
and question type, drafts a voice-matched reply for high-intent leads, and pushes those leads to
Follow Up Boss (FUB) CRM with platform + context tags. Matt approves or rejects each draft.
Nothing sends without his explicit action.

**Fair housing commitment:** The bot never screens, scores, or tags based on any protected class
indicator. It does not read demographic signals from handles, names, profile photos, or message
patterns. Classification is based solely on message content (intent, question type, spam signals).

## Trigger

```
GET /api/cron/engagement-pull
Header: Authorization: Bearer <CRON_SECRET>
Vercel cron: */15 * * * *
```

Also triggered on-demand:
```
POST /api/workers/engagement-pull
Body: { platform?: string, since?: iso_timestamp }
```

## Inputs

Platform APIs polled per run:

| Platform | Endpoint | Data pulled |
|---|---|---|
| Instagram | `GET /v22.0/{media-id}/comments` + `GET /v22.0/{ig-user-id}/messages` | Comments on recent posts + DMs |
| Facebook | `GET /v22.0/{page-id}/conversations` + `GET /v22.0/{page-id}/feed/{post-id}/comments` | Page DMs + post comments |
| TikTok | `POST https://open.tiktokapis.com/v2/video/comment/list/` | Comments on posted videos |
| YouTube | `GET https://www.googleapis.com/youtube/v3/commentThreads?videoId=...` | Video comments |
| LinkedIn | `GET https://api.linkedin.com/v2/socialActions/{ugcPost-urn}/comments` | Post comments |

Each message is stored in `engagement_inbox` before classification.

## Outputs

| Artifact | Destination |
|---|---|
| Raw messages | `engagement_inbox` table |
| Classification | `engagement_inbox.intent_class` + `engagement_inbox.question_type` updated |
| Draft reply | `engagement_inbox.draft_reply` updated |
| FUB lead push | POST to FUB API (high-intent leads only) |
| FUB contact ID | `engagement_inbox.fub_contact_id` updated |

## Pipeline

### Step 1 — Pull messages (per platform, in parallel)

```typescript
const since = await getLastPullTimestamp(platform);   // from automation_runs latest

// Instagram comments example:
const response = await fetch(
  `https://graph.facebook.com/v22.0/${IG_USER_ID}/media` +
  `?fields=id,timestamp&since=${since}&limit=10`,
  { headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` } }
);
// For each media item, pull /comments?fields=id,text,username,timestamp

// Instagram DMs:
const dms = await fetch(
  `https://graph.facebook.com/v22.0/${IG_USER_ID}/conversations` +
  `?platform=instagram&fields=messages{message,from,created_time}&since=${since}`,
  { headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` } }
);
```

Upsert each message:
```sql
INSERT INTO engagement_inbox
  (platform, message_id, message_type, author_handle, author_platform_id,
   raw_text, post_id, received_at, created_at)
VALUES (...)
ON CONFLICT (platform, message_id) DO NOTHING;
```

### Step 2 — Classify messages

For each unclassified row in `engagement_inbox` (WHERE `intent_class IS NULL`):

**Spam detection (fast rules-based pass):**
- Message length < 3 words AND no question mark: likely spam or emoji-only reaction.
- Message contains domain links not in approved list: likely spam.
- Author has zero followers and is a new account (check via platform API if available): flag.
- Mark as `intent_class = 'spam'` and skip drafting.

**Troll detection:**
- Hostile language patterns (profanity filter, all-caps rage, direct insults): `intent_class = 'troll'`.
- No reply drafted for troll messages. Logged for Matt's awareness only.

**Lead intent classification:**
```typescript
function classifyIntent(text: string): IntentClass {
  const HIGH_INTENT_SIGNALS = [
    /how much/i, /what.s the price/i, /still available/i, /schedule.*showing/i,
    /interested in/i, /can i see/i, /how do i.*buy/i, /what.s included/i,
    /how many.*bed/i, /sq.*ft/i, /square feet/i, /contact/i, /reach you/i,
    /dm me/i, /call me/i, /what.s your number/i, /working with a.*agent/i,
    /first.time buyer/i, /pre.?approv/i, /cash buyer/i, /closing/i,
    /offer/i, /list.*my home/i, /sell.*my/i, /what.*worth/i,
  ];
  const MED_INTENT_SIGNALS = [
    /nice/i, /beautiful/i, /love this/i, /dream home/i, /wish/i,
    /could see myself/i, /saving this/i, /tagging/i,
  ];
  const MARKET_Q_SIGNALS = [
    /market/i, /bend.*real estate/i, /prices.*going/i, /good time to buy/i,
    /inventory/i, /interest rate/i,
  ];
  // Return 'high' | 'medium' | 'low' | 'market_question' | 'listing_question' | 'process_question'
}
```

**Question type classification:**
- `listing_question` — about a specific property (price, availability, features).
- `market_question` — about Bend/Central OR market conditions.
- `process_question` — about buying/selling process, financing, representation.
- `general_engagement` — compliments, saves, shares, low-signal engagement.

### Step 3 — Draft reply for high-intent leads

For `intent_class = 'high'` and `question_type IN ('listing_question', 'market_question', 'process_question')`:

Pull the matching voice template from `engagement_templates`:
```sql
SELECT template_text FROM engagement_templates
WHERE question_type = $question_type
  AND platform = $platform
ORDER BY performance_score DESC
LIMIT 1;
```

Personalize the template (rules-based, not AI generative):
- Replace `{{property_address}}` with listing address from `post_queue` join.
- Replace `{{price}}` with list price (verified from `listings` table).
- Replace `{{call_link}}` with Matt's calendar link.
- Confirm all numbers match source data.

Example templates:
```
// listing_question on Instagram:
"Thanks for asking. {{property_address}} is still active at {{price}}.
Happy to set up a showing — grab a time here: {{call_link}}"

// market_question on any platform:
"Good question. The latest Bend numbers are on our site — link in bio.
Happy to walk through what they mean for your situation if you want to jump on a call."

// process_question on any platform:
"Happy to help with that. Best way is a quick call — takes 15 minutes.
Grab a slot: {{call_link}}"
```

No sycophantic openers (`"Thanks so much for reaching out!"`). No AI-generative rewrite.
Template fills in values. If no template matches, `draft_reply = null` — Matt writes from scratch.

### Step 4 — Push high-intent lead to FUB

For any `intent_class = 'high'` message where `fub_contact_id IS NULL`:

```typescript
// POST to FUB API
const response = await fetch('https://api.followupboss.com/v1/people', {
  method: 'POST',
  headers: {
    Authorization: `Basic ${btoa(FUB_API_KEY + ':')}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    firstName: author_display_name || author_handle,
    source: `Social - ${platform}`,
    tags: [
      `social_${platform}`,
      `intent_high`,
      question_type,
      format_tag || 'organic',   // e.g. 'listing_reveal', 'data_viz_video'
    ],
    notes: raw_text.slice(0, 500),
    customFields: [
      { key: 'social_platform', value: platform },
      { key: 'social_message', value: raw_text.slice(0, 200) },
      { key: 'post_url', value: post_url },
    ],
  }),
});
const { id: fub_id } = await response.json();

// Update engagement_inbox
await supabase.from('engagement_inbox')
  .update({ fub_contact_id: fub_id, fub_pushed_at: new Date().toISOString() })
  .eq('id', message_id);
```

FUB endpoint: `https://api.followupboss.com/v1/people`
Auth: HTTP Basic with `FUB_API_KEY` as username, empty password.

### Step 5 — Queue for Matt's review

```sql
UPDATE engagement_inbox
SET review_status = 'pending_review',
    draft_reply = $draft_reply
WHERE id = $message_id;
```

All drafted replies appear in `/admin/engagement` dashboard (spec only — UI built separately).
Matt clicks Send or Skip. On Send:
```
POST /api/social/publish-reply
Body: { message_id, platform, platform_message_id, reply_text }
```

On Skip:
```sql
UPDATE engagement_inbox SET review_status = 'skipped' WHERE id = $message_id;
```

## Database schema

```sql
CREATE TABLE IF NOT EXISTS engagement_inbox (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform              text NOT NULL,
  message_id            text NOT NULL,   -- platform's native ID
  message_type          text NOT NULL,   -- 'comment' | 'dm'
  post_id               text,            -- platform's post ID
  post_queue_id         uuid REFERENCES post_queue(id) ON DELETE SET NULL,
  author_handle         text,
  author_platform_id    text,
  raw_text              text NOT NULL,
  received_at           timestamptz NOT NULL,
  intent_class          text,
    -- 'high' | 'medium' | 'low' | 'spam' | 'troll'
  question_type         text,
    -- 'listing_question' | 'market_question' | 'process_question' | 'general_engagement'
  draft_reply           text,
  review_status         text NOT NULL DEFAULT 'unreviewed',
    -- 'unreviewed' | 'pending_review' | 'sent' | 'skipped' | 'rejected'
  fub_contact_id        text,
  fub_pushed_at         timestamptz,
  replied_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS engagement_inbox_platform_message_idx
  ON engagement_inbox (platform, message_id);
CREATE INDEX IF NOT EXISTS engagement_inbox_review_idx
  ON engagement_inbox (review_status, intent_class, received_at DESC)
  WHERE review_status = 'pending_review';

CREATE TABLE IF NOT EXISTS engagement_templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_type    text NOT NULL,
  platform         text,   -- null = all platforms
  template_text    text NOT NULL,
  performance_score numeric(6,4) NOT NULL DEFAULT 0,
  use_count        integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
```

## Anti-slop guardrails

References: `video_production_skills/ANTI_SLOP_MANIFESTO.md`

- **NOT autonomous.** Zero replies without Matt's explicit approval. This is the primary safeguard.
- **No demographic screening.** Classification never uses author name, handle appearance, profile
  photo, follower count, or any signal that correlates with protected class status. Strictly
  message-content classification only.
- **No sycophantic replies.** Templates are direct, Matt-voiced. No "Thanks so much for your
  interest!" No AI-written filler.
- **No fake replies to obvious bots.** Spam class messages receive no draft. No reply.
- **Fair housing safe.** Templates do not steer, restrict, or filter based on any protected
  class language. If a message contains language that could create liability (e.g. "we only
  want to be near people like us"), mark `intent_class = 'flag_legal'` and do NOT draft. Alert
  Matt directly via Resend.

## Error handling + observability

- **API pull failures:** log to `automation_runs`, retry in next 15-min cycle.
- **FUB push failures:** 3 retries with 30-second backoff. On failure, `engagement_inbox` row is
  not lost — FUB push can be retried manually from admin dashboard.
- **Classification errors:** if classifier throws, mark `intent_class = 'error'` and skip draft.
  Next cron run retries.
- **Stale unreviewed items:** messages in `pending_review` for > 72 hours get a daily digest
  email to Matt via Resend.

Structured log per message:
```json
{ "skill": "engagement_bot", "platform": "instagram", "message_id": "...",
  "intent_class": "high", "fub_pushed": true, "draft_generated": true, "ms": 120 }
```

## Configuration

```typescript
export const ENGAGEMENT_BOT_CONFIG = {
  // Platforms to pull
  platforms_enabled: ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin'],

  // How far back to look on first run (hours)
  initial_lookback_hours: 24,

  // FUB tags appended to every social lead
  fub_base_tags: ['social_lead', 'ryan_realty'],

  // Hours until a pending_review message is flagged as stale
  stale_review_hours: 72,

  // Matt's calendar link for template substitution
  call_link: 'https://calendly.com/matt-ryanrealty',

  // Message patterns that trigger legal flag (do not reply, alert Matt)
  legal_flag_patterns: [
    /only.*people like us/i,
    /no.*children/i,
    /only.*family/i,
  ],
};
```

**Env vars required:**
| Var | Purpose |
|---|---|
| `META_ACCESS_TOKEN` | IG + FB API access |
| `META_IG_USER_ID` | Instagram user ID |
| `META_PAGE_ID` | Facebook page ID |
| `TIKTOK_ACCESS_TOKEN` | TikTok API access |
| `YOUTUBE_ACCESS_TOKEN` | YouTube API access |
| `LINKEDIN_ACCESS_TOKEN` | LinkedIn API access |
| `FUB_API_KEY` | Follow Up Boss API key |
| `ALERT_EMAIL` | Matt's email for legal flag alerts |
| `CRON_SECRET` | Cron authorization |

## Manual override / kill switch

**Kill entire bot:**
```sql
UPDATE automation_config SET value = 'false', updated_at = now()
WHERE key = 'engagement_bot_enabled';
```

**Kill FUB pushes only:**
```sql
UPDATE automation_config SET value = 'false', updated_at = now()
WHERE key = 'engagement_bot_fub_push_enabled';
```

**Kill one platform:**
```sql
UPDATE automation_config SET value = 'false', updated_at = now()
WHERE key = 'engagement_bot_platform_tiktok_enabled';
```

**Clear inbox / reset:**
Matt can mark all pending_review items as skipped from `/admin/engagement`. No programmatic
bulk-send is ever available.

## See also

- `automation_skills/automation/post_scheduler/SKILL.md` — `post_queue` join for context
- `automation_skills/automation/performance_loop/SKILL.md` — engagement rate feeds scoring
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — voice and content rules
- `app/api/fub/` — existing FUB integration in repo
