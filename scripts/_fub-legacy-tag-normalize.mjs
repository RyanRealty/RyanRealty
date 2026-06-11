// Map legacy free-text community tags -> canonical slug tags, for contacts that
// carry the legacy tag but not the canonical one. Preserves all existing tags.
// Smoke-test with LIMIT=5. Records nothing destructive; tag-add only (reversible).
import { config } from 'dotenv'
config({ path: '/Users/matthewryan/RyanRealty/.env.local' })
const FUB = 'https://api.followupboss.com/v1'
const AUTH = `Basic ${Buffer.from(process.env.FOLLOWUPBOSS_API_KEY.trim()+':').toString('base64')}`
const H = { Authorization: AUTH, 'Content-Type': 'application/json', Accept: 'application/json', 'X-System': 'RyanRealtyAudit' }
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity

// legacy tag (case-insensitive) -> canonical tag to add
const MAP = {
  'caldersprings':'neighborhood:caldera-springs',
  'calderasprings':'neighborhood:caldera-springs',
  'oldbend':'neighborhood:bend-old-bend',
  'westhills':'subdivision:west-hills',
}
const norm = s => (s||'').trim()
const lc = s => norm(s).toLowerCase()

// collect candidates
const cands = []
let path = `${FUB}/people?limit=100&fields=id,tags`
let walked = 0
while (path) {
  const d = await (await fetch(path, { headers: H })).json()
  const ppl = d.people || []; if (!ppl.length) break
  for (const p of ppl) {
    const tags = (p.tags||[]).map(norm)
    const tagsLc = new Set(tags.map(lc))
    let add = null, via = null
    for (const t of tags) { const tgt = MAP[lc(t)]; if (tgt && !tagsLc.has(lc(tgt))) { add = tgt; via = t; break } }
    if (add) cands.push({ id: p.id, tags, add, via })
    if (cands.length >= LIMIT) break
  }
  walked += ppl.length
  if (cands.length >= LIMIT) break
  path = d._metadata?.nextLink || null
}
if (cands.length > LIMIT) cands.length = LIMIT
console.log(`Candidates: ${cands.length}${LIMIT!==Infinity?` (LIMIT ${LIMIT})`:''}  (walked ${walked})`)
const byTarget = {}
for (const c of cands) byTarget[c.add] = (byTarget[c.add]||0)+1
console.log('by target:', JSON.stringify(byTarget))

const stats = { tagged: 0, errors: 0 }
for (let i = 0; i < cands.length; i++) {
  const c = cands[i]
  const newTags = [...new Set([...c.tags, c.add])]
  try {
    const r = await fetch(`${FUB}/people/${c.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ tags: newTags }) })
    if (r.ok) stats.tagged++; else { stats.errors++; if (stats.errors<=3) console.log('  PUT fail', c.id, r.status) }
  } catch (e) { stats.errors++ }
  if (i % 50 === 0) process.stderr.write(`  ${i+1}/${cands.length} tagged=${stats.tagged} err=${stats.errors}\n`)
  await new Promise(s => setTimeout(s, 120))
}
console.log('Summary:', JSON.stringify(stats))
