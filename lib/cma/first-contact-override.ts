/**
 * Broker edits to the CMA first-contact email on Review, stored on
 * `cmas.build_summary.firstContactOverride` so Approve & queue can carry
 * the same copy into the drip drain (no new column).
 */

import { getCmaRenderSourceBySlug, updateCmaRowFieldsBySlug } from '@/lib/data'

export type CmaFirstContactOverride = {
  subject: string
  bodyText: string
}

export function readFirstContactOverride(summary: unknown): CmaFirstContactOverride | null {
  const raw = (summary as { firstContactOverride?: unknown } | null)?.firstContactOverride
  if (!raw || typeof raw !== 'object') return null
  const subject = String((raw as { subject?: unknown }).subject ?? '').trim()
  const bodyText = String((raw as { bodyText?: unknown }).bodyText ?? '').trim()
  if (!subject && !bodyText) return null
  return { subject, bodyText }
}

export async function loadCmaFirstContactOverride(
  slug: string,
): Promise<CmaFirstContactOverride | null> {
  const row = await getCmaRenderSourceBySlug(slug.trim().toLowerCase())
  if (!row) return null
  return readFirstContactOverride(row.build_summary)
}

/** Merge override into existing build_summary (or clear it). */
export async function saveCmaFirstContactOverride(
  slug: string,
  override: CmaFirstContactOverride | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const safe = slug.trim().toLowerCase()
  const row = await getCmaRenderSourceBySlug(safe)
  if (!row) return { ok: false, error: 'CMA not found.' }
  const base =
    row.build_summary && typeof row.build_summary === 'object' && !Array.isArray(row.build_summary)
      ? { ...(row.build_summary as Record<string, unknown>) }
      : {}
  if (override && (override.subject.trim() || override.bodyText.trim())) {
    base.firstContactOverride = {
      subject: override.subject.trim(),
      bodyText: override.bodyText.trim(),
    }
  } else {
    delete base.firstContactOverride
  }
  const saved = await updateCmaRowFieldsBySlug(safe, { build_summary: base })
  if (!saved.ok) return { ok: false, error: saved.error ?? 'Could not save email edits.' }
  return { ok: true }
}
