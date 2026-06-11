#!/usr/bin/env node
// Thorough dedup analysis across THREE planes:
//  A. Farm-internal: APN already deduped, but same OWNER owning multiple parcels
//     (multi-property owners) — not dup people, but must merge to ONE FUB update.
//  B. Farm->FUB: multiple farm properties matching the SAME FUB person id.
//  C. FUB-internal: duplicate PEOPLE already in FUB (same phone or email on two
//     different person ids) — the real "dedupe anything" target.
import fs from 'node:fs'
const OUT = '/Users/matthewryan/RyanRealty/out/farm-merge'
const recs = JSON.parse(fs.readFileSync(OUT + '/03c-matched.json', 'utf8'))
const { phoneIdx, emailIdx, nameIdx } = JSON.parse(fs.readFileSync(OUT + '/03b-live-index.json', 'utf8'))
const digits = s => (s || '').replace(/\D/g, '').replace(/^1(\d{10})$/, '$1')
const norm = s => (s || '').trim().toLowerCase()

// ---------- A. multi-parcel owners within farm set ----------
const matched = recs.filter(r => r.fub_match)
const byFubId = {}
for (const r of matched) { const id = r.fub_match.id; (byFubId[id] = byFubId[id] || []).push(r) }
const multiParcel = Object.entries(byFubId).filter(([, v]) => v.length > 1)
const A = {
  fub_contacts_matched: Object.keys(byFubId).length,
  contacts_with_multiple_farm_parcels: multiParcel.length,
  extra_parcel_rows: multiParcel.reduce((s, [, v]) => s + v.length - 1, 0),
}

// ---------- C. duplicate PEOPLE in FUB (need full person list w/ ids) ----------
// rebuild person->keys from the index (index maps key->{id,name}); invert to id->keys
// Better: re-derive from raw by scanning index values for shared ids across keys.
// phoneIdx: phone -> {id,...}. Build id -> set(phones), id -> set(emails).
const idPhones = {}, idEmails = {}, idName = {}
for (const [ph, rec] of Object.entries(phoneIdx)) { (idPhones[rec.id] = idPhones[rec.id] || new Set()).add(ph); idName[rec.id] = rec.name }
for (const [em, rec] of Object.entries(emailIdx)) { (idEmails[rec.id] = idEmails[rec.id] || new Set()).add(em); idName[rec.id] = rec.name }

// dup people = two different ids sharing a phone OR an email
// invert: phone -> [ids], email -> [ids]
const phoneToIds = {}, emailToIds = {}
for (const [id, set] of Object.entries(idPhones)) for (const ph of set) (phoneToIds[ph] = phoneToIds[ph] || new Set()).add(id)
for (const [id, set] of Object.entries(idEmails)) for (const em of set) (emailToIds[em] = emailToIds[em] || new Set()).add(id)
// NOTE: index stored ONE rec per key (last writer wins), so a shared phone across 2 ids
// would have collapsed. To truly find dup people we must look at it differently:
// the index can't reveal collisions it overwrote. Flag this limitation.

const C_note = 'phone/email index kept one id per key (last-writer-wins), so FUB-internal dup-people detection needs a raw re-scan — see step 5b.'

fs.writeFileSync(OUT + '/05-dedup-A.json', JSON.stringify({
  ...A,
  examples_multi_parcel: multiParcel.slice(0, 15).map(([id, v]) => ({ fub_id: id, name: v[0].fub_match.name, parcels: v.length, addresses: v.map(x => x.site_address) })),
}, null, 2))
console.log('=== A. Multi-parcel owners (farm) ===')
console.log(JSON.stringify(A, null, 2))
console.log('\n=== C. FUB-internal dup-people ===')
console.log(C_note)
