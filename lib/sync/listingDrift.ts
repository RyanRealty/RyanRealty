/**
 * Listing drift: does the MLS record disagree with our copy on a fact a market
 * statistic reads?
 *
 * Two callers share this one comparison so they can never disagree about what
 * "changed" means:
 *   - the delta sync, deciding whether a finalized (frozen) row must reopen
 *     because Spark reports a material change to it;
 *   - the closings reconciliation, deciding which rows to re-pull from Spark.
 *
 * The facts are the ones Market Truth reads from typed columns (status, close
 * date and price, list price, city, property sub-type, living area). A media or
 * remarks edit is not drift: a frozen closed listing stays frozen for those.
 *
 * Why it exists (2026-09-25): the delta sync skipped every finalized row
 * unconditionally, so a withdrawn listing that relisted and sold, or a close
 * date corrected after the fact, never reached us. Spark held 203 Bend and
 * Redmond closings from Feb-Aug 2026 that our copy lacked or mis-dated.
 */

export type DriftFacts = {
  status: string | null
  closeDate: string | null
  closePrice: number | null
  listPrice: number | null
  city: string | null
  subType: string | null
  sqft: number | null
}

export type DriftReason =
  | 'missing'
  | 'status'
  | 'close_date'
  | 'close_price'
  | 'list_price'
  | 'city'
  | 'sub_type'
  | 'sqft'

function text(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** The calendar date of a timestamp or date string, as YYYY-MM-DD. */
export function dateOnly(v: unknown): string | null {
  const t = text(v)
  if (!t) return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(t)
  return m ? m[1] : null
}

/** Facts from a mapped listings row (lib/listing-mapper sparkToListingRow output) or a DB row. */
export function factsFromListingRow(row: Record<string, unknown>): DriftFacts {
  return {
    status: text(row.StandardStatus),
    closeDate: dateOnly(row.CloseDate),
    closePrice: num(row.ClosePrice),
    listPrice: num(row.ListPrice),
    city: text(row.City),
    subType: text(row.property_sub_type),
    sqft: num(row.TotalLivingAreaSqFt),
  }
}

/**
 * Facts from raw Spark StandardFields. Living area follows the mapper's own
 * precedence (TotalLivingAreaSqFt, BuildingAreaTotal, LivingArea) so a lite
 * select and a full mapped row read the same number.
 */
export function factsFromSparkFields(fields: Record<string, unknown>): DriftFacts {
  // Spark masks an unlicensed field as a run of asterisks; the mapper strips any run.
  const masked = (v: unknown) => (typeof v === 'string' && /^\*+$/.test(v.trim()) ? null : v)
  return {
    status: text(masked(fields.StandardStatus)) ?? text(masked(fields.MlsStatus)),
    closeDate: dateOnly(masked(fields.CloseDate)),
    closePrice: num(masked(fields.ClosePrice)),
    listPrice: num(masked(fields.ListPrice)),
    city: text(masked(fields.City)),
    subType: text(masked(fields.PropertySubType)),
    sqft:
      num(masked(fields.TotalLivingAreaSqFt)) ??
      num(masked(fields.BuildingAreaTotal)) ??
      num(masked(fields.LivingArea)),
  }
}

/**
 * Every fact where the MLS says something our copy does not. A fact the MLS
 * leaves blank is never drift (we keep what we have); a fact we hold blank that
 * the MLS fills is. Prices compare to the dollar, cities without case.
 */
export function driftReasons(ours: DriftFacts | null | undefined, mls: DriftFacts): DriftReason[] {
  if (!ours) return ['missing']
  const out: DriftReason[] = []
  if (mls.status && mls.status !== ours.status) out.push('status')
  if (mls.closeDate && mls.closeDate !== ours.closeDate) out.push('close_date')
  if (mls.closePrice != null && mls.closePrice > 0 && (ours.closePrice == null || Math.abs(mls.closePrice - ours.closePrice) >= 1)) {
    out.push('close_price')
  }
  if (mls.listPrice != null && mls.listPrice > 0 && ours.listPrice != null && Math.abs(mls.listPrice - ours.listPrice) >= 1) {
    out.push('list_price')
  }
  if (mls.city && mls.city.toLowerCase() !== (ours.city ?? '').toLowerCase()) out.push('city')
  if (mls.subType && mls.subType !== ours.subType) out.push('sub_type')
  if (mls.sqft != null && mls.sqft > 0 && (ours.sqft == null || ours.sqft <= 0 || Math.abs(mls.sqft - ours.sqft) >= 1)) {
    out.push('sqft')
  }
  return out
}
