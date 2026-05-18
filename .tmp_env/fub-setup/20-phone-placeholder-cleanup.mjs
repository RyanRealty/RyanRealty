#!/usr/bin/env node
/**
 * Wipe phone fields on records where the phone number is shared by 5+ other
 * records — these are KTS placeholder numbers, not real contact info.
 *
 * Per audit §4b: 652 phone-dupe groups, top shared by 29 records each.
 *
 * Strategy:
 *   1. Pull all 13K records with phone fields
 *   2. Group by normalized phone number
 *   3. For any group with count >= 5, wipe the phone field on every member
 *      (we lose nothing real — the number was a placeholder anyway)
 *
 * Run: DELETE=1 to execute (default dry-run).
 */

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const DELETE = process.env.DELETE === '1'
const THRESHOLD = parseInt(process.env.THRESHOLD || '5', 10)
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')

async function fubRaw(method, path, body = null) {
  const res = await fetch(`https://api.followupboss.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${BASIC}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json }
}

async function fubWithRetry(method, path, body = null, maxAttempts = 5) {
  for (let i = 1; i <= maxAttempts; i++) {
    const r = await fubRaw(method, path, body)
    if (r.status >= 200 && r.status < 300) return { ok: true, ...r }
    if (r.status === 429 || (r.status >= 500 && r.status < 600)) {
      await new Promise(rr => setTimeout(rr, Math.min(1000 * 2 ** (i - 1), 15_000)))
      continue
    }
    return { ok: false, ...r }
  }
  return { ok: false, status: 0 }
}

function normalizePhone(p) {
  const digits = (p || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits
}

async function main() {
  console.log(`Mode: ${DELETE ? 'EXECUTE' : 'DRY-RUN'}`)
  console.log(`Threshold: groups with >= ${THRESHOLD} records sharing one phone\n`)

  // Pass 1: scan everyone, build phone→[id] map
  const phoneToIds = new Map()
  let scanned = 0
  let next = `/people?limit=100&sort=id&fields=id,name,phones`
  while (next) {
    const r = await fubWithRetry('GET', next)
    if (!r.ok) { console.error(`GET failed: ${r.status}`); break }
    const j = r.json
    for (const p of (j?.people || [])) {
      scanned++
      for (const ph of (p.phones || [])) {
        const norm = normalizePhone(ph.value)
        if (!norm || norm.length < 7) continue
        if (!phoneToIds.has(norm)) phoneToIds.set(norm, [])
        phoneToIds.get(norm).push({ id: p.id, name: p.name, original: ph.value })
      }
    }
    const nl = j?._metadata?.nextLink
    next = nl ? nl.replace('https://api.followupboss.com/v1', '') : null
    if (scanned % 2000 === 0) console.log(`  scanned ${scanned}…`)
    await new Promise(r => setTimeout(r, 50))
  }
  console.log(`\nScanned ${scanned} records, ${phoneToIds.size} distinct phones\n`)

  // Pass 2: find groups >= threshold
  const placeholderGroups = []
  for (const [phone, ids] of phoneToIds.entries()) {
    if (ids.length >= THRESHOLD) placeholderGroups.push({ phone, ids })
  }
  placeholderGroups.sort((a, b) => b.ids.length - a.ids.length)

  console.log(`Placeholder phone groups (${placeholderGroups.length}):`)
  for (const g of placeholderGroups.slice(0, 15)) {
    console.log(`  ${g.phone} — ${g.ids.length} records`)
  }

  const allTargetIds = placeholderGroups.flatMap(g => g.ids.map(x => x.id))
  console.log(`\nTotal records to wipe phone on: ${allTargetIds.length}\n`)

  if (!DELETE) {
    console.log('Dry-run. Set DELETE=1 to execute.')
    return
  }

  let ok = 0, fail = 0
  for (const id of allTargetIds) {
    // PUT person/{id} with phones:[] — empties the phones array
    const r = await fubWithRetry('PUT', `/people/${id}`, { phones: [] })
    if (r.ok) ok++
    else { fail++; console.warn(`PUT ${id} failed: ${r.status}`) }
    if (ok % 50 === 0 && ok > 0) console.log(`  wiped ${ok}/${allTargetIds.length}…`)
    await new Promise(r => setTimeout(r, 80))
  }
  console.log(`\nDone. Wiped ${ok}, Failed ${fail}.`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
