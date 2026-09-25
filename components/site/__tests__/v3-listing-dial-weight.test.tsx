/**
 * The dial's served-HTML weight per listing (the city/community rollout,
 * 2026-09-24): /cities/bend went 1,773,523 -> 2,671,290 raw bytes when its
 * homes became dials, at 2,108 B of HTML per listing against the carousel's
 * 855 B. The budget is about 1 KB per listing, without losing what the dial
 * guarantees: every listing is still an <a href> with its ask and its street
 * in the served HTML, and a thumbnail (a tab) per listing.
 *
 * Measured as the marginal cost of one more listing: (bytes at N+40 - bytes
 * at N) / 40, so the dial's fixed chrome (head, readout, steps, sprite) is
 * not charged to the listings.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3ListingDial } from '@/components/site/v3/V3ListingDial.client'
import type { V3ListingRowData } from '@/components/site/v3/V3ListingRow'

/** The budget per listing, in bytes of server HTML (UTF-8). */
const BYTES_PER_LISTING = 1024

function row(i: number): V3ListingRowData {
  const n = 61000 + i * 7
  return {
    listingKey: `2026091${String(100000000000000 + i)}`,
    href: `/homes-for-sale/bend/tetherow/${n}-nw-tetherow-crossing-2202${String(10000 + i)}`,
    photoUrl: `https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260911${String(100000 + i)}-o.jpg`,
    price: 1_250_000 + i * 12_500,
    addressLine: `${n} NW Tetherow Crossing`,
    cityLine: 'Bend, OR 97702 · Tetherow',
    beds: 4,
    baths: 3,
    sqft: 3120,
    pricePerSqft: 401,
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    subdivisionName: 'Tetherow',
    city: 'Bend',
    listNumber: `2202${String(10000 + i)}`,
    tourUrl: null,
    hasTour: false,
    badges: i % 3 === 0 ? [{ kind: 'new', label: 'New' }] : [],
    statusLabel: null,
  }
}

function bytes(count: number): number {
  const listings = Array.from({ length: count }, (_, i) => row(i))
  const html = renderToStaticMarkup(
    <V3ListingDial id="homes-sfr" heading="Single-family homes" countLabel={`${count} for sale`} label="Single-family homes in Tetherow" listings={listings} />,
  )
  return Buffer.byteLength(html, 'utf8')
}

describe('V3ListingDial served-HTML weight', () => {
  it(`costs no more than ${BYTES_PER_LISTING} B of HTML per listing`, () => {
    const perListing = (bytes(44) - bytes(4)) / 40
    console.info(`[dial weight] ${perListing.toFixed(0)} B of server HTML per listing`)
    expect(perListing).toBeLessThanOrEqual(BYTES_PER_LISTING)
  })

  it('still serves every listing as an <a href> carrying its ask and its street', () => {
    const listings = Array.from({ length: 12 }, (_, i) => row(i))
    const html = renderToStaticMarkup(<V3ListingDial id="d" label="x" listings={listings} />)
    for (const listing of listings) {
      const links = [...html.matchAll(new RegExp(`<a[^>]*href="${listing.href}"[^>]*>([\\s\\S]*?)</a>`, 'g'))]
      const door = links.find(
        (m) => m[1]!.includes(listing.addressLine) && m[1]!.includes(`$${listing.price!.toLocaleString('en-US')}`),
      )
      expect(door, listing.href).toBeDefined()
    }
    // And one thumbnail (a tab) per listing.
    expect(html.match(/role="tab"/g)).toHaveLength(listings.length)
  })
})
