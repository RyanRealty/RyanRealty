/**
 * /api/cron/twilio-webhook-replay — drain unprocessed twilio_webhook_raw_events.
 *
 * Replays inbound SMS / voice / voicemail / recording rows that were persisted
 * but not processed (persist succeeded, after() died, or recording's call/vm
 * row was not ready). Idempotent on MessageSid / CallSid / RecordingSid.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} (requireCronAuth).
 * Schedule: vercel.json — every 2 minutes.
 */

import { NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { replayUnprocessedTwilioRawEvents } from '@/lib/crm/twilio-webhook-ack'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const [{ processInboundSms }, { processVoiceInbound }, { processVoiceComplete }, { processRecording }] =
    await Promise.all([
      import('@/app/api/twilio/inbound-sms/route'),
      import('@/app/api/twilio/voice/route'),
      import('@/app/api/twilio/voice-complete/route'),
      import('@/app/api/twilio/recording/route'),
    ])

  const result = await replayUnprocessedTwilioRawEvents(
    {
      'inbound-sms': processInboundSms,
      voice: processVoiceInbound,
      'voice-complete': processVoiceComplete,
      recording: processRecording,
    },
    25,
  )
  return NextResponse.json({ ok: true, ...result })
}

export const POST = GET
