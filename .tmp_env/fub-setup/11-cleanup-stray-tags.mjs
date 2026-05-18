#!/usr/bin/env node
/**
 * Final-pass cleanup of stray source / medium / segmentation tags that
 * predate the canonical source:* / broker:* / audience:* schema.
 *
 * Most of these were already handled by script 09 (orphan tags). This script
 * runs a sweep across a broader pattern set to catch anything missed — using
 * regex match on tag names from a fresh inventory scan.
 *
 * Tags caught by REGEX:
 *   /^src:/         (src:direct, src:facebook, etc.)
 *   /^medium:/      (medium:none, medium:cpc, etc.)
 *   /^Source[: -]/i (Source:ig, Source-FB-Ad, except: Source: chatgpt.com — KEEP)
 *   /^segment:/     (segment:my-leads)
 *   /^utm[_:]/      (utm_source, utm:campaign)
 *
 * Explicit KEEP overrides (case-insensitive):
 *   Source: chatgpt.com — useful attribution signal per task brief
 *   source:seller-lp, source:fb-ads-seller, source:google-ads-seller,
 *   source:referral, source:open-house, source:gbp — canonical schema
 *   broker:matt, broker:rebecca, broker:paul — canonical schema
 *   audience:* — canonical schema
 *   seller:* — canonical schema
 *
 * Run: DRY=1 (default) or DELETE=1 to execute.
 */

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const DELETE = process.env.DELETE === '1'
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')
const BASE = 'https://api.followupboss.com/v1'

// Patterns whose hits we STRIP from every lead.
const STRIP_PATTERNS = [
  /^src:/i,
  /^medium:/i,
  /^segment:/i,
  /^utm[_:]/i,
  /^source[- :]/i,  // Source: foo, Source-Foo, Source Foo
]

// Hard-keep regex/strings — these tags survive even if they match the strip
// patterns. Matched case-insensitively.
const KEEP_PATTERNS = [
  /^source: chatgpt\.com$/i,  // useful attribution
  /^source:seller-lp$/i,       // canonical schema
  /^source:fb-ads-seller$/i,
  /^source:google-ads-seller$/i,
  /^source:referral$/i,
  /^source:open-house$/i,
  /^source:gbp$/i,
  /^source:cma-lp$/i,
  /^source:website-form$/i,
  // anything else canonical — broker:*, audience:*, seller:* won't match the
  // strip patterns anyway, so no need to allowlist them here.
]

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

function shouldStrip(tag) {
  if (KEEP_PATTERNS.some(p => p.test(tag))) return false
  return STRIP_PATTERNS.some(p => p.test(tag))
}

async function buildTagInventory() {
  const tagCounts = {}
  let nextUrl = '/people?limit=100&sort=id&fields=id,tags'
  let pages = 0
  while (nextUrl) {
    const { status, json } = await fubWithRetry('GET', nextUrl)
    if (status !== 200) break
    for (const p of (json?.people || [])) {
      for (const t of (p.tags || [])) {
        tagCounts[t] = (tagCounts[t] || 0) + 1
      }
    }
    nextUrl = json._metadata?.nextLink ? json._metadata.nextLink.replace(BASE, '') : null
    pages++
    if (pages % 25 === 0) process.stderr.write(`  scanning ${pages} pages\r`)
    await new Promise(r => setTimeout(r, 100))
  }
  process.stderr.write('\n')
  return tagCounts
}

async function* iteratePeopleByTag(tagName) {
  let nextUrl = `/people?tags=${encodeURIComponent(tagName)}&limit=100&sort=id&fields=id,name,tags`
  while (nextUrl) {
    const { status, json } = await fubWithRetry('GET', nextUrl)
    if (status !== 200) return
    for (const p of (json?.people || [])) yield p
    const next = json?._metadata?.nextLink
    nextUrl = next ? next.replace(BASE, '') : null
    await new Promise(r => setTimeout(r, 100))
  }
}

async function main() {
  console.log('=== FUB Stray Source/Medium Tag Cleanup ===')
  console.log(`Mode: ${DELETE ? 'EXECUTE' : 'DRY-RUN (set DELETE=1 to write)'}\n`)

  console.log('Building tag inventory (scanning all leads)...')
  const inventory = await buildTagInventory()
  console.log(`Found ${Object.keys(inventory).length} unique tags\n`)

  const toStrip = []
  const toKeep = []
  for (const [tag, count] of Object.entries(inventory)) {
    if (shouldStrip(tag)) {
      toStrip.push({ tag, count })
    } else if (STRIP_PATTERNS.some(p => p.test(tag))) {
      // matched a strip pattern but a keep-override saved it
      toKeep.push({ tag, count, reason: 'keep-override' })
    }
  }

  console.log(`=== Tags to STRIP (${toStrip.length}) ===`)
  for (const { tag, count } of toStrip.sort((a, b) => b.count - a.count)) {
    console.log(`  ${String(count).padStart(4)}  ${tag}`)
  }
  console.log()

  console.log(`=== Matched strip pattern but KEPT by override (${toKeep.length}) ===`)
  for (const { tag, count, reason } of toKeep) {
    console.log(`  ${String(count).padStart(4)}  ${tag}  [${reason}]`)
  }
  console.log()

  if (toStrip.length === 0) {
    console.log('Nothing to do — no stray source/medium tags found.')
    return
  }

  if (!DELETE) {
    console.log('Dry run. Set DELETE=1 to execute strips.')
    return
  }

  console.log('--- Executing strips ---')
  let ok = 0, failed = 0, touchesTotal = 0, touchesDone = 0

  // First, count total touches across all targeted tags
  for (const { tag } of toStrip) touchesTotal += inventory[tag]

  for (const { tag } of toStrip) {
    for await (const p of iteratePeopleByTag(tag)) {
      const currentTags = p.tags || []
      const newTags = currentTags.filter(t => t.toLowerCase() !== tag.toLowerCase())
      if (newTags.length === currentTags.length) {
        touchesDone++
        continue
      }
      const { status, text } = await fubWithRetry('PUT', `/people/${p.id}`, { tags: newTags })
      if (status >= 200 && status < 300) {
        ok++
      } else {
        failed++
        console.log(`  FAILED  id=${p.id}  tag="${tag}"  status=${status}  body=${text.slice(0, 200)}`)
      }
      touchesDone++
      if (touchesDone % 50 === 0) console.log(`  progress: ${touchesDone}/${touchesTotal}`)
      await new Promise(r => setTimeout(r, 100))
    }
  }

  console.log(`\nDone. Removed: ${ok}. Failed: ${failed}.`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
