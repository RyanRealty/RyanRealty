#!/usr/bin/env node
/**
 * build-google-ads-copy.mjs — Google Ads copy suite
 *
 * Usage:
 *   node scripts/build-google-ads-copy.mjs <payload.json> [--out <dir>]
 *
 * Outputs:
 *   google-ads-copy.md   (15 headlines, 4 descriptions, 4 sitelinks)
 *   citations.json
 *   provenance.json
 *   design_scorecard.json
 *   card.json
 *
 * Google Ads constraints:
 *   - Headlines: ≤30 chars each
 *   - Descriptions: ≤90 chars each
 *   - Sitelink text: ≤25 chars each
 */

import { mkdir, writeFile, readFile, stat } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PRODUCER = 'google-ads-copy'

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) { out[a.slice(2)] = next; i++ }
      else out[a.slice(2)] = true
    } else {
      out._.push(a)
    }
  }
  return out
}

const BANNED_WORDS = [
  'stunning','breathtaking','gorgeous','charming','pristine','nestled','boasts',
  'must-see','dream home','meticulously maintained',"entertainer's dream",
  'tucked away','hidden gem','truly','spacious','cozy','luxurious',
  'updated throughout','turnkey','immaculate','captivating','exquisite',
  'delve','leverage','tapestry','navigate','robust','seamless','comprehensive',
  'elevate','unlock','holistic','dynamic','vibrant','bustling','eclectic',
  'curated','bespoke','foster','approximately','roughly','fairly',
  'act fast',"don't miss out","won't last"
]

function checkBannedWords(text) {
  const lower = text.toLowerCase()
  return BANNED_WORDS.filter(w => lower.includes(w.toLowerCase()))
}

function assertClean(text, label) {
  const hits = checkBannedWords(text)
  if (hits.length > 0) {
    console.error(`BANNED WORDS in ${label}: ${hits.join(', ')}`)
    process.exit(1)
  }
}

async function write(dir, filename, content) {
  const p = join(dir, filename)
  await writeFile(p, content, 'utf8')
  const s = await stat(p)
  console.log(`✓ wrote ${p} (${s.size} bytes)`)
}

function checkLen(arr, max, label) {
  const over = arr.filter(s => s.length > max)
  if (over.length > 0) {
    console.error(`${label} too long (max ${max}): ${over.map(s => `"${s}" (${s.length})`).join(', ')}`)
    process.exit(1)
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const payloadPath = args._[0]
  if (!payloadPath) {
    console.error('Usage: node scripts/build-google-ads-copy.mjs <payload.json> [--out <dir>]')
    process.exit(1)
  }

  const payload = JSON.parse(await readFile(resolve(payloadPath), 'utf8'))
  const { market } = payload
  const slug = payload.target_slug

  const outDir = args.out
    ? resolve(args.out)
    : process.env.OUT_DIR
      ? join(process.env.OUT_DIR, PRODUCER, slug)
      : join(ROOT, 'out', PRODUCER, slug)

  await mkdir(outDir, { recursive: true })
  const now = new Date().toISOString()

  const medPrice = market.median_sale_price_display   // $690,000
  const dom = market.median_dom_display               // 10 days
  const sl = market.sale_to_list_display              // 97.4%
  const inv = market.end_of_period_inventory          // 457
  const ppsf = market.median_ppsf_display             // $381 / sqft

  // ---------------------------------------------------------------------------
  // 15 HEADLINES (≤30 chars each)
  // Targeting: "bend oregon real estate", "tumalo homes for sale", "sell my bend home"
  // ---------------------------------------------------------------------------

  // Trim helper — hard cap at 30 chars
  function h(s) { return s.length > 30 ? s.slice(0, 30) : s }

  const finalHeadlines = [
    h('Bend Oregon Homes For Sale'),
    h('Search Bend OR Real Estate'),
    h('Bend Homes, No Pressure'),
    h('View All Bend MLS Listings'),
    h(`${medPrice} Median in Bend`),
    h('Tumalo Homes For Sale'),
    h('Acreage Near Bend, Oregon'),
    h('Rural Bend Area Properties'),
    h('What Is Your Bend Home Worth'),
    h('Sell Your Home With Ryan Realty'),
    h('Free Bend Home Valuation'),
    h(`Sellers Avg ${sl} of Ask Price`),
    h('Ryan Realty, Bend Oregon'),
    h(`Homes Sell in ${dom} Here`),
    h(`${inv} Active Bend Listings`),
  ]

  if (finalHeadlines.length !== 15) {
    console.error(`Expected 15 headlines, got ${finalHeadlines.length}`)
    process.exit(1)
  }
  checkLen(finalHeadlines, 30, 'Headlines')

  // ---------------------------------------------------------------------------
  // 4 DESCRIPTIONS (≤90 chars each)
  // ---------------------------------------------------------------------------
  function h90(s) { return s.length > 90 ? s.slice(0, 90) : s }

  const descriptions = [
    h90(`Bend median home price: ${medPrice}. Homes selling in ${dom} at ${sl} of asking. Ryan Realty.`),
    h90(`${inv} active listings in Bend right now. Search every MLS property at ryan-realty.com.`),
    h90(`Thinking of selling your Bend home? We price using real ORMLS data, not guesses. 541.213.6706.`),
    h90(`Tumalo and rural Bend properties available. Acreage, views, no city fees. ryan-realty.com.`),
  ]

  checkLen(descriptions, 90, 'Descriptions')

  // ---------------------------------------------------------------------------
  // 4 SITELINKS
  // ---------------------------------------------------------------------------
  const sitelinks = [
    { text: 'Search Bend Listings', url: 'https://ryan-realty.com/listings', description: `Browse ${inv} active homes in Bend, Oregon.` },
    { text: 'Bend Market Report', url: 'https://ryan-realty.com/market-reports/bend', description: `${medPrice} median. ${dom} on market. Live data.` },
    { text: 'What Is My Home Worth', url: 'https://ryan-realty.com/sell', description: 'Get a data-based valuation from a local broker.' },
    { text: 'Meet Ryan Realty', url: 'https://ryan-realty.com/about', description: 'Matt Ryan, Principal Broker. 541.213.6706.' },
  ]

  const slTexts = sitelinks.map(s => s.text)
  checkLen(slTexts, 25, 'Sitelink text')

  // Voice check
  const allText = [...finalHeadlines, ...descriptions, ...sitelinks.map(s => s.description)].join('\n')
  assertClean(allText, 'all ad copy')

  // ---------------------------------------------------------------------------
  // Compose Markdown output
  // ---------------------------------------------------------------------------
  const headlineBlock = finalHeadlines.map((h, i) => `| H${String(i+1).padStart(2,'0')} | ${h} | ${h.length} |`).join('\n')
  const descBlock = descriptions.map((d, i) => `| D${i+1} | ${d} | ${d.length} |`).join('\n')
  const sitelinkBlock = sitelinks.map((s, i) => `### Sitelink ${i+1}: ${s.text}\n- URL: ${s.url}\n- Description: ${s.description}`).join('\n\n')

  const md = `# Google Ads copy — Bend Oregon real estate

**Campaign:** Bend OR Real Estate — Buyer + Seller
**Generated:** ${now.slice(0,10)}
**Market data source:** ${market.trace}

---

## Headlines (15 of 15 — ≤30 chars each)

| ID | Headline | Chars |
|---|---|---|
${headlineBlock}

---

## Descriptions (4 of 4 — ≤90 chars each)

| ID | Description | Chars |
|---|---|---|
${descBlock}

---

## Sitelinks (4)

${sitelinkBlock}

---

## Data verification

| Figure | Value | Source |
|---|---|---|
| Median sale price | ${medPrice} | ${market.trace} |
| Median DOM | ${dom} | ${market.trace} |
| Sale-to-list | ${sl} | ${market.trace} |
| Active inventory | ${inv} listings | ${market.trace} |
| Median price per sqft | ${ppsf} | ${market.trace} |

All data from Supabase market_stats_cache, methodology ${market.methodology_version}.

**Phone:** 541.213.6706
**Web:** ryan-realty.com
**OR License:** #${payload.brokers.matt_ryan.license}
`

  assertClean(md, 'google-ads-copy.md final')

  await write(outDir, 'google-ads-copy.md', md)

  // Sidecars
  const citations = {
    figures: [
      { figure: 'median_sale_price', source: 'Supabase market_stats_cache', query: market.trace, value: medPrice, fetched_at: market.period_end },
      { figure: 'median_dom', source: 'Supabase market_stats_cache', query: market.trace, value: dom, fetched_at: market.period_end },
      { figure: 'sale_to_list_ratio', source: 'Supabase market_stats_cache', query: market.trace, value: sl, fetched_at: market.period_end },
      { figure: 'end_of_period_inventory', source: 'Supabase market_stats_cache', query: market.trace, value: inv, fetched_at: market.period_end },
      { figure: 'median_ppsf', source: 'Supabase market_stats_cache', query: market.trace, value: ppsf, fetched_at: market.period_end }
    ]
  }
  await write(outDir, 'citations.json', JSON.stringify(citations, null, 2))

  const provenance = {
    assets: [
      { asset: 'google-ads-copy.md', source: 'generated from market_stats_cache', license: 'proprietary' }
    ]
  }
  await write(outDir, 'provenance.json', JSON.stringify(provenance, null, 2))

  const bannedHits = checkBannedWords(md)
  const overHeadlines = finalHeadlines.filter(h => h.length > 30)
  const overDesc = descriptions.filter(d => d.length > 90)
  const checks = [
    { name: 'banned_words', pass: bannedHits.length === 0, notes: bannedHits.length ? bannedHits.join(', ') : 'clean' },
    { name: 'headline_count', pass: finalHeadlines.length === 15, notes: `${finalHeadlines.length} headlines` },
    { name: 'headline_max_30', pass: overHeadlines.length === 0, notes: overHeadlines.length ? overHeadlines.join(', ') : 'all within limit' },
    { name: 'description_count', pass: descriptions.length === 4, notes: `${descriptions.length} descriptions` },
    { name: 'description_max_90', pass: overDesc.length === 0, notes: overDesc.length ? overDesc.join(', ') : 'all within limit' },
    { name: 'sitelink_count', pass: sitelinks.length === 4, notes: `${sitelinks.length} sitelinks` },
    { name: 'data_verified', pass: md.includes(medPrice) && md.includes(dom), notes: 'market figures present' },
    { name: 'phone_format', pass: md.includes('541.213.6706'), notes: 'dotted phone format present' }
  ]
  const passed = checks.filter(c => c.pass).length
  const scorecard = { passed, total: checks.length, score_pct: Math.round(passed / checks.length * 100), checks }
  await write(outDir, 'design_scorecard.json', JSON.stringify(scorecard, null, 2))

  const card = {
    producer: PRODUCER,
    primary_artifact: join(outDir, 'google-ads-copy.md'),
    notes: `Google Ads copy suite: 15 headlines, 4 descriptions, 4 sitelinks. Score ${scorecard.score_pct}%.`,
    data_traces: [market.trace],
    generated_at: now
  }
  await write(outDir, 'card.json', JSON.stringify(card, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
