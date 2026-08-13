/**
 * Route-local constants for /team.
 *
 * Display order is locked to Matt, Rebecca, Paul (Matt directive). FAQ answers
 * reuse facts already on /about. No new claims.
 */

import { CONTACT } from '@/lib/brand/contact'
import { teamPath } from '@/lib/slug'
import { v3Text, type V3LedgerPlainRow } from '@/components/site/v3'

export function brokerLedgerRow(b: {
  slug: string
  fullName: string | null | undefined
  title?: string | null
  licenseNumber?: string | null
  headshotPng?: string | null
}): V3LedgerPlainRow | null {
  const name = b.fullName?.trim()
  const slug = b.slug?.trim()
  if (!name || !slug) return null
  const title = b.title?.trim()
  const license = b.licenseNumber?.trim()
  const photo = b.headshotPng?.trim()
  return {
    href: teamPath(slug),
    when: v3Text(title || 'Broker'),
    what: v3Text(name),
    detail: license ? v3Text(`OR #${license}`) : undefined,
    id: slug,
    media: photo ? { src: photo } : undefined,
  }
}

export const TEAM_RANK: Record<string, number> = {
  matt: 0,
  matthew: 0,
  rebecca: 1,
  paul: 2,
}

export const TEAM_FAQ_ITEMS = [
  {
    question: 'What does working directly with a broker mean?',
    answer:
      'You work with one broker from the first call to the closing table. There is no hand-off to a junior agent or a transaction desk, and the broker who prices your home is the one who answers your calls.',
  },
  {
    question: 'What does my listing get?',
    answer:
      'Every listing gets a video, a 3D walkthrough, and a price built from live Central Oregon comps. The same treatment at every price point.',
  },
  {
    question: 'Which areas do Ryan Realty brokers cover?',
    answer:
      'Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, and Terrebonne, plus the resort communities including Tetherow, Pronghorn, Eagle Crest, and Brasada Ranch.',
  },
  {
    question: 'How do I start?',
    answer: `Call ${CONTACT.phoneDirect} or schedule a time through the contact page. You talk directly with a broker, not a call center.`,
  },
] as const
