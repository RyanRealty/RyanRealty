import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync('app/about/page.tsx', 'utf8')
const REACH = readFileSync('app/about/_v3/AboutReach.tsx', 'utf8')
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
    expect(BODY).toContain('people={proof.faces}')
    expect(BODY).not.toContain('<AboutFaces')
    expect(BODY).not.toContain('size="proof"')
    expect(BODY).not.toContain('id="who"')
    expect(PAGE).not.toContain('whoItems')
  })

  it('groups the four Contact channels into one reach control with a live state', () => {
    expect(at('id="proof"')).toBeLessThan(at('id="reach"'))
    expect(PAGE).not.toContain('primary: true')
    expect(PAGE).not.toContain('live: hoursLive')
    expect(PAGE).toContain('<V3OnDuty')
    expect(PAGE).toContain('<AboutReach')
    expect(PAGE).not.toContain('<V3Doors')
    expect(REACH).toContain("from '@/components/ui/button-group'")
    expect(REACH).toContain('<ButtonGroup')
    expect(REACH).toContain('>Call<')
    expect(REACH).toContain('>Text<')
    expect(REACH).toContain('>Email<')
    expect(REACH).toContain('>Schedule<')
    expect(REACH).not.toContain('flex-1')
    expect(REACH).not.toContain('w-full')
    expect(REACH).toContain('tel:${CONTACT.phoneDirectTel}')
    expect(REACH).toContain('sms:${CONTACT.phoneDirectTel}')
    expect(REACH).toContain('mailto:${CONTACT.email.primary}')
    expect(REACH).toContain('href="/book"')
  })

  it('prints reviews as primary proof, then dated local closings', () => {
    expect(at('<AboutFirm')).toBeLessThan(at('id="proof"'))
    expect(at('id="proof"')).toBeLessThan(at('<FirmClosings'))
    expect(at('<FirmClosings')).toBeLessThan(at('id="reach"'))
    expect(at('id="reach"')).toBeLessThan(at('<AboutOffice'))
    expect(at('<AboutOffice')).toBeLessThan(at('<AboutInquiry'))
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

  /**
   * Matt 2026-09-23 (About-page AEO playbook): the playbook sections sit BELOW
   * the proof. Photos, reviews and closings stay on top; then what we do, what
   * makes us different, who we work with, where, how, the team, the key facts,
   * and the questions. "How it started" is now the first item of "The team
   * behind Ryan Realty", which keeps the origin and the licenses.
   */
  it('puts the playbook sections below the proof, in the playbook order', () => {
    const order = [
      '<AboutFirm',
      'id="proof"',
      '<FirmClosings',
      'id="reach"',
      '<AboutOffice',
      '<AboutInquiry',
      'id="services"',
      'id="different"',
      'id="clients"',
      'id="service-area"',
      'id="how-we-work"',
      'id="about"',
      'id="key-facts"',
      'id="faq"',
    ]
    for (let i = 1; i < order.length; i += 1) {
      expect(at(order[i - 1]!), `${order[i - 1]} before ${order[i]}`).toBeLessThan(at(order[i]!))
    }
    expect(BODY).toContain('heading="What Ryan Realty does"')
    expect(BODY).toContain('heading="What makes Ryan Realty different"')
    expect(BODY).toContain('heading="Who Ryan Realty works with"')
    expect(BODY).toContain('heading="How Ryan Realty works"')
    expect(BODY).toContain('heading="Key facts about Ryan Realty"')
    expect(BODY).toContain('heading="Frequently asked questions"')
  })

  it('keeps origin and licenses below the fold, not as a KPI hero', () => {
    expect(at('id="proof"')).toBeLessThan(at('id="service-area"'))
    expect(at('id="service-area"')).toBeLessThan(at('id="about"'))
    expect(at('id="about"')).toBeLessThan(at('id="faq"'))
    expect(BODY).toContain('heading="The team behind Ryan Realty"')
    expect(PAGE).toContain("term: 'How it started'")
    expect(PAGE).not.toContain('V3Instrument')
    expect(PAGE).toContain('licenseFigures')
    expect(PAGE).toContain('FIRM_LICENSE')
    expect(PAGE).toContain('Oregon Real Estate Agency')
  })
})
