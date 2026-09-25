import { describe, expect, it } from 'vitest'
import {
  CMA_LETTER_SHOW_OWNER_NAME,
  HELD_LETTER_GREETING,
  applyPreparedLinesToStoredHtml,
  letterContainsOwnerContactNames,
  letterOwnerNameCheck,
  ownerContactNameTokens,
  preparedClosingLine,
  preparedCoverLine,
  preparedLineWithoutName,
} from '@/lib/cma/letter-privacy'

describe('letter privacy — Slate / Oakside / Marshmallow name tokens', () => {
  it('Slate shape: owner tokens on p2 and p13 are refused', () => {
    const names = { clientName: 'Jordan Slate' }
    expect(ownerContactNameTokens(names)).toEqual(['Jordan', 'Slate'])
    const letter = '<p>Prepared for Jordan Slate</p><p>Jordan, the sales support $594,000.</p>'
    expect(letterContainsOwnerContactNames(letter, names)).toBe(true)
    expect(letterOwnerNameCheck(letter, names).pass).toBe(false)
    const clean = '<p>Prepared by Matt Ryan, Ryan Realty</p><p>The sales support $594,000.</p>'
    expect(letterOwnerNameCheck(clean, names).pass).toBe(true)
  })

  it('Oakside and Marshmallow shape: cover and email draft cannot carry the row name', () => {
    const oakside = { clientName: 'Alex Oakside' }
    const marshmallow = { clientName: 'Riley Marshmallow' }
    expect(letterContainsOwnerContactNames('Prepared for Alex Oakside.', oakside)).toBe(true)
    expect(letterContainsOwnerContactNames('Hi Riley, here is the report.', marshmallow)).toBe(true)
    expect(letterContainsOwnerContactNames(`${HELD_LETTER_GREETING} Here is the report.`, marshmallow)).toBe(
      false,
    )
    expect(preparedLineWithoutName('Matt Ryan')).toBe('Prepared by Matt Ryan, Ryan Realty')
    expect(preparedLineWithoutName('Matt Ryan')).not.toMatch(/Oakside|Marshmallow|Alex|Riley/)
  })

  it('cover and closing names sit behind CMA_LETTER_SHOW_OWNER_NAME (default off)', () => {
    expect(CMA_LETTER_SHOW_OWNER_NAME).toBe(false)
    const names = { clientName: 'Jordan Slate' }
    const coverOff = preparedCoverLine({
      brokerName: 'Matt Ryan',
      generatedAt: 'September 25, 2026',
      ownerName: 'Jordan Slate',
      streetAddress: '20594 Slate',
    })
    const closeOff = preparedClosingLine({
      generatedAt: 'September 25, 2026',
      ownerName: 'Jordan Slate',
      streetAddress: '20594 Slate',
    })
    expect(coverOff).toBe(
      'Prepared for the owners of 20594 Slate by Matt Ryan, Ryan Realty · September 25, 2026',
    )
    expect(closeOff).toBe(
      'Prepared September 25, 2026 for the owners of 20594 Slate. This is a comparative market analysis. It is not an appraisal.',
    )
    expect(coverOff).not.toMatch(/Jordan/)
    expect(closeOff).not.toMatch(/Jordan/)
    expect(letterOwnerNameCheck(`<p>${coverOff}</p><p>${closeOff}</p>`, names).pass).toBe(true)

    const coverOn = preparedCoverLine({
      brokerName: 'Matt Ryan',
      generatedAt: 'September 25, 2026',
      ownerName: 'Jordan Slate',
      streetAddress: '20594 Slate',
      showOwnerName: true,
    })
    const closeOn = preparedClosingLine({
      generatedAt: 'September 25, 2026',
      ownerName: 'Jordan Slate',
      streetAddress: '20594 Slate',
      showOwnerName: true,
    })
    expect(coverOn).toBe('Prepared for Jordan Slate by Matt Ryan, Ryan Realty · September 25, 2026')
    expect(closeOn).toBe(
      'Prepared September 25, 2026 for Jordan Slate. This is a comparative market analysis. It is not an appraisal.',
    )
    const allowed = `<p>${coverOn}</p><p>${closeOn}</p>`
    expect(letterOwnerNameCheck(allowed, names, { showOwnerName: true }).pass).toBe(true)
    expect(letterOwnerNameCheck(`${allowed}<p>Jordan, the sales support $594,000.</p>`, names, { showOwnerName: true }).pass).toBe(
      false,
    )
    expect(letterOwnerNameCheck(allowed, names).pass).toBe(false)
  })

  it('rewrites stored prepared lines to owners-of-street without a rebuild', () => {
    const stored = [
      '<h1 class="cover-title">20506 Murphy</h1>',
      '<p class="cover-presented">Prepared for Jordan Murphy by Matt Ryan, Ryan Realty · September 25, 2026</p>',
      '<p class="fine">Prepared September 25, 2026 for Jordan Murphy. This is a comparative market analysis. It is not an appraisal.</p>',
    ].join('')
    const html = applyPreparedLinesToStoredHtml(stored, {
      streetAddress: '20506 Murphy',
      brokerName: 'Matt Ryan',
    })
    expect(html).toContain(
      'Prepared for the owners of 20506 Murphy by Matt Ryan, Ryan Realty · September 25, 2026',
    )
    expect(html).toContain(
      'Prepared September 25, 2026 for the owners of 20506 Murphy. This is a comparative market analysis. It is not an appraisal.',
    )
    expect(html).not.toContain('Prepared for Jordan Murphy')
    expect(html).not.toContain('for Jordan Murphy.')
  })
})
