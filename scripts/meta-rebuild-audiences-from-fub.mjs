#!/usr/bin/env node
/**
 * scripts/meta-rebuild-audiences-from-fub.mjs   (v2 — dialed-in, multi-key)
 *
 * Rebuilds Ryan Realty's Meta Custom Audiences from FUB, ad-aligned and sized to
 * clear Meta's 1,000-match floor. Two design rules:
 *   1. MAX MATCH: push full multi-key rows — email + ALL phones + first/last name
 *      + zip + city + state + country. FUB data is phone-heavy (avg 0.83 email /
 *      1.34 phone per person), so name+geo keys are what lift match over 1,000.
 *   2. AD-ALIGNED: each audience maps to the specific ad a person will see. Big
 *      segments are direct-target; small high-value segments are LAL seeds.
 *
 * Reads the reduced cache at /tmp/fub_people_cache.json (built by fub_deep.mjs)
 * to avoid re-pulling 18k contacts. Falls back to a live FUB pull if absent.
 *
 * Scope: Matt-assigned only (per standing FUB rule). Realtors excluded via tags
 * AND realtor-license/brokerage custom fields.
 *
 * Modes: --dry-run (counts only) | (no flag) apply
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const DRY_RUN = process.argv.includes('--dry-run')
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1] || null // smoke-test one segment
const META_TOKEN = (process.env.META_USER_ACCESS_TOKEN_USER || process.env.META_USER_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN || '').trim()
const AD_ACCT_RAW = (process.env.META_AD_ACCOUNT_ID || '').trim()
if (!META_TOKEN || !AD_ACCT_RAW) { console.error('Need META token + META_AD_ACCOUNT_ID'); process.exit(1) }
const AD_ACCT = AD_ACCT_RAW.startsWith('act_') ? AD_ACCT_RAW : `act_${AD_ACCT_RAW}`

// ── load reduced cache, or pull live from FUB if absent (self-contained) ──
const CACHE = '/tmp/fub_people_cache.json'
const MATT_USER_ID = 1 // /v1/users → id=1 Matt Ryan
const HARD_STOP_TAGS = new Set(['realtor', 'real estate', 'real estate agent', 'real-estate-agent', 'industry:realtor', 'do_not_email', 'do_not_text', 'do-not-email', 'do-not-text', 'compliance:hard-stop', 'bounced', 'unsubscribed', 'complained', 'test record - delete', 'test-delete-me'])
async function pullAndReduce() {
  const key = (process.env.FOLLOWUPBOSS_API_KEY || process.env.FUB_API_KEY || '').trim()
  if (!key) { console.error('No cache and no FOLLOWUPBOSS_API_KEY to pull live.'); process.exit(1) }
  const auth = Buffer.from(`${key}:`).toString('base64')
  const lc = s => (s || '').toString().toLowerCase().trim()
  const CF = ['customIncludeInFBCAS', 'customSellerScoreBand', 'customSellerScore', 'customLeadTier', 'customNeighborhood', 'customSubdivision', 'customPlannedCommunity', 'customEstimatedMarketValue', 'customMarketValue', 'customEquityPct', 'customEquityPercent', 'customYearsOwned', 'customRecentlyMoved', 'customMoveTimeline', 'customIsSellerCurious', 'customListingStatus', 'customRealtorLicense', 'customBrokerage', 'customClassification']
  const fields = ['id', 'firstName', 'lastName', 'emails', 'phones', 'tags', 'addresses', 'stage', 'assignedUserId', 'assignedTo', ...CF].join(',')
  const all = []; let offset = 0
  while (true) {
    const r = await fetch(`https://api.followupboss.com/v1/people?limit=100&offset=${offset}&fields=${encodeURIComponent(fields)}&sort=created`, { headers: { Authorization: `Basic ${auth}` }, cache: 'no-store' })
    if (!r.ok) throw new Error(`FUB ${r.status}: ${(await r.text()).slice(0, 200)}`)
    const j = await r.json(); const p = j.people || []; all.push(...p)
    process.stdout.write(`  pulling FUB ${all.length}/${j._metadata?.total ?? '?'}...\r`)
    if (p.length < 100) break; offset += 100; if (offset > 30000) break
  }
  const mine = all.filter(p => p.assignedUserId === MATT_USER_ID || p.assignedTo === 'Matt Ryan')
  // Realtor detection: license/brokerage custom fields, classification, OR the
  // FUB stage "Real Estate Agent" (some agents are stage-only, no realtor tag).
  const realtorCF = p => !!(lc(p.customRealtorLicense) || lc(p.customBrokerage) || /realtor|agent/.test(lc(p.customClassification)) || /real estate agent|realtor/.test(lc(p.stage)))
  return mine.map(p => {
    const ad = (p.addresses || [])[0] || {}
    const tags = (p.tags || []).map(lc)
    return {
      fn: lc(p.firstName), ln: lc(p.lastName),
      emails: (p.emails || []).map(e => lc(e.value)).filter(Boolean),
      phones: (p.phones || []).map(x => (x.value || '').replace(/\D/g, '')).filter(Boolean),
      zip: ad.code || '', city: lc(ad.city), state: lc(ad.state),
      tags, hardStop: tags.some(t => HARD_STOP_TAGS.has(t)) || realtorCF(p),
      nbhd: lc(p.customNeighborhood), subdiv: lc(p.customSubdivision), planned: lc(p.customPlannedCommunity),
      scoreBand: lc(p.customSellerScoreBand), listingStatus: lc(p.customListingStatus), includeFBCAS: lc(p.customIncludeInFBCAS),
      value: parseFloat(p.customEstimatedMarketValue || p.customMarketValue) || null,
      equity: parseFloat(p.customEquityPct || p.customEquityPercent) || null,
      yearsOwned: parseFloat(p.customYearsOwned) || null,
    }
  })
}
let people
if (existsSync(CACHE)) { people = JSON.parse(readFileSync(CACHE, 'utf8')); console.log(`(loaded ${people.length} from cache)`) }
else { console.log('(no cache — pulling live from FUB)'); people = await pullAndReduce(); writeFileSync(CACHE, JSON.stringify(people)) }
console.log(`${'='.repeat(72)}\nFUB → Meta Audience Rebuild v2 (dialed-in, multi-key)\nMode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}  ·  ${people.length} cached people\n${'='.repeat(72)}`)

// ── normalization + hashing (Meta spec) ──
// Meta's /users endpoint accepts EMAIL_SHA256, PHONE_SHA256, and COMBINED keys
// (LN_FN_ZIP_SHA256, LN_FN_CT_ST_SHA256) — not standalone FN/LN/ZIP columns.
// Combined keys = SHA256 of normalized components concatenated in the named
// order, no separator. They add match signal for phone-only / no-email people.
const sha = s => createHash('sha256').update(s).digest('hex')
const tl = s => (s || '').toString().toLowerCase().trim()
const nAlnum = s => tl(s).replace(/[^a-z0-9]/g, '')
const nAlpha = s => tl(s).replace(/[^a-z]/g, '')
const nZip = z => (z || '').toString().replace(/\D/g, '').slice(0, 5)
const ST = { oregon: 'or', washington: 'wa', california: 'ca', idaho: 'id', nevada: 'nv', arizona: 'az', colorado: 'co', texas: 'tx', utah: 'ut', montana: 'mt' }
const nState = s => { const v = nAlpha(s); return ST[v] || (v.length === 2 ? v : '') }
const hEmail = e => { const v = tl(e); return v ? sha(v) : '' }
const hPhone = p => { let d = (p || '').replace(/\D/g, ''); if (d.length === 10) d = '1' + d; return d ? sha(d) : '' }

// build multi-key rows for one person (covers all emails + all phones)
function rows(p) {
  if ((p.emails || []).length === 0 && (p.phones || []).length === 0) return []
  const fn = nAlnum(p.fn), ln = nAlnum(p.ln), z = nZip(p.zip), ct = nAlpha(p.city), st = nState(p.state)
  const lnfnzip = (ln && fn && z) ? sha(ln + fn + z) : ''
  const lnfncts = (ln && fn && ct && st) ? sha(ln + fn + ct + st) : ''
  const E = [...new Set((p.emails || []).map(hEmail).filter(Boolean))]
  const P = [...new Set((p.phones || []).map(hPhone).filter(Boolean))]
  const e0 = E[0] || '', p0 = P[0] || ''
  const mk = (e, ph) => [e, ph, lnfnzip, lnfncts]
  const out = [mk(e0, p0)]
  for (const e of E.slice(1)) out.push(mk(e, p0))
  for (const ph of P.slice(1)) out.push(mk(e0, ph))
  return out
}
const SCHEMA = ['EMAIL_SHA256', 'PHONE_SHA256', 'LN_FN_ZIP_SHA256', 'LN_FN_CT_ST_SHA256']

// ── precise realtor + compliance exclusion (verified ZERO-leak 2026-06-02) ──
// Realtor detection w/ false-positive protection: broker:matt|rebecca|paul are
// CLIENT attribution (not realtors); subdivision:* are place names (e.g.
// compass-gardens); source:expired*/expired-mls:*/intent:expired*/seller:expired*
// are SELLERS (highest-value targets); owner-lookup:dnc-clear means safe-to-contact.
// Everything else matching realtor/brokerage/recruit patterns → exclusion only.
const has = (p, t) => (p.tags || []).includes(t)
const tagRe = (p, re) => (p.tags || []).some(t => re.test(t))
const txt = p => `${p.nbhd} ${p.subdiv} ${p.planned}`
const isProtected = t =>
  /^broker:(matt|rebecca|paul)\b/.test(t) ||
  /^subdivision:/.test(t) ||
  /^source:expired|^expired-mls:|^intent:expired|^seller:expired/.test(t) ||
  /^owner-lookup:dnc-clear/.test(t)
const REALTOR_RE = /(^realtor$|industry:realtor|realtor-source:|real[\s-]?estate[\s-]?agent|^migration broker$|audience:broker-recruit|broker-recruit|\brealtor\b)/
const BROKERAGE_RE = /^brokerage:/
const isRealtor = p => (p.tags || []).some(t => !isProtected(t) && (REALTOR_RE.test(t) || BROKERAGE_RE.test(t)))
// Compliance/test excluded from ads (per Matt 2026-06-02: DNC do-not-call/text
// also excluded from ad audiences). Protects owner-lookup:dnc-clear.
const COMPLIANCE_RE = /(compliance:hard-stop|compliance:dnc-registry|compliance:deceased|contact:do-not-(call|email|text)|do_not_email|do_not_text|do-not-email|do-not-text|^bounced$|^unsubscribed$|^complained$|tcpa:litigator|^litigator$|opt-out|smoketest|test record - delete|test-delete-me|^zzz-)/
const isCompliance = p => (p.tags || []).some(t => !/owner-lookup:dnc-clear/.test(t) && COMPLIANCE_RE.test(t))
const pii = p => (p.emails || []).length > 0 || (p.phones || []).length > 0
const isHard = p => isRealtor(p) || isCompliance(p) || p.hardStop === true
const clean = p => !isHard(p) && pii(p)

// ── segment set (ad-aligned). direct=true → direct-target; direct=false → LAL seed ──
const SEG = [
  { key: 'database',  name: 'RR Database — Targetable (no realtors/compliance/test)', direct: true,
    desc: 'All Matt FUB contacts w/ contact info, minus realtors/compliance/test. Broad nurture + retarget base.',
    pred: p => clean(p) },
  { key: 'westside',  name: 'RR Westside Bend Homeowners', direct: true,
    desc: 'West Bend homeowners (assessor + BatchData). "What is your West Bend home worth" ad.',
    pred: p => clean(p) && (has(p, 'area:bend-westside') || has(p, 'fb-audience:westside-all') || p.includeFBCAS === 'true') },
  { key: 'nwx',       name: 'RR NW Crossing Homeowners', direct: true,
    desc: 'NorthWest Crossing / Discovery West homeowners. NW Crossing creative.',
    pred: p => clean(p) && (tagRe(p, /neighborhood:northwest-crossing|subdivision:northwest-crossing/) || /northwest crossing|nw crossing/.test(txt(p))) },
  { key: 'awbrey',    name: 'RR Awbrey Homeowners (Butte + Glen)', direct: true,
    desc: 'Awbrey Butte + Awbrey Glen homeowners. Awbrey creatives.',
    pred: p => clean(p) && (tagRe(p, /awbrey/) || /awbrey/.test(txt(p))) },
  { key: 'riverwest', name: 'RR River West Homeowners', direct: true,
    desc: 'Bend River West neighborhood homeowners. River West creative.',
    pred: p => clean(p) && has(p, 'neighborhood:bend-river-west') },
  { key: 'summitwest', name: 'RR Summit West Homeowners', direct: true,
    desc: 'Bend Summit West neighborhood homeowners. Summit West creative.',
    pred: p => clean(p) && has(p, 'neighborhood:bend-summit-west') },
  { key: 'absentee',  name: 'RR Absentee / Out-of-Area Owners', direct: true,
    desc: 'Own in Bend, live elsewhere (local + out-of-state). "Selling your Bend rental / second home" ads.',
    pred: p => clean(p) && tagRe(p, /^owner:absentee/) },
  { key: 'highequity',name: 'RR High-Equity Owners', direct: true,
    desc: 'High + very-high equity homeowners. "Your equity is at a high" messaging.',
    pred: p => clean(p) && (tagRe(p, /^equity:(high|very-high)/) || has(p, 'high-equity') || (p.equity != null && p.equity >= 60)) },
  { key: 'tenure',    name: 'RR Long-Tenure Owners (10yr+)', direct: true,
    desc: 'Owned a long time. "The market changed since you bought" angle.',
    pred: p => clean(p) && (has(p, 'tenure:long-term') || (p.yearsOwned != null && p.yearsOwned >= 10)) },
  { key: 'luxury',    name: 'RR Luxury Owners $1M+', direct: true,
    desc: 'Estimated value $1M+. Luxury creatives (Tetherow / Broken Top / Awbrey premium).',
    pred: p => clean(p) && p.value != null && p.value >= 1000000 },
  { key: 'intent',    name: 'RR Seller-Intent — Warm + Hot', direct: true,
    desc: 'Seller-score warm/hot or seller:hot/warm tag. BOFU "free CMA today" offer.',
    pred: p => clean(p) && (['warm', 'hot'].includes(p.scoreBand) || tagRe(p, /seller:hot|seller:warm/)) },
  // ── LAL seeds (small, high-value — NOT direct-targeted) ──
  { key: 'expired',   name: 'RR Expired/Canceled Listings (seed)', direct: false,
    desc: 'Expired / canceled / withdrawn listings (status or tag). Lookalike + retarget seed. High seller intent.',
    pred: p => clean(p) && (['expired', 'canceled', 'cancelled/leased', 'withdrawn'].includes(p.listingStatus) || tagRe(p, /intent:expired-listing|seller:expired|source:expired-listing-mls|^expired-mls:/)) },
  { key: 'tetherow',  name: 'RR Tetherow Owners (seed)', direct: false,
    desc: 'Tetherow homeowners (tag or community field). Lookalike seed for the Tetherow creative.',
    pred: p => clean(p) && (has(p, 'neighborhood:tetherow') || /tetherow/.test(txt(p))) },
  { key: 'brokentop', name: 'RR Broken Top Owners (seed)', direct: false,
    desc: 'Broken Top homeowners (tag or community field). Lookalike seed for the Broken Top creative.',
    pred: p => clean(p) && (has(p, 'neighborhood:broken-top') || /broken.?top/.test(txt(p))) },
  // ── exclusion ──
  { key: 'exclude',   name: 'RR FUB Hard-Stop Exclusion (realtors+compliance+test)', direct: null, exclusion: true,
    desc: 'Realtors, brokerages, broker-recruits, DNC/compliance, bounced, unsubscribed, deceased, test. EXCLUSION on every ad set.',
    pred: p => isHard(p) && pii(p) },
]

// ── segment + dedupe rows ──
console.log('\n## Segment sizes (people / pushed rows). >1,000 matched needs ~1,800+ pushed at phone-heavy match.\n')
const built = {}
for (const s of SEG) {
  const seen = new Set(); const data = []; let ppl = 0
  for (const p of people) {
    if (!s.pred(p)) continue
    ppl++
    for (const r of rows(p)) { const k = r.join('|'); if (!seen.has(k)) { seen.add(k); data.push(r) } }
  }
  built[s.key] = { ppl, data }
  const role = s.exclusion ? 'EXCL ' : s.direct ? 'DIRECT' : 'SEED '
  const flag = (s.direct && ppl < 1800) ? '  ⚠ small for direct → consider LAL only' : ''
  console.log(`  [${role}] people ${String(ppl).padStart(6)}  rows ${String(data.length).padStart(6)}  ${s.name}${flag}`)
}

if (DRY_RUN) { console.log('\n(DRY RUN — no Meta writes.)'); process.exit(0) }

// ── push to Meta ──
const API = 'https://graph.facebook.com/v21.0'
async function meta(method, path, body) {
  const sep = path.includes('?') ? '&' : '?'
  const r = await fetch(`${API}/${path}${sep}access_token=${encodeURIComponent(META_TOKEN)}`, {
    method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const t = await r.text(); let b; try { b = JSON.parse(t) } catch { b = t }
  return { ok: r.ok, status: r.status, body: b }
}
async function findOrCreate(name, desc) {
  const list = await meta('GET', `${AD_ACCT}/customaudiences?fields=id,name&limit=500`)
  const ex = (list.body.data ?? []).find(a => a.name === name)
  if (ex) { console.log(`  ✓ found "${name}" (${ex.id})`); return ex.id }
  const c = await meta('POST', `${AD_ACCT}/customaudiences`, { name, description: desc, subtype: 'CUSTOM', customer_file_source: 'USER_PROVIDED_ONLY' })
  if (!c.ok) throw new Error(`create "${name}": ${JSON.stringify(c.body).slice(0, 250)}`)
  console.log(`  ✓ created "${name}" (${c.body.id})`); return c.body.id
}
async function push(caId, data) {
  let recv = 0, inv = 0
  for (let i = 0; i < data.length; i += 5000) {
    const batch = data.slice(i, i + 5000)
    const r = await meta('POST', `${caId}/users`, { payload: { schema: SCHEMA, data: batch } })
    if (!r.ok) { console.warn(`     ! batch ${i}: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`); continue }
    recv += r.body?.num_received ?? batch.length; inv += r.body?.num_invalid_entries ?? 0
  }
  return { recv, inv }
}

console.log('\n## APPLY\n')
const result = { adAccount: AD_ACCT, schema: SCHEMA, audiences: {} }
for (const s of SEG) {
  if (ONLY && s.key !== ONLY) continue
  const { ppl, data } = built[s.key]
  console.log(`\n• ${s.name}  (${ppl} people / ${data.length} rows)`)
  const id = await findOrCreate(s.name, s.desc)
  const { recv, inv } = await push(id, data)
  console.log(`  ✓ pushed ${recv} (invalid ${inv})`)
  result.audiences[s.key] = { id, name: s.name, people: ppl, rows: data.length, received: recv, role: s.exclusion ? 'exclusion' : s.direct ? 'direct' : 'seed' }
}
const OUT = resolve(join(process.cwd(), 'out', 'meta-fub-audiences', new Date().toISOString().replace(/[:.]/g, '-')))
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'result.json'), JSON.stringify(result, null, 2))
console.log(`\n${'='.repeat(72)}\nIDs → ${join(OUT, 'result.json')}`)
for (const [k, v] of Object.entries(result.audiences)) console.log(`  ${k.padEnd(11)} ${v.id}  [${v.role}]  ${v.name}`)
console.log('\nLookalikes off the direct/seed audiences are the next step once Meta matches (~30m–2h).')
