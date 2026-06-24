'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import {
  generateSigningToken,
  isSignableRole,
  isValidEmail,
  type EnvelopeField,
  type EnvelopeStatus,
  type SignFieldType,
} from '@/lib/tc/signing'
import { sendSigningInvite } from '@/lib/tc/signing-emails'
import { createHash } from 'node:crypto'
import type { MappedField, SignerRole } from '@/lib/tc/skyslope-field-map'

/**
 * TC envelope composer + lifecycle (Phase 2b). Build an envelope from PDF
 * documents already on a cycle, place signature/initials/date/text/checkbox
 * fields, assign them to recipients with a signing order, then send tokenized
 * email links. Sealing + completion live in tc-sign.ts (the public signer
 * actions). Every mutation appends a tc_events row.
 *
 * Compose works on ANY PDF on the deal — template fill-from-deal-data layers
 * on later when the licensed OREF blanks are pulled (docs/TC_SYSTEM.md).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- PostgREST rows narrow at mapping sites
type DbRow = Record<string, any>

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function requireBroker(): Promise<{ email: string } | { error: string }> {
  const session = await getSession()
  const email = session?.user?.email ?? null
  const role = await getAdminRoleForEmail(email)
  if (!email || !role || (role.role !== 'superuser' && role.role !== 'broker')) {
    return { error: 'Not authorized' }
  }
  return { email }
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
}

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

export type EnvelopeRecipient = {
  id: string
  role: string
  name: string
  email: string
  signingOrder: number
  viewedAt: string | null
  consentedAt: string | null
  completedAt: string | null
  declinedAt: string | null
  declineReason: string | null
}

export type EnvelopeDocumentRef = {
  id: string
  documentId: string
  name: string
  pageCount: number | null
  sortOrder: number
  url: string | null
}

export type EnvelopeSummary = {
  id: string
  cycleId: string
  name: string
  status: EnvelopeStatus
  createdBy: string | null
  sentAt: string | null
  completedAt: string | null
  voidReason: string | null
  recipientCount: number
  signedCount: number
  recipients: EnvelopeRecipient[]
  executedDocumentId: string | null
}

export type EnvelopeDetail = EnvelopeSummary & {
  documents: EnvelopeDocumentRef[]
  fields: EnvelopeField[]
}

function mapRecipient(r: DbRow): EnvelopeRecipient {
  return {
    id: r.id,
    role: r.role,
    name: r.name ?? '',
    email: r.email ?? '',
    signingOrder: r.signing_order ?? 1,
    viewedAt: r.viewed_at,
    consentedAt: r.consented_at,
    completedAt: r.completed_at,
    declinedAt: r.declined_at,
    declineReason: r.decline_reason,
  }
}

/** All envelopes on a cycle, with recipient status (for the deal page). */
export async function getEnvelopesForCycle(cycleId: string): Promise<EnvelopeSummary[]> {
  const supabase = getServiceSupabase()
  const { data: envs } = await supabase
    .from('tc_envelopes')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('created_at', { ascending: false })
  if (!envs?.length) return []

  const envIds = (envs as DbRow[]).map((e) => e.id)
  const { data: recips } = await supabase
    .from('tc_envelope_recipients')
    .select('*')
    .in('envelope_id', envIds)
    .order('signing_order', { ascending: true })

  const recipsByEnv = new Map<string, DbRow[]>()
  for (const r of (recips ?? []) as DbRow[]) {
    const arr = recipsByEnv.get(r.envelope_id) ?? []
    arr.push(r)
    recipsByEnv.set(r.envelope_id, arr)
  }

  return (envs as DbRow[]).map((e) => {
    const rs = (recipsByEnv.get(e.id) ?? []).map(mapRecipient)
    const signable = rs.filter((r) => isSignableRole(r.role))
    return {
      id: e.id,
      cycleId: e.cycle_id,
      name: e.name,
      status: e.status,
      createdBy: e.created_by,
      sentAt: e.sent_at,
      completedAt: e.completed_at,
      voidReason: e.void_reason,
      recipientCount: signable.length,
      signedCount: signable.filter((r) => r.completedAt).length,
      recipients: rs,
      executedDocumentId: e.executed_document_id,
    }
  })
}

/** Full envelope for the composer: documents (with signed URLs) + fields. */
export async function getEnvelopeDetail(envelopeId: string): Promise<EnvelopeDetail | null> {
  const supabase = getServiceSupabase()
  const { data: env } = await supabase.from('tc_envelopes').select('*').eq('id', envelopeId).maybeSingle()
  if (!env) return null

  const [{ data: recips }, { data: envDocs }, { data: fields }] = await Promise.all([
    supabase.from('tc_envelope_recipients').select('*').eq('envelope_id', envelopeId).order('signing_order'),
    supabase.from('tc_envelope_documents').select('*').eq('envelope_id', envelopeId).order('sort_order'),
    supabase.from('tc_envelope_fields').select('*').eq('envelope_id', envelopeId),
  ])

  // resolve the underlying tc_documents (name, page_count, storage_path) + URLs
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
    const { data: signed } = await supabase.storage.from('tc-documents').createSignedUrls(paths, 900)
    for (const s of signed ?? []) if (s.signedUrl && !s.error) urlByPath.set(s.path ?? '', s.signedUrl)
  }

  const rs = ((recips ?? []) as DbRow[]).map(mapRecipient)
  const signable = rs.filter((r) => isSignableRole(r.role))

  const documents: EnvelopeDocumentRef[] = ((envDocs ?? []) as DbRow[]).map((d) => {
    const meta = docMeta.get(d.document_id)
    return {
      id: d.id,
      documentId: d.document_id,
      name: meta?.name ?? 'Document',
      pageCount: meta?.page_count ?? null,
      sortOrder: d.sort_order ?? 0,
      url: meta?.storage_path ? urlByPath.get(meta.storage_path) ?? null : null,
    }
  })

  const mappedFields: EnvelopeField[] = ((fields ?? []) as DbRow[]).map((f) => ({
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
  }))

  return {
    id: env.id,
    cycleId: env.cycle_id,
    name: env.name,
    status: env.status,
    createdBy: env.created_by,
    sentAt: env.sent_at,
    completedAt: env.completed_at,
    voidReason: env.void_reason,
    recipientCount: signable.length,
    signedCount: signable.filter((r) => r.completedAt).length,
    recipients: rs,
    executedDocumentId: env.executed_document_id,
    documents,
    fields: mappedFields,
  }
}

// ---------------------------------------------------------------------------
// Compose
// ---------------------------------------------------------------------------

/** Create a draft envelope from chosen PDF documents on a cycle. */
export async function createEnvelopeFromDocuments(
  cycleId: string,
  documentIds: string[],
  envelopeName?: string
): Promise<{ ok: boolean; envelopeId?: string; error?: string }> {
  const auth = await requireBroker()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!documentIds.length) return { ok: false, error: 'Pick at least one document' }

  const supabase = getServiceSupabase()
  const { data: cycle } = await supabase
    .from('tc_cycles')
    .select('id, deal_id, sellers, buyers, broker_name, tc_deals(address, property_key)')
    .eq('id', cycleId)
    .maybeSingle()
  if (!cycle) return { ok: false, error: 'Cycle not found' }

  // only PDF documents from THIS cycle can be enveloped
  const { data: docs } = await supabase
    .from('tc_documents')
    .select('id, name, content_type')
    .eq('cycle_id', cycleId)
    .in('id', documentIds)
  const pdfDocs = ((docs ?? []) as DbRow[]).filter(
    (d) => !d.content_type || d.content_type === 'application/pdf'
  )
  if (!pdfDocs.length) return { ok: false, error: 'No PDF documents found to sign' }

  const address = (cycle as DbRow).tc_deals?.address ?? 'Deal'
  const name = envelopeName?.trim() || `${address} — ${pdfDocs.map((d) => d.name).join(', ').slice(0, 80)}`

  const { data: env, error: envErr } = await supabase
    .from('tc_envelopes')
    .insert({ cycle_id: cycleId, name, status: 'draft', created_by: auth.email })
    .select('id')
    .single()
  if (envErr) return { ok: false, error: envErr.message }

  await supabase.from('tc_envelope_documents').insert(
    pdfDocs.map((d, i) => ({ envelope_id: env.id, document_id: d.id, sort_order: i }))
  )

  // pre-seed recipients from the cycle parties (emails completed in the composer)
  const recipients: DbRow[] = []
  ;((cycle.buyers ?? []) as string[]).forEach((n, i) =>
    recipients.push({ envelope_id: env.id, role: `buyer${i + 1}`, name: n, email: '', signing_order: 1 })
  )
  ;((cycle.sellers ?? []) as string[]).forEach((n, i) =>
    recipients.push({ envelope_id: env.id, role: `seller${i + 1}`, name: n, email: '', signing_order: 2 })
  )
  if (cycle.broker_name)
    recipients.push({
      envelope_id: env.id,
      role: 'listing_broker',
      name: cycle.broker_name,
      email: auth.email,
      signing_order: 3,
    })
  if (recipients.length) await supabase.from('tc_envelope_recipients').insert(recipients)

  await supabase.from('tc_events').insert({
    deal_id: cycle.deal_id,
    cycle_id: cycleId,
    actor: auth.email,
    action: 'envelope_drafted',
    detail: { envelope: name, documents: pdfDocs.length, recipients: recipients.length },
  })

  revalidatePath('/admin/deals')
  return { ok: true, envelopeId: env.id }
}

/**
 * Instantiate a sign-ready envelope from licensed form templates (handoff
 * docs/TC_FORMS_LOADING_HANDOFF.md §4 Step 5). For each tc_form_versions row:
 * copy its blank from the tc-forms bucket into the deal's tc-documents, link it
 * (form_version_id), and place its translated field_map — signature/initials/
 * date fields auto-assigned to the right recipient by signer role; text fields
 * left for the composer to fill from deal data. Hands off to the normal
 * send -> sign -> seal flow (the envelope is a draft the broker reviews + sends).
 */
export async function createEnvelopeFromTemplate(
  cycleId: string,
  formVersionIds: string[],
  envelopeName?: string,
): Promise<{ ok: boolean; envelopeId?: string; error?: string }> {
  const auth = await requireBroker()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!formVersionIds.length) return { ok: false, error: 'Pick at least one form' }

  const supabase = getServiceSupabase()
  const { data: cycle } = await supabase
    .from('tc_cycles')
    .select('id, deal_id, sellers, buyers, broker_name, tc_deals(address)')
    .eq('id', cycleId)
    .maybeSingle()
  if (!cycle) return { ok: false, error: 'Cycle not found' }

  const { data: forms } = await supabase
    .from('tc_form_versions')
    .select('id, name, blank_pdf_storage_path, field_map, page_count')
    .in('id', formVersionIds)
  if (!forms?.length) return { ok: false, error: 'No forms found' }

  const address = (cycle as DbRow).tc_deals?.address ?? 'Deal'
  const name = envelopeName?.trim() || `${address} — ${(forms as DbRow[]).map((f) => f.name).join(', ').slice(0, 80)}`

  const { data: env, error: envErr } = await supabase
    .from('tc_envelopes')
    .insert({ cycle_id: cycleId, name, status: 'draft', created_by: auth.email })
    .select('id')
    .single()
  if (envErr) return { ok: false, error: envErr.message }

  // recipients from the cycle parties (emails completed in the composer)
  const recipients: DbRow[] = []
  ;((cycle.buyers ?? []) as string[]).forEach((n, i) =>
    recipients.push({ envelope_id: env.id, role: `buyer${i + 1}`, name: n, email: '', signing_order: 1 }))
  ;((cycle.sellers ?? []) as string[]).forEach((n, i) =>
    recipients.push({ envelope_id: env.id, role: `seller${i + 1}`, name: n, email: '', signing_order: 2 }))
  if (cycle.broker_name)
    recipients.push({ envelope_id: env.id, role: 'listing_broker', name: cycle.broker_name, email: auth.email, signing_order: 3 })
  let savedRecipients: DbRow[] = []
  if (recipients.length) {
    const { data: rs } = await supabase.from('tc_envelope_recipients').insert(recipients).select('id, role')
    savedRecipients = (rs ?? []) as DbRow[]
  }
  const recipientByRole = (role: SignerRole): string | null => {
    if (!role) return null
    const want = role === 'seller' ? 'seller' : role === 'listing_agent' ? 'listing_broker' : 'buyer'
    const match = savedRecipients.find((r) => String(r.role).startsWith(want))
    return match ? (match.id as string) : null
  }

  let sortOrder = 0
  const fieldRows: DbRow[] = []
  for (const form of forms as DbRow[]) {
    if (!form.blank_pdf_storage_path) continue
    const { data: blob } = await supabase.storage.from('tc-forms').download(form.blank_pdf_storage_path as string)
    if (!blob) return { ok: false, error: `blank PDF missing for ${form.name}` }
    const bytes = Buffer.from(await blob.arrayBuffer())
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const slug = String(form.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)
    const path = `forms/${cycleId}/${form.id}__${slug}.pdf`
    const up = await supabase.storage.from('tc-documents').upload(path, bytes, { contentType: 'application/pdf', upsert: true })
    if (up.error) return { ok: false, error: `storage: ${up.error.message}` }

    const { data: doc, error: docErr } = await supabase
      .from('tc_documents')
      .insert({
        cycle_id: cycleId,
        name: form.name,
        storage_path: path,
        sha256,
        bytes: bytes.byteLength,
        content_type: 'application/pdf',
        page_count: form.page_count ?? null,
        classification: { source: 'form_template', form_version_id: form.id },
      })
      .select('id')
      .single()
    if (docErr || !doc) return { ok: false, error: `document: ${docErr?.message ?? 'insert failed'}` }
    await supabase
      .from('tc_envelope_documents')
      .insert({ envelope_id: env.id, document_id: doc.id, sort_order: sortOrder++, form_version_id: form.id })

    for (const f of (form.field_map ?? []) as MappedField[]) {
      fieldRows.push({
        envelope_id: env.id,
        document_id: doc.id,
        recipient_id: recipientByRole(f.signerRole),
        // Defensive: any legacy field_map blob ingested before the canonical-type
        // fix may carry 'date', which the tc_envelope_fields.type CHECK rejects
        // (it accepts 'date_signed'). Normalize so a stale template can't 23514. (C4)
        type: (f.type as string) === 'date' ? 'date_signed' : f.type,
        page: Math.max(1, Math.round(f.page)),
        x: clamp01(f.x),
        y: clamp01(f.y),
        w: clamp01(f.w),
        h: clamp01(f.h),
        required: !f.optional,
      })
    }
  }
  if (fieldRows.length) {
    const { error: fErr } = await supabase.from('tc_envelope_fields').insert(fieldRows)
    if (fErr) return { ok: false, error: `fields: ${fErr.message}` }
  }

  await supabase.from('tc_events').insert({
    deal_id: cycle.deal_id,
    cycle_id: cycleId,
    actor: auth.email,
    action: 'envelope_drafted',
    detail: { envelope: name, forms: (forms as DbRow[]).length, fields: fieldRows.length, from_template: true },
  })

  revalidatePath('/admin/deals')
  return { ok: true, envelopeId: env.id }
}

export type RecipientInput = {
  id?: string
  role: string
  name: string
  email: string
  signingOrder: number
}

/** Replace the envelope's recipients (draft only). Returns id remap for fields. */
export async function saveEnvelopeRecipients(
  envelopeId: string,
  recipients: RecipientInput[]
): Promise<{ ok: boolean; error?: string; recipients?: EnvelopeRecipient[] }> {
  const auth = await requireBroker()
  if ('error' in auth) return { ok: false, error: auth.error }

  const supabase = getServiceSupabase()
  const env = await loadDraftEnvelope(supabase, envelopeId)
  if ('error' in env) return { ok: false, error: env.error }

  // delete recipients not in the incoming set, then upsert
  const keepIds = recipients.map((r) => r.id).filter(Boolean) as string[]
  const delQuery = supabase.from('tc_envelope_recipients').delete().eq('envelope_id', envelopeId)
  if (keepIds.length) delQuery.not('id', 'in', `(${keepIds.join(',')})`)
  await delQuery

  const rows = recipients.map((r) => ({
    ...(r.id ? { id: r.id } : {}),
    envelope_id: envelopeId,
    role: r.role,
    name: r.name?.trim() ?? '',
    email: r.email?.trim().toLowerCase() ?? '',
    signing_order: Math.max(1, Math.round(r.signingOrder || 1)),
  }))
  const { data: saved, error } = await supabase
    .from('tc_envelope_recipients')
    .upsert(rows, { onConflict: 'id' })
    .select('*')
  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/deals')
  return { ok: true, recipients: ((saved ?? []) as DbRow[]).map(mapRecipient) }
}

export type FieldInput = {
  documentId: string
  recipientId: string | null
  type: SignFieldType
  page: number
  x: number
  y: number
  w: number
  h: number
  required?: boolean
}

/** Replace all placed fields on a draft envelope. */
export async function saveEnvelopeFields(
  envelopeId: string,
  fields: FieldInput[]
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireBroker()
  if ('error' in auth) return { ok: false, error: auth.error }

  const supabase = getServiceSupabase()
  const env = await loadDraftEnvelope(supabase, envelopeId)
  if ('error' in env) return { ok: false, error: env.error }

  await supabase.from('tc_envelope_fields').delete().eq('envelope_id', envelopeId)
  if (fields.length) {
    const rows = fields.map((f) => ({
      envelope_id: envelopeId,
      document_id: f.documentId,
      recipient_id: f.recipientId,
      type: f.type,
      page: Math.max(1, Math.round(f.page)),
      x: clamp01(f.x),
      y: clamp01(f.y),
      w: clamp01(f.w),
      h: clamp01(f.h),
      required: f.required ?? true,
    }))
    const { error } = await supabase.from('tc_envelope_fields').insert(rows)
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath('/admin/deals')
  return { ok: true }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

async function loadDraftEnvelope(
  supabase: ReturnType<typeof getServiceSupabase>,
  envelopeId: string
): Promise<DbRow | { error: string }> {
  const { data: env } = await supabase.from('tc_envelopes').select('*').eq('id', envelopeId).maybeSingle()
  if (!env) return { error: 'Envelope not found' }
  if (env.status !== 'draft') return { error: `Envelope is ${env.status}; only drafts can be edited` }
  return env
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

/** Validate a draft and send it: mint tokens, email the first signing order. */
export async function sendEnvelope(envelopeId: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireBroker()
  if ('error' in auth) return { ok: false, error: auth.error }

  const supabase = getServiceSupabase()
  const env = await loadDraftEnvelope(supabase, envelopeId)
  if ('error' in env) return { ok: false, error: env.error }

  const [{ data: recips }, { data: fields }, { data: envDocs }, { data: cycle }] = await Promise.all([
    supabase.from('tc_envelope_recipients').select('*').eq('envelope_id', envelopeId),
    supabase.from('tc_envelope_fields').select('id, recipient_id, type').eq('envelope_id', envelopeId),
    supabase.from('tc_envelope_documents').select('id').eq('envelope_id', envelopeId),
    supabase
      .from('tc_cycles')
      .select('deal_id, tc_deals(address)')
      .eq('id', env.cycle_id)
      .maybeSingle(),
  ])

  if (!envDocs?.length) return { ok: false, error: 'No documents on this envelope' }
  const recipients = (recips ?? []) as DbRow[]
  const signable = recipients.filter((r) => isSignableRole(r.role))
  if (!signable.length) return { ok: false, error: 'Add at least one signer' }

  for (const r of recipients) {
    if (!isValidEmail(r.email)) return { ok: false, error: `Missing or invalid email for ${r.name || r.role}` }
  }
  const fieldsByRecip = new Map<string, DbRow[]>()
  for (const f of (fields ?? []) as DbRow[]) {
    if (!f.recipient_id) continue
    const arr = fieldsByRecip.get(f.recipient_id) ?? []
    arr.push(f)
    fieldsByRecip.set(f.recipient_id, arr)
  }
  for (const r of signable) {
    if (!(fieldsByRecip.get(r.id)?.length)) return { ok: false, error: `${r.name || r.role} has no fields to sign` }
  }
  const hasSignature = ((fields ?? []) as DbRow[]).some((f) => f.type === 'signature')
  if (!hasSignature) return { ok: false, error: 'Place at least one signature field' }

  const now = new Date().toISOString()
  await supabase.from('tc_envelopes').update({ status: 'sent', sent_at: now }).eq('id', envelopeId)

  // ordered routing: mint + email ONLY the lowest signing-order group. Later
  // groups get a freshly minted token when their turn comes (advanceOrSeal),
  // so a live link never exists before it is that signer's turn.
  const firstOrder = Math.min(...signable.map((r) => r.signing_order ?? 1))
  const address = (cycle as DbRow)?.tc_deals?.address ?? 'your transaction'
  const toNotify = signable.filter((r) => (r.signing_order ?? 1) === firstOrder)
  const tokenByRecip = new Map<string, string>()
  for (const r of toNotify) {
    const { token, hash } = generateSigningToken()
    tokenByRecip.set(r.id, token)
    await supabase.from('tc_envelope_recipients').update({ auth_token_hash: hash }).eq('id', r.id)
  }
  for (const r of toNotify) {
    await sendSigningInvite({
      to: r.email,
      recipientName: r.name || 'there',
      envelopeName: env.name,
      propertyAddress: address,
      signUrl: `${siteUrl()}/sign/${tokenByRecip.get(r.id)}`,
      replyTo: auth.email,
    })
  }

  await supabase.from('tc_events').insert({
    deal_id: (cycle as DbRow)?.deal_id ?? null,
    cycle_id: env.cycle_id,
    actor: auth.email,
    action: 'envelope_sent',
    detail: {
      envelope: env.name,
      signers: signable.length,
      notified_first_order: toNotify.length,
    },
  })

  revalidatePath('/admin/deals')
  return { ok: true }
}

/** Re-mint a recipient token and re-send their invite (manual reminder). */
export async function resendRecipientInvite(recipientId: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireBroker()
  if ('error' in auth) return { ok: false, error: auth.error }

  const supabase = getServiceSupabase()
  const { data: r } = await supabase
    .from('tc_envelope_recipients')
    .select('*, tc_envelopes(id, name, status, cycle_id)')
    .eq('id', recipientId)
    .maybeSingle()
  if (!r) return { ok: false, error: 'Recipient not found' }
  const env = (r as DbRow).tc_envelopes
  if (!env || (env.status !== 'sent' && env.status !== 'partially_signed')) {
    return { ok: false, error: 'Envelope is not out for signature' }
  }
  if (r.completed_at) return { ok: false, error: 'This recipient already signed' }
  if (!isValidEmail(r.email)) return { ok: false, error: 'Invalid recipient email' }

  const { token, hash } = generateSigningToken()
  await supabase.from('tc_envelope_recipients').update({ auth_token_hash: hash }).eq('id', recipientId)

  const { data: cycle } = await supabase
    .from('tc_cycles')
    .select('tc_deals(address)')
    .eq('id', env.cycle_id)
    .maybeSingle()

  await sendSigningInvite({
    to: r.email,
    recipientName: r.name || 'there',
    envelopeName: env.name,
    propertyAddress: (cycle as DbRow)?.tc_deals?.address ?? 'your transaction',
    signUrl: `${siteUrl()}/sign/${token}`,
    replyTo: auth.email,
    reminder: true,
  })

  await supabase.from('tc_events').insert({
    cycle_id: env.cycle_id,
    actor: auth.email,
    action: 'envelope_reminder_sent',
    detail: { envelope: env.name, recipient: r.name || r.email },
  })
  return { ok: true }
}

/** Void an envelope (any non-completed state). Tokens become dead immediately. */
export async function voidEnvelope(envelopeId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireBroker()
  if ('error' in auth) return { ok: false, error: auth.error }
  const supabase = getServiceSupabase()
  const { data: env } = await supabase.from('tc_envelopes').select('*').eq('id', envelopeId).maybeSingle()
  if (!env) return { ok: false, error: 'Envelope not found' }
  if (env.status === 'completed') return { ok: false, error: 'Completed envelopes cannot be voided' }
  if (env.status === 'voided') return { ok: true }

  await supabase
    .from('tc_envelopes')
    .update({ status: 'voided', voided_at: new Date().toISOString(), void_reason: reason || 'voided' })
    .eq('id', envelopeId)
  // kill all live tokens
  await supabase.from('tc_envelope_recipients').update({ auth_token_hash: null }).eq('envelope_id', envelopeId)

  await supabase.from('tc_events').insert({
    cycle_id: env.cycle_id,
    actor: auth.email,
    action: 'envelope_voided',
    detail: { envelope: env.name, reason },
  })
  revalidatePath('/admin/deals')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type EnvelopeOverviewRow = EnvelopeSummary & {
  dealKey: string | null
  dealAddress: string | null
}

/** Every envelope across all deals, newest first, for /admin/signing. */
export async function getEnvelopesOverview(): Promise<EnvelopeOverviewRow[]> {
  const supabase = getServiceSupabase()
  const { data: envs } = await supabase
    .from('tc_envelopes')
    .select('*, tc_cycles(deal_id, tc_deals(address, property_key))')
    .order('created_at', { ascending: false })
    .limit(200)
  if (!envs?.length) return []

  const envIds = (envs as DbRow[]).map((e) => e.id)
  const { data: recips } = await supabase
    .from('tc_envelope_recipients')
    .select('*')
    .in('envelope_id', envIds)
    .order('signing_order')
  const recipsByEnv = new Map<string, DbRow[]>()
  for (const r of (recips ?? []) as DbRow[]) {
    const arr = recipsByEnv.get(r.envelope_id) ?? []
    arr.push(r)
    recipsByEnv.set(r.envelope_id, arr)
  }

  return (envs as DbRow[]).map((e) => {
    const rs = (recipsByEnv.get(e.id) ?? []).map(mapRecipient)
    const signable = rs.filter((r) => isSignableRole(r.role))
    const deal = e.tc_cycles?.tc_deals
    return {
      id: e.id,
      cycleId: e.cycle_id,
      name: e.name,
      status: e.status,
      createdBy: e.created_by,
      sentAt: e.sent_at,
      completedAt: e.completed_at,
      voidReason: e.void_reason,
      recipientCount: signable.length,
      signedCount: signable.filter((r) => r.completedAt).length,
      recipients: rs,
      executedDocumentId: e.executed_document_id,
      dealKey: deal?.property_key ?? null,
      dealAddress: deal?.address ?? null,
    }
  })
}
