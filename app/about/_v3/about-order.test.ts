import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync('app/about/page.tsx', 'utf8')
const BODY = PAGE.slice(PAGE.indexOf('return ('))

function at(marker: string): number {
  const i = BODY.indexOf(marker)
  expect(i, marker).toBeGreaterThan(-1)
  return i
}

describe('/about section order (PAGE_INVENTORY §6)', () => {
  it('opens on who we are plus Call/Text, not the faces poster', () => {
    expect(at('id="who"')).toBeLessThan(at('<AboutFaces'))
    expect(BODY).toContain('heading="About Ryan Realty · Bend"')
    expect(BODY).toContain('headingLevel={1}')
    expect(PAGE).toContain('Call ${CONTACT.phoneDirect}')
    expect(PAGE).toContain('Text ${CONTACT.phoneDirect}')
    expect(PAGE).toContain('tel:${CONTACT.phoneDirectTel}')
    expect(PAGE).toContain('sms:${CONTACT.phoneDirectTel}')
  })

  it('prints firm proof, then firm sales, then brokers as doors', () => {
    expect(at('id="proof"')).toBeLessThan(at('<FirmClosings'))
    expect(at('<FirmClosings')).toBeLessThan(at('<AboutFaces'))
    expect(BODY).toContain('heading="The brokers"')
    expect(BODY).toContain('headingLevel={2}')
  })

  it('keeps portrait CSS at card-photo scale, never a 70vh poster', () => {
    const css = readFileSync('app/about/_v3/about-faces.css', 'utf8')
    expect(css).toContain('about-faces--portrait')
    expect(css).toMatch(/\.about-faces--portrait[\s\S]*--v3-card-photo-h/)
    expect(css).not.toMatch(/70vh|64vh/)
  })

  it('keeps origin and licenses below the fold, not as a KPI hero', () => {
    expect(at('<AboutFaces')).toBeLessThan(at('id="service-area"'))
    expect(at('id="service-area"')).toBeLessThan(at('id="about"'))
    expect(at('id="about"')).toBeLessThan(at('id="faq"'))
    expect(BODY).toContain('heading="How it started"')
    expect(PAGE).not.toContain('V3Instrument')
    expect(PAGE).toContain('licenseFigures')
    expect(PAGE).toContain('FIRM_LICENSE')
    expect(PAGE).toContain('Oregon Real Estate Agency')
  })
})
