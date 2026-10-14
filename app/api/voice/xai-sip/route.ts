/**
 * Grok Voice 3.0 receptionist over xAI SIP (Matt 2026-10-14, test line only).
 *
 * Flow: caller dials the spare Twilio number (+1 541-224-5025) -> Twilio Elastic
 * SIP trunk -> sip.voice.x.ai -> xAI POSTs a signed `realtime.call.incoming`
 * webhook here -> we join the call over WebSocket and run the receptionist
 * prompt until the call ends. Transcripts go to the function logs with the
 * `[xai-sip]` prefix. Matt's primary line (541-703-3095) is never routed here.
 *
 * Env: XAI_API_KEY, XAI_SIP_WEBHOOK_SECRET (signing secret from POST /v2/phone-numbers).
 */
import { NextResponse, after } from 'next/server'
import WebSocket from 'ws'
import { verifyXaiWebhook } from '@/lib/voice/xai-sip'
import { RECEPTIONIST_GREETING, RECEPTIONIST_PROMPT } from '@/lib/voice/receptionist-prompt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 800

type IncomingEvent = {
  type?: string
  data?: { call_id?: string; sip_headers?: { name: string; value: string }[] }
}

function runCall(callId: string, from: string): Promise<void> {
  return new Promise((resolve) => {
    const log = (m: string) => console.log(`[xai-sip] call=${callId} ${m}`)
    const ws = new WebSocket(`wss://api.x.ai/v1/realtime?call_id=${encodeURIComponent(callId)}`, {
      headers: { Authorization: `Bearer ${process.env.XAI_API_KEY ?? ''}` },
    })
    const done = () => resolve()
    const timer = setTimeout(() => { log('max duration reached'); ws.close() }, 780_000)
    ws.on('open', () => {
      log(`joined from=${from}`)
      ws.send(JSON.stringify({
        type: 'session.update',
        session: {
          voice: 'eve',
          instructions: RECEPTIONIST_PROMPT,
          turn_detection: { type: 'server_vad' },
          audio: { input: { transcription: { model: 'grok-transcribe' } } },
        },
      }))
      ws.send(JSON.stringify({
        type: 'response.create',
        response: { instructions: `Greet the caller with exactly: "${RECEPTIONIST_GREETING}"` },
      }))
    })
    ws.on('message', (raw) => {
      let e: { type?: string; transcript?: string; error?: unknown }
      try { e = JSON.parse(raw.toString()) } catch { return }
      if (!e.type) return
      if (e.type === 'error') log(`error ${JSON.stringify(e.error ?? e)}`)
      else if (/input_audio_transcription\.completed$/.test(e.type)) log(`CALLER: ${e.transcript ?? ''}`)
      else if (/output_audio_transcript\.done$|audio_transcript\.done$/.test(e.type)) log(`AGENT: ${e.transcript ?? ''}`)
    })
    ws.on('error', (err) => log(`ws error ${err.message}`))
    ws.on('close', (code) => { clearTimeout(timer); log(`ended code=${code}`); done() })
  })
}

export async function POST(req: Request) {
  const secret = process.env.XAI_SIP_WEBHOOK_SECRET ?? ''
  const body = await req.text()
  const ok = verifyXaiWebhook(secret, {
    id: req.headers.get('webhook-id'),
    timestamp: req.headers.get('webhook-timestamp'),
    signature: req.headers.get('webhook-signature'),
  }, body)
  if (!ok) return NextResponse.json({ error: 'invalid signature' }, { status: 401 })

  let event: IncomingEvent
  try { event = JSON.parse(body) } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  if (event.type !== 'realtime.call.incoming' || !event.data?.call_id) {
    return NextResponse.json({ ok: true, ignored: event.type ?? null })
  }
  const callId = event.data.call_id
  const from = event.data.sip_headers?.find((h) => h.name.toLowerCase() === 'from')?.value ?? 'unknown'
  after(() => runCall(callId, from))
  return NextResponse.json({ ok: true })
}
