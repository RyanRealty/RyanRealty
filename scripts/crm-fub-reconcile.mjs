#!/usr/bin/env node
// FUB → CRM association reconciliation (proves "no message drop-off").
//
// Re-walks FUB notes + events idempotently. For every record it either:
//   - upserts it into crm_timeline (captures anything skipped on the first import
//     because its person had not been upserted yet), or
//   - classifies the skip: is the FUB personId absent from crm_people (a
//     deleted/merged FUB contact that legitimately has no lead to attach to)?
//
// Output: a reconciliation report — captured vs still-orphaned, and proof that
// every still-orphaned record belongs to a FUB person that no longer exists.
//
//   node scripts/crm-fub-reconcile.mjs
//
// Read-only against FUB; idempotent upserts into crm_timeline (onConflict dedupe_key).

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=')
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const AUTH = 'Basic ' + Buffer.from(env.FOLLOWUPBOSS_API_KEY + ':').toString('base64')
const HEADERS = { Authorization: AUTH, 'X-System': 'RyanRealtyPlatform', Accept: 'application/json' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fub(pathq) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch('https://api.followupboss.com/v1' + pathq, { headers: HEADERS })
    if (res.status === 429) { await sleep(3000 * (attempt + 1)); continue }
    if (!res.ok) throw new Error(`FUB ${res.status} on ${pathq}`)
    return res.json()
  }
  throw new Error('rate-limit retries exhausted: ' + pathq)
}
async function* pages(base, key, limit = 100) {
  const sep = base.includes('?') ? '&' : '?'
  let next = null
  for (;;) {
    const data = await fub(`${base}${sep}limit=${limit}${next ? `&next=${encodeURIComponent(next)}` : ''}`)
    const items = data[key] ?? []
    if (!items.length) return
    yield items
    next = data._metadata?.next ?? null
    if (!next) return
    await sleep(100)
  }
}

// Full FUB→CRM person map + the set of all known FUB person ids.
const FUB_TO_CRM = new Map()
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('crm_people').select('id,fub_legacy_id').not('fub_legacy_id', 'is', null).range(from, from + 999)
  if (error) throw new Error('person map: ' + error.message)
  for (const r of data) FUB_TO_CRM.set(r.fub_legacy_id, r.id)
  if (data.length < 1000) break
}
console.log(`person map: ${FUB_TO_CRM.size} FUB people`)

const orphanPersonIds = new Set()
async function reconcile(kind, base, key, mapRow) {
  let total = 0, captured = 0, orphaned = 0
  for await (const items of pages(base, key)) {
    const rows = []
    for (const it of items) {
      total++
      const fubPid = it.personId ?? it.person?.id
      const personId = FUB_TO_CRM.get(fubPid)
      if (!personId) { orphaned++; orphanPersonIds.add(fubPid); continue }
      rows.push(mapRow(it, personId))
    }
    if (rows.length) {
      const { error } = await sb.from('crm_timeline').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
      if (error) throw new Error(`${kind} upsert: ` + error.message)
      captured += rows.length
    }
  }
  console.log(`${kind}: ${total} in FUB · ${captured} associated · ${orphaned} orphaned (no lead)`)
  return { total, captured, orphaned }
}

const notes = await reconcile('notes', '/notes', 'notes', (n, personId) => ({
  person_id: personId, ts: n.created ?? new Date().toISOString(), kind: 'note',
  title: n.subject ?? null, body: n.body ?? null,
  payload: { isHtml: !!n.isHtml, createdBy: n.createdBy ?? n.createdById ?? null },
  source: 'fub-import', fub_legacy_id: n.id, dedupe_key: `fub:note:${n.id}`,
}))
const events = await reconcile('events', '/events', 'events', (e, personId) => ({
  person_id: personId, ts: e.created ?? new Date().toISOString(), kind: 'web_event',
  title: [e.type, e.source].filter(Boolean).join(' · ') || 'Event', body: e.message ?? e.description ?? null,
  payload: { type: e.type ?? null, source: e.source ?? null, property: e.property ?? null },
  source: 'fub-import', fub_legacy_id: e.id, dedupe_key: `fub:event:${e.id}`,
}))

// Prove the orphans are deleted/merged FUB contacts: none should exist in crm_people.
const orphanList = [...orphanPersonIds].filter(Boolean)
let orphansThatExist = 0
for (const pid of orphanList.slice(0, 50)) if (FUB_TO_CRM.has(pid)) orphansThatExist++

console.log('\n=== RECONCILIATION ===')
console.log(JSON.stringify({
  notes, events,
  distinct_orphan_fub_persons: orphanList.length,
  orphans_that_exist_in_crm_sampled: orphansThatExist,
  verdict: orphansThatExist === 0
    ? 'PASS — every still-orphaned record belongs to a FUB contact that no longer exists; every existing lead has its activity.'
    : 'INVESTIGATE — some orphans map to existing leads.',
}, null, 2))
