import 'server-only'

/**
 * The optional text-message code before a signer opens the documents (Matt
 * 2026-09-24: "Email link, text code optional"). The broker switches it on per
 * envelope; the code goes to the signer's phone through Twilio Verify, which
 * sends from its own verified sender, so one-time codes never ride the A2P
 * marketing campaign the brokerage lines are registered under.
 *
 * A passed check is remembered for 12 hours in an HttpOnly cookie bound to
 * the recipient and the link (an HMAC of both with the expiry), so a
 * forwarded link alone still asks for the code on a new phone.
 *
 * The Verify service provisions itself: with the brokerage's Twilio account
 * configured, the first code finds (or creates) the "Ryan Realty" Verify
 * service and remembers its id. TWILIO_VERIFY_SERVICE_SID pins one instead.
 */
import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto'
import { toE164 } from '@/lib/crm/twilio'

const VERIFIED_FOR_MS = 12 * 60 * 60 * 1000

function key(): Buffer {
  const secret = process.env.SIGNING_TOKEN_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!secret) throw new Error('No signing secret configured')
  return Buffer.from(hkdfSync('sha256', secret, 'rr-sign-verify', 'rr-sign-verify-v1', 32))
}

export function verifyCookieName(recipientId: string): string {
  return `rr_sv_${recipientId.replace(/[^a-f0-9]/gi, '').slice(0, 32)}`
}

function mac(recipientId: string, tokenHash: string, exp: number): string {
  return createHmac('sha256', key()).update(`${recipientId}.${tokenHash}.${exp}`).digest('base64url')
}

export function signVerifyCookie(recipientId: string, tokenHash: string, now: Date = new Date()): { value: string; maxAge: number } {
  const exp = now.getTime() + VERIFIED_FOR_MS
  return { value: `${exp}.${mac(recipientId, tokenHash, exp)}`, maxAge: Math.floor(VERIFIED_FOR_MS / 1000) }
}

export function verifyCookieIsValid(value: string | null | undefined, recipientId: string, tokenHash: string, now: Date = new Date()): boolean {
  if (!value) return false
  const [expRaw, sig] = value.split('.')
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp < now.getTime() || !sig) return false
  const want = Buffer.from(mac(recipientId, tokenHash, exp))
  const got = Buffer.from(sig)
  return want.length === got.length && timingSafeEqual(want, got)
}

/** 5415551234 → (•••) •••-1234: enough to recognize, not enough to copy. */
export function maskPhone(phone: string | null | undefined): string | null {
  const e164 = toE164(phone)
  return e164 ? `(•••) •••-${e164.slice(-4)}` : null
}

export function textCodesConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim())
}

/** What the code text names as its sender ("Your Ryan Realty verification code is: …"). */
export const VERIFY_SERVICE_NAME = 'Ryan Realty'

function twilioAuth(): string | null {
  const account = process.env.TWILIO_ACCOUNT_SID?.trim()
  const auth = process.env.TWILIO_AUTH_TOKEN?.trim()
  return account && auth ? `Basic ${Buffer.from(`${account}:${auth}`).toString('base64')}` : null
}

async function twilioJson(url: string, auth: string, form?: Record<string, string>): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: form ? 'POST' : 'GET',
    headers: { Authorization: auth, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    ...(form ? { body: new URLSearchParams(form).toString() } : {}),
    cache: 'no-store',
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, status: res.status, body }
}

let cachedServiceSid: Promise<string | null> | null = null

/** The Verify service id: pinned by env, else found or created once per server. */
export function verifyServiceSid(): Promise<string | null> {
  const pinned = process.env.TWILIO_VERIFY_SERVICE_SID?.trim()
  if (pinned) return Promise.resolve(pinned)
  const auth = twilioAuth()
  if (!auth) return Promise.resolve(null)
  if (!cachedServiceSid) {
    cachedServiceSid = (async () => {
      const list = await twilioJson('https://verify.twilio.com/v2/Services?PageSize=50', auth)
      const services = (list.ok && Array.isArray(list.body.services) ? list.body.services : []) as Array<{ sid?: string; friendly_name?: string }>
      const found = services.find((svc) => svc.friendly_name === VERIFY_SERVICE_NAME && svc.sid)
      if (found?.sid) return found.sid
      const made = await twilioJson('https://verify.twilio.com/v2/Services', auth, { FriendlyName: VERIFY_SERVICE_NAME, CodeLength: '6' })
      return made.ok && typeof made.body.sid === 'string' ? made.body.sid : null
    })().catch(() => null)
    // A failed lookup is retried on the next code, not remembered.
    void cachedServiceSid.then((sid) => {
      if (!sid) cachedServiceSid = null
    })
  }
  return cachedServiceSid
}

async function verifyApi(path: 'Verifications' | 'VerificationCheck', form: Record<string, string>): Promise<{ ok: boolean; status?: string; error?: string }> {
  const auth = twilioAuth()
  if (!auth) return { ok: false, error: 'Text codes are not set up yet.' }
  try {
    const sid = await verifyServiceSid()
    if (!sid) return { ok: false, error: 'We could not reach the text service. Try again in a minute.' }
    const r = await twilioJson(`https://verify.twilio.com/v2/Services/${encodeURIComponent(sid)}/${path}`, auth, form)
    if (!r.ok) return { ok: false, error: typeof r.body.message === 'string' ? r.body.message : `Twilio Verify ${r.status}` }
    return { ok: true, status: typeof r.body.status === 'string' ? r.body.status : undefined }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Text a code to the signer's phone. */
export async function startTextCode(phone: string): Promise<{ ok: boolean; error?: string }> {
  const to = toE164(phone)
  if (!to) return { ok: false, error: 'No mobile number on file for you. Call your broker.' }
  const r = await verifyApi('Verifications', { To: to, Channel: 'sms' })
  return r.ok ? { ok: true } : { ok: false, error: r.error }
}

/** Whether the code the signer typed is the one sent. */
export async function checkTextCode(phone: string, code: string): Promise<boolean> {
  const to = toE164(phone)
  if (!to || !/^\d{4,10}$/.test(code.trim())) return false
  const r = await verifyApi('VerificationCheck', { To: to, Code: code.trim() })
  return r.ok && r.status === 'approved'
}
