import { describe, expect, it } from 'vitest'
import { visitorEscalateEmailEnabled } from './visitor-escalate'

describe('visitor-escalate email rail', () => {
  it('is off — looking-at / Today is the wake', () => {
    expect(visitorEscalateEmailEnabled()).toBe(false)
  })
})
