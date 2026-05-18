#!/usr/bin/env node
/**
 * Two cleanups in one pass to save FUB API calls:
 *
 *   Pass A: Normalize website source-string variants → canonical
 *     - `Website` → `Ryan-Realty.com`
 *     - `ryan-realty` → `Ryan-Realty.com`
 *     - `ryanrealty.vercel.app` → `Ryan-Realty.com` (and tag `env:preview`)
 *
 *   Pass B: Backfill canonical audience tag on legacy `Buyer`-tagged leads
 *     - 45 records carry `Buyer` (Title Case) → add `audience:buyer`
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

async function* iterateAllPeople(extraFields = 'tags,source') {
  let next = `/people?limit=100&sort=id&fields=id,name,${extraFields}`
  while (next) {
    const r = await fubWithRetry('GET', next)
    if (!r.ok) { console.error(`GET failed: ${r.status}`); return }
    const j = r.json
    const people = j?.people || []
    if (!people.length) return
    for (const p of people) yield p
    const nl = j?._metadata?.nextLink
    next = nl ? nl.replace('https://api.followupboss.com/v1', '') : null
    await new Promise(r => setTimeout(r, 50))
  }
}

const SOURCE_MAP = {
  'Website': 'Ryan-Realty.com',
  'ryan-realty': 'Ryan-Realty.com',
  'ryanrealty.vercel.app': 'Ryan-Realty.com',  // also gets env:preview tag
}

async function main() {
  console.log(`Mode: ${DELETE ? 'EXECUTE' : 'DRY-RUN'}\n`)

  const stats = {
    scanned: 0,
    src_normalize: 0,
    src_normalize_preview_tagged: 0,
    buyer_backfilled: 0,
    errors: 0,
  }
  const samples = { src: [], buyer: [] }

  for await (const p of iterateAllPeople('tags,source')) {
    stats.scanned++
    if (stats.scanned % 2000 === 0) console.log(`  scanned ${stats.scanned}…`)

    const tagsLower = (p.tags || []).map(t => t.toLowerCase())
    const hasAudienceBuyer = tagsLower.includes('audience:buyer')
    const hasBuyer = tagsLower.includes('buyer')
    const wasPreview = p.source === 'ryanrealty.vercel.app'

    const sourceUpdate = SOURCE_MAP[p.source]
    const needsBuyerTag = hasBuyer && !hasAudienceBuyer
    const needsPreviewTag = wasPreview && !tagsLower.includes('env:preview')

    if (!sourceUpdate && !needsBuyerTag && !needsPreviewTag) continue

    // Build mutation
    const body = {}
    if (sourceUpdate) body.source = sourceUpdate
    const tagsToAdd = []
    if (needsBuyerTag) tagsToAdd.push('audience:buyer')
    if (needsPreviewTag) tagsToAdd.push('env:preview')

    if (sourceUpdate) {
      stats.src_normalize++
      if (samples.src.length < 5) samples.src.push({ id: p.id, name: p.name, from: p.source, to: sourceUpdate })
    }
    if (needsBuyerTag) {
      stats.buyer_backfilled++
      if (samples.buyer.length < 5) samples.buyer.push({ id: p.id, name: p.name, existing_tags: p.tags })
    }
    if (needsPreviewTag) stats.src_normalize_preview_tagged++

    if (!DELETE) continue

    if (Object.keys(body).length > 0) {
      const r = await fubWithRetry('PUT', `/people/${p.id}`, body)
      if (!r.ok) { stats.errors++; continue }
    }
    if (tagsToAdd.length > 0) {
      const r = await fubWithRetry('PUT', `/people/${p.id}?mergeTags=true`, { tags: tagsToAdd })
      if (!r.ok) stats.errors++
    }
    await new Promise(r => setTimeout(r, 80))
  }

  console.log(`\nSummary:`)
  for (const [k, v] of Object.entries(stats)) console.log(`  ${k.padEnd(30)} ${v}`)

  if (samples.src.length) {
    console.log('\nSource-normalize samples:')
    for (const s of samples.src) console.log(`  id=${s.id} ${s.name}  ${s.from} → ${s.to}`)
  }
  if (samples.buyer.length) {
    console.log('\nBuyer backfill samples:')
    for (const s of samples.buyer) console.log(`  id=${s.id} ${s.name}  tags=[${s.existing_tags?.join(', ')}]`)
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
