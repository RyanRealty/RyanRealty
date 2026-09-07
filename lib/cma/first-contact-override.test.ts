import { describe, expect, it } from 'vitest'
import { readFirstContactOverride } from './first-contact-override'

describe('readFirstContactOverride', () => {
  it('returns null when missing', () => {
    expect(readFirstContactOverride(null)).toBeNull()
    expect(readFirstContactOverride({})).toBeNull()
  })

  it('reads subject and bodyText', () => {
    expect(
      readFirstContactOverride({
        firstContactOverride: { subject: 'Hi', bodyText: 'Body here.' },
      }),
    ).toEqual({ subject: 'Hi', bodyText: 'Body here.' })
  })
})
