import { describe, expect, it } from 'vitest'
import {
  mattConferenceJoin as mattConferenceJoinFromBarrel,
  notifyLiveSession as notifyLiveSessionFromBarrel,
  sarahSessionConferenceJoin as sarahSessionConferenceJoinFromBarrel,
} from './index'
import {
  isSarahLiveConference,
  mattConferenceJoin,
  notifyLiveSession,
  notifySarahLiveSession,
  sarahLiveConferenceName,
  sarahLiveViewPath,
  sarahSessionConferenceJoin,
  sessionIdFromSarahConference,
} from './phone-hooks'

describe('phone-line hook points', () => {
  it('names the barge-in conference from the session id', () => {
    expect(sarahLiveConferenceName('abc-123')).toBe('sarah-live-abc-123')
    expect(isSarahLiveConference('sarah-live-abc-123')).toBe(true)
    expect(isSarahLiveConference('other')).toBe(false)
    expect(sessionIdFromSarahConference('sarah-live-abc-123')).toBe('abc-123')
    expect(sessionIdFromSarahConference('other')).toBeNull()
  })

  it('exports notifyLiveSession as the name the phone line calls', async () => {
    expect(notifySarahLiveSession).toBe(notifyLiveSession)
    expect(notifyLiveSessionFromBarrel).toBe(notifyLiveSession)
    expect(sarahSessionConferenceJoinFromBarrel).toBe(sarahSessionConferenceJoin)
    expect(mattConferenceJoinFromBarrel).toBe(mattConferenceJoin)
    const result = await notifyLiveSession({
      channel: 'voice',
      sessionId: 'abc-123',
    })
    expect(result).toEqual({ skipped: true, reason: 'notify-not-wired' })
    expect(sarahLiveViewPath('abc-123')).toBe('/admin/sarah/live/abc-123')
  })

  it('gives the session leg and Matt listen/coach/barge joins', () => {
    const session = sarahSessionConferenceJoin('abc-123')
    expect(session).toEqual({
      conferenceName: 'sarah-live-abc-123',
      sessionId: 'abc-123',
      label: 'session',
      role: 'session',
      muted: false,
      coach: false,
      startConferenceOnEnter: true,
      endConferenceOnExit: true,
    })
    expect(mattConferenceJoin('abc-123', 'listen')).toMatchObject({
      label: 'matt',
      role: 'listen',
      muted: true,
      coach: false,
      endConferenceOnExit: false,
    })
    expect(mattConferenceJoin('abc-123', 'coach')).toMatchObject({
      role: 'coach',
      muted: false,
      coach: true,
    })
    expect(mattConferenceJoin('abc-123', 'barge')).toMatchObject({
      role: 'barge',
      muted: false,
      coach: false,
    })
  })
})
