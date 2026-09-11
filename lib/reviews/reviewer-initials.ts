/**
 * Initials for a Google reviewer name. public.reviews has no photo column —
 * AvatarFallback is the honest portrait, never an invented face.
 */
export function reviewerInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) {
    const only = parts[0]!
    return only.slice(0, 2).toUpperCase()
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

/** Prefer unique initials in a face row; fall back to first+last-last when colliding. */
export function uniqueReviewerInitials(name: string, taken: ReadonlySet<string>): string {
  const base = reviewerInitials(name)
  if (!taken.has(base)) return base
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!
    const alt = `${parts[0]![0]}${last[last.length - 1]}`.toUpperCase()
    if (!taken.has(alt)) return alt
  }
  if (parts.length >= 3) {
    const alt = `${parts[0]![0]}${parts[1]![0]}${parts[2]![0]}`.toUpperCase().slice(0, 2)
    if (!taken.has(alt)) return alt
  }
  return base
}
