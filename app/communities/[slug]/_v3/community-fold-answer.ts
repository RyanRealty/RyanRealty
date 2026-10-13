/**
 * Above-the-fold answer on every /communities/[slug] page.
 *
 * Words the live leftover / Market Truth figures the page already reads
 * (leftoverHudKpis + getPublicDetachedPace). A missing or non-positive
 * figure drops its clause. Nothing here invents a count, a price, or a
 * day count (§0). The citation is the one Matt named: Oregon Data Share
 * MLS, as of the page's own stamp.
 */

import { formatPriceExact } from '@/lib/format/money'

export type CommunityFoldAnswerInput = {
  place: string
  asOfLabel: string | null
  /** Single-family homes for sale (hud.active). */
  active: number | null
  /** Median list of those homes (hud.medianList). */
  medianList: number | null
  /** Median close, last 12 months (publicPace.medianClose). */
  medianSale12: number | null
  /**
   * Median days to contract. Prefer the 90-day leftover cell
   * (hud.daysToPending / publicPace.daysToPending90d); else the 12-month
   * cell (publicPace.daysToContract). Name the window that produced it.
   */
  daysToContract: number | null
  daysToContractWindow: '90 days' | '12 months' | null
}

export type CommunityFoldAnswer = {
  /** 1–3 sentences. Empty when every figure is withheld. */
  sentences: string[]
  /** Citation when a figure printed. Null on the no-figure fallback. */
  source: string | null
  /**
   * Honest body when the page has no live figure to print. Never names a
   * count or a dollar. Null when sentences is non-empty.
   */
  fallback: string | null
}

function money(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  const printed = formatPriceExact(n)
  return printed.startsWith('$') ? printed : null
}

function count(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  return n
}

function days(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  const tenths = Math.round(n * 10) / 10
  if (tenths <= 0) return null
  return Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1)
}

export function communityHomesForSaleHeading(name: string): string {
  const place = name.trim()
  return place ? `${place} Homes for Sale` : 'Homes for Sale'
}

export function communityFoldSource(asOfLabel: string | null): string {
  const when = asOfLabel?.trim()
  return when ? `Oregon Data Share MLS, as of ${when}` : 'Oregon Data Share MLS'
}

/**
 * Prefer the 90-day leftover cell; else the 12-month pace cell. A zero or
 * non-finite value is a miss, not a printed zero.
 */
export function communityFoldDaysToContract(
  days90: number | null | undefined,
  days12: number | null | undefined,
): Pick<CommunityFoldAnswerInput, 'daysToContract' | 'daysToContractWindow'> {
  if (days90 != null && Number.isFinite(days90) && days90 > 0) {
    return { daysToContract: days90, daysToContractWindow: '90 days' }
  }
  if (days12 != null && Number.isFinite(days12) && days12 > 0) {
    return { daysToContract: days12, daysToContractWindow: '12 months' }
  }
  return { daysToContract: null, daysToContractWindow: null }
}

/**
 * Two or three sentences when the figures support them; one sentence when
 * only one figure is live; a no-number fallback when none are.
 */
export function communityFoldAnswer(input: CommunityFoldAnswerInput): CommunityFoldAnswer {
  const place = input.place.trim()
  if (!place) {
    return { sentences: [], source: null, fallback: null }
  }

  const active = count(input.active)
  const list = money(input.medianList)
  const sale = money(input.medianSale12)
  const dtc = days(input.daysToContract)
  const window = input.daysToContractWindow

  const sentences: string[] = []

  if (active != null && list) {
    sentences.push(
      `${place} has ${active.toLocaleString('en-US')} ${
        active === 1 ? 'single-family home' : 'single-family homes'
      } for sale at a median list price of ${list}.`,
    )
  } else if (active != null) {
    sentences.push(
      `${place} has ${active.toLocaleString('en-US')} ${
        active === 1 ? 'single-family home' : 'single-family homes'
      } for sale.`,
    )
  } else if (list) {
    sentences.push(`Homes for sale in ${place} have a median list price of ${list}.`)
  }

  if (sale) {
    sentences.push(`Over the last 12 months, the median sale price was ${sale}.`)
  }

  if (dtc && window === '90 days') {
    sentences.push(
      `Homes that went under contract in the last 90 days spent a median of ${dtc} days to contract.`,
    )
  } else if (dtc && window === '12 months') {
    sentences.push(`Over the last 12 months, the median days to contract was ${dtc}.`)
  }

  if (sentences.length === 0) {
    return {
      sentences: [],
      source: null,
      fallback: `Live ${place} sale and list figures did not load for this view. The homes below are the current listings when they are on the page.`,
    }
  }

  return {
    sentences: sentences.slice(0, 3),
    source: communityFoldSource(input.asOfLabel),
    fallback: null,
  }
}
