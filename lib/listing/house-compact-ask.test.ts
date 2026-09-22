import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatAtlasPinPrice } from '@/lib/atlas/pin-price'
import { formatPublishedSaleAskCompact } from '@/lib/listing/publish-listing-ask'

const ROOT = process.cwd()

function src(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

describe('house compact ask — one publisher', () => {
  it('prints the same Active ask on the chip and the card', () => {
    const asks = [318_000, 650_000, 749_000, 795_000, 957_400, 1_200_000, 1_495_000]
    for (const ask of asks) {
      expect(formatPublishedSaleAskCompact({ price: ask, propertyType: 'A' })).toBe(
        formatAtlasPinPrice(ask),
      )
    }
  })

  it('locks k/M and $ rules', () => {
    expect(formatAtlasPinPrice(795_000)).toBe('$795k')
    expect(formatAtlasPinPrice(650_000)).toBe('$650k')
    expect(formatAtlasPinPrice(1_200_000)).toBe('$1.2M')
    expect(formatAtlasPinPrice(1_000_000)).toBe('$1M')
    expect(formatAtlasPinPrice(795_000)).toMatch(/^\$\d+k$/)
    expect(formatAtlasPinPrice(1_200_000)).toMatch(/^\$\d+(\.\d)?M$/)
  })

  it('wires maps and cards to that publisher', () => {
    expect(src('components/SearchMapClustered.tsx')).toMatch(/formatAtlasPinPrice/)
    expect(src('components/site/v3/V3Atlas.client.tsx')).toMatch(/formatAtlasPinPrice/)
    expect(src('lib/maps/markers.ts')).toMatch(/formatAtlasPinPrice/)
    expect(src('lib/listing/publish-listing-ask.ts')).toMatch(/formatAtlasPinPrice/)
    expect(src('lib/place/first-look.ts')).toMatch(/formatPublishedSaleAskCompact/)
    expect(src('lib/data/listings/getPlaceOpeningListings.ts')).toMatch(
      /formatPublishedSaleAskCompact/,
    )
    expect(src('app/zip/[zip]/_v3/zip-constants.ts')).toMatch(/formatPublishedSaleAskCompact/)
    expect(src('lib/place/first-look.ts')).not.toMatch(/formatPriceCompact/)
    expect(src('lib/data/listings/getPlaceOpeningListings.ts')).not.toMatch(/formatPriceCompact/)
  })
})
