import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PriceCtaStrip } from '@/components/site/listing-detail/PriceCtaStrip'

/**
 * Accessible-name locks for the listing-detail CTA row.
 *
 * The strip's Save and Share controls carry bare verbs as visible text. Before
 * 2026-07-29 the Save button shipped `aria-pressed` and NO `aria-label`, so its
 * accessible name was the literal string "Save" — a screen-reader visitor heard
 * an action with no object and no state, on the one page where the object is
 * the whole point. Dumping every `[aria-label]` on
 * /homes-for-sale/bend/kenwood-gardens/1265-saginaw-220226009 returned no
 * save/like entry at all.
 *
 * These tests render the real component (no DOM library in this repo, so
 * renderToStaticMarkup + attribute assertions, same as
 * components/market/core-charts.test.ts) and assert the accessible name states
 * the property and reflects saved vs not.
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

describe('listing-detail CTA row accessible names', () => {
  it('the save control is not left with the bare visible text as its whole name', () => {
    const label = ariaLabelOfButtonWithText(render(), 'Save')
    expect(label).not.toBeNull()
    expect(label).not.toBe('Save')
  })

  it('an unsaved listing names the property and the action', () => {
    const label = ariaLabelOfButtonWithText(render(), 'Save')
    expect(label).toBe('Save 1265 Saginaw Ave to your saved homes')
  })

  it('a saved listing reflects the saved state in the accessible name', () => {
    const label = ariaLabelOfButtonWithText(render({ initialSaved: true }), 'Saved')
    expect(label).toBe('Remove 1265 Saginaw Ave from your saved homes')
  })

  it('falls back to a generic object when the street address is unavailable', () => {
    const html = render({
      listing: {
        ...LISTING,
        streetNumber: null,
        streetName: null,
        streetSuffix: null,
      } as unknown as Parameters<typeof PriceCtaStrip>[0]['listing'],
    })
    expect(ariaLabelOfButtonWithText(html, 'Save')).toBe('Save this home to your saved homes')
  })

  it('the share control names the property too', () => {
    expect(ariaLabelOfButtonWithText(render(), 'Share')).toBe('Share 1265 Saginaw Ave')
  })

  it('aria-pressed still tracks the saved state', () => {
    expect(render()).toMatch(/aria-pressed="false"/)
    expect(render({ initialSaved: true })).toMatch(/aria-pressed="true"/)
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
    expect(html).toMatch(/7,900,000/)
  })

  it('prints an honest price-change line from history and never invents a drop', () => {
    const html = render({
      history: [
        { event: 'listed', event_date: '2026-08-22', price: 298000, price_change: null },
      ],
    })
    expect(html).toMatch(/Listed Aug 22 at \$298,000/)
    expect(html).not.toMatch(/Down /)
  })

  it('uses the street as the H1 and keeps one exact ask', () => {
    const html = render()
    expect(html).toMatch(/<h1[^>]*>1265 Saginaw Ave<\/h1>/)
    expect(html).toMatch(/\$895,000/)
    expect(html).not.toMatch(/\$895K/)
  })

  it('offers a clear path to the listing alert strip', () => {
    const html = render()
    expect(html).toMatch(/href="#listing-like-alerts"/)
    // Full-width outline btn (elevated from text link 2026-08-11).
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

describe('gallery and tour occupy history so Back stays on the listing', () => {
  const { readFileSync } = require('node:fs') as typeof import('node:fs')
  const { join } = require('node:path') as typeof import('node:path')
  const root = join(__dirname, '../../..')
  const gallery = readFileSync(
    join(root, 'components/site/listing-detail/PhotoGalleryLightbox.tsx'),
    'utf8',
  )
  const tour = readFileSync(
    join(root, 'components/site/listing-detail/ListingTourOverlay.tsx'),
    'utf8',
  )
  const hook = readFileSync(join(root, 'lib/listing/use-media-overlay-history.ts'), 'utf8')

  it('pushes a history entry instead of router.push', () => {
    expect(hook).toMatch(/history\.pushState/)
    expect(hook).toMatch(/listingMedia/)
    expect(hook).toMatch(/photo=/)
    expect(hook).not.toMatch(/useRouter/)
    expect(gallery).toMatch(/useMediaOverlayHistory\(/)
    expect(gallery).toMatch(/'gallery'/)
    expect(tour).toMatch(/useMediaOverlayHistory\(isOpen, onClose, 'tour'\)/)
  })

  it('labels the control Back at 44px', () => {
    expect(gallery).toMatch(/aria-label="Back"/)
    expect(gallery).toMatch(/aria-label="Close"/)
    expect(gallery).toMatch(/min-h-11/)
    expect(tour).toMatch(/aria-label="Back"/)
    expect(tour).toMatch(/min-h-11/)
    expect(gallery).not.toMatch(/Close gallery/)
  })
})
