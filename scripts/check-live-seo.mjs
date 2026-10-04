#!/usr/bin/env node
/**
 * check-live-seo.mjs — `npm run seo:live`: the SEO baseline against the LIVE
 * site (rules and rationale in scripts/lib/live-seo-audit.mjs). Also runs at
 * the end of `npm run deploy:verify`, so every production deploy is checked.
 *
 *   npm run seo:live                         # https://ryan-realty.com
 *   npm run seo:live -- --base https://x.y   # another host
 *   LIVE_SEO_PER_SITEMAP=20 npm run seo:live # bigger sample
 */
import { LIVE_SEO_UA, runLiveSeoAudit } from './lib/live-seo-audit.mjs'

const argv = process.argv.slice(2)
const baseIdx = argv.indexOf('--base')
const base = baseIdx >= 0 ? argv[baseIdx + 1] : 'https://ryan-realty.com'
const perSitemap = Number(process.env.LIVE_SEO_PER_SITEMAP ?? 8)

const { fails, warns, lines } = await runLiveSeoAudit(base, { ua: LIVE_SEO_UA, perSitemap })
for (const l of lines) console.log(`live seo: ${l}`)
for (const w of warns) console.log(`live seo: warn · ${w}`)
if (fails.length > 0) {
  console.error(`✗ LIVE SEO FAILED (${fails.length}):`)
  for (const f of fails) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('✓ live seo: robots, sitemaps and sampled pages meet the SEO baseline')
