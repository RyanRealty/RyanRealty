/**
 * Letter-consistency contract checks that run on the rendered HTML and the
 * pricing the letter prints. Gates, not prose: a hard fail refuses the letter.
 */

import { countedAddressesMissingFromDocument } from '@/lib/cma/counted-rows'
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

/** Whole-home list prices in this market are five figures and up. $/sf is not. */
const WHOLE_HOME_MIN_USD = 10_000

/** Suffix after the first dollar: a per-foot unit, or a range that ends in one. */
const PER_FOOT_AFTER =
  /^(?:\s+to\s+\$[\d,]+)?\s*(?:a foot|\/sf|per sq\.?\s*ft|per square foot)\b/i

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
  const recForms = new Set(usdForms(rec).map((s) => s.toLowerCase()))
  const bad: string[] = []
  const frameRe = new RegExp(LIST_REC_FRAME.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = frameRe.exec(html))) {
    const frame = m[0]
    const after = html.slice(m.index + frame.length)
    if (PER_FOOT_AFTER.test(after)) continue
    const dollar = frame.match(/\$[\d,]+/)?.[0]
    if (!dollar) continue
    const n = Number(dollar.replace(/[$,]/g, ''))
    if (!Number.isFinite(n) || n <= 0 || n < WHOLE_HOME_MIN_USD) continue
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

/**
 * The hero band must overlap the closed comps. A band that sits entirely
 * under every sale, or entirely over every sale, is not support (Marys Grace:
 * band $531k-$577k under comps at $610k-$665k).
 */
export function bandVersusClosedCompsCheck(
  pricing: { valueLow?: number | null; valueHigh?: number | null },
  comps: readonly { adjustedPrice?: number | null; closePrice?: number | null }[] | null | undefined,
): ContractCheck {
  const low = money(pricing.valueLow)
  const high = money(pricing.valueHigh)
  const bandLow = low != null && high != null ? Math.min(low, high) : null
  const bandHigh = low != null && high != null ? Math.max(low, high) : null
  const prices = (comps ?? [])
    .map((c) => money(c.adjustedPrice) ?? money(c.closePrice))
    .filter((n): n is number => n != null)
  if (bandLow == null || bandHigh == null || prices.length === 0) {
    return {
      id: 'band-overlaps-closed-comps',
      severity: 'hard',
      pass: true,
      detail: 'No band or no closed comps to compare.',
    }
  }
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const entirelyBelow = bandHigh < min
  const entirelyAbove = bandLow > max
  const pass = !entirelyBelow && !entirelyAbove
  const band = `$${Math.round(bandLow).toLocaleString('en-US')}-$${Math.round(bandHigh).toLocaleString('en-US')}`
  const span = `$${Math.round(min).toLocaleString('en-US')}-$${Math.round(max).toLocaleString('en-US')}`
  return {
    id: 'band-overlaps-closed-comps',
    severity: 'hard',
    pass,
    detail: pass
      ? `Band ${band} overlaps the closed comps ${span}.`
      : entirelyBelow
        ? `Band ${band} sits entirely below every closed comp ${span}.`
        : `Band ${band} sits entirely above every closed comp ${span}.`,
  }
}


/**
 * Every sale and every expired listing the document counts has to be in the
 * document. A missing address fails the letter.
 */
export function countedRowsInDocumentCheck(args: {
  html: string
  sales?: readonly (string | null | undefined)[] | null
  expired?: readonly (string | null | undefined)[] | null
}): ContractCheck {
  const missing = countedAddressesMissingFromDocument(
    [...(args.sales ?? []), ...(args.expired ?? [])],
    args.html,
  )
  const pass = missing.length === 0
  return {
    id: 'counted-rows-in-table',
    severity: 'hard',
    pass,
    detail: pass
      ? 'Every counted sale and expired listing is in the document.'
      : `Counted but missing from the table: ${missing.join(', ')}.`,
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
  closedComps?: readonly { adjustedPrice?: number | null; closePrice?: number | null; address?: string | null }[] | null
  /** Expired listings the letter counted. Each address has to be in the table. */
  expiredAddresses?: readonly (string | null | undefined)[] | null
  /** The addresses the letter prints (printedAddressesOf). Lets the owner-name check tell a street from a name. */
  printedAddresses?: readonly (string | null | undefined)[] | null
}): { pass: boolean; checks: ContractCheck[] } {
  const checks: ContractCheck[] = [
    letterOwnerNameCheck(args.html, args.names, { printedAddresses: args.printedAddresses }),
    letterLinkTrackingCheck(args.html, args.identity),
    highEndAtOrBelowBandCheck(args.pricing),
    letterRecommendDollarsCheck(args.html, args.pricing),
    bandVersusClosedCompsCheck(args.pricing, args.closedComps),
    countedRowsInDocumentCheck({
      html: args.html,
      sales: (args.closedComps ?? []).map((c) => c.address),
      expired: args.expiredAddresses,
    }),
  ]
  return { pass: checks.every((c) => c.pass), checks }
}
