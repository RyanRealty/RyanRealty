import { describe, expect, it } from 'vitest'
import {
  bargeTwiml,
  callerConferenceTwiml,
  conferenceSessionId,
  sarahConferenceName,
  silentWaitTwiml,
  sipUriForConference,
} from './sarah-conference'

describe('sarah conference', () => {
  it('names the conference from the inbound CallSid', () => {
    expect(sarahConferenceName('CAabc')).toBe('sarah-live-CAabc')
    expect(conferenceSessionId('sarah-live-CAabc')).toBe('CAabc')
    expect(conferenceSessionId('other')).toBeNull()
  })

  it('plays the recording notice before conference record', () => {
    const xml = callerConferenceTwiml({
      site: 'https://ryan-realty.com',
      conferenceName: 'sarah-live-CAabc',
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
      conferenceName: 'sarah-live-CAabc',
      record: false,
    })
    expect(xml).not.toMatch(/record=/)
  })

  it('builds listen / coach / barge TwiML', () => {
    expect(bargeTwiml({ conferenceName: 'sarah-live-x', mode: 'listen' })).toContain('muted="true"')
    expect(bargeTwiml({ conferenceName: 'sarah-live-x', mode: 'coach', coachCallSid: 'CAsip' })).toContain('coach="CAsip"')
    expect(bargeTwiml({ conferenceName: 'sarah-live-x', mode: 'barge' })).not.toContain('muted="true"')
  })

  it('stamps the conference name on the SIP URI', () => {
    expect(sipUriForConference('sarah-live-CAabc')).toContain('X-Sarah-Conference=sarah-live-CAabc')
    expect(sipUriForConference('sarah-live-CAabc')).toContain('sip.voice.x.ai')
  })

  it('returns a silent wait', () => {
    expect(silentWaitTwiml()).toContain('<Pause')
  })
})
