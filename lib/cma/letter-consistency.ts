/**
 * Letter-consistency contract checks that run on the rendered HTML and the
 * pricing the letter prints. Gates, not prose: a hard fail refuses the letter.
 */

import { letterLinkTrackingCheck, type LetterLinkIdentity } from '@/lib/cma/letter-link-contract'
import { letterOwnerNameCheck, type LetterNameSource } from '@/lib/cma/letter-privacy'
import type { ContractCheck } from '@/lib/cma/contract'

function money(n: unknown): number | null {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) && v > 0 ? v : null
}

function usdForms(n: number): string[] {
  const exact = Math.round(n)
  const r1k = Math.round(n / 1000) * 1000
  const forms = [
    `$${exact.toLocaleString('en-US')}`,
    `$${exact}`,
    `$${Math.round(exact / 1000)}k`,
    `$${Math.round(exact / 1000)}K`,
  ]
  if (r1k !== exact) forms.push(`$${r1k.toLocaleString('en-US')}`, `$${r1k}`)
  return [...new Set(forms)]
}

const LIST_REC_FRAME =
  /(?:recommend(?:ed|ing)?(?: listing)?(?: at)?|list(?:ing)? at|would support listing at|do not recommend going above)\s+\$[\d,]+/gi

export function highEndAtOrBelowBandCheck(pricing: {
  highEnd?: number | null
  valueLow?: number | null
  valueHigh?: number | null
}): ContractCheck {
  const highEnd = money(pricing.highEnd)
  const low = money(pricing.valueLow)
  const high = money(pricing.valueHigh)
  const bandHigh = low != null && high != null ? Math.max(low, high) : high
  const pass = highEnd == null || bandHigh == null || highEnd <= bandHigh
  return {
    id: 'high-end-at-or-below-band',
    severity: 'hard',
    pass,
    detail: pass
      ? highEnd != null && bandHigh != null
        ? `High end $${highEnd.toLocaleString('en-US')} sits at or below the band top $${bandHigh.toLocaleString('en-US')}.`
        : 'High end or band top is not printed.'
      : `High end $${highEnd!.toLocaleString('en-US')} sits above the band top $${bandHigh!.toLocaleString('en-US')}.`,
  }
}

export function letterRecommendDollarsCheck(
  html: string,
  pricing: { recommended?: number | null; valueLow?: number | null; valueHigh?: number | null },
): ContractCheck {
  const rec = money(pricing.recommended)
  const low = money(pricing.valueLow)
  const high = money(pricing.valueHigh)
  const bandLow = low != null && high != null ? Math.min(low, high) : null
  const bandHigh = low != null && high != null ? Math.max(low, high) : null
  if (rec == null) {
    return {
      id: 'letter-one-recommend-price',
      severity: 'hard',
      pass: true,
      detail: 'No recommended list to grade.',
    }
  }
  const frames = html.match(LIST_REC_FRAME) ?? []
  const recForms = new Set(usdForms(rec).map((s) => s.toLowerCase()))
  const bad: string[] = []
  for (const frame of frames) {
    const dollar = frame.match(/\$[\d,]+/)?.[0]
    if (!dollar) continue
    const n = Number(dollar.replace(/[$,]/g, ''))
    if (!Number.isFinite(n) || n <= 0) continue
    const framedAsRec = /recommend|listing at|list at/i.test(frame)
    const framedAsRangeCap = /going above/i.test(frame)
    if (!framedAsRec && !framedAsRangeCap) continue
    const isRec = recForms.has(dollar.toLowerCase()) || Math.round(n / 1000) * 1000 === Math.round(rec / 1000) * 1000
    const inBand = bandLow != null && bandHigh != null && n >= bandLow && n <= bandHigh
    if (framedAsRangeCap && inBand) continue
    if (!isRec && !(framedAsRangeCap && inBand)) bad.push(frame.trim())
  }
  return {
    id: 'letter-one-recommend-price',
    severity: 'hard',
    pass: bad.length === 0,
    detail:
      bad.length === 0
        ? `Every list-recommendation dollar equals the rec $${rec.toLocaleString('en-US')} or sits inside the band as a range.`
        : `List-recommendation dollars that are not the rec and not inside the band: ${bad.join(' · ')}`,
  }
}

export function evaluateLetterConsistencyContract(args: {
  html: string
  names: LetterNameSource | null | undefined
  identity: LetterLinkIdentity | null | undefined
  pricing: {
    recommended?: number | null
    highEnd?: number | null
    valueLow?: number | null
    valueHigh?: number | null
  }
}): { pass: boolean; checks: ContractCheck[] } {
  const checks: ContractCheck[] = [
    letterOwnerNameCheck(args.html, args.names),
    letterLinkTrackingCheck(args.html, args.identity),
    highEndAtOrBelowBandCheck(args.pricing),
    letterRecommendDollarsCheck(args.html, args.pricing),
  ]
  return { pass: checks.every((c) => c.pass), checks }
}
