#!/usr/bin/env node
// FINAL assembly. Produces:
//  1) MASTER-farm-enhance-existing.csv — ONE ROW PER PERSON (multi-parcel owners
//     folded: all their parcels' addresses + union of tags on a single row).
//  2) FUB-duplicate-people.csv — HIGH/MED confidence dup clusters with a
//     recommended survivor (most tags) + records to merge into it.
// READ-ONLY (no FUB writes).
import fs from 'node:fs'
const OUT = '/Users/matthewryan/RyanRealty/out/farm-merge'
const recs = JSON.parse(fs.readFileSync(OUT + '/03c-matched.json', 'utf8')).filter(r => r.fub_match)
const dupes = JSON.parse(fs.readFileSync(OUT + '/05c-true-dupes.json', 'utf8'))

const yearsOwned = pd => { const y = (pd || '').match(/(\d{4})/); if (!y) return null; const n = 2026 - parseInt(y[1]); return n >= 0 && n < 120 ? n : null }
const tenure = yo => { if (yo == null) return []; const t = []; if (yo >= 10) t.push('tenure:long-term'); t.push(yo <= 2 ? 'tenure:0-2yr' : yo <= 5 ? 'tenure:3-5yr' : yo <= 8 ? 'tenure:6-8yr' : yo <= 12 ? 'tenure:9-12yr' : yo <= 17 ? 'tenure:13-17yr' : yo <= 24 ? 'tenure:18-24yr' : 'tenure:25plus'); if (yo >= 1 && yo <= 3) t.push('tenure:recent'); return t }
function owner(r) { const oo = (r.owner_occupied || '').toLowerCase(); if (['yes', 'y', 'true'].includes(oo)) return ['owner:occupied']; if (['no', 'n', 'false'].includes(oo)) { const ms = (r.mail_state || '').toUpperCase(); return ms && ms !== 'OR' ? ['owner:absentee', 'owner:absentee-outofstate'] : ['owner:absentee', 'owner:absentee-local'] } return [] }
function computeTags(r) {
  const t = new Set()
  if (r.city_slug) t.add(`city:${r.city_slug}`)
  if (r.neighborhood_slug) t.add(`neighborhood:${r.neighborhood_slug}`)
  if (r.subdivision_slug) t.add(`subdivision:${r.subdivision_slug}`)
  owner(r).forEach(x => t.add(x))
  const ms = (r.mail_state || '').toUpperCase(); if (ms) (ms === 'OR' ? ['state:in-state'] : ['state:out-of-state', 'geo:out-of-state']).forEach(x => t.add(x))
  if (r.email) t.add('contact:has-email')
  if (r.phone) { t.add('contact:has-phone'); const lt = (r.phone_type || '').toLowerCase(); if (/mobile|cell|wireless/.test(lt)) t.add('contact:mobile-phone'); else if (lt.includes('land')) t.add('contact:landline-phone') }
  tenure(yearsOwned(r.purchase_date)).forEach(x => t.add(x))
  if (r.neighborhood_slug || r.city_slug === 'bend') t.add('geo:local')
  t.add('source:farm-merge-2026-06')
  return t
}

// fold by FUB person id (multi-parcel owners → one row)
const byId = {}
for (const r of recs) { const id = r.fub_match.id; (byId[id] = byId[id] || []).push(r) }

const esc = s => { s = (s ?? '').toString(); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
const cols = ['fub_id', 'fub_name', 'fub_stage', 'match_method', 'parcels', 'owner', 'primary_address', 'all_addresses', 'neighborhood(s)', 'subdivision(s)', 'email', 'phone', 'TAGS_TO_ADD', 'property_fields_to_fill']
const lines = [cols.join(',')]
const addHist = {}
let multi = 0
for (const [id, group] of Object.entries(byId)) {
  if (group.length > 1) multi++
  const m = group[0].fub_match
  const current = new Set(m.tags || [])
  const computed = new Set()
  for (const r of group) for (const t of computeTags(r)) computed.add(t)
  const toAdd = [...computed].filter(t => !current.has(t))
  toAdd.forEach(t => addHist[t] = (addHist[t] || 0) + 1)
  const addrs = group.map(r => r.site_address).filter(Boolean)
  const nbhds = [...new Set(group.map(r => r.neighborhood_slug).filter(Boolean))]
  const subs = [...new Set(group.map(r => r.subdivision_slug).filter(Boolean))]
  const row = {
    fub_id: id, fub_name: m.name, fub_stage: m.stage, match_method: m.how, parcels: group.length,
    owner: `${group[0].owner_first} ${group[0].owner_last}`.trim(),
    primary_address: addrs[0] || '', all_addresses: addrs.join(' | '),
    'neighborhood(s)': nbhds.join('; '), 'subdivision(s)': subs.join('; '),
    email: group[0].email, phone: group[0].phone,
    TAGS_TO_ADD: toAdd.join('; '),
    property_fields_to_fill: ['property-address', 'APN', group[0].beds && 'beds', group[0].baths && 'baths', group[0].year_built && 'year-built', group[0].purchase_price && 'purchase-price', group[0].market_value && 'market-value'].filter(Boolean).join('; '),
  }
  lines.push(cols.map(c => esc(row[c])).join(','))
}
fs.writeFileSync(OUT + '/MASTER-farm-enhance-existing.csv', lines.join('\n'))

// dup-people report with recommended survivor (richer record = more tags, then newer)
// We only have member name/created/stage in 05c; survivor recommendation needs tag counts -> note rule.
const dupCols = ['confidence', 'cluster_size', 'recommended_keep_id', 'merge_ids', 'names', 'created_dates', 'stages']
const dupLines = [dupCols.join(',')]
for (const tier of ['HIGH', 'MED']) for (const c of (dupes[tier] || [])) {
  // recommend keep = the Seller Prospect if present else newest id
  const sp = c.members.find(m => m.stage === 'Seller Prospect')
  const keep = sp ? sp.id : c.members.slice().sort((a, b) => (b.created || '').localeCompare(a.created || ''))[0].id
  const merge = c.members.filter(m => m.id !== keep).map(m => m.id)
  dupLines.push([tier, c.size, keep, merge.join(' '), c.members.map(m => m.name).join(' | '), c.members.map(m => m.created).join(' '), c.members.map(m => m.stage).join(' | ')].map(esc).join(','))
}
fs.writeFileSync(OUT + '/FUB-duplicate-people.csv', dupLines.join('\n'))

const summary = {
  master_csv: { unique_people: Object.keys(byId).length, of_which_multi_parcel: multi, total_parcels_represented: recs.length },
  dup_people_report: { HIGH: dupes.summary.HIGH_confidence_clusters, HIGH_removable: dupes.summary.HIGH_removable, MED: dupes.summary.MED_confidence_clusters, MED_removable: dupes.summary.MED_removable, LOW_needs_review: dupes.summary.LOW_review_clusters },
  files: ['MASTER-farm-enhance-existing.csv', 'FUB-duplicate-people.csv'],
}
fs.writeFileSync(OUT + '/06-final-summary.json', JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
