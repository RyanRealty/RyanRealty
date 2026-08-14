/**
 * ClosePrice is the contract / sold price. Seller concessions are a separate
 * MLS field (Spark ConcessionsAmount + Concessions YN). They do not change
 * ClosePrice. They do change seller net from that price.
 *
 * Measured on sale_pricing_facts detached, PK-bounded details->Concessions:
 * 2024 and 2025 rows with a null amount are YN No (300/300). Amount > 0 is
 * YN Yes (150/150). 2022–2023 nulls mix No, Yes-without-dollars, and blank YN,
 * so those years stay unknown unless YN or an amount is present.
 */

export const CONCESSIONS_YN_NO_INFERRED_FROM = '2024-01-01'

function money(n: number | null | undefined): number | null {
  if (n == null) return null
  return Number.isFinite(n) && n >= 0 ? n : null
}

function ynNorm(yn: string | null | undefined): 'Yes' | 'No' | null {
  const s = (yn ?? '').trim().toLowerCase()
  if (s === 'yes') return 'Yes'
  if (s === 'no') return 'No'
  return null
}

export function resolveConcessions(opts: {
  amount: number | null | undefined
  yn?: string | null
  closeDate?: string | null
}): number | null {
  const amount = money(opts.amount)
  if (amount != null) return amount
  const yn = ynNorm(opts.yn)
  if (yn === 'No') return 0
  if (yn === 'Yes') return null
  const close = (opts.closeDate ?? '').slice(0, 10)
  if (close && close >= CONCESSIONS_YN_NO_INFERRED_FROM) return 0
  return null
}

export function sellerNetFromPrice(closePrice: number, concessions: number | null): number | null {
  if (!(closePrice > 0) || concessions == null) return null
  return Math.round(closePrice - concessions)
}

export type ConcessionSummary = {
  knownCount: number
  givenCount: number
  medianIncludingZero: number | null
  medianWhenGiven: number | null
  rate: number | null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!
}

export function summarizeConcessions(
  rows: Array<{
    concessionsAmount?: number | null
    concessionsYn?: string | null
    closeDate?: string | null
  }>,
): ConcessionSummary {
  const known = rows
    .map((r) => resolveConcessions({ amount: r.concessionsAmount, yn: r.concessionsYn, closeDate: r.closeDate }))
    .filter((n): n is number => n != null)
  const given = known.filter((n) => n > 0)
  return {
    knownCount: known.length,
    givenCount: given.length,
    medianIncludingZero: median(known),
    medianWhenGiven: median(given),
    rate: known.length ? given.length / known.length : null,
  }
}

export function predictedSellerNet(
  predictedClose: number | null,
  expectedConcessions: number | null,
): number | null {
  if (predictedClose == null || expectedConcessions == null) return null
  return sellerNetFromPrice(predictedClose, expectedConcessions)
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export function attachSellerNet(
  pricing: {
    recommended: number
    notes: string[]
    sellerNet?: {
      expectedConcessions: number | null
      predictedSellerNet: number | null
      knownCount: number
      givenCount: number
      medianWhenGiven: number | null
      rate: number | null
    }
  } | null,
  comps: Array<{
    concessionsAmount?: number | null
    concessionsYn?: string | null
    closeDate?: string | null
  }>,
  predictedClose?: number | null,
): ConcessionSummary {
  const summary = summarizeConcessions(comps)
  const close = predictedClose ?? pricing?.recommended ?? null
  const expected = summary.knownCount > 0 ? summary.medianIncludingZero : null
  if (pricing) {
    pricing.sellerNet = {
      expectedConcessions: expected,
      predictedSellerNet: predictedSellerNet(close, expected),
      knownCount: summary.knownCount,
      givenCount: summary.givenCount,
      medianWhenGiven: summary.medianWhenGiven,
      rate: summary.rate,
    }
    const note = concessionNote(summary, close)
    if (!pricing.notes.includes(note)) pricing.notes.unshift(note)
  }
  return summary
}

export function concessionNote(summary: ConcessionSummary, predictedClose: number | null): string {
  if (summary.knownCount === 0) {
    return 'Close price is the contract price. Seller concessions were not reported on this comparable set, so seller net from the close cannot be computed.'
  }
  if (summary.givenCount === 0) {
    return `Close price is the contract price. None of the ${summary.knownCount} comparable sales that reported the field gave a seller concession. Seller net from the close equals the close price before commission and closing costs.`
  }
  const whenGiven = summary.medianWhenGiven != null ? usd(summary.medianWhenGiven) : 'an unreported amount'
  const expected = summary.medianIncludingZero
  const closeBit = predictedClose != null ? ` The close estimate is ${usd(predictedClose)}.` : ''
  const net =
    predictedClose != null && expected != null ? predictedSellerNet(predictedClose, expected) : null
  const netBit =
    net != null
      ? ` Seller net from that close, after the typical concession in this set (${usd(expected!)}), is ${usd(net)} before commission and closing costs.`
      : ''
  return `Close price is the contract price. Seller concessions come off that number before commission and closing costs. ${summary.givenCount} of ${summary.knownCount} comparable sales reported a concession, median ${whenGiven} when given.${closeBit}${netBit}`
}
