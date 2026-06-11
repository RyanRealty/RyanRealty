#!/usr/bin/env node
/**
 * Push west-side Bend homeowner rows from 05-fub-import.csv into Follow Up Boss
 * via POST /people (new) or PUT /people/{id}?mergeTags=true (existing fub_id).
 *
 * Uses POST /people intentionally — NOT /events — so seller LP automations do
 * not fire on a cold database import.
 *
 * Usage:
 *   node --env-file=.env.local scripts/westside-bend-fub-push.mjs --dry-run
 *   node --env-file=.env.local scripts/westside-bend-fub-push.mjs --apply --limit 25
 *   node --env-file=.env.local scripts/westside-bend-fub-push.mjs --apply
 */

import { readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const CSV_PATH = resolve(ROOT, 'out/westside-bend-merge/05-fub-import.csv')
const MASTER_PATH = resolve(ROOT, 'out/westside-bend-merge/04-master-realtor-flagged.csv')
const SUMMARY_PATH = resolve(ROOT, 'out/westside-bend-merge/summary-fub-push.json')
const FUB_BASE = 'https://api.followupboss.com/v1'
const DELAY_MS = 220

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i]
    if (!t.startsWith('--')) continue
    const eq = t.indexOf('=')
    if (eq > -1) { out[t.slice(2, eq)] = t.slice(eq + 1); continue }
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) { out[t.slice(2)] = next; i += 1 }
    else { out[t.slice(2)] = true }
  }
  return out
}

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i += 1; continue
      }
      field += c; i += 1; continue
    }
    if (c === '"') { inQuotes = true; i += 1; continue }
    if (c === ',') { row.push(field); field = ''; i += 1; continue }
    if (c === '\r') { i += 1; continue }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; continue }
    field += c; i += 1
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

function csvToObjects(text) {
  const rows = parseCsv(text)
  const header = rows.shift() || []
  return rows
    .filter((r) => r.some((c) => String(c || '').trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

function customFieldApiName(csvHeader) {
  const raw = csvHeader.replace(/^Custom /, '')
  const pascal = raw
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
  return 'custom' + pascal
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function fubAuth(apiKey) {
  return 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
}

async function fubRequest(method, path, apiKey, body) {
  const res = await fetch(`${FUB_BASE}${path}`, {
    method,
    headers: {
      Authorization: fubAuth(apiKey),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-System': 'RyanRealty-Web',
      'X-System-Key': 'ryan-realty-westside-push',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch {}
  return { ok: res.ok, status: res.status, data, text }
}

function buildFubIdLookup(masterRows) {
  const byEmail = new Map()
  const byPhone = new Map()
  for (const r of masterRows) {
    const id = Number(r.fub_id)
    if (!Number.isFinite(id) || id <= 0) continue
    const email = String(r.fub_email || r.enriched_email || '').trim().toLowerCase()
    const phone = String(r.fub_phone || r.enriched_phone || '').replace(/\D/g, '')
    if (email) byEmail.set(email, id)
    if (phone.length >= 10) byPhone.set(phone.slice(-10), id)
  }
  return { byEmail, byPhone }
}

function resolveExistingId(row, lookup) {
  const email = String(row.Email || '').trim().toLowerCase()
  const phone = String(row.Phone || '').replace(/\D/g, '')
  if (email && lookup.byEmail.has(email)) return lookup.byEmail.get(email)
  if (phone.length >= 10 && lookup.byPhone.has(phone.slice(-10))) return lookup.byPhone.get(phone.slice(-10))
  return null
}

function rowToFubBody(row) {
  const body = {}
  if (row['First Name']) body.firstName = row['First Name']
  if (row['Last Name']) body.lastName = row['Last Name']
  if (row.Email?.trim()) body.emails = [{ value: row.Email.trim() }]
  if (row.Phone?.trim()) body.phones = [{ value: row.Phone.trim() }]
  if (row.Address || row.City || row.State || row.Zip) {
    body.addresses = [{
      street: row.Address || '',
      city: row.City || '',
      state: row.State || '',
      code: row.Zip || '',
    }]
  }
  if (row.Source) body.source = row.Source
  if (row.Stage?.trim()) body.stage = row.Stage.trim()
  if (row.Tags?.trim()) {
    body.tags = row.Tags.split(';').map((t) => t.trim()).filter(Boolean)
  }
  if (row.Background?.trim()) body.background = row.Background.trim()

  for (const [key, val] of Object.entries(row)) {
    if (!key.startsWith('Custom ') || key === 'Custom Property Address') continue
    const s = String(val ?? '').trim()
    if (!s) continue
    const apiName = customFieldApiName(key)
    if (key === 'Custom Property Address') body.customSellerPropertyAddress = s
    else body[apiName] = s
  }
  const propAddr = row['Custom Property Address']?.trim()
  if (propAddr) body.customSellerPropertyAddress = propAddr

  return body
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const apply = !!args.apply
  const limit = args.limit ? Number(args.limit) : Infinity
  const apiKey = (process.env.FOLLOWUPBOSS_API_KEY || '').trim()
  if (!apiKey) {
    console.error('[fub-push] Missing FOLLOWUPBOSS_API_KEY')
    process.exit(1)
  }

  const csvText = await readFile(CSV_PATH, 'utf8')
  const allRows = csvToObjects(csvText)
  const masterText = await readFile(MASTER_PATH, 'utf8').catch(() => '')
  const masterRows = masterText ? csvToObjects(masterText) : []
  const lookup = buildFubIdLookup(masterRows)

  // LIVE dedup: pull current FUB contacts with the westside import tag and
  // augment the lookup with their actual FUB IDs. Otherwise contacts created
  // in earlier pushes (not back-written to the CSV) will be re-POSTed as
  // duplicates. This costs ~30 sec but prevents thousands of duplicate
  // contacts. Disabled by --skip-live-dedup if Matt needs to bypass.
  if (apply && !args['skip-live-dedup']) {
    console.log('[fub-push] Pulling live FUB contacts for dedup (one-time, ~30 sec)...')
    let liveAdded = 0
    let next = '/v1/people?tags=import:westside-2026-05&limit=100&fields=id,emails,phones'
    let pages = 0
    while (next && pages < 200) {
      try {
        const r = await fetch('https://api.followupboss.com' + next, {
          headers: { Authorization: 'Basic ' + Buffer.from(apiKey + ':').toString('base64') },
          signal: AbortSignal.timeout(15000),
        })
        if (!r.ok) break
        const txt = await r.text()
        if (!txt.trim().startsWith('{')) break
        const d = JSON.parse(txt)
        for (const p of (d.people || [])) {
          for (const e of (p.emails || [])) {
            const v = String(e.value || '').trim().toLowerCase()
            if (v && !lookup.byEmail.has(v)) { lookup.byEmail.set(v, p.id); liveAdded += 1 }
          }
          for (const ph of (p.phones || [])) {
            const d10 = String(ph.value || '').replace(/\D/g, '').slice(-10)
            if (d10.length === 10 && !lookup.byPhone.has(d10)) { lookup.byPhone.set(d10, p.id); liveAdded += 1 }
          }
        }
        next = d._metadata?.nextLink ? d._metadata.nextLink.replace('https://api.followupboss.com', '') : null
        pages += 1
        if (pages % 10 === 0) process.stdout.write('.')
        await new Promise((r) => setTimeout(r, 100))
      } catch { break }
    }
    console.log(`\n[fub-push] Live dedup lookup augmented with ${liveAdded} email/phone entries (${pages} pages scanned)`)
  }

  const rows = allRows.slice(0, limit)
  const stats = {
    startedAt: new Date().toISOString(),
    inputRows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorSamples: [],
  }

  console.log(`[fub-push] Rows to process: ${rows.length} (apply=${apply})`)

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    const body = rowToFubBody(row)
    const existingId = resolveExistingId(row, lookup)
    const label = `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim() || `row ${i + 1}`

    if (!body.emails?.length && !body.phones?.length && !existingId) {
      stats.skipped += 1
      continue
    }

    if (!apply) {
      if (i < 5) console.log(`  [dry-run] ${existingId ? 'PUT' : 'POST'} ${label}`)
      continue
    }

    let result
    if (existingId) {
      result = await fubRequest('PUT', `/people/${existingId}?mergeTags=true`, apiKey, body)
      if (result.ok) stats.updated += 1
    } else {
      result = await fubRequest('POST', '/people', apiKey, body)
      if (result.ok) stats.created += 1
    }

    if (!result.ok) {
      stats.errors += 1
      if (stats.errorSamples.length < 10) {
        stats.errorSamples.push({ label, status: result.status, text: result.text.slice(0, 200) })
      }
    }

    if ((i + 1) % 50 === 0) {
      process.stdout.write(`\r[fub-push] ${i + 1}/${rows.length} created=${stats.created} updated=${stats.updated} errors=${stats.errors}`)
    }
    await sleep(DELAY_MS)
  }

  stats.completedAt = new Date().toISOString()
  await writeFile(SUMMARY_PATH, JSON.stringify(stats, null, 2), 'utf8')

  console.log(`\n[fub-push] === Done ===`)
  console.log(JSON.stringify(stats, null, 2))
  console.log(`[fub-push] Summary: ${SUMMARY_PATH}`)
  if (!apply) console.log('[fub-push] Dry run only. Re-run with --apply to push.')
}

main().catch((err) => {
  console.error('[fub-push] FATAL:', err.message)
  process.exit(1)
})
