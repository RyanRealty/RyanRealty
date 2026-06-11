#!/usr/bin/env node
// Build a COMPLETE live FUB index: every phone (all fields) + every email (all
// fields) + name -> personId, across all 17,100 contacts. The CSV export only
// had Phone 1 / Email 1, which caused false "NEW". This crawls the API with
// allFields so multi-phone / multi-email contacts match correctly.
import fs from 'node:fs'
import { config } from 'dotenv'
config({ path: '/Users/matthewryan/RyanRealty/.env.local' })
const AUTH = 'Basic ' + Buffer.from(process.env.FOLLOWUPBOSS_API_KEY.trim() + ':').toString('base64')
const H = { Authorization: AUTH, Accept: 'application/json', 'X-System': 'RyanRealtyAudit' }
const OUT = '/Users/matthewryan/RyanRealty/out/farm-merge'

const digits = s => (s || '').replace(/\D/g, '').replace(/^1(\d{10})$/, '$1')
const norm = s => (s || '').trim().toLowerCase()

const phoneIdx = {}, emailIdx = {}, nameIdx = {}
let n = 0, pages = 0
let path = 'https://api.followupboss.com/v1/people?limit=100&fields=id,name,firstName,lastName,emails,phones,tags,stage'
while (path) {
  let d
  for (let a = 0; a < 4; a++) { try { const r = await fetch(path, { headers: H }); if (r.status === 429) { await new Promise(s => setTimeout(s, 2000 * (a + 1))); continue } d = await r.json(); break } catch { await new Promise(s => setTimeout(s, 1000 * (a + 1))) } }
  const ppl = d?.people || []; if (!ppl.length) break
  for (const p of ppl) {
    n++
    const tagset = (p.tags || []).map(t => (t || '').trim()).filter(Boolean)
    const rec = { id: p.id, name: p.name, stage: p.stage, tags: tagset }
    for (const e of (p.emails || [])) { const k = norm(e.value); if (k) emailIdx[k] = rec }
    for (const ph of (p.phones || [])) { const k = digits(ph.value); if (k.length === 10) phoneIdx[k] = rec }
    const nm = norm(p.name); if (nm) { (nameIdx[nm] = nameIdx[nm] || []).push(rec) }
  }
  pages++
  path = d._metadata?.nextLink || null
  if (pages % 30 === 0) process.stderr.write(`  ...${n} indexed\n`)
}
fs.writeFileSync(OUT + '/03b-live-index.json', JSON.stringify({ phoneIdx, emailIdx, nameIdx }))
console.log(JSON.stringify({ contacts_indexed: n, distinct_phones: Object.keys(phoneIdx).length, distinct_emails: Object.keys(emailIdx).length, distinct_names: Object.keys(nameIdx).length }, null, 2))
