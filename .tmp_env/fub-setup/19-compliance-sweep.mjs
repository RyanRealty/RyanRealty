#!/usr/bin/env node
/**
 * Compliance sweep: for every record carrying `Bounced` OR `Unsubscribed`,
 * also write `do_not_email` (and `compliance:hard-stop`) so FUB action plans
 * have an explicit hard-block tag to filter against.
 *
 * Per audit §7: 470 Bounced + 230 Unsubscribed records have NO enforcement.
 * The new Seller Lead — Master Workflow doesn't currently exclude them.
 *
 * Run: DELETE=1 to execute (default dry-run).
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
      'X-System-Key': 'ryan-realty-2026-seller-workflow',
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
  let next = `/people?tags=${encodeURIComponent(tag)}&limit=100&sort=id&fields=id,name,tags`
  while (next) {
    const r = await fubWithRetry('GET', next)
    if (!r.ok) {
      console.error(`  ❌ GET failed: ${r.status}. Stopping ${tag} iteration.`)
      return
    }
    const j = r.json
    const people = j?.people || []
    if (!people.length) return
    for (const p of people) yield p
    const nl = j?._metadata?.nextLink
    next = nl ? nl.replace('https://api.followupboss.com/v1', '') : null
    await new Promise(r => setTimeout(r, 80))
  }
}

async function main() {
  console.log(`Mode: ${DELETE ? 'EXECUTE' : 'DRY-RUN'}\n`)

  const seen = new Set()
  let scanned = 0, written = 0, skipped = 0, errors = 0

  for (const tag of ['Bounced', 'Unsubscribed']) {
    console.log(`Scanning ${tag}…`)
    for await (const p of iterateByTag(tag)) {
      scanned++
      if (seen.has(p.id)) continue
      seen.add(p.id)

      const tagsLower = (p.tags || []).map(t => t.toLowerCase())
      const hasDoNotEmail = tagsLower.includes('do_not_email')
      const hasHardStop = tagsLower.includes('compliance:hard-stop')

      const toAdd = []
      if (!hasDoNotEmail) toAdd.push('do_not_email')
      if (!hasHardStop) toAdd.push('compliance:hard-stop')

      if (toAdd.length === 0) { skipped++; continue }

      if (!DELETE) { written++; continue }

      const r = await fubWithRetry('PUT', `/people/${p.id}?mergeTags=true`, { tags: toAdd })
      if (r.ok) written++
      else { errors++; console.warn(`  PUT ${p.id} failed: ${r.status}`) }
      await new Promise(r => setTimeout(r, 80))
    }
  }

  console.log(`\nSummary:`)
  console.log(`  scanned:   ${scanned}`)
  console.log(`  unique:    ${seen.size}`)
  console.log(`  written:   ${written}`)
  console.log(`  skipped:   ${skipped} (already compliant)`)
  console.log(`  errors:    ${errors}`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
