/**
 * An ordinary word that is also a surname is not an owner-name hit unless it
 * sits in a name-shaped position. Names here are made up.
 */
import { describe, expect, it } from 'vitest'
import {
  letterOwnerNameCheck,
  ownerNameTokenHits,
  scrubMlsOwnerTokens,
} from '@/lib/cma/letter-privacy'
import { renderCmaHtml, type RenderCmaArgs } from '@/lib/cma/render'
import type { CmaBroker, CmaPricing, CmaSubject } from '@/lib/cma/types'

const NAMES = { clientName: 'Quincy Price' }

describe('ordinary-word surnames are not bare name hits', () => {
  it('passes when the word is ordinary copy, not a name', () => {
    const letter = '<p>The list price is $410,000. The sale price landed close. What price and time look like here.</p>'
    const check = letterOwnerNameCheck(letter, NAMES)
    expect(check.pass).toBe(true)
    expect(ownerNameTokenHits(letter, NAMES)).toEqual([])
    expect(letterOwnerNameCheck('<p>Price was not what held it back.</p>', NAMES).pass).toBe(true)
    expect(letterOwnerNameCheck('<p>List Price</p>', NAMES).pass).toBe(true)
  })

  it('fails in a greeting and names only the token that hit', () => {
    const check = letterOwnerNameCheck('<p>Hi Price, the range is ready.</p>', NAMES)
    expect(check.pass).toBe(false)
    expect(check.detail).toBe('Letter or email draft printed owner/contact name token(s): Price.')
    expect(check.detail).not.toContain('Quincy')
  })

  it('fails when the word sits next to the first name', () => {
    const check = letterOwnerNameCheck('<p>Quincy Price asked about the roof.</p>', NAMES)
    expect(check.pass).toBe(false)
    expect(ownerNameTokenHits('<p>Quincy Price asked about the roof.</p>', NAMES)).toEqual(['Quincy', 'Price'])
    expect(letterOwnerNameCheck('<p>Prepared for Price by Matt Ryan.</p>', NAMES).pass).toBe(false)
    expect(letterOwnerNameCheck('<p>Sincerely, Price</p>', NAMES).pass).toBe(false)
    expect(letterOwnerNameCheck('<p>To: Price</p>', NAMES).pass).toBe(false)
  })

  it('scrubs a real first name out of a remark and leaves the ordinary word', () => {
    const dirty = 'Quincy will consider offers. Quincy Price painted the house. The list price holds.'
    const clean = scrubMlsOwnerTokens(dirty, NAMES)
    expect(clean).not.toMatch(/\bQuincy\b/)
    expect(clean).toMatch(/list price/)
    const reversed = scrubMlsOwnerTokens('Asked Price Quincy about the list price.', NAMES)
    expect(reversed).not.toMatch(/\bQuincy\b/)
    expect(reversed).not.toMatch(/\bPrice\b/)
    expect(reversed).toMatch(/list price/)
    expect(letterOwnerNameCheck(`<p>${clean}</p>`, NAMES).pass).toBe(true)
    const greeted = scrubMlsOwnerTokens('Hi Price, the list price holds.', NAMES)
    expect(greeted).not.toMatch(/\bPrice\b/)
    expect(greeted).toMatch(/list price/)
  })

  it('does not print a first name that arrived in a remark', () => {
    const subject = {
      listingKey: null,
      mlsNumber: '1',
      streetAddress: '10 Cedar Lane',
      city: 'Bend',
      state: 'OR',
      postalCode: '97701',
      subdivision: 'Cedar Plat',
      latitude: null,
      longitude: null,
      beds: 3,
      baths: 2,
      sqft: 1800,
      lotAcres: 0.15,
      propertySubType: 'Single Family Residence',
      yearBuilt: 1998,
      garageSpaces: 2,
      photoUrl: null,
      publicRemarks: 'Owner Quincy will consider offers. The list price was firm.',
      viewDescription: null,
      taxAnnual: null,
      standardStatus: 'Expired',
      lastListPrice: 700000,
      lastListDate: '2026-01-07',
      listingHistoryLine: 'Listed January 7, 2026 at $700,000, came off expired.',
    } as CmaSubject
    const pricing = {
      method1Low: 600000,
      method1Mid: 640000,
      method1High: 680000,
      method2: 630000,
      method3: 640000,
      convergenceSpreadPct: 2,
      converged: true,
      conservative: 610000,
      recommended: 640000,
      highEnd: 670000,
      valueLow: 610000,
      valueHigh: 670000,
      confidence: 'Moderate',
      confidenceReason: 'Three sales.',
      needsReview: false,
      reviewReason: null,
      compPpsfCv: 0.04,
      priceOverride: null,
      improvementsValueAdd: null,
      notes: [],
    } as unknown as CmaPricing
    const broker = {
      id: null,
      slug: 'matthew-ryan',
      displayName: 'Matt Ryan',
      title: 'Owner & Principal Broker',
      licenseNumber: '201212071',
      email: 'matt@ryan-realty.com',
      phone: '541.703.3095',
      photoUrl: null,
    } as CmaBroker
    const { html } = renderCmaHtml({
      subject,
      comps: [],
      market: null,
      pricing,
      broker,
      client: { name: 'Quincy Price', email: null, phone: null, notes: null },
      mapDataUri: null,
      generatedAtIso: '2026-09-28T12:00:00.000Z',
      subjectTrace: 't',
      compTrace: [],
      excludedOutliers: [],
    } as RenderCmaArgs)
    expect(html).not.toMatch(/\bQuincy\b/)
    expect(html).toMatch(/list price/i)
    expect(letterOwnerNameCheck(html, NAMES).pass).toBe(true)
  })
})
