import { describe, expect, it } from 'vitest'
import { notifySarahLiveSession, sarahLiveConferenceName } from './phone-hooks'

describe('phone-line hook points', () => {
  it('names the barge-in conference from the session id', () => {
    expect(sarahLiveConferenceName('abc-123')).toBe('sarah-live-abc-123')
  })

  it('leaves notify unwired until the alerts PR', async () => {
    const result = await notifySarahLiveSession({
      channel: 'voice',
      sessionId: 'abc-123',
    })
    expect(result).toEqual({ skipped: true, reason: 'notify-not-wired' })
  })
})
