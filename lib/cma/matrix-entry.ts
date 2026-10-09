/**
 * ONE COLUMN SET FOR THREE MATRICES (Delta 3, 2026-09-08).
 *
 * Matt: "we'll break out the matrices of comparables so that we start with the
 * closed comparables, the ones that set the price. We look at people that
 * expired in that same area, and we have ours right next to it. All of our
 * subject properties in that matrix, with all of the details: year built,
 * notes on remodel, size, lot size, rooms, bathrooms, bedrooms. We do the same
 * thing for these homes that were listed in the same area but were not able to
 * sell. This is who your competition is right now."
 *
 * A closed sale, an unsold peer and a live rival arrive on `render_args` in
 * three different shapes. This file turns each into ONE shape, so the three
 * matrices are literally the same renderer with the same rows in the same
 * order — which is the only way a reader can carry a comparison from one to
 * the next.
 *
 * Pure. Every field is a recorded figure off the row or arithmetic over two of
 * them; nothing here computes a valuation, and nothing invents a fact the
 * record does not carry (CLAUDE.md §0).
 */

import { UNADDRESSED_DOC_LINKS, cleanText, escapeHtml, int, usd } from '@/lib/cma/render-blocks'
import { printedBaths } from '@/lib/pricing/bath-count'
import { trackedDocLink, type TrackedDocLinkCtx } from '@/lib/cma/doc-links'
import { proximityLabel } from '@/lib/cma/market-area'
import { publishStreetNumber, publishUnparsedStreetLine } from '@/lib/listing/publish-street-line'
import {
  finalAskOf,
  priceChangeCountOf,
  pricePathFromListing,
  pricePathFromSale,
  subjectPricePath,
  shortOrExactUsd,
  shortUsd,
  type PricePath,
} from '@/lib/cma/price-path'
import { keyFor, type CmaMapFamily } from '@/lib/cma/map-families'
import type { CmaPinFact } from '@/lib/cma/comp-pin-map'
import type { ExpiredFinalCycle } from '@/lib/cma/expired-audit'
import { closedSaleDaysToOffer, onMarketAfterClose } from '@/lib/cma/listing-history-line'
import { pacificDay } from '@/lib/cma/listing-status'
import {
  AFTER_LAST_ON_MARKET,
  listingStretchRead,
  offerDaysPhrase,
  printedFirstAsk,
  saleStretch,
  subjectFirstAsk,
} from '@/lib/cma/last-stretch'
import { sellerOffMarketDate } from '@/lib/cma/seller-letter-copy'
import type { AskExposureLike } from '@/lib/cma/ask-position'
import type { CmaExpiredPeer } from '@/lib/cma/market-status'
import { rivalDays, type CmaBandRival } from '@/lib/cma/band-rivals'
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'
import { concessionOnSale, printedAdjustedPrice } from '@/lib/pricing/seller-net'

const esc = escapeHtml

/** One home in one of the three matrices, and the pin that names it. */
export type MatrixEntry = {
  key: string
  family: CmaMapFamily | 'subject'
  address: string
  href: string | null
  photoUrl: string | null
  /** "sold $457K · offer in 25 days" — the same line the pin reveals. */
  outcome: string
  yearBuilt: number | null
  /** The MLS remark fragment about a remodel, as written. Null when unread. */
  remodelNote: string | null
  /** True when remarks WERE read and carried no such sentence. */
  remarksRead: boolean
  sqft: number | null
  lotAcres: number | null
  rooms: number | null
  beds: number | null
  baths: number | null
  domDays: number | null
  /**
   * What `domDays` counts. `offer` is Active to an accepted offer on the
   * listing period that produced it: a closed sale's days before it sold, and
   * a home under contract's days to its contract. `listed-to-closed` is first
   * list to close, printed only when the offer day is unknown, and the cell
   * says so beside the number. Absent on unsold and live rows, where the count
   * is the days on market.
   */
  domMeasure?: 'offer' | 'listed-to-closed'
  /**
   * How many times the ask moved — and whether that count is EXACT.
   *
   * The record carries two different things. A dated cycle (the seller's own
   * listing) holds every change with its date, so the count is a count. Every
   * other row holds an opening ask and today's ask and nothing between them,
   * so what is known is whether the price moved AT ALL — and printing "1" or
   * "none" there states something the MLS never said (CLAUDE.md §0). A closed
   * sale with no original ask on the row knows neither, and prints nothing.
   */
  priceChanges: number | null
  priceChangesExact: boolean
  path: PricePath | null
  /**
   * The first ask of the home's last stretch on the market: the price in
   * effect when that stretch began (Matt 2026-10-08), so it and the days
   * beside it are one clock. Null when the record cannot say.
   */
  firstAsk: number | null
  /**
   * True when that stretch is not the listing's first (it was withdrawn,
   * expired or fell out of contract and came back). The outcome line says so.
   */
  restarted?: boolean
  lastAsk: number | null
  /** Close price when family is closed; null otherwise. */
  closePrice: number | null
  /** List/ask used for list $/sqft. */
  listPrice: number | null
  /** Seller concessions $ on a closed sale; 0 when none; null when unknown or not a sale. */
  concessionsAmount: number | null
  /** Flex FLOW: distance + direction when known ("0.2 mi NW"). */
  proximity: string | null
  /** Flex FLOW: garage spaces when known. */
  garageSpaces: number | null
  /** Flex FLOW: cumulative DOM when distinct from first-list DOM. */
  cdomDays: number | null
  /** Flex FLOW: status date (close / off-market / under contract) ISO or display. */
  statusDate: string | null
  /** Flex FLOW: adjusted sale for closed comps; null elsewhere. */
  adjustedPrice: number | null
  /** The end of the path in words: "sold $457K", "asking $417K", "came off". */
  endLabel: string
  latitude: number | null
  longitude: number | null
  /** Sort attributes the interactive layer re-orders on. */
  sort: string
  /**
   * `active` / `pending` on matrix 3, so the chapter's filter can hide a
   * column by what a reader asked to see. Absent on the other two families:
   * every closed sale closed, and every unsold listing came off.
   */
  status?: 'active' | 'pending'
  /** MLS StandardStatus on an unsold row. Canceled and Withdrawn stay those words. */
  mlsStatus?: string | null
  /**
   * A closed sale the range trim set aside (lib/cma/set-aside.ts): printed and
   * pinned, but not one of the sales the number is the spread of. The map
   * draws its pin lighter and the legend names it. Absent on every other row.
   */
  setAside?: boolean
}

/** The MLS status word a seller letter may print. Anything else stays unlabeled. */
export function mlsStatusLabel(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim()
  if (/^expired\b/i.test(s)) return 'Expired'
  if (/^withdrawn\b/i.test(s)) return 'Withdrawn'
  if (/^cancell?ed\b/i.test(s)) return 'Canceled'
  if (/^closed\b/i.test(s)) return 'Closed'
  if (/^pending\b/i.test(s)) return 'Pending'
  if (/^active\b/i.test(s)) return 'Active'
  return null
}

// ── the remodel fragment ────────────────────────────────────────────────────

/**
 * WHAT THE MLS SAYS ABOUT A REMODEL, IN THE WORDS IT SAYS IT IN.
 *
 * Delta 3: "notes on remodel ... the MLS remark fragment, shown as written,
 * only when the remarks say updated / remodeled / new roof / new kitchen and
 * the like; otherwise 'none noted'." Never paraphrased, never summarised, and
 * never inferred from a year built — a broker's own sentence is evidence, and
 * anything we write over the top of it is our claim about somebody else's
 * house.
 */
const REMODEL_RE =
  /\b(updated?|update|remodell?ed|remodel|renovated?|renovation|refreshed|new roof|new kitchen|new bath|new baths|new bathroom|new windows|new hvac|new furnace|new flooring|addition)\b/i

/** Sentence-ish split. MLS remarks are not always punctuated like prose. */
function sentencesOf(remarks: string): string[] {
  return remarks
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function remodelFragment(remarks: string | null | undefined): string | null {
  const text = cleanText(remarks ?? null)
  if (!text) return null
  for (const sentence of sentencesOf(text)) {
    if (REMODEL_RE.test(sentence)) return sentence
  }
  return null
}

/** The cell: the fragment as written, "none noted", or nothing was read. */
export function remodelCell(entry: Pick<MatrixEntry, 'remodelNote' | 'remarksRead'>): string {
  if (entry.remodelNote) return entry.remodelNote
  return entry.remarksRead ? 'none noted' : '-'
}

// ── shared readers ──────────────────────────────────────────────────────────

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Rooms total, when the record carries one.
 *
 * The MLS reports a total room count on some rows and not others, and it is
 * not on `CmaComp` — so it is read off the row without asserting it exists,
 * and the row folds away when nothing in the matrix has one. Never derived
 * from beds plus baths: that is a different number wearing this one's label.
 */
export function roomsOf(row: unknown): number | null {
  const o = row as Record<string, unknown> | null | undefined
  return num(o?.roomsTotal ?? o?.RoomsTotal ?? o?.rooms) ?? null
}

function remarksOf(row: unknown): string | null {
  const o = row as Record<string, unknown> | null | undefined
  const v = o?.publicRemarks
  return typeof v === 'string' ? v : null
}

function streetNumberOf(address: string): string | null {
  const n = /^\s*(\d+[A-Za-z]?)\s/.exec(address)?.[1] ?? null
  return publishStreetNumber(n)
}

function streetNameOf(address: string): string | null {
  const published = publishUnparsedStreetLine(address)
  if (!published) return null
  return published.replace(/^\s*\d+[A-Za-z]?\s+/, '').trim() || published
}

function publishedAddress(address: string): string {
  return publishUnparsedStreetLine(address) ?? address.trim()
}

function finiteCoord(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Lat/lng under whichever key the row was stored with. */
function rowCoords(row: object | null | undefined): { lat: number | null; lng: number | null } {
  const o = (row ?? {}) as Record<string, unknown>
  return {
    lat: finiteCoord(o.latitude ?? o.Latitude ?? o.lat),
    lng: finiteCoord(o.longitude ?? o.Longitude ?? o.lng ?? o.lon),
  }
}

function entryProximity(
  subject: { latitude?: number | null; longitude?: number | null } | null | undefined,
  row: object | null | undefined,
): string | null {
  if (!subject) return null
  const { lat, lng } = rowCoords(row)
  return proximityLabel(
    { lat: subject.latitude ?? null, lng: subject.longitude ?? null },
    { lat, lng },
  )
}

function sortAttrs(parts: Array<[string, string | number | null]>): string {
  return parts
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => ` data-sort-${k}="${esc(String(v))}"`)
    .join('')
}

function days(n: number | null | undefined): number | null {
  return n != null && Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

/**
 * DID THE PRICE MOVE, from an opening ask and an ask today.
 *
 * 1 means "at least once" and the cell says so; 0 means the two figures are
 * the same, which IS a fact; null means the record carries no opening ask and
 * the question cannot be answered at all.
 */
function movedOrNull(first: number | null, last: number | null): number | null {
  if (first == null || !(first > 0) || last == null || !(last > 0)) return null
  return first === last ? 0 : 1
}

// ── the three builders ──────────────────────────────────────────────────────

/**
 * Matrix 1. The closed sales that set the price.
 *
 * "sold $457K · offer in 25 days" — the outcome names its own measure, because
 * this document prints days-to-offer and days-on-market for the same sale and
 * a bare day count cannot be told apart (CLAUDE.md §7).
 */
export function closedEntries(
  comps: readonly CmaAdjustedComp[],
  ctx?: TrackedDocLinkCtx | null,
  subject?: { latitude?: number | null; longitude?: number | null } | null,
  /** The grid's set-aside decision (`setAsideSalePredicate`). Absent marks none. */
  isSetAside?: (sale: CmaAdjustedComp) => boolean,
): MatrixEntry[] {
  return comps.map((c, i) => {
    // ONE CLOCK, THE LAST STRETCH (Matt 2026-10-08): the first ask is the
    // price in effect when the offer clock started, and a sale that came back
    // on the market says so beside its count.
    const stretch = saleStretch(c)
    const path = pricePathFromSale({ ...c, firstAsk: stretch.firstAsk })
    // ONE clock per sale (reader review 2026-10-07). The row and the outcome
    // line print the same count: days to an accepted offer when the record
    // knows it, else first list to close, labeled as that. An offer count
    // longer than the run to close is not one (2107 Carrie, 67 of 66).
    const ranRaw = days(c.domTotal)
    // A stored 0 whose on-market day is after the close is not a run
    // (1654 Meadow). A positive list-to-close count still prints.
    const ran =
      ranRaw === 0 && onMarketAfterClose(c.offerFrom ?? c.onMarketDate, c.closeDate) ? null : ranRaw
    const toOffer = closedSaleDaysToOffer({
      daysToOffer: c.daysToOffer,
      measuredFrom: c.offerFrom ?? null,
      domTotal: ran,
      firstListDate: c.onMarketDate,
      closeDate: c.closeDate,
    })
    const outcome = [
      c.closePrice > 0 ? `sold ${shortOrExactUsd(c.closePrice)}` : 'sold',
      toOffer != null
        ? offerDaysPhrase(toOffer, stretch.restarted)
        : ran != null
          ? `listed to closed, ${int(ran)} ${ran === 1 ? 'day' : 'days'}`
          : '',
      c.sewerNote?.trim() || '',
    ]
      .filter(Boolean)
      .join(' · ')
    const remarks = remarksOf(c)
    return {
      key: keyFor('closed', i),
      family: 'closed' as const,
      address: publishedAddress(c.address),
      href: trackedDocLink(
        'listing',
        {
          listingKey: c.listingKey,
          mlsNumber: c.mlsNumber,
          streetNumber: streetNumberOf(c.address),
          streetName: streetNameOf(c.address),
          city: c.city,
          subdivisionName: c.subdivision,
        },
        ctx ?? UNADDRESSED_DOC_LINKS,
      ),
      photoUrl: c.photoUrl?.trim() || null,
      outcome,
      yearBuilt: c.yearBuilt ?? null,
      remodelNote: remodelFragment(remarks),
      remarksRead: remarks != null,
      sqft: c.sqft ?? null,
      lotAcres: c.lotAcres ?? null,
      rooms: roomsOf(c),
      beds: c.beds ?? null,
      baths: printedBaths(c),
      // Days on market for a sale ends at the accepted offer, the same place
      // an unsold listing's count ends when it comes off with none. The raw
      // list-to-close figure is never printed as days on market (CLAUDE.md
      // §7); when it is the only count, the cell names it.
      domDays: toOffer ?? ran,
      domMeasure: toOffer != null ? ('offer' as const) : ran != null ? ('listed-to-closed' as const) : undefined,
      // `pricePathFromSale` draws from the ask the sale went under contract
      // at; no original ask reaches the renderer for a comparable sale, so the
      // path's own change count is always zero and would assert something the
      // record does not say. Only an original ask on the row makes it knowable.
      priceChanges: movedOrNull(stretch.firstAsk, num(c.listPrice)),
      priceChangesExact: false,
      path,
      firstAsk: printedFirstAsk(stretch, num(c.listPrice)),
      ...(stretch.restarted && toOffer != null ? { restarted: true } : {}),
      lastAsk: num(c.listPrice),
      closePrice: c.closePrice > 0 ? c.closePrice : null,
      listPrice: num(c.listPrice) ?? stretch.firstAsk,
      concessionsAmount: concessionOnSale(c),
      proximity: (c.proximity ?? '').trim() || entryProximity(subject, c),
      garageSpaces: c.garageSpaces != null && Number.isFinite(c.garageSpaces) ? Number(c.garageSpaces) : null,
      // The same count as the row above: a second clock in the next row was
      // the disagreement this replaced.
      cdomDays: toOffer ?? ran,
      statusDate: /^\d{4}-\d{2}-\d{2}/.test((c.closeDate ?? '').slice(0, 10))
        ? (c.closeDate ?? '').slice(0, 10)
        : null,
      adjustedPrice: printedAdjustedPrice(c),
      endLabel: c.closePrice > 0 ? `sold ${shortOrExactUsd(c.closePrice)}` : 'sold',
      latitude: c.latitude ?? null,
      longitude: c.longitude ?? null,
      sort: sortAttrs([
        ['date', /^\d{4}-\d{2}-\d{2}$/.test((c.closeDate ?? '').slice(0, 10)) ? (c.closeDate ?? '').slice(0, 10) : null],
        ['price', c.adjustedPrice != null && Number.isFinite(c.adjustedPrice) ? Math.round(c.adjustedPrice) : null],
        ['size', c.sqft != null && Number.isFinite(c.sqft) ? Math.round(c.sqft) : null],
        ['days', toOffer ?? ran],
      ]),
      ...(isSetAside?.(c) ? { setAside: true } : {}),
    }
  })
}

/**
 * Matrix 2. The listings in the same area that came off unsold.
 *
 * "came off after 36 days" — Delta 3's own words. The price is on the first
 * ask / last ask row beside it; the outcome line is about the event.
 */
export function unsoldEntries(
  peers: readonly CmaExpiredPeer[],
  ctx?: TrackedDocLinkCtx | null,
  city?: string | null,
  subject?: Pick<CmaSubject, 'latitude' | 'longitude'> | null,
): MatrixEntry[] {
  return peers.map((p, i) => {
    const stretch = listingStretchRead(p)
    const path = pricePathFromListing({
      address: p.address,
      listPrice: p.listPrice,
      originalListPrice: stretch.firstAsk,
      onMarketDate: p.onMarketDate,
      daysOnMarket: p.daysOnMarket,
      status: p.status,
    })
    const dom = days(p.daysOnMarket)
    const remarks = remarksOf(p)
    return {
      key: keyFor('unsold', i),
      family: 'unsold' as const,
      address: publishedAddress(p.address),
      href: trackedDocLink(
        'listing',
        {
          listingKey: p.listingKey ?? null,
          streetNumber: streetNumberOf(p.address),
          streetName: streetNameOf(p.address),
          city: city ?? null,
        },
        ctx ?? UNADDRESSED_DOC_LINKS,
      ),
      photoUrl: p.photoUrl?.trim() || null,
      outcome:
        dom != null
          ? stretch.restarted
            ? `came off ${int(dom)} ${dom === 1 ? 'day' : 'days'} ${AFTER_LAST_ON_MARKET}`
            : `came off after ${int(dom)} ${dom === 1 ? 'day' : 'days'}`
          : 'came off unsold',
      yearBuilt: p.yearBuilt ?? null,
      remodelNote: remodelFragment(remarks),
      remarksRead: remarks != null,
      sqft: p.sqft ?? null,
      lotAcres: p.lotAcres ?? null,
      rooms: roomsOf(p),
      beds: p.beds ?? null,
      baths: printedBaths(p),
      domDays: dom,
      priceChanges: movedOrNull(stretch.firstAsk, num(p.listPrice)),
      priceChangesExact: false,
      path,
      firstAsk: printedFirstAsk(stretch, num(p.listPrice)),
      ...(stretch.restarted && dom != null ? { restarted: true } : {}),
      lastAsk: num(p.listPrice),
      closePrice: null,
      listPrice: num(p.listPrice) ?? stretch.firstAsk,
      concessionsAmount: null,
      proximity: (p as { proximity?: string | null }).proximity?.trim() || entryProximity(subject, p),
      garageSpaces: null,
      cdomDays: dom,
      // The date beside the status the column prints: the day the listing took
      // its status of record (3204 Spring Creek, expired Jul 31), not the day
      // its days on the market ended (withdrawn Jan 20) when those differ.
      statusDate:
        p.statusDate ??
        sellerOffMarketDate({
          listDate: p.onMarketDate,
          offMarketDate: p.offMarketDate ?? null,
          days: dom,
        }),
      adjustedPrice: null,
      endLabel: 'came off',
      mlsStatus: p.status,
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      sort: sortAttrs([
        ['price', num(p.listPrice)],
        ['size', p.sqft != null ? Math.round(p.sqft) : null],
        ['days', dom],
      ]),
    }
  })
}

/**
 * Matrix 3. The homes asking in this range now.
 *
 * "asking $417K · 13 days" for a live listing; a home already under contract
 * says so, because "asking" on a house nobody can buy is the wrong word.
 */
export function activeEntries(
  rivals: readonly CmaBandRival[],
  ctx?: TrackedDocLinkCtx | null,
  city?: string | null,
  subject?: Pick<CmaSubject, 'latitude' | 'longitude'> | null,
): MatrixEntry[] {
  return rivals.map((r, i) => {
    const pending = r.status === 'Pending'
    // A HOME UNDER CONTRACT IS DATED THE DAY IT WENT UNDER CONTRACT, AND ITS
    // DAYS ARE THE DAYS TO THAT OFFER (reader review 2026-10-08). 2820 Aldrich
    // went Pending Sep 11 after 18 days and printed "Status date Aug 24, 2026"
    // and "44 days", its list date and the days since. A stored row without
    // the pending day has neither fact, so it prints neither (rivalDays).
    const pendingDay = pending ? (r.pendingDate ?? null) : null
    const told = rivalDays(r)
    const dom = told.days
    const stretch = listingStretchRead(r)
    const path = pricePathFromListing({
      address: r.address,
      listPrice: r.listPrice,
      originalListPrice: stretch.firstAsk,
      onMarketDate: r.onMarketDate ?? null,
      daysOnMarket: dom,
      status: r.status,
      daysMeasure: told.measure,
    })
    const remarks = remarksOf(r)
    return {
      key: keyFor('active', i),
      family: 'active' as const,
      address: publishedAddress(r.address),
      href: trackedDocLink(
        'listing',
        {
          listingKey: r.listingKey,
          streetNumber: streetNumberOf(r.address),
          streetName: streetNameOf(r.address),
          city: city ?? null,
        },
        ctx ?? UNADDRESSED_DOC_LINKS,
      ),
      photoUrl: r.photoUrl?.trim() || null,
      outcome: [
        // The MLS carries a pending home's LIST price, not its contract price
        // (reader review 2026-10-08: "under contract at $799K" read as the
        // price it went under contract at).
        pending ? `listed at ${shortUsd(r.listPrice)}, under contract` : `asking ${shortUsd(r.listPrice)}`,
        dom != null
          ? pending
            ? offerDaysPhrase(dom, stretch.restarted)
            : `${int(dom)} ${dom === 1 ? 'day' : 'days'}${stretch.restarted ? ' since it last came on the market' : ''}`
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
      yearBuilt: r.yearBuilt ?? null,
      remodelNote: remodelFragment(remarks),
      remarksRead: remarks != null,
      sqft: r.sqft ?? null,
      lotAcres: r.lotAcres ?? null,
      rooms: roomsOf(r),
      beds: r.beds ?? null,
      baths: printedBaths(r),
      domDays: dom,
      ...(pending && dom != null ? { domMeasure: 'offer' as const } : {}),
      priceChanges: movedOrNull(stretch.firstAsk, num(r.listPrice)),
      priceChangesExact: false,
      path,
      firstAsk: printedFirstAsk(stretch, num(r.listPrice)),
      ...(stretch.restarted && dom != null ? { restarted: true } : {}),
      lastAsk: num(r.listPrice),
      closePrice: null,
      listPrice: num(r.listPrice) ?? stretch.firstAsk,
      concessionsAmount: null,
      proximity: (r as { proximity?: string | null }).proximity?.trim() || entryProximity(subject, r),
      garageSpaces: null,
      cdomDays: dom,
      statusDate: pending ? pendingDay : pacificDay(r.onMarketDate ?? null),
      adjustedPrice: null,
      endLabel: pending ? 'under contract' : 'still for sale',
      latitude: r.latitude ?? null,
      longitude: r.longitude ?? null,
      status: pending ? ('pending' as const) : ('active' as const),
      sort: sortAttrs([
        ['price', num(r.listPrice)],
        ['size', r.sqft != null ? Math.round(r.sqft) : null],
        ['days', dom],
      ]),
    }
  })
}

/**
 * The reader's own home, as the first column of every matrix.
 *
 * Delta 3: "we have ours right next to it. All of our subject properties in
 * that matrix." It carries the same facts as every other column — that is the
 * comparison — and its price path is its own failed listing when there is one.
 */
export function subjectEntry(input: {
  subject: CmaSubject
  finalCycle?: ExpiredFinalCycle | null
  domDays: number | null
  /** Only an ask this listing still has. `subjectPrintableAsk` decides. */
  printableAsk: number | null
  /** Exposure segments, when the letter has them. The resolver prefers lastListPrice. */
  exposure?: AskExposureLike | null
}): MatrixEntry {
  const s = input.subject
  const path = subjectPricePath({
    cycle: input.finalCycle ?? null,
    label: s.streetAddress,
    lastListPrice: s.lastListPrice,
    exposure: input.exposure,
    onMarketDate: s.lastListDate,
    daysOnMarket: input.domDays,
    status: s.standardStatus,
    printableAsk: input.printableAsk,
    // The first ask of its last stretch on the market (Matt 2026-10-08).
    originalListPrice: subjectFirstAsk({
      subject: s,
      exposure: input.exposure ?? null,
      finalCycle: input.finalCycle ?? null,
    }),
  })
  const status = (s.standardStatus ?? '').trim().toLowerCase()
  const cameOff = /^(expired|withdrawn|cancell?ed)/.test(status)
  // Lower case, like the other three families. The outcome is a label in a
  // cell or under a pin, beside the peers' own ("came off after 96 days"), and
  // a sentence that opens with it capitalises it there. 2745 Aldrich printed
  // "Came off after 108 days" in the subject's column beside a peer's "came
  // off after 96 days" (reader review 2026-10-08).
  const outcome = cameOff
    ? input.domDays != null
      ? `came off after ${int(input.domDays)} ${input.domDays === 1 ? 'day' : 'days'}`
      : 'came off unsold'
    : input.printableAsk != null && input.printableAsk > 0
      ? `listed ${usd(input.printableAsk)}${
          input.domDays != null ? ` · ${int(input.domDays)} ${input.domDays === 1 ? 'day' : 'days'}` : ''
        }`
      : 'not on the market'
  const remarks = remarksOf(s)
  return {
    key: 'subject',
    family: 'subject',
    address: s.streetAddress,
    href: null,
    photoUrl: s.photoUrl?.trim() || null,
    outcome,
    yearBuilt: s.yearBuilt ?? null,
    remodelNote: remodelFragment(remarks),
    remarksRead: remarks != null,
    sqft: s.sqft ?? null,
    lotAcres: s.lotAcres ?? null,
    rooms: roomsOf(s),
    beds: s.beds ?? null,
    baths: printedBaths(s),
    domDays: input.domDays,
    // The one row whose changes ARE dated: the seller's own final cycle.
    priceChanges: path ? priceChangeCountOf(path) : null,
    priceChangesExact: (input.finalCycle?.cutsDated ?? false) === true,
    path,
    firstAsk: path?.startPrice ?? input.printableAsk,
    lastAsk: path ? finalAskOf(path) : input.printableAsk,
    closePrice: null,
    listPrice: input.printableAsk,
    concessionsAmount: null,
    proximity: null,
    garageSpaces: s.garageSpaces != null && Number.isFinite(s.garageSpaces) ? Number(s.garageSpaces) : null,
    cdomDays: input.domDays,
    // The date beside the status the column prints: Coho's listing expired
    // Sep 30, months after it came off on Feb 10, and its Status reads Expired.
    statusDate: cameOff
      ? (input.finalCycle?.statusDate ??
        sellerOffMarketDate({
          listDate: input.finalCycle?.listDate ?? s.lastListDate,
          offMarketDate: input.finalCycle?.offMarketDate,
          days: input.finalCycle?.days ?? null,
        }))
      : pacificDay(s.lastListDate ?? null),
    adjustedPrice: null,
    endLabel: cameOff ? 'came off' : input.printableAsk != null ? 'still asking' : '',
    mlsStatus: s.standardStatus ?? null,
    latitude: s.latitude ?? null,
    longitude: s.longitude ?? null,
    // The reader's own home never sorts: it is the first column, always.
    sort: '',
  }
}

/** What the map's pins reveal, off the same entries the matrices print. */
export function pinFactsFor(entries: readonly MatrixEntry[]): CmaPinFact[] {
  return entries
    .filter((e): e is MatrixEntry & { family: CmaMapFamily } => e.family !== 'subject')
    .map((e) => ({
      key: e.key,
      family: e.family,
      address: e.address,
      outcome: e.outcome,
      domDays: e.domDays,
      domMeasure: e.domMeasure,
      priceChanges: e.priceChanges,
      priceChangesExact: e.priceChangesExact,
      latitude: e.latitude,
      longitude: e.longitude,
      ...(e.status ? { status: e.status } : {}),
      ...(e.setAside ? { setAside: true } : {}),
    }))
}
