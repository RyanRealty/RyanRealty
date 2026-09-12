/**
 * WHEN THE LISTING AND THE HOUSE'S OWN RECORD DISAGREE (Matt 2026-09-10:
 * "flag it, use the history").
 *
 * A listing agent types the bedroom and bathroom count. The county and the
 * closed sale record what was there when the house last changed hands. When
 * those disagree at the SAME square footage, one of them is wrong, and the
 * count decides which sales are comparable — so the error propagates into the
 * whole comp set before anyone sees it.
 *
 * 23 Benaiah is the case that produced this rule: listed 5 bed / 4 bath at
 * 2,080 sqft, closed twice in its own history at 4 bed / 3 bath at the same
 * 2,080 sqft, with the identical floorplan next door recorded 4 bed / 4 bath.
 *
 * THE RULE. The house's own closed record wins over the current listing, and
 * the conflict is flagged for review either way.
 *
 * THE ONE BOUND, and it is stated rather than hidden. A closed record only
 * describes the house as it was on its close date. Bathrooms get added: 31
 * Benaiah, the identical plan on the same street, is recorded 3 bath in 2008
 * and 4 bath in 2014, and nothing is wrong with either record. So a record
 * older than ROOM_HISTORY_MAX_AGE_YEARS is reported as a conflict but does NOT
 * override the listing — preferring a sixteen-year-old count would be trading
 * one wrong number for another. Inside the bound the record governs.
 *
 * Records at a materially different size are ignored outright: the house was
 * added onto, so it is not the same house and the counts are not in conflict.
 */

import type { CmaSubject } from '@/lib/cma/types'

/** Beyond this, a closed record describes a house that may since have changed. */
export const ROOM_HISTORY_MAX_AGE_YEARS = 10

/** Same house only. A bigger footprint is an addition, not a contradiction. */
export const ROOM_HISTORY_SIZE_BAND = 0.03

export type SubjectRoomConflict = {
  field: 'beds' | 'baths'
  /** What the current listing says. */
  listed: number
  /** What the house's own most recent closed sale says. */
  recorded: number
  /** Close date of that sale. */
  recordedOn: string
  recordAgeYears: number
  /** The count the document actually priced on. */
  priced: number
  /** True when the record governed; false when it was too old to. */
  usedHistory: boolean
  /** One sentence for the review page. */
  note: string
}

export type PropertyRoomRecord = {
  beds: number | null | undefined
  baths: number | null | undefined
  sqft: number | null | undefined
  closeDate: string | null | undefined
  status: string | null | undefined
}

function yearsBetween(asOf: string, then: string): number {
  const a = Date.parse(asOf)
  const b = Date.parse(then)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY
  return Math.abs(a - b) / (1000 * 60 * 60 * 24 * 365.25)
}

function whole(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
}

/**
 * The house's most recent CLOSED record at the same size, or null when it has
 * none. Cancellations and withdrawals are not evidence: nothing closed, so
 * nobody checked the sheet against the house.
 */
export function mostRecentClosedRecord(
  listedSqft: number | null | undefined,
  history: ReadonlyArray<PropertyRoomRecord>,
): PropertyRoomRecord | null {
  const sqft = listedSqft != null && Number.isFinite(listedSqft) && listedSqft > 0 ? listedSqft : null
  if (sqft == null) return null
  const closed = history
    .filter((r) => (r.status ?? '').toLowerCase().includes('closed'))
    .filter((r) => typeof r.closeDate === 'string' && r.closeDate.length >= 10)
    .filter((r) => {
      const s = r.sqft
      if (s == null || !Number.isFinite(s) || s <= 0) return false
      return Math.abs(s - sqft) / Math.max(s, sqft) <= ROOM_HISTORY_SIZE_BAND
    })
    .sort((a, b) => String(b.closeDate).localeCompare(String(a.closeDate)))
  return closed[0] ?? null
}

/**
 * Reconcile the listing's room counts against the house's own closed record.
 * Returns the counts to price on and every conflict found. An empty conflict
 * list means the listing and the record agree, or there is nothing to compare.
 */
export function reconcileSubjectRoomCounts(
  listed: { beds: number | null | undefined; baths: number | null | undefined; sqft: number | null | undefined },
  history: ReadonlyArray<PropertyRoomRecord>,
  opts: { asOf: string },
): { beds: number | null; baths: number | null; conflicts: SubjectRoomConflict[] } {
  const listedBeds = listed.beds ?? null
  const listedBaths = listed.baths ?? null
  const record = mostRecentClosedRecord(listed.sqft, history)
  if (!record) return { beds: listedBeds, baths: listedBaths, conflicts: [] }

  const age = yearsBetween(opts.asOf, String(record.closeDate))
  const fresh = age <= ROOM_HISTORY_MAX_AGE_YEARS
  const conflicts: SubjectRoomConflict[] = []
  let beds = listedBeds
  let baths = listedBaths

  const fields: Array<{ field: 'beds' | 'baths'; listedRaw: number | null; recordRaw: number | null | undefined }> = [
    { field: 'beds', listedRaw: listedBeds, recordRaw: record.beds },
    { field: 'baths', listedRaw: listedBaths, recordRaw: record.baths },
  ]
  for (const { field, listedRaw, recordRaw } of fields) {
    const l = whole(listedRaw)
    const r = whole(recordRaw)
    if (l == null || r == null || l === r) continue
    const rounded = Math.round(age * 10) / 10
    const priced = fresh ? (recordRaw as number) : (listedRaw as number)
    const word = field === 'beds' ? 'bedroom' : 'bathroom'
    conflicts.push({
      field,
      listed: listedRaw as number,
      recorded: recordRaw as number,
      recordedOn: String(record.closeDate).slice(0, 10),
      recordAgeYears: rounded,
      priced,
      usedHistory: fresh,
      note: fresh
        ? `The listing says ${listedRaw} ${word}s and this home's own sale on ${String(record.closeDate).slice(0, 10)} recorded ${recordRaw} at the same square footage. The sale record was used. Confirm the count before this goes out.`
        : `The listing says ${listedRaw} ${word}s and this home's own sale on ${String(record.closeDate).slice(0, 10)} recorded ${recordRaw} at the same square footage. That record is ${rounded} years old, old enough that the house could have been changed since, so the listing count was used. Confirm the count before this goes out.`,
    })
    if (!fresh) continue
    if (field === 'beds') beds = recordRaw as number
    else baths = recordRaw as number
  }
  return { beds, baths, conflicts }
}

/** Apply the reconciled counts to a subject, leaving everything else alone. */
export function applyReconciledRoomCounts(
  subject: CmaSubject,
  resolved: { beds: number | null; baths: number | null },
): CmaSubject {
  return { ...subject, beds: resolved.beds ?? subject.beds, baths: resolved.baths ?? subject.baths }
}
