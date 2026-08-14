'use server'

/**
 * Track 2 slice B — one OREF: fill from tc_* deal facts → email Matt → seal.
 * No SkySlope client. No client send. Brokers never build forms.
 */

import { createHash, randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import {
  getCycleDealId,
  getEnvelopeIdForDocument,
  getMattMailboxPersonId,
  getOrefCycleForFill,
  getOrefCycleForSeal,
  getOrefDealForFill,
  getOrefDocumentRow,
  getOrefFormVersionRow,
  loadPreferredOrefForm,
} from '@/lib/data/tc/oref-packet-reads'
import { revalidatePath } from 'next/cache'
import { checkAdminAction } from '@/lib/admin/require-admin'
import { sendGovernedEmail } from '@/lib/comms/sendGovernedEmail'
import {
  coverRowsFromFacts,
  dealFactsFromRows,
  mapDealFactsToFillValues,
  type FillableField,
} from '@/lib/tc/oref-fill'
import { buildFilledOrefPdf } from '@/lib/tc/oref-fill-pdf'
import { MATT_OWNED_MAILBOX, planOrefMattEmail } from '@/lib/tc/oref-matt-email'
import { sealEnvelope } from '@/lib/tc/seal-pdf'

type DbRow = Record<string, unknown>
type Sb = SupabaseClient

function getServiceSupabase(): Sb | null {
  try {
    return createServiceClient()
  } catch {
    return null
  }
}

async function requireEditor(): Promise<{ email: string } | { error: string }> {
  const gate = await checkAdminAction('transactions.edit')
  if (!gate.ok) return { error: gate.error }
  const email = gate.ctx.email?.trim()
  if (!email) return { error: 'Admin sign-in required.' }
  return { email }
}

function asString(v: unknown): string {
  return v == null ? '' : String(v)
}

export type PreferredOrefForm = {
  id: string
  formNumber: string
  name: string
  fieldCount: number
}

async function downloadBlank(sb: Sb, path: string): Promise<Uint8Array | null> {
  for (const bucket of ['tc-documents', 'tc-forms'] as const) {
    const { data, error } = await sb.storage.from(bucket).download(path)
    if (error || !data) continue
    return new Uint8Array(await data.arrayBuffer())
  }
  return null
}

export type FillOrefResult = {
  documentId: string
  formNumber: string
  formName: string
  filledKeys: string[]
  omittedFactKeys: string[]
}

export async function fillOrefSaleAgreementFromDeal(
  cycleId: string,
): Promise<{ data: FillOrefResult | null; error: string | null }> {
  try {
    const auth = await requireEditor()
    if ('error' in auth) return { data: null, error: auth.error }
    const sb = getServiceSupabase()
    if (!sb) return { data: null, error: 'Database is not configured.' }
    if (!cycleId.trim()) return { data: null, error: 'Cycle is required.' }

    const form = await loadPreferredOrefForm()
    if (!form?.blankPath) return { data: null, error: 'No OREF sale agreement blank is on file.' }

    const cycleRes = await getOrefCycleForFill(cycleId)
    if (cycleRes.error) return { data: null, error: cycleRes.error }
    const cycle = cycleRes.data
    if (!cycle) return { data: null, error: 'Cycle not found.' }

    const dealRes = await getOrefDealForFill(asString(cycle.deal_id))
    if (dealRes.error) return { data: null, error: dealRes.error }
    const deal = dealRes.data
    if (!deal) return { data: null, error: 'Deal not found.' }

    const versionRow = await getOrefFormVersionRow(form.id)

    const facts = dealFactsFromRows(deal as never, cycle as never)
    const fieldMap = (versionRow?.field_map ?? []) as FillableField[]
    const mapped = mapDealFactsToFillValues(facts, fieldMap)
    const coverRows = coverRowsFromFacts(facts)

    const blank = await downloadBlank(sb, form.blankPath)
    if (!blank) return { data: null, error: 'The OREF blank PDF could not be loaded.' }

    const bytes = await buildFilledOrefPdf({
      blankBytes: blank,
      formNumber: form.formNumber ?? '001',
      formName: form.name,
      coverRows,
      overlays: mapped.filled,
    })

    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const docId = randomUUID()
    const formNumber = form.formNumber ?? '001'
    const storagePath = `tc/${asString(cycle.source_guid) || 'unknown'}/oref-fill/${form.id}__filled.pdf`
    const { error: upErr } = await sb.storage
      .from('tc-documents')
      .upload(storagePath, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true })
    if (upErr) {
      console.error('[fillOrefSaleAgreementFromDeal]', upErr)
      return { data: null, error: 'Could not store the filled PDF.' }
    }

    const { error: docErr } = await sb.from('tc_documents').insert({
      id: docId,
      cycle_id: cycleId,
      name: `Filled OREF ${formNumber} — ${asString(deal.address)}`.slice(0, 140),
      original_name: `OREF-${formNumber}-filled.pdf`,
      storage_path: storagePath,
      sha256,
      bytes: bytes.byteLength,
      content_type: 'application/pdf',
      classification: {
        source: 'oref_fill',
        form_version_id: form.id,
        form_number: formNumber,
      },
    })
    if (docErr) {
      console.error('[fillOrefSaleAgreementFromDeal]', docErr)
      return { data: null, error: 'Could not file the filled PDF on the cycle.' }
    }

    const envName = `OREF ${formNumber} for Matt — ${asString(deal.address)}`.slice(0, 140)
    const { data: env, error: envErr } = await sb
      .from('tc_envelopes')
      .insert({ cycle_id: cycleId, name: envName, status: 'draft', created_by: auth.email })
      .select('id')
      .single()
    if (!envErr && env) {
      await sb.from('tc_envelope_documents').insert({
        envelope_id: env.id,
        document_id: docId,
        sort_order: 0,
        form_version_id: form.id,
      })
      await sb.from('tc_envelope_recipients').insert({
        envelope_id: env.id,
        role: 'listing_broker',
        name: 'Matt Ryan',
        email: MATT_OWNED_MAILBOX,
        signing_order: 1,
      })
    }

    await sb.from('tc_events').insert({
      deal_id: cycle.deal_id,
      cycle_id: cycleId,
      document_id: docId,
      actor: auth.email,
      action: 'oref_filled',
      detail: {
        form_number: formNumber,
        filled_keys: coverRows.map((r) => r.factKey),
        omitted_fact_keys: mapped.omittedFactKeys,
      },
    })

    revalidatePath('/admin/deals')
    revalidatePath('/admin/closings')
    return {
      data: {
        documentId: docId,
        formNumber,
        formName: form.name,
        filledKeys: coverRows.map((r) => r.factKey),
        omittedFactKeys: mapped.omittedFactKeys,
      },
      error: null,
    }
  } catch (err) {
    console.error('[fillOrefSaleAgreementFromDeal]', err)
    return { data: null, error: 'Could not fill the OREF from deal facts.' }
  }
}

export async function emailOrefPacketToMatt(
  documentId: string,
  opts?: { to?: string[] },
): Promise<{ error: string | null }> {
  try {
    const auth = await requireEditor()
    if ('error' in auth) return { error: auth.error }
    const planned = planOrefMattEmail(opts?.to)
    if (!planned.ok) return { error: planned.error }

    const sb = getServiceSupabase()
    if (!sb) return { error: 'Database is not configured.' }
    if (!documentId.trim()) return { error: 'Document is required.' }

    const docRes = await getOrefDocumentRow(documentId)
    if (docRes.error) return { error: docRes.error }
    const doc = docRes.data
    if (!doc?.storage_path) return { error: 'Filled packet not found.' }

    const { data: blob, error: dlErr } = await sb.storage.from('tc-documents').download(asString(doc.storage_path))
    if (dlErr || !blob) return { error: 'Could not load the filled PDF.' }
    const bytes = Buffer.from(await blob.arrayBuffer())

    const personId = await getMattMailboxPersonId(MATT_OWNED_MAILBOX)
    if (personId == null) {
      return { error: 'Matt mailbox is not linked to a CRM person. Packet was not sent.' }
    }

    const sent = await sendGovernedEmail({
      personId,
      purpose: 'tc:oref-packet-matt',
      idempotencyKey: `oref-packet:${documentId}`,
      initiator: { kind: 'broker', broker: 'matt' },
      payload: {
        rail: 'gmail',
        to: planned.to,
        subject: asString(doc.name) || 'Filled OREF packet',
        bodyText:
          'Filled OREF packet from deal facts on the in-house TC. Missing fields were omitted. This is a Matt-owned copy, not a client send. Review, then seal on the deal.',
        withSignature: false,
        attachments: [{ filename: 'OREF-filled.pdf', content: bytes, mimeType: 'application/pdf' }],
        primaryAddress: MATT_OWNED_MAILBOX,
      },
    })
    if (!sent.ok) return { error: sent.error }

    const emailedDealId = await getCycleDealId(asString(doc.cycle_id))
    await sb.from('tc_events').insert({
      deal_id: emailedDealId,
      cycle_id: doc.cycle_id,
      document_id: documentId,
      actor: auth.email,
      action: 'oref_emailed_matt',
      detail: { to: planned.to, providerId: sent.providerId ?? null },
    })
    revalidatePath('/admin/deals')
    return { error: null }
  } catch (err) {
    console.error('[emailOrefPacketToMatt]', err)
    return { error: 'Could not email the packet to Matt.' }
  }
}

export async function sealOrefPacket(
  documentId: string,
): Promise<{ data: { sealedDocumentId: string; sha256: string } | null; error: string | null }> {
  try {
    const auth = await requireEditor()
    if ('error' in auth) return { data: null, error: auth.error }
    const sb = getServiceSupabase()
    if (!sb) return { data: null, error: 'Database is not configured.' }
    if (!documentId.trim()) return { data: null, error: 'Document is required.' }

    const docRes = await getOrefDocumentRow(documentId)
    if (docRes.error) return { data: null, error: docRes.error }
    const doc = docRes.data
    if (!doc?.storage_path) return { data: null, error: 'Filled packet not found.' }

    const cycle = await getOrefCycleForSeal(asString(doc.cycle_id))
    if (!cycle) return { data: null, error: 'Cycle not found.' }

    const { data: blob, error: dlErr } = await sb.storage.from('tc-documents').download(asString(doc.storage_path))
    if (dlErr || !blob) return { data: null, error: 'Could not load the filled PDF.' }
    const sourceBytes = new Uint8Array(await blob.arrayBuffer())

    const sealedAtIso = new Date().toISOString()
    const envelopeId = randomUUID()
    const { bytes, sha256 } = await sealEnvelope({
      envelopeId,
      envelopeName: asString(doc.name) || 'OREF packet',
      documents: [{ bytes: sourceBytes, name: asString(doc.name) || 'OREF-filled.pdf', fields: [] }],
      recipients: [
        {
          name: 'Matt Ryan',
          email: MATT_OWNED_MAILBOX,
          roleLabel: 'Principal broker',
          signingOrder: 1,
          consentedAt: sealedAtIso,
          viewedAt: sealedAtIso,
          completedAt: sealedAtIso,
          ip: null,
          userAgent: null,
        },
      ],
      sealedAtIso,
    })

    const sealedId = randomUUID()
    const storagePath = `tc/${asString(cycle.source_guid) || 'unknown'}/oref-fill/${documentId}__sealed.pdf`
    const { error: upErr } = await sb.storage
      .from('tc-documents')
      .upload(storagePath, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true })
    if (upErr) {
      console.error('[sealOrefPacket]', upErr)
      return { data: null, error: 'Could not store the sealed PDF.' }
    }

    const { error: insErr } = await sb.from('tc_documents').insert({
      id: sealedId,
      cycle_id: cycle.id,
      name: `Sealed — ${asString(doc.name)}`.slice(0, 140),
      original_name: 'OREF-sealed.pdf',
      storage_path: storagePath,
      sha256,
      bytes: bytes.byteLength,
      content_type: 'application/pdf',
      source_uploaded_at: sealedAtIso,
      classification: { source: 'oref_sealed', source_document_id: documentId },
    })
    if (insErr) {
      console.error('[sealOrefPacket]', insErr)
      return { data: null, error: 'Could not file the sealed PDF.' }
    }

    const envelopeIdForDoc = await getEnvelopeIdForDocument(documentId)
    if (envelopeIdForDoc) {
      await sb
        .from('tc_envelopes')
        .update({
          status: 'completed',
          completed_at: sealedAtIso,
          sealed_sha256: sha256,
          executed_document_id: sealedId,
          certificate_storage_path: storagePath,
        })
        .eq('id', envelopeIdForDoc)
    }

    await sb.from('tc_events').insert({
      deal_id: cycle.deal_id,
      cycle_id: cycle.id,
      document_id: sealedId,
      actor: auth.email,
      action: 'oref_sealed',
      detail: { source_document_id: documentId, sha256_prefix: sha256.slice(0, 12) },
    })

    revalidatePath('/admin/deals')
    revalidatePath('/admin/closings')
    return { data: { sealedDocumentId: sealedId, sha256 }, error: null }
  } catch (err) {
    console.error('[sealOrefPacket]', err)
    return { data: null, error: 'Could not seal the packet.' }
  }
}
