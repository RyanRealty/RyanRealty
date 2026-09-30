/**
 * The plain-English summary each market section opens with.
 *
 * Every sentence is assembled from the same Kpis object the charts draw, so a
 * sentence can never state a number the page does not show (CLAUDE.md §0.5).
 * A figure under its floor drops out of the sentence instead of being guessed
 * at. Voice: marketing_brain_skills/brand-voice/VOICE.md. No em dashes.
 */
import { MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { count, days, money, monthName, mosText } from './format'
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

/**
 * The main series is single-family homes on less than an acre; the noun says
 * so, because a reader holding another report's all-lots median would
 * otherwise compare two different populations.
 */
export const NOUN_SFR: HomesNoun = { one: 'single-family home on less than an acre', many: 'single-family homes on less than an acre' }
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
    // After the median sentence has named the homes, the count does not repeat the noun.
    const named = out.length > 0
    const sold = named
      ? `${count(k.sales)} sold`
      : k.sales === 1
        ? `1 ${noun.one} sold`
        : `${count(k.sales)} ${noun.many} sold`
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
      `At the end of ${endMonth}, ${homes} for sale against ${count(k.closed6)} sales over the past six months: ${mosText(k.mos)} months of supply, ${VERDICT_LABEL[k.verdict]} by our measure (${VERDICT_THRESHOLD[k.verdict]}).`,
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

/**
 * What a dash means, in the floors the builder actually enforces
 * (build-edition.ts, FLOORS), one clause per figure the tables print:
 *   median         a median needs `median` sales in its period
 *   dtc            days to pending needs `dtc` of those sales to carry a
 *                  pending date (it is counted on dtc_n, not on sales)
 *   yoy, yoyCount  a change from a year ago needs that many sales in the
 *                  period in each of the two years: `yoy` for the median's
 *                  change, `yoyCount` for the homes-sold change. They are
 *                  separate registry stats, so while they agree the sentence
 *                  states one number and the moment they differ it states two
 *   mos            a market call (months of supply, and the verdict it
 *                  carries) needs `mos` sales in the six months that feed it
 * One wording for the web page and the PDF, so the two can never state the
 * rule two ways. The floors are passed in, not imported: build-edition
 * imports this module.
 */
export function floorsRule(floors: {
  median: number
  dtc: number
  yoy: number
  yoyCount: number
  mos: number
}): string {
  const change =
    floors.yoy === floors.yoyCount
      ? `a change from a year ago needs ${floors.yoy} sales in each year`
      : `a change in the median from a year ago needs ${floors.yoy} sales in each year, ` +
        `and a change in homes sold needs ${floors.yoyCount} in each year`
  return (
    `A dash means too few sales to publish. A median needs ${floors.median} sales, ` +
    `and days to pending needs ${floors.dtc} sales with a pending date; ` +
    `${change}; a market call needs ${floors.mos} sales in the last six months.`
  )
}
