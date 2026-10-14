/**
 * LAST STRETCH, LABELED (Matt 2026-10-08).
 *
 * A home that was relisted or came back on the market before it sold is
 * measured on one clock, its last stretch on the market: its days to an offer
 * run from the last time it came on the market (as Bend's 26-day median is
 * measured), and the first ask printed for it is the price in effect when that
 * stretch began. Where the stretch is not the listing's first, the letter says
 * so ("after it last came on the market").
 *
 * The build stamps each row's stretch (`ListingStretch`, lib/cma/listing-status.ts)
 * off the MLS status log and ask history. Every surface that prints a first
 * ask, an original list, a price-change count or a restart label asks these
 * helpers, so the grid, the cards, the pins, the days chart and the
 * competition read one answer.
 *
 * The MLS OriginalListPrice stays on every row untouched, for display where
 * these helpers already handle it. The price reads the same clock (Matt
 * 2026-10-08, "Yes, after this landing"): the list engine's sale-to-original
 * shares over the comps divide by `saleOriginalAsk`, and rule 16's cut test
 * reads the subject's last-stretch first ask (lib/cma/expired-audit.ts
 * failedAskCutOriginal).
 *
 * Pure.
 */
import { pacificDay, type ListingStretch } from '@/lib/cma/listing-status'

/** The label a row carries when its stretch is not its listing's first. */
export const AFTER_LAST_ON_MARKET = 'after it last came on the market'
/** The same clock named in a sentence that counts several homes. */
export const OF_LAST_ON_MARKET = 'of last coming on the market'

export type StretchRead = {
  /** The ask in effect when the last stretch began. Null when the record cannot say. */
  firstAsk: number | null
  /** True when the last stretch is not the listing's first. */
  restarted: boolean
}

function positive(n: number | null | undefined): number | null {
  return n != null && Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

/**
 * A closed sale's stretch. Stamped at build (`CmaComp.stretch`). A row stored
 * before the stamp still says whether it restarted, because its offer clock
 * (`offerFrom`, the day the listing period that produced the sale went Active)
 * starts after its first list (`onMarketDate`); its first ask on that stretch
 * is then known only when the ask never moved over the whole listing, and is
 * otherwise left unprinted rather than taken from an earlier stretch.
 */
export function saleStretch(c: {
  stretch?: ListingStretch | null
  offerFrom?: string | null
  onMarketDate?: string | null
  originalListPrice?: number | null
  listPrice?: number | null
}): StretchRead {
  if (c.stretch) return { firstAsk: positive(c.stretch.firstAsk), restarted: c.stretch.restarted === true }
  const original = positive(c.originalListPrice)
  const list = positive(c.listPrice)
  const offerDay = pacificDay(c.offerFrom ?? null)
  const firstDay = pacificDay(c.onMarketDate ?? null)
  const restarted = offerDay != null && firstDay != null && offerDay > firstDay
  if (!restarted) return { firstAsk: original, restarted: false }
  return { firstAsk: original != null && list != null && original === list ? list : null, restarted: true }
}

/**
 * The original ask a closed sale's sale-to-original share divides by (Matt
 * 2026-10-08, "Yes, after this landing"): the first ask of the listing period
 * that produced the sale, the same figure the grid prints for it. A relisted
 * sale's original ask is the ask in effect when its last stretch began (61197
 * Cottonwood: $774,900 when it came back Nov 13, not April's $849,900), and a
 * Coming Soon price changed before it went Active is not one. A stretch that
 * came back with no ask on record has no share, never one off an earlier
 * stretch's ask. A sale with no stamped stretch keeps its MLS
 * OriginalListPrice, as every build read it before.
 */
export function saleOriginalAsk(c: Parameters<typeof saleStretch>[0]): number | null {
  return saleStretch(c).firstAsk
}

/**
 * A listing still for sale, under contract, or one that came off unsold. Its
 * stretch is stamped at build; a stored row without one keeps the asks on the
 * row, because nothing stored says whether it came back.
 */
export function listingStretchRead(r: {
  stretch?: ListingStretch | null
  originalListPrice?: number | null
  listPrice?: number | null
}): StretchRead {
  if (r.stretch) return { firstAsk: positive(r.stretch.firstAsk), restarted: r.stretch.restarted === true }
  return { firstAsk: positive(r.originalListPrice), restarted: false }
}

/**
 * The first ask a column prints. A row with no opening ask on record prints
 * its current ask there, as it always has, unless its stretch restarted, when
 * the current ask is not known to be where that stretch began.
 */
export function printedFirstAsk(read: StretchRead, listPrice: number | null | undefined): number | null {
  return read.firstAsk ?? (read.restarted ? null : positive(listPrice))
}

/**
 * The final cycle's opening ask as the market saw it: an ask changed on the
 * day the stretch began replaces the opening one, which never ran a day. The
 * ask exposure already reads the cycle this way ("two steps on one day
 * collapse"), so the chart and the sentence about the first ask agree with it.
 * 20676 Wild Rose's stored cycle opens at its Coming Soon $625,000 with a
 * change to $599,900 dated the day it went Active; it was Active only at
 * $599,900.
 */
export function cycleOpeningAsk(
  cycle:
    | {
        listDate?: string | null
        initialAsk?: number | null
        cuts?: ReadonlyArray<{ date: string | null; ask: number }> | null
        cutsDated?: boolean
      }
    | null
    | undefined,
): number | null {
  if (!cycle) return null
  const start = pacificDay(cycle.listDate ?? null)
  let ask = positive(cycle.initialAsk)
  if (start && cycle.cutsDated !== false) {
    for (const cut of cycle.cuts ?? []) {
      if (pacificDay(cut.date) !== start) continue
      const next = positive(cut.ask)
      if (next != null) ask = next
    }
  }
  return ask
}

/**
 * The first ask the letter prints for the reader's own home: the first ask of
 * its last stretch on the market (Matt 2026-10-08). The ask exposure's first
 * segment when the letter has one, else the stamped stretch, else the final
 * cycle's opening as the market saw it, else the MLS OriginalListPrice on a
 * row stored before any of these.
 */
export function subjectFirstAsk(input: {
  subject: { originalListPrice?: number | null; stretch?: ListingStretch | null }
  exposure?: { segments?: ReadonlyArray<{ ask?: number | null }> | null } | null
  finalCycle?: Parameters<typeof cycleOpeningAsk>[0]
}): number | null {
  const segment = positive(input.exposure?.segments?.[0]?.ask ?? null)
  if (segment != null) return segment
  if (input.subject.stretch) return positive(input.subject.stretch.firstAsk)
  const opening = cycleOpeningAsk(input.finalCycle)
  if (opening != null) return opening
  return positive(input.subject.originalListPrice)
}

/**
 * "offer in 47 days", or, on a stretch that restarted, "offer 47 days after it
 * last came on the market".
 */
export function offerDaysPhrase(days: number, restarted: boolean): string {
  const n = Math.round(days)
  const count = `${n.toLocaleString('en-US')} ${n === 1 ? 'day' : 'days'}`
  return restarted ? `offer ${count} ${AFTER_LAST_ON_MARKET}` : `offer in ${count}`
}

/**
 * The sales a sentence names as counted from the day each last came on the
 * market: "Sale 4, 61197 Cottonwood, counts from the day it last came on the
 * market." Null when none restarted.
 */
export function restartedSalesLine(sales: ReadonlyArray<{ n: number; address: string }>): string | null {
  if (sales.length === 0) return null
  const named = sales.map((s) => `sale ${s.n.toLocaleString('en-US')}, ${s.address},`)
  const list =
    named.length === 1
      ? named[0]!
      : `${named.slice(0, -1).join(' ')} and ${named[named.length - 1]}`
  const subject = list.charAt(0).toUpperCase() + list.slice(1)
  return sales.length === 1
    ? `${subject} counts from the day it last came on the market.`
    : `${subject} count from the day each last came on the market.`
}
