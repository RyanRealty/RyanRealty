#!/usr/bin/env node
/**
 * Smoke-test the inbox parser against Anthropic Haiku with a handful of
 * realistic email scenarios. No Supabase write, no Gmail call. Just prove
 * the parser returns valid action_types with reasonable confidence.
 *
 * Usage: node --env-file=.env.local scripts/marketing-inbox-smoke-parser.mjs
 */

import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

// Import the compiled parser via tsx if needed; here we re-implement the
// HTTP call with the same prompt + valid action types to avoid a build step.

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

// Synced with lib/marketing-brain/inbox-parser.ts VALID_ACTION_TYPES
const VALID = [
  'content:list_kit','content:listing_launch','content:monthly_market_report',
  'content:listing_video','content:listing_reel','content:market_video',
  'content:market_data_short','content:market_data_viz','content:market_youtube_longform',
  'content:market_stat_card_video','content:news_clip','content:news_video',
  'content:neighborhood_tour','content:neighborhood_reel','content:area_guide_short',
  'content:area_guide_long','content:blog_post','content:seo_blog',
  'content:fb_lead_gen_ad','content:fb_ad','content:flyer',
  'content:just_listed_flyer','content:open_house_flyer','content:feature_sheet',
  'content:ig_carousel','content:ig_single_post','content:image_meme',
  'content:meme_video','content:avatar_market_update','content:avatar_video',
  'content:earth_zoom','content:aerial_flyover','content:tiktok_listing_tour',
  'content:yt_longform_walkthrough','content:coming_soon_teaser',
  'content:open_house_stories','content:under_contract_announcement',
  'content:sold_deal_summary','content:linkedin_doc_carousel',
  'content:agent_coop_eflyer','content:postcard_mailer','content:yard_sign',
  'content:neighbor_note','content:social_calendar','content:stats_clip',
  'site:copy_update','site:meta_update','site:cta_update','site:page_create',
  'site:landing_page_create','site:perf_fix','site:redirect_add','site:schema_add',
  'site:property_landing_create','site:property_landing_update','site:matterport_embed',
  'ops:meta_budget','ops:meta_pause','ops:meta_resume','ops:meta_audience',
  'ops:meta_creative_swap','ops:fub_tag_fix','ops:fub_sequence_change',
  'ops:fub_task_create','ops:fub_routing','ops:email_newsletter','ops:email_blast',
  'ops:email_template_update','ops:review_response','ops:review_request',
  'ops:gbp_post','ops:gbp_qna','ops:fb_marketplace_create','ops:fb_marketplace_update',
  'ops:manychat_setup','ops:manychat_pause','ops:manychat_update',
  'analyze:drop_investigation','analyze:spike_investigation','analyze:metric_decomposition',
  'analyze:ab_test_design','analyze:ab_test_readout',
  'comms:matt_alert','comms:matt_summary','comms:team_update','comms:stakeholder_summary',
]

const SYSTEM_PROMPT = `You are the inbox parser for the Ryan Realty marketing brain. Real estate broker (Ryan Realty, Bend, Oregon) sends an email to marketing@ryan-realty.com asking for a specific marketing deliverable. Your job is to convert that natural-language request into a structured action row the brain's producers can execute.

Output a SINGLE JSON object with these fields and nothing else:

{
  "action_type": "<one of the valid action_types below, or 'unknown'>",
  "target": "<subject of the action — see target formats below>",
  "payload": { ... },
  "confidence": <number between 0.0 and 1.0>,
  "rationale": "<one short sentence explaining the choice>"
}

VALID action_types (use EXACTLY one of these, or 'unknown' if no match):
${VALID.map((t) => `  - ${t}`).join('\n')}

TARGET formats:
  - Listings: 'mls:<MlsId>' (e.g. 'mls:220189422')
  - City/market: 'city:<CityName>' (e.g. 'city:Bend')
  - Neighborhood: 'neighborhood:<name>' (e.g. 'neighborhood:Awbrey Butte')
  - Website page: page path (e.g. '/listings', '/')
  - News topic: 'topic:<slug>' (e.g. 'topic:wildfire-risk-2026')
  - Email segment: 'segment:<name>' or 'contact:<email>'
  - Ad campaign: 'campaign:<id>'
  - Anything else: 'manual:<slug-derived-from-request>'

PAYLOAD: include every specific detail the sender gave that the producer needs to execute.

CONFIDENCE GUIDANCE:
  - 0.9+ : Sender explicitly named the deliverable and the target
  - 0.7–0.9 : Clear deliverable but target inferred
  - 0.5–0.7 : Ambiguous; pick the most likely
  - <0.5 : Unclear what the sender wants — use 'unknown' for action_type

RULES:
  - Output JSON only. No prose. No markdown fences.
  - If conversational ("any update?"), mark action_type='unknown'.
  - Never invent an address or MLS number.`

async function callHaiku(from, subject, body) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing')

  const userMessage = `From: ${from}\nSubject: ${subject}\n\nBody:\n${body.slice(0, 2000)}`

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const textBlock = data.content.find((b) => b.type === 'text')?.text ?? ''
  const cleaned = textBlock
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  return JSON.parse(cleaned)
}

const SCENARIOS = [
  {
    name: 'Listing reel — explicit MLS',
    from: 'matt@ryan-realty.com',
    subject: 'New listing reel needed',
    body: 'Hey — please make a listing reel for MLS 220189422. New on the market today. Thanks.',
    expect: { action_type: 'content:listing_reel', target: 'mls:220189422', min_confidence: 0.85 },
  },
  {
    name: 'Listing reel — address only',
    from: 'matt@ryan-realty.com',
    subject: 'Reel for new listing',
    body: 'Can you make a listing reel for 19496 Tumalo Reservoir Rd? Coming on the market this week.',
    expect: { action_type: 'content:listing_reel', target_prefix: 'manual:', min_confidence: 0.7 },
  },
  {
    name: 'Market report video',
    from: 'matt@ryan-realty.com',
    subject: 'Bend market video please',
    body: 'Run the monthly market report for Bend.',
    expect: { action_type_options: ['content:monthly_market_report', 'content:market_video', 'content:market_data_short'], target: 'city:Bend', min_confidence: 0.7 },
  },
  {
    name: 'Conversational, no deliverable',
    from: 'matt@ryan-realty.com',
    subject: 'Quick check-in',
    body: 'Hey, just checking in. Any update on the Tumalo reel? No rush.',
    expect: { action_type: 'unknown', min_confidence: 0 },
  },
  {
    name: 'Blog post request',
    from: 'matt@ryan-realty.com',
    subject: 'New blog needed',
    body: 'Please write a blog post about the rising days on market in Sunriver this spring.',
    expect: { action_type_options: ['content:blog_post', 'content:seo_blog'], target_prefix: 'topic:', min_confidence: 0.7 },
  },
  {
    name: 'Site copy update',
    from: 'matt@ryan-realty.com',
    subject: 'Home page hero copy',
    body: 'Can you update the hero copy on the home page to say "Bend Oregon brokers"? Just that sentence.',
    expect: { action_type: 'site:copy_update', target: '/', min_confidence: 0.7 },
  },
]

async function main() {
  let pass = 0
  let fail = 0
  for (const s of SCENARIOS) {
    try {
      const out = await callHaiku(s.from, s.subject, s.body)
      const passes = checkExpectation(out, s.expect)
      if (passes.ok) {
        console.log(`\n[PASS] ${s.name}`)
        pass++
      } else {
        console.log(`\n[FAIL] ${s.name} — ${passes.reason}`)
        fail++
      }
      console.log('  parser →', JSON.stringify(out, null, 2).split('\n').join('\n  '))
    } catch (e) {
      console.log(`\n[ERROR] ${s.name} — ${e?.message || e}`)
      fail++
    }
    // Soft pause to avoid burst rate-limit
    await new Promise((r) => setTimeout(r, 250))
  }
  console.log(`\n--- Summary: ${pass} passed, ${fail} failed ---`)
  process.exit(fail === 0 ? 0 : 1)
}

function checkExpectation(out, expect) {
  if (expect.action_type && out.action_type !== expect.action_type) {
    return { ok: false, reason: `expected action_type=${expect.action_type}, got ${out.action_type}` }
  }
  if (expect.action_type_options && !expect.action_type_options.includes(out.action_type)) {
    return { ok: false, reason: `expected action_type in [${expect.action_type_options.join(', ')}], got ${out.action_type}` }
  }
  if (expect.target && out.target !== expect.target) {
    return { ok: false, reason: `expected target=${expect.target}, got ${out.target}` }
  }
  if (expect.target_prefix && !String(out.target ?? '').startsWith(expect.target_prefix)) {
    return { ok: false, reason: `expected target startsWith ${expect.target_prefix}, got ${out.target}` }
  }
  if (typeof out.confidence !== 'number') {
    return { ok: false, reason: `confidence is not a number: ${out.confidence}` }
  }
  if (expect.min_confidence !== undefined && out.confidence < expect.min_confidence) {
    return { ok: false, reason: `confidence ${out.confidence} below min ${expect.min_confidence}` }
  }
  return { ok: true }
}

main().catch((e) => {
  console.error('Fatal:', e?.message || e)
  process.exit(1)
})
