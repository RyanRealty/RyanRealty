/**
 * Immediate broker-to-self SMS on the live site path.
 *
 * Used when a broker taps "Text me this CMA". Sends NOW via the Twilio
 * Messaging Service (same rail as /api/cron/crm-alert-drain). Does not wait
 * for the Mac mini relay. Does not use AppleScript. Does not accept a
 * destination phone from the caller — only the broker whitelist.
 *
 * Lead / homeowner SMS stays on sendGovernedSms + A2P. This module must never
 * be imported from the sequence engine.
 */

import 'server-only'
import { brokerPhoneSet, isBrokerPhone, last10, toE164 } from '@/lib/crm/alert-drain-core'
import { getBrokerTelephony } from '@/lib/data/crm/getBrokerTelephony'
import { insertBrokerSelfAlert } from '@/lib/data/crm/brokerSelfAlert'
import {
  cmaBrokerSelfTextBody,
  collectCmaClientPhones,
  refuseIfClientDestination,
  resolveBrokerSelfPhone,
} from '@/lib/crm/cma-broker-self-text'

const API = 'https://api.twilio.com/2010-04-01'

export type BrokerSelfSmsResult = { ok: true; to: string } | { ok: false; error: string }

function envForwardByBroker(): Record<string, string | undefined> {
  return {
    matt: process.env.TWILIO_FORWARD_MATT?.trim(),
    rebecca: process.env.TWILIO_FORWARD_REBECCA?.trim(),
    paul: process.env.TWILIO_FORWARD_PAUL?.trim(),
  }
}

function envWhitelist(extraCells: Array<string | null | undefined> = []): Set<string> {
  const set = brokerPhoneSet({
    TWILIO_FORWARD_MATT: process.env.TWILIO_FORWARD_MATT,
    TWILIO_FORWARD_REBECCA: process.env.TWILIO_FORWARD_REBECCA,
    TWILIO_FORWARD_PAUL: process.env.TWILIO_FORWARD_PAUL,
  })
  for (const cell of extraCells) {
    const key = last10(cell)
    if (key.length === 10) set.add(key)
  }
  return set
}

async function brokerSelfWhitelist(): Promise<Set<string>> {
  const tel = await getBrokerTelephony()
  return envWhitelist([
    tel.bySlug.matt?.forwardToCell,
    tel.bySlug.rebecca?.forwardToCell,
    tel.bySlug.paul?.forwardToCell,
  ])
}

export async function resolveActingBrokerPhone(broker: string): Promise<BrokerSelfSmsResult> {
  const tel = await getBrokerTelephony()
  const envPhones = envForwardByBroker()
  const row = tel.bySlug[broker] ?? tel.bySlug.matt
  const phonesByBroker: Record<string, string | undefined> = {
    matt: envPhones.matt ?? tel.bySlug.matt?.forwardToCell ?? undefined,
    rebecca: envPhones.rebecca ?? tel.bySlug.rebecca?.forwardToCell ?? undefined,
    paul: envPhones.paul ?? tel.bySlug.paul?.forwardToCell ?? undefined,
  }
  if (row?.forwardToCell && !phonesByBroker[broker]) {
    phonesByBroker[broker] = row.forwardToCell
  }
  return resolveBrokerSelfPhone({
    broker,
    phonesByBroker,
    whitelist: envWhitelist([
      tel.bySlug.matt?.forwardToCell,
      tel.bySlug.rebecca?.forwardToCell,
      tel.bySlug.paul?.forwardToCell,
    ]),
  })
}

/**
 * Twilio Messaging Service POST for an already-whitelisted broker cell.
 * Mirrors the serverless drain — not the lead A2P helper — so a broker-to-self
 * tap is not stuck behind CRM_SMS_ALERTS or the Mac mini.
 */
export async function sendWhitelistedBrokerSms(params: {
  to: string
  body: string
}): Promise<BrokerSelfSmsResult> {
  const whitelist = await brokerSelfWhitelist()
  if (!isBrokerPhone(params.to, whitelist)) {
    return { ok: false, error: 'Refused: destination is not a broker line.' }
  }
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const token = process.env.TWILIO_AUTH_TOKEN?.trim()
  const serviceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()
  if (!sid || !token || !serviceSid) {
    return { ok: false, error: 'Twilio is not configured on this site.' }
  }
  const form = new URLSearchParams({
    To: toE164(params.to),
    MessagingServiceSid: serviceSid,
    Body: params.body,
  })
  try {
    const res = await fetch(`${API}/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    })
    const data = (await res.json()) as { sid?: string; message?: string }
    if (!res.ok || !data.sid) {
      return { ok: false, error: data.message?.trim() || `Twilio send failed (${res.status})` }
    }
    return { ok: true, to: toE164(params.to) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Twilio send failed' }
  }
}

export async function sendCmaReviewLinkToBroker(params: {
  slug: string
  subjectAddress: string | null
  broker: string
  clientPhones: Array<string | null | undefined>
}): Promise<{ error: string | null }> {
  const dest = await resolveActingBrokerPhone(params.broker)
  if (!dest.ok) return { error: dest.error }
  const guard = refuseIfClientDestination({
    to: dest.to,
    clientPhones: params.clientPhones,
    whitelist: await brokerSelfWhitelist(),
  })
  if (!guard.ok) return { error: guard.error }

  const body = cmaBrokerSelfTextBody({
    slug: params.slug,
    subjectAddress: params.subjectAddress,
  })
  const sent = await sendWhitelistedBrokerSms({ to: dest.to, body })
  try {
    await insertBrokerSelfAlert({
      broker: params.broker || 'matt',
      toPhone: dest.to,
      body,
      status: sent.ok ? 'sent' : 'failed',
      error: sent.ok ? null : sent.error,
    })
  } catch (err) {
    console.error('[sendCmaReviewLinkToBroker] audit row', err)
  }
  return sent.ok ? { error: null } : { error: sent.error }
}

export function clientPhonesFromCmaRow(row: Record<string, unknown> | null | undefined): Array<string | null> {
  if (!row) return []
  return collectCmaClientPhones(row)
}
