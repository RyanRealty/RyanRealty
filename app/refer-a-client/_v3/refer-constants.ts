/**
 * /refer-a-client copy. Dual objectives live in the IA lock.
 * Fee figure is the product default in lib/crm/inbound-referral.ts
 * (same 25 as recordReferralReceivable), not a market stat.
 */
import { v3Text, type V3LedgerPlainRow, type V3QuietItem } from '@/components/site/v3'
import { DEFAULT_INBOUND_FEE_PCT } from '@/lib/crm/inbound-referral'

export const OFFICE_HERO = '/images/office/ryan-realty-bend-office-interior-01.jpg'

export const REFER_FAQ_ITEMS = [
  {
    question: 'What is the referral fee?',
    answer: `We record the referral at ${DEFAULT_INBOUND_FEE_PCT} percent of our side at close unless we agree to a different number in writing.`,
  },
  {
    question: 'When do you contact my client?',
    answer:
      'After you and we have the referral in writing. The first call from this office is to you.',
  },
  {
    question: 'What areas do you take?',
    answer:
      'Central Oregon: Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne, and the resort communities.',
  },
  {
    question: 'Do you take buyers and sellers?',
    answer: 'Yes. Say which on the form. Both is fine.',
  },
  {
    question: 'What if they want a house outside Central Oregon?',
    answer:
      'We do not take that file. If you have a client for another Oregon market, use the city page for that market and we will introduce a local broker there.',
  },
] as const

export const REFER_FACTS: V3LedgerPlainRow[] = [
  {
    href: '/cities',
    when: v3Text('01'),
    what: v3Text('Central Oregon only'),
    detail: v3Text(
      'Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne, and the resort communities.',
    ),
    id: 'area',
  },
  {
    href: '/team',
    when: v3Text('02'),
    what: v3Text(`${DEFAULT_INBOUND_FEE_PCT} percent of our side`),
    detail: v3Text(
      `The number we record unless we agree to a different one in writing. Paid at close on our side.`,
    ),
    id: 'fee',
  },
  {
    href: '/contact',
    when: v3Text('03'),
    what: v3Text('We write you first'),
    detail: v3Text(
      'A broker writes you first. We do not call your client until the referral is in writing.',
    ),
    id: 'order',
  },
]

export const REFER_QUIET: V3QuietItem[] = [
  {
    kind: 'prose',
    term: 'What happens after you send it',
    body: 'A broker writes you first and sends a short referral agreement to the email you gave. The client is not contacted before that.',
  },
  ...REFER_FAQ_ITEMS.map((item) => ({
    kind: 'prose' as const,
    term: item.question,
    body: item.answer,
  })),
  { label: 'Central Oregon cities', href: '/cities' },
  { label: 'Housing market', href: '/housing-market' },
  { label: 'Brokers', href: '/team' },
  { label: 'Join the team', href: '/join' },
]
