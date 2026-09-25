import { describe, expect, it } from 'vitest'
import {
  CMA_LETTER_SHOW_OWNER_NAME,
  HELD_LETTER_GREETING,
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
    })
    const closeOff = preparedClosingLine({
      generatedAt: 'September 25, 2026',
      ownerName: 'Jordan Slate',
    })
    expect(coverOff).toBe('Prepared by Matt Ryan, Ryan Realty · September 25, 2026')
    expect(closeOff).toBe('Prepared September 25, 2026. This is a comparative market analysis. It is not an appraisal.')
    expect(coverOff).not.toMatch(/Jordan|Slate/)
    expect(closeOff).not.toMatch(/Jordan|Slate/)
    expect(letterOwnerNameCheck(`<p>${coverOff}</p><p>${closeOff}</p>`, names).pass).toBe(true)

    const coverOn = preparedCoverLine({
      brokerName: 'Matt Ryan',
      generatedAt: 'September 25, 2026',
      ownerName: 'Jordan Slate',
      showOwnerName: true,
    })
    const closeOn = preparedClosingLine({
      generatedAt: 'September 25, 2026',
      ownerName: 'Jordan Slate',
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
})
