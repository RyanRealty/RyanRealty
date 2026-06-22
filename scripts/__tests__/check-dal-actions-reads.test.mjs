import { describe, it, expect } from 'vitest'
import { countActionReads } from '../check-dal-actions-reads.mjs'

// The app/actions read ratchet counts raw `.from('table').select(...)` reads and
// ignores writes (.insert/.update/.upsert/.delete) and ambiguous builders.

describe('countActionReads', () => {
  it('counts a single-line .from().select read', () => {
    expect(countActionReads(`await sb.from('crm_people').select('*').eq('id', 1)`)).toBe(1)
  })

  it('counts a multi-line .from()\\n.select chain', () => {
    const src = `
const { data } = await sb
  .from('listings')
  .select('"ListingKey"')
  .limit(10)
`
    expect(countActionReads(src)).toBe(1)
  })

  it('does NOT count writes (insert/update/upsert/delete)', () => {
    const src = `
await sb.from('a').insert({ x: 1 })
await sb.from('b').update({ y: 2 }).eq('id', 1)
await sb.from('c').upsert({ z: 3 })
await sb.from('d').delete().eq('id', 1)
`
    expect(countActionReads(src)).toBe(0)
  })

  it('counts only the reads in a mixed file', () => {
    const src = `
await sb.from('a').select('id')
await sb.from('b').insert({ x: 1 })
await sb.from('c').select('*').single()
`
    expect(countActionReads(src)).toBe(2)
  })

  it('does NOT count a .from() with no nearby verb (ambiguous builder)', () => {
    const src = `const q = sb.from('a'); doSomethingElse(); return q`
    expect(countActionReads(src)).toBe(0)
  })

  it('does NOT count Buffer.from / Array.from', () => {
    const src = `const b = Buffer.from('select'); const a = Array.from('x')`
    expect(countActionReads(src)).toBe(0)
  })
})
