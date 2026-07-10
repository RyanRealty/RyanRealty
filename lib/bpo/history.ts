/**
 * BPO listing-history analysis — the move a CMA does not make.
 *
 * Every prior MLS listing attempt at the property is a data point about how the
 * market has already priced this home. A house that chased $1.725M through two
 * canceled listings over a year, then relisted at $1.275M and still sits at 78
 * days, is telling you something the static comps cannot: the market has
 * repeatedly rejected the ask. This module reconstructs that record from the
 * listings rows (one per ListingKey) and the per-event listing_history rows,
 * classifies each attempt's outcome, and emits the signals + a bounded pricing
 * pressure that the opinion engine reconciles against the comps.
 *
 * Nothing here estimates. Prices, dates, DOM, and cut counts all come straight
 * from the MLS rows and are traced for citations (CLAUDE.md section 0).
 */

import type { CmaSubject } from '@/lib/cma/types'
import type { BpoListingCycle, BpoListingHistory, BpoHistorySignal } from '@/lib/bpo/types'
import type { BpoListingRow } from '@/lib/data/bpo/reads'
import { formatPriceExact } from '@/lib/format/money'

const usd = formatPriceExact

function num(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}
function str(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : null
  return s || null
}

function classifyOutcome(status: string | null, closePrice: number | null): string {
  const s = (status ?? '').toLowerCase()
  if (closePrice && closePrice > 0) return 'sold'
  if (s.includes('closed') || s.includes('sold')) return 'sold'
  if (s.includes('active under contract') || s.includes('pending')) return 'pending'
  if (s === 'active') return 'active'
  if (s.includes('cancel')) return 'canceled'
  if (s.includes('expire')) return 'expired'
  if (s.includes('withdraw')) return 'withdrawn'
  return 'other'
}

function domOf(row: BpoListingRow): number | null {
  return num(row['CumulativeDaysOnMarket']) ?? num(row['DaysOnMarket'])
}

function rowToCycle(row: BpoListingRow): BpoListingCycle {
  const status = str(row['StandardStatus'])
  const closePrice = num(row['ClosePrice'])
  return {
    listingKey: str(row['ListingKey']),
    mlsNumber: str(row['ListNumber']),
    status,
    listAgentName: str(row['ListAgentName']),
    listOfficeName: str(row['ListOfficeName']),
    listDate: str(row['ListDate']) ?? str(row['OnMarketDate']),
    offMarketDate: str(row['off_market_date']) ?? str(row['CloseDate']) ?? str(row['status_change_timestamp']),
    originalListPrice: num(row['OriginalListPrice']),
    finalListPrice: num(row['ListPrice']),
    closePrice,
    daysOnMarket: domOf(row),
    priceCutCount: num(row['price_drop_count']),
    totalPriceChangeAmt: num(row['total_price_change_amt']),
    wasRelisted: row['was_relisted'] === true,
    outcome: classifyOutcome(status, closePrice),
  }
}

function pct(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null
  return +(((part - whole) / whole) * 100).toFixed(1)
}

/**
 * Analyze the property's MLS listing history.
 *
 * @param cycleRows all listings rows at the address (newest ListDate first)
 * @param subject the resolved subject (its ListingKey is the "current" cycle)
 * @param marketMedianDom verified city median DOM (staleness reference), or null
 */
export function analyzeListingHistory(
  cycleRows: BpoListingRow[],
  subject: CmaSubject,
  marketMedianDom: number | null,
): BpoListingHistory {
  const trace: string[] = []
  const cycles = cycleRows.map(rowToCycle)
  trace.push(`Reconstructed ${cycles.length} MLS listing cycle(s) at ${subject.streetAddress}.`)

  // The "current" cycle is the subject's own listing key, else the newest row.
  let currentCycle: BpoListingCycle | null =
    (subject.listingKey ? cycles.find((c) => c.listingKey === subject.listingKey) : null) ??
    cycles[0] ??
    null
  const currentIsActive = (currentCycle?.outcome ?? '') === 'active'

  const failed = cycles.filter((c) => c.outcome === 'canceled' || c.outcome === 'expired' || c.outcome === 'withdrawn')
  const sold = cycles.filter((c) => c.outcome === 'sold' && c.closePrice)
  // Last closed sale (most recent by off-market date).
  const lastSale = sold
    .slice()
    .sort((a, b) => String(b.offMarketDate ?? '').localeCompare(String(a.offMarketDate ?? '')))[0] ?? null

  const asks = cycles
    .map((c) => c.originalListPrice ?? c.finalListPrice)
    .filter((n): n is number => n != null && n > 0)
  const peakAskingPrice = asks.length ? Math.max(...asks) : null

  const currentListPrice = currentCycle?.finalListPrice ?? null
  const currentOriginalListPrice = currentCycle?.originalListPrice ?? null
  const currentDaysOnMarket = currentCycle?.daysOnMarket ?? null
  const currentCutFromOriginalPct =
    currentListPrice != null && currentOriginalListPrice != null
      ? pct(currentListPrice, currentOriginalListPrice)
      : null
  const totalDeclineFromPeakPct =
    currentListPrice != null && peakAskingPrice != null && peakAskingPrice > currentListPrice
      ? pct(currentListPrice, peakAskingPrice)
      : null

  // ── Signals ────────────────────────────────────────────────────────────────
  const signals: BpoHistorySignal[] = []

  if (failed.length >= 2) {
    signals.push({
      code: 'repeated_failed_attempts',
      severity: 'strong',
      text: `${failed.length} prior listing attempts came off the market without selling${
        failed[0]?.finalListPrice ? `, the highest asking ${usd(Math.max(...failed.map((f) => f.finalListPrice ?? f.originalListPrice ?? 0)))}` : ''
      }. The market has already declined the home at those prices.`,
    })
  } else if (failed.length === 1) {
    signals.push({
      code: 'repeated_failed_attempts',
      severity: 'caution',
      text: `One prior listing attempt ended ${failed[0]?.outcome ?? 'off-market'} without a sale${
        failed[0]?.finalListPrice ? ` at ${usd(failed[0]!.finalListPrice!)}` : ''
      }.`,
    })
  }

  if (totalDeclineFromPeakPct != null && totalDeclineFromPeakPct <= -12) {
    signals.push({
      code: 'chronic_overpricing',
      severity: 'strong',
      text: `The ask has fallen ${Math.abs(totalDeclineFromPeakPct)}% from a peak of ${usd(peakAskingPrice!)} to ${usd(currentListPrice!)} and has still not sold.`,
    })
  }

  if (currentIsActive && currentDaysOnMarket != null && marketMedianDom != null && marketMedianDom > 0) {
    const ratio = currentDaysOnMarket / marketMedianDom
    if (ratio >= 1.5) {
      signals.push({
        code: 'stale_current_listing',
        severity: ratio >= 2.5 ? 'strong' : 'caution',
        text: `The current listing has been on market ${currentDaysOnMarket} days, ${ratio.toFixed(1)}x the area median of ${Math.round(marketMedianDom)} days. Extended exposure without a sale points to a price above where the market clears.`,
      })
    }
  }

  if (currentCutFromOriginalPct != null && currentCutFromOriginalPct <= -3) {
    signals.push({
      code: 'meaningful_cut',
      severity: 'caution',
      text: `The current cycle has already cut ${Math.abs(currentCutFromOriginalPct)}% from its ${usd(currentOriginalListPrice!)} original ask.`,
    })
  }

  if (currentIsActive && failed.length === 0 && currentDaysOnMarket != null && currentDaysOnMarket <= 21) {
    signals.push({
      code: 'fresh_to_market',
      severity: 'info',
      text: `Fresh to market — ${currentDaysOnMarket} days in with no prior failed attempts. Too early to read demand from time on market.`,
    })
  }

  if (lastSale?.closePrice && lastSale.offMarketDate) {
    signals.push({
      code: 'last_sale',
      severity: 'info',
      text: `Last recorded sale ${usd(lastSale.closePrice)}${lastSale.offMarketDate ? ` (${String(lastSale.offMarketDate).slice(0, 10)})` : ''}.`,
    })
  }

  if (cycles.length <= 1 && !currentIsActive && failed.length === 0 && !lastSale) {
    signals.push({
      code: 'no_mls_history',
      severity: 'info',
      text: 'No prior MLS listing history for this property. The opinion rests on comparable sales and market conditions alone.',
    })
  }

  // ── Bounded pricing pressure from demonstrated market rejection ──────────────
  // History never inflates value above the comps; it can only pull the opinion
  // toward (or below) the comp reconciliation when the home has been rejected.
  let pressure = 0
  if (failed.length >= 2) pressure -= 0.02
  if (currentIsActive && currentDaysOnMarket != null && marketMedianDom != null && marketMedianDom > 0) {
    if (currentDaysOnMarket / marketMedianDom >= 2.5) pressure -= 0.02
    else if (currentDaysOnMarket / marketMedianDom >= 1.5) pressure -= 0.01
  }
  if (totalDeclineFromPeakPct != null && totalDeclineFromPeakPct <= -15) pressure -= 0.01
  pressure = Math.max(-0.06, Math.min(0, +pressure.toFixed(3)))

  trace.push(
    `Attempts: ${cycles.length} total, ${failed.length} failed (canceled/expired/withdrawn), ${sold.length} closed. ` +
      `Current: ${currentIsActive ? 'active' : (currentCycle?.outcome ?? 'none')}` +
      `${currentDaysOnMarket != null ? `, ${currentDaysOnMarket} DOM` : ''}` +
      `${currentListPrice != null ? `, list ${usd(currentListPrice)}` : ''}. ` +
      `Peak ask ${peakAskingPrice != null ? usd(peakAskingPrice) : '—'}. Listing pressure ${(pressure * 100).toFixed(1)}%.`,
  )

  return {
    cycles,
    attemptsCount: cycles.length,
    failedAttemptsCount: failed.length,
    currentCycle,
    currentIsActive,
    currentDaysOnMarket,
    currentListPrice,
    currentOriginalListPrice,
    currentCutFromOriginalPct,
    peakAskingPrice,
    totalDeclineFromPeakPct,
    lastSalePrice: lastSale?.closePrice ?? null,
    lastSaleDate: lastSale?.offMarketDate ? String(lastSale.offMarketDate).slice(0, 10) : null,
    signals,
    listingPressureAdjustmentPct: pressure,
    trace,
  }
}
