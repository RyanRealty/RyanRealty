'use server'

/**
 * Prospecting (P9 roll:prospecting) — thin wrapper over the existing guarded
 * build action so the mutation made from the v2 worklist revalidates THIS
 * surface. The underlying action keeps its own auth + guards — nothing is
 * re-implemented here. Sends deliberately have NO worklist wrapper: an intro
 * only goes out from the prospect's own page, through the prepared preview and
 * the full guard chain (never one-tap from a list row).
 */
import { revalidatePath } from 'next/cache'
import { buildProspectDoc } from '@/app/actions/prospecting'

export async function buildProspectDocFromWorklist(kind: string, id: string, _formData?: FormData): Promise<void> {
  const k = kind === 'fsbo' ? 'fsbo' : 'expired'
  const trimmed = String(id ?? '').trim()
  if (!trimmed) return
  // Failure surfaces as the row's doc state on reload (build_error → "failed"
  // with the reason); pre-build refusals (no address, protected slot) leave the
  // row in "Build" — the prospect page shows the full error when opened.
  await buildProspectDoc(k, trimmed)
  revalidatePath('/admin/prospecting')
}
