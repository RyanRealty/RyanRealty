'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

/**
 * TC forms library + envelope scaffolding (Phase 2b — composer/signing).
 * Brokers never build forms: envelopes instantiate VERIFIED templates
 * (tc_form_versions.field_map), so signature placement is correct by
 * construction. See docs/TC_SYSTEM.md + memory tc-form-prep-agent-driven.
 */

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- PostgREST rows narrow at mapping sites
type DbRow = Record<string, any>

export type TcFormVersion = {
  id: string
  libraryCode: string
  form_number: string | null
  name: string
  effective_date: string | null
  page_count: number | null
  field_map_source: 'acroform' | 'manual' | 'imported'
  fieldCount: number
  signatureFieldCount: number
  signer_profile: string | null
  isSample: boolean
  blankUrl: string | null
}

export type TcFormLibrary = {
  id: string
  code: string
  name: string
  license_note: string | null
  forms: TcFormVersion[]
}

export async function getTcFormLibraries(search?: string): Promise<TcFormLibrary[]> {
  const supabase = getServiceSupabase()
  const [{ data: libs }, { data: versions }] = await Promise.all([
    supabase.from('tc_form_libraries').select('*').order('code'),
    supabase
      .from('tc_form_versions')
      .select('id, library_id, form_number, name, effective_date, page_count, field_map, field_map_source, signer_profile, blank_pdf_storage_path')
      .is('retired_at', null)
      .order('form_number', { ascending: true }),
  ])

  const term = (search ?? '').trim().toLowerCase()
  const filtered = ((versions ?? []) as DbRow[]).filter(
    (v) => !term || `${v.form_number ?? ''} ${v.name}`.toLowerCase().includes(term)
  )

  // one batched signed-URL call for the blanks (open-form preview links)
  const paths = filtered.map((v) => v.blank_pdf_storage_path).filter(Boolean) as string[]
  const urlByPath = new Map<string, string>()
  if (paths.length) {
    const { data: signed } = await supabase.storage.from('tc-documents').createSignedUrls(paths, 600)
    for (const s of signed ?? []) if (s.signedUrl && !s.error) urlByPath.set(s.path ?? '', s.signedUrl)
  }

  return ((libs ?? []) as DbRow[]).map((l) => ({
    id: l.id,
    code: l.code,
    name: l.name,
    license_note: l.license_note,
    forms: filtered
      .filter((v) => v.library_id === l.id)
      .map((v) => {
        const fields = (v.field_map ?? []) as Array<{ type?: string }>
        return {
          id: v.id,
          libraryCode: l.code,
          form_number: v.form_number,
          name: v.name,
          effective_date: v.effective_date,
          page_count: v.page_count,
          field_map_source: v.field_map_source,
          fieldCount: fields.length,
          signatureFieldCount: fields.filter((f) => ['signature', 'initials', 'date_signed'].includes(f.type ?? '')).length,
          signer_profile: v.signer_profile,
          isSample: /\(SAMPLE/i.test(v.name),
          blankUrl: v.blank_pdf_storage_path ? (urlByPath.get(v.blank_pdf_storage_path) ?? null) : null,
        }
      }),
  }))
}

export type DraftEnvelopeResult = { ok: boolean; envelopeId?: string; error?: string }

/**
 * Scaffold a draft envelope on a cycle from chosen form versions.
 * Recipients are pre-created from the cycle's parties (names from SkySlope;
 * emails get filled in the review UI before send). Nothing emails from here —
 * envelopes leave 'draft' only through the broker review gate.
 */
export async function createDraftEnvelope(
  cycleId: string,
  formVersionIds: string[],
  envelopeName?: string
): Promise<DraftEnvelopeResult> {
  const session = await getSession()
  const role = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!role || (role.role !== 'superuser' && role.role !== 'broker')) {
    return { ok: false, error: 'Not authorized' }
  }
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
    .select('id, name, form_number')
    .in('id', formVersionIds)
  if (!forms?.length) return { ok: false, error: 'Forms not found' }

  const name =
    envelopeName?.trim() ||
    `${(cycle as DbRow).tc_deals?.address ?? 'Deal'} — ${forms.map((f) => f.form_number || f.name).join(', ')}`

  const { data: envelope, error: envErr } = await supabase
    .from('tc_envelopes')
    .insert({ cycle_id: cycleId, name, status: 'draft', created_by: session?.user?.email ?? 'admin' })
    .select('id')
    .single()
  if (envErr) return { ok: false, error: envErr.message }

  // recipients from parties (emails completed in review UI)
  const recipients: DbRow[] = []
  ;((cycle.sellers ?? []) as string[]).forEach((n, i) =>
    recipients.push({ envelope_id: envelope.id, role: `seller${i + 1}`, name: n, email: '', signing_order: 1 })
  )
  ;((cycle.buyers ?? []) as string[]).forEach((n, i) =>
    recipients.push({ envelope_id: envelope.id, role: `buyer${i + 1}`, name: n, email: '', signing_order: 1 })
  )
  if (cycle.broker_name)
    recipients.push({
      envelope_id: envelope.id,
      role: 'listing_broker',
      name: cycle.broker_name,
      email: session?.user?.email ?? '',
      signing_order: 2,
    })
  if (recipients.length) await supabase.from('tc_envelope_recipients').insert(recipients)

  await supabase.from('tc_events').insert({
    deal_id: cycle.deal_id,
    cycle_id: cycleId,
    actor: session?.user?.email ?? 'admin',
    action: 'envelope_drafted',
    detail: { envelope: name, forms: forms.map((f) => f.form_number || f.name), recipients: recipients.length },
  })

  revalidatePath('/admin/deals')
  return { ok: true, envelopeId: envelope.id }
}
