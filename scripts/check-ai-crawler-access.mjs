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
 *   4. middleware.ts GOOD_BOT_RE matches every explicit robots.ts userAgent
 *      (SITE-174). A robots Allow that the geo screen 403s is decorative.
 *
 * Run: node scripts/check-ai-crawler-access.mjs   (wired into ci:gates)
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ROBOTS = join(ROOT, 'app/robots.ts')
const MIDDLEWARE = join(ROOT, 'middleware.ts')
const LLMS = join(ROOT, 'app/llms.txt/route.ts')
const LLMS_GEO = join(ROOT, 'lib/site/llms-geo.ts')
const QUERY_MAP = join(ROOT, 'lib/seo/ai-query-map.json')

// The bots that actually drive AI citations + AI Overviews. Removing any of
// these (or Disallowing it) is what we're guarding against.
const REQUIRED_BOTS = [
  'GPTBot', // OpenAI model + answer crawler
  'OAI-SearchBot', // ChatGPT search citations
  'ChatGPT-User', // ChatGPT user-triggered browsing
  'ClaudeBot', // Anthropic crawler
  'Claude-SearchBot', // Claude search citations
  'Claude-User', // Claude user-initiated fetch
  'PerplexityBot', // Perplexity index
  'Perplexity-User', // Perplexity user-triggered fetch (not a substring of PerplexityBot)
  'Google-Extended', // Google AI / Gemini training + grounding
  'Applebot', // Siri / Apple Intelligence
  'YouBot', // You.com AI search
  'meta-externalagent', // Meta AI search — Singapore egress
  'Amazonbot', // Amazon / Alexa AI — Singapore egress
  'Googlebot', // crawls for Google AI Overviews
  'Bingbot', // crawls for Bing Copilot
]

// Accept (SITE-174): these UAs from a blocked country must not be geo-403'd.
// Middleware allows GOOD_BOT_RE first; without a match they fall through to CN/HK/RU/SG.
const GEO_BYPASS_UAS = ['Perplexity-User', 'YouBot', 'meta-externalagent', 'Amazonbot']

/**
 * Pull a top-level `const <name> = /regex/flags` out of a TS source file using
 * the compiler AST (same shape as scripts/check-ci-probe-ua.mjs).
 */
function regexLiteralFromTs(file, name) {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  let found = null
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      ts.isRegularExpressionLiteral(node.initializer)
    ) {
      found = node.initializer.text
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(src)
  if (!found) return null
  const lastSlash = found.lastIndexOf('/')
  return new RegExp(found.slice(1, lastSlash), found.slice(lastSlash + 1))
}

function robotsUserAgents(robotsSrc) {
  return [...robotsSrc.matchAll(/userAgent:\s*['"]([^'"]+)['"]/g)]
    .map((m) => m[1])
    .filter((agent) => agent !== '*')
}

const errors = []
const robots = existsSync(ROBOTS) ? readFileSync(ROBOTS, 'utf8') : ''

if (!robots) {
  errors.push('app/robots.ts is missing — AI crawlers have no allow policy at all.')
} else {
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

// SITE-174: robots.txt is decorative if middleware geo-403s the same bot from
// SG/CN/HK/RU. GOOD_BOT_RE must match every explicit robots allow-list agent,
// and must not share any of those agents with BAD_BOT_RE.
if (!existsSync(MIDDLEWARE)) {
  errors.push('middleware.ts is missing — the geo/bot screen that actually serves crawlers is gone.')
} else {
  const goodBotRe = regexLiteralFromTs(MIDDLEWARE, 'GOOD_BOT_RE')
  const badBotRe = regexLiteralFromTs(MIDDLEWARE, 'BAD_BOT_RE')
  if (!goodBotRe) {
    errors.push('could not read GOOD_BOT_RE from middleware.ts — ci:ai-crawler-access must parse the live allow regex.')
  }
  if (!badBotRe) {
    errors.push('could not read BAD_BOT_RE from middleware.ts — a robots-allowed bot could be 403d with no CI signal.')
  }
  const agents = robots ? robotsUserAgents(robots) : []
  if (robots && agents.length === 0) {
    errors.push('robots.ts has no explicit userAgent allow-list entries to check against GOOD_BOT_RE.')
  }
  if (goodBotRe) {
    for (const agent of agents) {
      if (!goodBotRe.test(agent)) {
        errors.push(
          `GOOD_BOT_RE does not match robots-allowed crawler "${agent}" — a request from a blocked country would be 403'd by the geo screen.`,
        )
      }
    }
    for (const ua of GEO_BYPASS_UAS) {
      if (!goodBotRe.test(ua)) {
        errors.push(
          `User-Agent "${ua}" from a blocked country (CN/HK/RU/SG) would be 403'd by the geo screen — add it to GOOD_BOT_RE.`,
        )
      }
    }
  }
  if (badBotRe) {
    for (const agent of agents) {
      if (badBotRe.test(agent)) {
        errors.push(
          `BAD_BOT_RE matches robots-allowed crawler "${agent}" — middleware would 403 a bot robots.txt invites.`,
        )
      }
    }
  }
}

// llms.txt must keep covering the high-citation-value content families. It was
// a static list until 2026-06-10, which silently omitted blog posts, market
// reports, guides, and tools — the exact content AI assistants cite. The route
// is now DAL-driven; these markers keep the families (and the dynamic wiring)
// from being dropped in a future edit.
const REQUIRED_LLMS_MARKERS = [
  { marker: '/blog', why: 'blog family (dynamic post list via getRecentBlogPosts)' },
  { marker: 'getRecentBlogPosts', why: 'dynamic blog wiring' },
  { marker: 'getPublishedGuides', why: 'guides content still listed via DAL (URLs redirect/canonical to /blog)' },
  { marker: '/housing-market/reports/', why: 'market-report detail family' },
  { marker: 'listMarketReports', why: 'dynamic reports wiring' },
  { marker: '/tools/mortgage-calculator', why: 'tools family' },
  { marker: '/open-houses', why: 'open houses' },
  { marker: '/about', why: 'brokerage identity for best-broker queries' },
  { marker: '/reviews', why: 'client reviews (no aggregateRating)' },
  { marker: '/sell/valuation', why: 'written CMA door' },
  { marker: 'Value my home', why: 'D11 valuation label on the citable map' },
  { marker: 'northwest-crossing', why: 'Northwest Crossing community + filtered inventory' },
  { marker: 'beds=3', why: '3-bed/2-bath filtered inventory citation' },
  { marker: 'ai-query-map.json', why: 'F1 query map wired into llms.txt pillars' },
  { marker: '/zip/97703', why: 'canonical ZIP pages on the AI map (parity with sitemap geo)' },
  { marker: 'zipLlmsLines', why: 'ZIP lines from the shared llms-geo helper' },
  { marker: '/new-construction', why: 'Bend new-construction inventory' },
  { marker: '/housing-market/bend', why: 'city housing-market pages (not only weekly reports)' },
]

if (!existsSync(LLMS)) {
  errors.push('app/llms.txt/route.ts is missing — /llms.txt (the AI content map) is no longer served.')
} else {
  const mapSrc = existsSync(QUERY_MAP) ? readFileSync(QUERY_MAP, 'utf8') : ''
  const geoSrc = existsSync(LLMS_GEO) ? readFileSync(LLMS_GEO, 'utf8') : ''
  const llms = `${readFileSync(LLMS, 'utf8')}\n${mapSrc}\n${geoSrc}`
  for (const { marker, why } of REQUIRED_LLMS_MARKERS) {
    if (!llms.includes(marker)) {
      errors.push(`llms.txt route no longer references "${marker}" (${why}) — AI assistants lose discovery of that family.`)
    }
  }
  const stripped = readFileSync(LLMS, 'utf8').replaceAll('${SITE_URL}/housing-market/reports', '')
  if (stripped.includes('${SITE_URL}/reports')) {
    errors.push('llms.txt cites ${SITE_URL}/reports (308 hop to /housing-market/reports). Cite the survivor.')
  }
  if (/\$\{SITE_URL\}\/lp\//.test(readFileSync(LLMS, 'utf8'))) {
    errors.push('llms.txt cites ${SITE_URL}/lp/ (noindex paid-arrival). Cite organic survivors such as /central-oregon/golf/{slug}.')
  }
}

if (errors.length === 0) {
  console.log(
    `AI-crawler-access gate passed — ${REQUIRED_BOTS.length} citation bots allowed, GOOD_BOT_RE matches robots allow-list, content crawlable, /llms.txt served.`,
  )
  process.exit(0)
}

console.error('\nAI-crawler-access gate FAILED — AI-search visibility is at risk:')
for (const e of errors) console.error('  - ' + e)
console.error('\nThis protects the site\'s biggest AI-exposure strength. If a bot was intentionally')
console.error('removed, update REQUIRED_BOTS in scripts/check-ai-crawler-access.mjs with the reason.')
process.exit(1)
