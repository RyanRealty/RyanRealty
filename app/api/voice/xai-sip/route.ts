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
import { runSipCall } from '@/lib/grok/voice-sip'
import { verifyXaiWebhook } from '@/lib/voice/xai-sip'
import { logReceptionistCall, deliverReceptionistMessage } from '@/lib/voice/receptionist-log'
import { forwardCellForBroker } from '@/lib/crm/twilio'
import { transferTestTarget } from '@/lib/voice/receptionist-routing'
import { RECEPTIONIST_GREETING, RECEPTIONIST_PROMPT, transferFailedGreeting } from '@/lib/voice/receptionist-prompt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 800

type IncomingEvent = {
  type?: string
  data?: { call_id?: string; sip_headers?: { name: string; value: string }[] }
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
  const cells: Record<string, string | null> = {}
  for (const b of ['matt', 'rebecca', 'paul']) { try { cells[b] = await forwardCellForBroker(b) } catch { cells[b] = null } }
  const test = transferTestTarget()
  const resolveTransfer = (who: 'matt' | 'rebecca' | 'paul') => test ?? cells[who] ?? null
  const failed = event.data.sip_headers?.find((h) => h.name.toLowerCase() === 'x-transfer-failed')?.value ?? null
  const greeting = failed ? transferFailedGreeting(failed) : RECEPTIONIST_GREETING
  after(() => runSipCall(callId, from, { instructions: RECEPTIONIST_PROMPT, greeting, resolveTransfer: failed ? undefined : resolveTransfer, onMessage: (m) => deliverReceptionistMessage(callId, from, m), onEnd: (lines) => logReceptionistCall(callId, from, lines) }))
  return NextResponse.json({ ok: true })
}
