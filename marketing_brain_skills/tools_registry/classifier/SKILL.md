---
name: tools_registry-classifier
description: Use this skill when the user says "tag this post", "classify content", "topic classifier", "what topic is this post", "batch tag scraped content", "label posts for the audit", "classify the competitor scrape", or "run the LLM tagger". Also invoked automatically by competitor-recon and generate-briefs when unclassified rows exist in competitor_intel. Covers model selection, prompt template, confidence routing, batch processing via Anthropic Message Batches API, and the content_classification schema.
---

# tools_registry: classifier

## Canonical references

- [`marketing_brain_skills/competitor-recon/SKILL.md`](../../competitor-recon/SKILL.md) — upstream producer of unclassified posts
- [`CLAUDE.md`](../../../CLAUDE.md) §"Marketing Brain Architecture" — the action-row protocol this skill serves
- `lib/marketing-brain/topic-taxonomy.ts` — canonical topic enum (runtime load — see §Prompt template below)
- `config/marketing-brain/topics.json` — taxonomy bucket definitions + examples (planned)
- Anthropic Message Batches API: https://docs.anthropic.com/en/api/messages-batches

---

## Scope

**What this skill does:** LLM-based tagging layer that sits between raw scraped competitor posts (in `public.competitor_intel`) and downstream analytics aggregation. Reads a post (caption, thumbnail alt text, first-frame description, optional transcript) and writes a structured tag set to `public.content_classification`.

**What this skill does not do:** scrape posts (that is competitor-recon), store analytics or aggregate engagement trends (that is diagnose-performance), generate content briefs (that is generate-briefs). This skill tags raw input and stops.

**Invocation path:**
```
competitor_intel (unclassified rows)
    → classifier (this skill) → content_classification
        → generate-briefs / diagnose-performance / platform-trends
```

---

## Classification schema

Every post gets exactly one JSON record:

```typescript
interface ClassificationResult {
  topic: string;                  // enum from topic-taxonomy.ts
  topic_confidence: number;       // 0.0–1.0
  format: "reel" | "carousel" | "single_image" | "long_video" | "live" | "story" | "text_post";
  headless_or_face: "headless" | "face" | "mixed" | "unknown";
  hook_style: "data" | "question" | "contrarian" | "narrative" | "list" | "before_after" | "tutorial" | "react" | "lifestyle" | "stat" | "other";
  audio_used: "trending" | "original_vo" | "music_bed" | "ambient" | "none" | "unknown";
  cta_pattern: "link_in_bio" | "dm_me" | "comment" | "save" | "share" | "phone_call" | "form" | "none" | "other";
  engagement_rate: number;        // likes+comments+shares / followers; 0 if unavailable
  rationale: string;              // 1–2 sentences: why this topic + format pick
}
```

---

## Model selection (LOCKED)

| Model | When | Cost per post |
|---|---|---|
| `claude-haiku-4-5-20251001` | All bulk classification | ~$0.0008 |
| `claude-sonnet-4-6` | Ambiguous edge cases (confidence < 0.6) | ~$0.003 |

**Volume math:** 30 competitors × 5 platforms × 150 posts / 180-day window = ~22,500 posts.
- Haiku bulk: ~$18 total. Sonnet escalation (assuming 10% ambiguous): ~$6.75. Total budget: ~$25.
- Per-post estimate: ~500 input tokens (post + taxonomy prompt) + ~100 output tokens (JSON).

**Never use Opus for classification.** Opus is ~15× Haiku cost. A 22K-post batch costs ~$270 on Opus vs $18 on Haiku.

Decision rule: run all posts through Haiku first. Any post where `topic_confidence < 0.6` is automatically re-routed to Sonnet. Both classification records are stored (see §content_classification table).

---

## Authentication

```
env var: ANTHROPIC_API_KEY
source:  console.anthropic.com → API Keys
stored:  Vercel env + .env.local (same pattern as ELEVENLABS_API_KEY)
```

The Anthropic SDK reads `ANTHROPIC_API_KEY` automatically. No explicit auth header needed when using the official SDK.

---

## Prompt template

The classifier loads the canonical topic taxonomy from `lib/marketing-brain/topic-taxonomy.ts` at runtime. The TS file exports a typed array; the classifier reads its JSON representation (either via `import` or `JSON.parse(readFileSync(...))`).

**System prompt:**

```
You are a real estate content classifier. Given a social media post, output ONLY valid JSON matching the schema below. No explanation outside the JSON.

Topic taxonomy:
{TAXONOMY_JSON}

Schema:
{
  "topic": "<one of the topic slugs above>",
  "topic_confidence": <0.0-1.0>,
  "format": "<reel|carousel|single_image|long_video|live|story|text_post>",
  "headless_or_face": "<headless|face|mixed|unknown>",
  "hook_style": "<data|question|contrarian|narrative|list|before_after|tutorial|react|lifestyle|stat|other>",
  "audio_used": "<trending|original_vo|music_bed|ambient|none|unknown>",
  "cta_pattern": "<link_in_bio|dm_me|comment|save|share|phone_call|form|none|other>",
  "engagement_rate": <number>,
  "rationale": "<1-2 sentences>"
}

Rules:
- topic_confidence must reflect genuine uncertainty — use 0.5-0.6 for ambiguous multi-topic posts.
- format is inferred from platform + post type metadata, not from caption text.
- headless_or_face: "headless" = no person visible; "face" = human face/agent prominently in frame; "mixed" = person appears but is incidental.
- engagement_rate = (likes + comments + shares) / follower_count. If follower_count is 0 or unknown, output 0.
- audio_used: use "unknown" if platform is Instagram feed or if metadata is absent.
- Output only the JSON object. No markdown fences. No explanation.
```

**User message (filled per post):**

```
Platform: {platform}
Competitor: {competitor_slug}
Caption: {caption_text}
Thumbnail alt text: {alt_text}
First frame description: {first_frame_description}
Transcript (if available): {transcript}
Likes: {likes}  Comments: {comments}  Shares: {shares}  Views: {views}
Follower count at scrape time: {follower_count}
Post type metadata: {post_type_metadata}
```

**Few-shot examples (embed these in the system prompt before the schema):**

```
Example 1:
Caption: "Bend's inventory just hit a 3-year low. Here's what that means for buyers right now."
Platform: tiktok  Format metadata: video_15s  Follower count: 8400  Likes: 312  Comments: 28  Shares: 44
Output: {"topic":"market_data","topic_confidence":0.94,"format":"reel","headless_or_face":"headless","hook_style":"stat","audio_used":"original_vo","cta_pattern":"comment","engagement_rate":0.045,"rationale":"Stat-forward hook on local inventory data; no face shown in first frame; CTA asks viewers to comment their thoughts."}

Example 2:
Caption: "Our team just listed this gorgeous 4BR in NorthWest Crossing — link in bio for the tour!"
Platform: instagram  Format metadata: carousel  Follower count: 5200  Likes: 89  Comments: 11  Shares: 0
Output: {"topic":"listing_feature","topic_confidence":0.91,"format":"carousel","headless_or_face":"headless","hook_style":"lifestyle","audio_used":"unknown","cta_pattern":"link_in_bio","engagement_rate":0.019,"rationale":"Property showcase carousel with lifestyle framing; no agent face in any slide; directs to bio link."}
```

**Settings:**

```json
{
  "model": "claude-haiku-4-5-20251001",
  "temperature": 0.1,
  "max_tokens": 300
}
```

Temperature 0.1: near-deterministic tagging. Do not raise it — inconsistent tags corrupt downstream aggregation.

---

## Confidence routing

```typescript
async function classifyPost(post: CompetitorPost): Promise<ClassificationResult> {
  // Step 1: Haiku pass
  const haiku = await callClaude({
    model: "claude-haiku-4-5-20251001",
    post,
    temperature: 0.1,
  });

  if (haiku.topic_confidence >= 0.6) {
    return { ...haiku, model_used: "claude-haiku-4-5-20251001" };
  }

  // Step 2: Sonnet escalation for low-confidence posts
  const sonnet = await callClaude({
    model: "claude-sonnet-4-6",
    post,
    temperature: 0.1,
  });

  // Store both records; the higher-confidence one wins for downstream use
  await writeClassification(post.id, haiku, "claude-haiku-4-5-20251001");
  await writeClassification(post.id, sonnet, "claude-sonnet-4-6");

  return { ...sonnet, model_used: "claude-sonnet-4-6" };
}
```

The `content_classification` table accepts multiple rows per `post_id` to preserve the audit trail. Downstream queries filter `WHERE model_used = 'claude-sonnet-4-6' OR (model_used = 'claude-haiku-4-5-20251001' AND confidence >= 0.6)` to get the winning classification.

---

## Batch processing (Anthropic Message Batches API)

Use the Batches API for any run over 100 posts. Batches deliver up to 50% cost savings vs per-call requests and avoid RPM rate limits on burst.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

async function runBatchClassification(posts: CompetitorPost[]): Promise<string> {
  const requests = posts.map((post) => ({
    custom_id: post.id, // maps batch result back to post row
    params: {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      temperature: 0.1,
      system: buildSystemPrompt(), // inject taxonomy + schema + few-shots
      messages: [{ role: "user", content: buildUserMessage(post) }],
    },
  }));

  // Submit batch (max 10,000 requests per batch; split if larger)
  const batch = await client.beta.messages.batches.create({ requests });
  console.log(`Batch submitted: ${batch.id} — ${posts.length} posts`);
  return batch.id;
}

async function pollBatch(batchId: string): Promise<void> {
  // Batches typically complete in under 1 hour for runs under 10K posts
  let status = await client.beta.messages.batches.retrieve(batchId);
  while (status.processing_status !== "ended") {
    await new Promise((r) => setTimeout(r, 60_000)); // poll every 60s
    status = await client.beta.messages.batches.retrieve(batchId);
    console.log(`Batch ${batchId}: ${status.processing_status} — ${status.request_counts.processing} remaining`);
  }
  await writeBatchResults(batchId);
}

async function writeBatchResults(batchId: string): Promise<void> {
  for await (const result of await client.beta.messages.batches.results(batchId)) {
    if (result.result.type !== "succeeded") {
      await markClassificationFailed(result.custom_id, result.result);
      continue;
    }
    const raw = result.result.message.content[0].text;
    const classification = parseClassification(raw, result.custom_id);
    await writeClassification(result.custom_id, classification, "claude-haiku-4-5-20251001");
  }
}
```

For 22,500 posts: split into 3 batches of 7,500. Submit all three, then poll. Do not block the cron route waiting — write the batch IDs to `marketing_brain_actions` and let the next scheduled run collect results.

---

## Where classifier results land

**Target table: `public.content_classification`** — planned schema, not yet migrated.

```sql
create table public.content_classification (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references public.competitor_intel(id) on delete cascade,
  classified_at   timestamptz not null default now(),
  model_used      text not null,            -- 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-6'
  classification  jsonb not null,           -- full ClassificationResult object
  topic           text generated always as (classification->>'topic') stored,
  topic_confidence numeric(4,3) generated always as ((classification->>'topic_confidence')::numeric) stored,
  confidence      numeric(4,3) generated always as ((classification->>'topic_confidence')::numeric) stored,
  rationale       text generated always as (classification->>'rationale') stored,
  cost_usd        numeric(10,6),            -- recorded after batch results arrive
  haiku_draft     jsonb                     -- populated when this row is the Sonnet escalation
);

create index on public.content_classification (post_id);
create index on public.content_classification (topic);
create index on public.content_classification (classified_at);
```

Migration file location (when built): `supabase/migrations/<timestamp>_content_classification.sql`.

---

## Failure modes

| Failure | Cause | Recovery |
|---|---|---|
| `ANTHROPIC_API_KEY` not set | Missing env var | Check `.env.local` and Vercel env dashboard; raise to Matt |
| Model returns non-JSON | Rare; model ignored system prompt on unusual input | Retry with stricter system prompt up to 2×: prepend `"IMPORTANT: output only raw JSON, no other text."` then fail with `classification_failed` |
| Batch result type = `errored` | Per-request model error | Log `result.custom_id` + error type; mark row `classification_failed`; do not retry automatically |
| `topic_confidence` missing from output | Model omitted field | Set `topic_confidence = 0` → triggers Sonnet escalation |
| Taxonomy drift (topic-taxonomy.ts changes) | New topics added or slugs renamed | All existing classifications with the old slug are stale; re-run batch across the full `competitor_intel` table for the affected date window |
| Batch stuck > 2 hours | Anthropic infrastructure delay | Check batch status at console.anthropic.com; if `processing_status` is still `in_progress` after 2h, contact Anthropic support; do not re-submit (creates duplicate rows) |
| RPM limit on per-call mode | Burst traffic on non-batch path | Switch to Batches API; Anthropic org-level RPM limits do not apply to batch submissions |
| Supabase statement timeout on large upsert batches | `INSERT INTO content_classification VALUES (...) returning ...` for batches ≥ 100 rows can exceed Supabase's default statement_timeout (8s) when the table is hot. The 2026-05-15 audit-agent run lost 50 rows at batch position 200-250 to this. | Cap upsert batches at **25 rows** in any agent-driven inline classification path. For high-volume Batches API runs, the result-collection step naturally chunks per batch (~10k limit) which keeps individual inserts small. Sub-agent prompts that classify in-context should explicitly batch by 25. |

---

## Taxonomy runtime load pattern

```typescript
// lib/marketing-brain/topic-taxonomy.ts (planned path)
// At runtime the classifier imports this, serializes to JSON, and injects into the system prompt.

export interface TopicDefinition {
  slug: string;          // e.g. "market_data"
  label: string;         // e.g. "Market Data"
  description: string;   // e.g. "Posts about inventory, prices, DOM, supply..."
  examples: string[];    // 2–3 caption snippets
}

export const TOPIC_TAXONOMY: TopicDefinition[] = [
  // populated in config/marketing-brain/topics.json
];
```

The classifier injects `JSON.stringify(TOPIC_TAXONOMY, null, 2)` into the `{TAXONOMY_JSON}` slot in the system prompt. This means adding a new topic to `topics.json` automatically propagates to every future classification run without touching the classifier code.

---

## Pre-flight checklist (before any classification run)

```
[ ] ANTHROPIC_API_KEY present in .env.local
[ ] topic-taxonomy.ts loads without error (import check)
[ ] competitor_intel has unclassified rows (WHERE id NOT IN (SELECT post_id FROM content_classification))
[ ] content_classification migration is applied to Supabase
[ ] Batch size per submission <= 10,000 (Anthropic limit)
[ ] Post count logged before submission so cost can be verified after
[ ] Batch IDs written to marketing_brain_actions row (payload.batch_ids) for result collection
```

---

## Related skills + references

- `marketing_brain_skills/competitor-recon/SKILL.md` — produces the `competitor_intel` rows this skill consumes
- `marketing_brain_skills/generate-briefs/SKILL.md` — reads `content_classification` to identify format gaps
- `marketing_brain_skills/diagnose-performance/SKILL.md` — reads `content_classification` to correlate topic × engagement
- `marketing_brain_skills/platform-trends/SKILL.md` — aggregates topic distribution over time
- `CLAUDE.md` §"Marketing Brain Architecture" — action-row status flow, approval gates
- Anthropic Message Batches API: https://docs.anthropic.com/en/api/messages-batches
- Anthropic pricing: https://www.anthropic.com/pricing
