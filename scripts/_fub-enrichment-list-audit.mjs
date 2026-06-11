// One-off READ-ONLY audit: across ALL FUB people, count who lacks "enhanced
// information" (customEnrichmentProvider empty) and who is "not in a list"
// (proxy: zero tags — their smart lists are tag-driven). Prints exact counts
// with the definitions so the number is traceable (CLAUDE.md data-accuracy).
import fs from 'node:fs'

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const KEY = (env.match(/^FOLLOWUPBOSS_API_KEY=(.+)$/m) || env.match(/^FUB_API_KEY=(.+)$/m) || [])[1]?.trim()
if (!KEY) { console.error('no FUB key'); process.exit(1) }
const auth = 'Basic ' + Buffer.from(KEY + ':').toString('base64')
const BASE = 'https://api.followupboss.com'

async function getJson(urlOrPath, tries = 0) {
  const url = urlOrPath.startsWith('http') ? urlOrPath : BASE + urlOrPath
  const r = await fetch(url, { headers: { Authorization: auth, 'X-System': 'RyanRealtyAudit' } })
  if (r.status === 429 && tries < 6) { await new Promise(s => setTimeout(s, 2000 * (tries + 1))); return getJson(urlOrPath, tries + 1) }
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}: ${(await r.text()).slice(0,200)}`)
  return r.json()
}

let total = 0, enriched = 0, noEnrich = 0, tagged = 0, noTags = 0
let noEnrichNoTags = 0, noEnrichButTagged = 0, enrichedNoTags = 0
const provCounts = {}
let pages = 0

// Follow _metadata.next for robust pagination past the offset cap.
let path = '/v1/people?limit=100&sort=created&fields=id,customEnrichmentProvider,tags'
while (path) {
  const d = await getJson(path)
  const ppl = d.people || []
  for (const p of ppl) {
    total++
    const ep = (p.customEnrichmentProvider || '').trim()
    const tg = Array.isArray(p.tags) ? p.tags.filter(t => (t || '').trim()) : []
    const hasEnrich = !!ep
    const hasTags = tg.length > 0
    if (hasEnrich) { enriched++; provCounts[ep] = (provCounts[ep] || 0) + 1 } else noEnrich++
    if (hasTags) tagged++; else noTags++
    if (!hasEnrich && !hasTags) noEnrichNoTags++
    if (!hasEnrich && hasTags) noEnrichButTagged++
    if (hasEnrich && !hasTags) enrichedNoTags++
  }
  pages++
  const meta = d._metadata || {}
  // cursor pagination: follow the full nextLink URL; stop when a page is empty
  path = ppl.length === 0 ? null : (meta.nextLink || null)
  if (pages % 20 === 0) process.stderr.write(`  ...${total} scanned\n`)
}

const pct = (n) => total ? (100 * n / total).toFixed(1) + '%' : '0%'
console.log('================ FUB ENRICHMENT × SEGMENTATION AUDIT ================')
console.log(`pages fetched: ${pages}`)
console.log(`TOTAL people: ${total}`)
console.log('')
console.log(`Enhanced info (customEnrichmentProvider set): ${enriched}  (${pct(enriched)})`)
console.log(`  providers: ${JSON.stringify(provCounts)}`)
console.log(`NO enhanced info (provider empty):            ${noEnrich}  (${pct(noEnrich)})`)
console.log('')
console.log(`In a list proxy — has >=1 tag:                ${tagged}  (${pct(tagged)})`)
console.log(`NOT in a list proxy — zero tags:              ${noTags}  (${pct(noTags)})`)
console.log('')
console.log('---- THE ANSWER (no enhanced info AND not in a list) ----')
console.log(`NO enrichment AND NO tags:                    ${noEnrichNoTags}  (${pct(noEnrichNoTags)})`)
console.log('')
console.log('---- adjacent cohorts for context ----')
console.log(`NO enrichment but HAS tags (in a list):       ${noEnrichButTagged}`)
console.log(`HAS enrichment but NO tags (not in a list):   ${enrichedNoTags}`)
console.log('=====================================================================')
