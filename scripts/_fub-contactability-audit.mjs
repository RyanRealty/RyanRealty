// READ-ONLY: across ALL FUB people, count contactability — who has no email,
// no phone, or neither. Exact counts (CLAUDE.md data-accuracy), cursor paginated.
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
let total = 0, noEmail = 0, noPhone = 0, neither = 0, both = 0, emailOnly = 0, phoneOnly = 0
// cross with enrichment too
let enrichedNeither = 0, nonEnrichedNeither = 0
let path = '/v1/people?limit=100&fields=id,emails,phones,customEnrichmentProvider'
let pages = 0
while (path) {
  const d = await getJson(path)
  const ppl = d.people || []
  if (!ppl.length) break
  for (const p of ppl) {
    total++
    const hasE = (p.emails || []).some(e => (e.value || '').trim())
    const hasP = (p.phones || []).some(ph => (ph.value || '').trim())
    if (!hasE) noEmail++
    if (!hasP) noPhone++
    if (hasE && hasP) both++
    else if (hasE) emailOnly++
    else if (hasP) phoneOnly++
    else { neither++; if ((p.customEnrichmentProvider||'').trim()) enrichedNeither++; else nonEnrichedNeither++ }
  }
  pages++
  path = d._metadata?.nextLink || null
  if (pages % 30 === 0) process.stderr.write(`  ...${total} scanned\n`)
}
const pct = n => total ? (100*n/total).toFixed(1)+'%' : '-'
console.log('================ FUB CONTACTABILITY (all '+total+' contacts) ================')
console.log(`No email:                       ${noEmail}  (${pct(noEmail)})`)
console.log(`No phone:                        ${noPhone}  (${pct(noPhone)})`)
console.log(`NEITHER email nor phone:         ${neither}  (${pct(neither)})  <-- uncontactable`)
console.log('')
console.log(`Has BOTH email + phone:          ${both}  (${pct(both)})`)
console.log(`Email only (no phone):           ${emailOnly}  (${pct(emailOnly)})`)
console.log(`Phone only (no email):           ${phoneOnly}  (${pct(phoneOnly)})`)
console.log('')
console.log(`of the ${neither} uncontactable: ${enrichedNeither} were BatchData-enriched, ${nonEnrichedNeither} never enriched`)
console.log('================================================================')
