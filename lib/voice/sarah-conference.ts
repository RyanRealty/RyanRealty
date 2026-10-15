/**
 * Named Twilio conference for a live Sarah call so Matt can listen, coach,
 * or barge. Conference name is the shared lib/sarah contract:
 * sarah-live-{sessionId} (inbound CallSid).
 */
import { sarahLiveConferenceName } from '@/lib/sarah/phone-hooks'
import { escapeXml, XAI_SIP_URI } from '@/lib/voice/receptionist-routing'
import { RECEPTIONIST_RECORDING_NOTICE } from '@/lib/voice/receptionist-prompt'
import { toE164 } from '@/lib/crm/twilio'

export type SarahBargeMode = 'listen' | 'coach' | 'barge'

export function sarahConferenceName(callSid: string): string {
  return sarahLiveConferenceName(callSid.trim())
}

export function conferenceSessionId(friendlyName: string): string | null {
  const prefix = 'sarah-live-'
  if (!friendlyName.startsWith(prefix)) return null
  const id = friendlyName.slice(prefix.length).trim()
  return id || null
}

export function sipUriForConference(conferenceName: string): string {
  const base = XAI_SIP_URI.split('?')[0]
  return `${base}?X-Sarah-Conference=${encodeURIComponent(conferenceName)}`
}

export function callerConferenceTwiml(opts: {
  site: string
  conferenceName: string
  record: boolean
}): string {
  const site = opts.site.replace(/\/+$/, '')
  const rec = opts.record
    ? ` record="record-from-start" recordingStatusCallback="${site}/api/twilio/recording" recordingStatusCallbackEvent="completed"`
    : ''
  const name = escapeXml(opts.conferenceName)
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>This call is recorded and transcribed. ${escapeXml(RECEPTIONIST_RECORDING_NOTICE.replace(/^This call is recorded and transcribed\.\s*/, ''))}</Say>
  <Dial>
    <Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false" waitUrl="${site}/api/voice/sarah-wait" statusCallback="${site}/api/voice/sarah-conference" statusCallbackEvent="start end join leave"${rec}>${name}</Conference>
  </Dial>
</Response>`
}

export function silentWaitTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response><Pause length="120"/></Response>`
}

export function bargeTwiml(opts: {
  conferenceName: string
  mode: SarahBargeMode
  coachCallSid?: string | null
}): string {
  const name = escapeXml(opts.conferenceName)
  if (opts.mode === 'listen') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Joining Sarah's call on mute.</Say>
  <Dial><Conference beep="false" muted="true" startConferenceOnEnter="false" endConferenceOnExit="false">${name}</Conference></Dial>
</Response>`
  }
  if (opts.mode === 'coach' && opts.coachCallSid) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Joining Sarah's call as coach. Only Sarah can hear you until you barge in.</Say>
  <Dial><Conference beep="false" startConferenceOnEnter="false" endConferenceOnExit="false" coach="${escapeXml(opts.coachCallSid)}">${name}</Conference></Dial>
</Response>`
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Joining Sarah's call.</Say>
  <Dial><Conference beep="false" startConferenceOnEnter="false" endConferenceOnExit="false">${name}</Conference></Dial>
</Response>`
}

function twilioCreds(): { sid: string; token: string } | null {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const token = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!sid || !token) return null
  return { sid, token }
}

function twilioAuth(c: { sid: string; token: string }): string {
  return 'Basic ' + Buffer.from(`${c.sid}:${c.token}`).toString('base64')
}

export async function addConferenceParticipant(opts: {
  conference: string
  from: string
  to: string
  label?: string
  muted?: boolean
  endConferenceOnExit?: boolean
  timeout?: number
  statusCallback?: string
}): Promise<{ ok: true; callSid: string } | { ok: false; error: string }> {
  const c = twilioCreds()
  if (!c) return { ok: false, error: 'Twilio not configured' }
  const from = toE164(opts.from) ?? opts.from
  const to = opts.to.trim()
  if (!from || !to) return { ok: false, error: 'Missing from/to' }
  const form = new URLSearchParams({
    From: from,
    To: to,
    EarlyMedia: 'true',
    Beep: 'false',
    EndConferenceOnExit: opts.endConferenceOnExit ? 'true' : 'false',
    Timeout: String(opts.timeout ?? 25),
  })
  if (opts.muted) form.set('Muted', 'true')
  if (opts.label) form.set('Label', opts.label)
  if (opts.statusCallback) {
    form.set('StatusCallback', opts.statusCallback)
    form.set('StatusCallbackEvent', 'initiated ringing answered completed')
  }
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Conferences/${encodeURIComponent(opts.conference)}/Participants.json`,
      {
        method: 'POST',
        headers: { Authorization: twilioAuth(c), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      },
    )
    const data = (await res.json()) as { call_sid?: string; message?: string }
    if (!res.ok || !data.call_sid) return { ok: false, error: data.message?.trim() || `Twilio participant failed (${res.status})` }
    return { ok: true, callSid: data.call_sid }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Twilio participant failed' }
  }
}

export async function setConferenceParticipantMuted(
  conference: string,
  callSid: string,
  muted: boolean,
): Promise<boolean> {
  const c = twilioCreds()
  if (!c) return false
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Conferences/${encodeURIComponent(conference)}/Participants/${encodeURIComponent(callSid)}.json`,
      {
        method: 'POST',
        headers: { Authorization: twilioAuth(c), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ Muted: muted ? 'true' : 'false' }),
      },
    )
    return res.ok
  } catch {
    return false
  }
}

export async function findConferenceParticipantCallSid(
  conference: string,
  label: string,
): Promise<string | null> {
  const c = twilioCreds()
  if (!c) return null
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Conferences/${encodeURIComponent(conference)}/Participants.json?PageSize=50`,
      { headers: { Authorization: twilioAuth(c) }, cache: 'no-store' },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { participants?: Array<{ call_sid?: string; label?: string }> }
    return data.participants?.find((p) => p.label === label)?.call_sid ?? null
  } catch {
    return null
  }
}

/** If the conference SIP join fails, send the inbound call to the old Dial-Sip path. */
export async function redirectCallToSipFallback(opts: {
  callSid: string
  site: string
  record: boolean
}): Promise<boolean> {
  const c = twilioCreds()
  if (!c || !opts.callSid.trim()) return false
  const site = opts.site.replace(/\/+$/, '')
  const rec = opts.record
    ? ` record="record-from-answer-dual" recordingStatusCallback="${site}/api/twilio/recording" recordingStatusCallbackEvent="completed"`
    : ''
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial answerOnBridge="true" timeout="20" action="${site}/api/voice/receptionist-complete" method="POST" referUrl="${site}/api/voice/receptionist-refer" referMethod="POST"${rec}><Sip>${XAI_SIP_URI}</Sip></Dial>
</Response>`
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Calls/${encodeURIComponent(opts.callSid)}.json`,
      {
        method: 'POST',
        headers: { Authorization: twilioAuth(c), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ Twiml: twiml }),
      },
    )
    return res.ok
  } catch {
    return false
  }
}

export async function fetchTwilioCall(
  callSid: string,
): Promise<{ from: string; to: string } | null> {
  const c = twilioCreds()
  if (!c || !callSid.trim()) return null
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Calls/${encodeURIComponent(callSid)}.json`,
      { headers: { Authorization: twilioAuth(c) }, cache: 'no-store' },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { from?: string; to?: string }
    return { from: data.from ?? '', to: data.to ?? '' }
  } catch {
    return null
  }
}

/** Stop in-progress conference recordings after a caller objects. */
export async function stopConferenceRecordings(conference: string): Promise<number> {
  const c = twilioCreds()
  if (!c || !conference.trim()) return 0
  try {
    const list = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Conferences/${encodeURIComponent(conference)}/Recordings.json?PageSize=20`,
      { headers: { Authorization: twilioAuth(c) }, cache: 'no-store' },
    )
    if (!list.ok) return 0
    const data = (await list.json()) as { recordings?: Array<{ sid?: string; status?: string }> }
    let stopped = 0
    for (const rec of data.recordings ?? []) {
      if (!rec.sid || rec.status === 'stopped' || rec.status === 'absent') continue
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Conferences/${encodeURIComponent(conference)}/Recordings/${encodeURIComponent(rec.sid)}.json`,
        {
          method: 'POST',
          headers: { Authorization: twilioAuth(c), 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ Status: 'stopped' }),
        },
      )
      if (res.ok) stopped += 1
    }
    return stopped
  } catch {
    return 0
  }
}

export async function startBargeCall(opts: {
  toCell: string
  fromNumber: string
  conferenceName: string
  mode: SarahBargeMode
  site: string
}): Promise<{ ok: true; sid: string } | { ok: false; error: string }> {
  const c = twilioCreds()
  if (!c) return { ok: false, error: 'Twilio not configured' }
  const to = toE164(opts.toCell)
  const from = toE164(opts.fromNumber)
  if (!to || !from) return { ok: false, error: 'Broker phone not configured' }
  const url = `${opts.site.replace(/\/+$/, '')}/api/voice/sarah-barge?conference=${encodeURIComponent(opts.conferenceName)}&mode=${encodeURIComponent(opts.mode)}`
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Calls.json`, {
      method: 'POST',
      headers: { Authorization: twilioAuth(c), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: from, Url: url, Method: 'POST' }),
    })
    const data = (await res.json()) as { sid?: string; message?: string }
    if (!res.ok || !data.sid) return { ok: false, error: data.message?.trim() || `Twilio call failed (${res.status})` }
    return { ok: true, sid: data.sid }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Twilio call failed' }
  }
}
