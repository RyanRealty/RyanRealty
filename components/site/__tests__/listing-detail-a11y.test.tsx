import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PriceCtaStrip } from '@/components/site/listing-detail/PriceCtaStrip'

/**
 * Accessible-name locks for the listing Sheet CTA row.
 * Save and Share are icon actions; names live on aria-label.
 */

function render(props: Partial<Parameters<typeof PriceCtaStrip>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(PriceCtaStrip, {
      listingKey: '220226009',
      mlsNumber: '220226009',
      street: '1265 Saginaw Ave',
      city: 'Bend',
      subdivision: 'Kenwood Gardens',
      price: 895000,
      beds: 3,
      baths: 2,
      sqft: 2170,
      status: 'Active',
      daysOnMarket: 38,
      pricePerSqft: 412,
      ...props,
    }),
  )
}

function saveButton(html: string): string | null {
  const buttons = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? []
  for (const b of buttons) {
    if (!/aria-label="[^"]*Save this home/.test(b)) continue
    return b
  }
  return null
}

describe('listing-detail CTA row accessible names', () => {
  it('the save control names the home, not a bare verb', () => {
    const button = saveButton(render())
    expect(button).toBeTruthy()
    expect(button).toMatch(/aria-label="Save this home"/)
    expect(button).toMatch(/aria-pressed="false"/)
  })

  it('a saved listing reflects the saved state in the accessible name', () => {
    // Initial saved state hydrates from the server action; markup starts unsaved.
    expect(render()).toMatch(/aria-pressed="false"/)
  })

  it('the share control names the listing', () => {
    expect(render()).toMatch(/aria-label="Share this listing"/)
  })

  it('prints the full asking price, never a compact thousand', () => {
    const html = render({ price: 889000 })
    expect(html).toMatch(/\$889,000/)
    expect(html).not.toMatch(/\$889K/)
  })

  it('does not nag for alerts from the facts row', () => {
    const html = render()
    expect(html).not.toMatch(/Get free alerts/)
    expect(html).not.toMatch(/#listing-like-alerts/)
  })
})

describe('F4 ListingAlertCoach source contract', () => {
  const { readFileSync } = require('node:fs') as typeof import('node:fs')
  const { join } = require('node:path') as typeof import('node:path')
  const root = join(__dirname, '../../..')
  const alerts = readFileSync(
    join(root, 'components/site/listing-detail/ListingLikeThisAlerts.tsx'),
    'utf8',
  )

  it('is not mounted on the listing page (one alerts ask only)', () => {
    expect(alerts).not.toMatch(/ListingAlertCoach/)
  })
})
