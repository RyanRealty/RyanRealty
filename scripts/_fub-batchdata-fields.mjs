// READ-ONLY: sample FUB contacts, bucket by BatchData enrichment, and compare
// which fields are populated in each bucket. Shows what BatchData actually adds.
// Reports populate-RATES per field (no individual PII dumped).
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

// fields to test, grouped
const FIELDS = {
  'Contact (skip-trace)': {
    'email address(es)': p => (p.emails || []).length > 0,
    'phone number(s)': p => (p.phones || []).length > 0,
    'phone type (mobile/landline)': p => !!p.customPhoneType,
  },
  'Property / ownership': {
    'estimated market value (AVM)': p => p.customEstimatedMarketValue || p.customMarketValue,
    'equity %': p => p.customEquityPct || p.customEquityPercent,
    'years owned': p => p.customYearsOwned,
    'last purchase date': p => p.customLastPurchaseDate || p.customPurchaseDate,
    'purchase price': p => p.customPurchasePrice,
    'year built': p => p.customYearBuilt,
    'building sqft': p => p.customBuildingSqft,
    'lot acres': p => p.customLotAcres,
    'APN (parcel #)': p => p.customAPN,
  },
  'Demographic / household': {
    'owner age': p => p.customOwnerAge || p.customOwnerAgeRange,
    'net worth range': p => p.customNetWorthRange,
    'income range': p => p.customIncomeRange,
    'marital status': p => p.customMaritalStatus,
    'has children': p => p.customHasChildren,
    'household size': p => p.customHouseholdSize,
    'gender': p => p.customGender,
    'occupation': p => p.customOccupation,
  },
  'Life-event signals': {
    'recently moved': p => p.customRecentlyMoved,
    'recently divorced': p => p.customRecentlyDivorced,
  },
}

const enr = { n: 0, hits: {} }, non = { n: 0, hits: {} }
for (const grp of Object.values(FIELDS)) for (const k of Object.keys(grp)) { enr.hits[k] = 0; non.hits[k] = 0 }

let path = '/v1/people?limit=100&fields=allFields'
let pages = 0
while (path && pages < 40 && (enr.n < 200 || non.n < 200)) {
  const d = await getJson(path)
  const ppl = d.people || []
  if (!ppl.length) break
  for (const p of ppl) {
    const bucket = (p.customEnrichmentProvider || '').trim() ? enr : non
    bucket.n++
    for (const grp of Object.values(FIELDS)) for (const [k, fn] of Object.entries(grp)) {
      let v; try { v = fn(p) } catch { v = null }
      if (v !== null && v !== undefined && v !== '' && v !== false) bucket.hits[k]++
    }
  }
  pages++
  path = d._metadata?.nextLink || null
}

const rate = (b, k) => b.n ? Math.round(100 * b.hits[k] / b.n) + '%' : '-'
console.log(`Sampled: ${enr.n} BatchData-enriched + ${non.n} non-enriched contacts\n`)
console.log(`${''.padEnd(34)} enriched   non-enriched`)
for (const [grp, fields] of Object.entries(FIELDS)) {
  console.log(`\n${grp}`)
  for (const k of Object.keys(fields)) {
    console.log(`  ${k.padEnd(32)} ${rate(enr,k).padStart(6)}     ${rate(non,k).padStart(6)}`)
  }
}
