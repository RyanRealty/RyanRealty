# Marketing Brain — Audit Findings Protocol

The contract between the **competitor audit run** and the **Producer Authoring session**. Defines where audit findings land, what shape they take, and how downstream sessions consume them.

**Status:** Locked 2026-05-14.
**Read by:** Producer Authoring session (to find next skill to author), Marketing Brain Architecture session (when writing audit code), Matt (when reviewing audit results).

---

## Why this file exists

The competitor audit produces a ranked list of "winning content combos" at top brokerages — topic × format pairs that beat the median engagement rate. The audit only matters if the next session knows where to look.

Without a defined handoff artifact, Producer Authoring picks skills to author based on intuition. With one, every new producer traces to specific competitive evidence.

This file is the contract: **all audit outputs land in three deterministic locations; Producer Authoring queries those locations to pick its next move.**

---

## The three outputs of an audit run

### 1. `marketing_brain_actions` row (programmatic, primary)

Every audit creates exactly one row with `action_type='analyze:audit_findings'`. This is the canonical handoff artifact.

```sql
INSERT INTO public.marketing_brain_actions (
  action_type,
  target,
  assigned_producer,
  payload,
  data_evidence,
  topic,
  format,
  platforms,
  status,
  generated_by,
  generation_reason
) VALUES (
  'analyze:audit_findings',
  'audit:2026-MM-DD',
  'marketing_brain_skills/audit-findings',
  '<payload — see schema below>'::jsonb,
  '<data_evidence — raw aggregates>'::jsonb,
  'audit_findings',
  'analysis',
  ARRAY[]::text[],
  'pending',
  'marketing_brain:audit-run',
  'Competitor audit YYYY-MM-DD: N competitors × M platforms × W posts classified. Top quartile by ER surfaces K missing producers.'
);
```

The status flow:
- `pending` — fresh audit findings; Matt has not reviewed
- `approved` — Matt has reviewed and signed off on the missing_producers list
- `executed` — Producer Authoring has worked through every entry in missing_producers
- `killed` — audit findings retired (superseded by a newer audit run, or rejected)

Only one row should be in `pending` or `approved` at a time. When a new audit runs, prior `approved` audits transition to `killed` (their work is either complete or being replaced).

### 2. `docs/marketing-brain/audit-YYYY-MM-DD.md` (human-readable)

A Markdown report rendering the same data prose-formatted. For Matt's skim review and for the long-term record. Required sections:

- **Headline summary** — competitors scraped, posts classified, top-quartile threshold, missing producer count
- **Top winners by topic × format** — table sorted by engagement rate descending, with sample post URLs
- **Missing producers** — bulleted list, each entry citing evidence and priority
- **Existing producers validated** — table of producers that audit data supports keeping
- **Outliers + flags** — content combos that look like winners but warrant skepticism (small sample, single creator dominance, etc.)

A doc per audit run. Audit code writes `docs/marketing-brain/audit-LATEST.md` as a symlink (or copy) to the most recent file so Producer Authoring's skill load gets the freshest data without guessing the date.

### 3. Supabase raw tables (data layer)

Underlying data the report aggregates over.

| table | role | status |
|---|---|---|
| `competitor_intel` | Raw scraped posts (per platform, per competitor). One row per post + one row per profile-level metric. | Live; schema in `supabase/migrations/20260512160600_competitor_intel.sql` |
| `content_classification` | Per-post LLM tags (topic, format, headless_or_face, hook_style, audio, cta, engagement_rate, model_used, confidence). | **Planned** — schema in `marketing_brain_skills/tools_registry/classifier/SKILL.md` |
| `audit_winners` (view) | Aggregated top-quartile combos by topic × format, computed from `content_classification` joined to `competitor_intel`. | **Planned** — view definition lives in the audit code |

---

## payload schema (the contract)

The `marketing_brain_actions.payload` JSONB for an `analyze:audit_findings` row must follow this shape exactly. Producer Authoring depends on it.

```typescript
interface AuditFindingsPayload {
  audit_id: string                            // "2026-MM-DD" (matches the markdown doc filename)
  audit_started_at: string                    // ISO 8601 timestamp
  audit_completed_at: string                  // ISO 8601 timestamp
  window_days: number                         // typically 180

  // Scope summary
  competitors_scraped: number                 // count of competitor IDs touched
  competitors_with_data: number               // count where at least one platform returned posts
  platforms_scraped: string[]                 // ["instagram", "tiktok", "youtube", "facebook", "linkedin"]
  posts_classified: number                    // total content_classification rows written
  classifier_cost_usd: number                 // sum across batch + escalation
  apify_cost_usd: number                      // sum across actor runs

  // The thing Producer Authoring actually reads
  missing_producers: MissingProducer[]
  existing_producers_validated: ExistingProducerValidation[]

  // Top-quartile winners — Matt's review surface
  top_winners_by_topic_format: TopWinner[]

  // Notes
  outliers_flagged: OutlierFlag[]
  errors: string[]                            // any partial failures during the run
  report_path: string                         // "docs/marketing-brain/audit-2026-MM-DD.md"
}

interface MissingProducer {
  proposed_skill_name: string                 // e.g. "market-data-carousel"
  proposed_path: string                       // e.g. "social_media_skills/market-data-carousel/"
  proposed_action_type: string                // e.g. "content:market_data_carousel"
  topic: Topic                                // from topic-taxonomy.ts
  format: Format                              // from topic-taxonomy.ts
  evidence: {
    median_engagement_rate_top_quartile: number
    sample_post_urls: string[]                // 3-5 specific posts
    competitors_running_this: string[]        // competitor ids from competitors.json
    post_count_in_corpus: number
  }
  priority: 'high' | 'medium' | 'low'         // based on combined ER * post_count
  rationale: string                           // 1-2 sentence why we should author this
  data_sources_needed: string[]               // e.g. ["market_stats_cache", "Spark MLS"]
  similar_existing_producer: string | null    // path of nearest match, or null
}

interface ExistingProducerValidation {
  producer_path: string                       // matches registry path
  validated: boolean                          // is this producer's pattern winning in the audit?
  evidence: string
  recommendation: 'keep' | 'refresh' | 'retire'
}

interface TopWinner {
  topic: Topic
  format: Format
  median_engagement_rate: number
  post_count: number
  top_creators: { competitor_id: string, post_url: string, engagement_rate: number }[]
  exemplar_caption: string                    // one specific caption to study
}

interface OutlierFlag {
  topic: Topic
  format: Format
  flag: 'small_sample' | 'single_creator_dominance' | 'viral_anomaly' | 'recency_bias'
  detail: string
}
```

Types `Topic` and `Format` come from [`lib/marketing-brain/topic-taxonomy.ts`](../../lib/marketing-brain/topic-taxonomy.ts).

---

## How Producer Authoring picks it up

Producer Authoring's "what should I author next?" trigger runs this query:

```sql
SELECT id, target, payload, generation_reason, created_at
FROM public.marketing_brain_actions
WHERE action_type = 'analyze:audit_findings'
  AND status = 'approved'
ORDER BY created_at DESC
LIMIT 1;
```

It then iterates `payload.missing_producers[]` sorted by priority desc, picking the first entry where no producer with `proposed_skill_name` already exists in [`producers/REGISTRY.md`](../producers/REGISTRY.md).

For each entry, Producer Authoring:
1. Reads `evidence.sample_post_urls` to study the format in the wild
2. Reads `data_sources_needed` to know which tools to wire in
3. Reads `similar_existing_producer` (if not null) to start from a template
4. Authors a new SKILL.md using [`producers/TEMPLATE.md`](../producers/TEMPLATE.md)
5. Adds a row to `producers/REGISTRY.md` in the appropriate section
6. Marks the entry complete (records the new producer path back in the action row's `executor_response` jsonb)

When every `missing_producers` entry is handled, the action row transitions `approved` → `executed`.

---

## How the brain itself uses these findings

The brain's `generate-briefs.ts` (Item 3+) reads the latest approved `analyze:audit_findings` to inform `mapOpportunityToBriefs`:

- When an opportunity matches a topic × format combo in `top_winners_by_topic_format`, the brain prefers that format over a default
- When a competitor opportunity surfaces (`competitor format_gap`), the brain checks `existing_producers_validated` to know which existing producer to invoke
- When the brain is otherwise unsure which format to emit, it falls back to the top winner for the relevant topic

This integration is **planned**, not yet implemented. It depends on this protocol being stable.

---

## Refresh cadence

| Trigger | Action |
|---|---|
| Quarterly (Jan 1, Apr 1, Jul 1, Oct 1) | New audit run; prior audit transitions `approved` → `killed`; new findings replace |
| Major platform algorithm shift (e.g. Reels → carousel weight change) | Ad-hoc audit run; same replacement pattern |
| New competitor enters the Bend market | Add to `competitors.json`; next quarterly audit picks it up |
| Topic taxonomy changes | Re-classification pass over existing `competitor_intel`; replaces `content_classification` rows; aggregate views re-compute |

Producer Authoring should not author against an audit older than 90 days without re-validating. Old winners can rot fast on TikTok and IG.

---

## What's NOT in this protocol

- The audit code itself (lives in `lib/marketing-brain/competitor-recon.ts` after expansion + a new `lib/marketing-brain/audit-run.ts` orchestrator — planned, not built)
- The classifier execution (covered by [`tools_registry/classifier/SKILL.md`](../tools_registry/classifier/SKILL.md))
- The producer SKILL.md authoring workflow (covered by [`producers/TEMPLATE.md`](../producers/TEMPLATE.md))
- Per-producer success metrics (lives in `content_performance` table and `performance_loop` capability skill)

This file is a contract. The implementations sit elsewhere.

---

## Related references

- [`marketing_brain_skills/producers/REGISTRY.md`](../producers/REGISTRY.md) — where Producer Authoring writes new producer rows
- [`marketing_brain_skills/producers/TEMPLATE.md`](../producers/TEMPLATE.md) — the per-producer SKILL.md template
- [`marketing_brain_skills/tools_registry/REGISTRY.md`](../tools_registry/REGISTRY.md) — tool dependencies for any new producer
- [`marketing_brain_skills/tools_registry/apify/SKILL.md`](../tools_registry/apify/SKILL.md) — Apify scraper layer
- [`marketing_brain_skills/tools_registry/classifier/SKILL.md`](../tools_registry/classifier/SKILL.md) — LLM tagger layer
- [`lib/marketing-brain/topic-taxonomy.ts`](../../lib/marketing-brain/topic-taxonomy.ts) — canonical Topic + Format enums
- [`config/marketing-brain/competitors.json`](../../config/marketing-brain/competitors.json) — competitor scrape set
- [`config/marketing-brain/topics.json`](../../config/marketing-brain/topics.json) — topic bucket definitions
- [`CLAUDE.md`](../../CLAUDE.md) §"Marketing Brain Architecture" — overall protocol
