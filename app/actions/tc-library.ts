'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getFormVersionBlankRow, listLiveFormVersionsForMapping } from '@/lib/data/tc/form-library-reads'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

export type { FormPacket, ClauseRow } from '@/lib/data/tc/form-library-reads'

async function requireEditor() {
  const session = await getSession()
  const email = session?.user?.email ?? null
  const role = await getAdminRoleForEmail(email)
  if (!email || !role || (role.role !== 'superuser' && role.role !== 'broker')) {
    return { error: 'Not authorized' as const }
  }
  return { email }
}

export async function saveFormPacket(name: string, formVersionIds: string[]): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireEditor()
  if ('error' in auth) return { ok: false, error: auth.error }
  const n = name.trim()
  if (!n || !formVersionIds.length) return { ok: false, error: 'Name and at least one form.' }
  const { error } = await createServiceClient().from('tc_form_packets').insert({
    name: n,
    form_version_ids: formVersionIds,
    created_by: auth.email,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/forms')
  return { ok: true }
}

export async function saveClause(input: {
  scope: 'personal' | 'brokerage'
  category: string
  title: string
  body: string
}): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireEditor()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!input.title.trim() || !input.body.trim()) return { ok: false, error: 'Title and body required.' }
  const { error } = await createServiceClient().from('tc_clauses').insert({
    scope: input.scope,
    category: input.category.trim() || 'General',
    title: input.title.trim(),
    body: input.body.trim(),
    created_by: auth.email,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/forms')
  revalidatePath('/admin/signing')
  return { ok: true }
}

export async function replaceFormBlankPdf(formVersionId: string, formData: FormData): Promise<{ ok: boolean; error?: string; fields?: number }> {
  const auth = await requireEditor()
  if ('error' in auth) return { ok: false, error: auth.error }
  const file = formData.get('blank')
  if (!(file instanceof File) || file.size < 100) return { ok: false, error: 'Upload a PDF blank.' }
  const bytes = Buffer.from(await file.arrayBuffer())
  const sha256 = (await import('node:crypto')).createHash('sha256').update(bytes).digest('hex')
  const sb = createServiceClient()
  const row = await getFormVersionBlankRow(formVersionId)
  if (!row) return { ok: false, error: 'Form version not found' }
  const { fieldMapFromAcroFormPdf } = await import('@/lib/tc/acroform-field-map')
  const { fallbackSigningStack } = await import('@/lib/tc/fallback-signing-stack')
  const { PDFDocument } = await import('pdf-lib')
  let pageCount = row.page_count ?? 1
  try {
    pageCount = (await PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount() || pageCount
  } catch {
    /* keep existing */
  }
  let map = [] as Awaited<ReturnType<typeof fieldMapFromAcroFormPdf>>
  try {
    map = await fieldMapFromAcroFormPdf(new Uint8Array(bytes))
  } catch {
    map = []
  }
  const source = map.length ? 'acroform' : 'fallback_stack'
  if (!map.length) {
    map = fallbackSigningStack({
      pageCount,
      formNumber: row.form_number,
      signerProfile: row.signer_profile,
      documentName: row.name,
    })
  }
  const path = `uploads/${formVersionId}/${sha256.slice(0, 12)}.pdf`
  const up = await sb.storage.from(process.env.TC_FORMS_BUCKET ?? 'tc-forms').upload(path, bytes, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (up.error) return { ok: false, error: up.error.message }
  const cleanName = String(row.name ?? '').replace(/\s*\(SAMPLE.*$/i, '').trim() || row.name
  const { error } = await sb
    .from('tc_form_versions')
    .update({
      name: cleanName,
      blank_pdf_storage_path: path,
      sha256,
      page_count: pageCount,
      field_map: map,
      field_map_source: source,
      update_available: false,
      source_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', formVersionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/forms')
  return { ok: true, fields: map.length }
}

export async function rebuildLibraryFieldMaps(): Promise<{ ok: boolean; error?: string; mapped?: number; scanned?: number }> {
  const auth = await requireEditor()
  if ('error' in auth) return { ok: false, error: auth.error }
  const sb = createServiceClient()
  const versions = await listLiveFormVersionsForMapping()
  const { fieldMapFromAcroFormPdf } = await import('@/lib/tc/acroform-field-map')
  const { fallbackSigningStack } = await import('@/lib/tc/fallback-signing-stack')
  let mapped = 0
  const bucket = process.env.TC_FORMS_BUCKET ?? 'tc-forms'
  for (const v of versions) {
    const existing = Array.isArray(v.field_map) ? v.field_map : []
    if (existing.length) continue
    if (!v.blank_pdf_storage_path) continue
    let map: Awaited<ReturnType<typeof fieldMapFromAcroFormPdf>> = []
    try {
      const { data: blob } = await sb.storage.from(bucket).download(String(v.blank_pdf_storage_path))
      if (blob) map = await fieldMapFromAcroFormPdf(new Uint8Array(await blob.arrayBuffer()))
    } catch {
      map = []
    }
    const source = map.length ? 'acroform' : 'fallback_stack'
    if (!map.length) {
      map = fallbackSigningStack({
        pageCount: Number(v.page_count) || 1,
        formNumber: v.form_number,
        signerProfile: v.signer_profile,
        documentName: v.name,
      })
    }
    const { error } = await sb
      .from('tc_form_versions')
      .update({ field_map: map, field_map_source: source, updated_at: new Date().toISOString() })
      .eq('id', v.id)
    if (!error) mapped++
  }
  revalidatePath('/admin/forms')
  return { ok: true, mapped, scanned: versions?.length ?? 0 }
}
