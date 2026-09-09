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

  /**
   * SITE-48 replaced the earlier rule here. The reach used to be a V3Quiet
   * SECTION above V3Proof, on the argument that 375 needed a way to reach a
   * broker without scrolling past the instrument. The taste table of
   * 2026-09-08 scored the result 48 and named that section as the dullest
   * thing on the page: "a person landing on a reviews page to judge
   * trustworthiness meets four identical arrow-tipped rows of contact info
   * before seeing a single star or quote." The reach is still on the first
   * screen — it is now a slim action row INSIDE the proof band, under the
   * score and the lead quote — so the same four destinations survive and the
   * page opens on the rating.
   */
  it('folds the reach into the proof band, after the score, never as a section above it', () => {
    expect(PAGE).not.toContain('id="reach"')
    expect(PAGE).not.toContain('ariaLabel="Reach a broker"')
    const actionsIdx = PAGE.indexOf('reachActions')
    const proofIdx = PAGE.indexOf('<V3Proof')
    const doorsIdx = PAGE.indexOf('id="next"')
    expect(actionsIdx).toBeGreaterThan(-1)
    expect(PAGE).toContain('actions={reachActions}')
    expect(doorsIdx).toBeGreaterThan(proofIdx)
    expect(PAGE).toContain('tel:${CONTACT.phoneDirectTel}')
    expect(PAGE).toContain('sms:${CONTACT.phoneDirectTel}')
    expect(PAGE).toContain('mailto:${CONTACT.email.primary}')
    expect(PAGE).toContain("href: '/book'")
  })

  it('leads with the score face rather than a bare figure row', () => {
    expect(PAGE).toContain('face')
    expect(PAGE).toContain("{ value: average.toFixed(1), label: 'average of 5' }")
    expect(PAGE).toContain("{ value: String(count), label: 'Google reviews' }")
  })
})
