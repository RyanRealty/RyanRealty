#!/usr/bin/env node
/**
 * Public place grains print a one-line supply verdict.
 * Banned on the face: `Is {place} a buyer's or seller's market?`
 *
 *   node scripts/check-market-question-heading.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const stripComments = (text) =>
  text.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '')

/** The banned shopper-facing question, straight or typographic apostrophes. */
const QUESTION = /Is [^\n]{0,120}buyer(?:'|’|&rsquo;)s or seller(?:'|’|&rsquo;)s market\?/

function routeLocalSources(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f))
    .map((f) => stripComments(src(join(dir, f))))
}

const faq = stripComments(src('lib/site/market-faq.ts'))
checks.push({
  label: 'buildMarketFaq prints a one-line supply verdict, not the banned question',
  ok: faq.includes('publicSupplyVerdictLine(') && !QUESTION.test(faq),
})

const classify = stripComments(src('lib/market/classify.ts'))
checks.push({
  label: 'publicSupplyVerdictLine is the one-line verdict helper',
  ok: classify.includes('export function publicSupplyVerdictLine'),
})

const GRAINS = [
  { grain: 'city', page: 'app/cities/[slug]/page.tsx', local: 'app/cities/[slug]/_v3' },
  {
    grain: 'neighborhood',
    page: 'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
    local: 'app/cities/[slug]/[neighborhoodSlug]/_v3',
  },
  { grain: 'community', page: 'app/communities/[slug]/page.tsx', local: 'app/communities/[slug]/_v3' },
  { grain: 'zip', page: 'app/zip/[zip]/page.tsx', local: 'app/zip/[zip]/_v3' },
  {
    grain: 'housing-market geo',
    page: 'app/housing-market/[...slug]/page.tsx',
    local: 'app/housing-market/[...slug]/_v3',
  },
]

for (const { grain, page, local } of GRAINS) {
  const pageText = stripComments(src(page))
  const localTexts = routeLocalSources(local)
  const everywhere = [pageText, ...localTexts]
  const banned = everywhere.some((t) => QUESTION.test(t))
  const verdict =
    everywhere.some((t) => t.includes('publicSupplyVerdictLine(')) ||
    (pageText.includes('buildMarketFaq(') && everywhere.some((t) => /buildFaqItems\(\s*faqs/.test(t)))

  checks.push({
    label: `${grain} grain (${page}) prints a one-line supply verdict, not the banned question`,
    ok: !banned && verdict,
  })
}

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(
    `\nmarket-question: ${failed.length} check(s) failed. Public place grains ` +
      `print a one-line supply verdict via publicSupplyVerdictLine or the visible ` +
      `market FAQ. Never print "Is {place} a buyer's or seller's market?"`,
  )
  process.exit(1)
}
console.log(`\nmarket-question: ${checks.length}/${checks.length}`)
