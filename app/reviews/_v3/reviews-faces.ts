/**
 * Brokers who stand behind the 5.0 on /reviews (SITE-167).
 *
 * public.reviews has no photo column — Google did not give reviewer faces.
 * Canonical transparent PNGs only. JPG fallbacks carry a white box and are
 * refused (same lock as about-faces).
 */
import { BROKERS, type BrokerKey } from '@/lib/brand/contact'
import { aboutPhoneE164, faceInitials } from '@/app/about/_v3/about-faces'
import { teamPath } from '@/lib/slug'

const HEADSHOT_PNG: Record<BrokerKey, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}

export type ReviewsBrokerFace = {
  key: BrokerKey
  name: string
  title: string
  href: string
  src: string
  initials: string
  tel: string | null
  phoneDisplay: string
}

export const REVIEW_BROKERS: readonly ReviewsBrokerFace[] = (
  ['matt', 'rebecca', 'paul'] as const
).map((key) => {
  const b = BROKERS[key]
  return {
    key,
    name: b.nameShort,
    title: b.titleShort,
    href: teamPath(b.slug),
    src: HEADSHOT_PNG[key],
    initials: faceInitials(b.nameShort),
    tel: aboutPhoneE164(b.phone),
    phoneDisplay: b.phone,
  }
})

/** The broker a review is about, when the text names one. Principal otherwise. */
export function brokerKeyForReview(text: string): BrokerKey {
  const t = text.toLowerCase()
  if (/\brebecca\b/.test(t)) return 'rebecca'
  if (/\bpaul\b/.test(t)) return 'paul'
  return 'matt'
}

/** Principal-or-named broker first, then the rest of the roster. */
export function brokersForReviews(leadText?: string): readonly ReviewsBrokerFace[] {
  const lead = brokerKeyForReview(leadText ?? '')
  return [...REVIEW_BROKERS].sort((a, b) => Number(b.key === lead) - Number(a.key === lead))
}
