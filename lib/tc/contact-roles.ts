/**
 * TC deal-contact roles + labels + type. Plain module (NOT 'use server') so
 * these non-function values can be imported by both the server action
 * (app/actions/tc-contacts.ts) and the client component (DealContacts.tsx) —
 * a 'use server' file may only export async functions.
 */

export const TC_CONTACT_ROLES = [
  'co_agent',
  'other_agent',
  'lender',
  'loan_officer',
  'appraiser',
  'title',
  'escrow',
  'transaction_coordinator',
  'home_warranty',
  'attorney',
  'misc',
] as const
export type TcContactRole = (typeof TC_CONTACT_ROLES)[number]

export const TC_CONTACT_ROLE_LABEL: Record<string, string> = {
  co_agent: 'Co-agent',
  other_agent: 'Other-side agent',
  lender: 'Lender',
  loan_officer: 'Loan officer',
  appraiser: 'Appraiser',
  title: 'Title',
  escrow: 'Escrow',
  transaction_coordinator: 'Transaction coordinator',
  home_warranty: 'Home warranty',
  attorney: 'Attorney',
  misc: 'Other',
}

export type TcContact = {
  id: string
  role: string
  name: string | null
  company: string | null
  email: string | null
  phone: string | null
  alternate_phone: string | null
  notes: string | null
  source: string
}
