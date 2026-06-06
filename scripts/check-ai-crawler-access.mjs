#!/usr/bin/env node
/**
 * check-ai-crawler-access.mjs — CI gate G39: AI crawlers stay allowed + llms.txt stays served.
 *
 * The site's single biggest forward-looking strength is that it is fully open to
 * AI citation crawlers (robots.ts allows the full bot roster) and ships a
 * Markdown content map at /llms.txt. Nothing mechanically protects that today —
 * a careless edit to robots.ts (or deleting the llms.txt route) would silently
 * make Ryan Realty invisible to ChatGPT search, Perplexity, Claude, and Google
 * AI Overviews with zero build error. As AI search becomes the discovery layer,
 * that regression would be expensive and invisible. So we gate it.
 *
 * Asserts:
 *   1. app/robots.ts still lists every required citation/answer bot.
 *   2. robots.ts allows content crawling ('/' is Allowed, not blanket-Disallowed).
 *   3. app/llms.txt/route.ts still exists (the /llms.txt content map is served).
 *
 * Run: node scripts/check-ai-crawler-access.mjs   (wired into ci:gates)
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ROBOTS = join(ROOT, 'app/robots.ts')
const LLMS = join(ROOT, 'app/llms.txt/route.ts')

// The bots that actually drive AI citations + AI Overviews. Removing any of
// these (or Disallowing it) is what we're guarding against.
const REQUIRED_BOTS = [
  'GPTBot', // OpenAI model + answer crawler
  'OAI-SearchBot', // ChatGPT search citations
  'ChatGPT-User', // ChatGPT user-triggered browsing
  'ClaudeBot', // Anthropic crawler
  'Claude-SearchBot', // Claude search citations
  'PerplexityBot', // Perplexity index
  'Google-Extended', // Google AI / Gemini training + grounding
  'Applebot', // Siri / Apple Intelligence
  'Googlebot', // crawls for Google AI Overviews
  'Bingbot', // crawls for Bing Copilot
]

const errors = []

if (!existsSync(ROBOTS)) {
  errors.push('app/robots.ts is missing — AI crawlers have no allow policy at all.')
} else {
  const robots = readFileSync(ROBOTS, 'utf8')
  for (const bot of REQUIRED_BOTS) {
    if (!robots.includes(bot)) {
      errors.push(`robots.ts no longer references citation bot "${bot}" — it must stay allowed for AI search to cite us.`)
    }
  }
  // Content must be crawlable: an Allow of '/' must be present. (The wildcard
  // rule allows '/' today; this catches a future edit that drops it or replaces
  // it with a blanket Disallow.)
  if (!/allow:\s*\[?\s*['"`]\/['"`]/.test(robots)) {
    errors.push("robots.ts no longer Allows '/' — the site would stop being crawlable for AI + search.")
  }
}

if (!existsSync(LLMS)) {
  errors.push('app/llms.txt/route.ts is missing — /llms.txt (the AI content map) is no longer served.')
}

if (errors.length === 0) {
  console.log(`AI-crawler-access gate passed — ${REQUIRED_BOTS.length} citation bots allowed, content crawlable, /llms.txt served.`)
  process.exit(0)
}

console.error('\nAI-crawler-access gate FAILED — AI-search visibility is at risk:')
for (const e of errors) console.error('  - ' + e)
console.error('\nThis protects the site\'s biggest AI-exposure strength. If a bot was intentionally')
console.error('removed, update REQUIRED_BOTS in scripts/check-ai-crawler-access.mjs with the reason.')
process.exit(1)
