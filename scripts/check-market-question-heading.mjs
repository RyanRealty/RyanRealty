#!/usr/bin/env node
/**
 * The market question, on every place grain (Matt, 2026-08-26).
 *
 * THE RULE. Every place grain that renders the market HUD/Instrument renders
 * the question a reader actually types — `Is {place} a buyer's or seller's
 * market?` — with the live verdict as the answer beneath it. Audit item 10
 * (2026-08-02) put the question on all five place grains; the 2026-08-26 v3
 * rebuild of /zip/[zip] dropped it on one grain and kept it on the other four,
 * so the site disagreed with itself. Matt ruled the same day: the question
 * stays on ALL FIVE. This gate makes the family consistency mechanical so a
 * future per-route rebuild cannot silently drop it on one grain again.
 *
 * WHAT COUNTS AS RENDERING THE QUESTION, per grain (comment-stripped source):
 *   a. KB idiom — the page mounts `<KbMarketHud … geoName={…}>`. The component
 *      templates the question as the section heading whenever a verdict exists;
 *      a separate check below pins that template inside the component, so
 *      gutting KbMarketHud fails here too.
 *   b. v3 idiom — the page (or a route-local _v3 module) templates the literal
 *      question itself, e.g. as the market Instrument's headline (the ZIP
 *      page) or a section heading.
 *   c. FAQ idiom — the page builds `buildMarketFaq(…)` and renders its items
 *      visibly: either `buildFaqItems(faqs…)` (housing-market geo) or
 *      `faqs.map(` into a V3Quiet (neighborhood face is count + median, so
 *      the question lives in the FAQ, not the Instrument headline). The
 *      template is pinned inside lib/site/market-faq.ts below.
 *
 * FALSIFIED both ways on 2026-08-26: removing the question template from
 * app/zip/[zip]/page.tsx fails the zip row; restoring it passes.
 *
 *   node scripts/check-market-question-heading.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

/**
 * Line comments BEFORE block comments, `://` preserved (URLs). A question that
 * survives only in a comment is not rendered, and this file's own headers
 * would otherwise satisfy every check (migration recipe §5.3).
 */
const stripComments = (text) =>
  text.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '')

/** The established site copy, straight or typographic apostrophes. */
const QUESTION = /Is [^\n]{0,120}buyer(?:'|’|&rsquo;)s or seller(?:'|’|&rsquo;)s market\?/

/** Every parsable file in a route-local directory (no recursion needed today). */
function routeLocalSources(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f))
    .map((f) => stripComments(src(join(dir, f))))
}

// ── The templates themselves, pinned where the idioms point ────────────────
// KbMarketHud was deleted with its last consumer (app/page.tsx, 2026-08-27 v3
// rebuild), so the KB template pin died with it. Every grain now renders the
// question through the v3 idiom (the Instrument headline) or the FAQ idiom,
// both templated by buildMarketFaq — pinned below. If KbMarketHud returns, its
// kbIdiom arm still works and this pin must return with it.

const faq = stripComments(src('lib/site/market-faq.ts'))
checks.push({
  label: 'buildMarketFaq templates the same question for the FAQ surfaces',
  ok: faq.includes("`Is ${geoName} a buyer's or seller's market?`"),
})

// ── The five place grains ──────────────────────────────────────────────────
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

  const kbIdiom = /<KbMarketHud[\s\S]{0,400}?geoName=/.test(pageText)
  const v3Idiom = everywhere.some((t) => QUESTION.test(t))
  const faqIdiom =
    pageText.includes('buildMarketFaq(') &&
    everywhere.some((t) => /buildFaqItems\(\s*faqs/.test(t) || /faqs\.map\(/.test(t))

  checks.push({
    label: `${grain} grain (${page}) renders the market question`,
    ok: kbIdiom || v3Idiom || faqIdiom,
  })
}

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(
    `\nmarket-question: ${failed.length} check(s) failed. The question heading ` +
      `"Is {place} a buyer's or seller's market?" stays on all five place grains ` +
      `(Matt, 2026-08-26) — render it via KbMarketHud geoName, a v3 headline, or the ` +
      `visible market FAQ; never drop it on one grain.`,
  )
  process.exit(1)
}
console.log(`\nmarket-question: ${checks.length}/${checks.length}`)
