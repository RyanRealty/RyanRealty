import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { getAdminContext } from '@/lib/auth/guards'

/**
 * The documents under the one checklist item the principal broker is
 * reviewing (app/admin/(protected)/sign-off/review). The queue read
 * (getPrincipalSignOffQueue) carries names only; this adds what the review
 * screen shows beside the PDF: the reader's verdict (classification), page
 * count, size, upload date, and whether a stored file exists to open.
 *
 * Principal broker only, like the queue it serves.
 */
export type ReviewDocument = {
  id: string
  name: string
  hasFile: boolean
  pageCount: number | null
  bytes: number | null
  uploadedAt: string | null
  archived: boolean
  classification: Record<string, unknown>
}

const MAX_DOCS = 20

export async function getReviewDocuments(documentIds: string[]): Promise<ReviewDocument[]> {
  const ctx = await getAdminContext()
  if (ctx?.role !== 'superuser') return []
  const ids = Array.from(new Set(documentIds.filter(Boolean))).slice(0, MAX_DOCS)
  if (!ids.length) return []

  const { data, error } = await createServiceClient()
    .from('tc_documents')
    .select('id, name, storage_path, page_count, bytes, source_uploaded_at, archived, classification')
    .in('id', ids)
  if (error) throw new Error(`getReviewDocuments: ${error.message}`)

  const byId = new Map((data ?? []).map((d) => [String(d.id), d]))
  // Keep the checklist's order, not the database's.
  return ids.flatMap((id) => {
    const d = byId.get(id)
    if (!d) return []
    return [
      {
        id,
        name: String(d.name ?? ''),
        hasFile: Boolean(d.storage_path),
        pageCount: d.page_count == null ? null : Number(d.page_count),
        bytes: d.bytes == null ? null : Number(d.bytes),
        uploadedAt: d.source_uploaded_at == null ? null : String(d.source_uploaded_at),
        archived: Boolean(d.archived),
        classification: (d.classification as Record<string, unknown> | null) ?? {},
      },
    ]
  })
}
