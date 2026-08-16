/**
 * Day-one checklist for a new broker (CAP-022 / R-198).
 *
 * Closed set. A broker is productive on day one when each item is true.
 * Socials here are public profile URLs on the brokers row — OAuth grants
 * stay Matt-gated and are not a checklist item.
 */

export const DAY_ONE_ITEM_IDS = [
  'mapped',
  'profile',
  'book',
  'notifications',
  'socials',
  'marketing',
] as const

export type DayOneItemId = (typeof DAY_ONE_ITEM_IDS)[number]

export type DayOneItem = {
  id: DayOneItemId
  label: string
  href: string
  done: boolean
}

export type DayOneFacts = {
  role: 'superuser' | 'broker' | 'report_viewer'
  brokerSlug: string | null
  displayName: string | null
  phone: string | null
  notifyConfigured: boolean
  socialUrls: Array<string | null | undefined>
  holdsMarketing: boolean
}

const LABELS: Record<DayOneItemId, { label: string; href: string }> = {
  mapped: { label: 'Your login maps to a broker row', href: '/admin/settings/account' },
  profile: { label: 'Name and phone are on your profile', href: '/admin/settings/account' },
  book: { label: 'Today and People show only your book', href: '/admin/today' },
  notifications: { label: 'Lead and task notifications are set', href: '/admin/settings/account' },
  socials: { label: 'At least one social profile URL is saved', href: '/admin/settings/account' },
  marketing: { label: 'Newsletters and marketing surfaces are unlocked', href: '/admin/newsletters' },
}

function hasText(value: string | null | undefined): boolean {
  return Boolean((value ?? '').trim())
}

function hasSocial(urls: Array<string | null | undefined>): boolean {
  return urls.some((u) => hasText(u))
}

/** Superuser is already productive — the checklist is for scoped brokers. */
export function dayOneApplies(role: DayOneFacts['role']): boolean {
  return role === 'broker'
}

export function evaluateDayOne(facts: DayOneFacts): DayOneItem[] {
  const mapped = hasText(facts.brokerSlug)
  const done: Record<DayOneItemId, boolean> = {
    mapped,
    profile: hasText(facts.displayName) && hasText(facts.phone),
    book: mapped,
    notifications: facts.notifyConfigured,
    socials: hasSocial(facts.socialUrls),
    marketing: facts.holdsMarketing,
  }
  return DAY_ONE_ITEM_IDS.map((id) => ({
    id,
    label: LABELS[id].label,
    href: LABELS[id].href,
    done: done[id],
  }))
}

export function dayOneRemaining(items: DayOneItem[]): DayOneItem[] {
  return items.filter((i) => !i.done)
}

export function dayOneComplete(items: DayOneItem[]): boolean {
  return items.length > 0 && items.every((i) => i.done)
}
