/**
 * marketing-brain: inbox-parser
 *
 * LLM-based intent classification for emails arriving at
 * marketing@ryan-realty.com. Given { from, subject, body_text }, calls
 * Anthropic Haiku to return:
 *
 *   { action_type, target, payload, confidence, rationale }
 *
 * Strategy:
 *   - Single Haiku call (cheap, ~$0.001/email at expected volume).
 *   - System prompt enumerates valid action_types from the producer registry.
 *   - Confidence < INBOX_PARSE_CONFIDENCE_THRESHOLD (default 0.70) routes to
 *     comms:matt_alert in the dispatcher for manual triage.
 *
 * Auth: ANTHROPIC_API_KEY env var.
 *
 * Locked 2026-05-14. Tracks producers/REGISTRY.md — update VALID_ACTION_TYPES
 * when a new producer ships.
 */

export const INBOX_PARSE_CONFIDENCE_THRESHOLD = 0.7

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

// Synced 2026-05-14 against marketing_brain_skills/producers/REGISTRY.md.
// Add a new action_type here when a producer registers it. If the parser
// emits an action_type not in this list the dispatcher treats it as
// 'unknown' and routes through comms:matt_alert.
export const VALID_ACTION_TYPES = [
  // content orchestrators
  'content:list_kit',
  'content:listing_launch',
  'content:monthly_market_report',
  // content producers
  'content:listing_video',
  'content:listing_reel',
  'content:market_video',
  'content:market_data_short',
  'content:market_data_viz',
  'content:market_youtube_longform',
  'content:market_stat_card_video',
  'content:news_clip',
  'content:news_video',
  'content:neighborhood_tour',
  'content:neighborhood_reel',
  'content:area_guide_short',
  'content:area_guide_long',
  'content:blog_post',
  'content:seo_blog',
  'content:fb_lead_gen_ad',
  'content:fb_ad',
  'content:flyer',
  'content:just_listed_flyer',
  'content:open_house_flyer',
  'content:feature_sheet',
  'content:ig_carousel',
  'content:ig_single_post',
  'content:image_meme',
  'content:meme_video',
  'content:avatar_market_update',
  'content:avatar_video',
  'content:earth_zoom',
  'content:aerial_flyover',
  'content:tiktok_listing_tour',
  'content:yt_longform_walkthrough',
  'content:coming_soon_teaser',
  'content:open_house_stories',
  'content:under_contract_announcement',
  'content:sold_deal_summary',
  'content:linkedin_doc_carousel',
  'content:agent_coop_eflyer',
  'content:postcard_mailer',
  'content:yard_sign',
  'content:neighbor_note',
  'content:social_calendar',
  'content:stats_clip',
  // site
  'site:copy_update',
  'site:meta_update',
  'site:cta_update',
  'site:page_create',
  'site:landing_page_create',
  'site:perf_fix',
  'site:redirect_add',
  'site:schema_add',
  'site:property_landing_create',
  'site:property_landing_update',
  'site:matterport_embed',
  // ops
  'ops:meta_budget',
  'ops:meta_pause',
  'ops:meta_resume',
  'ops:meta_audience',
  'ops:meta_creative_swap',
  'ops:fub_tag_fix',
  'ops:fub_sequence_change',
  'ops:fub_task_create',
  'ops:fub_routing',
  'ops:email_newsletter',
  'ops:email_blast',
  'ops:email_template_update',
  'ops:review_response',
  'ops:review_request',
  'ops:gbp_post',
  'ops:gbp_qna',
  'ops:fb_marketplace_create',
  'ops:fb_marketplace_update',
  'ops:manychat_setup',
  'ops:manychat_pause',
  'ops:manychat_update',
  // analysis
  'analyze:drop_investigation',
  'analyze:spike_investigation',
  'analyze:metric_decomposition',
  'analyze:ab_test_design',
  'analyze:ab_test_readout',
  // communications
  'comms:matt_alert',
  'comms:matt_summary',
  'comms:team_update',
  'comms:stakeholder_summary',
] as const

export type ValidActionType = typeof VALID_ACTION_TYPES[number]

export interface InboxParseInput {
  from: string
  subject: string
  body_text: string
}

export interface InboxParseResult {
  action_type: string                // may be 'unknown' if confidence is low
  target: string
  payload: Record<string, unknown>
  confidence: number                  // 0.0 – 1.0
  rationale: string
  model: string
  raw_response?: string               // for debug
  error?: string
}

function getInboxParserSystemPrompt(): string {
  const actionTypeList = VALID_ACTION_TYPES.map((t) => `  - ${t}`).join('\n')
  return `You are the inbox parser for the Ryan Realty marketing brain. Real estate broker (Ryan Realty, Bend, Oregon) sends an email to marketing@ryan-realty.com asking for a specific marketing deliverable. Your job is to convert that natural-language request into a structured action row the brain's producers can execute.

Output a SINGLE JSON object with these fields and nothing else:

{
  "action_type": "<one of the valid action_types below, or 'unknown'>",
  "target": "<subject of the action — see target formats below>",
  "payload": { ... },
  "confidence": <number between 0.0 and 1.0>,
  "rationale": "<one short sentence explaining the choice>"
}

VALID action_types (use EXACTLY one of these, or 'unknown' if no match):
${actionTypeList}

TARGET formats:
  - Listings: 'mls:<MlsId>' (e.g. 'mls:220189422')
  - City/market: 'city:<CityName>' (e.g. 'city:Bend')
  - Neighborhood: 'neighborhood:<name>' (e.g. 'neighborhood:Awbrey Butte')
  - Website page: page path (e.g. '/listings', '/')
  - News topic: 'topic:<slug>' (e.g. 'topic:wildfire-risk-2026')
  - Email segment: 'segment:<name>' or 'contact:<email>'
  - Ad campaign: 'campaign:<id>'
  - Anything else: 'manual:<slug-derived-from-request>'

PAYLOAD: include every specific detail the sender gave that the producer needs to execute, such as:
  - "address": exact street address, if the email referenced one
  - "mls_id": MLS number, if the email gave one
  - "city": for market reports
  - "open_house_date": ISO-style date, for open house flyers
  - "topic": for blog/news
  - "campaign_id": for ad actions
  - "deadline": ISO date, if the sender named one
  - "notes": verbatim quoted extra detail from the email body
  - "raw_subject": original subject for debugging

CONFIDENCE GUIDANCE:
  - 0.9+ : Sender explicitly named the deliverable and the target (e.g. "make a listing reel for MLS 220189422")
  - 0.7–0.9 : Clear deliverable but target inferred from address/context
  - 0.5–0.7 : Ambiguous between two action_types; pick the most likely
  - <0.5 : Unclear what the sender wants — use 'unknown' for action_type

RULES:
  - Output JSON only. No prose. No markdown fences.
  - If the email is conversational ("any update on the listing video?") not a new request, mark action_type='unknown'.
  - If the email references multiple deliverables, pick the FIRST one and note the others in payload.notes.
  - Never invent an address or MLS number. If not provided, omit from payload.
  - Never fabricate data. Confidence and rationale must be honest.`
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>
  usage?: { input_tokens: number; output_tokens: number }
  stop_reason?: string
}

export async function parseInboxEmail(input: InboxParseInput): Promise<InboxParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      action_type: 'unknown',
      target: 'manual:no-anthropic-key',
      payload: {},
      confidence: 0,
      rationale: 'ANTHROPIC_API_KEY not configured; parser cannot run.',
      model: HAIKU_MODEL,
      error: 'ANTHROPIC_API_KEY missing',
    }
  }

  const truncatedBody = (input.body_text ?? '').slice(0, 2000)
  const userMessage = `From: ${input.from}
Subject: ${input.subject}

Body:
${truncatedBody}`

  const requestBody = {
    model: HAIKU_MODEL,
    max_tokens: 600,
    system: getInboxParserSystemPrompt(),
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
  }

  let response: Response
  try {
    response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(requestBody),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      action_type: 'unknown',
      target: 'manual:parser-network-error',
      payload: {},
      confidence: 0,
      rationale: `Anthropic API network error: ${msg}`,
      model: HAIKU_MODEL,
      error: msg,
    }
  }

  if (!response.ok) {
    const text = await response.text()
    return {
      action_type: 'unknown',
      target: 'manual:parser-api-error',
      payload: {},
      confidence: 0,
      rationale: `Anthropic API returned ${response.status}: ${text.slice(0, 200)}`,
      model: HAIKU_MODEL,
      error: `HTTP ${response.status}`,
    }
  }

  const data = (await response.json()) as AnthropicResponse
  const textBlock = data.content.find((b) => b.type === 'text')?.text ?? ''

  // Strip optional markdown code fences (Haiku occasionally wraps in ```json).
  const cleaned = textBlock
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return {
      action_type: 'unknown',
      target: 'manual:parser-json-error',
      payload: { raw_response: textBlock },
      confidence: 0,
      rationale: `Parser returned non-JSON output.`,
      model: HAIKU_MODEL,
      raw_response: textBlock,
      error: 'JSON parse error',
    }
  }

  const action_type = typeof parsed.action_type === 'string' ? parsed.action_type : 'unknown'
  const target = typeof parsed.target === 'string' ? parsed.target : 'manual:no-target'
  const payload = (parsed.payload && typeof parsed.payload === 'object')
    ? parsed.payload as Record<string, unknown>
    : {}
  const rawConfidence = Number(parsed.confidence)
  const confidence = Number.isFinite(rawConfidence) ? Math.max(0, Math.min(1, rawConfidence)) : 0
  const rationale = typeof parsed.rationale === 'string' ? parsed.rationale : ''

  // If the parser emitted an action_type not in the registry, downgrade to
  // 'unknown' so the dispatcher routes for manual triage.
  const isValid = action_type === 'unknown' || VALID_ACTION_TYPES.includes(action_type as ValidActionType)
  const finalActionType = isValid ? action_type : 'unknown'
  const finalRationale = isValid
    ? rationale
    : `${rationale} (Parser emitted action_type '${action_type}' which is not in the producer registry; downgraded to 'unknown'.)`

  return {
    action_type: finalActionType,
    target,
    payload,
    confidence: isValid ? confidence : Math.min(confidence, 0.4),
    rationale: finalRationale,
    model: HAIKU_MODEL,
  }
}
