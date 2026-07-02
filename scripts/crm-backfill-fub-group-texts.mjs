#!/usr/bin/env node
/**
 * FUB group-text backfill (Matt 2026-07-02: "merge all of the past group texts
 * from FUB with the appropriate people").
 *
 * WHY: the original comms importer (scripts/crm-import-fub-comms.mjs) dropped
 * FUB's `groupTextId` + `participants` fields, so a FUB-era group text landed
 * ONLY on the person FUB attached it to (e.g. the whole Mary Bowman / Yahson
 * Terry / Matt thread lived on Mary's timeline with no group context).
 *
 * WHAT IT DOES (idempotent, safe to re-run any time):
 *   1. Finds every crm_person with imported FUB sms rows.
 *   2. Re-reads their /v1/textMessages feed READ-ONLY (GET only — FUB is
 *      decommissioned for writes; Matt authorized read-only reference pulls
 *      2026-07-02).
 *   3. For each message carrying a groupTextId:
 *      a. ENRICHES the already-imported row (dedupe fub:text:<id>:p<pid>)
 *         with group context: { group, groupTextId, groupMembers, fromNumber }.
 *      b. MIRRORS the message onto every OTHER participant who is already a
 *         CRM person (matched via crm_contact_points last-10), dedupe key
 *         `fub-group:<id>:p<pid>` — never auto-creates people for historical
 *         backfill; unmatched numbers are reported instead.
 *   4. Writes a JSON report to out/fub-group-backfill-report.json: totals,
 *      per-thread summaries (participants + last activity — used to quantify
 *      the Jun-24→Jul-2 dropped-group-MMS window), unmatched numbers.
 *
 * USAGE:
 *   node scripts/crm-backfill-fub-group-texts.mjs                 # dry-run, whole book
 *   node scripts/crm-backfill-fub-group-texts.mjs --person 21728  # one FUB person
 *   node scripts/crm-backfill-fub-group-texts.mjs --apply         # write rows
 *   --include-fub <id>   force-scan a FUB person even when their crm contact has
 *                        no local fub-import sms rows (e.g. after a contact split
 *                        moved every row away — the scan population derives from
 *                        local rows, so such people otherwise drop out)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

const APPLY = process.argv.includes('--apply')
const personArg = process.argv.indexOf('--person')
const ONLY_FUB_ID = personArg > -1 ? Number(process.argv[personArg + 1]) : null

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY
if (!FUB_KEY) { console.error('FOLLOWUPBOSS_API_KEY missing'); process.exit(1) }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const HEADERS = { Authorization: 'Basic ' + Buffer.from(`${FUB_KEY}:`).toString('base64') }
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

const last10 = (v) => {
  const d = String(v ?? '').replace(/\D/g, '')
  return d.length >= 10 ? d.slice(-10) : null
}

// Our own lines are participants in every group thread — never contacts.
const BROKER_LINES = new Set(
  ['5417033095', '5412245025', '5415023436', '5412503380',
    process.env.TWILIO_NUMBER_MATT, process.env.TWILIO_NUMBER_PAUL, process.env.TWILIO_NUMBER_REBECCA, process.env.TWILIO_NUMBER_MARKETING]
    .map(last10).filter(Boolean),
)

// ---------- load CRM state ----------
async function pageAll(builderFn) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await builderFn().range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

console.log('Loading CRM state…')
// NOTE: every pageAll builder MUST carry a stable .order() — .range() without
// ORDER BY returns nondeterministic pages in Postgres (rows silently missed).
const phonePoints = await pageAll(() => sb.from('crm_contact_points').select('person_id,value').eq('kind', 'phone').order('id'))
const personByPhone = new Map()
for (const p of phonePoints) {
  const ten = last10(p.value)
  if (ten && !personByPhone.has(ten)) personByPhone.set(ten, p.person_id)
}

const smsRows = await pageAll(() =>
  sb.from('crm_timeline').select('person_id').eq('source', 'fub-import').in('kind', ['sms_in', 'sms_out']).order('id'),
)
const personIds = [...new Set(smsRows.map((r) => r.person_id))]
const people = []
for (let i = 0; i < personIds.length; i += 200) {
  const { data, error } = await sb.from('crm_people').select('id,name,fub_legacy_id').in('id', personIds.slice(i, i + 200)).not('fub_legacy_id', 'is', null)
  if (error) throw new Error(error.message)
  people.push(...(data ?? []))
}
const includeArg = process.argv.indexOf('--include-fub')
const INCLUDE_FUB_ID = includeArg > -1 ? Number(process.argv[includeArg + 1]) : null
if (INCLUDE_FUB_ID && !people.some((p) => p.fub_legacy_id === INCLUDE_FUB_ID)) {
  const { data } = await sb.from('crm_people').select('id,name,fub_legacy_id').eq('fub_legacy_id', INCLUDE_FUB_ID).maybeSingle()
  if (data) people.push(data)
}
const targets = ONLY_FUB_ID ? people.filter((p) => p.fub_legacy_id === ONLY_FUB_ID)
  : INCLUDE_FUB_ID ? people.filter((p) => p.fub_legacy_id === INCLUDE_FUB_ID)
  : people
console.log(`People with FUB sms history: ${people.length}${ONLY_FUB_ID || INCLUDE_FUB_ID ? ` (limited to fub:${ONLY_FUB_ID ?? INCLUDE_FUB_ID} → ${targets.length})` : ''}`)

// person -> Set(existing dedupe suffix keys) is checked per-insert via upsert
// ignoreDuplicates + a pre-check against fub:text keys.

// ---------- scan FUB feeds ----------
const stats = { peopleScanned: 0, messagesExamined: 0, groupMessages: 0, enriched: 0, mirrored: 0, skippedExisting: 0 }
const threads = new Map() // groupTextId -> { participants: Map(phone->name), lastTs, msgCount }
const unmatched = new Map() // phone -> { name, count }
const mirrorsByPerson = new Map()
const seenMsgIds = new Set()

for (const person of targets) {
  stats.peopleScanned++
  let next = null
  const msgs = []
  for (;;) {
    const data = await fub(`/textMessages?personId=${person.fub_legacy_id}&limit=100${next ? `&next=${encodeURIComponent(next)}` : ''}`)
    msgs.push(...(data.textmessages ?? []))
    next = data._metadata?.next ?? null
    if (!next) break
  }
  for (const t of msgs) {
    if (seenMsgIds.has(t.id)) continue
    seenMsgIds.add(t.id)
    stats.messagesExamined++
    if (!t.groupTextId || !Array.isArray(t.participants) || t.participants.length < 3) continue
    stats.groupMessages++

    const members = t.participants.map((p) => ({ name: p.name ?? null, ten: last10(p.phone), phone: p.phone ?? null, sender: p.sender === true }))
    const memberPhones = members.map((m) => m.phone).filter(Boolean)
    const sender = members.find((m) => m.sender)

    const th = threads.get(t.groupTextId) ?? { participants: new Map(), lastTs: null, msgCount: 0 }
    for (const m of members) if (m.phone) th.participants.set(m.phone, m.name)
    const ts = t.sent ?? t.created ?? null
    if (ts && (!th.lastTs || ts > th.lastTs)) th.lastTs = ts
    th.msgCount++
    threads.set(t.groupTextId, th)

    const groupPayload = {
      group: true,
      groupTextId: t.groupTextId,
      groupMembers: memberPhones,
      fromNumber: sender?.phone ?? t.fromNumber ?? null,
    }

    // a. Enrich the already-imported row on the feed person.
    if (APPLY) {
      const { data: existing } = await sb.from('crm_timeline').select('id,payload').eq('dedupe_key', `fub:text:${t.id}:p${person.id}`).maybeSingle()
      if (existing && !existing.payload?.group) {
        await sb.from('crm_timeline').update({ payload: { ...existing.payload, ...groupPayload } }).eq('id', existing.id)
        stats.enriched++
      }
    } else {
      stats.enriched++ // counted as would-enrich in dry-run
    }

    // b. Mirror onto every other mapped participant.
    const body = t.message && t.message.trim() !== '* Body is hidden for privacy reasons *' ? t.message : null
    for (const m of members) {
      if (!m.ten || BROKER_LINES.has(m.ten)) continue
      const pid = personByPhone.get(m.ten)
      if (!pid) {
        const u = unmatched.get(m.phone) ?? { name: m.name, count: 0 }
        u.count++
        unmatched.set(m.phone, u)
        continue
      }
      if (pid === person.id) continue // the feed person already holds the fub:text row
      const row = {
        person_id: pid,
        ts: t.sent ?? t.created ?? new Date().toISOString(),
        kind: t.isIncoming ? 'sms_in' : 'sms_out',
        title: null,
        body,
        payload: { ...groupPayload, status: t.status ?? null, fubUserId: t.userId ?? null, contentHidden: body === null && Boolean(t.message) },
        broker: { 1: 'matt', 2: 'rebecca', 3: 'paul' }[t.userId] ?? null,
        source: 'fub-import',
        fub_legacy_id: t.id,
        dedupe_key: `fub-group:${t.id}:p${pid}`,
      }
      if (APPLY) {
        // Skip if this person already carries the message from their own feed.
        // Two guards: (1) exact dedupe key from their own import, and (2) any
        // fub-import sms row at the identical timestamp+kind — FUB may store
        // per-person copies of one group message under DIFFERENT message ids,
        // which the key guard alone would double-write.
        const { data: own } = await sb.from('crm_timeline').select('id').eq('dedupe_key', `fub:text:${t.id}:p${pid}`).maybeSingle()
        if (own) { stats.skippedExisting++; continue }
        const { data: sameTs } = await sb
          .from('crm_timeline').select('id')
          .eq('person_id', pid).eq('source', 'fub-import').eq('kind', row.kind).eq('ts', row.ts)
          .limit(1).maybeSingle()
        if (sameTs) { stats.skippedExisting++; continue }
        const { error } = await sb.from('crm_timeline').upsert(row, { onConflict: 'dedupe_key', ignoreDuplicates: true })
        if (error) throw new Error(`mirror insert p${pid} msg${t.id}: ${error.message}`)
        stats.mirrored++
        mirrorsByPerson.set(pid, (mirrorsByPerson.get(pid) ?? 0) + 1)
      } else {
        stats.mirrored++
        mirrorsByPerson.set(pid, (mirrorsByPerson.get(pid) ?? 0) + 1)
      }
    }
  }
  if (stats.peopleScanned % 50 === 0) console.log(`…${stats.peopleScanned}/${targets.length} people scanned`)
}

// ---------- report ----------
const report = {
  ranAt: new Date().toISOString(),
  apply: APPLY,
  scope: ONLY_FUB_ID ? `fub:${ONLY_FUB_ID}` : 'all',
  stats,
  threads: [...threads.entries()].map(([id, t]) => ({
    groupTextId: id,
    participants: [...t.participants.entries()].map(([phone, name]) => ({ phone, name })),
    lastActivity: t.lastTs,
    messages: t.msgCount,
  })).sort((a, b) => String(b.lastActivity).localeCompare(String(a.lastActivity))),
  mirrorsByPerson: [...mirrorsByPerson.entries()].map(([pid, n]) => ({ personId: pid, rows: n })),
  unmatchedNumbers: [...unmatched.entries()].map(([phone, u]) => ({ phone, name: u.name, messages: u.count })),
}
mkdirSync('out', { recursive: true })
writeFileSync('out/fub-group-backfill-report.json', JSON.stringify(report, null, 2))
console.log(`\n${APPLY ? 'APPLIED' : 'DRY-RUN'} — people ${stats.peopleScanned} · messages ${stats.messagesExamined} · group msgs ${stats.groupMessages} · enriched ${stats.enriched} · mirrored ${stats.mirrored} · skipped-existing ${stats.skippedExisting}`)
console.log(`threads: ${threads.size} · unmatched numbers: ${unmatched.size}`)
console.log('report: out/fub-group-backfill-report.json')
