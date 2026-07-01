#!/usr/bin/env node
// Complete Follow Up Boss data export — a full raw-JSON backup before the FUB
// subscription is cancelled, so NOTHING is lost. Pulls every collection + every
// per-person email/text. Idempotent + resumable: re-running skips finished work.
//
//   node scripts/_fub-full-export.mjs            # full export (bulk + messages)
//   node scripts/_fub-full-export.mjs --bulk     # bulk collections only (fast)
//
// Output: ~/fub-backup-YYYY-MM-DD/  (outside the repo — 18k contacts of PII,
// never committed). One JSON file per collection + emails.jsonl/textMessages.jsonl
// + _manifest.json with counts.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const i = line.indexOf('=')
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
}
const KEY = env.FOLLOWUPBOSS_API_KEY
const SYS = env.FOLLOWUPBOSS_SYSTEM || 'RyanRealtyPlatform'
const SK = env.FOLLOWUPBOSS_SYSTEM_KEY || ''
if (!KEY) { console.error('missing FOLLOWUPBOSS_API_KEY'); process.exit(1) }
const AUTH = 'Basic ' + Buffer.from(KEY + ':').toString('base64')
const HEADERS = { Authorization: AUTH, 'X-System': SYS, 'X-System-Key': SK, Accept: 'application/json' }

const BULK_ONLY = process.argv.includes('--bulk')
const MESSAGES_ONLY = process.argv.includes('--messages-only')
const DIR = path.join(os.homedir(), `fub-backup-${new Date().toISOString().slice(0, 10)}`)
fs.mkdirSync(DIR, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (m) => { const line = `[${new Date().toISOString()}] ${m}`; console.log(line); fs.appendFileSync(path.join(DIR, '_export.log'), line + '\n') }

async function fub(pathq, tries = 8) {
  for (let a = 0; a < tries; a++) {
    let res
    try { res = await fetch('https://api.followupboss.com/v1/' + pathq.replace(/^\//, ''), { headers: HEADERS }) }
    catch (e) { await sleep(2000 * (a + 1)); continue }
    if (res.status === 400) return { __http: 400 } // real bad-request (terminal)
    // 429 rate-limit AND 404 (FUB returns transient 404s under load) → retry.
    if (res.status === 429 || res.status === 404 || res.status >= 500) { await sleep(2500 * (a + 1)); continue }
    if (!res.ok) { await sleep(1500 * (a + 1)); continue }
    return res.json()
  }
  return null
}

/** Paginate a bare-list collection fully via _metadata.next, return all records. */
async function pullCollection(ep, key) {
  const out = []
  let next = null
  let page = 0
  do {
    const sep = ep.includes('?') ? '&' : '?'
    const data = await fub(`${ep}${sep}limit=100${next ? `&next=${encodeURIComponent(next)}` : ''}`)
    if (!data || data.__http) break
    const items = data[key] ?? []
    out.push(...items)
    next = data._metadata?.next ?? null
    page++
    if (page % 10 === 0) log(`  ${ep}: ${out.length} so far…`)
    await sleep(80)
  } while (next)
  return out
}

// Collection → its response array key. (FUB lowercases the plural key.)
const COLLECTIONS = [
  ['peopleRelationships', 'peoplerelationships'],
  ['notes', 'notes'],
  ['events', 'events'],
  ['calls', 'calls'],
  ['tasks', 'tasks'],
  ['appointments', 'appointments'],
  ['deals', 'deals'],
  ['pipelines', 'pipelines'],
  ['stages', 'stages'],
  ['users', 'users'],
  ['teams', 'teams'],
  ['groups', 'groups'],
  ['ponds', 'ponds'],
  ['smartLists', 'smartlists'],
  ['actionPlans', 'actionPlans'],
  ['templates', 'templates'],
  ['textMessageTemplates', 'textmessagetemplates'],
  ['customFields', 'customfields'],
  ['appointmentTypes', 'appointmenttypes'],
  ['appointmentOutcomes', 'appointmentoutcomes'],
  ['appointmentLabels', 'appointmentlabels'],
  ['webhooks', 'webhooks'],
]

async function main() {
  const manifest = { startedAt: new Date().toISOString(), dir: DIR, counts: {} }
  log(`FUB export → ${DIR}`)

  let people
  if (MESSAGES_ONLY) {
    // Re-pull only the per-person messages (bulk already downloaded). Load the
    // people list from the existing export so we have the IDs.
    people = JSON.parse(fs.readFileSync(path.join(DIR, 'people.json'), 'utf8'))
    log(`messages-only: loaded ${people.length} people from disk`)
  } else {
    // 1. Bulk collections.
    for (const [ep, key] of COLLECTIONS) {
      const rows = await pullCollection(ep, key)
      fs.writeFileSync(path.join(DIR, `${ep}.json`), JSON.stringify(rows, null, 2))
      manifest.counts[ep] = rows.length
      log(`✓ ${ep}: ${rows.length}`)
      await sleep(400)
    }
    // 2. People (the big one) — save + keep IDs for the message pull.
    people = await pullCollection('people?fields=allFields', 'people')
    fs.writeFileSync(path.join(DIR, 'people.json'), JSON.stringify(people, null, 2))
    manifest.counts.people = people.length
    log(`✓ people: ${people.length}`)
  }

  if (!BULK_ONLY) {
    // 3. Per-person emails + text messages (need personId). Resumable via progress file.
    const ids = people.map((p) => p.id).filter(Boolean)
    const progFile = path.join(DIR, '_messages-progress.json')
    let done = new Set()
    if (fs.existsSync(progFile)) { try { done = new Set(JSON.parse(fs.readFileSync(progFile, 'utf8'))) } catch {} }
    const emailsFile = path.join(DIR, 'emails.jsonl')
    const textsFile = path.join(DIR, 'textMessages.jsonl')
    let emailCount = 0, textCount = 0, processed = 0

    const CONC = 6
    for (let i = 0; i < ids.length; i += CONC) {
      const batch = ids.slice(i, i + CONC).filter((id) => !done.has(id))
      await Promise.all(batch.map(async (id) => {
        // Paginate ALL of a person's emails (high-volume contacts have >100 —
        // limit=100 alone would truncate them). Loop the next cursor.
        let en = null
        do {
          const em = await fub(`emails?personId=${id}&limit=100${en ? `&next=${encodeURIComponent(en)}` : ''}`)
          if (!em || em.__http || !em.emails?.length) break
          for (const e of em.emails) fs.appendFileSync(emailsFile, JSON.stringify(e) + '\n')
          emailCount += em.emails.length
          en = em._metadata?.next ?? null
        } while (en)
        // Paginate ALL of a person's text messages.
        let tn = null
        do {
          const tx = await fub(`textMessages?personId=${id}&limit=100${tn ? `&next=${encodeURIComponent(tn)}` : ''}`)
          if (!tx || tx.__http || !tx.textmessages?.length) break
          for (const t of tx.textmessages) fs.appendFileSync(textsFile, JSON.stringify(t) + '\n')
          textCount += tx.textmessages.length
          tn = tx._metadata?.next ?? null
        } while (tn)
        done.add(id)
      }))
      processed += batch.length
      if (processed % 300 < CONC) {
        fs.writeFileSync(progFile, JSON.stringify([...done]))
        log(`  messages: ${done.size}/${ids.length} people · ${emailCount} emails · ${textCount} texts`)
      }
      await sleep(120)
    }
    fs.writeFileSync(progFile, JSON.stringify([...done]))
    manifest.counts.emails = emailCount
    manifest.counts.textMessages = textCount
    log(`✓ messages: ${emailCount} emails · ${textCount} texts across ${done.size} people`)
  }

  manifest.finishedAt = new Date().toISOString()
  fs.writeFileSync(path.join(DIR, '_manifest.json'), JSON.stringify(manifest, null, 2))
  log(`DONE. Manifest: ${path.join(DIR, '_manifest.json')}`)
}

main().catch((e) => { log('FATAL: ' + (e?.stack || e)); process.exit(1) })
