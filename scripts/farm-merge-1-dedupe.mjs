#!/usr/bin/env node
// STEP 1 of farm merge. Load every farm CSV in ~/Downloads, normalize to one
// schema, dedupe by APN (merging contact info from per-neighborhood exports into
// the property backbone). Writes out/farm-merge/01-deduped.json + a summary.
// READ-ONLY on FUB — pure file processing.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const DL = path.join(os.homedir(), 'Downloads')
const OUT = '/Users/matthewryan/RyanRealty/out/farm-merge'
fs.mkdirSync(OUT, { recursive: true })

// minimal robust CSV parser (handles quotes, embedded commas/newlines)
function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false }
      else cur += c
    } else {
      if (c === '"') q = true
      else if (c === ',') { row.push(cur); cur = '' }
      else if (c === '\r') {}
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
      else cur += c
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row) }
  return rows
}
function toObjs(text) {
  const rows = parseCSV(text); if (!rows.length) return []
  const hdr = rows[0].map(h => h.trim())
  return rows.slice(1).filter(r => r.length > 1).map(r => { const o = {}; hdr.forEach((h, i) => o[h] = (r[i] ?? '').trim()); return o })
}

// identify farm files = have "APN / Parcel Number" + "Site Address",
// AND modified within the last RECENT_MIN minutes (default 90) so we use only
// the freshly-downloaded farm set, not stale older exports.
const RECENT_MIN = process.env.RECENT_MIN ? parseInt(process.env.RECENT_MIN, 10) : 90
const cutoff = Date.now() - RECENT_MIN * 60 * 1000
const files = fs.readdirSync(DL).filter(f => /^export.*\.csv$/i.test(f))
const farmFiles = []
for (const f of files) {
  const fp = path.join(DL, f)
  if (fs.statSync(fp).mtimeMs < cutoff) continue   // skip stale files
  const head = fs.readFileSync(fp, 'utf8').slice(0, 2000)
  if (head.includes('APN / Parcel Number') && head.includes('Site Address')) farmFiles.push(f)
}
console.log(`(recency filter: last ${RECENT_MIN} min)`)
console.log('farm files:', farmFiles.length, farmFiles.join(', '))

const norm = s => (s || '').trim()
const apnKey = o => (norm(o['APN / Parcel Number (text)']) || norm(o['APN / Parcel Number'])).replace(/[^0-9A-Za-z]/g, '').toUpperCase()

const merged = new Map()  // apn -> record
let totalRows = 0, withContact = 0, noApn = 0

for (const f of farmFiles) {
  const objs = toObjs(fs.readFileSync(path.join(DL, f), 'utf8'))
  for (const o of objs) {
    totalRows++
    const apn = apnKey(o)
    if (!apn) { noApn++; continue }
    const rec = merged.get(apn) || {
      apn,
      apn_raw: norm(o['APN / Parcel Number']) || norm(o['APN / Parcel Number (text)']),
      site_address: norm(o['Site Address']), site_city: norm(o['Site City']), site_state: norm(o['Site State']) || 'OR', site_zip: norm(o['Site Zip Code']),
      lat: norm(o['Latitude']), lng: norm(o['Longitude']),
      county: norm(o['County']),
      beds: norm(o['Bedrooms']), baths: norm(o['Baths']), bldg_sqft: norm(o['Building Size']), lot_sqft: norm(o['Lot Size (SqFt)']), acreage: norm(o['Acreage']),
      prop_type: norm(o['Property Type']), owner_occupied: norm(o['Owner Occupied']),
      owner_first: norm(o["1st Owner's First Name"]), owner_last: norm(o["1st Owner's Last Name"]),
      owner2_first: norm(o["2nd Owner's First Name"]), owner2_last: norm(o["2nd Owner's Last Name"]),
      all_owners: norm(o['All Owners']),
      purchase_date: norm(o['Purchase Date']), purchase_price: norm(o['Purchase Price']),
      subdivision: norm(o['Subdivision']), year_built: norm(o['Year Built']),
      mail_address: norm(o['Mail Address']), mail_city: norm(o['Mailing City']), mail_state: norm(o['Mailing State']), mail_zip: norm(o['Mailing Zip Code']),
      assessed_value: norm(o['Assessed Value']), market_value: norm(o['Market Value (Assessed)']),
      email: '', phone: '', phone_type: '', alt_phones: [],
      sources: [],
    }
    // enrich contact fields if this file has them and rec is missing them
    if (norm(o['Email']) && !rec.email) rec.email = norm(o['Email']).toLowerCase()
    if (norm(o['Phone']) && !rec.phone) { rec.phone = norm(o['Phone']); rec.phone_type = norm(o['Line Type']) }
    for (let i = 1; i <= 5; i++) { const ap = norm(o[`Alternate Phone ${i}`]); if (ap && !rec.alt_phones.includes(ap)) rec.alt_phones.push(ap) }
    // fill any blank property field from a later file
    for (const [k, src] of [['beds','Bedrooms'],['baths','Baths'],['purchase_price','Purchase Price'],['year_built','Year Built'],['subdivision','Subdivision'],['market_value','Market Value (Assessed)']]) {
      if (!rec[k] && norm(o[src])) rec[k] = norm(o[src])
    }
    if (!rec.sources.includes(f)) rec.sources.push(f)
    merged.set(apn, rec)
  }
}

const recs = [...merged.values()]
for (const r of recs) if (r.email || r.phone) withContact++

const summary = {
  farm_files: farmFiles.length,
  total_raw_rows: totalRows,
  rows_without_apn: noApn,
  unique_properties_by_apn: recs.length,
  duplicates_collapsed: totalRows - noApn - recs.length,
  with_email_or_phone: withContact,
  with_email: recs.filter(r => r.email).length,
  with_phone: recs.filter(r => r.phone).length,
  with_latlng: recs.filter(r => r.lat && r.lng).length,
  with_owner_name: recs.filter(r => r.owner_first || r.owner_last).length,
}
fs.writeFileSync(path.join(OUT, '01-deduped.json'), JSON.stringify(recs))
fs.writeFileSync(path.join(OUT, '01-summary.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
