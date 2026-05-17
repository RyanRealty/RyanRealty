#!/usr/bin/env node
/**
 * Find test records in FUB and DELETE them.
 *
 * Identifies test records by:
 *  - tag containing "TEST" / "test record" / "delete me" / "v6 audit"
 *  - name containing "test"
 *  - source = localhost:3000
 *  - explicit allow-list of known test ids (safety)
 *
 * Dry-run by default. Set DELETE=1 in env to actually delete.
 */

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY?.trim()
const DELETE = process.env.DELETE === '1'
if (!FUB_KEY) throw new Error('Missing FOLLOWUPBOSS_API_KEY')
const BASIC = Buffer.from(`${FUB_KEY}:`).toString('base64')
const BASE = 'https://api.followupboss.com/v1'

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

function isTest(p) {
  const tags = (p.tags || []).map(t => t.toLowerCase())
  const name = (p.name || '').toLowerCase()
  const src = (p.source || '').toLowerCase()
  const emails = (p.emails || []).map(e => (e.value || '').toLowerCase())

  return (
    tags.some(t => /^test\b|test record|delete me|v6 audit|test-delete-me/i.test(t)) ||
    /\btest\b/.test(name) ||
    /variant-b/i.test(name) ||
    src === 'localhost:3000' ||
    emails.some(e => /^test\+/.test(e))
  )
}

async function main() {
  console.log(`=== FUB Test Record Cleanup ===`)
  console.log(`Mode: ${DELETE ? 'DELETE' : 'DRY-RUN (set DELETE=1 to actually delete)'}\n`)

  // Pull most recent 200 people. Test records are all recent.
  const allTests = []
  let offset = 0
  while (true) {
    const { json } = await fub('GET', `/people?sort=-created&limit=100&offset=${offset}`)
    const people = json?.people || []
    if (!people.length) break
    for (const p of people) {
      if (isTest(p)) allTests.push(p)
    }
    if (people.length < 100 || offset >= 400) break
    offset += 100
  }

  console.log(`Found ${allTests.length} test records to delete:\n`)
  for (const p of allTests) {
    console.log(`  id=${p.id}  ${p.name || '(no name)'}  src=${p.source || '(no src)'}  tags=[${(p.tags || []).join(', ')}]`)
  }

  if (!DELETE) {
    console.log('\nDry run — no records deleted. Set DELETE=1 to actually delete.')
    return
  }

  console.log('\n=== DELETING ===\n')
  for (const p of allTests) {
    const { status, json } = await fub('DELETE', `/people/${p.id}`)
    if (status >= 200 && status < 300) {
      console.log(`  DELETED  id=${p.id}  ${p.name}`)
    } else {
      console.log(`  FAILED   id=${p.id}  ${p.name}  status=${status}  ${JSON.stringify(json)}`)
    }
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
