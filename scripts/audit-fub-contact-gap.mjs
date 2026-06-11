#!/usr/bin/env node
// Audit FUB population for contact gaps:
// - Total people
// - With/without email
// - With/without phone (any)
// - With/without mobile-typed phone
// - Has address but no contact → skiptrace candidates
import { config } from 'dotenv'
config({ path: '/Users/matthewryan/RyanRealty/.env.local' })

const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY.trim()
const AUTH = `Basic ${Buffer.from(`${FUB_KEY}:`).toString('base64')}`
const HEADERS = { Authorization: AUTH, Accept: 'application/json' }

const stats = {
  total: 0,
  has_email: 0,
  has_phone: 0,
  has_mobile: 0,
  no_email: 0,
  no_phone: 0,
  no_email_and_no_phone: 0,
  no_email_and_no_mobile: 0,
  no_email_and_no_phone_with_address: 0,    // tracerfy candidates
  no_email_and_no_mobile_with_address: 0,   // broader tracerfy candidates
}

const byTag = {}  // count gaps by city tag, top-level

let nextCursor = null, walked = 0
while (true) {
  const url = nextCursor
    ? `https://api.followupboss.com/v1/people?limit=100&next=${nextCursor}&fields=id,emails,phones,addresses,tags,customSellerPropertyAddress`
    : `https://api.followupboss.com/v1/people?limit=100&fields=id,emails,phones,addresses,tags,customSellerPropertyAddress`
  const r = await fetch(url, { headers: HEADERS })
  if (!r.ok) { console.error('FAIL', r.status); break }
  const data = await r.json()
  const ps = data.people || []
  if (!nextCursor) console.log(`Total FUB people:`, data._metadata?.total)
  if (ps.length === 0) break

  for (const p of ps) {
    stats.total++
    const hasEmail = (p.emails || []).some(e => e.value && !e.value.includes('placeholder'))
    const phones = p.phones || []
    const hasPhone = phones.some(ph => ph.value)
    const hasMobile = phones.some(ph => ph.value && (
      (ph.type || '').toLowerCase().includes('mobile') ||
      (ph.type || '').toLowerCase().includes('cell')
    ))
    const hasAddress = (p.addresses?.length || 0) > 0 || !!p.customSellerPropertyAddress

    if (hasEmail) stats.has_email++; else stats.no_email++
    if (hasPhone) stats.has_phone++; else stats.no_phone++
    if (hasMobile) stats.has_mobile++

    if (!hasEmail && !hasPhone) stats.no_email_and_no_phone++
    if (!hasEmail && !hasMobile) stats.no_email_and_no_mobile++

    if (!hasEmail && !hasPhone && hasAddress) stats.no_email_and_no_phone_with_address++
    if (!hasEmail && !hasMobile && hasAddress) stats.no_email_and_no_mobile_with_address++

    // group by city tag for skiptrace candidates
    if (!hasEmail && !hasMobile && hasAddress) {
      const cityTag = (p.tags || []).find(t => t.startsWith('city:')) || 'city:unknown'
      byTag[cityTag] = (byTag[cityTag] || 0) + 1
    }
  }
  walked += ps.length
  if (walked % 1000 === 0) console.log(`  walked ${walked}...`)
  nextCursor = data._metadata?.next || null
  if (!nextCursor) break
}

console.log()
console.log('═══ Contact gap audit ═══')
console.log(JSON.stringify(stats, null, 2))
console.log()
console.log('Tracerfy candidates by city tag (need both email + mobile, have address):')
for (const [tag, n] of Object.entries(byTag).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${tag.padEnd(30)} ${n}`)
}
