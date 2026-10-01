/**
 * A sale the MLS shows closed is closed in the Vault. Pure (no I/O); the
 * reads and writes are lib/data/tc/mls-close.ts, the rules in prose are
 * docs/TC_SYSTEM.md "A sale the MLS shows closed".
 *
 * Why (2026-10-01): the Vault copies SkySlope's folder status, and SkySlope
 * lets a sale folder lapse to "Expired" when nobody marks it closed. 909 NW
 * Delaware closed and recorded 2026-09-18 (MLS 220222734: Closed, 2026-09-18,
 * $950,000, Ryan Realty the buyer's office) while the Vault read the deal as
 * dead, "All cycles canceled". The Vault is the system of record (CLAUDE.md
 * §8); SkySlope is a workflow tool and its status is not the truth about a
 * sale. The MLS is: a closing is reported there with its date.
 *
 * The rule. A sale cycle is recorded closed, actual_closing_date = the MLS
 * CloseDate and status 'Closed', when ALL of these hold, whatever SkySlope's
 * status says:
 *   1. the MLS row on the cycle's own mls_number is Closed with a CloseDate;
 *   2. that CloseDate is within MLS_CLOSE_WINDOW_DAYS of the cycle's own
 *      escrow_closing_date (the date its contract set for closing);
 *   3. it is our sale: Ryan Realty is the listing or the buyer's office on the
 *      MLS row;
 *   4. the cycle's contract did not end before the close: no dead_date earlier
 *      than the CloseDate, and no acceptance date later than it;
 *   5. no other sale cycle on the same deal explains that close: none is
 *      already closed on the same MLS number or within the window of that
 *      date, and no second open cycle qualifies for the same close (two
 *      candidates is ambiguous: neither is closed).
 * A listing whose first contract fell through and whose second contract closed
 * fails 2, 4 or 5 for the first cycle, which stays canceled.
 *
 * The deal stage then follows the Vault's own cycles (stageFromCycles, newest
 * first, the derivation the migration and the intake use), so a closed sale
 * only reads as the deal's stage when nothing newer is open on the property.
 */
import { stageFromCycles, type SkySlopeFolderSummary } from './skyslope-mirror-shape'

export const MLS_CLOSE_ACTOR = 'mls-close'
export const MLS_CLOSE_VERSION = 'mls-close-v1-2026-10-01'

/**
 * How far the MLS CloseDate may sit from the cycle's escrow closing date, in
 * calendar days, either way. Measured 2026-10-01 on the 20 sale cycles the
 * Vault already records closed whose MLS row is Closed: 16 match to the day,
 * 1 is one day off, and the other 3 are 16 to 22 days off (dates SkySlope and
 * the MLS disagree on, not a slip; all 20 name Ryan Realty on the MLS row). A
 * closing that slips a weekend (Friday to Monday) is 3 days. The canceled
 * cycles whose listing later closed under another contract sit 11 to 88 days
 * off; the two that sit inside 3 days are held out by rules 3 to 5 (a cycle
 * dead six weeks before a close another brokerage made, 2 days off; a
 * duplicate folder beside the closed one, 3 days off).
 */
export const MLS_CLOSE_WINDOW_DAYS = 3

/** The status word the Vault (and SkySlope, and every rank in the admin) uses for a closed sale. */
export const CLOSED_STATUS = 'Closed'

/** Our office as the MLS names it ("Ryan Realty LLC"). */
const OUR_OFFICE = /\bryan\s+realty\b/i

export type MlsCloseCycle = {
  id: string
  dealId: string
  /** 'sale' | 'listing' */
  kind: string
  status: string | null
  mlsNumber: string | null
  contractAcceptanceDate: string | null
  escrowClosingDate: string | null
  actualClosingDate: string | null
  deadDate: string | null
  /** For newest-first ordering: SkySlope's createdOn, else the row's created_at. */
  createdOn: string | null
}

export type MlsListingFacts = {
  listNumber: string
  status: string | null
  /** YYYY-MM-DD */
  closeDate: string | null
  closePrice: number | null
  purchaseContractDate: string | null
  listOfficeName: string | null
  buyerOfficeName: string | null
}

export type MlsCloseSkipReason =
  | 'not_a_sale'
  | 'already_closed'
  | 'no_mls_number'
  | 'no_mls_row'
  | 'mls_not_closed'
  | 'no_mls_close_date'
  | 'no_escrow_closing_date'
  | 'close_outside_window'
  | 'contract_after_close'
  | 'dead_before_close'
  | 'not_our_sale'
  | 'explained_by_other_cycle'
  | 'ambiguous'

export type MlsCloseEvidence = {
  list_number: string
  mls_status: string
  mls_close_date: string
  mls_close_price: number | null
  mls_purchase_contract_date: string | null
  mls_list_office: string | null
  mls_buyer_office: string | null
  escrow_closing_date: string
  days_from_escrow_date: number
  window_days: number
}

export type MlsCloseDecision =
  | {
      kind: 'close'
      cycleId: string
      dealId: string
      /** Only the columns that change: status when it is not already 'Closed', and the close date. */
      set: { status?: string; actual_closing_date: string }
      evidence: MlsCloseEvidence
    }
  | { kind: 'skip'; cycleId: string; dealId: string; reason: MlsCloseSkipReason; detail?: string }

export function normalizeMlsNumber(v: string | null | undefined): string | null {
  const s = String(v ?? '').trim()
  return s ? s : null
}

/** Whole days from a to b (YYYY-MM-DD, or anything that starts with one). */
export function daysBetween(a: string, b: string): number {
  const t = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)))
  return Math.round((t(b) - t(a)) / 86_400_000)
}

export function isOurOffice(name: string | null | undefined): boolean {
  return OUR_OFFICE.test(name ?? '')
}

const isSale = (c: MlsCloseCycle) => c.kind === 'sale'
const statusClosed = (c: MlsCloseCycle) => /^closed$/i.test((c.status ?? '').trim())

/** One cycle against its MLS row, before the deal's other cycles are considered. */
function candidate(c: MlsCloseCycle, listings: ReadonlyMap<string, MlsListingFacts>): MlsCloseDecision {
  const skip = (reason: MlsCloseSkipReason, detail?: string): MlsCloseDecision => ({ kind: 'skip', cycleId: c.id, dealId: c.dealId, reason, detail })
  if (!isSale(c)) return skip('not_a_sale')
  if (c.actualClosingDate) return skip('already_closed')
  const number = normalizeMlsNumber(c.mlsNumber)
  if (!number) return skip('no_mls_number')
  const l = listings.get(number)
  if (!l) return skip('no_mls_row', number)
  if (l.status !== 'Closed') return skip('mls_not_closed', `${number} ${l.status ?? '?'}`)
  if (!l.closeDate) return skip('no_mls_close_date', number)
  const close = l.closeDate.slice(0, 10)
  if (!c.escrowClosingDate) return skip('no_escrow_closing_date', `MLS closed ${close}`)
  const escrow = c.escrowClosingDate.slice(0, 10)
  const days = daysBetween(escrow, close)
  if (Math.abs(days) > MLS_CLOSE_WINDOW_DAYS) return skip('close_outside_window', `MLS closed ${close}, escrow date ${escrow} (${days > 0 ? '+' : ''}${days} days)`)
  if (c.contractAcceptanceDate && c.contractAcceptanceDate.slice(0, 10) > close) return skip('contract_after_close', `accepted ${c.contractAcceptanceDate.slice(0, 10)}, MLS closed ${close}`)
  if (c.deadDate && c.deadDate.slice(0, 10) < close) return skip('dead_before_close', `dead ${c.deadDate.slice(0, 10)}, MLS closed ${close}`)
  if (!isOurOffice(l.listOfficeName) && !isOurOffice(l.buyerOfficeName)) {
    return skip('not_our_sale', `list ${l.listOfficeName ?? '?'}, buyer ${l.buyerOfficeName ?? '?'}`)
  }
  return {
    kind: 'close',
    cycleId: c.id,
    dealId: c.dealId,
    set: statusClosed(c) ? { actual_closing_date: close } : { status: CLOSED_STATUS, actual_closing_date: close },
    evidence: {
      list_number: number,
      mls_status: l.status,
      mls_close_date: close,
      mls_close_price: l.closePrice,
      mls_purchase_contract_date: l.purchaseContractDate,
      mls_list_office: l.listOfficeName,
      mls_buyer_office: l.buyerOfficeName,
      escrow_closing_date: escrow,
      days_from_escrow_date: days,
      window_days: MLS_CLOSE_WINDOW_DAYS,
    },
  }
}

/**
 * Every cycle on ONE deal, decided. `cycles` is the whole deal (sales and
 * listings, whatever their source); `listings` holds the MLS rows by number.
 */
export function decideMlsCloses(cycles: readonly MlsCloseCycle[], listings: ReadonlyMap<string, MlsListingFacts>): MlsCloseDecision[] {
  const first = cycles.map((c) => candidate(c, listings))
  const closes = first.filter((d): d is Extract<MlsCloseDecision, { kind: 'close' }> => d.kind === 'close')
  const out = first.map((d) => {
    if (d.kind !== 'close') return d
    const explainedBy = cycles.find(
      (s) =>
        s.id !== d.cycleId &&
        isSale(s) &&
        (!!s.actualClosingDate || statusClosed(s)) &&
        (normalizeMlsNumber(s.mlsNumber) === d.evidence.list_number ||
          (!!s.actualClosingDate && Math.abs(daysBetween(s.actualClosingDate, d.evidence.mls_close_date)) <= MLS_CLOSE_WINDOW_DAYS)),
    )
    if (explainedBy) {
      return {
        kind: 'skip' as const,
        cycleId: d.cycleId,
        dealId: d.dealId,
        reason: 'explained_by_other_cycle' as const,
        detail: `cycle ${explainedBy.id} closed ${explainedBy.actualClosingDate ?? '(status Closed)'}`,
      }
    }
    const rivals = closes.filter((o) => o.cycleId !== d.cycleId && o.evidence.list_number === d.evidence.list_number)
    if (rivals.length) {
      return {
        kind: 'skip' as const,
        cycleId: d.cycleId,
        dealId: d.dealId,
        reason: 'ambiguous' as const,
        detail: `${rivals.length + 1} cycles qualify for MLS ${d.evidence.list_number} closed ${d.evidence.mls_close_date}: ${[d.cycleId, ...rivals.map((r) => r.cycleId)].join(', ')}`,
      }
    }
    return d
  })
  return out
}

/** The deal's cycles with the closes applied, for the stage that follows. */
export function applyMlsCloses(cycles: readonly MlsCloseCycle[], decisions: readonly MlsCloseDecision[]): MlsCloseCycle[] {
  const byId = new Map(decisions.filter((d) => d.kind === 'close').map((d) => [d.cycleId, d]))
  return cycles.map((c) => {
    const d = byId.get(c.id)
    if (!d || d.kind !== 'close') return c
    return { ...c, status: d.set.status ?? c.status, actualClosingDate: d.set.actual_closing_date }
  })
}

export type DealStage = { stage: string; stageDetail: string }

/**
 * The deal stage from the Vault's own cycles, the way the migration and the
 * intake derive it (stageFromCycles, newest first). One difference: a listing
 * cycle still reading 'Active' is not on the market when its MLS number has
 * closed (`closedListNumbers`: MLS rows that are Closed, and the numbers of
 * sale cycles the Vault records closed). In-house listing cycles keep the
 * status they were opened with, so without this a sold listing would outrank
 * its own closed sale.
 */
export function deriveVaultDealStage(cycles: readonly MlsCloseCycle[], closedListNumbers: ReadonlySet<string>): DealStage | null {
  if (!cycles.length) return null
  const sold = new Set(closedListNumbers)
  for (const c of cycles) {
    const n = normalizeMlsNumber(c.mlsNumber)
    if (n && isSale(c) && (c.actualClosingDate || statusClosed(c))) sold.add(n)
  }
  const sorted = [...cycles].sort((a, b) => (b.createdOn ?? '').localeCompare(a.createdOn ?? '') || b.id.localeCompare(a.id))
  const summaries: SkySlopeFolderSummary[] = sorted.map((c) => {
    const n = normalizeMlsNumber(c.mlsNumber)
    const listingSold = !isSale(c) && c.status === 'Active' && !!n && sold.has(n)
    return {
      kind: isSale(c) ? 'sales' : 'listings',
      guid: c.id,
      guid8: c.id.slice(0, 8),
      status: listingSold ? CLOSED_STATUS : isSale(c) && c.actualClosingDate ? CLOSED_STATUS : c.status,
      address: null,
      broker: null,
      mlsNumber: n,
      salePrice: null,
      listingPrice: null,
      officeGross: null,
      commissionPercent: null,
      escrowNumber: null,
      sellers: [],
      buyers: [],
      contractAcceptanceDate: c.contractAcceptanceDate,
      escrowClosingDate: c.escrowClosingDate,
      actualClosingDate: c.actualClosingDate,
      expirationDate: null,
      createdOn: c.createdOn,
      requiredOpen: [],
      activityCount: 0,
      filledCount: 0,
    }
  })
  const s = stageFromCycles(summaries)
  return { stage: s.stage, stageDetail: s.stageDetail }
}

export type MlsStageDecision =
  | { kind: 'same'; stage: DealStage }
  | { kind: 'update'; from: { stage: string | null; stageDetail: string | null }; to: DealStage }
  /** The closed sale is not the deal's latest news (a newer sale is open, or the house is back on the market): stage left alone. */
  | { kind: 'hold'; derived: DealStage | null }

/**
 * The stage after this run's closes. It moves only to 'closed', and only
 * when the Vault's cycles, closes applied, say the deal is closed.
 */
export function decideStageAfterMlsClose(input: {
  vaultStage: string | null
  vaultStageDetail: string | null
  cyclesAfter: readonly MlsCloseCycle[]
  closedListNumbers: ReadonlySet<string>
}): MlsStageDecision {
  const derived = deriveVaultDealStage(input.cyclesAfter, input.closedListNumbers)
  if (!derived || derived.stage !== 'closed') return { kind: 'hold', derived }
  if (input.vaultStage === derived.stage && (input.vaultStageDetail ?? '') === derived.stageDetail) return { kind: 'same', stage: derived }
  return { kind: 'update', from: { stage: input.vaultStage, stageDetail: input.vaultStageDetail }, to: derived }
}
