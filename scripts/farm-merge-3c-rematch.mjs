#!/usr/bin/env node
// Re-match all farm properties against the COMPLETE live FUB index (all phones,
// all emails). Match priority: email(any) -> phone(any, incl alternates) ->
// unique name. Writes 03c-matched.json (replaces export-based 03).
import fs from 'node:fs'
const OUT = '/Users/matthewryan/RyanRealty/out/farm-merge'
const { phoneIdx, emailIdx, nameIdx } = JSON.parse(fs.readFileSync(OUT + '/03b-live-index.json', 'utf8'))
const recs = JSON.parse(fs.readFileSync(OUT + '/02-geocoded.json', 'utf8'))

const digits = s => (s || '').replace(/\D/g, '').replace(/^1(\d{10})$/, '$1')
const norm = s => (s || '').trim().toLowerCase()

let mEmail = 0, mPhone = 0, mAltPhone = 0, mName = 0, isNew = 0
for (const r of recs) {
  let hit = null, how = null
  // 1) email (any FUB email field)
  if (r.email && emailIdx[norm(r.email)]) { hit = emailIdx[norm(r.email)]; how = 'email' }
  // 2) primary phone (any FUB phone field)
  if (!hit && r.phone) { const k = digits(r.phone); if (k.length === 10 && phoneIdx[k]) { hit = phoneIdx[k]; how = 'phone' } }
  // 3) alternate phones from the farm record
  if (!hit && Array.isArray(r.alt_phones)) {
    for (const ap of r.alt_phones) { const k = digits(ap); if (k.length === 10 && phoneIdx[k]) { hit = phoneIdx[k]; how = 'alt-phone'; break } }
  }
  // 4) unique name (only if exactly one FUB contact has that name)
  if (!hit) {
    const nk = norm(`${r.owner_first} ${r.owner_last}`)
    const c = nk.trim() ? nameIdx[nk] : null
    if (c && c.length === 1) { hit = c[0]; how = 'name-unique' }
  }
  if (hit) {
    r.fub_match = { id: hit.id, name: hit.name, stage: hit.stage, tags: hit.tags, how }
    if (how === 'email') mEmail++; else if (how === 'phone') mPhone++; else if (how === 'alt-phone') mAltPhone++; else mName++
  } else { r.fub_match = null; isNew++ }
}
fs.writeFileSync(OUT + '/03c-matched.json', JSON.stringify(recs))
const summary = {
  total_properties: recs.length,
  matched_existing: recs.length - isNew,
  by_email: mEmail, by_phone: mPhone, by_alt_phone: mAltPhone, by_unique_name: mName,
  STILL_NEW: isNew,
  still_new_with_contact: recs.filter(r => !r.fub_match && (r.email || r.phone)).length,
}
fs.writeFileSync(OUT + '/03c-summary.json', JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
