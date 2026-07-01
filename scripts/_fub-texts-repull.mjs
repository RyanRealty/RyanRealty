#!/usr/bin/env node
// Reliable serial re-pull of ALL text messages for every FUB contact that has
// them, with full per-contact pagination. Fixes the concurrency-truncated
// textMessages.jsonl (e.g. Kevin 276/423). Overwrites textMessages.jsonl.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('='); if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
}
const AUTH = 'Basic ' + Buffer.from(env.FOLLOWUPBOSS_API_KEY + ':').toString('base64')
const HEADERS = { Authorization: AUTH, 'X-System': env.FOLLOWUPBOSS_SYSTEM, 'X-System-Key': env.FOLLOWUPBOSS_SYSTEM_KEY, Accept: 'application/json' }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const DIR = path.join(os.homedir(), `fub-backup-${new Date().toISOString().slice(0, 10)}`)
const OUT = path.join(DIR, 'textMessages.jsonl')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fub(pathq, tries = 10) {
  for (let a = 0; a < tries; a++) {
    let res
    try { res = await fetch('https://api.followupboss.com/v1/' + pathq, { headers: HEADERS }) } catch { await sleep(2000 * (a + 1)); continue }
    if (res.status === 400) return { __http: 400 }
    if (res.status === 429 || res.status === 404 || res.status >= 500) { await sleep(2500 * (a + 1)); continue }
    if (!res.ok) { await sleep(1500 * (a + 1)); continue }
    return res.json()
  }
  return null
}

async function main() {
  // Text-having FUB person ids (from our imported timeline).
  const { data } = await sb.rpc('noop').then(() => ({ data: null })).catch(() => ({ data: null }))
  void data
  const ids = []
  let from = 0
  for (;;) {
    const { data: rows, error } = await sb
      .from('crm_people')
      .select('fub_legacy_id, crm_timeline!inner(kind)')
      .in('crm_timeline.kind', ['sms_in', 'sms_out'])
      .not('fub_legacy_id', 'is', null)
      .range(from, from + 999)
    if (error) { console.error(error.message); break }
    if (!rows || rows.length === 0) break
    for (const r of rows) if (r.fub_legacy_id) ids.push(Number(r.fub_legacy_id))
    if (rows.length < 1000) break
    from += 1000
  }
  const unique = [...new Set(ids)]
  console.log(`text contacts to re-pull: ${unique.length}`)

  fs.writeFileSync(OUT, '') // fresh
  let total = 0, done = 0
  for (const id of unique) {
    let next = null, personTotal = 0
    do {
      const tx = await fub(`textMessages?personId=${id}&limit=100${next ? `&next=${encodeURIComponent(next)}` : ''}`)
      if (!tx || tx.__http || !tx.textmessages?.length) break
      for (const t of tx.textmessages) fs.appendFileSync(OUT, JSON.stringify(t) + '\n')
      personTotal += tx.textmessages.length
      next = tx._metadata?.next ?? null
      await sleep(60)
    } while (next)
    total += personTotal
    done++
    if (done % 50 === 0) console.log(`  ${done}/${unique.length} contacts · ${total} texts`)
    await sleep(60)
  }
  console.log(`DONE. ${total} texts across ${unique.length} contacts → ${OUT}`)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
