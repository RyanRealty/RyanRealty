#!/usr/bin/env node
// STEP 3: match each geocoded farm property to existing FUB contacts (from the
// all-people export). Match keys in priority: email, then owner-name+site/mail
// address, then phone. Classify existing-match vs NEW. Writes 03-matched.json.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
const OUT = '/Users/matthewryan/RyanRealty/out/farm-merge'
const DL = path.join(os.homedir(), 'Downloads')

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
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
      else cur += c
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row) }
  return rows
}
function toObjs(text){const rows=parseCSV(text);if(!rows.length)return[];const h=rows[0].map(x=>x.trim());return rows.slice(1).filter(r=>r.length>1).map(r=>{const o={};h.forEach((k,i)=>o[k]=(r[i]??'').trim());return o})}

const norm = s => (s || '').trim().toLowerCase()
const digits = s => (s || '').replace(/\D/g, '').replace(/^1(\d{10})$/, '$1')
const nameKey = (f, l) => `${norm(f)} ${norm(l)}`.replace(/\s+/g, ' ').trim()
const addrKey = s => norm(s).replace(/\b(st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|way|pl|place|blvd|cir|circle|loop|ter|terrace|pkwy|hwy|trl|trail)\b/g, '').replace(/[^a-z0-9]/g, '')

// load FUB
const fub = toObjs(fs.readFileSync(path.join(DL, 'all-people-2026-06-01.csv'), 'utf8'))
const byEmail = new Map(), byName = new Map(), byPhone = new Map()
for (const p of fub) {
  const em = norm(p['Email 1']); if (em) byEmail.set(em, p)
  const nm = nameKey((p['Name'] || '').split(' ')[0], (p['Name'] || '').split(' ').slice(1).join(' '))
  if (nm) { if (!byName.has(nm)) byName.set(nm, []); byName.get(nm).push(p) }
  const ph = digits(p['Phone 1']); if (ph && ph.length === 10) byPhone.set(ph, p)
}

const recs = JSON.parse(fs.readFileSync(OUT + '/02-geocoded.json', 'utf8'))
let mEmail = 0, mName = 0, mPhone = 0, isNew = 0
for (const r of recs) {
  let hit = null, how = null
  if (r.email && byEmail.has(r.email)) { hit = byEmail.get(r.email); how = 'email' }
  if (!hit) {
    const nk = nameKey(r.owner_first, r.owner_last)
    const cands = nk ? byName.get(nk) : null
    if (cands && cands.length) {
      // confirm with address overlap if FUB row had any address-ish field — FUB export has none,
      // so a unique name match is accepted; ambiguous (>1) requires phone/email to disambiguate.
      if (cands.length === 1) { hit = cands[0]; how = 'name' }
      else {
        // disambiguate by phone
        const ph = digits(r.phone)
        const byp = cands.find(c => digits(c['Phone 1']) === ph && ph.length === 10)
        if (byp) { hit = byp; how = 'name+phone' }
      }
    }
  }
  if (!hit && r.phone) { const ph = digits(r.phone); if (ph.length === 10 && byPhone.has(ph)) { hit = byPhone.get(ph); how = 'phone' } }
  if (hit) {
    r.fub_match = { name: hit['Name'], email: hit['Email 1'] || '', stage: hit['Stage'], how }
    if (how === 'email') mEmail++; else if (how.startsWith('name')) mName++; else mPhone++
  } else { r.fub_match = null; isNew++ }
}
fs.writeFileSync(OUT + '/03-matched.json', JSON.stringify(recs))
const summary = {
  total_properties: recs.length,
  matched_existing: recs.length - isNew,
  by_email: mEmail, by_name: mName, by_phone: mPhone,
  NEW_not_in_fub: isNew,
  new_with_contact: recs.filter(r => !r.fub_match && (r.email || r.phone)).length,
  new_in_a_neighborhood: recs.filter(r => !r.fub_match && r.neighborhood_slug).length,
}
fs.writeFileSync(OUT + '/03-summary.json', JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
