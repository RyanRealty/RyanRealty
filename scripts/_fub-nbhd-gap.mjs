// READ-ONLY per-contact: who lives in Bend but has NO neighborhood:* tag.
import fs from 'node:fs'
const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const KEY = (env.match(/^FOLLOWUPBOSS_API_KEY=(.+)$/m) || env.match(/^FUB_API_KEY=(.+)$/m) || [])[1]?.trim()
const auth = 'Basic ' + Buffer.from(KEY + ':').toString('base64')
const BASE = 'https://api.followupboss.com'
async function getJson(u, t = 0) {
  const url = u.startsWith('http') ? u : BASE + u
  const r = await fetch(url, { headers: { Authorization: auth, 'X-System': 'RyanRealtyAudit' } })
  if (r.status === 429 && t < 6) { await new Promise(s => setTimeout(s, 2000 * (t + 1))); return getJson(u, t + 1) }
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0,150)}`)
  return r.json()
}
let total=0, hasNbhd=0, noNbhd=0, cityBendTag=0, geoLocal=0, addrBend=0, hasField=0
let bendResident=0, bendNoNbhd=0            // bend (cityBendTag OR addrBend) & no neighborhood tag
let cityBendTagNoNbhd=0, geoLocalNoNbhd=0, addrBendNoNbhd=0
let fieldButNoTag=0                          // customNeighborhood set but no neighborhood:* tag
let nbhdButNotBend=0                         // has neighborhood tag but not flagged bend (resort etc.)
const norm = s => (s||'').trim()
let path = '/v1/people?limit=100&fields=id,tags,addresses,customNeighborhood'
let pages=0
while (path) {
  const d = await getJson(path); const ppl = d.people||[]; if(!ppl.length) break
  for (const p of ppl) {
    total++
    const tags = (p.tags||[]).map(norm)
    const tagset = new Set(tags)
    const nb = tags.some(t => t.startsWith('neighborhood:'))
    const cb = tagset.has('city:bend')
    const gl = tagset.has('geo:local')
    const field = !!norm(p.customNeighborhood)
    const ab = (p.addresses||[]).some(a => norm(a.city).toLowerCase()==='bend')
    if (nb) hasNbhd++; else noNbhd++
    if (cb) cityBendTag++
    if (gl) geoLocal++
    if (ab) addrBend++
    if (field) hasField++
    const isBend = cb || ab
    if (isBend) { bendResident++; if(!nb) bendNoNbhd++ }
    if (cb && !nb) cityBendTagNoNbhd++
    if (gl && !nb) geoLocalNoNbhd++
    if (ab && !nb) addrBendNoNbhd++
    if (field && !nb) fieldButNoTag++
    if (nb && !isBend) nbhdButNotBend++
  }
  pages++; path = d._metadata?.nextLink||null
  if (pages%30===0) process.stderr.write(`  ...${total}\n`)
}
const p = n => `${n}  (${(100*n/total).toFixed(1)}%)`
console.log('================ NEIGHBORHOOD-TAG GAP (n='+total+') ================')
console.log(`Has >=1 neighborhood:* tag:        ${p(hasNbhd)}`)
console.log(`NO neighborhood:* tag:             ${p(noNbhd)}   <-- not assigned to a neighborhood`)
console.log('')
console.log('--- "lives in Bend" signals (they disagree) ---')
console.log(`city:bend tag:                     ${p(cityBendTag)}`)
console.log(`geo:local tag:                     ${p(geoLocal)}`)
console.log(`address city == Bend:              ${p(addrBend)}`)
console.log(`customNeighborhood field set:      ${p(hasField)}`)
console.log('')
console.log('--- THE GAP: lives in Bend but NO neighborhood tag ---')
console.log(`Bend resident (city:bend OR addr Bend): ${bendResident}`)
console.log(`  ...of those, NO neighborhood tag:     ${bendNoNbhd}   <<< need tagging`)
console.log('')
console.log(`city:bend-tagged but no neighborhood tag:   ${cityBendTagNoNbhd}`)
console.log(`geo:local but no neighborhood tag:          ${geoLocalNoNbhd}`)
console.log(`addr Bend but no neighborhood tag:          ${addrBendNoNbhd}`)
console.log(`customNeighborhood FIELD set but no TAG:    ${fieldButNoTag}  (retaggable w/o geocoding)`)
console.log(`has neighborhood tag but NOT flagged Bend:  ${nbhdButNotBend}  (resort communities etc.)`)
console.log('====================================================================')
