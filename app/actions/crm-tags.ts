'use server'

/**
 * CRM tag-taxonomy actions — the server-action surface over the crm_tags table
 * AND the crm_people.tags (text[]) the taxonomy keys are duplicated across.
 *
 * Two layers move together here, which is what makes tags different from stages:
 *   1. The taxonomy row in crm_tags (canonical key + label + order + flags).
 *   2. The literal key string stored on every person's crm_people.tags array.
 *
 * Create / setActive / relabel only touch layer 1, so they ride the reusable
 * makeConfigTable factory (lib/crm/config-table.ts). Rename, merge, and
 * delete-with-strip must rewrite layer 2 across potentially thousands of people,
 * so they are CUSTOM and CHUNKED here (the pure array rewrite lives in
 * lib/crm/tag-rewrite.ts and is unit-tested).
 *
 * Hard rules:
 *   - A protected (compliance) tag — hard-stop / do-not-text / do-not-call — can
 *     never be deleted or merged away. These keys are read by the suppression
 *     chokepoint (lib/crm/suppressions.ts) directly off crm_people.tags; losing
 *     one silently re-opens a suppressed channel. Refused, never orphaned.
 *   - Destructive ops (rename across people, merge, delete) require an OWNER
 *     (superuser). A restricted broker cannot rewrite tags on every other
 *     broker's contacts. Non-destructive label/create/active changes ride the
 *     factory's standard admin guard.
 *   - The people-rewrite runs in id-ordered chunks and writes back ONLY the rows
 *     whose array actually changed, so a half-failed batch can be re-run safely.
 *
 * DAL boundary (G1): all reads/writes here run inside a 'use server' module
 * through the service client; the cached reader lives in lib/data/crm/getCrmTags.
 */

import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'
import { makeConfigTable, type ConfigResult } from '@/lib/crm/config-table'
import { CRM_TAGS_TAG } from '@/lib/data/crm/getCrmTags'
import { rewriteTagsArray, stripTagFromArray } from '@/lib/crm/tag-rewrite'

const TAGS = makeConfigTable({
  table: 'crm_tags',
  revalidatePaths: ['/admin/crm', '/admin/crm/settings'],
})

/** Drop the cached getCrmTags result after any mutation. */
function bustTagCache() {
  revalidateTag(CRM_TAGS_TAG, 'max')
}

/** Owner-only guard for destructive taxonomy ops (rename-everywhere/merge/delete). */
async function requireOwner(): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  if (access.role !== 'superuser') {
    return { ok: false, error: 'Only an owner can rename, merge, or delete tags' }
  }
  return { ok: true }
}

/** Load one taxonomy row by id (for protected/key checks). */
async function loadTagRow(
  id: number,
): Promise<{ id: number; key: string; label: string; isProtected: boolean } | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_tags')
    .select('id,key,label,is_protected')
    .eq('id', id)
    .maybeSingle()
  return data
    ? { id: Number(data.id), key: String(data.key), label: String(data.label), isProtected: data.is_protected === true }
    : null
}

const PEOPLE_CHUNK = 500

/**
 * Rewrite a tag across every non-deleted person, in id-ordered chunks. `apply`
 * maps one person's tags array to the new array + a changed flag (rename/merge
 * use rewriteTagsArray, delete uses stripTagFromArray). Only changed rows are
 * written. Returns the number of people rewritten, or an error.
 *
 * Chunking is by ascending id with a moving cursor so a table of 18K people is
 * never read into one payload, and a re-run after a partial failure converges
 * (an already-rewritten row produces changed === false and is skipped).
 */
async function rewriteTagAcrossPeople(
  matchKey: string,
  apply: (tags: string[]) => { tags: string[]; changed: boolean },
): Promise<{ ok: true; rewritten: number } | { ok: false; error: string }> {
  const sb = createServiceClient()
  let cursor = 0
  let rewritten = 0
  // Bound the loop so a pathological cursor can never spin forever.
  for (let guard = 0; guard < 100000; guard += 1) {
    const { data, error } = await sb
      .from('crm_people')
      .select('id,tags')
      .eq('deleted', false)
      .contains('tags', [matchKey])
      .gt('id', cursor)
      .order('id', { ascending: true })
      .limit(PEOPLE_CHUNK)
    if (error) return { ok: false, error: `Could not read contacts: ${error.message}` }
    const rows = (data ?? []) as Array<{ id: number; tags: string[] | null }>
    if (rows.length === 0) break

    for (const row of rows) {
      const next = apply(Array.isArray(row.tags) ? row.tags : [])
      if (next.changed) {
        const { error: upErr } = await sb
          .from('crm_people')
          .update({ tags: next.tags, updated_at: new Date().toISOString() })
          .eq('id', row.id)
        if (upErr) return { ok: false, error: `Could not rewrite contact ${row.id}: ${upErr.message}` }
        rewritten += 1
      }
      cursor = Math.max(cursor, Number(row.id))
    }

    if (rows.length < PEOPLE_CHUNK) break
  }
  return { ok: true, rewritten }
}

// ── Non-destructive: ride the config-table factory ──────────────────────────

/**
 * Create a taxonomy tag. The key is the literal value that will be stored on
 * crm_people.tags, so it defaults to the label only when not supplied; new tags
 * are never protected.
 */
export async function createTagAction(formData: FormData): Promise<ConfigResult> {
  const label = String(formData.get('label') ?? '').trim()
  const key = String(formData.get('key') ?? label).trim()
  if (!label) return { ok: false, error: 'Label is required' }
  if (!key) return { ok: false, error: 'Key is required' }
  const res = await TAGS.create({ key, label })
  if (res.ok) bustTagCache()
  return res
}

/** Toggle a tag active/inactive (drops it from autocomplete; no array rewrite). */
export async function setTagActiveAction(formData: FormData): Promise<ConfigResult> {
  const id = Number(formData.get('id'))
  const isActive = String(formData.get('isActive') ?? '') === '1'
  if (!id) return { ok: false, error: 'Tag required' }
  const res = await TAGS.setActive(id, isActive)
  if (res.ok) bustTagCache()
  return res
}

/** Reorder the taxonomy (render order only; no array rewrite). */
export async function reorderTagsAction(orderedIds: number[]): Promise<ConfigResult> {
  if (!Array.isArray(orderedIds) || orderedIds.some((n) => !Number.isFinite(n))) {
    return { ok: false, error: 'Bad order' }
  }
  const res = await TAGS.reorder(orderedIds)
  if (res.ok) bustTagCache()
  return res
}

// ── Destructive: custom, chunked, owner-only ────────────────────────────────

/**
 * Rename a tag EVERYWHERE. Renaming changes the canonical key (the stored value),
 * so this both relabels the taxonomy row and rewrites crm_people.tags across
 * every carrier from the old key to the new key. The label defaults to the new
 * key when omitted.
 *
 * Refuses to rename a protected compliance tag (the suppression chokepoint
 * matches the literal key — a rename would unhook it). Refuses a no-op or a
 * collision with an existing taxonomy key.
 */
export async function renameTagAction(formData: FormData): Promise<ConfigResult> {
  const guard = await requireOwner()
  if (!guard.ok) return guard

  const id = Number(formData.get('id'))
  const newKey = String(formData.get('newKey') ?? '').trim()
  const newLabel = String(formData.get('newLabel') ?? newKey).trim()
  if (!id) return { ok: false, error: 'Tag required' }
  if (!newKey) return { ok: false, error: 'A new tag name is required' }

  const row = await loadTagRow(id)
  if (!row) return { ok: false, error: 'That tag no longer exists' }
  if (row.isProtected) {
    return { ok: false, error: 'This is a protected compliance tag and cannot be renamed' }
  }
  if (row.key === newKey) {
    // Same key — treat as a label-only edit through the factory.
    const res = await TAGS.rename(id, newLabel || row.label)
    if (res.ok) bustTagCache()
    return res
  }

  const sb = createServiceClient()
  // The new key must not collide with another taxonomy row.
  const { data: clash } = await sb.from('crm_tags').select('id').eq('key', newKey).maybeSingle()
  if (clash && Number(clash.id) !== id) {
    return { ok: false, error: `"${newKey}" already exists. Use merge to fold one tag into another.` }
  }

  // Rewrite people first; if that fails the taxonomy row is left untouched so a
  // re-run converges. (An already-rewritten person yields changed === false.)
  const rewrite = await rewriteTagAcrossPeople(row.key, (tags) => rewriteTagsArray(tags, row.key, newKey))
  if (!rewrite.ok) return rewrite

  const { error } = await sb
    .from('crm_tags')
    .update({ key: newKey, label: newLabel || newKey, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    if (error.code === '23505') return { ok: false, error: `"${newKey}" already exists` }
    return { ok: false, error: error.message }
  }

  bustTagCache()
  return { ok: true }
}

/**
 * Merge one tag INTO another: rewrite every carrier of `fromKey` to `intoKey`
 * (de-duping when a person already carries the target), then drop the `from`
 * taxonomy row. `intoKey` may be protected (folding a stray do-not-text variant
 * into the canonical one is legitimate); `fromKey` may NOT be protected (that
 * would delete a compliance tag's row).
 *
 * Inputs are taxonomy ids so the UI picks from the managed list.
 */
export async function mergeTagAction(formData: FormData): Promise<ConfigResult> {
  const guard = await requireOwner()
  if (!guard.ok) return guard

  const fromId = Number(formData.get('fromId'))
  const intoId = Number(formData.get('intoId'))
  if (!fromId || !intoId) return { ok: false, error: 'Pick a tag to merge and a tag to merge into' }
  if (fromId === intoId) return { ok: false, error: 'Cannot merge a tag into itself' }

  const [from, into] = await Promise.all([loadTagRow(fromId), loadTagRow(intoId)])
  if (!from) return { ok: false, error: 'The tag to merge no longer exists' }
  if (!into) return { ok: false, error: 'The destination tag no longer exists' }
  if (from.isProtected) {
    return { ok: false, error: 'This is a protected compliance tag and cannot be merged away' }
  }

  // Rewrite people from -> into first, then drop the from-row.
  const rewrite = await rewriteTagAcrossPeople(from.key, (tags) => rewriteTagsArray(tags, from.key, into.key))
  if (!rewrite.ok) return rewrite

  const sb = createServiceClient()
  const { error } = await sb.from('crm_tags').delete().eq('id', fromId)
  if (error) return { ok: false, error: `Tags merged but the old row could not be removed: ${error.message}` }

  bustTagCache()
  return { ok: true }
}

/**
 * Delete a taxonomy tag. Refuses a protected compliance tag. When `strip` is set
 * the tag is also pulled off every carrier in crm_people.tags; otherwise the
 * taxonomy row is dropped and any historical occurrence on a person is left in
 * place (a dangling, no-longer-canonical string the autocomplete won't offer).
 */
export async function deleteTagAction(formData: FormData): Promise<ConfigResult> {
  const guard = await requireOwner()
  if (!guard.ok) return guard

  const id = Number(formData.get('id'))
  const strip = String(formData.get('strip') ?? '') === '1'
  if (!id) return { ok: false, error: 'Tag required' }

  const row = await loadTagRow(id)
  if (!row) return { ok: false, error: 'That tag no longer exists' }
  if (row.isProtected) {
    return { ok: false, error: 'This is a protected compliance tag and cannot be deleted' }
  }

  if (strip) {
    const rewrite = await rewriteTagAcrossPeople(row.key, (tags) => stripTagFromArray(tags, row.key))
    if (!rewrite.ok) return rewrite
  }

  const sb = createServiceClient()
  const { error } = await sb.from('crm_tags').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }

  bustTagCache()
  return { ok: true }
}

/** Read passthrough so a settings page can list tags from one import. */
export async function listCrmTagsAction() {
  const access = await getCrmAccess()
  if (!access) return []
  return TAGS.list()
}
