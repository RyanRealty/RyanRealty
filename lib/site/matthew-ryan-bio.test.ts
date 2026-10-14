import { describe, expect, it } from 'vitest'
import { BRAND, BROKERS, CONTACT } from '@/lib/brand/contact'
import { LISTING_FEE_PERCENT } from '@/app/sell/_v3/sell-constants'
import { matthewRyanBio, matthewRyanBioInRange, matthewRyanBioWordCount } from './matthew-ryan-bio'

describe('matthewRyanBio', () => {
  const bio = matthewRyanBio()

  it('is 400-600 words of prose from locked brand facts', () => {
    const words = matthewRyanBioWordCount(bio)
    expect(words).toBeGreaterThanOrEqual(400)
    expect(words).toBeLessThanOrEqual(600)
    expect(matthewRyanBioInRange(bio)).toBe(true)
    expect(bio).toContain(`${BRAND.legalName} in ${BRAND.llcSince}`)
    expect(bio).toContain(`opened the Bend office in ${BRAND.foundedLabel}`)
    expect(bio).toContain(BROKERS.matt.license)
    expect(bio).toContain(BRAND.firmLicense)
    expect(bio).toContain(BRAND.address.street)
    expect(bio).toContain(CONTACT.phoneDirect)
    expect(bio).toContain(CONTACT.email.primary)
    expect(bio).toContain(`${LISTING_FEE_PERCENT} of the sale price`)
    expect(bio).toContain('Hjalmar "Red" Erickson')
  })

  it('never says top team and never names a client', () => {
    expect(bio.toLowerCase()).not.toContain('top team')
    expect(bio).not.toContain('\u2014')
    expect(bio).not.toMatch(/\b(Pahlisch|Petrosa|Aldrich|Mahogany|Lucia)\b/)
  })
})
