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
import { trackedDocLink, type TrackedDocLinkCtx } from '@/lib/cma/doc-links'
import {
  finalAskOf,
  priceChangeCountOf,
  pricePathFromFinalCycle,
  pricePathFromListing,
  pricePathFromSale,
  shortUsd,
  type PricePath,
} from '@/lib/cma/price-path'
import { keyFor, type CmaMapFamily } from '@/lib/cma/map-families'
import type { CmaPinFact } from '@/lib/cma/comp-pin-map'
import type { ExpiredFinalCycle } from '@/lib/cma/expired-audit'
import type { CmaExpiredPeer } from '@/lib/cma/market-status'
import type { CmaBandRival } from '@/lib/cma/band-rivals'
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'

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
  firstAsk: number | null
  lastAsk: number | null
  /** Close price when family is closed; null otherwise. */
  closePrice: number | null
  /** List/ask used for list $/sqft. */
  listPrice: number | null
  /** Seller concessions $ on a closed sale; null when unknown or not a sale. */
  concessionsAmount: number | null
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
  return /^\s*(\d+[A-Za-z]?)\s/.exec(address)?.[1] ?? null
}

function streetNameOf(address: string): string | null {
  return address.replace(/^\s*\d+[A-Za-z]?\s+/, '').trim() || null
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
): MatrixEntry[] {
  return comps.map((c, i) => {
    const path = pricePathFromSale(c)
    const toOffer = days(c.daysToOffer)
    const ran = days(c.domTotal)
    const outcome = [
      c.closePrice > 0 ? `sold ${shortUsd(c.closePrice)}` : 'sold',
      toOffer != null
        ? `offer in ${int(toOffer)} ${toOffer === 1 ? 'day' : 'days'}`
        : ran != null
          ? `listed to closed, ${int(ran)} ${ran === 1 ? 'day' : 'days'}`
          : '',
    ]
      .filter(Boolean)
      .join(' · ')
    const remarks = remarksOf(c)
    return {
      key: keyFor('closed', i),
      family: 'closed' as const,
      address: c.address,
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
      baths: c.baths ?? null,
      // ON MARKET, not to offer: this row is the same measure in all three
      // matrices, and an unsold listing has no offer to count days to.
      domDays: ran ?? toOffer,
      // `pricePathFromSale` draws from the ask the sale went under contract
      // at; no original ask reaches the renderer for a comparable sale, so the
      // path's own change count is always zero and would assert something the
      // record does not say. Only an original ask on the row makes it knowable.
      priceChanges: movedOrNull(num(c.originalListPrice), num(c.listPrice)),
      priceChangesExact: false,
      path,
      firstAsk: num(c.originalListPrice) ?? num(c.listPrice),
      lastAsk: num(c.listPrice),
      closePrice: c.closePrice > 0 ? c.closePrice : null,
      listPrice: num(c.listPrice) ?? num(c.originalListPrice),
      concessionsAmount: (() => {
        const v = c.concessions ?? c.concessionsAmount ?? null
        return v != null && Number.isFinite(v) ? Number(v) : null
      })(),
      endLabel: c.closePrice > 0 ? `sold ${shortUsd(c.closePrice)}` : 'sold',
      latitude: c.latitude ?? null,
      longitude: c.longitude ?? null,
      sort: sortAttrs([
        ['date', /^\d{4}-\d{2}-\d{2}$/.test((c.closeDate ?? '').slice(0, 10)) ? (c.closeDate ?? '').slice(0, 10) : null],
        ['price', c.adjustedPrice != null && Number.isFinite(c.adjustedPrice) ? Math.round(c.adjustedPrice) : null],
        ['size', c.sqft != null && Number.isFinite(c.sqft) ? Math.round(c.sqft) : null],
        ['days', ran ?? toOffer],
      ]),
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
): MatrixEntry[] {
  return peers.map((p, i) => {
    const path = pricePathFromListing({
      address: p.address,
      listPrice: p.listPrice,
      originalListPrice: p.originalListPrice,
      onMarketDate: p.onMarketDate,
      daysOnMarket: p.daysOnMarket,
      status: p.status,
    })
    const dom = days(p.daysOnMarket)
    const remarks = remarksOf(p)
    return {
      key: keyFor('unsold', i),
      family: 'unsold' as const,
      address: p.address,
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
      outcome: dom != null ? `came off after ${int(dom)} ${dom === 1 ? 'day' : 'days'}` : 'came off unsold',
      yearBuilt: p.yearBuilt ?? null,
      remodelNote: remodelFragment(remarks),
      remarksRead: remarks != null,
      sqft: p.sqft ?? null,
      lotAcres: p.lotAcres ?? null,
      rooms: roomsOf(p),
      beds: p.beds ?? null,
      baths: p.baths ?? null,
      domDays: dom,
      priceChanges: movedOrNull(num(p.originalListPrice), num(p.listPrice)),
      priceChangesExact: false,
      path,
      firstAsk: num(p.originalListPrice) ?? num(p.listPrice),
      lastAsk: num(p.listPrice),
      closePrice: null,
      listPrice: num(p.listPrice) ?? num(p.originalListPrice),
      concessionsAmount: null,
      endLabel: 'came off',
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
): MatrixEntry[] {
  return rivals.map((r, i) => {
    const path = pricePathFromListing({
      address: r.address,
      listPrice: r.listPrice,
      originalListPrice: r.originalListPrice ?? null,
      onMarketDate: r.onMarketDate ?? null,
      daysOnMarket: r.daysOnMarket,
      status: r.status,
    })
    const dom = days(r.daysOnMarket)
    const pending = r.status === 'Pending'
    const remarks = remarksOf(r)
    return {
      key: keyFor('active', i),
      family: 'active' as const,
      address: r.address,
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
        pending ? `under contract at ${shortUsd(r.listPrice)}` : `asking ${shortUsd(r.listPrice)}`,
        dom != null ? `${int(dom)} ${dom === 1 ? 'day' : 'days'}` : '',
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
      baths: r.baths ?? null,
      domDays: dom,
      priceChanges: movedOrNull(num(r.originalListPrice), num(r.listPrice)),
      priceChangesExact: false,
      path,
      firstAsk: num(r.originalListPrice) ?? num(r.listPrice),
      lastAsk: num(r.listPrice),
      closePrice: null,
      listPrice: num(r.listPrice) ?? num(r.originalListPrice),
      concessionsAmount: null,
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
}): MatrixEntry {
  const s = input.subject
  const path =
    pricePathFromFinalCycle(input.finalCycle ?? null, s.streetAddress) ??
    pricePathFromListing({
      address: s.streetAddress,
      listPrice: input.printableAsk,
      originalListPrice: input.printableAsk,
      onMarketDate: s.lastListDate,
      daysOnMarket: input.domDays,
      status: s.standardStatus,
    })
  const status = (s.standardStatus ?? '').trim().toLowerCase()
  const cameOff = /^(expired|withdrawn|cancell?ed)/.test(status)
  // Capitalised, unlike the other three families: this cell is a statement
  // about the reader's own home rather than a label under a pin.
  const outcome = cameOff
    ? input.domDays != null
      ? `Came off after ${int(input.domDays)} ${input.domDays === 1 ? 'day' : 'days'}`
      : 'Came off unsold'
    : input.printableAsk != null && input.printableAsk > 0
      ? `Listed ${usd(input.printableAsk)}${
          input.domDays != null ? ` · ${int(input.domDays)} ${input.domDays === 1 ? 'day' : 'days'}` : ''
        }`
      : 'Not on the market'
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
    baths: s.baths ?? null,
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
    endLabel: cameOff ? 'came off' : input.printableAsk != null ? 'still asking' : '',
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
      priceChanges: e.priceChanges,
      priceChangesExact: e.priceChangesExact,
      latitude: e.latitude,
      longitude: e.longitude,
    }))
}
