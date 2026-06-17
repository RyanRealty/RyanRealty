/**
 * TC envelope state machine — server-only, request-context-free.
 *
 * Extracted from app/actions/tc-sign.ts so the ordered-routing + sealing logic
 * can be driven by the public signing action AND by integration tests (it takes
 * a supabase client and uses no headers()/cookies()). Nothing here depends on a
 * request — only the DB, Storage, pdf-lib, and Resend.
 */
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  generateSigningToken,
  isSignableRole,
  RECIPIENT_ROLE_LABEL,
  type EnvelopeField,
  type RecipientRole,
} from './signing'
import { sealEnvelope, type SealDocumentInput, type SealRecipientSummary } from './seal-pdf'
import { sendSigningInvite, sendCompletionCopy, sendBrokerSignedNotice } from './signing-emails'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbRow = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any, any, any>

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
}

/**
 * After a recipient finishes: if the whole envelope is signed, seal it. Else if
 * the current signing-order group just finished, mint + email the next group.
 * Returns true when the envelope was completed (sealed) by this call.
 */
export async function advanceOrSeal(supabase: Sb, envelopeId: string): Promise<boolean> {
  const { data: recips } = await supabase.from('tc_envelope_recipients').select('*').eq('envelope_id', envelopeId)
  const signable = ((recips ?? []) as DbRow[]).filter((r) => isSignableRole(r.role))
  const allSigned = signable.length > 0 && signable.every((r) => r.completed_at)

  if (allSigned) {
    await sealAndCompleteEnvelope(supabase, envelopeId)
    return true
  }

  await supabase.from('tc_envelopes').update({ status: 'partially_signed' }).eq('id', envelopeId)

  const pendingOrders = signable.filter((r) => !r.completed_at).map((r) => r.signing_order ?? 1)
  if (!pendingOrders.length) return false
  const nextOrder = Math.min(...pendingOrders)
  const toNotify = signable.filter(
    (r) => (r.signing_order ?? 1) === nextOrder && !r.completed_at && !r.auth_token_hash && !r.viewed_at
  )
  if (toNotify.length) {
    const { data: env } = await supabase.from('tc_envelopes').select('name, cycle_id').eq('id', envelopeId).maybeSingle()
    const { data: cycle } = await supabase
      .from('tc_cycles')
      .select('broker_name, tc_deals(address)')
      .eq('id', (env as DbRow)?.cycle_id)
      .maybeSingle()
    const address = (cycle as DbRow)?.tc_deals?.address ?? 'your transaction'
    for (const r of toNotify) {
      const { token, hash } = generateSigningToken()
      await supabase.from('tc_envelope_recipients').update({ auth_token_hash: hash }).eq('id', r.id)
      await sendSigningInvite({
        to: r.email,
        recipientName: r.name || 'there',
        envelopeName: (env as DbRow)?.name ?? 'documents',
        propertyAddress: address,
        signUrl: `${siteUrl()}/sign/${token}`,
      })
    }
  }
  return false
}

/** Flatten signatures, append the certificate, store the executed doc, notify. */
export async function sealAndCompleteEnvelope(supabase: Sb, envelopeId: string): Promise<void> {
  const { data: env } = await supabase.from('tc_envelopes').select('*').eq('id', envelopeId).maybeSingle()
  if (!env || env.status === 'completed') return

  const { data: cycle } = await supabase
    .from('tc_cycles')
    .select('id, deal_id, source_guid, broker_name, tc_deals(address, property_key)')
    .eq('id', env.cycle_id)
    .maybeSingle()
  const address = (cycle as DbRow)?.tc_deals?.address ?? 'transaction'

  const [{ data: envDocs }, { data: fields }, { data: recips }] = await Promise.all([
    supabase.from('tc_envelope_documents').select('document_id, sort_order').eq('envelope_id', envelopeId).order('sort_order'),
    supabase.from('tc_envelope_fields').select('*').eq('envelope_id', envelopeId),
    supabase.from('tc_envelope_recipients').select('*').eq('envelope_id', envelopeId).order('signing_order'),
  ])

  const docIds = ((envDocs ?? []) as DbRow[]).map((d) => d.document_id)
  const docMeta = new Map<string, DbRow>()
  if (docIds.length) {
    const { data: docs } = await supabase.from('tc_documents').select('id, name, storage_path').in('id', docIds)
    for (const d of (docs ?? []) as DbRow[]) docMeta.set(d.id, d)
  }

  const fieldsByDoc = new Map<string, EnvelopeField[]>()
  for (const f of (fields ?? []) as DbRow[]) {
    const ef: EnvelopeField = {
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
    }
    const arr = fieldsByDoc.get(f.document_id) ?? []
    arr.push(ef)
    fieldsByDoc.set(f.document_id, arr)
  }

  const sealDocs: SealDocumentInput[] = []
  for (const ed of (envDocs ?? []) as DbRow[]) {
    const meta = docMeta.get(ed.document_id)
    if (!meta?.storage_path) continue
    const { data: blob } = await supabase.storage.from('tc-documents').download(meta.storage_path)
    if (!blob) continue
    const bytes = new Uint8Array(await blob.arrayBuffer())
    sealDocs.push({ bytes, name: meta.name ?? 'document.pdf', fields: fieldsByDoc.get(ed.document_id) ?? [] })
  }
  if (!sealDocs.length) {
    await supabase.from('tc_events').insert({
      cycle_id: env.cycle_id,
      actor: 'system',
      action: 'envelope_seal_failed',
      detail: { envelope: env.name, reason: 'no readable source documents' },
    })
    return
  }

  const recipSummaries: SealRecipientSummary[] = ((recips ?? []) as DbRow[]).map((r) => ({
    name: r.name ?? '',
    email: r.email ?? '',
    roleLabel: RECIPIENT_ROLE_LABEL[r.role as RecipientRole] ?? r.role,
    signingOrder: r.signing_order ?? 1,
    consentedAt: r.consented_at,
    viewedAt: r.viewed_at,
    completedAt: r.completed_at,
    ip: r.ip,
    userAgent: r.user_agent,
  }))

  const sealedAtIso = new Date().toISOString()
  const { bytes, sha256 } = await sealEnvelope({
    envelopeId,
    envelopeName: env.name,
    documents: sealDocs,
    recipients: recipSummaries,
    sealedAtIso,
  })

  const execDocId = randomUUID()
  const sealName = `Signed — ${env.name}`.slice(0, 140)
  const storagePath = `tc/${(cycle as DbRow)?.source_guid ?? 'unknown'}/executed/${envelopeId}__signed.pdf`
  const { error: upErr } = await supabase.storage
    .from('tc-documents')
    .upload(storagePath, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true })
  if (upErr) {
    await supabase.from('tc_events').insert({
      cycle_id: env.cycle_id,
      actor: 'system',
      action: 'envelope_seal_failed',
      detail: { envelope: env.name, reason: upErr.message },
    })
    return
  }

  await supabase.from('tc_documents').insert({
    id: execDocId,
    cycle_id: env.cycle_id,
    name: sealName,
    original_name: sealName,
    storage_path: storagePath,
    sha256,
    bytes: bytes.byteLength,
    content_type: 'application/pdf',
    source_uploaded_at: sealedAtIso,
    classification: { source: 'envelope_executed', envelope_id: envelopeId },
  })

  await supabase
    .from('tc_envelopes')
    .update({
      status: 'completed',
      completed_at: sealedAtIso,
      sealed_sha256: sha256,
      executed_document_id: execDocId,
      certificate_storage_path: storagePath,
    })
    .eq('id', envelopeId)

  await supabase.from('tc_events').insert({
    deal_id: (cycle as DbRow)?.deal_id ?? null,
    cycle_id: env.cycle_id,
    document_id: execDocId,
    actor: 'system',
    action: 'envelope_completed',
    detail: { envelope: env.name, sha256_prefix: sha256.slice(0, 12), signers: recipSummaries.length },
  })

  const pdfBuf = Buffer.from(bytes)
  const pdfName = `${sealName}.pdf`.replace(/[^\w.\- ]+/g, '')
  const seen = new Set<string>()
  for (const r of (recips ?? []) as DbRow[]) {
    const email = (r.email ?? '').trim().toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)
    await sendCompletionCopy({
      to: email,
      recipientName: r.name || 'there',
      envelopeName: env.name,
      propertyAddress: address,
      pdf: pdfBuf,
      pdfName,
    })
  }
  const brokerEmail = env.created_by && env.created_by.includes('@') ? env.created_by : null
  if (brokerEmail && !seen.has(brokerEmail.toLowerCase())) {
    await sendBrokerSignedNotice({
      to: brokerEmail,
      envelopeName: env.name,
      propertyAddress: address,
      signerName: 'Every party',
      remaining: 0,
      dealUrl: `${siteUrl()}/admin/deals/${encodeURIComponent((cycle as DbRow)?.tc_deals?.property_key ?? '')}`,
    })
  }
}
