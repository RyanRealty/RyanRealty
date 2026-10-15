/**
 * Recording-completed webhook: fetch the audio from Twilio, transcribe it with
 * ElevenLabs speech-to-text (scribe), and attach recording + transcript to the
 * matching timeline entry (call or voicemail, matched by CallSid). Emails the
 * transcript to the assigned broker.
 *
 * Hot path: signature, raw persist, 200. STT / timeline / enrich run after ack
 * (or via twilio-webhook-replay when the call/vm row is not ready yet).
 */

import { NextResponse, after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { TWILIO_PUBLIC_ORIGIN } from '@/lib/crm/twilio'
import { sendCrmEmail } from '@/lib/crm/gmail'
import { mailboxForSlug } from '@/lib/data/brokers/directory'
import { applyInboundMessageEnrichment } from '@/lib/data/crm/applyInboundMessageEnrichment'
import { ackTwilioWebhook } from '@/lib/crm/twilio-webhook-ack'

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
  return ackTwilioWebhook({
    request,
    kind: 'recording',
    process: processRecording,
    respond: () => NextResponse.json({ ok: true }),
  })
}

export async function processRecording(params: Record<string, string>): Promise<void> {
  const site = TWILIO_PUBLIC_ORIGIN
  const callSid = params.CallSid ?? ''
  const recordingSid = params.RecordingSid ?? ''
  const duration = Number(params.RecordingDuration ?? 0)
  if (!SID_RE.test(callSid) || !SID_RE.test(recordingSid)) {
    return
  }

  const sb = createServiceClient()
  const { data: rows } = await sb
    .from('crm_timeline')
    .select('id,person_id,kind,broker,payload')
    .or(`dedupe_key.like.twilio:call:${callSid}:%,dedupe_key.like.twilio:vm:${callSid}:%`)
    .limit(2)
  const row = rows?.find((r) => r.kind === 'voicemail') ?? rows?.[0]

  if (row && (row.payload as Record<string, unknown> | null)?.recordingSid) {
    return
  }

  if (!row) {
    throw new Error(`row not ready for CallSid ${callSid}`)
  }

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

  const update: Record<string, unknown> = {
    payload: {
      ...(row.payload as Record<string, unknown>),
      recordingSid,
      recordingDurationSec: duration,
      transcribed: !!transcript,
    },
  }
  if (transcript) update.body = transcript
  await sb.from('crm_timeline').update(update).eq('id', row.id)

  if (transcript && row.kind === 'voicemail') {
    const payload = (row.payload as Record<string, unknown> | null) ?? {}
    const fromNumber = typeof payload.fromNumber === 'string' ? payload.fromNumber : null
    const runEnrich = () =>
      applyInboundMessageEnrichment({
        personId: row.person_id,
        body: transcript,
        channel: 'voicemail',
        fromNumber,
        messageSid: callSid,
        broker: row.broker,
      }).catch((e) => {
        console.warn('[recording] inbound enrich failed', e)
      })
    try {
      after(() => {
        void runEnrich()
      })
    } catch {
      void runEnrich()
    }
  }

  const mailbox = await mailboxForSlug(row.broker)
  const label = row.kind === 'voicemail' ? 'Voicemail' : 'Call recording'
  try {
    await sendCrmEmail({
      fromMailbox: mailbox.email,
      to: mailbox.email,
      subject: `${label} transcript (${duration}s)`,
      bodyText: `${transcript ?? '(no transcript available)'}\n\nListen: ${site}/api/admin/crm/recording/${recordingSid}\nContact: ${site}/admin/people/${row.person_id}`,
    })
  } catch (err) {
    console.error('[recording] transcript email failed', err)
  }
}
