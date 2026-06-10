/**
 * CRM Twilio layer (blueprint §5.5) — numbers, inbound routing, send.
 *
 * Numbers model: per-broker local 541 lines + the ported marketing line
 * (541.703.3095, port pending). Inbound SMS routes to the assigned broker of
 * the matching contact; unknown senders become new leads.
 */

import crypto from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import type { CrmBrokerSlug } from '@/lib/crm/constants'

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

export async function sendSms(params: { from: string; to: string; body: string }): Promise<{ ok: true; sid: string } | { ok: false; error: string }> {
  const c = creds()
  if (!c) return { ok: false, error: 'Twilio not configured' }
  const form = new URLSearchParams({ From: params.from, To: params.to, Body: params.body })
  const res = await fetch(`${API}/Accounts/${c.sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: authHeader(c), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  const data = (await res.json()) as { sid?: string; message?: string }
  if (!res.ok || !data.sid) return { ok: false, error: data.message ?? `HTTP ${res.status}` }
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
