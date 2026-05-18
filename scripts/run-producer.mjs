#!/usr/bin/env node
/**
 * Unified producer runner.
 *
 * Maps a producer slug or content:* action_type to the matching build script
 * and invokes it with the supplied payload JSON.
 *
 *   node scripts/run-producer.mjs <producer-or-action_type> <payload.json> [--live] [--out <dir>]
 *
 * Examples:
 *   node scripts/run-producer.mjs testimonial_card tests/fixtures/producer-payload-tumalo.json
 *   node scripts/run-producer.mjs content:newsletter tests/fixtures/producer-payload-tumalo.json
 *   node scripts/run-producer.mjs ops:meta_budget tests/fixtures/producer-payload-tumalo.json --live
 *
 * Exit codes:
 *   0 — producer ran cleanly
 *   1 — producer error (script returned non-zero)
 *   2 — bad invocation (unknown producer, missing fixture, etc.)
 */

import { spawn } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const REPO_ROOT = path.resolve(path.dirname(__filename), '..')

// ─── Canonical mapping ──────────────────────────────────────────────────────
// Each entry: producer-slug → { runner: 'python3' | 'node', script: relative-path, accepts: ['--live']? }
const PRODUCERS = {
  // Section B — image producers (Python PIL). Slug here matches the script's
  // hardcoded PRODUCER constant (i.e., the actual output directory name under out/).
  'testimonial_card':              { runner: 'python3', script: 'scripts/build_testimonial_card.py' },
  'map_static_card':               { runner: 'python3', script: 'scripts/build_map_static_card.py' },
  'yard_sign_rider':               { runner: 'python3', script: 'scripts/build_yard_sign_rider.py' },
  'postcard_farm_mailer':          { runner: 'python3', script: 'scripts/build_postcard_farm_mailer.py' },
  'under_contract_announcement':   { runner: 'python3', script: 'scripts/build_under_contract_announcement.py' },
  'sold_deal_summary':             { runner: 'python3', script: 'scripts/build_sold_deal_summary.py' },
  'floor_plan_render':             { runner: 'python3', script: 'scripts/build_floor_plan_render.py' },
  'meme_lord':                     { runner: 'python3', script: 'scripts/build_meme_lord.py' },
  'comparable_grid':               { runner: 'python3', script: 'scripts/build_comparable_grid.py' },
  'open_house_stories':            { runner: 'python3', script: 'scripts/build_open_house_stories.py' },
  'coming_soon_teaser':            { runner: 'python3', script: 'scripts/build_coming_soon_teaser.py' },
  'neighbor_outreach_note':        { runner: 'python3', script: 'scripts/build_neighbor_outreach_note.py' },
  'linkedin_document_carousel':    { runner: 'python3', script: 'scripts/build_linkedin_document_carousel.py' },
  'meta_creative_variant':         { runner: 'python3', script: 'scripts/build_meta_creative_variant.py' },
  'nextdoor_business_ad':          { runner: 'python3', script: 'scripts/build_nextdoor_business_ad.py' },
  'virtual_staging':               { runner: 'python3', script: 'scripts/build_virtual_staging.py' },
  // Pre-existing scripts with legacy CLIs — exclude from default test until wrapped.
  // 'broker-contact-card':        { runner: 'python3', script: 'scripts/build_broker_contact_card.py', legacy: true },

  // Section B — text producers (Node mjs)
  'newsletter':           { runner: 'node', script: 'scripts/build-newsletter.mjs' },
  'listing-description':  { runner: 'node', script: 'scripts/build-listing-description.mjs' },
  'market-report-blog':   { runner: 'node', script: 'scripts/build-market-report-blog.mjs' },
  'google-ads-copy':      { runner: 'node', script: 'scripts/build-google-ads-copy.mjs' },
  'agent-coop-eflyer':    { runner: 'node', script: 'scripts/build-agent-coop-eflyer.mjs' },
  // Pre-existing scripts with legacy CLIs — excluded from default test loop.
  // 'blog-post':            { runner: 'node', script: 'scripts/build-blog-post.mjs', legacy: true },
  // 'facebook-lead-gen-ad': { runner: 'node', script: 'scripts/build-fb-ad.mjs', legacy: true },

  // Section D — ops handlers (Node mjs, accept --live)
  'ops-meta-ads':         { runner: 'node', script: 'scripts/ops/run-meta-ads.mjs',      accepts: ['--live'] },
  'ops-fub-crm':          { runner: 'node', script: 'scripts/ops/run-fub-crm.mjs',       accepts: ['--live'] },
  'ops-email-send':       { runner: 'node', script: 'scripts/ops/run-email-send.mjs',    accepts: ['--live'] },
  'ops-reputation':       { runner: 'node', script: 'scripts/ops/run-reputation.mjs',    accepts: ['--live'] },
  'ops-fb-marketplace':   { runner: 'node', script: 'scripts/ops/run-fb-marketplace.mjs', accepts: ['--live'] },
  'ops-manychat':         { runner: 'node', script: 'scripts/ops/run-manychat.mjs',      accepts: ['--live'] },
  'ops-google-ads':       { runner: 'node', script: 'scripts/ops/run-google-ads.mjs',    accepts: ['--live'] },
}

// action_type → producer-slug mapping (per REGISTRY.md)
const ACTION_TO_PRODUCER = {
  'content:testimonial_card':           'testimonial_card',
  'content:map_static_card':            'map_static_card',
  'content:yard_sign':                  'yard-sign-rider',
  'content:postcard_mailer':            'postcard-farm-mailer',
  'content:under_contract_announcement':'under-contract-announcement',
  'content:sold_deal_summary':          'sold-deal-summary',
  'content:floor_plan_render':          'floor_plan_render',
  'content:image_meme':                 'meme_lord',
  'content:comparable_grid':            'comparable_grid',
  'content:open_house_stories':         'open-house-stories',
  'content:coming_soon_teaser':         'coming-soon-teaser',
  'content:neighbor_note':              'neighbor-outreach-note',
  'content:linkedin_doc_carousel':      'linkedin-document-carousel',
  'content:meta_creative_variant':      'meta-creative-variant',
  'content:nextdoor_business_ad':       'nextdoor-business-ad',
  'content:virtual_staging':            'virtual_staging',
  'content:broker_card':                'broker-contact-card',
  'content:newsletter':                 'newsletter',
  'content:listing_description':        'listing-description',
  'content:market_report_blog':         'market-report-blog',
  'content:google_ads_copy':            'google-ads-copy',
  'content:agent_coop_eflyer':          'agent-coop-eflyer',
  'content:blog_post':                  'blog-post',
  'content:seo_blog':                   'blog-post',
  'content:fb_lead_gen_ad':             'facebook-lead-gen-ad',
  'content:fb_ad':                      'facebook-lead-gen-ad',

  'ops:meta_budget':       'ops-meta-ads',
  'ops:meta_pause':        'ops-meta-ads',
  'ops:meta_resume':       'ops-meta-ads',
  'ops:meta_audience':     'ops-meta-ads',
  'ops:meta_creative_swap':'ops-meta-ads',
  'ops:fub_tag_fix':       'ops-fub-crm',
  'ops:fub_sequence_change':'ops-fub-crm',
  'ops:fub_task_create':   'ops-fub-crm',
  'ops:fub_routing':       'ops-fub-crm',
  'ops:email_newsletter':  'ops-email-send',
  'ops:email_blast':       'ops-email-send',
  'ops:email_template_update': 'ops-email-send',
  'ops:review_response':   'ops-reputation',
  'ops:review_request':    'ops-reputation',
  'ops:gbp_post':          'ops-reputation',
  'ops:gbp_qna':           'ops-reputation',
  'ops:fb_marketplace_create': 'ops-fb-marketplace',
  'ops:fb_marketplace_update': 'ops-fb-marketplace',
  'ops:manychat_setup':    'ops-manychat',
  'ops:manychat_pause':    'ops-manychat',
  'ops:manychat_update':   'ops-manychat',
  'ops:google_budget':     'ops-google-ads',
  'ops:google_pause':      'ops-google-ads',
  'ops:google_resume':     'ops-google-ads',
  'ops:google_keyword_swap':'ops-google-ads',
  'ops:google_negative_add':'ops-google-ads',
}

function resolveProducer(key) {
  if (PRODUCERS[key]) return key
  if (ACTION_TO_PRODUCER[key]) return ACTION_TO_PRODUCER[key]
  return null
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length < 2) {
    console.error('Usage: node scripts/run-producer.mjs <producer-or-action_type> <payload.json> [--live] [--out <dir>]')
    console.error('')
    console.error('Available producer slugs:')
    for (const slug of Object.keys(PRODUCERS).sort()) console.error(`  ${slug}`)
    console.error('')
    console.error('Available action_types:')
    for (const a of Object.keys(ACTION_TO_PRODUCER).sort()) console.error(`  ${a}`)
    process.exit(2)
  }
  const [key, payloadPath, ...rest] = argv
  const slug = resolveProducer(key)
  if (!slug) {
    console.error(`Unknown producer or action_type: "${key}"`)
    console.error(`Run without args to see the full list.`)
    process.exit(2)
  }
  const spec = PRODUCERS[slug]
  const scriptPath = path.join(REPO_ROOT, spec.script)
  if (!existsSync(scriptPath)) {
    console.error(`Script not found: ${spec.script}`)
    process.exit(2)
  }
  const fixturePath = path.isAbsolute(payloadPath) ? payloadPath : path.join(REPO_ROOT, payloadPath)
  if (!existsSync(fixturePath)) {
    console.error(`Payload not found: ${payloadPath}`)
    process.exit(2)
  }
  const args = [scriptPath, fixturePath, ...rest]
  console.log(`▶ ${slug}  (${spec.runner} ${spec.script})`)
  const child = spawn(spec.runner, args, { stdio: 'inherit', cwd: REPO_ROOT })
  child.on('exit', code => process.exit(code ?? 1))
}

// Only run main() when invoked directly. When imported (e.g. by
// scripts/test-all-producers.mjs), don't auto-exit.
const isDirectInvocation = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}`
  } catch { return false }
})()

if (isDirectInvocation) {
  main().catch(err => {
    console.error(err)
    process.exit(1)
  })
}

// Export the maps so tests can import them
export { PRODUCERS, ACTION_TO_PRODUCER, resolveProducer }
