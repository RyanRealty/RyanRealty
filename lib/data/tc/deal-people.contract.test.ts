import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDealWithPeople, getPartyNamesByDealIds } from './deal-people'

const ROOT = resolve(__dirname, '../../..')

describe('tc_deal_people DAL contract', () => {
  it('getPartyNamesByDealIds is a no-op on empty ids (no live read)', async () => {
    const map = await getPartyNamesByDealIds([])
    expect(map.size).toBe(0)
  })

  it('createDealWithPeople refuses empty parties without a write', async () => {
    const r = await createDealWithPeople({
      address: '1 Main St, Bend',
      brokerName: null,
      parties: [],
      actor: 'contract-test',
    })
    expect(r.data).toBeNull()
    expect(r.error).toBe('Add at least one person.')
  })

  it('createDealWithPeople refuses a blank address without a write', async () => {
    const r = await createDealWithPeople({
      address: '   ',
      brokerName: null,
      parties: [{ personId: 1, role: 'buyer' }],
      actor: 'contract-test',
    })
    expect(r.data).toBeNull()
    expect(r.error).toBe('Address is required.')
  })

  it('migration unique-keys one person per deal; roles buyer|seller|other; no SkySlope', () => {
    const sql = readFileSync(
      resolve(ROOT, 'supabase/migrations/20260814010000_tc_deal_people.sql'),
      'utf8',
    )
    expect(sql).toMatch(/unique \(deal_id, person_id\)/)
    expect(sql).toMatch(/role in \('buyer', 'seller', 'other'\)/)
    expect(sql).toMatch(/enable row level security/)
    expect(sql).toMatch(/Does not write SkySlope/)
    expect(sql).not.toMatch(/skyslope_transactions|into\s+skyslope/i)
  })
})
