#!/usr/bin/env node
// Raw FUB-internal duplicate-PEOPLE scan. Crawl all contacts; map every normalized
// phone and email to the LIST of person ids that carry it. Any key with >1 id = a
// duplicate-person cluster. Groups clusters transitively (shared phone OR email).
// READ-ONLY. Writes a dup report. Does NOT merge — merging people is destructive
// and needs Matt's explicit per-cluster ok.
import fs from 'node:fs'
import { config } from 'dotenv'
config({ path: '/Users/matthewryan/RyanRealty/.env.local' })
const AUTH = 'Basic ' + Buffer.from(process.env.FOLLOWUPBOSS_API_KEY.trim() + ':').toString('base64')
const H = { Authorization: AUTH, Accept: 'application/json', 'X-System': 'RyanRealtyAudit' }
const OUT = '/Users/matthewryan/RyanRealty/out/farm-merge'
const digits = s => (s || '').replace(/\D/g, '').replace(/^1(\d{10})$/, '$1')
const norm = s => (s || '').trim().toLowerCase()

const people = []  // {id,name,stage,created,phones:[],emails:[],tags:[]}
let pages = 0
let path = 'https://api.followupboss.com/v1/people?limit=100&fields=id,name,stage,created,emails,phones,tags'
while (path) {
  let d
  for (let a = 0; a < 4; a++) { try { const r = await fetch(path, { headers: H }); if (r.status === 429) { await new Promise(s => setTimeout(s, 2000 * (a + 1))); continue } d = await r.json(); break } catch { await new Promise(s => setTimeout(s, 1000 * (a + 1))) } }
  const ppl = d?.people || []; if (!ppl.length) break
  for (const p of ppl) people.push({
    id: p.id, name: p.name, stage: p.stage, created: p.created,
    phones: [...new Set((p.phones || []).map(x => digits(x.value)).filter(x => x.length === 10))],
    emails: [...new Set((p.emails || []).map(x => norm(x.value)).filter(Boolean))],
    tags: p.tags || [],
  })
  pages++; path = d._metadata?.nextLink || null
  if (pages % 30 === 0) process.stderr.write(`  ...${people.length}\n`)
}

// key -> ids
const phoneToIds = {}, emailToIds = {}
for (const p of people) {
  for (const ph of p.phones) (phoneToIds[ph] = phoneToIds[ph] || new Set()).add(p.id)
  for (const em of p.emails) (emailToIds[em] = emailToIds[em] || new Set()).add(p.id)
}
// union-find over ids that share a phone or email
const parent = {}
const find = x => { while (parent[x] !== undefined && parent[x] !== x) { parent[x] = parent[parent[x]] ?? parent[x]; x = parent[x] } return x }
const union = (a, b) => { parent[a] = parent[a] ?? a; parent[b] = parent[b] ?? b; const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb }
for (const ids of [...Object.values(phoneToIds), ...Object.values(emailToIds)]) {
  const arr = [...ids]; for (let i = 1; i < arr.length; i++) union(arr[0], arr[i])
}
const byId = Object.fromEntries(people.map(p => [p.id, p]))
const clusters = {}
for (const p of people) { const r = find(p.id); (clusters[r] = clusters[r] || []).push(p.id) }
const dupClusters = Object.values(clusters).filter(c => c.length > 1)

// rank clusters; ignore ones linked only by a shared generic email (e.g. blank) — already filtered
dupClusters.sort((a, b) => b.length - a.length)
const report = dupClusters.slice(0, 60).map(ids => ({
  size: ids.length,
  people: ids.map(id => ({ id, name: byId[id].name, stage: byId[id].stage, created: (byId[id].created || '').slice(0, 10), phones: byId[id].phones, emails: byId[id].emails })),
}))
const totalDupPeople = dupClusters.reduce((s, c) => s + c.length, 0)
const summary = {
  total_contacts: people.length,
  duplicate_clusters: dupClusters.length,
  people_involved_in_dupes: totalDupPeople,
  redundant_records_removable: totalDupPeople - dupClusters.length,
  cluster_size_hist: dupClusters.reduce((h, c) => (h[c.length] = (h[c.length] || 0) + 1, h), {}),
}
fs.writeFileSync(OUT + '/05b-fub-dupes.json', JSON.stringify({ summary, sample: report }, null, 2))
console.log(JSON.stringify(summary, null, 2))
console.log('\nsample clusters:')
for (const c of report.slice(0, 12)) console.log('  ['+c.size+'] '+c.people.map(p=>`#${p.id} ${p.name}(${p.created})`).join('  |  '))
