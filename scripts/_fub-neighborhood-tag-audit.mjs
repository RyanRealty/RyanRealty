// READ-ONLY: across ALL FUB people, dump the tag histogram, customNeighborhood
// field population, and city distribution so we can see who is/ isn't assigned a
// neighborhood tag and who lives in Bend. Exact counts, cursor paginated.
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
const tagHist = {}, cityHist = {}, nbhdFieldHist = {}
let total = 0, hasNbhdField = 0, cityBend = 0, hasAnyAddress = 0
const norm = s => (s || '').trim()
let path = '/v1/people?limit=100&fields=id,tags,addresses,customNeighborhood,customSubdivision'
let pages = 0
while (path) {
  const d = await getJson(path)
  const ppl = d.people || []
  if (!ppl.length) break
  for (const p of ppl) {
    total++
    for (const t of (p.tags || [])) { const k = norm(t); if (k) tagHist[k] = (tagHist[k]||0)+1 }
    const nb = norm(p.customNeighborhood)
    if (nb) { hasNbhdField++; nbhdFieldHist[nb] = (nbhdFieldHist[nb]||0)+1 }
    const addrs = p.addresses || []
    if (addrs.length) hasAnyAddress++
    let bend = false
    for (const a of addrs) { const c = norm(a.city).toLowerCase(); if (c) cityHist[c] = (cityHist[c]||0)+1; if (c === 'bend') bend = true }
    if (bend) cityBend++
  }
  pages++
  path = d._metadata?.nextLink || null
  if (pages % 30 === 0) process.stderr.write(`  ...${total} scanned\n`)
}
const top = (h, n) => Object.entries(h).sort((a,b)=>b[1]-a[1]).slice(0, n)
console.log('================ NEIGHBORHOOD / CITY / TAG AUDIT (n='+total+') ================')
console.log(`customNeighborhood field populated: ${hasNbhdField}  (${(100*hasNbhdField/total).toFixed(1)}%)`)
console.log(`has >=1 address: ${hasAnyAddress}   |  address city == 'Bend': ${cityBend}`)
console.log('')
console.log('--- top 30 cities (by address) ---')
for (const [c,n] of top(cityHist,30)) console.log(`  ${String(n).padStart(6)}  ${c}`)
console.log('')
console.log('--- customNeighborhood values (top 40) ---')
for (const [c,n] of top(nbhdFieldHist,40)) console.log(`  ${String(n).padStart(6)}  ${c}`)
console.log('')
console.log('--- FULL TAG HISTOGRAM (all '+Object.keys(tagHist).length+' distinct tags, sorted) ---')
for (const [c,n] of top(tagHist, 100000)) console.log(`  ${String(n).padStart(6)}  ${c}`)
fs.writeFileSync(new URL('../out/fub-nurture/neighborhood-tag-audit.json', import.meta.url), JSON.stringify({total,hasNbhdField,cityBend,hasAnyAddress,tagHist,cityHist,nbhdFieldHist},null,2))
