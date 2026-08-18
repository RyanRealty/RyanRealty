/**
 * Estimated remaining mortgage from the last recorded purchase.
 *
 * Oregon does not publish a current loan balance. The clerk records the
 * original trust deed (amount, date, lender) at
 * recordings.deschutes.org. That portal is a click-wrap index, not a
 * feed we can read. This unit estimates remaining principal from the
 * last purchase price, an 80% loan-to-value assumption, and the Freddie
 * Mac 30-year rate for that week. The seller types the real payoff.
 */

const PMMS_HISTORY_CSV_URL = 'https://www.freddiemac.com/pmms/docs/PMMS_history.csv'
const FETCH_TIMEOUT_MS = 12_000
const ASSUMED_LTV = 0.8
const TERM_MONTHS = 360

export const CLERK_RESEARCH_ROOM = 'https://recordings.deschutes.org/DigitalResearchRoomPublic/'

export type MortgageAssumption = {
  purchasePrice: number
  purchaseDate: string
  assumedOriginal: number
  ltvPct: number
  ratePct: number | null
  rateDate: string | null
  rateSource: string | null
  monthsPaid: number
  remainingEstimate: number | null
  source: string
}

export function remainingPrincipal(opts: {
  originalAmount: number
  annualRatePct: number
  termMonths: number
  monthsPaid: number
}): number {
  const P = opts.originalAmount
  if (!(P > 0) || opts.termMonths <= 0) return 0
  if (opts.monthsPaid <= 0) return Math.round(P)
  if (opts.monthsPaid >= opts.termMonths) return 0
  const r = opts.annualRatePct / 100 / 12
  if (!(r > 0)) {
    return Math.max(0, Math.round(P - (P / opts.termMonths) * opts.monthsPaid))
  }
  const powN = (1 + r) ** opts.termMonths
  const powP = (1 + r) ** opts.monthsPaid
  return Math.max(0, Math.round((P * (powN - powP)) / (powN - 1)))
}

export function monthsBetweenIso(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`)
  const to = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0
  return Math.floor((to - from) / (30.44 * 24 * 3600 * 1000))
}

/** Nearest Freddie PMMS 30-year observation on or before the purchase week. */
export function parsePmmsRateOnOrBefore(
  csv: string,
  onOrBefore: string,
): { value: number; date: string } | null {
  const cut = onOrBefore.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cut)) return null
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return null
  const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase())
  const dateIdx = header.indexOf('date')
  const rateIdx = header.indexOf('pmms30')
  if (dateIdx === -1 || rateIdx === -1) return null
  let best: { value: number; date: string } | null = null
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split(',')
    const rawDate = (cells[dateIdx] ?? '').trim()
    const rawRate = (cells[rateIdx] ?? '').trim()
    const value = Number(rawRate)
    if (!rawDate || !Number.isFinite(value) || value <= 0) continue
    const m = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (!m) continue
    const date = `${m[3]}-${m[1]!.padStart(2, '0')}-${m[2]!.padStart(2, '0')}`
    if (date > cut) continue
    if (!best || date > best.date) best = { value, date }
  }
  return best
}

export function mortgageFromPurchase(opts: {
  purchasePrice: number
  purchaseDate: string
  asOf: Date
  ratePct: number | null
  rateDate: string | null
  rateSource: string | null
}): MortgageAssumption | null {
  if (!(opts.purchasePrice > 0)) return null
  const purchaseDate = opts.purchaseDate.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) return null
  const asOf = opts.asOf.toISOString().slice(0, 10)
  const monthsPaid = monthsBetweenIso(purchaseDate, asOf)
  const assumedOriginal = Math.round(opts.purchasePrice * ASSUMED_LTV)
  const remainingEstimate =
    opts.ratePct != null && opts.ratePct > 0
      ? remainingPrincipal({
          originalAmount: assumedOriginal,
          annualRatePct: opts.ratePct,
          termMonths: TERM_MONTHS,
          monthsPaid,
        })
      : null
  const rateBit =
    opts.ratePct != null && opts.rateDate
      ? ` Freddie Mac PMMS 30-year rate ${opts.ratePct}% on ${opts.rateDate}.`
      : ' No weekly rate for that purchase week, so remaining principal is not estimated.'
  return {
    purchasePrice: opts.purchasePrice,
    purchaseDate,
    assumedOriginal,
    ltvPct: ASSUMED_LTV * 100,
    ratePct: opts.ratePct,
    rateDate: opts.rateDate,
    rateSource: opts.rateSource,
    monthsPaid,
    remainingEstimate,
    source: `Last recorded purchase ${purchaseDate} at $${opts.purchasePrice.toLocaleString('en-US')}. Assumed ${ASSUMED_LTV * 100}% loan-to-value, 30-year fixed.${rateBit} Current payoff is not a public record. Confirm on the lender payoff letter or the Deschutes clerk Digital Research Room.`,
  }
}

export async function resolvePurchaseMortgageAssumption(opts: {
  purchasePrice: number
  purchaseDate: string
  asOf: Date
}): Promise<MortgageAssumption | null> {
  let ratePct: number | null = null
  let rateDate: string | null = null
  let rateSource: string | null = null
  try {
    const res = await fetch(PMMS_HISTORY_CSV_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'user-agent': 'ryan-realty-cma/1.0' },
    })
    if (res.ok) {
      const hit = parsePmmsRateOnOrBefore(await res.text(), opts.purchaseDate)
      if (hit) {
        ratePct = hit.value
        rateDate = hit.date
        rateSource = 'Freddie Mac PMMS history CSV, 30-year fixed'
      }
    }
  } catch {
    // Fail open. The sheet still renders. The seller types the payoff.
  }
  return mortgageFromPurchase({ ...opts, ratePct, rateDate, rateSource })
}
