#!/usr/bin/env node
// Tighter true-duplicate-PEOPLE detection. Fixes over-merge from shared phones.
// Rules:
//  1. Drop "junk" keys: any phone/email shared by >3 DISTINCT people (shared
//     office line, placeholder, spam) — these chain unrelated people.
//  2. Cluster only on the remaining high-trust keys.
//  3. Within each cluster, classify confidence:
//     HIGH  = members share a key AND have matching normalized name
//     MED   = share an email (email is near-unique to a person)
//     LOW   = share only a phone w/o name agreement (review)
// READ-ONLY. Writes a tiered dup report (no merging).
import fs from 'node:fs'
const OUT = '/Users/matthewryan/RyanRealty/out/farm-merge'
const raw = JSON.parse(fs.readFileSync(OUT + '/05b-fub-dupes.json', 'utf8')) // has summary+sample only; need full people — re-derive from index? No: rescan needed.
// We need full people again; reuse the live crawl saved nowhere full. Re-crawl is cheap but
// instead persist from 5b: it only saved sample. So re-pull minimal here.
import { config } from 'dotenv'; config({ path: '/Users/matthewryan/RyanRealty/.env.local' })
const AUTH = 'Basic ' + Buffer.from(process.env.FOLLOWUPBOSS_API_KEY.trim() + ':').toString('base64')
const H = { Authorization: AUTH, Accept: 'application/json', 'X-System': 'RyanRealtyAudit' }
const digits = s => (s || '').replace(/\D/g, '').replace(/^1(\d{10})$/, '$1')
const norm = s => (s || '').trim().toLowerCase()
const nameKey = s => norm(s).replace(/[^a-z ]/g, '').split(/\s+/).filter(Boolean).sort().join(' ')

const people = []
let pages = 0, path = 'https://api.followupboss.com/v1/people?limit=100&fields=id,name,stage,created,emails,phones'
while (path) {
  let d; for (let a = 0; a < 4; a++) { try { const r = await fetch(path, { headers: H }); if (r.status === 429) { await new Promise(s => setTimeout(s, 2000 * (a + 1))); continue } d = await r.json(); break } catch { await new Promise(s => setTimeout(s, 1000 * (a + 1))) } }
  const ppl = d?.people || []; if (!ppl.length) break
  for (const p of ppl) people.push({ id: p.id, name: p.name, nk: nameKey(p.name), stage: p.stage, created: (p.created || '').slice(0, 10), phones: [...new Set((p.phones || []).map(x => digits(x.value)).filter(x => x.length === 10))], emails: [...new Set((p.emails || []).map(x => norm(x.value)).filter(Boolean))] })
  pages++; path = d._metadata?.nextLink || null
  if (pages % 40 === 0) process.stderr.write(`  ...${people.length}\n`)
}

// frequency of each key
const phFreq = {}, emFreq = {}
for (const p of people) { for (const ph of p.phones) phFreq[ph] = (phFreq[ph] || 0) + 1; for (const em of p.emails) emFreq[em] = (emFreq[em] || 0) + 1 }
const JUNK_PH = new Set(Object.entries(phFreq).filter(([, c]) => c > 3).map(([k]) => k))
const JUNK_EM = new Set(Object.entries(emFreq).filter(([, c]) => c > 3).map(([k]) => k))

// build clusters on trusted keys only
const parent = {}; const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
for (const p of people) parent[p.id] = p.id
const keyToIds = {}
for (const p of people) {
  for (const ph of p.phones) if (!JUNK_PH.has(ph)) (keyToIds['p:' + ph] = keyToIds['p:' + ph] || []).push(p.id)
  for (const em of p.emails) if (!JUNK_EM.has(em)) (keyToIds['e:' + em] = keyToIds['e:' + em] || []).push(p.id)
}
for (const ids of Object.values(keyToIds)) for (let i = 1; i < ids.length; i++) { const a = find(ids[0]), b = find(ids[i]); if (a !== b) parent[a] = b }
const byId = Object.fromEntries(people.map(p => [p.id, p]))
const clusters = {}
for (const p of people) { const r = find(p.id); (clusters[r] = clusters[r] || []).push(p.id) }
const dups = Object.values(clusters).filter(c => c.length > 1)

let HIGH = [], MED = [], LOW = []
for (const ids of dups) {
  const members = ids.map(id => byId[id])
  const names = new Set(members.map(m => m.nk).filter(Boolean))
  const sharedEmail = (() => { const all = members.flatMap(m => m.emails.filter(e => !JUNK_EM.has(e))); return all.length !== new Set(all).size })()
  const entry = { size: ids.length, members: members.map(m => ({ id: m.id, name: m.name, created: m.created, stage: m.stage })) }
  if (names.size === 1) HIGH.push(entry)         // same name + shared key = confident dup
  else if (sharedEmail) MED.push(entry)          // shared real email, name variant
  else LOW.push(entry)                           // shared phone only, different names = review
}
const summary = {
  total_contacts: people.length,
  junk_phones_excluded: JUNK_PH.size, junk_emails_excluded: JUNK_EM.size,
  HIGH_confidence_clusters: HIGH.length, HIGH_removable: HIGH.reduce((s, c) => s + c.size - 1, 0),
  MED_confidence_clusters: MED.length, MED_removable: MED.reduce((s, c) => s + c.size - 1, 0),
  LOW_review_clusters: LOW.length,
}
fs.writeFileSync(OUT + '/05c-true-dupes.json', JSON.stringify({ summary, HIGH: HIGH.slice(0, 80), MED: MED.slice(0, 40), LOW: LOW.slice(0, 30) }, null, 2))
console.log(JSON.stringify(summary, null, 2))
console.log('\nHIGH-confidence sample (same name, shared phone/email):')
for (const c of HIGH.slice(0, 15)) console.log('  ['+c.size+'] '+c.members.map(m=>`#${m.id} ${m.name}(${m.created})`).join('  |  '))
