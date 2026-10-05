import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cmaBlockedBecauseOnMarket } from '@/lib/cma/on-market'

describe('cmaBlockedBecauseOnMarket', () => {
  it('refuses a home that is listed', () => {
    expect(cmaBlockedBecauseOnMarket('Active')).toMatch(/Active on the market/)
    expect(cmaBlockedBecauseOnMarket('Pending')).toMatch(/Pending/)
    expect(cmaBlockedBecauseOnMarket('Coming Soon')).toMatch(/Coming Soon/)
    expect(cmaBlockedBecauseOnMarket('Active Under Contract')).toMatch(/Active Under Contract/)
  })

  it('builds a home that came off without selling', () => {
    expect(cmaBlockedBecauseOnMarket('Expired')).toBeNull()
    expect(cmaBlockedBecauseOnMarket('Canceled')).toBeNull()
    expect(cmaBlockedBecauseOnMarket('Withdrawn')).toBeNull()
    expect(cmaBlockedBecauseOnMarket('Closed')).toBeNull()
    expect(cmaBlockedBecauseOnMarket(null)).toBeNull()
    expect(cmaBlockedBecauseOnMarket('  ')).toBeNull()
  })
})

describe('buildCma looks before it builds', () => {
  const src = readFileSync(join(process.cwd(), 'lib/cma/build.ts'), 'utf8')
  const fn = src.slice(src.indexOf('export async function buildCma'))

  it('reads the listing and returns before a snapshot, a cover photo, or a comp search', () => {
    const gate = fn.indexOf('cmaBlockedBecauseOnMarket(')
    const snap = fn.indexOf('snapshotCmaVersion')
    const photo = fn.indexOf('pickCoverPhoto')
    const comps = fn.indexOf('selectCompsPreferringFacts')
    expect(gate).toBeGreaterThan(0)
    expect(snap).toBeGreaterThan(gate)
    expect(photo).toBeGreaterThan(snap)
    expect(comps).toBeGreaterThan(photo)
  })
})
