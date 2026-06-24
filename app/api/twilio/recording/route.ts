/**
 * Recording-completed webhook: fetch the audio from Twilio, transcribe it with
 * ElevenLabs speech-to-text (scribe), and attach recording + transcript to the
 * matching timeline entry (call or voicemail, matched by CallSid). Emails the
 * transcript to the assigned broker.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { TWILIO_PUBLIC_ORIGIN, verifiedTwilioParams } from '@/lib/crm/twilio'
import { CRM_MAILBOXES, sendCrmEmail } from '@/lib/crm/gmail'

/** Twilio CallSid / RecordingSid shape — validate before using inside a PostgREST
 *  .or() filter so a crafted value can never inject filter syntax. */
const SID_RE = /^(CA|RE)[a-f0-9]{32}$/

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function transcribe(audio: ArrayBuffer): Promise<string | null> {
  const key = process.env.ELEVENLABS_API_KEY?.trim()
  if (!key) return null
  const form = new FormData()
  form.append('file', new Blob([audio], { type: 'audio/mpeg' }), 'call.mp3')
  form.append('model_id', 'scribe_v1')
  form.append('diarize', 'true')
  form.append('tag_audio_events', 'false')
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: form,
  })
  if (!res.ok) {
    console.warn('[recording] STT failed:', res.status, (await res.text()).slice(0, 200))
    return null
  }
  const data = (await res.json()) as { text?: string }
  return data.text?.trim() || null
}

export async function POST(request: Request) {
  const verified = await verifiedTwilioParams(request)
  if (!verified.ok) return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  const params = verified.params

  const site = TWILIO_PUBLIC_ORIGIN

  const callSid = params.CallSid ?? ''
  const recordingSid = params.RecordingSid ?? ''
  const duration = Number(params.RecordingDuration ?? 0)
  if (!SID_RE.test(callSid) || !SID_RE.test(recordingSid)) {
    return NextResponse.json({ ok: false, error: 'invalid sids' }, { status: 400 })
  }

  const sb = createServiceClient()
  // the call/voicemail row logged by the voice webhooks
  const { data: rows } = await sb
    .from('crm_timeline')
    .select('id,person_id,kind,broker,payload')
    .or(`dedupe_key.like.twilio:call:${callSid}:%,dedupe_key.like.twilio:vm:${callSid}:%`)
    .limit(2)
  const row = rows?.find((r) => r.kind === 'voicemail') ?? rows?.[0]

  // fetch audio (mp3) with account auth
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const token = process.env.TWILIO_AUTH_TOKEN?.trim()
  let transcript: string | null = null
  if (sid && token && duration >= 2) {
    const audioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Recordings/${recordingSid}.mp3`,
      { headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64') } },
    )
    if (audioRes.ok) transcript = await transcribe(await audioRes.arrayBuffer())
  }

  if (row) {
    await sb.from('crm_timeline').update({
      body: transcript ?? null,
      payload: {
        ...(row.payload as Record<string, unknown>),
        recordingSid,
        recordingDurationSec: duration,
        transcribed: !!transcript,
      },
    }).eq('id', row.id)

    // alert the broker with the transcript
    const mailbox = CRM_MAILBOXES.find((m) => m.slug === row.broker) ?? CRM_MAILBOXES[0]
    const label = row.kind === 'voicemail' ? 'Voicemail' : 'Call recording'
    void sendCrmEmail({
      fromMailbox: mailbox.email,
      to: mailbox.email,
      subject: `${label} transcript (${duration}s)`,
      bodyText: `${transcript ?? '(no transcript available)'}\n\nListen: ${site}/api/admin/crm/recording/${recordingSid}\nContact: ${site}/admin/crm/${row.person_id}`,
    })
  }

  return NextResponse.json({ ok: true, transcribed: !!transcript })
}
