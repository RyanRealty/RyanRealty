/**
 * The county owner-of-record string for a CMA row, for the greeting check
 * (lib/crm/household-names.ts, Matt 2026-10-14).
 *
 * Read off the linked expired_listings notes first: lookups since this landed
 * write "Owner of record: ..." for every county hit, and entity rows before it
 * wrote "Legal owner (entity): ...". A person-owned row looked up before this
 * landed carries neither, so the county is asked once, live, by the address on
 * the row. Fail-soft: no row, no address, or a county miss is null, and the
 * greeting then has only the stored client name to go on.
 */
import 'server-only'
import { ownerOfRecordFromNotes } from '@/lib/crm/household-names'
import { getOwnerOfRecordForCma } from '@/lib/data/cma/crm'
import { deschutesCountyOwner } from '@/lib/owner-resolution.mjs'

const COUNTY_TIMEOUT_MS = 8_000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      () => {
        clearTimeout(t)
        resolve(null)
      },
    )
  })
}

// A live county answer is kept per document for ten minutes, so the Review
// page, the compose dialog and the send that follows ask the county once.
const MEMO_TTL_MS = 10 * 60 * 1000
const MEMO_MAX = 500
const memo = new Map<string, { at: number; owner: string | null }>()

export async function resolveOwnerOfRecordForCma(row: Record<string, unknown>): Promise<string | null> {
  const id = typeof row.id === 'string' ? row.id.trim() : ''
  if (!id) return null
  const hit = memo.get(id)
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.owner
  const linked = await getOwnerOfRecordForCma(id).catch(() => null)
  if (!linked) return null
  const fromNotes = ownerOfRecordFromNotes(linked.enrichmentNotes)
  if (fromNotes) return fromNotes
  const street = linked.streetAddress?.trim()
  if (!street) return null
  const county = await withTimeout(deschutesCountyOwner(street, linked.city ?? undefined), COUNTY_TIMEOUT_MS)
  const owner = county?.ownerRaw?.trim() || null
  if (memo.size >= MEMO_MAX) memo.clear()
  memo.set(id, { at: Date.now(), owner })
  return owner
}
