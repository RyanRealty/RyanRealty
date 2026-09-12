import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync('app/about/page.tsx', 'utf8')
const BODY = PAGE.slice(PAGE.indexOf('return ('))

function at(marker: string): number {
  const i = BODY.indexOf(marker)
  expect(i, marker).toBeGreaterThan(-1)
  return i
}

describe('/about Looking section order', () => {
  it('never mounts AboutFaces or a broker-card roster', () => {
    expect(PAGE).not.toContain('<AboutFaces')
    expect(PAGE).not.toMatch(/from ['"].*AboutFaces['"]/)
    expect(PAGE).not.toContain('size="proof"')
    expect(BODY).not.toContain('about-faces__roster')
    expect(BODY).not.toContain('<Card')
    expect(BODY).not.toContain('about-faces__ask')
  })

  it('opens on the firm hero, then reviews as the primary proof', () => {
    expect(at('<AboutFirmHero')).toBeLessThan(at('id="proof"'))
    expect(at('id="proof"')).toBeLessThan(at('<FirmClosings'))
    expect(BODY).toContain('heading="About Ryan Realty · Bend"')
    expect(BODY).toContain('face')
    expect(BODY).not.toContain('id="who"')
    expect(PAGE).not.toContain('whoItems')
  })

  it('prints closings after reviews, then the four-up CTA', () => {
    expect(at('<FirmClosings')).toBeLessThan(at('id="reach"'))
    expect(at('id="reach"')).toBeLessThan(at('<AboutTeamTeaser'))
    expect(PAGE).toContain('primary: true')
    expect(PAGE).toContain('live: hoursLive')
    expect(PAGE).toContain('<V3OnDuty')
    expect(PAGE).toContain('tel:${CONTACT.phoneDirectTel}')
    expect(PAGE).toContain('sms:${CONTACT.phoneDirectTel}')
    expect(PAGE).toContain('mailto:${CONTACT.email.primary}')
    expect(PAGE).toContain("href: '/book'")
  })

  it('teases the team to /team, then inquiry to /contact', () => {
    expect(at('<AboutTeamTeaser')).toBeLessThan(at('id="inquiry"'))
    expect(at('id="inquiry"')).toBeLessThan(at('id="service-area"'))
    expect(PAGE).toContain("href: '/contact'")
    expect(PAGE).toContain('Send a question')
  })

  it('does not open on a KPI grid or methodology disclosure', () => {
    expect(PAGE).not.toContain('openingFigures')
    expect(PAGE).not.toContain('figures={openingFigures}')
    expect(PAGE).not.toContain('openingTrace')
    expect(BODY).not.toContain('<V3SourceLine')
    expect(BODY).not.toContain('how we calculate this')
  })

  it('keeps origin and licenses below the Looking stack, not as a KPI hero', () => {
    expect(at('id="inquiry"')).toBeLessThan(at('id="service-area"'))
    expect(at('id="service-area"')).toBeLessThan(at('id="about"'))
    expect(at('id="about"')).toBeLessThan(at('id="faq"'))
    expect(BODY).toContain('heading="How it started"')
    expect(PAGE).not.toContain('V3Instrument')
    expect(PAGE).toContain('licenseFigures')
    expect(PAGE).toContain('FIRM_LICENSE')
    expect(PAGE).toContain('Oregon Real Estate Agency')
  })
})
