/**
 * Presentational formatting helpers shared across the prospecting hub's card
 * tree (spec 07). Pure functions only — no data access, no server imports —
 * so every component in this directory can stay a decoupled, prop-driven
 * client component per the contract in lib/data/prospecting/types.ts.
 */

// Currency uses the canonical helper (nearest-thousand rounding per CLAUDE.md,
// null → em-dash) instead of an inline Intl.NumberFormat (ci:currency-format gate).
export { formatPrice } from '@/lib/format/money'

// Dates use the canonical helper (ci:date-format gate; consistent TZ + null→em-dash).
import { formatDate as formatDateCanonical } from '@/lib/format/date'

export function formatDate(iso: string | null): string {
  return formatDateCanonical(iso)
}

export function formatShortDate(iso: string | null): string {
  return formatDateCanonical(iso, { year: undefined })
}

export function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

/** "(541) •••-••06" — area code + last 2 digits visible, rest masked. Display-only; the row prop still carries the raw value for the send dialog. */
export function maskPhone(phone: string | null): string {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return phone
  const ten = digits.length >= 10 ? digits.slice(-10) : digits.padStart(10, '0')
  const area = ten.slice(0, 3)
  const tail = ten.slice(-2)
  return `(${area}) •••-••${tail}`
}

/** "m•••@domain.com" — first character of the local part + full domain, rest masked. Display-only. */
export function maskEmail(email: string | null): string {
  if (!email) return '—'
  const at = email.indexOf('@')
  if (at <= 0) return email
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const visible = local.slice(0, 1)
  return `${visible}${'•'.repeat(Math.max(local.length - 1, 3))}@${domain}`
}
