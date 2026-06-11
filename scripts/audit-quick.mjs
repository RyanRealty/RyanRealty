import { config } from 'dotenv'
config({ path: '/Users/matthewryan/RyanRealty/.env.local' })
const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY.trim()
const AUTH = `Basic ${Buffer.from(`${FUB_KEY}:`).toString('base64')}`
const HEADERS = { Authorization: AUTH, Accept: 'application/json' }
const stats = { total: 0, with_nbhd: 0, without: 0, no_address: 0 }
let nextCursor = null, walked = 0
while (true) {
  const url = nextCursor
    ? `https://api.followupboss.com/v1/people?tags=city:bend&limit=100&next=${nextCursor}&fields=id,addresses,tags,customSellerPropertyAddress`
    : `https://api.followupboss.com/v1/people?tags=city:bend&limit=100&fields=id,addresses,tags,customSellerPropertyAddress`
  const r = await fetch(url, { headers: HEADERS })
  if (!r.ok) { console.error('FAIL', r.status); break }
  const data = await r.json()
  const ps = data.people || []
  if (!nextCursor) console.log('Total city:bend:', data._metadata?.total)
  if (ps.length === 0) break
  for (const p of ps) {
    stats.total++
    const hasN = (p.tags || []).some(t => t.startsWith('neighborhood:'))
    if (hasN) stats.with_nbhd++
    else {
      stats.without++
      if (!((p.addresses?.length || 0) > 0 || p.customSellerPropertyAddress)) stats.no_address++
    }
  }
  walked += ps.length
  if (walked % 1000 === 0) console.log(`  ${walked}...`)
  nextCursor = data._metadata?.next || null
  if (!nextCursor) break
}
console.log(JSON.stringify(stats, null, 2))
