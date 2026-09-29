import { describe, expect, it } from 'vitest'
import { cmaReviewOverrideIfEdited } from '@/lib/cma/review-override'

describe('cmaReviewOverrideIfEdited', () => {
  const baseline = { subject: 'A market analysis for 62017 Nate\'s', bodyText: 'Hi there,\n\nThe letter.' }

  it('returns undefined when neither subject nor body was edited', () => {
    expect(cmaReviewOverrideIfEdited({ ...baseline }, baseline)).toBeUndefined()
    expect(
      cmaReviewOverrideIfEdited(
        { subject: `  ${baseline.subject}  `, bodyText: `\n${baseline.bodyText}\n` },
        baseline,
      ),
    ).toBeUndefined()
  })

  it('returns the trimmed override when the subject or the body changed', () => {
    expect(cmaReviewOverrideIfEdited({ subject: 'Changed', bodyText: baseline.bodyText }, baseline)).toEqual({
      subject: 'Changed',
      bodyText: baseline.bodyText,
    })
    expect(cmaReviewOverrideIfEdited({ subject: baseline.subject, bodyText: 'A note.' }, baseline)).toEqual({
      subject: baseline.subject,
      bodyText: 'A note.',
    })
  })
})
