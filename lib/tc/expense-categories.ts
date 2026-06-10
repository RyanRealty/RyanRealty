/** Expense categories for tc_expenses (TC rung 12). Shared between the
 *  server actions and the client dialog — must mirror the CHECK constraint
 *  in supabase/migrations/20260610234500_tc_expenses.sql. */
export const TC_EXPENSE_CATEGORIES = [
  { value: 'marketing', label: 'Marketing (non-ads)' },
  { value: 'photography_media', label: 'Photography & media' },
  { value: 'signage', label: 'Signage' },
  { value: 'staging', label: 'Staging' },
  { value: 'transaction_fees', label: 'Transaction fees' },
  { value: 'mls_dues', label: 'MLS & association dues' },
  { value: 'insurance', label: 'Insurance (E&O)' },
  { value: 'license_education', label: 'License & education' },
  { value: 'software', label: 'Software & tools' },
  { value: 'office', label: 'Office' },
  { value: 'travel', label: 'Travel' },
  { value: 'client_costs', label: 'Client costs & gifts' },
  { value: 'referral_paid', label: 'Referral paid out' },
  { value: 'other', label: 'Other' },
] as const

export type TcExpenseCategory = (typeof TC_EXPENSE_CATEGORIES)[number]['value']
