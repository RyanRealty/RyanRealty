#!/usr/bin/env node
// Bridge my namespaced status tags → Matt's plain-word existing convention.
// Adds "Expired" / "canceled" / "withdrawn" to leads tagged status:expired / status:canceled / status:withdrawn.
import { config } from 'dotenv'
config({ path: '/Users/matthewryan/RyanRealty/.env.local' })

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY.trim()
const AUTH = `Basic ${Buffer.from(`${FUB_KEY}:`).toString('base64')}`
const HEADERS = { Authorization: AUTH, 'Content-Type': 'application/json', Accept: 'application/json' }

const MAP = {
  'status:expired': 'Expired',
  'status:canceled': 'canceled',
  'status:withdrawn': 'withdrawn',
}

const stats = { processed: 0, already_tagged: 0, tagged: 0, errors: 0 }

let nextCursor = null
while (true) {
  const url = nextCursor
    ? `https://api.followupboss.com/v1/people?tags=intent:expired-listing&limit=100&next=${nextCursor}&fields=id,tags`
    : `https://api.followupboss.com/v1/people?tags=intent:expired-listing&limit=100&fields=id,tags`
  const r = await fetch(url, { headers: HEADERS })
  const data = await r.json()
  const ps = data.people || []
  if (ps.length === 0) break

  for (const p of ps) {
    stats.processed++
    const tags = p.tags || []
    const toAdd = []
    for (const [ns, plain] of Object.entries(MAP)) {
      if (tags.includes(ns) && !tags.includes(plain)) toAdd.push(plain)
    }
    if (toAdd.length === 0) { stats.already_tagged++; continue }
    const newTags = [...new Set([...tags, ...toAdd])]
    const r2 = await fetch(`https://api.followupboss.com/v1/people/${p.id}`, {
      method: 'PUT', headers: HEADERS, body: JSON.stringify({ tags: newTags })
    })
    if (r2.ok) {
      stats.tagged++
      console.log(`  ✓ ${p.id}: added ${toAdd.join(', ')}`)
    } else {
      stats.errors++
    }
    await new Promise(r => setTimeout(r, 200))
  }
  nextCursor = data._metadata?.next || null
  if (!nextCursor) break
}

console.log()
console.log('═══ Migration summary ═══')
console.log(JSON.stringify(stats, null, 2))
