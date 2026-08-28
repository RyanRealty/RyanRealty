import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PriceCtaStrip } from '@/components/site/listing-detail/PriceCtaStrip'

/**
 * Listing facts strip after the Stage. Tour, ask, and save live in the one
 * Sheet. This strip keeps address, status, share, and alerts — and must not
 * reprint the Stage ask.
 */

const LISTING = {
  listingKey: '220226009',
  listPrice: 895000,
  closePrice: null,
  closeDate: null,
  status: 'Active',
  dom: 38,
  pricePerSqft: 412,
  streetNumber: '1265',
  streetName: 'Saginaw',
  streetSuffix: 'Ave',
  city: 'Bend',
  postalCode: '97702',
  subdivisionName: 'Kenwood Gardens',
  originalListPrice: 895000,
  priceDropCount: null,
} as const

function render(props: Partial<Parameters<typeof PriceCtaStrip>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(PriceCtaStrip, {
      listing: LISTING as unknown as Parameters<typeof PriceCtaStrip>[0]['listing'],
      ...props,
    }),
  )
}

/** Accessible name of the button whose visible text is `text`. */
function ariaLabelOfButtonWithText(html: string, text: string): string | null {
  const buttons = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? []
  for (const b of buttons) {
    const inner = b.replace(/<[^>]*>/g, '').trim()
    if (inner !== text) continue
    const m = b.match(/aria-label="([^"]*)"/)
    return m ? m[1] : null
  }
  return null
}

describe('listing-detail facts strip', () => {
  it('does not reprint a second ask or a tour stack', () => {
    const html = render()
    expect(html).not.toMatch(/\$895,000/)
    expect(html).not.toMatch(/Schedule a tour/)
    expect(html).not.toMatch(/Ask a question/)
    expect(html).not.toMatch(/\/contact\?/)
    expect(html).not.toMatch(/>Save</)
  })

  it('the share control names the property', () => {
    expect(ariaLabelOfButtonWithText(render(), 'Share')).toBe('Share 1265 Saginaw Ave')
  })

  it('Mariposa: withholds a $9.8M original that listing history does not carry', () => {
    const html = render({
      listing: {
        ...LISTING,
        listPrice: 7_900_000,
        originalListPrice: 9_800_000,
        streetNumber: '65930',
        streetName: 'Mariposa',
        streetSuffix: 'Lane',
      } as unknown as Parameters<typeof PriceCtaStrip>[0]['listing'],
      historyPrices: [7_900_000],
    })
    expect(html).not.toMatch(/9,800,000/)
    expect(html).not.toMatch(/1,900,000/)
    expect(html).not.toMatch(/7,900,000/)
  })

  it('offers a clear path to the listing alert strip', () => {
    const html = render()
    expect(html).toMatch(/href="#listing-like-alerts"/)
    expect(html).toMatch(/Get free alerts for homes like this/)
  })
})

describe('F4 ListingAlertCoach source contract', () => {
  const { readFileSync } = require('node:fs') as typeof import('node:fs')
  const { join } = require('node:path') as typeof import('node:path')
  const root = join(__dirname, '../../..')
  const coach = readFileSync(
    join(root, 'components/site/listing-detail/ListingAlertCoach.client.tsx'),
    'utf8',
  )
  const alerts = readFileSync(
    join(root, 'components/site/listing-detail/ListingLikeThisAlerts.tsx'),
    'utf8',
  )

  it('is a soft coach: dwell timer + dismiss + anchor, no auto-form', () => {
    expect(coach).toMatch(/DWELL_MS\s*=\s*5000/)
    expect(coach).toMatch(/#listing-like-alerts/)
    expect(coach).toMatch(/Not now/)
    expect(coach).toMatch(/sessionStorage/)
    expect(coach).not.toMatch(/submitSearchAlertSignup/)
  })

  it('is mounted from ListingLikeThisAlerts (keeps listing page under LOC budget)', () => {
    expect(alerts).toMatch(/ListingAlertCoach/)
  })
})
