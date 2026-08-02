/**
 * lib/agent/send.ts — the ONLY sender the broker SMS agent uses.
 *
 * docs/plans/BROKER_SMS_AGENT_2026-07-31.md R1.2 + lib/agent/types.ts invariant:
 * "The agent NEVER messages anyone but a registered broker cell." This module
 * is deliberately single-purpose (one function, one whitelist check, one call
 * into lib/crm/twilio) so scripts/check-broker-agent-send-safety.mjs (R5.3) can
 * AST-verify (a) this file builds + applies the whitelist and (b) no other
 * module in the agent tree calls sendSms/sendSmsViaMessagingService directly.
 *
 * Whitelist = DB brokers.forward_to_cell (getBrokerTelephony, live source of
 * truth) UNION the TWILIO_FORWARD_* env vars (resilience fallback — same
 * union pattern as lib/crm/alert-drain-core's brokerPhoneSet, generalized to
 * also read the DB). No quiet-hours gate: every recipient here is an internal
 * broker, not a lead/client (quiet hours exist to protect consumers).
 */

import { sendSms, MARKETING_NUMBER } from '@/lib/crm/twilio'
import { getBrokerTelephony } from '@/lib/data/crm/getBrokerTelephony'
import { last10 } from '@/lib/crm/alert-drain-core'

export interface SendAgentSmsParams {
  to: string
  body: string
  mediaUrls?: string[]
}

export type SendAgentSmsResult = { ok: true; sid: string } | { ok: false; error: string }

/**
 * Build the broker-cell whitelist: DB forward_to_cell (source of truth) union
 * the TWILIO_FORWARD_MATT/REBECCA/PAUL env vars (fallback when the DB is
 * unreachable or a cell hasn't been backfilled yet). Normalized to last-10
 * digit strings so `+15417033095`, `15417033095`, and `5417033095` all match.
 */
export async function getBrokerCellWhitelist(): Promise<Set<string>> {
  const whitelist = new Set<string>()

  try {
    const tel = await getBrokerTelephony()
    for (const entry of Object.values(tel.bySlug)) {
      const key = last10(entry?.forwardToCell)
      if (key) whitelist.add(key)
    }
  } catch {
    // DB unreachable — fall through to the env union below rather than
    // failing the whitelist build entirely.
  }

  for (const v of [
    process.env.TWILIO_FORWARD_MATT,
    process.env.TWILIO_FORWARD_REBECCA,
    process.env.TWILIO_FORWARD_PAUL,
  ]) {
    const key = last10(v)
    if (key) whitelist.add(key)
  }

  return whitelist
}

/** True only when `phone` normalizes to a last-10 digit string present in `whitelist`. */
export function isBrokerCell(phone: string | null | undefined, whitelist: Set<string>): boolean {
  const key = last10(phone)
  return key.length === 10 && whitelist.has(key)
}

/**
 * Send an agent reply to a broker's cell. Sends from MARKETING_NUMBER (the
 * line brokers text the agent on) via the shared lib/crm/twilio sendSms
 * (MessagingServiceSid + From together, A2P fail-closed, never retries).
 *
 * HARD WHITELIST: throws (never sends) unless `to` resolves to a registered
 * broker cell. This is the mechanical guarantee — DONE item 6, §1 amendment —
 * that the agent cannot text a client, lead, or prospect no matter what a
 * model turn decides to do.
 */
export async function sendAgentSms(params: SendAgentSmsParams): Promise<SendAgentSmsResult> {
  const whitelist = await getBrokerCellWhitelist()
  if (!isBrokerCell(params.to, whitelist)) {
    throw new Error(`sendAgentSms: refusing to send — "${params.to}" is not a registered broker cell`)
  }
  return sendSms({ from: MARKETING_NUMBER, to: params.to, body: params.body, mediaUrls: params.mediaUrls })
}
