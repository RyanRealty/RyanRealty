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
})
