import 'server-only'

/**
 * The public signing page's reads and writes, behind the per-recipient link.
 * No login: the token is the credential, and only its sha256 is stored. The
 * service client is used because every tc_* table is RLS-locked.
 * app/actions/tc-sign.ts is the only caller.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { sharedAddressCosigners, type EnvelopeField, type SignFieldType, type SignFieldValue } from '@/lib/tc/signing'

type Obj = Record<string, unknown>

export type SigningRecipient = {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  signingOrder: number
  consentedAt: string | null
  viewedAt: string | null
  completedAt: string | null
  declinedAt: string | null
  tokenHash: string
  envelope: { id: string; name: string; status: string; cycleId: string; requireTextCode: boolean; createdBy: string | null }
}

export async function findSigningRecipient(tokenHash: string, sb: SupabaseClient = createServiceClient()): Promise<SigningRecipient | null> {
  const { data } = await sb
    .from('tc_envelope_recipients')
    .select('id, name, email, phone, role, signing_order, consented_at, viewed_at, completed_at, declined_at, auth_token_hash, tc_envelopes(id, name, status, cycle_id, require_text_code, created_by)')
    .eq('auth_token_hash', tokenHash)
    .maybeSingle()
  if (!data) return null
  const env = (Array.isArray(data.tc_envelopes) ? data.tc_envelopes[0] : data.tc_envelopes) as Obj | null
  if (!env) return null
  return {
    id: String(data.id),
    name: String(data.name ?? ''),
    email: String(data.email ?? ''),
    phone: (data.phone as string | null) ?? null,
    role: String(data.role ?? ''),
    signingOrder: Number(data.signing_order ?? 1),
    consentedAt: (data.consented_at as string | null) ?? null,
    viewedAt: (data.viewed_at as string | null) ?? null,
    completedAt: (data.completed_at as string | null) ?? null,
    declinedAt: (data.declined_at as string | null) ?? null,
    tokenHash: String(data.auth_token_hash),
    envelope: {
      id: String(env.id),
      name: String(env.name ?? ''),
      status: String(env.status ?? ''),
      cycleId: String(env.cycle_id),
      requireTextCode: env.require_text_code === true,
      createdBy: (env.created_by as string | null) ?? null,
    },
  }
}

export async function getSigningDeal(cycleId: string, sb: SupabaseClient = createServiceClient()): Promise<{ address: string; propertyKey: string | null }> {
  const { data } = await sb.from('tc_cycles').select('tc_deals(address, property_key)').eq('id', cycleId).maybeSingle()
  const deal = (Array.isArray(data?.tc_deals) ? data?.tc_deals[0] : data?.tc_deals) as { address?: string; property_key?: string } | undefined
  return { address: deal?.address ?? 'your transaction', propertyKey: deal?.property_key ?? null }
}

export type SigningDocument = { documentId: string; name: string; url: string | null; pageCount: number | null }

/** The envelope's documents in packet order, each with a one-hour signed link. */
export async function getSigningDocuments(envelopeId: string, sb: SupabaseClient = createServiceClient()): Promise<SigningDocument[]> {
  const { data: envDocs } = await sb.from('tc_envelope_documents').select('document_id, sort_order').eq('envelope_id', envelopeId).order('sort_order')
  const ids = (envDocs ?? []).map((d) => String(d.document_id))
  if (!ids.length) return []
  const { data: docs } = await sb.from('tc_documents').select('id, name, page_count, storage_path').in('id', ids)
  const meta = new Map((docs ?? []).map((d) => [String(d.id), d]))
  const paths = (docs ?? []).map((d) => d.storage_path).filter(Boolean) as string[]
  const urlByPath = new Map<string, string>()
  if (paths.length) {
    const { data: signed } = await sb.storage.from('tc-documents').createSignedUrls(paths, 3600)
    for (const s of signed ?? []) if (s.signedUrl && !s.error) urlByPath.set(s.path ?? '', s.signedUrl)
  }
  return ids.map((id) => {
    const m = meta.get(id)
    return {
      documentId: id,
      name: String(m?.name ?? 'Document'),
      pageCount: (m?.page_count as number | null) ?? null,
      url: m?.storage_path ? urlByPath.get(String(m.storage_path)) ?? null : null,
    }
  })
}

/** Every field on the envelope, as lib/tc/field-rules.ts reads them. */
export async function getEnvelopeFieldsForSigning(envelopeId: string, sb: SupabaseClient = createServiceClient()): Promise<EnvelopeField[]> {
  const { data } = await sb
    .from('tc_envelope_fields')
    .select('id, document_id, recipient_id, type, page, x, y, w, h, required, value, signed_at, label, group_key, group_min, group_max')
    .eq('envelope_id', envelopeId)
  return (data ?? []).map((f) => ({
    id: String(f.id),
    documentId: String(f.document_id),
    recipientId: (f.recipient_id as string | null) ?? null,
    type: f.type as SignFieldType,
    page: Number(f.page),
    x: Number(f.x),
    y: Number(f.y),
    w: Number(f.w),
    h: Number(f.h),
    required: f.required === true,
    value: (f.value as SignFieldValue | null) ?? null,
    signedAt: (f.signed_at as string | null) ?? null,
    label: (f.label as string | null) ?? null,
    group: f.group_key ? { key: String(f.group_key), min: f.group_min == null ? null : Number(f.group_min), max: f.group_max == null ? null : Number(f.group_max) } : null,
  }))
}

export async function updateSigningRecipient(
  recipientId: string,
  patch: Partial<{ viewed_at: string; consented_at: string; consent_version: string; ip: string | null; user_agent: string | null; completed_at: string; declined_at: string; decline_reason: string; auth_token_enc: null }>,
  sb: SupabaseClient = createServiceClient(),
): Promise<void> {
  const { error } = await sb.from('tc_envelope_recipients').update(patch).eq('id', recipientId)
  if (error) throw new Error(`signing recipient: ${error.message}`)
}

/** A signer's accepted values, each written only onto that signer's own field. */
export async function saveSignerValues(
  recipientId: string,
  values: ReadonlyMap<string, SignFieldValue>,
  meta: { signedAt: string; ip: string | null },
  sb: SupabaseClient = createServiceClient(),
): Promise<void> {
  for (const [fieldId, value] of values) {
    const { error } = await sb
      .from('tc_envelope_fields')
      .update({ value, signed_at: meta.signedAt, signed_ip: meta.ip })
      .eq('id', fieldId)
      .eq('recipient_id', recipientId)
    if (error) throw new Error(`signing value: ${error.message}`)
  }
}

export async function voidEnvelopeOnDecline(envelopeId: string, reason: string, at: string, sb: SupabaseClient = createServiceClient()): Promise<void> {
  const { error } = await sb.from('tc_envelopes').update({ status: 'voided', voided_at: at, void_reason: reason }).eq('id', envelopeId)
  if (error) throw new Error(`void on decline: ${error.message}`)
}

export async function logSigningEvent(cycleId: string, actor: string, action: string, detail: Obj, sb: SupabaseClient = createServiceClient()): Promise<void> {
  await sb.from('tc_events').insert({ cycle_id: cycleId, actor, action, detail })
}

/**
 * The next signer who reads this signer's mail: another signer on the envelope
 * at the same address, not finished, and already sent their link (their turn
 * is open). The signing page offers to continue as them.
 */
export async function findSharedAddressNextSigner(
  envelopeId: string,
  recipientId: string,
  email: string,
  sb: SupabaseClient = createServiceClient(),
): Promise<{ id: string; name: string; auth_token_hash: string | null; auth_token_enc: string | null } | null> {
  const mine = email.trim().toLowerCase()
  if (!mine.includes('@')) return null
  const { data } = await sb
    .from('tc_envelope_recipients')
    .select('id, name, email, role, action_required, signing_order, completed_at, declined_at, auth_token_hash, auth_token_enc')
    .eq('envelope_id', envelopeId)
    .neq('id', recipientId)
  const next = sharedAddressCosigners((data ?? []).map((r) => ({ ...r, id: String(r.id) })), { id: recipientId, email: mine })
    .filter((r) => r.auth_token_hash)
    .sort((a, b) => Number(a.signing_order ?? 1) - Number(b.signing_order ?? 1))[0]
  return next ? { id: next.id, name: String(next.name ?? ''), auth_token_hash: next.auth_token_hash ?? null, auth_token_enc: next.auth_token_enc ?? null } : null
}
