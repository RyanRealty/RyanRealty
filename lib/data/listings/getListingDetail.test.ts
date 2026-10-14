import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { publishableYearBuilt } from './getListingDetail'

/**
 * A malformed listing key must be a MISS, never a thrown exception.
 *
 * WHY (2026-08-19). /listing/[listingKey] renders dynamically inside a
 * loading.tsx Suspense boundary, so React flushes the shell — and commits HTTP
 * 200 — before the page component resolves. Anything the page throws after that
 * point cannot change the status and is not written into the stream: the
 * visitor gets 200 with a blank body. Measured on ryan-realty.com,
 * /listing/<150 characters> returned HTTP 200 with 1,593 characters of text and
 * no <h1> — indistinguishable from the seller-opted-out listing that started
 * this fix.
 *
 * getListingDetail's contract is `ListingDetail | null`, and it throws ONLY for
 * a transient DB failure, which is the only error a retry can fix. An input
 * that can never be a listing key is a genuine miss, so it returns null and
 * lands on the same rendered refusal every other unresolvable key gets.
 *
 * This is a source assertion rather than a call, because the module's behaviour
 * here is decided before any Supabase client or Next cache is touched — an
 * import-time-free check that still fails if `safeParse` is swapped back to the
 * throwing `parse`.
 */
const SRC = readFileSync(resolve('lib/data/listings/getListingDetail.ts'), 'utf8')
// Comments in this module quote the old `InputSchema.parse(...)` call by name to
// explain why it went away, so the assertions below read CODE, not prose.
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('getListingDetail input handling', () => {
  it('treats a malformed key as a miss (safeParse -> null), never a throw', () => {
    expect(CODE).toMatch(/if \(!InputSchema\.safeParse\(\{ listingKey \}\)\.success\) return null/)
  })

  it('does not call the throwing InputSchema.parse', () => {
    expect(CODE).not.toMatch(/InputSchema\.parse\(/)
  })

  it('still bounds the key length, so the miss is a decision and not an accident', () => {
    expect(SRC).toMatch(/listingKey: z\.string\(\)\.min\(1\)\.max\(100\)/)
  })

  it('keeps throwing on a transient DB failure so an error-null is never cached', () => {
    expect(SRC).toMatch(/throw new Error\(\s*`listings detail lookup failed for/)
  })
})

// A YEAR THE FEED CANNOT MEAN IS NOT A YEAR (§0, 2026-09-11).
//
// 2448 NW Violet Ave (ListNumber 220223541) published "Built 3672" on the page
// AND "yearBuilt":3672 in its RealEstateListing JSON-LD, because the MLS row
// carries year_built = 3672 — the identical value as its TotalLivingAreaSqFt.
// Someone typed the square footage into the Year Built box. The old guard was
// `year_built > 1800`, which 3672 clears, so the same value also produced a
// propertyAge of -1646. A year needs a CEILING, not only a floor.
describe('publishableYearBuilt', () => {
  const thisYear = new Date().getFullYear()

  it('withholds a square footage typed into the year box', () => {
    expect(publishableYearBuilt(3672)).toBeNull()
  })

  it('withholds anything past next year, and keeps next year itself', () => {
    // New construction legitimately names next year; two years out is a typo.
    expect(publishableYearBuilt(thisYear + 1)).toBe(thisYear + 1)
    expect(publishableYearBuilt(thisYear + 2)).toBeNull()
  })

  it('keeps a real year, including a genuinely old one', () => {
    expect(publishableYearBuilt(1910)).toBe(1910)
    expect(publishableYearBuilt(thisYear)).toBe(thisYear)
    expect(publishableYearBuilt(1801)).toBe(1801)
  })

  it('withholds the floor cases and anything unreadable', () => {
    expect(publishableYearBuilt(1800)).toBeNull()
    expect(publishableYearBuilt(0)).toBeNull()
    expect(publishableYearBuilt(-1)).toBeNull()
    expect(publishableYearBuilt(null)).toBeNull()
    expect(publishableYearBuilt(undefined)).toBeNull()
    expect(publishableYearBuilt(Number.NaN)).toBeNull()
  })
})
