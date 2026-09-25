/**
 * Number formatting for the monthly report, shared by the PDF, the web page and
 * the written summaries so a figure reads the same everywhere it appears.
 *
 * Rounding never changes the story (CLAUDE.md §0): prices round to the nearest
 * thousand in running text ($474,500 → $475K) and print in full in tables.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** 'YYYY-MM' of a 'YYYY-MM-DD' or 'YYYY-MM'. */
export function monthKey(date: string): string {
  return date.slice(0, 7)
}

export function monthName(key: string): string {
  return MONTHS[Number(key.slice(5, 7)) - 1] ?? key
}

export function monthLabel(key: string): string {
  return `${monthName(key)} ${key.slice(0, 4)}`
}

/** "Jul '26" for axis ticks. */
export function monthTick(key: string): string {
  return `${MONTHS_SHORT[Number(key.slice(5, 7)) - 1] ?? ''} '${key.slice(2, 4)}`
}

/** "Q2 2026" */
export function quarterLabel(periodEnd: string): string {
  const q = Math.ceil(Number(periodEnd.slice(5, 7)) / 3)
  return `Q${q} ${periodEnd.slice(0, 4)}`
}

export function addMonths(key: string, delta: number): string {
  const y = Number(key.slice(0, 4))
  const m = Number(key.slice(5, 7)) - 1 + delta
  const yy = y + Math.floor(m / 12)
  const mm = ((m % 12) + 12) % 12
  return `${yy}-${String(mm + 1).padStart(2, '0')}`
}

export function lastDayOf(key: string): string {
  const y = Number(key.slice(0, 4))
  const m = Number(key.slice(5, 7))
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '–'
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/** $780K / $1.25M for running text and chart labels. Never rounds across a story. */
export function moneyShort(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '–'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) {
    const m = n / 1_000_000
    const s = m >= 10 ? m.toFixed(1) : m.toFixed(2)
    return `$${s.replace(/\.?0+$/, '')}M`
  }
  if (abs >= 1_000) return `$${Math.round(n / 1000).toLocaleString('en-US')}K`
  return `$${Math.round(n)}`
}

export function count(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '–'
  return Math.round(n).toLocaleString('en-US')
}

/** A signed change as a whole percent: "+4%", "−3%", "0%". */
export function pctChange(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return '–'
  const r = Math.round(p * 100)
  if (r === 0) return '0%'
  return `${r > 0 ? '+' : '−'}${Math.abs(r)}%`
}

/** A share as a whole percent: "38%". */
export function pct(p: number | null | undefined, digits = 0): string {
  if (p == null || !Number.isFinite(p)) return '–'
  return `${(p * 100).toFixed(digits)}%`
}

/** Sale-to-list ratio to one decimal: "98.7%". */
export function ratioPct(r: number | null | undefined): string {
  if (r == null || !Number.isFinite(r)) return '–'
  return `${(r * 100).toFixed(1)}%`
}

export function days(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '–'
  const r = Math.round(n)
  return `${r} ${r === 1 ? 'day' : 'days'}`
}

/** Months of supply to one decimal: "3.8". */
export function months1(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '–'
  return n.toFixed(1)
}
