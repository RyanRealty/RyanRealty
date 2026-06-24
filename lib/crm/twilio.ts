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
import { CRM_BROKERS, type CrmBrokerSlug } from '@/lib/crm/constants'
import { getBrokerTelephony } from '@/lib/data/crm/getBrokerTelephony'

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

/**
 * Whether to enforce Twilio signature validation. Enforce whenever an auth token
 * is configured (ALL environments — production AND preview), unless an explicit
 * local escape hatch is set. This closes the old `NODE_ENV !== 'production'`
 * bypass that left preview/staging webhooks wide open to forged posts.
 */
export function shouldEnforceTwilioSignature(): boolean {
  if (process.env.TWILIO_SKIP_SIG_CHECK === '1') return false
  return Boolean(process.env.TWILIO_AUTH_TOKEN?.trim())
}

/**
 * Parse a Twilio webhook form body and validate its signature in one place.
 * Returns the params on success, or ok:false (→ the route returns 403). Wrapping
 * formData() in try/catch also turns a malformed/empty body into a clean 403
 * instead of an unhandled 500.
 */
export async function verifiedTwilioParams(
  request: Request,
): Promise<{ ok: true; params: Record<string, string> } | { ok: false }> {
  let params: Record<string, string> = {}
  try {
    const form = await request.formData()
    for (const [k, v] of form.entries()) params[k] = String(v)
  } catch {
    return { ok: false }
  }
  if (shouldEnforceTwilioSignature()) {
    const url = twilioWebhookValidationUrl(request)
    const signature = request.headers.get('x-twilio-signature')
    if (!validateTwilioSignature(url, params, signature)) return { ok: false }
  }
  return { ok: true, params }
}

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

/**
 * The brokerage brand/marketing line (541.703.3095, ported from FUB into Twilio).
 * Inbound to this line has no single broker owner — it routes to the default desk.
 * Overridable via TWILIO_NUMBER_MARKETING.
 */
export const MARKETING_NUMBER = (process.env.TWILIO_NUMBER_MARKETING || '+15417033095').trim()

/** Default desk for the shared marketing line + the no-forward-resolved fallback. */
export const DEFAULT_DESK_BROKER: CrmBrokerSlug = 'matt'

function envTwilioNumber(slug: CrmBrokerSlug): string | undefined {
  return { matt: process.env.TWILIO_NUMBER_MATT, rebecca: process.env.TWILIO_NUMBER_REBECCA, paul: process.env.TWILIO_NUMBER_PAUL }[slug]?.trim()
}
function envForward(slug: CrmBrokerSlug): string | undefined {
  return { matt: process.env.TWILIO_FORWARD_MATT, rebecca: process.env.TWILIO_FORWARD_REBECCA, paul: process.env.TWILIO_FORWARD_PAUL }[slug]?.trim()
}

/**
 * Reverse-map a DIALED Twilio number (params.To) to the broker who owns that
 * line. This is the basis of "each business number forwards to that broker's
 * cell": route by the line the caller dialed, not by the caller's prior
 * assignment. DB telephony is the source of truth, env is the fallback. Returns
 * null for the shared marketing line or an unrecognized number — the caller then
 * picks DEFAULT_DESK_BROKER (or the caller's existing assignment).
 */
export async function brokerForTwilioNumber(toRaw: string | null | undefined): Promise<CrmBrokerSlug | null> {
  const ten = normalizeTo10(toRaw)
  if (!ten) return null
  if (normalizeTo10(MARKETING_NUMBER) === ten) return null // shared line, no single owner
  try {
    const tel = await getBrokerTelephony()
    if (tel.byTwilioLast10[ten]) return tel.byTwilioLast10[ten]
  } catch { /* fall through to env */ }
  for (const slug of CRM_BROKERS) {
    if (normalizeTo10(envTwilioNumber(slug)) === ten) return slug
  }
  return null
}

/**
 * Personal cell a broker's line forwards to. DB source of truth, env fallback,
 * default-desk fallback (env), then null. No hardcoded literal — an unresolved
 * forward returns null so the caller routes to voicemail and logs a config error
 * instead of silently misrouting to a baked-in cell.
 */
export async function forwardCellForBroker(slug: CrmBrokerSlug | null): Promise<string | null> {
  let tel: Awaited<ReturnType<typeof getBrokerTelephony>> | null = null
  try { tel = await getBrokerTelephony() } catch { tel = null }
  if (slug) {
    const c = tel?.bySlug[slug]?.forwardToCell ?? envForward(slug)
    if (c) return c
  }
  // default desk (env value, not a hardcoded number)
  return tel?.bySlug[DEFAULT_DESK_BROKER]?.forwardToCell ?? envForward(DEFAULT_DESK_BROKER) ?? null
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

/** A broker's public Twilio business line (E.164). DB source of truth, env fallback. */
export async function brokerTwilioNumber(slug: CrmBrokerSlug): Promise<string | null> {
  try {
    const tel = await getBrokerTelephony()
    const n = tel.bySlug[slug]?.twilioNumber
    if (n) return n
  } catch { /* fall through to env */ }
  return envTwilioNumber(slug) ?? null
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

/**
 * Click-to-call: ring the broker's own cell first (toCell), and when they answer
 * Twilio fetches bridgeUrl for TwiML that dials the lead and records the
 * conversation. From is the broker's Twilio business line (caller ID + A2P/10DLC
 * brand). Returns the parent Call SID — the same SID the recording webhook
 * reports, so the pre-inserted timeline row matches on `twilio:call:<sid>:p<id>`.
 */
export async function startOutboundCall(params: {
  toCell: string
  fromNumber: string
  bridgeUrl: string
}): Promise<{ ok: true; sid: string } | { ok: false; error: string }> {
  const c = creds()
  if (!c) return { ok: false, error: 'Twilio not configured' }
  const to = toE164(params.toCell)
  const from = toE164(params.fromNumber)
  if (!to || !from) return { ok: false, error: 'Broker phone not configured' }
  const form = new URLSearchParams({ To: to, From: from, Url: params.bridgeUrl, Method: 'POST' })
  const res = await fetch(`${API}/Accounts/${c.sid}/Calls.json`, {
    method: 'POST',
    headers: { Authorization: authHeader(c), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  const data = (await res.json()) as { sid?: string; message?: string }
  if (!res.ok || !data.sid) return { ok: false, error: data.message?.trim() || `Twilio call failed (${res.status})` }
  return { ok: true, sid: data.sid }
}

export async function getAccountType(): Promise<'Trial' | 'Full' | null> {
  const c = creds()
  if (!c) return null
  const res = await fetch(`${API}/Accounts/${c.sid}.json`, { headers: { Authorization: authHeader(c) } })
  if (!res.ok) return null
  const data = (await res.json()) as { type?: string }
  return (data.type as 'Trial' | 'Full') ?? null
}
