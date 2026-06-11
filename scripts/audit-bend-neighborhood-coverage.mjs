#!/usr/bin/env node
// Audit: how many city:bend people have neighborhood:* tags? Walk all pages.
import { config } from 'dotenv'
config({ path: '/Users/matthewryan/RyanRealty/.env.local' })

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY.trim()
const AUTH = `Basic ${Buffer.from(`${FUB_KEY}:`).toString('base64')}`
const HEADERS = { Authorization: AUTH, Accept: 'application/json' }

const stats = { total: 0, with_nbhd: 0, without: 0, no_address: 0 }
const noAddrSample = []

let nextCursor = null
let walked = 0
while (true) {
  const url = nextCursor
    ? `https://api.followupboss.com/v1/people?tags=city:bend&limit=100&next=${nextCursor}&fields=id,addresses,tags,customSellerPropertyAddress`
    : `https://api.followupboss.com/v1/people?tags=city:bend&limit=100&fields=id,addresses,tags,customSellerPropertyAddress`
  const r = await fetch(url, { headers: HEADERS })
  if (!r.ok) { console.error(`Failed: ${r.status}`); break }
  const data = await r.json()
  const people = data.people || []
  if (!nextCursor) console.log(`Total reported by FUB: ${data._metadata?.total}`)
  if (people.length === 0) break
  for (const p of people) {
    stats.total++
    const hasN = (p.tags || []).some(t => t.startsWith('neighborhood:'))
    if (hasN) {
      stats.with_nbhd++
    } else {
      stats.without++
      const hasAddr = (p.addresses?.length || 0) > 0 || p.customSellerPropertyAddress
      if (!hasAddr) {
        stats.no_address++
        if (noAddrSample.length < 5) noAddrSample.push(p.id)
      }
    }
  }
  walked += people.length
  if (walked % 1000 === 0) console.log(`  walked ${walked}...`)
  nextCursor = data._metadata?.next || null
  if (!nextCursor) break
}

console.log('')
console.log('═══ Audit summary ═══')
console.log(JSON.stringify(stats, null, 2))
console.log(`\nSample person IDs without address: ${noAddrSample.join(', ')}`)
