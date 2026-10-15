import { describe, expect, it } from 'vitest'
import { mattConferenceJoin, sarahLiveConferenceName, sarahSessionConferenceJoin, sessionIdFromSarahConference } from '@/lib/sarah'
import {
  bargeTwiml,
  callerConferenceTwiml,
  silentWaitTwiml,
  sipUriForConference,
} from './sarah-conference'

describe('sarah conference', () => {
  it('uses lib/sarah conference names', () => {
    expect(sarahLiveConferenceName('CAabc')).toBe('sarah-live-CAabc')
    expect(sessionIdFromSarahConference('sarah-live-CAabc')).toBe('CAabc')
    expect(sessionIdFromSarahConference('other')).toBeNull()
  })

  it('plays the recording notice before conference record', () => {
    const xml = callerConferenceTwiml({
      site: 'https://ryan-realty.com',
      conferenceName: sarahLiveConferenceName('CAabc'),
      record: true,
    })
    expect(xml).toMatch(/<Say>This call is recorded and transcribed/)
    expect(xml).toContain('Matt&apos;s assistant')
    expect(xml.indexOf('<Say>')).toBeLessThan(xml.indexOf('record="record-from-start"'))
    expect(xml).toContain('sarah-live-CAabc')
    expect(xml).toContain('/api/voice/sarah-conference')
    expect(xml).toContain('/api/voice/sarah-wait')
  })

  it('omits record attrs when recording is off', () => {
    const xml = callerConferenceTwiml({
      site: 'https://ryan-realty.com',
      conferenceName: sarahLiveConferenceName('CAabc'),
      record: false,
    })
    expect(xml).not.toMatch(/record=/)
  })

  it('applies mattConferenceJoin flags for listen / coach / barge', () => {
    const listen = mattConferenceJoin('x', 'listen')
    const coach = mattConferenceJoin('x', 'coach')
    const barge = mattConferenceJoin('x', 'barge')
    const listenXml = bargeTwiml({ sessionId: 'x', mode: 'listen' })
    const coachXml = bargeTwiml({ sessionId: 'x', mode: 'coach', coachCallSid: 'CAsip' })
    const bargeXml = bargeTwiml({ sessionId: 'x', mode: 'barge' })
    expect(listen.muted).toBe(true)
    expect(listenXml).toContain('muted="true"')
    expect(listenXml).toContain(`startConferenceOnEnter="${listen.startConferenceOnEnter}"`)
    expect(coach.coach).toBe(true)
    expect(coachXml).toContain('coach="CAsip"')
    expect(barge.muted).toBe(false)
    expect(bargeXml).not.toContain('muted="true"')
  })

  it('uses sarahSessionConferenceJoin label session for the SIP leg', () => {
    expect(sarahSessionConferenceJoin('CAabc')).toMatchObject({
      conferenceName: 'sarah-live-CAabc',
      label: 'session',
      startConferenceOnEnter: true,
      endConferenceOnExit: true,
      muted: false,
    })
  })

  it('stamps the conference name on the SIP URI', () => {
    expect(sipUriForConference('sarah-live-CAabc')).toContain('X-Sarah-Conference=sarah-live-CAabc')
    expect(sipUriForConference('sarah-live-CAabc')).toContain('sip.voice.x.ai')
  })

  it('returns a silent wait', () => {
    expect(silentWaitTwiml()).toContain('<Pause')
  })
})
