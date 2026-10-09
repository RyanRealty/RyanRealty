import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { PriceCtaStrip } from './PriceCtaStrip'

const LISTING = {
  listingKey: '220221970',
  listNumber: '220221970',
  listPrice: 895000,
  closePrice: null,
  closeDate: null,
  status: 'Active',
  streetNumber: '63083',
  streetName: 'Crusher',
  streetSuffix: null,
  city: 'Bend',
  postalCode: '97701',
} as const

function render(props: Partial<Parameters<typeof PriceCtaStrip>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(PriceCtaStrip, {
      listing: LISTING as unknown as Parameters<typeof PriceCtaStrip>[0]['listing'],
      showAlerts: false,
      bookHref: '/book?agent=matt&listing=220221970',
      ...props,
    }),
  )
}

describe('listing fold actions (mobile, near the price)', () => {
  it('puts Talk to a broker, Watch this price, and Walk through it next to the price', () => {
    const html = render()
    expect(html).toContain('Talk to a broker')
    expect(html).toContain('Watch this price')
    expect(html).toContain('Walk through it')
    expect(html).toContain('id="listing-fold-actions"')
    expect(html).toContain('listing-face--has-fold')
  })

  it('reuses the existing contact and book hrefs', () => {
    const html = render()
    expect(html).toMatch(/href="\/contact\?listingKey=220221970&amp;intent=question"/)
    expect(html).toContain('href="/book?agent=matt&amp;listing=220221970"')
    expect(html).toContain('href="#close"')
  })

  it('keeps desktop Tour in the markup and does not mount a sticky bar', () => {
    const html = render()
    expect(html).toMatch(/Tour/)
    expect(html).not.toMatch(/ListingBrokerBar/)
    expect(html).not.toMatch(/ListingMobileContactBar/)
    const css = readFileSync(resolve('components/site/listing-detail/listing-detail.css'), 'utf8')
    const foldStart = css.indexOf('.listing-face__fold {')
    const foldCss = css.slice(foldStart, css.indexOf('.listing-who--flow', foldStart))
    expect(foldCss).toContain('.listing-face__fold')
    expect(foldCss).not.toMatch(/position:\s*fixed/)
    expect(foldCss).not.toMatch(/position:\s*sticky/)
  })

  it('does not show the three live-listing asks on an off-market home', () => {
    const html = render({
      listing: {
        ...LISTING,
        status: 'Closed',
        closePrice: 850000,
      } as unknown as Parameters<typeof PriceCtaStrip>[0]['listing'],
    })
    expect(html).not.toContain('id="listing-fold-actions"')
    expect(html).not.toContain('Watch this price')
    expect(html).not.toContain('Walk through it')
  })

  it('the watch sheet posts through submitListingPriceDropWatch', () => {
    const src = readFileSync(resolve('components/site/listing-detail/ListingFoldActions.tsx'), 'utf8')
    expect(src).toContain("from '@/app/actions/search-alert-capture'")
    expect(src).toContain('submitListingPriceDropWatch')
    expect(src).toContain("name=\"company\"")
    expect(src).not.toMatch(/position:\s*fixed/)
  })
})
