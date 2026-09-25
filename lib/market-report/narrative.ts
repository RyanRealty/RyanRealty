/**
 * The plain-English summary each market section opens with.
 *
 * Every sentence is assembled from the same Kpis object the charts draw, so a
 * sentence can never state a number the page does not show (CLAUDE.md §0.5).
 * A figure under its floor drops out of the sentence instead of being guessed
 * at. Voice: marketing_brain_skills/brand-voice/VOICE.md. No em dashes.
 */
import { MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { count, days, money, monthName, months1 } from './format'
import type { Kpis, TierRowOut, Verdict } from './types'

export const VERDICT_LABEL: Record<Verdict, string> = {
  seller: "a seller's market",
  balanced: 'a balanced market',
  buyer: "a buyer's market",
}

/** The threshold that decided a verdict, said the way marketVerdict() computes it. */
export const VERDICT_THRESHOLD: Record<Verdict, string> = {
  seller: "4 months or less is a seller's market",
  balanced: 'above 4 and under 6 months is balanced',
  buyer: "6 months or more is a buyer's market",
}

export type HomesNoun = { one: string; many: string }

export const NOUN_SFR: HomesNoun = { one: 'single-family home', many: 'single-family homes' }
export const NOUN_DETACHED: HomesNoun = { one: 'single-family home', many: 'single-family homes' }
export const NOUN_CONDO: HomesNoun = { one: 'condo or townhome', many: 'condos and townhomes' }
export const NOUN_ACREAGE: HomesNoun = { one: 'home on an acre or more', many: 'homes on an acre or more' }

function upDown(p: number): string {
  const r = Math.round(p * 100)
  if (r === 0) return 'about even with'
  return `${r > 0 ? 'up' : 'down'} ${Math.abs(r)}% from`
}

function periodPhrase(k: Kpis): { now: string; ago: string } {
  const endKey = k.period.end.slice(0, 7)
  const month = monthName(endKey)
  const priorYear = String(Number(endKey.slice(0, 4)) - 1)
  if (k.period.kind === 'month') return { now: `in ${month}`, ago: `${month} ${priorYear}` }
  if (k.period.kind === 'trailing3') {
    return { now: `in the three months through ${month}`, ago: `the same three months of ${priorYear}` }
  }
  return { now: `in the twelve months through ${month}`, ago: 'the twelve months before' }
}

/** Two to four sentences for one market. */
export function marketSummary(place: string, noun: HomesNoun, k: Kpis): string[] {
  const { now, ago } = periodPhrase(k)
  const out: string[] = []

  if (k.sales === 0) {
    out.push(`No ${noun.many} sold in ${place} ${now}.`)
  } else if (k.median.v != null) {
    const change = k.medianYoY != null ? `, ${upDown(k.medianYoY)} ${ago}` : ''
    out.push(`The median ${noun.one} in ${place} sold for ${money(k.median.v)} ${now}${change}.`)
  }

  if (k.sales > 0) {
    const sold = k.sales === 1 ? `1 ${noun.one} sold` : `${count(k.sales)} ${noun.many} sold`
    if (k.salesYoY != null) {
      const diff = k.sales - k.salesPrior
      const cmp = diff === 0 ? 'the same number as' : `${count(Math.abs(diff))} ${diff > 0 ? 'more' : 'fewer'} than`
      out.push(`${sold}, ${cmp} ${ago}.`)
    } else if (k.median.v == null) {
      out.push(`${sold} ${now}.`)
    } else {
      out.push(`${sold}.`)
    }
  }

  if (k.dtc.v != null) {
    out.push(`Homes that sold went under contract in a median of ${days(k.dtc.v)}.`)
  }

  if (k.mos != null && k.verdict != null) {
    const endMonth = monthName(k.period.end.slice(0, 7))
    const homes = k.active === 1 ? '1 was' : `${count(k.active)} were`
    out.push(
      `At the end of ${endMonth}, ${homes} for sale against ${count(k.closed6)} sales over the past six months: ${months1(k.mos)} months of supply, ${VERDICT_LABEL[k.verdict]} by our measure (${VERDICT_THRESHOLD[k.verdict]}).`,
    )
  }
  return out
}

/**
 * Where the market splits by price, in one sentence, when it does. Only tiers
 * with a publishable verdict speak.
 */
export function tierSentence(tiers: readonly TierRowOut[]): string | null {
  const judged = tiers.filter((t) => t.verdict != null)
  if (judged.length < 2) return null
  const sellerTiers = judged.filter((t) => t.verdict === 'seller')
  const buyerTiers = judged.filter((t) => t.verdict === 'buyer')
  if (sellerTiers.length === 0 || buyerTiers.length === 0) return null
  const list = (xs: string[]) =>
    xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
  return `By price the market splits: ${list(sellerTiers.map((t) => t.label))} ran as a seller's market, while ${list(buyerTiers.map((t) => t.label))} gave buyers more room.`
}

/** The threshold sentence that rides with every printed verdict. */
export const VERDICT_RULE = `${MOS_THRESHOLD_CLAUSE} Months of supply is homes for sale at month end divided by the average monthly sales of the last six months.`
