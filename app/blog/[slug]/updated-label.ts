import { formatDate } from '@/lib/format/date'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * "Updated Oct 4, 2026" only when the post was revised more than one day after
 * it was published. Equal or near-equal timestamps (the seed fallback sets
 * updated_at = published_at) and unparseable values print nothing.
 */
export function blogUpdatedLabel(
  publishedAt: string | null | undefined,
  updatedAt: string | null | undefined,
): string | null {
  if (!publishedAt || !updatedAt) return null
  const pub = new Date(publishedAt).getTime()
  const upd = new Date(updatedAt).getTime()
  if (Number.isNaN(pub) || Number.isNaN(upd)) return null
  if (upd - pub <= DAY_MS) return null
  return `Updated ${formatDate(updatedAt)}`
}
