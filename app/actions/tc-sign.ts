'use server'

import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import {
  hashSigningToken,
  isSignableRole,
  type EnvelopeField,
  type SignFieldValue,
} from '@/lib/tc/signing'
import { advanceOrSeal } from '@/lib/tc/seal-envelope'

/**
 * Public, token-gated signing actions. NO admin auth — the per-recipient token
 * IS the credential (only its sha256 hash is stored). Service role used because
 * tc_* tables are RLS-locked. Ordered routing enforced: a recipient can only
 * sign once every lower signing-order has completed. Sealing + completion
 * notices fire when the last signer finishes. ESIGN / Oregon UETA (ORS ch. 84).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbRow = Record<string, any>

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function clientMeta(): Promise<{ ip: string | null; ua: string | null }> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  const ip = fwd ? fwd.split(',')[0]!.trim() : h.get('x-real-ip')
  return { ip: ip ?? null, ua: h.get('user-agent') }
}

export type SigningSessionState =
  | { status: 'ready'; data: SigningPayload }
  | { status: 'waiting'; envelopeName: string; propertyAddress: string }
  | { status: 'completed'; envelopeName: string; propertyAddress: string }
  | { status: 'voided' | 'declined' | 'invalid'; message: string }

export type SigningPayload = {
  recipientId: string
  recipientName: string
  envelopeId: string
  envelopeName: string
  propertyAddress: string
  consented: boolean
  documents: { documentId: string; name: string; url: string | null; pageCount: number | null }[]
  fields: EnvelopeField[]
}

/** Resolve a signing link. Records the first view. Enforces signing order. */
export async function getSigningSession(token: string): Promise<SigningSessionState> {
  if (!token || token.length < 20) return { status: 'invalid', message: 'This signing link is not valid.' }
  const supabase = getServiceSupabase()
  const hash = hashSigningToken(token)

  const { data: recip } = await supabase
    .from('tc_envelope_recipients')
    .select('*, tc_envelopes(id, name, status, cycle_id)')
    .eq('auth_token_hash', hash)
    .maybeSingle()
  if (!recip) return { status: 'invalid', message: 'This signing link has expired or is not valid.' }

  const env = (recip as DbRow).tc_envelopes
  if (!env) return { status: 'invalid', message: 'This envelope is no longer available.' }

  const { data: cycle } = await supabase
    .from('tc_cycles')
    .select('tc_deals(address)')
    .eq('id', env.cycle_id)
    .maybeSingle()
  const propertyAddress = (cycle as DbRow)?.tc_deals?.address ?? 'your transaction'

  if (env.status === 'voided') return { status: 'voided', message: 'This signing request was canceled.' }
  if (recip.declined_at) return { status: 'declined', message: 'You declined this signing request.' }
  if (recip.completed_at || env.status === 'completed') {
    return { status: 'completed', envelopeName: env.name, propertyAddress }
  }

  // ordered routing gate: every lower signing-order signable recipient must be done
  const { data: allRecips } = await supabase
    .from('tc_envelope_recipients')
    .select('id, role, signing_order, completed_at')
    .eq('envelope_id', env.id)
  const lowerPending = ((allRecips ?? []) as DbRow[]).filter(
    (r) => isSignableRole(r.role) && (r.signing_order ?? 1) < (recip.signing_order ?? 1) && !r.completed_at
  )
  if (lowerPending.length) {
    return { status: 'waiting', envelopeName: env.name, propertyAddress }
  }

  // record first view
  if (!recip.viewed_at) {
    const { ip, ua } = await clientMeta()
    await supabase
      .from('tc_envelope_recipients')
      .update({ viewed_at: new Date().toISOString(), ip, user_agent: ua })
      .eq('id', recip.id)
  }

  // documents + this recipient's fields
  const { data: envDocs } = await supabase
    .from('tc_envelope_documents')
    .select('document_id, sort_order')
    .eq('envelope_id', env.id)
    .order('sort_order')
  const docIds = ((envDocs ?? []) as DbRow[]).map((d) => d.document_id)
  const docMeta = new Map<string, DbRow>()
  if (docIds.length) {
    const { data: docs } = await supabase
      .from('tc_documents')
      .select('id, name, page_count, storage_path')
      .in('id', docIds)
    for (const d of (docs ?? []) as DbRow[]) docMeta.set(d.id, d)
  }
  const paths = [...docMeta.values()].map((d) => d.storage_path).filter(Boolean) as string[]
  const urlByPath = new Map<string, string>()
  if (paths.length) {
    const { data: signed } = await supabase.storage.from('tc-documents').createSignedUrls(paths, 3600)
    for (const s of signed ?? []) if (s.signedUrl && !s.error) urlByPath.set(s.path ?? '', s.signedUrl)
  }

  const { data: fields } = await supabase
    .from('tc_envelope_fields')
    .select('*')
    .eq('envelope_id', env.id)
    .eq('recipient_id', recip.id)

  return {
    status: 'ready',
    data: {
      recipientId: recip.id,
      recipientName: recip.name || 'there',
      envelopeId: env.id,
      envelopeName: env.name,
      propertyAddress,
      consented: !!recip.consented_at,
      documents: ((envDocs ?? []) as DbRow[]).map((d) => {
        const meta = docMeta.get(d.document_id)
        return {
          documentId: d.document_id,
          name: meta?.name ?? 'Document',
          pageCount: meta?.page_count ?? null,
          url: meta?.storage_path ? urlByPath.get(meta.storage_path) ?? null : null,
        }
      }),
      fields: ((fields ?? []) as DbRow[]).map((f) => ({
        id: f.id,
        documentId: f.document_id,
        recipientId: f.recipient_id,
        type: f.type,
        page: f.page,
        x: Number(f.x),
        y: Number(f.y),
        w: Number(f.w),
        h: Number(f.h),
        required: f.required,
        value: f.value ?? null,
        signedAt: f.signed_at,
      })),
    },
  }
}

/** Record ESIGN/UETA consent (the signer agreed to transact electronically). */
export async function recordSigningConsent(token: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceSupabase()
  const hash = hashSigningToken(token)
  const { data: recip } = await supabase
    .from('tc_envelope_recipients')
    .select('id, completed_at, consented_at')
    .eq('auth_token_hash', hash)
    .maybeSingle()
  if (!recip) return { ok: false, error: 'Invalid link' }
  if (recip.completed_at) return { ok: false, error: 'Already signed' }
  if (!recip.consented_at) {
    const { ip } = await clientMeta()
    await supabase
      .from('tc_envelope_recipients')
      .update({ consented_at: new Date().toISOString(), ip })
      .eq('id', recip.id)
  }
  return { ok: true }
}

export type SubmitFieldValue = { fieldId: string; value: SignFieldValue }

/** Submit a recipient's completed fields, finish them, then advance or seal. */
export async function submitSigning(
  token: string,
  values: SubmitFieldValue[]
): Promise<{ ok: boolean; error?: string; completed?: boolean }> {
  const supabase = getServiceSupabase()
  const hash = hashSigningToken(token)
  const { data: recip } = await supabase
    .from('tc_envelope_recipients')
    .select('*, tc_envelopes(id, name, status, cycle_id)')
    .eq('auth_token_hash', hash)
    .maybeSingle()
  if (!recip) return { ok: false, error: 'This signing link is not valid.' }
  const env = (recip as DbRow).tc_envelopes
  if (!env) return { ok: false, error: 'Envelope unavailable.' }
  if (env.status === 'voided') return { ok: false, error: 'This request was canceled.' }
  if (recip.completed_at) return { ok: false, error: 'You already signed.' }
  if (!recip.consented_at) return { ok: false, error: 'Consent is required before signing.' }

  // load this recipient's required fields to validate completeness
  const { data: fields } = await supabase
    .from('tc_envelope_fields')
    .select('id, type, required')
    .eq('envelope_id', env.id)
    .eq('recipient_id', recip.id)
  const fieldRows = (fields ?? []) as DbRow[]
  const valueById = new Map(values.map((v) => [v.fieldId, v.value]))

  for (const f of fieldRows) {
    if (!f.required) continue
    const v = valueById.get(f.id)
    if (!v) return { ok: false, error: 'Please complete every required field before finishing.' }
    if ((v.kind === 'signature' || v.kind === 'initials') && !v.png) return { ok: false, error: 'A signature is incomplete.' }
    if ((v.kind === 'text' || v.kind === 'date_signed') && !v.text?.trim()) return { ok: false, error: 'A required field is empty.' }
    if (v.kind === 'checkbox' && !v.checked) return { ok: false, error: 'A required checkbox is unchecked.' }
  }

  const { ip } = await clientMeta()
  const signedAt = new Date().toISOString()
  // persist each value onto its field (only fields that belong to this recipient)
  const validIds = new Set(fieldRows.map((f) => f.id))
  for (const v of values) {
    if (!validIds.has(v.fieldId)) continue
    await supabase
      .from('tc_envelope_fields')
      .update({ value: v.value, signed_at: signedAt, signed_ip: ip })
      .eq('id', v.fieldId)
      .eq('recipient_id', recip.id)
  }
  // mark recipient done + kill their token
  await supabase
    .from('tc_envelope_recipients')
    .update({ completed_at: signedAt, auth_token_hash: null })
    .eq('id', recip.id)

  await supabase.from('tc_events').insert({
    cycle_id: env.cycle_id,
    actor: recip.email || recip.name || 'signer',
    action: 'envelope_recipient_signed',
    detail: { envelope: env.name, recipient: recip.name || recip.email, role: recip.role },
  })

  const completed = await advanceOrSeal(supabase, env.id)
  return { ok: true, completed }
}

/** Decline to sign. Voids the envelope and notifies the broker via the audit log. */
export async function declineSigning(token: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceSupabase()
  const hash = hashSigningToken(token)
  const { data: recip } = await supabase
    .from('tc_envelope_recipients')
    .select('*, tc_envelopes(id, name, status, cycle_id)')
    .eq('auth_token_hash', hash)
    .maybeSingle()
  if (!recip) return { ok: false, error: 'Invalid link' }
  const env = (recip as DbRow).tc_envelopes
  if (recip.completed_at) return { ok: false, error: 'You already signed.' }

  const now = new Date().toISOString()
  await supabase
    .from('tc_envelope_recipients')
    .update({ declined_at: now, decline_reason: reason || 'declined', auth_token_hash: null })
    .eq('id', recip.id)
  await supabase
    .from('tc_envelopes')
    .update({ status: 'voided', voided_at: now, void_reason: `Declined by ${recip.name || recip.email}: ${reason || ''}`.trim() })
    .eq('id', env.id)
  await supabase.from('tc_events').insert({
    cycle_id: env.cycle_id,
    actor: recip.email || recip.name || 'signer',
    action: 'envelope_declined',
    detail: { envelope: env.name, recipient: recip.name || recip.email, reason },
  })
  return { ok: true }
}
