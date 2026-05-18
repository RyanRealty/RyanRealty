#!/usr/bin/env node
/**
 * Bulk-add canonical `industry:realtor` + `compliance:hard-stop` tags to every
 * record carrying any legacy realtor variant. Makes them filterable in FUB
 * smart lists (filter: industry:realtor) and ensures the action plans skip
 * them via the audience filter (exclude compliance:hard-stop).
 *
 * Legacy variants normalized:
 *   - Realtor (~2,316)
 *   - Real Estate (~612)
 *   - Real Estate Agent (stage, ~2,313 — handled separately)
 *
 * Per Matt's 2026-05-17 directive: "never sending it to existing realtors
 * who have been tagged with the realtor tag."
 *
 * Run: DELETE=1 to execute. Idempotent.
 */

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const DELETE = process.env.DELETE === '1'
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')

async function fubRaw(method, path, body = null) {
  const res = await fetch(`https://api.followupboss.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${BASIC}`,
      'Content-Type': 'application/json',
      'X-System': 'RyanRealty-Web',
      'X-System-Key': 'ryan-realty-2026',
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

async function* iterateByTag(tag) {
  let next = `/people?tags=${encodeURIComponent(tag)}&limit=100&sort=id&fields=id,name,tags,stage`
  while (next) {
    const r = await fubWithRetry('GET', next)
    if (!r.ok) { console.error(`GET failed: ${r.status}`); return }
    const j = r.json
    const people = j?.people || []
    if (!people.length) return
    for (const p of people) yield p
    const nl = j?._metadata?.nextLink
    next = nl ? nl.replace('https://api.followupboss.com/v1', '') : null
    await new Promise(r => setTimeout(r, 60))
  }
}

async function main() {
  console.log(`Mode: ${DELETE ? 'EXECUTE' : 'DRY-RUN'}\n`)

  const seen = new Set()
  const stats = {
    scanned: 0,
    skipped_already_canonical: 0,
    written: 0,
    errors: 0,
  }

  for (const legacy of ['Realtor', 'Real Estate']) {
    console.log(`Scanning leads tagged "${legacy}"…`)
    for await (const p of iterateByTag(legacy)) {
      stats.scanned++
      if (seen.has(p.id)) continue
      seen.add(p.id)

      const tagsLower = (p.tags || []).map(t => t.toLowerCase())
      const hasIndustry = tagsLower.includes('industry:realtor')
      const hasHardStop = tagsLower.includes('compliance:hard-stop')

      const toAdd = []
      if (!hasIndustry) toAdd.push('industry:realtor')
      if (!hasHardStop) toAdd.push('compliance:hard-stop')
      if (toAdd.length === 0) { stats.skipped_already_canonical++; continue }

      if (!DELETE) {
        stats.written++
        continue
      }

      const r = await fubWithRetry('PUT', `/people/${p.id}?mergeTags=true`, { tags: toAdd })
      if (r.ok) stats.written++
      else { stats.errors++; console.warn(`  PUT ${p.id} failed: ${r.status}`) }
      if (stats.written % 100 === 0 && stats.written > 0) {
        console.log(`  written ${stats.written}…`)
      }
      await new Promise(r => setTimeout(r, 60))
    }
  }

  console.log(`\nSummary:`)
  console.log(`  scanned:                 ${stats.scanned}`)
  console.log(`  unique people:           ${seen.size}`)
  console.log(`  already canonical:       ${stats.skipped_already_canonical}`)
  console.log(`  written:                 ${stats.written}`)
  console.log(`  errors:                  ${stats.errors}`)
  if (!DELETE) console.log(`\n  → re-run with DELETE=1 to execute.`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
