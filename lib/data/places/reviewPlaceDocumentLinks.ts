/**
 * The review write for PLACE_CONTENT_RULES R7 — one published name at a time.
 *
 * WHY THE GROUP NAME IS THE ARGUMENT, NOT A LIST OF LINK IDS. A group can carry
 * hundreds of pending links (Ridge at Eagle Crest: 57 plats), and a form that
 * posts them all is both a large payload and a stale one — the ids were read
 * when the page rendered. Passing the group's published name lets the write
 * re-resolve the pending set at the moment it acts, so a link reviewed in
 * another tab a second ago is simply no longer pending and is not touched.
 *
 * WHY APPROVE FILTERS BY doc_kind BEFORE IT WRITES. `place_document_link_publish_gate()`
 * refuses to publish a link whose document is not a governing instrument, with
 * no human override — a warranty deed is not a subdivision's CC&Rs no matter
 * who approves it. A statement that includes one deed fails ENTIRELY, taking
 * the whole group's real declarations down with it. So the non-governing links
 * are excluded from the approve set here and offered only rejection.
 *
 * The trigger is still the authority: it fires on every row of every statement
 * below, and its exception is returned as a typed error rather than thrown, so
 * a reclassification racing this write reports itself instead of 500ing the
 * review queue.
 */

import { createServiceClient } from '@/lib/data/client'
import { isGoverningDocKind } from '@/lib/data/places/getPendingPlaceDocuments'

/** UUID `in.(…)` chunk — 40 ids is a ~1.5 KB query string. */
const IN_CHUNK = 40
const READ_PAGE = 1000

export type PlaceDocumentReviewResult =
  | {
      ok: true
      /** Links whose status actually changed. */
      changed: number
      /** Links left pending because their document is not a governing instrument. */
      skipped: number
    }
  | { ok: false; error: string; changed: number }

type DocRow = { id: string; doc_kind: string }

/** Every document the source filed under this published name. */
async function documentsForName(publishedName: string): Promise<DocRow[]> {
  const supabase = createServiceClient()
  const out: DocRow[] = []
  let last = '00000000-0000-0000-0000-000000000000'
  for (;;) {
    const { data, error } = await supabase
      .from('place_document')
      .select('id, doc_kind')
      .eq('published_name', publishedName)
      .gt('id', last)
      .order('id', { ascending: true })
      .limit(READ_PAGE)
    if (error) throw new Error(`place_document read failed: ${error.message}`)
    const rows = (data ?? []) as DocRow[]
    if (!rows.length) break
    out.push(...rows)
    last = rows[rows.length - 1].id
    if (rows.length < READ_PAGE) break
  }
  return out
}

/**
 * Move this group's still-pending links to `status`, chunk by chunk. Chunks are
 * separate statements, so a failure part-way through leaves the earlier chunks
 * written — the count is reported alongside the error rather than implied.
 */
async function setStatus(
  documentIds: string[],
  status: 'published' | 'rejected',
  reviewedBy: string,
  reviewNote: string | null,
): Promise<{ changed: number; error: string | null }> {
  if (!documentIds.length) return { changed: 0, error: null }
  const supabase = createServiceClient()
  const patch = {
    status,
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
    review_note: reviewNote,
  }
  let changed = 0
  for (let i = 0; i < documentIds.length; i += IN_CHUNK) {
    const chunk = documentIds.slice(i, i + IN_CHUNK)
    const { data, error } = await supabase
      .from('place_document_link')
      .update(patch)
      .in('document_id', chunk)
      .eq('status', 'pending_review')
      .select('id')
    if (error) return { changed, error: error.message }
    changed += (data ?? []).length
  }
  return { changed, error: null }
}

/**
 * Publish every pending link in the group whose document is a governing
 * instrument. `reviewed_by` is what lets the trigger accept a document whose
 * OCR never restated the plat name — a reviewer who opened the PDF knows more
 * than a first-pages machine read does, which is why that half of the gate is
 * overridable and the doc_kind half is not.
 */
export async function publishPlaceDocumentGroup(
  publishedName: string,
  reviewedBy: string,
  reviewNote: string | null = null,
): Promise<PlaceDocumentReviewResult> {
  const name = publishedName.trim()
  if (!name) return { ok: false, error: 'A published name is required.', changed: 0 }
  const reviewer = reviewedBy.trim()
  if (!reviewer) return { ok: false, error: 'A reviewer is required.', changed: 0 }

  let docs: DocRow[]
  try {
    docs = await documentsForName(name)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Read failed.', changed: 0 }
  }
  if (!docs.length) {
    return { ok: false, error: `No document is filed under "${name}".`, changed: 0 }
  }

  const governing = docs.filter((d) => isGoverningDocKind(d.doc_kind)).map((d) => d.id)
  const blocked = docs.length - governing.length
  if (!governing.length) {
    return {
      ok: false,
      error: `Nothing under "${name}" is a governing instrument, so nothing here can publish.`,
      changed: 0,
    }
  }

  const { changed, error } = await setStatus(governing, 'published', reviewer, reviewNote)
  if (error) return { ok: false, error, changed }
  return { ok: true, changed, skipped: blocked }
}

/**
 * Reject every pending link in the group — governing or not. A rejection is a
 * review, so it carries the reviewer and the timestamp too; the row stays for
 * the record rather than being deleted.
 */
export async function rejectPlaceDocumentGroup(
  publishedName: string,
  reviewedBy: string,
  reviewNote: string | null = null,
): Promise<PlaceDocumentReviewResult> {
  const name = publishedName.trim()
  if (!name) return { ok: false, error: 'A published name is required.', changed: 0 }
  const reviewer = reviewedBy.trim()
  if (!reviewer) return { ok: false, error: 'A reviewer is required.', changed: 0 }

  let docs: DocRow[]
  try {
    docs = await documentsForName(name)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Read failed.', changed: 0 }
  }
  if (!docs.length) {
    return { ok: false, error: `No document is filed under "${name}".`, changed: 0 }
  }

  const { changed, error } = await setStatus(
    docs.map((d) => d.id),
    'rejected',
    reviewer,
    reviewNote,
  )
  if (error) return { ok: false, error, changed }
  return { ok: true, changed, skipped: 0 }
}
