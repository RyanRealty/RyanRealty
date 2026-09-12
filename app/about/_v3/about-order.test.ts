import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync('app/about/page.tsx', 'utf8')
const BODY = PAGE.slice(PAGE.indexOf('return ('))

function at(marker: string): number {
  const i = BODY.indexOf(marker)
  expect(i, marker).toBeGreaterThan(-1)
  return i
}

/**
 * SITE-48 (2026-09-09) rewrote the first two cases here. They used to assert
 * the inverse — a V3Quiet #who ABOVE the faces — on the argument that the
 * faces were a poster eating the fold. The taste table of 2026-09-08 measured
 * what that produced: 31, with the verdict "the About page's first screen is
 * a phone book, not a proof point … the page's actual assets (broker faces,
 * firm sales, reviews, the service-area map) sit entirely below the fold".
 * The poster worry is still honoured — AboutFaces renders at conversation
 * scale here, not at 70vh, which the CSS case below still holds.
 */
describe('/about section order', () => {
  it('opens on the faces and the firm record, never on a stack of contact links', () => {
    expect(at('<AboutFaces')).toBeLessThan(at('id="reach"'))
    expect(at('<AboutFaces')).toBeLessThan(at('id="proof"'))
    expect(BODY).toContain('heading="About Ryan Realty · Bend"')
    expect(BODY).toContain('headingLevel={1}')
    // The H1 is on the faces section; the page has no #who list any more.
    expect(BODY).not.toContain('id="who"')
    expect(PAGE).not.toContain('whoItems')
  })

  it('groups the four channels into one reach control with a live state', () => {
    expect(at('id="reach"')).toBeLessThan(at('id="proof"'))
    expect(PAGE).toContain('primary: true')
    expect(PAGE).toContain('live: hoursLive')
    expect(PAGE).toContain('<V3OnDuty')
    expect(PAGE).toContain('tel:${CONTACT.phoneDirectTel}')
    expect(PAGE).toContain('sms:${CONTACT.phoneDirectTel}')
    expect(PAGE).toContain('mailto:${CONTACT.email.primary}')
    expect(PAGE).toContain("href: '/book'")
  })

  it('prints firm sales in the fold, then the reviews as words — the score is not the Proof headline', () => {
    expect(at('<FirmClosings')).toBeLessThan(at('id="proof"'))
    expect(at('<AboutFaces')).toBeLessThan(at('<FirmClosings'))
    expect(BODY).toContain('headline="In their own words"')
    expect(BODY).not.toContain('headline={`${reviewCount} Google reviews`}')
  })

  it('does not open on a KPI grid; the Google mark is a firm link, not methodology', () => {
    expect(PAGE).not.toContain('openingFigures')
    expect(PAGE).not.toContain('figures={openingFigures}')
    expect(PAGE).toContain('size="proof"')
    expect(PAGE).toContain('proof=')
    expect(PAGE).toContain("href: '/reviews'")
    expect(PAGE).not.toContain('openingTrace')
    expect(BODY).not.toContain('<V3SourceLine')
    expect(BODY).not.toContain('how we calculate this')
  })

  it('keeps portrait CSS at card-photo scale, never a 70vh poster', () => {
    const css = readFileSync('app/about/_v3/about-faces.css', 'utf8')
    expect(css).toContain('about-faces--portrait')
    expect(css).toMatch(/\.about-faces--portrait[\s\S]*--v3-card-photo-h/)
    expect(css).not.toMatch(/70vh|64vh/)
  })

  it('keeps origin and licenses below the fold, not as a KPI hero', () => {
    expect(at('id="proof"')).toBeLessThan(at('id="service-area"'))
    expect(at('id="service-area"')).toBeLessThan(at('id="about"'))
    expect(at('id="about"')).toBeLessThan(at('id="faq"'))
    expect(BODY).toContain('heading="How it started"')
    expect(PAGE).not.toContain('V3Instrument')
    expect(PAGE).toContain('licenseFigures')
    expect(PAGE).toContain('FIRM_LICENSE')
    expect(PAGE).toContain('Oregon Real Estate Agency')
  })
})
