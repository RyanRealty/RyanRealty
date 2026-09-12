import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync('app/about/page.tsx', 'utf8')
const BODY = PAGE.slice(PAGE.indexOf('return ('))

function at(marker: string): number {
  const i = BODY.indexOf(marker)
  expect(i, marker).toBeGreaterThan(-1)
  return i
}

describe('/about section order', () => {
  it('opens on the firm hero, never broker Cards or a contact-link stack', () => {
    expect(at('<AboutFirm')).toBeLessThan(at('id="reach"'))
    expect(at('<AboutFirm')).toBeLessThan(at('id="proof"'))
    expect(BODY).toContain('heading="About Ryan Realty · Bend"')
    expect(BODY).not.toContain('<AboutFaces')
    expect(BODY).not.toContain('size="proof"')
    expect(BODY).not.toContain('id="who"')
    expect(PAGE).not.toContain('whoItems')
  })

  it('groups the four Contact channels into one reach control with a live state', () => {
    expect(at('id="proof"')).toBeLessThan(at('id="reach"'))
    expect(PAGE).toContain('primary: true')
    expect(PAGE).toContain('live: hoursLive')
    expect(PAGE).toContain('<V3OnDuty')
    expect(PAGE).toContain('tel:${CONTACT.phoneDirectTel}')
    expect(PAGE).toContain('sms:${CONTACT.phoneDirectTel}')
    expect(PAGE).toContain('mailto:${CONTACT.email.primary}')
    expect(PAGE).toContain("href: '/book'")
    expect(PAGE).toContain("kicker: v3Text('Call')")
    expect(PAGE).toContain("kicker: v3Text('Text')")
    expect(PAGE).toContain("kicker: v3Text('Email')")
    expect(PAGE).toContain("kicker: v3Text('Schedule')")
  })

  it('prints reviews as primary proof, then dated local closings', () => {
    expect(at('<AboutFirm')).toBeLessThan(at('id="proof"'))
    expect(at('id="proof"')).toBeLessThan(at('<FirmClosings'))
    expect(at('<FirmClosings')).toBeLessThan(at('id="reach"'))
    expect(at('id="reach"')).toBeLessThan(at('<AboutTeamTeaser'))
    expect(at('<AboutTeamTeaser')).toBeLessThan(at('<AboutInquiry'))
    expect(BODY).toContain('headline="In their own words"')
    expect(BODY).not.toContain('headline={`${reviewCount} Google reviews`}')
  })

  it('does not open on a KPI grid or methodology chrome', () => {
    expect(PAGE).not.toContain('openingFigures')
    expect(PAGE).not.toContain('figures={openingFigures}')
    expect(PAGE).toContain("label: 'Average rating'")
    expect(PAGE).toContain("label: 'Google reviews'")
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
