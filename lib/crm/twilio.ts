/**
 * CRM Twilio layer (blueprint §5.5) — numbers, inbound routing, send.
 *
 * Numbers model: per-broker local 541 lines + the ported marketing line
 * (541.703.3095, port pending). Inbound SMS routes to the assigned broker of
 * the matching contact; unknown senders become new leads.
 */

import 'server-only'
import crypto from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import type { CrmBrokerSlug } from '@/lib/crm/constants'

export type A2pCampaignStatus = 'VERIFIED' | 'IN_PROGRESS' | 'FAILED' | 'PENDING' | 'NONE' | null

const API = 'https://api.twilio.com/2010-04-01'

function creds(): { sid: string; token: string } | null {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const token = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!sid || !token) return null
  return { sid, token }
}

function authHeader(c: { sid: string; token: string }): string {
  return 'Basic ' + Buffer.from(`${c.sid}:${c.token}`).toString('base64')
}

/**
 * URL Twilio signed for this webhook POST. Must match the configured webhook URL
 * exactly (e.g. ryan-realty.com), not NEXT_PUBLIC_SITE_URL (often vercel.app).
 */
export function twilioWebhookValidationUrl(request: Request): string {
  const u = new URL(request.url)
  return `${u.origin}${u.pathname}`
}

/** Canonical origin for TwiML callbacks wired in Twilio console. */
export const TWILIO_PUBLIC_ORIGIN = 'https://ryan-realty.com'

/** Twilio request signature validation (X-Twilio-Signature, HMAC-SHA1). */
export function validateTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  const c = creds()
  if (!c || !signature) return false
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('')
  const expected = crypto.createHmac('sha1', c.token).update(Buffer.from(data, 'utf8')).digest('base64')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

export function normalizeTo10(v: string | null | undefined): string | null {
  const d = String(v ?? '').replace(/\D/g, '')
  if (d.length >= 10) return d.slice(-10)
  return d || null
}

/** Broker forwarding targets for voice. Env-driven; matt's direct cell is the default. */
export function forwardNumberFor(slug: CrmBrokerSlug | null): string {
  const map: Record<string, string | undefined> = {
    matt: process.env.TWILIO_FORWARD_MATT,
    rebecca: process.env.TWILIO_FORWARD_REBECCA,
    paul: process.env.TWILIO_FORWARD_PAUL,
  }
  return (slug && map[slug]) || process.env.TWILIO_FORWARD_MATT || '+15412136706'
}

export async function lookupPersonByPhone(phone: string): Promise<{ personId: number; name: string | null; broker: CrmBrokerSlug | null } | null> {
  const ten = normalizeTo10(phone)
  if (!ten) return null
  const sb = createServiceClient()
  const { data: pt } = await sb
    .from('crm_contact_points')
    .select('person_id')
    .eq('kind', 'phone')
    .eq('value', ten)
    .limit(1)
    .maybeSingle()
  if (!pt) return null
  const { data: person } = await sb
    .from('crm_people')
    .select('id,name,assigned_broker')
    .eq('id', pt.person_id)
    .maybeSingle()
  if (!person) return null
  return { personId: person.id, name: person.name, broker: (person.assigned_broker as CrmBrokerSlug | null) ?? null }
}

export function toE164(phone: string | null | undefined): string | null {
  const ten = normalizeTo10(phone)
  if (!ten) return null
  return `+1${ten}`
}

export function brokerTwilioNumber(slug: CrmBrokerSlug): string | null {
  const map: Record<CrmBrokerSlug, string | undefined> = {
    matt: process.env.TWILIO_NUMBER_MATT,
    rebecca: process.env.TWILIO_NUMBER_REBECCA,
    paul: process.env.TWILIO_NUMBER_PAUL,
  }
  return map[slug]?.trim() ?? null
}

/** Live A2P 10DLC campaign status for the messaging service (outbound blocked until VERIFIED). */
export async function getA2pCampaignStatus(): Promise<A2pCampaignStatus> {
  const c = creds()
  const ms = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()
  if (!c || !ms) return null
  const res = await fetch(`https://messaging.twilio.com/v1/Services/${ms}/Compliance/Usa2p`, {
    headers: { Authorization: authHeader(c) },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { compliance?: Array<{ campaign_status?: string; status?: string }>; us_app_to_person?: Array<{ campaign_status?: string; status?: string }> }
  const row = (data.compliance ?? data.us_app_to_person ?? [])[0]
  if (!row) return 'NONE'
  const st = row.campaign_status ?? row.status
  if (st === 'VERIFIED' || st === 'IN_PROGRESS' || st === 'FAILED' || st === 'PENDING') return st
  return st as A2pCampaignStatus
}

export function formatTwilioSendError(code: number | string | null | undefined, message: string | null | undefined, a2p: A2pCampaignStatus): string {
  const c = Number(code)
  if (c === 30034 || a2p === 'IN_PROGRESS' || a2p === 'PENDING') {
    return `Outbound SMS is blocked until the Twilio A2P campaign is VERIFIED (current: ${a2p ?? 'unknown'}). Carriers reject texts with error 30034 until carrier approval finishes.`
  }
  if (c === 21610) return 'This number has opted out (STOP). Remove the sms suppression before texting again.'
  return message?.trim() || `Twilio send failed (${code ?? 'unknown'})`
}

async function postMessage(form: URLSearchParams): Promise<{ ok: true; sid: string } | { ok: false; error: string; errorCode?: number }> {
  const c = creds()
  if (!c) return { ok: false, error: 'Twilio not configured' }
  const res = await fetch(`${API}/Accounts/${c.sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: authHeader(c), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  const data = (await res.json()) as { sid?: string; message?: string; error_code?: number; status?: string }
  if (!res.ok || !data.sid) {
    const a2p = await getA2pCampaignStatus()
    return { ok: false, error: formatTwilioSendError(data.error_code, data.message, a2p), errorCode: data.error_code }
  }
  // Twilio accepts then marks undelivered when A2P blocks — poll once for 30034
  if (data.status === 'undelivered' || data.status === 'failed') {
    const a2p = await getA2pCampaignStatus()
    return { ok: false, error: formatTwilioSendError(data.error_code, data.message, a2p), errorCode: data.error_code }
  }
  const detail = await fetch(`${API}/Accounts/${c.sid}/Messages/${data.sid}.json`, { headers: { Authorization: authHeader(c) } })
  if (detail.ok) {
    const msg = (await detail.json()) as { status?: string; error_code?: number; error_message?: string | null }
    if (msg.status === 'undelivered' || msg.status === 'failed') {
      const a2p = await getA2pCampaignStatus()
      return { ok: false, error: formatTwilioSendError(msg.error_code, msg.error_message, a2p), errorCode: msg.error_code }
    }
  }
  return { ok: true, sid: data.sid }
}

/** Send from a specific broker line (direct From number). */
export async function sendSms(params: { from: string; to: string; body: string }): Promise<{ ok: true; sid: string } | { ok: false; error: string }> {
  const to = toE164(params.to)
  if (!to) return { ok: false, error: 'Invalid phone number' }
  const a2p = await getA2pCampaignStatus()
  if (a2p && a2p !== 'VERIFIED') {
    return { ok: false, error: formatTwilioSendError(30034, null, a2p) }
  }
  const form = new URLSearchParams({ From: params.from, To: to, Body: params.body })
  const r = await postMessage(form)
  return r.ok ? r : { ok: false, error: r.error }
}

/** Preferred outbound path — uses the A2P-registered messaging service. */
export async function sendSmsViaMessagingService(params: { to: string; body: string }): Promise<{ ok: true; sid: string } | { ok: false; error: string }> {
  const ms = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()
  if (!ms) return { ok: false, error: 'TWILIO_MESSAGING_SERVICE_SID not configured' }
  const to = toE164(params.to)
  if (!to) return { ok: false, error: 'Invalid phone number' }
  const a2p = await getA2pCampaignStatus()
  if (a2p && a2p !== 'VERIFIED') {
    return { ok: false, error: formatTwilioSendError(30034, null, a2p) }
  }
  const form = new URLSearchParams({ MessagingServiceSid: ms, To: to, Body: params.body })
  const r = await postMessage(form)
  return r.ok ? r : { ok: false, error: r.error }
}

export async function getAccountType(): Promise<'Trial' | 'Full' | null> {
  const c = creds()
  if (!c) return null
  const res = await fetch(`${API}/Accounts/${c.sid}.json`, { headers: { Authorization: authHeader(c) } })
  if (!res.ok) return null
  const data = (await res.json()) as { type?: string }
  return (data.type as 'Trial' | 'Full') ?? null
}
