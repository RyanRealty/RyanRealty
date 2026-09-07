import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync('app/reviews/page.tsx', 'utf8')

describe('reviews page composition', () => {
  it('opens on V3Proof with archive, not a 25-card list as the design', () => {
    expect(PAGE).toContain('<V3Proof')
    expect(PAGE).toMatch(/archive/)
    expect(PAGE).not.toContain('V3Ledger')
    expect(PAGE).toContain('<V3Doors')
  })

  it('gives the proof headline headingLevel 1 and keeps V3Doors as the close', () => {
    expect(PAGE).toContain('headline={heading}')
    expect(PAGE).toContain('headingLevel={1}')
    expect(PAGE).toContain('id="next"')
  })

  it('puts Call/Text/Email/Schedule Quiet above V3Proof for above-fold reach at 375', () => {
    const reachIdx = PAGE.indexOf('id="reach"')
    const proofIdx = PAGE.indexOf('<V3Proof')
    const doorsIdx = PAGE.indexOf('id="next"')
    expect(reachIdx).toBeGreaterThan(-1)
    expect(proofIdx).toBeGreaterThan(reachIdx)
    expect(doorsIdx).toBeGreaterThan(proofIdx)
    expect(PAGE).toContain('tel:${CONTACT.phoneDirectTel}')
    expect(PAGE).toContain('sms:${CONTACT.phoneDirectTel}')
    expect(PAGE).toContain('mailto:${CONTACT.email.primary}')
    expect(PAGE).toContain("href: '/book'")
    expect(PAGE).toContain('ariaLabel="Reach a broker"')
  })
})
