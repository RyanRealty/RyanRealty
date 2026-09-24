'use server'

import { cookies, headers } from 'next/headers'
import { earlierSigningGroupPending, hashSigningToken, type EnvelopeField, type SignFieldValue } from '@/lib/tc/signing'
import { advanceOrSeal } from '@/lib/tc/seal-envelope'
import { ANNOTATION_TYPES, checkSubmission, fieldOwner, valueIsFilled } from '@/lib/tc/field-rules'
import { ESIGN_CONSENT_VERSION } from '@/lib/tc/esign-consent'
import { checkTextCode, maskPhone, signVerifyCookie, startTextCode, textCodesConfigured, verifyCookieIsValid, verifyCookieName } from '@/lib/tc/sign-verify'
import { sendBrokerDeclinedNotice } from '@/lib/tc/signing-emails'
import { listEnvelopeSigningRoster } from '@/lib/data/tc/envelope-recipient-reads'
import {
  findSigningRecipient,
  getEnvelopeFieldsForSigning,
  getSigningDeal,
  getSigningDocuments,
  logSigningEvent,
  saveSignerValues,
  updateSigningRecipient,
  voidEnvelopeOnDecline,
  type SigningDocument,
  type SigningRecipient,
} from '@/lib/data/tc/signing-session'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Public, token-gated signing actions. No login: the per-recipient token is
 * the credential (only its sha256 is stored). When the broker switched on a
 * text-message code for the envelope, every action also needs the code check
 * this browser passed (lib/tc/sign-verify.ts). Signing order is enforced: a
 * recipient signs once every lower signing group has finished. What a signer
 * may fill, and what counts as complete, is lib/tc/field-rules.ts. ESIGN
 * (15 U.S.C. 7001) and Oregon UETA (ORS ch. 84).
 */

async function clientMeta(): Promise<{ ip: string | null; ua: string | null }> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  const ip = fwd ? fwd.split(',')[0]!.trim() : h.get('x-real-ip')
  return { ip: ip ?? null, ua: h.get('user-agent') }
}

export type SigningSessionState =
  | { status: 'ready'; data: SigningPayload }
  | { status: 'verify'; recipientName: string; propertyAddress: string; maskedPhone: string | null; canText: boolean }
  | { status: 'waiting'; envelopeName: string; propertyAddress: string }
  | { status: 'completed'; envelopeName: string; propertyAddress: string; signedAt: string | null }
  | { status: 'voided' | 'declined' | 'invalid'; message: string }

export type SigningPayload = {
  recipientId: string
  recipientName: string
  envelopeId: string
  envelopeName: string
  propertyAddress: string
  consented: boolean
  consentVersion: string
  documents: SigningDocument[]
  fields: EnvelopeField[]
}

async function resolve(token: string): Promise<SigningRecipient | null> {
  if (!token || token.length < 20 || token.length > 200) return null
  return findSigningRecipient(hashSigningToken(token))
}

/** Whether this browser passed the envelope's text-message code, when it asks for one. */
async function codePassed(recip: SigningRecipient): Promise<boolean> {
  if (!recip.envelope.requireTextCode) return true
  const jar = await cookies()
  return verifyCookieIsValid(jar.get(verifyCookieName(recip.id))?.value, recip.id, recip.tokenHash)
}

/**
 * What the signer sees: their own fields of every kind; the broker's filled
 * fields and page marks, locked; other signers' finished values. Nobody's
 * unfinished field is shown to anyone else.
 */
function visibleFields(all: readonly EnvelopeField[], recipientId: string): EnvelopeField[] {
  return all.filter((f) => {
    const owner = fieldOwner(f, recipientId)
    if (owner === 'mine') return true
    if (owner === 'locked') return ANNOTATION_TYPES.has(f.type) || valueIsFilled(f.type, f.value)
    return valueIsFilled(f.type, f.value)
  })
}

/** Resolve a signing link. Enforces the text code and the signing order. */
export async function getSigningSession(token: string): Promise<SigningSessionState> {
  const recip = await resolve(token)
  if (!recip) return { status: 'invalid', message: 'This signing link is not valid. Use the newest email from your broker, or call us.' }
  const env = recip.envelope
  const deal = await getSigningDeal(env.cycleId)

  if (env.status === 'voided') return { status: 'voided', message: 'This signing request was canceled. Your broker will send a new one if it is still needed.' }
  if (recip.declinedAt) return { status: 'declined', message: 'You declined this signing request. Your broker has been told.' }
  if (recip.completedAt || env.status === 'completed') return { status: 'completed', envelopeName: env.name, propertyAddress: deal.address, signedAt: recip.completedAt }

  if (earlierSigningGroupPending(recip.signingOrder, await listEnvelopeSigningRoster(env.id))) {
    return { status: 'waiting', envelopeName: env.name, propertyAddress: deal.address }
  }
  if (!(await codePassed(recip))) {
    return { status: 'verify', recipientName: recip.name || 'there', propertyAddress: deal.address, maskedPhone: maskPhone(recip.phone), canText: textCodesConfigured() && !!recip.phone }
  }

  const [documents, fields] = await Promise.all([getSigningDocuments(env.id), getEnvelopeFieldsForSigning(env.id)])
  return {
    status: 'ready',
    data: {
      recipientId: recip.id,
      recipientName: recip.name || 'there',
      envelopeId: env.id,
      envelopeName: env.name,
      propertyAddress: deal.address,
      consented: !!recip.consentedAt,
      consentVersion: ESIGN_CONSENT_VERSION,
      documents,
      fields: visibleFields(fields, recip.id),
    },
  }
}

type Gate = { ok: true; recip: SigningRecipient } | { ok: false; error: string }

async function gate(token: string): Promise<Gate> {
  const recip = await resolve(token)
  if (!recip) return { ok: false, error: 'This signing link is not valid.' }
  if (recip.envelope.status === 'voided') return { ok: false, error: 'This request was canceled.' }
  if (recip.completedAt) return { ok: false, error: 'You already signed.' }
  if (recip.declinedAt) return { ok: false, error: 'You declined this request.' }
  if (!(await codePassed(recip))) return { ok: false, error: 'Enter the code we texted you first.' }
  return { ok: true, recip }
}

/**
 * The first real look at the documents. Called from the page once it runs in
 * a browser, so a mail scanner that only fetches the link is never recorded
 * as the signer viewing it.
 */
export async function recordSigningView(token: string): Promise<{ ok: boolean }> {
  const g = await gate(token)
  if (!g.ok) return { ok: false }
  if (!g.recip.viewedAt) {
    const { ip, ua } = await clientMeta()
    await updateSigningRecipient(g.recip.id, { viewed_at: new Date().toISOString(), ip, user_agent: ua })
    await logSigningEvent(g.recip.envelope.cycleId, g.recip.email || g.recip.name || 'signer', 'envelope_recipient_viewed', { envelope: g.recip.envelope.name, recipient: g.recip.name || g.recip.email })
  }
  return { ok: true }
}

/** The signer agreed to transact electronically, to this version of the disclosure. */
export async function recordSigningConsent(token: string): Promise<{ ok: boolean; error?: string }> {
  const g = await gate(token)
  if (!g.ok) return { ok: false, error: g.error }
  if (!g.recip.consentedAt) {
    const { ip, ua } = await clientMeta()
    await updateSigningRecipient(g.recip.id, { consented_at: new Date().toISOString(), consent_version: ESIGN_CONSENT_VERSION, ip, user_agent: ua })
    await logSigningEvent(g.recip.envelope.cycleId, g.recip.email || g.recip.name || 'signer', 'envelope_recipient_consented', { envelope: g.recip.envelope.name, recipient: g.recip.name || g.recip.email, consent_version: ESIGN_CONSENT_VERSION })
  }
  return { ok: true }
}

export type SubmitFieldValue = { fieldId: string; value: SignFieldValue }

/** Submit a recipient's fields, finish them, then advance or seal. */
export async function submitSigning(token: string, values: SubmitFieldValue[]): Promise<{ ok: boolean; error?: string; fieldId?: string; completed?: boolean }> {
  const g = await gate(token)
  if (!g.ok) return { ok: false, error: g.error }
  const { recip } = g
  if (!recip.consentedAt) return { ok: false, error: 'Consent is required before signing.' }
  if (earlierSigningGroupPending(recip.signingOrder, await listEnvelopeSigningRoster(recip.envelope.id))) {
    return { ok: false, error: 'Earlier signers in this sequence still need to finish.' }
  }
  if (!Array.isArray(values) || values.length > 2000) return { ok: false, error: 'That submission is not valid.' }

  const fields = await getEnvelopeFieldsForSigning(recip.envelope.id)
  const now = new Date()
  const check = checkSubmission(fields, { id: recip.id, name: recip.name }, new Map(values.map((v) => [String(v?.fieldId), v?.value as unknown])), now)
  if (!check.ok) return { ok: false, error: check.error, fieldId: check.fieldId }

  const { ip } = await clientMeta()
  const signedAt = now.toISOString()
  await saveSignerValues(recip.id, check.values, { signedAt, ip })
  // Nothing is left to resend, so the encrypted link goes; the hash stays so
  // the link opens to "You have signed", not a dead link.
  await updateSigningRecipient(recip.id, { completed_at: signedAt, auth_token_enc: null })
  await logSigningEvent(recip.envelope.cycleId, recip.email || recip.name || 'signer', 'envelope_recipient_signed', { envelope: recip.envelope.name, recipient: recip.name || recip.email, role: recip.role, fields: check.values.size })

  const completed = await advanceOrSeal(createServiceClient(), recip.envelope.id)
  return { ok: true, completed }
}

/** Decline to sign: the envelope is voided and the broker is emailed at once. */
export async function declineSigning(token: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const g = await gate(token)
  if (!g.ok) return { ok: false, error: g.error }
  const { recip } = g
  const why = String(reason ?? '').slice(0, 1000).trim()
  const now = new Date().toISOString()
  const who = recip.name || recip.email || 'A signer'
  await updateSigningRecipient(recip.id, { declined_at: now, decline_reason: why || 'declined', auth_token_enc: null })
  await voidEnvelopeOnDecline(recip.envelope.id, `Declined by ${who}${why ? `: ${why}` : ''}`, now)
  await logSigningEvent(recip.envelope.cycleId, recip.email || recip.name || 'signer', 'envelope_declined', { envelope: recip.envelope.name, recipient: who, reason: why })
  const broker = recip.envelope.createdBy && recip.envelope.createdBy.includes('@') ? recip.envelope.createdBy : null
  if (broker) {
    const deal = await getSigningDeal(recip.envelope.cycleId)
    const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
    await sendBrokerDeclinedNotice({
      to: broker,
      envelopeName: recip.envelope.name,
      propertyAddress: deal.address,
      signerName: who,
      reason: why,
      dealUrl: `${site}/admin/deals/${encodeURIComponent(deal.propertyKey ?? '')}`,
    }).catch(() => undefined)
  }
  return { ok: true }
}

/** Text the signer a code (envelopes with the text-code switch on). */
export async function sendSigningCode(token: string): Promise<{ ok: boolean; error?: string }> {
  const recip = await resolve(token)
  if (!recip || recip.envelope.status === 'voided' || recip.completedAt || recip.declinedAt) return { ok: false, error: 'This signing link is not active.' }
  if (!recip.envelope.requireTextCode) return { ok: true }
  if (!recip.phone) return { ok: false, error: 'There is no mobile number on file for you. Call your broker.' }
  const r = await startTextCode(recip.phone)
  if (r.ok) await logSigningEvent(recip.envelope.cycleId, recip.email || recip.name || 'signer', 'envelope_text_code_sent', { envelope: recip.envelope.name, recipient: recip.name || recip.email, to: maskPhone(recip.phone) })
  return r.ok ? { ok: true } : { ok: false, error: 'We could not send the code. Try again in a minute, or call your broker.' }
}

/** Check the texted code; a pass is remembered on this browser for 12 hours. */
export async function checkSigningCode(token: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const recip = await resolve(token)
  if (!recip || recip.envelope.status === 'voided' || recip.completedAt || recip.declinedAt) return { ok: false, error: 'This signing link is not active.' }
  if (!recip.envelope.requireTextCode) return { ok: true }
  if (!recip.phone || !(await checkTextCode(recip.phone, String(code ?? '')))) return { ok: false, error: 'That code is not right. Check the text and try again.' }
  const c = signVerifyCookie(recip.id, recip.tokenHash)
  const jar = await cookies()
  // Lax, not Strict: a Strict cookie is not sent when the signer taps the
  // link in their mail app (a cross-site navigation), so they would be asked
  // for a new code on every open. It is HttpOnly and bound to this recipient
  // and link either way.
  jar.set(verifyCookieName(recip.id), c.value, { httpOnly: true, secure: true, sameSite: 'lax', path: '/sign', maxAge: c.maxAge })
  await logSigningEvent(recip.envelope.cycleId, recip.email || recip.name || 'signer', 'envelope_text_code_verified', { envelope: recip.envelope.name, recipient: recip.name || recip.email })
  return { ok: true }
}
