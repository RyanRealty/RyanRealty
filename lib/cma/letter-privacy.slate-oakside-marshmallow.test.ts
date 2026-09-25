import { describe, expect, it } from 'vitest'
import {
  HELD_LETTER_GREETING,
  letterContainsOwnerContactNames,
  letterOwnerNameCheck,
  ownerContactNameTokens,
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
})
