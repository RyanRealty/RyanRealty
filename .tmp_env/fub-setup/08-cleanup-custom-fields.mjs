#!/usr/bin/env node
/**
 * Cleanup KTS-era custom fields that aren't part of the canonical workflow.
 *
 * Current state (28 fields total — verified 2026-05-17):
 *
 *   KEEP — seller workflow + listing pipeline + market value intel:
 *     id 12  customLeadScore            (lead intel)
 *     id 13  customMarketValue          (manual workflow)
 *     id 14  customPurchasePrice        (manual workflow)
 *     id 15  customPurchaseDate         (manual workflow)
 *     id 17  customYearsOwned           (listings pipeline)
 *     id 18  customEquityPercent        (listings pipeline)
 *     id 19  customPropertyType         (listings pipeline)
 *     id 20  customListingExpiredDate   (listings pipeline)
 *     id 21  customListingStatus        (listings pipeline)
 *     id 22  customMLSNumber            (listings pipeline)
 *     id 23  customOriginalListPrice    (listings pipeline)
 *     id 24  customListingDaysOnMarket  (listings pipeline)
 *     id 25  customListingExpiredDateDisplay (listings pipeline)
 *     id 26  customListingStatusDisplay (listings pipeline)
 *     id 28  customMoveTimeline         (NEW SL)
 *     id 29  customLeadTier             (NEW SL)
 *     id 30  customIsSellerCurious      (NEW SL)
 *     id 31  customSellerPropertyAddress (NEW SL)
 *     id 32  customCMADeliveredAt       (NEW SL)
 *     id 33  customCMAPDFURL            (NEW SL)
 *
 *   CANDIDATE DELETE (per audit, KTS anniversary tracking & light-use):
 *     id  1  customWebsite                  (rarely used per audit)
 *     id  2  customBirthday                 (KTS anniversary)
 *     id  3  customClosingAnniversary       (KTS anniversary)
 *     id  5  customHomeAnniversary          (KTS anniversary)
 *     id  7  customOpenHouseAddress         (KTS legacy)
 *     id  9  customRelationshipBirthday     (KTS anniversary)
 *     id 10  customHomeAnniversaryAgnostic  (KTS anniversary)
 *     id 16  customOrganization             (light use)
 *
 * BEFORE DELETING ANY FIELD: scan all 13K+ people and count populated values.
 * If a field has ≥ POPULATED_THRESHOLD populated values on real leads, surface
 * to Matt for explicit go/no-go rather than auto-deleting.
 *
 * Empirically the FUB filter syntax `customBirthday[!=]=null` returns 500;
 * `customBirthday=null` returns 400. Plain pagination through /people with
 * fields=id,customX... is the reliable scan path.
 *
 * Run: DRY=1 (default, scans + reports). DELETE=1 to actually delete fields
 * that are empty or below threshold.
 */

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const DELETE = process.env.DELETE === '1'
const POPULATED_THRESHOLD = parseInt(process.env.POPULATED_THRESHOLD || '20', 10)
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')
const BASE = 'https://api.followupboss.com/v1'

// Field id → field name (must match FUB) for the candidate-delete set.
const CANDIDATES = [
  { id: 1,  name: 'customWebsite',                label: 'Website',                    reason: 'rarely used per audit' },
  { id: 2,  name: 'customBirthday',               label: 'Birthday',                   reason: 'KTS anniversary' },
  { id: 3,  name: 'customClosingAnniversary',     label: 'Closing Anniversary',        reason: 'KTS anniversary' },
  { id: 5,  name: 'customHomeAnniversary',        label: 'Home Anniversary',           reason: 'KTS anniversary' },
  { id: 7,  name: 'customOpenHouseAddress',       label: 'Open House Address',         reason: 'KTS legacy' },
  { id: 9,  name: 'customRelationshipBirthday',   label: 'Relationship Birthday',      reason: 'KTS anniversary' },
  { id: 10, name: 'customHomeAnniversaryAgnostic',label: 'Home Anniversary Agnostic',  reason: 'KTS anniversary' },
  { id: 16, name: 'customOrganization',           label: 'Organization',               reason: 'light use' },
]

// Hard-keep set: even if a populated check fails (e.g. zero usage), these
// stay. Sanity check at write time.
const HARD_KEEP_IDS = new Set([
  12, 13, 14, 15,        // lead intel + market value
  17, 18, 19, 20, 21, 22, 23, 24, 25, 26,  // listings pipeline
  28, 29, 30, 31, 32, 33,  // SL workflow
])

async function fub(method, path, body = null) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Basic ${BASIC}`,
      'Content-Type': 'application/json',
      'X-System': 'RyanRealty-Web',
      'X-System-Key': 'ryan-realty-2026-seller-workflow',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text }
}

async function fubWithRetry(method, path, body = null) {
  let r = await fub(method, path, body)
  if (r.status === 429) {
    await new Promise(rr => setTimeout(rr, 2000))
    r = await fub(method, path, body)
  }
  return r
}

async function countPopulated(fieldNames) {
  // Returns { fieldName: { populated: count, samples: [{id, name, value}, ...] } }
  const stats = Object.fromEntries(fieldNames.map(f => [f, { populated: 0, samples: [] }]))
  const fieldsParam = ['id', 'name', ...fieldNames].join(',')
  let nextUrl = `/people?limit=100&fields=${encodeURIComponent(fieldsParam)}&sort=id`
  let pages = 0
  while (nextUrl) {
    const { status, json } = await fubWithRetry('GET', nextUrl)
    if (status !== 200) {
      console.error(`Scan failed at page ${pages}: status=${status}`)
      return stats
    }
    for (const p of (json?.people || [])) {
      for (const f of fieldNames) {
        const v = p[f]
        if (v !== null && v !== undefined && v !== '') {
          stats[f].populated++
          if (stats[f].samples.length < 5) {
            stats[f].samples.push({ id: p.id, name: p.name, value: v })
          }
        }
      }
    }
    const next = json?._metadata?.nextLink
    nextUrl = next ? next.replace('https://api.followupboss.com/v1', '') : null
    pages++
    if (pages % 25 === 0) process.stdout.write(`  scanned ${pages} pages (${pages * 100} people)\r`)
    await new Promise(r => setTimeout(r, 100))
  }
  process.stdout.write('\n')
  return stats
}

async function main() {
  console.log('=== FUB Custom Field Cleanup ===')
  console.log(`Mode: ${DELETE ? 'EXECUTE (writes will happen)' : 'DRY-RUN (set DELETE=1 to write)'}`)
  console.log(`Populated-threshold: ${POPULATED_THRESHOLD} (fields with ≥ N populated values are surfaced for Matt review)\n`)

  // Always pull the live list to verify our candidate set.
  const { json: cfJson } = await fubWithRetry('GET', '/customFields?limit=100')
  const allFields = cfJson?.customfields || cfJson?.customFields || []
  console.log(`Found ${allFields.length} custom fields total.\n`)

  // Reconcile candidates against live IDs (in case of drift).
  const liveById = new Map(allFields.map(f => [f.id, f]))
  const reconciled = []
  for (const c of CANDIDATES) {
    const live = liveById.get(c.id)
    if (!live) {
      console.log(`  SKIP: candidate id=${c.id} (${c.name}) no longer exists`)
      continue
    }
    if (live.name !== c.name) {
      console.log(`  WARN: candidate id=${c.id} expected name=${c.name} but live is ${live.name}`)
    }
    reconciled.push({ ...c, name: live.name, label: live.label })
  }
  console.log(`Reconciled ${reconciled.length} live candidates to probe.\n`)

  console.log('Scanning 13K+ people for field population (this takes ~15s)...')
  const stats = await countPopulated(reconciled.map(c => c.name))

  console.log('\n=== Population report ===\n')
  console.log('  ID  NAME                              POPULATED  REASON')
  const decisions = []
  for (const c of reconciled) {
    const populated = stats[c.name]?.populated ?? 0
    let verdict
    if (HARD_KEEP_IDS.has(c.id)) verdict = 'HARD-KEEP (sanity guard)'
    else if (populated >= POPULATED_THRESHOLD) verdict = `SURFACE (${populated} populated >= ${POPULATED_THRESHOLD})`
    else if (populated === 0) verdict = 'DELETE (zero usage)'
    else verdict = `DELETE (${populated} populated < ${POPULATED_THRESHOLD})`
    decisions.push({ ...c, populated, verdict, samples: stats[c.name]?.samples ?? [] })
    console.log(`  ${String(c.id).padStart(2)}  ${c.name.padEnd(35)}  ${String(populated).padStart(5)}     ${verdict}`)
  }

  // Show samples for the SURFACE rows (so Matt can decide whether the populated
  // values are real or junk).
  const toSurface = decisions.filter(d => d.verdict.startsWith('SURFACE'))
  if (toSurface.length > 0) {
    console.log('\n=== Samples for SURFACE-to-Matt fields ===')
    for (const d of toSurface) {
      console.log(`\n  ${d.name} (${d.populated} populated):`)
      for (const s of d.samples) {
        console.log(`    id=${s.id}  ${s.name}  value=${JSON.stringify(s.value)}`)
      }
    }
  }

  const toDelete = decisions.filter(d => d.verdict.startsWith('DELETE'))
  console.log(`\n=== Action ===`)
  console.log(`  DELETE candidates: ${toDelete.length}`)
  console.log(`  SURFACE to Matt:   ${toSurface.length}`)
  console.log()

  if (!DELETE) {
    console.log('Dry run. Set DELETE=1 to delete the safe (zero/low usage) fields.')
    console.log('SURFACE rows are never auto-deleted — re-run with explicit per-field')
    console.log('override or talk to Matt.')
    return
  }

  console.log('--- Executing deletions (only DELETE rows) ---')
  let ok = 0, failed = 0, refused = 0
  for (const d of toDelete) {
    if (HARD_KEEP_IDS.has(d.id)) { refused++; continue }
    const { status, text } = await fubWithRetry('DELETE', `/customFields/${d.id}`)
    if (status >= 200 && status < 300) {
      console.log(`  DELETED  id=${d.id}  ${d.name}`)
      ok++
    } else {
      console.log(`  FAILED   id=${d.id}  ${d.name}  status=${status}  body=${text.slice(0, 200)}`)
      failed++
    }
    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`\nDone. Deleted: ${ok}. Failed: ${failed}. Refused: ${refused}.`)

  // Final state
  const { json: postJson } = await fubWithRetry('GET', '/customFields?limit=100')
  const after = postJson?.customfields || postJson?.customFields || []
  console.log(`\nCustom fields remaining: ${after.length}`)
  for (const f of after.sort((a, b) => a.id - b.id)) {
    console.log(`  id=${String(f.id).padStart(3)}  ${(f.name || '').padEnd(35)}  ${f.label}  (${f.type})`)
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
