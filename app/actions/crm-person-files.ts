'use server'

/**
 * §7c.8.8 Files widget actions — split out of crm-person-detail.ts when that
 * module crossed the 600-LOC budget (2026-07-02, punch-list slice). Byte-
 * identical move; the split-not-rebaseline convention from the reporting slice.
 */

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import type { PersonDetailResult } from '@/app/actions/crm-person-detail'

const BASE = '/admin/console/leads'

export async function addPersonFileLinkAction(
  personId: number,
  title: string,
  url: string,
): Promise<PersonDetailResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const scope = await requirePersonInScope(personId, access)
  if (!scope.ok) return scope
  const cleanUrl = url.trim()
  if (!/^https?:\/\//i.test(cleanUrl)) return { ok: false, error: 'Enter a full URL (https://…).' }
  const sb = createServiceClient()
  const { error } = await sb.from('crm_person_files').insert({
    person_id: personId,
    name: title.trim() || cleanUrl,
    kind: 'link',
    url: cleanUrl,
    uploaded_by: access.email,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`${BASE}/${personId}`)
  return { ok: true }
}

const BLOCKED_EXT = ['.exe', '.vb', '.bat', '.cmd']
const MAX_FILE_BYTES = 100 * 1024 * 1024

export async function uploadPersonFileAction(formData: FormData): Promise<PersonDetailResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const personId = Number(formData.get('personId'))
  const file = formData.get('file') as File | null
  if (!Number.isFinite(personId) || personId <= 0) return { ok: false, error: 'Bad person id' }
  const scope = await requirePersonInScope(personId, access)
  if (!scope.ok) return scope
  if (!file || file.size === 0) return { ok: false, error: 'Choose a file.' }
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: 'Max file size is 100 MB.' }
  const lower = file.name.toLowerCase()
  if (BLOCKED_EXT.some((ext) => lower.endsWith(ext))) {
    return { ok: false, error: `File type not allowed (${BLOCKED_EXT.join(', ')}).` }
  }

  const sb = createServiceClient()
  const path = `person-${personId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`
  const { error: upErr } = await sb.storage
    .from('crm-files')
    .upload(path, file, { contentType: file.type || 'application/octet-stream' })
  if (upErr) return { ok: false, error: upErr.message }

  // Private bucket: the DAL read generates short-lived signed URLs from storage_path.
  const { error } = await sb.from('crm_person_files').insert({
    person_id: personId,
    name: file.name,
    kind: 'file',
    url: null,
    storage_path: path,
    size_bytes: file.size,
    uploaded_by: access.email,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`${BASE}/${personId}`)
  return { ok: true }
}

export async function deletePersonFileAction(fileId: number): Promise<PersonDetailResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const sb = createServiceClient()
  const { data: row } = await sb
    .from('crm_person_files')
    .select('id, storage_path, person_id')
    .eq('id', fileId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'File not found.' }
  const scope = await requirePersonInScope(Number(row.person_id), access)
  if (!scope.ok) return scope
  if (row.storage_path) await sb.storage.from('crm-files').remove([row.storage_path])
  const { error } = await sb.from('crm_person_files').delete().eq('id', fileId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`${BASE}/${Number(row.person_id)}`)
  return { ok: true }
}

