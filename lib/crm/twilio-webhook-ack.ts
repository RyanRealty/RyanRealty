/**
 * Fast Twilio inbound ack (AGENTS.md — Twilio inbound ack).
 *
 * Validate signature → one 2s raw insert → TwiML/200. CRM, timeline, and
 * STOP/START/HELP writes run after the response via after() (Vercel waitUntil)
 * or /api/cron/twilio-webhook-replay. Founding case: 11200/11203 on
 * SM872130d80ef66b91a9a3f1bd837eb53e when Supabase was slow.
 */

import { after, NextResponse } from 'next/server'
import { verifiedTwilioParams } from '@/lib/crm/twilio'
import {
  insertTwilioRawEvent,
  claimTwilioRawEvent,
  markTwilioRawEventProcessed,
  markTwilioRawEventError,
  listUnprocessedTwilioRawEvents,
  type TwilioWebhookKind,
} from '@/lib/data/crm/twilioRawEvents'

export const TWILIO_ACK_DEADLINE_MS = 5_000
export const TWILIO_RAW_PERSIST_MS = 2_000

export const STOP_WORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit'])
export const START_WORDS = new Set(['start', 'unstop', 'yes', 'resubscribe'])
export const HELP_WORDS = new Set(['help', 'info'])

export const SMS_HELP_REPLY =
  'Ryan Realty. Reply STOP to opt out. Msg and data rates may apply. For help visit ryan-realty.com/contact.'
export const SMS_STOP_REPLY =
  'You have been unsubscribed and will not receive further texts. Reply START to resubscribe.'
export const SMS_START_REPLY = 'You are resubscribed and will receive texts again. Reply STOP to opt out.'

export type TwilioProcessFn = (params: Record<string, string>) => Promise<void>

const scheduledForTests: Array<() => Promise<void>> = []

export function smsFirstToken(body: string | undefined): string {
  return (body ?? '').trim().toLowerCase().split(/\s+/)[0] ?? ''
}

export function smsKeywordReply(body: string | undefined): string | undefined {
  const token = smsFirstToken(body)
  if (HELP_WORDS.has(token)) return SMS_HELP_REPLY
  if (STOP_WORDS.has(token)) return SMS_STOP_REPLY
  if (START_WORDS.has(token)) return SMS_START_REPLY
  return undefined
}

export function providerSidFor(kind: TwilioWebhookKind, params: Record<string, string>): string {
  if (kind === 'inbound-sms') return params.MessageSid?.trim() || `unknown-sms-${Date.now()}`
  if (kind === 'recording') return params.RecordingSid?.trim() || params.CallSid?.trim() || `unknown-rec-${Date.now()}`
  return params.CallSid?.trim() || `unknown-call-${Date.now()}`
}

function fallbackLog(kind: TwilioWebhookKind, providerSid: string, payload: Record<string, string>, error: string): void {
  console.error(
    '[twilio-raw-event-fallback]',
    JSON.stringify({ kind, providerSid, error, at: new Date().toISOString(), payload }),
  )
}

/**
 * Keep CRM work alive after the TwiML/200 goes out. after() is Next's
 * waitUntil. A missing request context (tests) no-ops — callers that need
 * the work in-process call the processor directly.
 */
export async function withAckBudget<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function scheduleAfterAck(work: () => Promise<void>): void {
  const run = () =>
    work().catch((err) => {
      console.error('[twilio-webhook] after-ack failed', err)
    })
  try {
    after(run)
    return
  } catch {
    /* no Next request context */
  }
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
    scheduledForTests.push(run)
    return
  }
  void run()
}

export function clearScheduledAckWork(): void {
  scheduledForTests.splice(0, scheduledForTests.length)
}

export async function flushScheduledAckWork(): Promise<void> {
  const pending = scheduledForTests.splice(0, scheduledForTests.length)
  await Promise.allSettled(pending.map((fn) => fn()))
}

export async function persistTwilioRawEvent(input: {
  kind: TwilioWebhookKind
  providerSid: string
  payload: Record<string, string>
}): Promise<{ persisted: boolean; id?: number }> {
  const result = await insertTwilioRawEvent(input)
  if (result.ok) return { persisted: true, id: result.id }
  fallbackLog(input.kind, input.providerSid, input.payload, result.error)
  return { persisted: false }
}

export async function ackTwilioWebhook(args: {
  request: Request
  kind: TwilioWebhookKind
  process: TwilioProcessFn
  respond: (params: Record<string, string>) => Response | Promise<Response>
}): Promise<Response> {
  const verified = await verifiedTwilioParams(args.request)
  if (!verified.ok) return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  const params = verified.params
  const providerSid = providerSidFor(args.kind, params)
  const persisted = await withAckBudget(
    persistTwilioRawEvent({ kind: args.kind, providerSid, payload: params }),
    TWILIO_RAW_PERSIST_MS + 250,
    { persisted: false },
  )
  scheduleAfterAck(() =>
    replayTwilioRawEvent({
      kind: args.kind,
      providerSid,
      params,
      process: args.process,
      rawEventId: persisted.id,
    }),
  )
  return args.respond(params)
}

export async function replayTwilioRawEvent(input: {
  kind: TwilioWebhookKind
  providerSid: string
  params: Record<string, string>
  process: TwilioProcessFn
  rawEventId?: number
}): Promise<{ ran: boolean; reason: string }> {
  const id = input.rawEventId
  if (id != null) {
    const claimed = await claimTwilioRawEvent(id)
    if (!claimed) return { ran: false, reason: 'already-claimed-or-processed' }
  }
  try {
    await input.process(input.params)
    if (id != null) await markTwilioRawEventProcessed(id)
    return { ran: true, reason: 'processed' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (id != null) await markTwilioRawEventError(id, message)
    console.error('[twilio-webhook] process failed', input.kind, input.providerSid, err)
    return { ran: false, reason: message }
  }
}

export type TwilioProcessRegistry = Partial<Record<TwilioWebhookKind, TwilioProcessFn>>

export async function replayUnprocessedTwilioRawEvents(
  processors: TwilioProcessRegistry,
  limit = 25,
): Promise<{ scanned: number; ran: number; skipped: number }> {
  const rows = await listUnprocessedTwilioRawEvents(limit)
  let ran = 0
  let skipped = 0
  for (const row of rows) {
    const process = processors[row.kind]
    if (!process) {
      skipped += 1
      continue
    }
    const result = await replayTwilioRawEvent({
      kind: row.kind,
      providerSid: row.provider_sid,
      params: row.payload,
      process,
      rawEventId: row.id,
    })
    if (result.ran) ran += 1
    else skipped += 1
  }
  return { scanned: rows.length, ran, skipped }
}
