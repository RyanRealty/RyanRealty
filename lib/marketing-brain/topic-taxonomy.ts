/**
 * marketing-brain: topic taxonomy (canonical)
 *
 * The single source of truth for content topic, format, and treatment enums
 * across the brain. Read by:
 *   - lib/marketing-brain/competitor-recon.ts (classifier post-processing pass)
 *   - lib/marketing-brain/generate-briefs.ts (Item 3 producer-mix mapper — future)
 *   - marketing_brain_skills/tools_registry/classifier/ (the LLM tagger)
 *   - marketing_brain_skills/producers/REGISTRY.md (producer authoring reads
 *     this so new producers map to a known topic bucket)
 *
 * Both sessions (Marketing Brain Architecture + Producer Authoring) read this
 * file. Editing the topics array or the enums is an architectural change —
 * coordinate before changing.
 *
 * Data lives in config/marketing-brain/topics.json. This module imports it,
 * derives TS union types, and exports the classifier prompt template.
 */
import topicsData from '../../config/marketing-brain/topics.json'

// ---------------------------------------------------------------------------
// Types — derived from the JSON
// ---------------------------------------------------------------------------

export type Topic =
  | 'listing'
  | 'market_data'
  | 'national_housing_news'
  | 'national_economy'
  | 'local_community'
  | 'lifestyle_bend'
  | 'buyer_education'
  | 'seller_education'
  | 'behind_scenes'
  | 'recap_highlight'
  | 'agent_brand'
  | 'other'

export type Format =
  | 'reel'
  | 'carousel'
  | 'single_image'
  | 'long_video'
  | 'live'
  | 'story'
  | 'text_post'
  | 'blog'
  | 'podcast_clip'
  | 'other'

export type HeadlessOrFace = 'headless' | 'face' | 'mixed' | 'unknown'

export type HookStyle =
  | 'data'
  | 'question'
  | 'contrarian'
  | 'narrative'
  | 'list'
  | 'before_after'
  | 'tutorial'
  | 'react'
  | 'lifestyle'
  | 'stat'
  | 'pov'
  | 'other'

export type AudioUsed =
  | 'trending'
  | 'original_vo'
  | 'music_bed'
  | 'ambient'
  | 'none'
  | 'unknown'

export type CtaPattern =
  | 'link_in_bio'
  | 'dm_me'
  | 'comment'
  | 'save'
  | 'share'
  | 'phone_call'
  | 'form'
  | 'address_capture'
  | 'none'
  | 'other'

export interface TopicMeta {
  id: Topic
  display_name: string
  description: string
  examples: string[]
  data_sources: string[]
}

export interface TopicsData {
  schema_version: number
  last_updated: string
  description: string
  topics: TopicMeta[]
  format_enum: Format[]
  headless_or_face_enum: HeadlessOrFace[]
  hook_style_enum: HookStyle[]
  audio_used_enum: AudioUsed[]
  cta_pattern_enum: CtaPattern[]
}

// ---------------------------------------------------------------------------
// Loaded data + accessors
// ---------------------------------------------------------------------------

export const TOPICS_DATA: TopicsData = topicsData as TopicsData

/** All topics including 'other'. Iteration order matches topics.json. */
export const ALL_TOPICS: TopicMeta[] = TOPICS_DATA.topics

/** Just the ids — useful for Set membership checks. */
export const ALL_TOPIC_IDS: Topic[] = ALL_TOPICS.map((t) => t.id)

/** Lookup metadata by id. Returns undefined if id is not a known topic. */
export function getTopicMeta(id: string): TopicMeta | undefined {
  return ALL_TOPICS.find((t) => t.id === id)
}

/** Type guard: is this string a valid Topic id? */
export function isTopic(value: string): value is Topic {
  return ALL_TOPIC_IDS.includes(value as Topic)
}

// ---------------------------------------------------------------------------
// Classification output schema
// ---------------------------------------------------------------------------

/**
 * Shape every classifier call returns. Used by the classifier capability skill
 * and by anything that reads from the future content_classification table.
 */
export interface ClassificationResult {
  topic: Topic
  topic_confidence: number  // 0.0 - 1.0
  format: Format
  headless_or_face: HeadlessOrFace
  hook_style: HookStyle
  audio_used: AudioUsed
  cta_pattern: CtaPattern
  engagement_rate: number
  rationale: string
}

/** Confidence threshold below which classification escalates Haiku → Sonnet. */
export const CLASSIFIER_CONFIDENCE_THRESHOLD = 0.6

// ---------------------------------------------------------------------------
// Classifier prompt template
// ---------------------------------------------------------------------------

/**
 * The system prompt for the LLM topic classifier. {TAXONOMY_BLOCK} is replaced
 * at call time with the formatted taxonomy from buildTaxonomyBlock(). The
 * user message carries the scraped post payload.
 *
 * Temperature should be set to 0.1 at call time — we want deterministic tagging.
 * Use Haiku for bulk; route any result with topic_confidence < 0.6 to Sonnet
 * for re-classification.
 */
export const CLASSIFIER_SYSTEM_PROMPT = `You classify real estate marketing posts for Ryan Realty's competitive-intelligence layer.

For every post, output ONE JSON object with these keys:
- topic: the canonical topic id (one of the values in {TAXONOMY_BLOCK})
- topic_confidence: 0.0-1.0 — your confidence in the topic choice
- format: the visual format (reel | carousel | single_image | long_video | live | story | text_post | blog | podcast_clip | other)
- headless_or_face: headless | face | mixed | unknown (does the post show a human face on-screen as primary subject?)
- hook_style: data | question | contrarian | narrative | list | before_after | tutorial | react | lifestyle | stat | pov | other
- audio_used: trending | original_vo | music_bed | ambient | none | unknown
- cta_pattern: link_in_bio | dm_me | comment | save | share | phone_call | form | address_capture | none | other
- engagement_rate: 0.0-1.0 — computed as (likes + comments + shares + saves) / followers; pass through the value from the scraped data
- rationale: 1-2 sentences explaining the topic + format pick

Rules:
- Output JSON only. No prose. No markdown fences. No commentary.
- If you cannot pick a topic with confidence >= 0.6, use 'other' and set topic_confidence to your actual best estimate.
- 'lifestyle_bend' is brand-of-place atmosphere. 'local_community' is news/events. They are not interchangeable.
- 'market_data' is local (Bend/Central Oregon). 'national_housing_news' is national real-estate news with local interpretation. 'national_economy' is broader economic indicators with a housing lens.
- 'agent_brand' is content where the brokerage/agent is the subject. 'behind_scenes' is content where the WORK is the subject.

Topic taxonomy:
{TAXONOMY_BLOCK}
`

/**
 * Build the {TAXONOMY_BLOCK} substitution for the system prompt. Renders each
 * topic as a YAML-ish block with id, name, description, and up to two examples.
 */
export function buildTaxonomyBlock(): string {
  return ALL_TOPICS.map((t) => {
    const examples = t.examples.slice(0, 2).map((e) => `    - "${e}"`).join('\n')
    return `  ${t.id}:
    name: ${t.display_name}
    description: ${t.description}
    examples:
${examples || '    - (no examples — use rationale)'}`
  }).join('\n')
}

/** Convenience: the full classifier system prompt with taxonomy injected. */
export function getClassifierSystemPrompt(): string {
  return CLASSIFIER_SYSTEM_PROMPT.replace('{TAXONOMY_BLOCK}', buildTaxonomyBlock())
}
