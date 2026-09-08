import { describe, expect, it } from 'vitest'
import { publishTourConfirmation } from './publish-tour-confirmation'

describe('publishTourConfirmation', () => {
  it('names the listing when the contact page resolved one', () => {
    expect(publishTourConfirmation('65930 Mariposa Lane, Bend, $7,900,000, 7 bd, 9 ba')).toBe(
      'Tour request received for 65930 Mariposa Lane, Bend, $7,900,000, 7 bd, 9 ba. A broker gets it now and will call or text to set a time.',
    )
  })

  it('keeps the generic line when no listing is on the form', () => {
    expect(publishTourConfirmation(undefined)).toBe(
      'Tour request received. A broker gets it now and will call or text to set a time.',
    )
    expect(publishTourConfirmation('   ')).toBe(
      'Tour request received. A broker gets it now and will call or text to set a time.',
    )
  })
})
