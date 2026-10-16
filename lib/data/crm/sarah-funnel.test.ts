import { describe, expect, it } from 'vitest'
import { SARAH_FUNNEL_STAGES } from './sarah-funnel'

describe('Sarah funnel stages', () => {
  it('tracks opened, intent, name, contact, consent', () => {
    expect(SARAH_FUNNEL_STAGES).toEqual(['opened', 'intent', 'name', 'contact', 'consent'])
  })
})
