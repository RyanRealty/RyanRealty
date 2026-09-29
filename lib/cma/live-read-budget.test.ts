/**
 * The market and like-home reads are shared with print / PDF. A budget is
 * opt-in from the admin document serve. The default must wait, or a slow
 * database read silently drops those lines from a generated letter.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const getCmaCityClosedDuring = vi.fn(async () => [] as unknown[])
const getLikeHomeSales = vi.fn(async () => [] as unknown[])

vi.mock('server-only', () => ({}))

vi.mock('@/lib/data/cma/builderReads', () => ({
  getCmaCityClosedDuring: () => getCmaCityClosedDuring(),
  getLikeHomeSales: () => getLikeHomeSales(),
}))

import { listingMarketForDocument } from '@/lib/cma/listing-window-load'
import { likeHomeCreditsForDocument } from '@/lib/cma/like-home-credits-load'

const marketDoc = {
  subject: { city: 'Bend', subdivision: 'Northwest Crossing', sqft: 1800, latitude: 44.06, longitude: -121.3 },
  expiredAudit: { finalCycle: { listDate: '2025-01-15', offMarketDate: '2025-06-01' } },
}

const creditDoc = {
  generatedAtIso: '2025-06-02T00:00:00.000Z',
  subject: {
    city: 'Bend',
    subdivision: 'Northwest Crossing',
    yearBuilt: 2004,
    sqft: 1800,
    streetAddress: '3711 Purcell',
  },
  comps: [{ address: '3700 Purcell' }],
}

afterEach(() => {
  vi.useRealTimers()
  getCmaCityClosedDuring.mockReset()
  getLikeHomeSales.mockReset()
  getCmaCityClosedDuring.mockResolvedValue([])
  getLikeHomeSales.mockResolvedValue([])
})

describe('live market reads stay unbounded unless a budget is passed', () => {
  it('does not time out the print / PDF call (no budget)', async () => {
    vi.useFakeTimers()
    getCmaCityClosedDuring.mockImplementation(() => new Promise(() => {}))
    getLikeHomeSales.mockImplementation(() => new Promise(() => {}))
    let marketSettled = false
    let creditsSettled = false
    void listingMarketForDocument(marketDoc, 'draft').then(() => {
      marketSettled = true
    })
    void likeHomeCreditsForDocument(creditDoc, 'needs_review').then(() => {
      creditsSettled = true
    })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(marketSettled).toBe(false)
    expect(creditsSettled).toBe(false)

    const print = readFileSync(resolve('lib/cma/print-html.ts'), 'utf8')
    const pdf = readFileSync(resolve('lib/cma-pdf.ts'), 'utf8')
    expect(print).toContain('listingMarketForDocument(stored, source.status)')
    expect(print).toContain('likeHomeCreditsForDocument(stored, source.status)')
    expect(print).not.toContain('CMA_READ_MS')
    expect(pdf).toContain('resolveCmaPrintHtml')
    expect(pdf).not.toContain('listingMarketForDocument')
    expect(pdf).not.toContain('likeHomeCreditsForDocument')
    expect(pdf).not.toContain('readBudgetMs')
  })

  it('times out only when the serve path passes a budget', async () => {
    vi.useFakeTimers()
    getCmaCityClosedDuring.mockImplementation(() => new Promise(() => {}))
    getLikeHomeSales.mockImplementation(() => new Promise(() => {}))
    const market = listingMarketForDocument(marketDoc, 'draft', 4_000)
    const credits = likeHomeCreditsForDocument(creditDoc, 'draft', 4_000)
    await vi.advanceTimersByTimeAsync(4_000)
    await expect(market).resolves.toBeNull()
    await expect(credits).resolves.toBeNull()
  })
})
