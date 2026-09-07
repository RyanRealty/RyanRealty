import { describe, expect, it } from 'vitest'
import { linkifyHttp } from './send'

/**
 * Regression lock for the two dead links every cold-origin CMA email carried.
 *
 * The first-contact copy ends sentences with a bare URL ("Reviews are at
 * https://ryan-realty.com/reviews."). The greedy linkifier folded the full stop
 * into the href, and the recipient's click landed on /reviews. — a 404. Found
 * 2026-09-07 by decoding the signed click tokens in a delivered message.
 */
describe('linkifyHttp — a URL that ends a sentence keeps the sentence intact', () => {
  it('leaves a trailing full stop outside the anchor', () => {
    expect(linkifyHttp('Reviews are at https://ryan-realty.com/reviews.')).toBe(
      'Reviews are at <a href="https://ryan-realty.com/reviews">https://ryan-realty.com/reviews</a>.',
    )
  })

  it('does the same for a query-carrying URL', () => {
    const out = linkifyHttp('See https://ryan-realty.com/subdivisions/deschutes?utm_campaign=cma-letter.')
    expect(out).toContain('href="https://ryan-realty.com/subdivisions/deschutes?utm_campaign=cma-letter"')
    expect(out.endsWith('</a>.')).toBe(true)
  })

  it('handles every sentence-ending mark, and a comma in a list', () => {
    for (const mark of ['.', ',', ';', ':', '!', '?']) {
      const out = linkifyHttp(`Go to https://ryan-realty.com/about${mark}`)
      expect(out).toBe(
        `Go to <a href="https://ryan-realty.com/about">https://ryan-realty.com/about</a>${mark}`,
      )
    }
  })

  it('does not strip anything from a URL that ends cleanly', () => {
    expect(linkifyHttp('https://ryan-realty.com/cma/cma-828-florida')).toBe(
      '<a href="https://ryan-realty.com/cma/cma-828-florida">https://ryan-realty.com/cma/cma-828-florida</a>',
    )
  })
})
