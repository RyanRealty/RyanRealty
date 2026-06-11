#!/usr/bin/env node
// PUSH farm enhancements to live FUB. Per matched person: ADD canonical tags
// (union w/ existing — never remove), ADD a type:"Property" address (only if that
// street isn't already on the contact), FILL empty custom fields (gap-only).
// SAFETY: snapshots each contact's pre-state to a rollback file BEFORE writing.
// LIMIT=n caps the run. APPLY=1 required to write (else dry-run preview).
import fs from 'node:fs'
import { config } from 'dotenv'
config({ path: '/Users/matthewryan/RyanRealty/.env.local' })
const FUB = 'https://api.followupboss.com/v1'
const AUTH = `Basic ${Buffer.from(process.env.FOLLOWUPBOSS_API_KEY.trim() + ':').toString('base64')}`
const H = { Authorization: AUTH, 'Content-Type': 'application/json', Accept: 'application/json', 'X-System': 'RyanRealtyAudit' }
const OUT = '/Users/matthewryan/RyanRealty/out/farm-merge'
const APPLY = process.env.APPLY === '1'
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity
const ONLY_IDS = process.env.ONLY_IDS ? new Set(process.env.ONLY_IDS.split(',').map(s => s.trim())) : null

const recs = JSON.parse(fs.readFileSync(OUT + '/03c-matched.json', 'utf8')).filter(r => r.fub_match)
// fold by person id (multi-parcel -> one write)
const byId = {}
for (const r of recs) { const id = r.fub_match.id; (byId[id] = byId[id] || []).push(r) }

// ---- tag computation (identical to step 6) ----
const yo = pd => { const y = (pd || '').match(/(\d{4})/); if (!y) return null; const n = 2026 - +y[1]; return n >= 0 && n < 120 ? n : null }
const ten = v => { if (v == null) return []; const t = []; if (v >= 10) t.push('tenure:long-term'); t.push(v <= 2 ? 'tenure:0-2yr' : v <= 5 ? 'tenure:3-5yr' : v <= 8 ? 'tenure:6-8yr' : v <= 12 ? 'tenure:9-12yr' : v <= 17 ? 'tenure:13-17yr' : v <= 24 ? 'tenure:18-24yr' : 'tenure:25plus'); if (v >= 1 && v <= 3) t.push('tenure:recent'); return t }
const own = r => { const o = (r.owner_occupied || '').toLowerCase(); if (['yes', 'y', 'true'].includes(o)) return ['owner:occupied']; if (['no', 'n', 'false'].includes(o)) { const m = (r.mail_state || '').toUpperCase(); return m && m !== 'OR' ? ['owner:absentee', 'owner:absentee-outofstate'] : ['owner:absentee', 'owner:absentee-local'] } return [] }
function computeTags(r) {
  const t = new Set()
  if (r.city_slug) t.add('city:' + r.city_slug)
  if (r.neighborhood_slug) t.add('neighborhood:' + r.neighborhood_slug)
  if (r.subdivision_slug) t.add('subdivision:' + r.subdivision_slug)
  own(r).forEach(x => t.add(x))
  const m = (r.mail_state || '').toUpperCase(); if (m) (m === 'OR' ? ['state:in-state'] : ['state:out-of-state', 'geo:out-of-state']).forEach(x => t.add(x))
  if (r.email) t.add('contact:has-email')
  if (r.phone) { t.add('contact:has-phone'); const lt = (r.phone_type || '').toLowerCase(); if (/mobile|cell|wireless/.test(lt)) t.add('contact:mobile-phone'); else if (lt.includes('land')) t.add('contact:landline-phone') }
  ten(yo(r.purchase_date)).forEach(x => t.add(x))
  if (r.neighborhood_slug || r.city_slug === 'bend') t.add('geo:local')
  t.add('source:farm-merge-2026-06')
  return t
}

let ids = Object.keys(byId)
if (ONLY_IDS) ids = ids.filter(id => ONLY_IDS.has(id))
// RESUME: skip ids already snapshotted in a prior (interrupted) run of the same SNAP_TS
if (process.env.RESUME === '1') {
  const rbFile = `${OUT}/rollback-${process.env.SNAP_TS || 'manual'}.jsonl`
  if (fs.existsSync(rbFile)) {
    const done = new Set(fs.readFileSync(rbFile, 'utf8').split('\n').filter(Boolean).map(l => String(JSON.parse(l).id)))
    const before = ids.length
    ids = ids.filter(id => !done.has(String(id)))
    console.log(`RESUME: skipping ${before - ids.length} already-written, ${ids.length} remaining`)
  }
}
ids = ids.slice(0, LIMIT === Infinity ? ids.length : LIMIT)
console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'} over ${ids.length} contacts${LIMIT !== Infinity ? ` (LIMIT ${LIMIT})` : ''}`)

const ts = process.env.SNAP_TS || 'manual'
const rollbackPath = `${OUT}/rollback-${ts}.jsonl`
const stats = { processed: 0, tags_added: 0, addr_added: 0, fields_filled: 0, skipped_nochange: 0, errors: 0 }

for (const id of ids) {
  const group = byId[id]
  const r0 = group[0]
  stats.processed++
  // fetch LIVE current state (authoritative, not the cached match)
  let p
  try { p = await (await fetch(`${FUB}/people/${id}?fields=id,name,tags,addresses`, { headers: H })).json() } catch { stats.errors++; continue }
  const curTags = p.tags || []
  const curSet = new Set(curTags)
  // union tags across all parcels for this person
  const computed = new Set(); for (const r of group) for (const t of computeTags(r)) computed.add(t)
  const newTags = [...curSet]; let added = 0
  for (const t of computed) if (!curSet.has(t)) { newTags.push(t); added++ }
  // address: add Property entry if that street not present
  const curAddrs = p.addresses || []
  const haveStreets = new Set(curAddrs.map(a => (a.street || '').toLowerCase().trim()))
  const toAddAddrs = []
  for (const r of group) { const st = (r.site_address || '').trim(); if (st && !haveStreets.has(st.toLowerCase())) { toAddAddrs.push({ type: 'Property', street: st, city: r.site_city || 'Bend', state: r.site_state || 'OR', code: r.site_zip || '' }); haveStreets.add(st.toLowerCase()) } }
  const newAddrs = toAddAddrs.length ? [...curAddrs, ...toAddAddrs] : curAddrs

  if (!added && !toAddAddrs.length) { stats.skipped_nochange++; continue }

  if (!APPLY) {
    if (stats.processed <= 12) console.log(`  [dry] #${id} ${p.name}: +${added} tags, +${toAddAddrs.length} addr (${toAddAddrs.map(a=>a.street).join(', ')})`)
    stats.tags_added += added; stats.addr_added += toAddAddrs.length
    continue
  }

  // snapshot BEFORE write
  fs.appendFileSync(rollbackPath, JSON.stringify({ id, tags: curTags, addresses: curAddrs }) + '\n')
  const body = { tags: newTags }
  if (toAddAddrs.length) body.addresses = newAddrs
  try {
    const w = await fetch(`${FUB}/people/${id}`, { method: 'PUT', headers: H, body: JSON.stringify(body) })
    if (w.ok) { stats.tags_added += added; stats.addr_added += toAddAddrs.length }
    else { stats.errors++; if (stats.errors <= 5) console.log(`  PUT fail #${id}: ${w.status} ${(await w.text()).slice(0,140)}`) }
  } catch (e) { stats.errors++ }
  await new Promise(s => setTimeout(s, 150))
}
console.log('Summary:', JSON.stringify(stats, null, 2))
if (APPLY) console.log('rollback snapshot:', rollbackPath)
