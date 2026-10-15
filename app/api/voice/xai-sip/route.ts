/**
 * Grok Voice receptionist over xAI SIP.
 *
 * Inbound: Twilio /api/twilio/voice puts the caller in conference sarah-live-{CallSid}
 * and adds this SIP URI as a participant. xAI POSTs realtime.call.incoming here.
 * Persona/guardrails come from lib/sarah. Transfers prefer the conference so Matt
 * can barge; SIP REFER remains the fallback.
 */
import { NextResponse, after } from 'next/server'
import { runSipCall, type TransferTarget } from '@/lib/grok/voice-sip'
import { verifyXaiWebhook } from '@/lib/voice/xai-sip'
import { logReceptionistCall, deliverReceptionistMessage } from '@/lib/voice/receptionist-log'
import { callerFromSipHeader } from '@/lib/voice/receptionist-log'
import { forwardCellForBroker } from '@/lib/crm/twilio'
import { transferTestTarget } from '@/lib/voice/receptionist-routing'
import { RECEPTIONIST_GREETING, RECEPTIONIST_PROMPT, transferFailedGreeting } from '@/lib/voice/receptionist-prompt'
import { addConferenceParticipant, findConferenceParticipantCallSid, setConferenceParticipantMuted, stopConferenceRecordings } from '@/lib/voice/sarah-conference'
import { notifySarahLiveSession } from '@/lib/sarah/phone-hooks'
import { evaluateSarahTurn } from '@/lib/sarah/guardrails'
import { lookupPersonByPhone, TWILIO_PUBLIC_ORIGIN } from '@/lib/crm/twilio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 800

type IncomingEvent = {
  type?: string
  data?: { call_id?: string; sip_headers?: { name: string; value: string }[] }
}

function header(headers: { name: string; value: string }[] | undefined, name: string): string | null {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null
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
  const from = header(event.data.sip_headers, 'from') ?? 'unknown'
  const conference =
    header(event.data.sip_headers, 'x-sarah-conference') ??
    header(event.data.sip_headers, 'X-Sarah-Conference')
  const cells: Record<string, string | null> = {}
  for (const b of ['matt', 'rebecca', 'paul']) { try { cells[b] = await forwardCellForBroker(b) } catch { cells[b] = null } }
  const test = transferTestTarget()
  const resolveTransfer = (who: TransferTarget) => test ?? cells[who] ?? null
  const failed = header(event.data.sip_headers, 'x-transfer-failed')
  const greeting = failed ? transferFailedGreeting(failed) : RECEPTIONIST_GREETING
  const fromPhone = callerFromSipHeader(from)
  after(async () => {
    try {
      const person = fromPhone ? await lookupPersonByPhone(fromPhone) : null
      await notifySarahLiveSession({
        channel: 'voice',
        sessionId: conference || callId,
        personId: person?.personId ?? null,
        displayName: person?.name ?? null,
        contact: fromPhone,
        summary: 'Inbound Sarah call',
        xaiCallId: callId,
      })
    } catch (e) {
      console.error('[xai-sip] notifyLiveSession failed', e)
    }
    await runSipCall(callId, from, {
      instructions: RECEPTIONIST_PROMPT,
      greeting,
      resolveTransfer: failed ? undefined : resolveTransfer,
      onTransfer: failed || !conference
        ? undefined
        : async (who) => {
            const target = resolveTransfer(who)
            if (!target || !conference) return false
            const fromLine = process.env.TWILIO_NUMBER_MARKETING?.trim() || '+15412245025'
            const added = await addConferenceParticipant({
              conference,
              from: fromLine,
              to: target,
              label: `broker-${who}`,
              endConferenceOnExit: false,
              timeout: 25,
              statusCallback: `${TWILIO_PUBLIC_ORIGIN}/api/voice/sarah-conference`,
            })
            if (!added.ok) return false
            const sarahLeg = await findConferenceParticipantCallSid(conference, 'sarah')
            if (sarahLeg) await setConferenceParticipantMuted(conference, sarahLeg, true)
            return true
          },
      onCallerTurn: async (text) => {
        const turn = evaluateSarahTurn({ visitorText: text, greeted: true })
        if (turn.mode === 'stop-recording' && conference) {
          await stopConferenceRecordings(conference)
        }
        return turn
      },
      onMessage: (m) => deliverReceptionistMessage(callId, from, m),
      onEnd: (lines) => logReceptionistCall(callId, from, lines),
    })
  })
  return NextResponse.json({ ok: true })
}
