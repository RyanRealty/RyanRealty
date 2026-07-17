/**
 * CMA version-chain resolution over `public.cmas`.
 *
 * A finalized/delivered/archived CMA is a client-facing record: its status,
 * client fields, and public /cma/[slug] link must survive every later request
 * for the same address (adversarial review 2026-07-17 HIGH — the
 * upsert-by-slug clobber class). These helpers give every writer and every
 * address-keyed reader one shared rule:
 *
 *   · writers land on a WRITABLE slot — the open draft if one exists, else a
 *     fresh `--vN` slug AFTER the newest protected document
 *   · readers resolve the LATEST version — never an older delivered document
 *     when a newer one exists
 *
 * Probing walks the version chain (base, -v2, -v3, …) via the existing DAL
 * read; it tolerates one deleted version (a single gap) and stops after two
 * consecutive misses. Chains only grow one slot at a time here, so version
 * numbers stay monotonic with recency unless an admin manually deletes the
 * newest document — acceptable: nothing destructive follows from that.
 */

import 'server-only'
import { getCmaAdminRowBySlug } from '@/lib/data'
import type { CmaAdminRow } from '@/lib/data'
import { cmaSlugForVersion } from '@/lib/cma/address-slug'

/** Hard cap on documents per address — far above any real chain. */
export const MAX_CMA_VERSIONS = 20

type ChainHit = { slug: string; version: number; row: CmaAdminRow }

async function probeCmaVersionChain(baseSlug: string): Promise<ChainHit[]> {
  const hits: ChainHit[] = []
  let consecutiveMisses = 0
  for (let version = 1; version <= MAX_CMA_VERSIONS; version++) {
    const slug = cmaSlugForVersion(baseSlug, version)
    const row = await getCmaAdminRowBySlug(slug)
    if (!row) {
      consecutiveMisses++
      if (consecutiveMisses >= 2) break
      continue
    }
    consecutiveMisses = 0
    hits.push({ slug, version, row })
  }
  return hits
}

/**
 * The newest CMA document for an address (highest version), or null. Readers
 * that key documents by `slugifyAddress(address)` use this so they never pin
 * an older delivered document while a newer one exists.
 */
export async function getLatestCmaRowForBaseSlug(
  baseSlug: string,
): Promise<{ slug: string; row: CmaAdminRow } | null> {
  const hits = await probeCmaVersionChain(baseSlug)
  const latest = hits[hits.length - 1]
  return latest ? { slug: latest.slug, row: latest.row } : null
}

/**
 * The newest BUILT document for an address — the newest version that actually
 * has rendered content. Send rails use this: an unbuilt intake placeholder
 * (`html_path 'pending:…'`, no html_content) is not a sendable document, and
 * auto-finalizing one would strand a protected empty row while hiding the
 * newest real document. Archived documents are skipped too — the admin buried
 * them, and pinning one would dead-end the rail while an older delivered
 * version still exists (adversarial review 2026-07-17 LOW).
 */
export async function getLatestBuiltCmaRowForBaseSlug(
  baseSlug: string,
): Promise<{ slug: string; row: CmaAdminRow } | null> {
  const hits = await probeCmaVersionChain(baseSlug)
  for (let i = hits.length - 1; i >= 0; i--) {
    const hit = hits[i]!
    if (String(hit.row.status ?? '') === 'archived') continue
    if (hit.row.html_content) return { slug: hit.slug, row: hit.row }
  }
  return null
}

/**
 * The newest CLIENT-READY document for an address — the newest version the
 * public /cma/[slug] route will actually serve (status finalized|delivered).
 * Anything that puts a /cma link in front of a client (outreach SMS, link
 * previews) must resolve through this, never through "latest overall": a
 * draft latest would hand the client a 404.
 */
export async function getLatestClientReadyCmaRowForBaseSlug(
  baseSlug: string,
): Promise<{ slug: string; row: CmaAdminRow } | null> {
  const hits = await probeCmaVersionChain(baseSlug)
  for (let i = hits.length - 1; i >= 0; i--) {
    const hit = hits[i]!
    const status = String(hit.row.status ?? '')
    if (status === 'finalized' || status === 'delivered') return { slug: hit.slug, row: hit.row }
  }
  return null
}

export type WritableCmaSlot =
  | {
      ok: true
      /** The slug the write should land on. */
      slug: string
      /** The open draft already at that slug (merge/rebuild target), or null
       *  when the slot is empty and a fresh row should be created. */
      existing: { id: string; row: CmaAdminRow } | null
      /** Status of the newest protected document stepped past, or null when
       *  the write lands on the base slug. */
      priorStatus: string | null
    }
  | { ok: false; error: string }

/**
 * Where a CMA build/intake for this address may write. Never a protected
 * (non-draft) row: those keep their status, client, and public link forever.
 */
export async function resolveWritableCmaSlot(baseSlug: string): Promise<WritableCmaSlot> {
  const hits = await probeCmaVersionChain(baseSlug)
  const latest = hits[hits.length - 1] ?? null

  if (!latest) return { ok: true, slug: baseSlug, existing: null, priorStatus: null }

  const status = String(latest.row.status ?? '')
  if (status === 'draft') {
    const id = latest.row.id
    if (typeof id !== 'string' || !id) {
      return { ok: false, error: `cmas row ${latest.slug} has no readable id` }
    }
    return {
      ok: true,
      slug: latest.slug,
      existing: { id, row: latest.row },
      priorStatus: hits.length > 1 ? String(hits[hits.length - 2]!.row.status ?? 'unknown') : null,
    }
  }

  // Newest document is protected (finalized/delivered/archived/unknown —
  // anything that is not an open draft is treated as protected, fail-safe).
  const nextVersion = latest.version + 1
  if (nextVersion > MAX_CMA_VERSIONS) {
    return {
      ok: false,
      error: `More than ${MAX_CMA_VERSIONS} CMA documents exist for ${baseSlug}. Review the chain at /admin/cmas before creating another.`,
    }
  }
  return {
    ok: true,
    slug: cmaSlugForVersion(baseSlug, nextVersion),
    existing: null,
    priorStatus: status,
  }
}
