import { describe, expect, it } from 'vitest'
import { composeCmaFirstContact } from '@/lib/cma/first-contact'
import {
  cleanFirstPartyHref,
  cmaLetterLinkId,
  renderCmaLetterBlock,
  stampCmaEmailCampaign,
  type FirstContactRun,
} from '@/lib/cma/first-contact-render'
import { cmaReportButtonHtml } from '@/lib/cma/report-button'
import type { FirstContactPlace } from '@/lib/cma/first-contact-place'

const PLACE: FirstContactPlace = {
  subdivision: {
    label: 'Diamond Bar Ranch',
    href: 'https://ryan-realty.com/subdivisions/diamond-bar-ranch',
    closed12mo: 6,
    active: 2,
    unsold12mo: 3,
    pending: null,
    history: null,
  },
  wider: { label: 'Bend', href: 'https://ryan-realty.com/cities/bend' },
}

describe('cmaLetterLinkId', () => {
  it('maps each CMA letter href to its stable id', () => {
    expect(cmaLetterLinkId('https://ryan-realty.com/cma/cma-zz-postland-20260928')).toBe('report_text')
    expect(cmaLetterLinkId('https://ryan-realty.com/sell')).toBe('sell')
    expect(cmaLetterLinkId('https://ryan-realty.com/sell?from=cma')).toBe('sell')
    expect(cmaLetterLinkId('https://ryan-realty.com/reviews')).toBe('reviews')
    expect(cmaLetterLinkId('https://ryan-realty.com/about')).toBe('about')
    expect(cmaLetterLinkId('https://ryan-realty.com/subdivisions/diamond-bar-ranch')).toBe('subdivision')
    expect(cmaLetterLinkId('https://ryan-realty.com/cities/bend')).toBe('city')
  })

  it('ignores query tags and unknown paths', () => {
    expect(cmaLetterLinkId('https://ryan-realty.com/sell?utm_source=cma')).toBe('sell')
    expect(cmaLetterLinkId('https://ryan-realty.com/sell?from=cma&utm_source=cma')).toBe('sell')
    expect(cmaLetterLinkId('https://ryan-realty.com/book')).toBeNull()
  })

  it('cleanFirstPartyHref keeps from=cma and drops UTMs', () => {
    expect(cleanFirstPartyHref('https://ryan-realty.com/sell?from=cma')).toBe(
      'https://ryan-realty.com/sell?from=cma',
    )
    expect(cleanFirstPartyHref('https://ryan-realty.com/sell?from=cma&utm_source=cma&utm_campaign=x')).toBe(
      'https://ryan-realty.com/sell?from=cma',
    )
    expect(cleanFirstPartyHref('https://ryan-realty.com/reviews?utm_source=cma')).toBe(
      'https://ryan-realty.com/reviews',
    )
  })

  it('stampCmaEmailCampaign keeps from=cma exactly once', () => {
    const stamped = stampCmaEmailCampaign('https://ryan-realty.com/sell?from=cma', 'cma-zz-postland-20260928')
    const u = new URL(stamped)
    expect(u.pathname).toBe('/sell')
    expect(u.searchParams.getAll('from')).toEqual(['cma'])
    expect(u.searchParams.getAll('utm_source')).toEqual(['cma'])
    expect(u.searchParams.getAll('utm_campaign')).toEqual(['cma-zz-postland-20260928'])
  })
})

describe('rendered CMA letter anchors carry link ids; visible words do not change', () => {
  const copy = composeCmaFirstContact('expired', {
    address: '1 Postland, Bend, OR 97701',
    firstName: null,
    valueLow: 400000,
    valueHigh: 420000,
    recommendedList: 410000,
    lastListPrice: 450000,
    brokerName: 'Matt Ryan',
    brokerSlug: 'matt',
    city: 'Bend',
    subdivision: 'Diamond Bar Ranch',
    closedSalesCount: 4,
    salesScope: 'subdivision',
    cmaSlug: 'cma-zz-postland-20260928',
    place: PLACE,
  })

  it('stamps every letter anchor and the report button', () => {
    const html = renderCmaLetterBlock({
      paragraphs: copy.paragraphs,
      address: '1 Postland, Bend, OR 97701',
      slug: 'cma-zz-postland-20260928',
    })
    const ids = [...html.matchAll(/data-rr-link="([^"]+)"/g)].map((m) => m[1])
    expect(ids).toEqual([
      'report_text',
      'sell',
      'reviews',
      'about',
      'subdivision',
      'city',
      'report_button',
    ])
    expect(html).toContain('read it online')
    expect(html).toContain('see how we sell homes')
    expect(html).toContain('read our reviews')
    expect(html).toContain('learn about our business')
    expect(html).toContain('Diamond Bar Ranch page')
    expect(html).toContain('Bend page')
    expect(html).toContain('READ THE FULL REPORT')
    expect(html).not.toMatch(/data-rr-link="[^"]+">[^<]*data-rr-link/)
    expect(html).toMatch(/href="https:\/\/ryan-realty\.com\/sell\?from=cma[&"]/)
    expect(html).not.toMatch(/href="https:\/\/ryan-realty\.com\/reviews\?from=/)
    expect(html).not.toMatch(/href="https:\/\/ryan-realty\.com\/about\?from=/)
  })

  it('the report button is always report_button', () => {
    expect(cmaReportButtonHtml('https://ryan-realty.com/cma/x')).toContain('data-rr-link="report_button"')
  })

  it('a structured run still prints the same visible words', () => {
    const runs: FirstContactRun[][] = copy.paragraphs
    const texts = runs.flat().flatMap((r) => (typeof r === 'string' ? [] : [r.text]))
    expect(texts).toEqual([
      'read it online',
      'see how we sell homes',
      'read our reviews',
      'learn about our business',
      'Diamond Bar Ranch page',
      'Bend page',
    ])
  })
})
