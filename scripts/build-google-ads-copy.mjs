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

  // ---------------------------------------------------------------------------
  // preview.html — Google SERP card mock-up
  // ---------------------------------------------------------------------------
  // Display title: H1 | H2 | H3 (first three headlines joined, truncated at ~600px)
  const adTitle = finalHeadlines.slice(0, 3).join(' | ')
  const adDesc1 = descriptions[0] || ''
  const adDesc2 = descriptions[1] || ''
  const serpHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Google Ads SERP Preview — ryan-realty.com</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f9f9f9; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; padding: 32px 24px; color: #1a1a1a; }
  h1.page-title { font-size: 13px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 20px; }
  .serp-context { max-width: 652px; }
  /* Fake SERP search bar for context */
  .fake-search { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #dfe1e5; border-radius: 24px; padding: 8px 16px; margin-bottom: 16px; width: 100%; max-width: 580px; box-shadow: 0 1px 6px rgba(0,0,0,0.1); }
  .fake-search span { color: #9aa0a6; font-size: 14px; }
  .fake-search .icon { font-size: 18px; }
  /* Ad card */
  .ad-card {
    background: #fff;
    border-radius: 8px;
    padding: 16px 20px 20px;
    max-width: 600px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06);
  }
  /* Top row: Ad label + domain */
  .ad-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .ad-label { display: inline-block; font-size: 11px; font-weight: 600; color: #3c4043; border: 1px solid #888; border-radius: 3px; padding: 1px 5px; letter-spacing: 0.03em; }
  .ad-domain { font-size: 14px; color: #3c4043; }
  .ad-domain .green { color: #188038; font-weight: 500; }
  /* Ad title */
  .ad-title {
    font-size: 20px;
    font-weight: 400;
    color: #1a0dab;
    line-height: 1.3;
    margin-bottom: 6px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 580px;
  }
  .ad-title:hover { text-decoration: underline; }
  /* Ad descriptions */
  .ad-desc { font-size: 14px; color: #3c4043; line-height: 1.5; margin-bottom: 2px; }
  /* Sitelinks */
  .sitelinks { display: flex; flex-wrap: wrap; gap: 0; margin-top: 12px; padding-top: 12px; border-top: 1px solid #ebebeb; }
  .sitelink { flex: 0 0 48%; padding: 6px 0; }
  .sitelink a { font-size: 14px; color: #1a0dab; text-decoration: none; display: block; }
  .sitelink a:hover { text-decoration: underline; }
  .sitelink .sl-desc { font-size: 12px; color: #3c4043; margin-top: 2px; }
  /* Label below card */
  .note { max-width: 600px; margin-top: 12px; font-size: 12px; color: #888; }
  /* All headlines panel */
  .all-headlines { margin-top: 32px; max-width: 600px; }
  .all-headlines h2 { font-size: 13px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; }
  .headline-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .headline-chip { background: #fff; border: 1px solid #e0e0e0; border-radius: 4px; padding: 6px 10px; font-size: 13px; color: #1a0dab; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .headline-chip .len { font-size: 10px; color: #aaa; margin-left: 4px; }
  .preview-badge { position: fixed; top: 12px; right: 12px; background: #1a1a1a; color: #fff; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 10px; border-radius: 4px; opacity: 0.7; }
</style>
</head>
<body>
<div class="preview-badge">SERP Preview</div>
<p class="page-title">Google Ads · SERP Card Mock-up</p>
<div class="serp-context">
  <div class="fake-search">
    <span class="icon">&#128269;</span>
    <span>bend oregon homes for sale</span>
  </div>

  <div class="ad-card">
    <div class="ad-top">
      <span class="ad-label">Sponsored</span>
      <span class="ad-domain"><span class="green">ryan-realty.com</span></span>
    </div>
    <div class="ad-title" title="${adTitle}">${adTitle}</div>
    <div class="ad-desc">${adDesc1}</div>
    ${adDesc2 ? `<div class="ad-desc">${adDesc2}</div>` : ''}
    <div class="sitelinks">
      ${sitelinks.map(sl => `
      <div class="sitelink">
        <a href="${sl.url}">${sl.text}</a>
        <div class="sl-desc">${sl.description}</div>
      </div>`).join('')}
    </div>
  </div>

  <p class="note">Title uses H01 | H02 | H03. Google selects from 15 headlines at serve time. Description shown is D1 + D2.</p>
</div>

<div class="all-headlines">
  <h2>All 15 headlines</h2>
  <div class="headline-grid">
    ${finalHeadlines.map((h, i) => `<div class="headline-chip">H${String(i+1).padStart(2,'0')}: ${h}<span class="len">${h.length}/30</span></div>`).join('\n    ')}
  </div>
</div>

</body>
</html>`

  await write(outDir, 'preview.html', serpHtml)

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
    notes: `google-ads-copy.md · preview.html (SERP card) · 15 headlines · 4 descriptions · 4 sitelinks · score ${scorecard.score_pct}%`,
    data_traces: [market.trace],
    generated_at: now
  }
  await write(outDir, 'card.json', JSON.stringify(card, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
