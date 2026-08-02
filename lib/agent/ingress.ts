/**
 * lib/agent/ingress.ts — broker SMS agent inbound entry point.
 *
 * docs/plans/BROKER_SMS_AGENT_2026-07-31.md R1.2 + Amendment R1.2 (debounce).
 *
 * Called from app/api/twilio/inbound-sms/route.ts ONLY once the route has
 * already established: sender is a registered broker's forward cell, the
 * dialed number is the shared marketing line, and BROKER_SMS_AGENT_ENABLED is
 * 'true'. Non-broker senders and a broker cell texting their OWN business
 * line never reach this module — that branch point lives in the route.
 *
 * handleAgentInbound() is the fast, webhook-safe half: resolve which broker
 * owns the cell, check that broker's pilot flag, resolve/create the session,
 * persist the inbound turn (deduped on Twilio MessageSid). It never calls the
 * model and never sends a reply, so the route can return TwiML inside
 * Twilio's ~15s window regardless of which branch fires.
 *
 * processAfterDebounce() is the slow half. The route schedules it via
 * next/server `after()` — it must never be awaited inline by the webhook.
 * Contract: sleep 20s (real people text in bursts — Amendment R1.2), then
 * check whether this call's MessageSid is STILL the latest unprocessed
 * inbound turn for the session. If not, a later webhook's debounce window
 * owns the aggregated turn and this one exits quietly (no double reply, no
 * double model call). If so, aggregate every unprocessed inbound turn's text
 * (oldest first, newline-joined) + media, mark them all processed, run the
 * model turn, persist the agent's reply turn, and text it back. On any
 * failure the agent still replies — per lib/agent/types.ts and DONE item 7,
 * it never goes silent.
 */

import { getBrokerTelephony } from '@/lib/data/crm/getBrokerTelephony'
import { toE164 } from '@/lib/crm/twilio'
import { last10 } from '@/lib/crm/alert-drain-core'
import { CRM_BROKERS, CRM_BROKER_BY_EMAIL, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import { isAgentEnabledForBroker } from '@/lib/data/agent/broker-agent-flags'
import { insertInboundTurn, listUnprocessedInbound, markTurnsProcessed, insertAgentTurn } from '@/lib/data/agent/turn-intake'
import { sendAgentSms } from '@/lib/agent/send'
import { resolveAgentSession } from '@/lib/agent/session'
import { runAgentTurn } from '@/lib/agent/runtime'
import type { AgentContext, BrokerSlug } from '@/lib/agent/types'

/** Amendment R1.2 — real people text in bursts; 3 rapid texts are one request. */
const DEBOUNCE_MS = 20_000

const EMAIL_BY_BROKER_SLUG: Partial<Record<BrokerSlug, string>> = (() => {
  const out: Partial<Record<BrokerSlug, string>> = {}
  for (const [email, slug] of Object.entries(CRM_BROKER_BY_EMAIL)) {
    out[slug as BrokerSlug] = email
  }
  return out
})()

/** Which broker owns this cell? DB forward_to_cell first, env fallback —
 *  same source pair as lib/agent/send.ts's whitelist, but keyed to identity
 *  rather than a yes/no. */
async function resolveBrokerSlugForCell(phone: string): Promise<BrokerSlug | null> {
  const ten = last10(phone)
  if (!ten) return null
  try {
    const tel = await getBrokerTelephony()
    for (const slug of CRM_BROKERS) {
      const cell = tel.bySlug[slug]?.forwardToCell
      if (cell && last10(cell) === ten) return slug
    }
  } catch {
    // fall through to env
  }
  const envBySlug: Record<BrokerSlug, string | undefined> = {
    matt: process.env.TWILIO_FORWARD_MATT,
    rebecca: process.env.TWILIO_FORWARD_REBECCA,
    paul: process.env.TWILIO_FORWARD_PAUL,
  }
  for (const slug of CRM_BROKERS) {
    if (last10(envBySlug[slug]) === ten) return slug
  }
  return null
}

export interface HandleAgentInboundParams {
  from: string
  to: string
  body: string
  messageSid: string
  mediaUrls?: string[]
}

export type AgentIngressResult =
  /** Not a recognized broker cell, or that broker's pilot flag is off — the
   *  route falls through to the pre-agent silent drop, unchanged. */
  | { status: 'not-agent' }
  /** Twilio redelivered a webhook already recorded (message_sid unique index). */
  | { status: 'duplicate' }
  /** Turn persisted — the route schedules processAfterDebounce via after(). */
  | { status: 'queued'; sessionId: string; messageSid: string; ctx: AgentContext }

export async function handleAgentInbound(params: HandleAgentInboundParams): Promise<AgentIngressResult> {
  const brokerSlug = await resolveBrokerSlugForCell(params.from)
  if (!brokerSlug) return { status: 'not-agent' }

  const enabled = await isAgentEnabledForBroker(brokerSlug)
  if (!enabled) return { status: 'not-agent' }

  const session = await resolveAgentSession(brokerSlug)

  const inserted = await insertInboundTurn({
    sessionId: session.id,
    brokerSlug,
    messageSid: params.messageSid,
    body: params.body,
    mediaUrls: params.mediaUrls,
  })
  if (inserted.duplicate) return { status: 'duplicate' }

  const ctx: AgentContext = {
    brokerSlug,
    brokerEmail: EMAIL_BY_BROKER_SLUG[brokerSlug] ?? '',
    brokerDisplayName: CRM_BROKER_DISPLAY[brokerSlug],
    sessionId: session.id,
    brokerCell: toE164(params.from) ?? params.from,
  }

  return { status: 'queued', sessionId: session.id, messageSid: params.messageSid, ctx }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Scheduled via `after()` from the route — never awaited inline. See module
 * doc for the full debounce contract.
 */
export async function processAfterDebounce(sessionId: string, messageSid: string, ctx: AgentContext): Promise<void> {
  await sleep(DEBOUNCE_MS)

  try {
    const unprocessed = await listUnprocessedInbound(sessionId)
    if (unprocessed.length === 0) return // another invocation already claimed + processed these

    const latest = unprocessed[unprocessed.length - 1]
    if (latest.messageSid !== messageSid) {
      // A later webhook's debounce window is still running and owns the
      // aggregated turn (it will see this message too, since it hasn't been
      // marked processed yet) — this earlier invocation exits quietly.
      return
    }

    const aggregatedText = unprocessed.map((t) => t.text).filter(Boolean).join('\n')
    const aggregatedMedia = unprocessed.flatMap((t) => t.mediaUrls)

    // Mark processed BEFORE the model call: if runAgentTurn throws, the catch
    // below still sends an honest failure text without reprocessing these
    // turns on a broker retry (a fresh text opens a fresh debounce window).
    await markTurnsProcessed(unprocessed.map((t) => t.id))

    const result = await runAgentTurn(ctx, aggregatedText, aggregatedMedia.length ? aggregatedMedia : undefined)

    await insertAgentTurn({
      sessionId,
      role: 'agent',
      content: { text: result.reply.text, mediaUrls: result.reply.mediaUrls ?? [] },
      citations: result.citations,
      costUsd: result.costUsd,
    })

    const sent = await sendAgentSms({ to: ctx.brokerCell, body: result.reply.text, mediaUrls: result.reply.mediaUrls })
    if (!sent.ok) console.error('[agent/ingress] reply send failed', sent.error)
  } catch (err) {
    console.error('[agent/ingress] processAfterDebounce failed', err)
    try {
      await sendAgentSms({
        to: ctx.brokerCell,
        body: 'Hit an error working on that. Try again, or text STATUS.',
      })
    } catch (sendErr) {
      console.error('[agent/ingress] failure-notice send also failed', sendErr)
    }
  }
}
