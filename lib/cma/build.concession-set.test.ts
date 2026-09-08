/**
 * The concession sentence counts the set the document prints (CLAUDE.md §0
 * rule 5).
 *
 * The 2026-09-07 look pass on cma-2465-7th-redmond-97756 printed "4 of 8 sales
 * that set this price reported a concession, median $7,500 when given" on a
 * page whose matrix — headed "The sales that set this price" — held 5 sales.
 * The denominator came from `selection.pricingSales`, the wider band set the
 * price path is fitted on, not from the kept comps the reader can count.
 *
 * The kept set wins: the sentence sits under the matrix, and its subject is
 * "the sales that set this price".
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { attachSellerNet, summarizeConcessions } from '@/lib/pricing/seller-net'

const src = readFileSync(join(process.cwd(), 'lib/cma/build.ts'), 'utf8')

/** Five kept comps: two reported a credit, three closed with none. */
const KEPT = [
  { concessionsAmount: 5_000, concessionsYn: 'Yes', closeDate: '2026-04-15' },
  { concessionsAmount: 10_000, concessionsYn: 'Yes', closeDate: '2026-03-02' },
  { concessionsAmount: 0, concessionsYn: 'No', closeDate: '2026-02-11' },
  { concessionsAmount: 0, concessionsYn: 'No', closeDate: '2026-01-20' },
  { concessionsAmount: 0, concessionsYn: 'No', closeDate: '2025-11-30' },
]

/** The wider band set the pricing path is fitted on — three more sales. */
const BAND = [
  ...KEPT,
  { concessionsAmount: 7_500, concessionsYn: 'Yes', closeDate: '2025-10-04' },
  { concessionsAmount: 9_000, concessionsYn: 'Yes', closeDate: '2025-09-12' },
  { concessionsAmount: 0, concessionsYn: 'No', closeDate: '2025-08-08' },
]

function pricing(): NonNullable<Parameters<typeof attachSellerNet>[0]> {
  return { recommended: 465_000, notes: [] as string[] }
}

describe('seller-net concession set', () => {
  it('the two sets really do print different sentences', () => {
    expect(summarizeConcessions(KEPT).knownCount).toBe(5)
    expect(summarizeConcessions(BAND).knownCount).toBe(8)
    expect(summarizeConcessions(BAND).givenCount).toBe(4)
    expect(summarizeConcessions(BAND).medianWhenGiven).toBe(8_250)
  })

  it('attaching from the kept set makes the denominator the matrix row count', () => {
    const p = pricing()
    attachSellerNet(p, KEPT)
    expect(p.sellerNet?.knownCount).toBe(KEPT.length)
    expect(p.sellerNet?.givenCount).toBe(2)
    expect(p.sellerNet?.medianWhenGiven).toBe(7_500)
    // The denominator now rides on the concession LINE's own source, which the
    // itemisation prints beside the dollar figure (round four, class A).
    expect(p.sellerNet?.lines[0]?.source).toContain('5 comparable sales that reported the field')
    expect(p.sellerNet?.lines[0]?.source).toContain('2 of them gave one')
  })

  it('the build attaches seller net from the priced (kept) comps, not the band set', () => {
    const call = src.match(/attachSellerNet\([^)]*\)/)
    expect(call, 'build.ts must call attachSellerNet').toBeTruthy()
    expect(call![0]).not.toMatch(/pricingSales/)
    // `set` is the argument priceSet() prices and the matrix renders. There is
    // no third argument any more: the close-price anchor it used to take is
    // round four's class A (lib/pricing/seller-net.ts).
    expect(call![0]).toMatch(/attachSellerNet\(\s*p,\s*set\s*\)/)
  })
})
