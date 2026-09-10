/**
 * The sweep behind the solicitation screen: walk the expired and FSBO lanes,
 * and pull out the prospects we may not write to (Matt 2026-09-09: "just pull
 * them right out of the queue… No one needs to know about it").
 *
 * ONE definition, two callers: the cron (/api/cron/cma-solicit-screen) runs it
 * continuously, and scripts/cma-screen-queue.ts runs it by hand with a report.
 *
 * An archived row keeps its document and its reason; nothing is deleted and no
 * one is notified. A row the screen cannot verify is LEFT ALONE — the send
 * chokepoint still refuses it, but a degraded MLS read must never archive a
 * live prospect (§0: unknown is not empty).
 */

import { listCmaQueue } from '@/lib/data/cma/unified-queue'
import { getCmaAdminRowBySlug, updateCmaRowFieldsBySlug } from '@/lib/data/cma/documents'
import { screenAddressForSolicitation, type SolicitBlockReason } from '@/lib/cma/solicit-screen'

export type SolicitSweepResult = {
  screened: number
  clear: number
  pulled: number
  byReason: Record<SolicitBlockReason, number>
  slugs: Array<{ slug: string; reason: SolicitBlockReason; address: string }>
  error?: string
}

export async function runSolicitSweep(opts: { archive?: boolean; limit?: number } = {}): Promise<SolicitSweepResult> {
  const archive = opts.archive !== false
  const empty: Record<SolicitBlockReason, number> = { sold: 0, listed: 0, pending: 0, unverified: 0 }
  const out: SolicitSweepResult = { screened: 0, clear: 0, pulled: 0, byReason: { ...empty }, slugs: [] }

  const { rows } = await listCmaQueue({ limit: opts.limit ?? 500 })
  const lanes = rows.filter((r) => (r.origin === 'expired' || r.origin === 'fsbo') && r.state !== 'archived')
  if (lanes.length === 0) {
    // A lane with no rows is a read failure far more often than an empty
    // pipeline; say so rather than reporting a clean sweep.
    return { ...out, error: 'The queue returned no expired or FSBO rows.' }
  }

  for (const r of lanes) {
    out.screened++
    const full = (await getCmaAdminRowBySlug(r.slug)) as Record<string, unknown> | null
    const screen = await screenAddressForSolicitation({
      address: (full?.subject_address as string | null) ?? r.address,
      city: (full?.subject_city as string | null) ?? r.city ?? null,
      sinceIso: r.offMarketAt ? String(r.offMarketAt).slice(0, 10) : null,
      subjectListingKey: (full?.subject_listing_key as string | null) ?? null,
    })
    if (screen.ok) {
      out.clear++
      continue
    }
    out.byReason[screen.reason]++
    if (screen.reason === 'unverified') continue
    out.slugs.push({ slug: r.slug, reason: screen.reason, address: String(r.address) })
    if (!archive) continue
    const summary = (full?.build_summary ?? {}) as Record<string, unknown>
    const res = await updateCmaRowFieldsBySlug(r.slug, {
      archived_at: new Date().toISOString(),
      build_summary: {
        ...summary,
        solicit_screen: {
          reason: screen.reason,
          detail: screen.detail,
          listing_key: screen.listingKey,
          checked_at: new Date().toISOString(),
        },
      },
    })
    if (res.ok) out.pulled++
  }
  return out
}
