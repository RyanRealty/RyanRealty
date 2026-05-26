#!/usr/bin/env node
/**
 * pull-fb-ads-recon.mjs
 *
 * Consolidates all of Matt's competitor FB-ads-library scrapes (May 18-22,
 * 2026) from Apify into a single deduped local pattern library at
 * `out/design-recon/fb-lead-gen-ad/`.
 *
 * What it does:
 *   1. Enumerates every successful run of `apify/facebook-ads-scraper` for
 *      this account (last 30 days).
 *   2. Pulls every dataset item, dedupes by `adArchiveID`.
 *   3. Ranks by `totalActiveTime` (long-running ads = proven winners on
 *      Meta's auction — strongest engagement signal Meta exposes publicly).
 *   4. Writes `raw.json` (everything), `manifest.json` (run metadata +
 *      brokerage breakdowns), `index.md` (browsable summary table).
 *   5. Downloads top-N image creatives for human pattern analysis.
 *
 * Usage:
 *   APIFY_API_TOKEN=... node scripts/pull-fb-ads-recon.mjs [--download N]
 *
 * Default: --download 60  (top-60 longest-running ads, image creatives only)
 *
 * Per marketing_brain_skills/competitor-design-recon/SKILL.md — the recon
 * is the raw input; the human-or-AI-agent reviewer then writes recon.md
 * with the top-5 layout patterns documented for producer consumption.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(REPO_ROOT, 'out', 'design-recon', 'fb-lead-gen-ad')

const TOKEN = (process.env.APIFY_API_TOKEN || '').trim()
if (!TOKEN) { console.error('Missing APIFY_API_TOKEN'); process.exit(1) }

const DOWNLOAD_TOP_N = parseInt(process.argv.includes('--download')
  ? process.argv[process.argv.indexOf('--download') + 1]
  : '60', 10)

const FB_ADS_ACTOR_ID = 'XtaWFhbtfxyzqrFmd' // apify/facebook-ads-scraper — resolved below

async function api(path) {
  const url = 'https://api.apify.com/v2' + path + (path.includes('?') ? '&' : '?') + 'token=' + TOKEN
  const r = await fetch(url)
  if (!r.ok) return null
  return await r.json()
}

async function listAllRuns() {
  const all = []
  let offset = 0
  while (true) {
    const r = await api(`/actor-runs?limit=100&offset=${offset}&desc=true`)
    const items = r?.data?.items || []
    if (items.length === 0) break
    all.push(...items)
    if (items.length < 100) break
    offset += 100
    if (offset > 1000) break
  }
  return all
}

async function isFbAdsScraperActor(actorId) {
  const a = await api(`/acts/${actorId}`)
  if (!a?.data) return false
  return a.data.username === 'apify' && a.data.name === 'facebook-ads-scraper'
}

console.log(`${'='.repeat(72)}\nFB Ads Library — Recon Puller\n${'='.repeat(72)}`)
console.log(`Output: ${OUT_DIR}`)
console.log(`Top-N images to download: ${DOWNLOAD_TOP_N}`)
console.log()

await mkdir(path.join(OUT_DIR, 'examples'), { recursive: true })

console.log('## Enumerating actor runs...')
const allRuns = await listAllRuns()
console.log(`  fetched ${allRuns.length} total runs in account history`)

// Filter to FB ads scraper. We resolve actor identity for one run, then
// match by actId to avoid 400+ /acts/X lookups.
let fbActorId = null
for (const r of allRuns) {
  const isFb = await isFbAdsScraperActor(r.actId)
  if (isFb) { fbActorId = r.actId; break }
}
if (!fbActorId) { console.error('No facebook-ads-scraper runs found'); process.exit(1) }
console.log(`  identified FB ads actor: ${fbActorId}`)

const fbRuns = allRuns.filter(r => r.actId === fbActorId && r.status === 'SUCCEEDED')
console.log(`  found ${fbRuns.length} successful FB ads scraper runs`)

console.log('\n## Pulling datasets...')
const dedup = new Map() // adArchiveID -> item
const runMetadata = []
for (const run of fbRuns) {
  const dsId = run.defaultDatasetId
  // Get input (the query)
  const kvId = run.defaultKeyValueStoreId
  const inR = await fetch(`https://api.apify.com/v2/key-value-stores/${kvId}/records/INPUT?token=${TOKEN}`)
  const input = inR.ok ? await inR.json() : {}
  const url = input?.startUrls?.[0]?.url || ''
  const m = url.match(/q=([^&]+)/)
  const query = m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '?'

  // Pull dataset items
  const dsR = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${TOKEN}&format=json&limit=10000`)
  if (!dsR.ok) {
    console.log(`  ✗ ${run.startedAt.slice(0, 10)} "${query}" — dataset fetch failed`)
    continue
  }
  const items = await dsR.json()
  let added = 0
  for (const item of items) {
    const id = item.adArchiveID || item.adArchiveId || item.adId
    if (!id) continue
    if (!dedup.has(id)) {
      dedup.set(id, { ...item, _query: query, _run_started_at: run.startedAt })
      added++
    }
  }
  runMetadata.push({
    runId: run.id,
    datasetId: dsId,
    startedAt: run.startedAt,
    query,
    itemsInDataset: items.length,
    newItemsAfterDedup: added,
  })
  console.log(`  ✓ ${run.startedAt.slice(0, 10)} "${query}".padEnd(50) — ${items.length} items, ${added} new after dedup`)
}

const allItems = [...dedup.values()]
console.log(`\nTotal unique ads: ${allItems.length}`)

// ─── Rank by totalActiveTime (long-running = proven winner) ────────────────
function ageDays(item) {
  // totalActiveTime is in seconds in the FB Ads Library schema. Convert to days.
  if (typeof item.totalActiveTime === 'number') return item.totalActiveTime / 86400
  // Fallback: compute from startDate/endDate
  const startMs = (item.startDate || 0) * 1000
  const endMs = (item.endDate || Date.now() / 1000) * 1000
  if (!startMs) return 0
  return (endMs - startMs) / (86400 * 1000)
}

// Filter signal: many of the longest-running "ads" are from ad-tech platforms
// that white-label real-estate ads (Adwerx, Property Marketing, Local
// Advertising, Local Real Estate, etc.) — they show up because the Page name
// is the platform, not the brokerage. We tag them so we can surface
// "real brokerages" separately in the rankings.
const AD_PLATFORM_PAGES = new Set([
  'Property Marketing', 'Adwerx Advertising', 'Local Advertising',
  'Local Real Estate', 'Cole Gordon',
  // Yesterday's Classics-LQXX and similar are book/test ads that fell into
  // the scrape via keyword overlap — filter them out.
])
function isAdPlatform(item) {
  const p = item.snapshot?.pageName || item.pageName || ''
  if (AD_PLATFORM_PAGES.has(p)) return true
  if (/^Yesterday's Classics/.test(p)) return true
  if (/^A Novel of/.test(p)) return true
  return false
}

// Tag every item with our derived signals
for (const item of allItems) {
  item._is_ad_platform = isAdPlatform(item)
  item._page_name = item.snapshot?.pageName || item.pageName || '?'
  item._age_days = ageDays(item)
  item._ad_library_url = `https://www.facebook.com/ads/library/?id=${item.adArchiveID || item.adArchiveId}`
  item._is_central_oregon = /Bend|Sunriver|Redmond|Sisters|Central Oregon|Cascade|Tetherow|Windermere/i.test(item._page_name)
}

allItems.sort((a, b) => ageDays(b) - ageDays(a))

// ─── Brokerage breakdown ───────────────────────────────────────────────────
const byBroker = {}
for (const item of allItems) {
  const broker = item.snapshot?.pageName || item.pageName || '?'
  byBroker[broker] = byBroker[broker] || { count: 0, longestDays: 0 }
  byBroker[broker].count++
  const d = ageDays(item)
  if (d > byBroker[broker].longestDays) byBroker[broker].longestDays = d
}
const brokerList = Object.entries(byBroker).sort((a, b) => b[1].count - a[1].count)

console.log('\n## Brokerage breakdown (top 15):')
for (const [name, info] of brokerList.slice(0, 15)) {
  console.log(`  ${name.padEnd(60).slice(0, 60)} ${info.count.toString().padStart(5)} ads  longest=${info.longestDays.toFixed(0)}d`)
}

// ─── Display format breakdown ───────────────────────────────────────────────
const byFormat = {}
for (const item of allItems) {
  const fmt = item.snapshot?.displayFormat || '?'
  byFormat[fmt] = (byFormat[fmt] || 0) + 1
}
console.log('\n## Display format breakdown:')
for (const [fmt, n] of Object.entries(byFormat).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${fmt.padEnd(20)} ${n}`)
}

// ─── Write raw + manifest + index.md ───────────────────────────────────────
await writeFile(path.join(OUT_DIR, 'raw.json'), JSON.stringify(allItems, null, 2))
console.log(`\n✓ raw.json written (${allItems.length} items)`)

const manifest = {
  format: 'fb-lead-gen-ad',
  source: 'apify/facebook-ads-scraper',
  generated_at: new Date().toISOString(),
  total_unique_ads: allItems.length,
  ranked_by: 'totalActiveTime (descending)',
  runs: runMetadata,
  brokerage_breakdown: Object.fromEntries(brokerList),
  format_breakdown: byFormat,
}
await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`✓ manifest.json written`)

// ─── Subset rankings ───────────────────────────────────────────────────────
const realBrokerages = allItems.filter(it => !it._is_ad_platform)
const centralOregon = allItems.filter(it => it._is_central_oregon)

// ─── Markdown index for human browsing ─────────────────────────────────────
function adRow(it, i) {
  const broker = it._page_name.slice(0, 40)
  const days = it._age_days.toFixed(0)
  const fmt = it.snapshot?.displayFormat || '?'
  const cta = (it.snapshot?.ctaText || '?').slice(0, 25)
  const body = (it.snapshot?.body?.text || '').replace(/\n/g, ' ').replace(/\|/g, '\\|').slice(0, 70)
  const url = it._ad_library_url
  return `| ${i + 1} | ${broker} | ${days} | ${fmt} | ${cta} | ${body} | [view](${url}) |`
}

const indexLines = [
  '# FB Ads Library Recon — Competitor Creative Library',
  '',
  `**Generated:** ${new Date().toISOString()}`,
  `**Source:** Apify \`apify/facebook-ads-scraper\` across ${runMetadata.length} runs (May 18-22, 2026)`,
  `**Total unique ads:** ${allItems.length}`,
  `**Ranked by:** \`totalActiveTime\` descending (long-running ads = proven winners on Meta's auction)`,
  '',
  '> **Note on images:** Facebook CDN URLs are time-limited and expire ~24-72h after scrape. The downloaded `examples/*.jpg` thumbnails are best-effort — for any ad you want to study, click the "view" link to open the live Ad Library page (these URLs never expire and render the original creative).',
  '',
  '## Brokerage breakdown (top 20)',
  '',
  '| Brokerage / page name | # ads scraped | Longest ad (days active) |',
  '|---|---:|---:|',
  ...brokerList.slice(0, 20).map(([name, info]) =>
    `| ${name.replace(/\|/g, '\\|')} | ${info.count} | ${info.longestDays.toFixed(0)} |`
  ),
  '',
  '## Display format breakdown',
  '',
  '| Format | Count |',
  '|---|---:|',
  ...Object.entries(byFormat).sort((a, b) => b[1] - a[1]).map(([f, n]) => `| ${f} | ${n} |`),
  '',
  '## Central Oregon competitors — every ad we caught',
  '',
  '*Filtered to Bend / Sunriver / Redmond / Cascade / Tetherow / Windermere brand pages. These are the most-direct competitor benchmarks.*',
  '',
  `**Total:** ${centralOregon.length} ads`,
  '',
  '| Rank | Broker | Days active | Format | CTA | Body (first 70 chars) | Live ad |',
  '|---:|---|---:|---|---|---|---|',
  ...centralOregon.slice(0, 50).map(adRow),
  '',
  `## Top 50 longest-running real-brokerage ads (proven winners — ad platforms excluded)`,
  '',
  '| Rank | Broker | Days active | Format | CTA | Body (first 70 chars) | Live ad |',
  '|---:|---|---:|---|---|---|---|',
  ...realBrokerages.slice(0, 50).map(adRow),
  '',
  `## Raw top-${DOWNLOAD_TOP_N} (everything, including ad platforms — for completeness)`,
  '',
  '| Rank | Broker | Days active | Format | CTA | Body (first 70 chars) | Live ad | Local image |',
  '|---:|---|---:|---|---|---|---|---|',
  ...allItems.slice(0, DOWNLOAD_TOP_N).map((it, i) => {
    const url = it._ad_library_url
    const hasImage = it.snapshot?.images?.[0]?.originalImageUrl
      ? `[jpg](examples/${String(i + 1).padStart(3, '0')}.jpg)`
      : '—'
    return adRow(it, i) + ` | ${hasImage} |`
  }),
  '',
  '## How to use this',
  '',
  '1. Click the "view" links in the Central Oregon competitors table — those are the most-direct benchmarks (Cascade Sotheby\'s, Cascade Hasson, Compass Bend, Windermere Central Oregon).',
  '2. Pick 5 layout patterns that recur (heading position, hero crop, CTA placement, color contrast, typography hierarchy).',
  '3. Document those patterns in `recon.md` per the template in `marketing_brain_skills/competitor-design-recon/SKILL.md`.',
  '4. The Ryan Realty `flyer-design` / `facebook-lead-gen-ad` producer reads `recon.md` at build time and adapts a pattern to our brand register (Amboqia + navy/cream).',
  '',
  '## Producer-consumption checkpoint',
  '',
  '- [ ] `recon.md` written with top-5 patterns',
  '- [ ] `flyer-design` producer updated to read `recon.md`',
  '- [ ] `facebook-lead-gen-ad` producer updated to read `recon.md`',
  '- [ ] Pattern adaptations approved by Matt',
]
await writeFile(path.join(OUT_DIR, 'index.md'), indexLines.join('\n'))
console.log(`✓ index.md written (browsable summary)`)

// ─── Download top-N creative images ───────────────────────────────────────
console.log(`\n## Downloading top-${DOWNLOAD_TOP_N} ad creatives...`)
let downloaded = 0, skipped = 0, failed = 0
for (let i = 0; i < Math.min(DOWNLOAD_TOP_N, allItems.length); i++) {
  const it = allItems[i]
  const imgUrl = it.snapshot?.images?.[0]?.originalImageUrl
  if (!imgUrl) { skipped++; continue }
  const filename = path.join(OUT_DIR, 'examples', `${String(i + 1).padStart(3, '0')}.jpg`)
  try {
    const r = await fetch(imgUrl)
    if (!r.ok) { failed++; continue }
    await pipeline(Readable.fromWeb(r.body), createWriteStream(filename))
    downloaded++
    process.stdout.write(`\r  downloaded ${downloaded}/${i + 1}, skipped (no image): ${skipped}, failed: ${failed}`)
  } catch (e) { failed++ }
  // brief delay so we don't hammer FB CDN
  await new Promise(rs => setTimeout(rs, 100))
}
console.log(`\n✓ Downloaded ${downloaded} images, skipped ${skipped} (no image URL), failed ${failed}`)

console.log(`\n${'='.repeat(72)}`)
console.log(`Done.`)
console.log(`${'='.repeat(72)}`)
console.log(`Browse: open ${path.relative(REPO_ROOT, path.join(OUT_DIR, 'index.md'))}`)
console.log(`Images:  ${path.relative(REPO_ROOT, path.join(OUT_DIR, 'examples'))}`)
console.log(`Next:    write recon.md with top-5 patterns (see SKILL.md template)`)
