import { describe, expect, it } from 'vitest'
import { publishTourConfirmation } from './publish-tour-confirmation'

describe('publishTourConfirmation', () => {
  it('names the listing when the contact page resolved one', () => {
    expect(publishTourConfirmation('65930 Mariposa Lane, Bend, $7,900,000, 7 bd, 9 ba')).toBe(
      'Tour request received for 65930 Mariposa Lane, Bend, $7,900,000, 7 bd, 9 ba. A broker will call or text to confirm a time within one business day.',
    )
  })

  it('keeps the generic line when no listing is on the form', () => {
    expect(publishTourConfirmation(undefined)).toBe(
      'Tour request received. A broker will call or text to confirm a time within one business day.',
    )
    expect(publishTourConfirmation('   ')).toBe(
      'Tour request received. A broker will call or text to confirm a time within one business day.',
    )
  })
})
