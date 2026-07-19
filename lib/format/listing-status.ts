/**
 * Canonical listing status-pill styling (audit p1.4 companion).
 *
 * Four listing-card components each classified a raw MLS status string
 * ("Active", "Pending", "Active Under Contract", "Closed", "Sold" ...) into
 * pill styling independently. One of them (components/lp/ListingCard.tsx)
 * did it with hardcoded, off-brand hex (#b8860b goldenrod, #8b4513 brown,
 * #5d6470 slate). This is the single source — design tokens only, matching
 * the token vocabulary already established by components/site/ListingCard.tsx's
 * BADGE_CLASS map (bg-primary + text-primary-foreground for a bold "stamped"
 * pill, bg-card + text-foreground + border-border for a light "on-photo" pill).
 */
import { cn } from '@/lib/utils'

export type ListingStatusKind = 'active' | 'pending' | 'contract' | 'closed' | 'other'

/** Classify a raw MLS status label (StandardStatus, statusLabel, etc.) into one of five kinds. */
export function classifyListingStatus(label: string | null | undefined): ListingStatusKind {
  const t = (label ?? '').toLowerCase().trim()
  if (!t) return 'other'
  if (t.includes('pending')) return 'pending'
  if (t.includes('contract')) return 'contract'
  if (t.includes('closed') || t.includes('sold')) return 'closed'
  if (t.includes('active') || t.includes('for sale') || t.includes('coming soon')) return 'active'
  return 'other'
}

const STATUS_PILL_CLASS: Record<ListingStatusKind, string> = {
  // Active / for-sale: the light "on-photo" pill — legible over any photo,
  // reads as "available" (matches BADGE_CLASS's `new`/`open` treatment).
  active: 'bg-card text-primary border border-border',
  // Pending / under contract: the bold "stamped" pill (matches BADGE_CLASS's
  // `hot`/`drop`/`sold` treatment) so an in-motion status reads as an event.
  pending: 'bg-primary text-primary-foreground',
  contract: 'bg-primary text-primary-foreground',
  // Closed / sold: neutral and muted — no longer actionable.
  closed: 'bg-muted text-muted-foreground',
  other: 'bg-card text-foreground border border-border',
}

/**
 * Tailwind classes for a listing-status pill, driven entirely by design
 * tokens (no raw hex, no arbitrary Tailwind color utilities like bg-blue-600
 * or text-gray-500). Compose with additional layout classes via `cn()` at
 * the call site if needed.
 */
export function statusPillClass(label: string | null | undefined): string {
  return cn(STATUS_PILL_CLASS[classifyListingStatus(label)])
}
