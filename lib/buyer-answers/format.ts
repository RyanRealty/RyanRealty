import { formatDate } from '@/lib/format/date'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { publishDaysFigure } from '@/lib/market/publish-days-figure'

export const MLS_SOURCE = 'Oregon Data Share MLS'
export const BYLINE_HREF = '/team/matthew-ryan'
export const BYLINE_NAME = 'Matt Ryan, Principal Broker'

export function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

/** Money for public copy. Never call formatPrice with null (it prints an em dash). */
export function formatUsd(n: number): string {
  const rounded = Math.round(n)
  return `$${rounded.toLocaleString('en-US')}`
}

export function formatUsdExact(n: number): string {
  const frac = Number.isInteger(n) ? 0 : 2
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: frac,
    maximumFractionDigits: 2,
  })}`
}

export function formatMlsDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const formatted = formatDate(iso)
  return formatted === '—' ? null : formatted
}

export function mlsCitation(asOf: string | null): string {
  return asOf ? `${MLS_SOURCE}, as of ${asOf}` : MLS_SOURCE
}

export function formatMos(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n < 0) return null
  return formatMonthsOfSupply(n)
}

export function formatDays(n: number | null | undefined): string | null {
  return publishDaysFigure(n)
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-US')
}

/**
 * Join required sentences, then optional ones that still fit 40-60 words.
 * Required text must already be honest and figure-backed.
 */
export function fitAnswer(required: string[], optional: string[] = []): string {
  const kept = [...required]
  let text = kept.join(' ')
  for (const extra of optional) {
    const next = `${text} ${extra}`.trim()
    if (wordCount(next) <= 60) {
      kept.push(extra)
      text = next
    }
  }
  return text
}
