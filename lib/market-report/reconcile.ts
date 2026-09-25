/**
 * The Spark × Supabase reconciliation gate for a monthly edition (CLAUDE.md §0).
 *
 * For each monthly market, pull every closed single-family sale Spark holds for
 * the month and set it against ours by listing key. The gate fails when more
 * than 1% of Spark's closings are missing from Supabase (sync drift: the
 * edition would under-count the month), or when publishable closings we count
 * that Spark does not place in the city and month exceed 1% (it would
 * over-count). Closings we hold but exclude on purpose (duplicate parcel
 * entries, price typos) are reported, not failed: they are the method, not
 * drift.
 *
 * Supabase stays the source for historical closes (§0: reconciled history past
 * the Spark cutover); this gate runs on the edition being published.
 */
import { getOurDetachedClosings } from '@/lib/data/market-report/reconcile'
import { fetchSparkListingsPage } from '@/lib/spark'
import { lastDayOf } from './format'

export type CityReconciliation = {
  city: string
  month: string
  sparkClosings: number
  ourClosings: number
  missingFromUs: string[]
  /** Publishable closings we count that Spark does not place in this city and month. */
  extraInOurs: string[]
  excludedByMethod: number
  sparkUnderAcre: number
  ourPublishedUnderAcre: number
  missingShare: number
  extraShare: number
  ok: boolean
}

export const RECONCILE_TOLERANCE = 0.01

async function sparkClosings(city: string, monthStart: string, monthEnd: string) {
  const token = (process.env.SPARK_API_KEY ?? '').trim()
  if (!token) throw new Error('[reconcileMonth] SPARK_API_KEY is not set')
  // Spark REST filter syntax (the same the delta sync and the CMA comp pulls use).
  const filter = [
    `City Eq '${city.replace(/'/g, "\\'")}'`,
    "PropertyType Eq 'A'",
    "PropertySubType Eq 'Single Family Residence'",
    "StandardStatus Eq 'Closed'",
    `CloseDate Ge ${monthStart}`,
    `CloseDate Le ${monthEnd}`,
  ].join(' And ')
  const out: { key: string; lot: number | null }[] = []
  for (let page = 1; page <= 20; page++) {
    const res = await fetchSparkListingsPage(token, {
      page,
      limit: 500,
      filter,
      select: 'ListingKey,LotSizeAcres,ClosePrice,CloseDate,PropertySubType',
    })
    for (const r of res.D?.Results ?? []) {
      const f = r.StandardFields as unknown as { ListingKey?: string; LotSizeAcres?: number | string | null }
      const lot = f.LotSizeAcres == null || f.LotSizeAcres === '' ? null : Number(f.LotSizeAcres)
      if (f.ListingKey) out.push({ key: f.ListingKey, lot: Number.isFinite(lot as number) ? (lot as number) : null })
    }
    const pages = res.D?.Pagination?.TotalPages ?? 1
    if (page >= pages) break
  }
  return out
}

export async function reconcileMonth(
  month: string,
  cities: readonly { label: string; slug: string }[],
): Promise<CityReconciliation[]> {
  const monthStart = `${month}-01`
  const monthEnd = lastDayOf(month)
  const results: CityReconciliation[] = []
  for (const c of cities) {
    const [spark, ours] = await Promise.all([
      sparkClosings(c.label, monthStart, monthEnd),
      getOurDetachedClosings({ citySlug: c.slug, monthStart, monthEnd }),
    ])
    const ourKeys = new Set(ours.map((o) => o.listing_key))
    const sparkKeys = new Set(spark.map((s) => s.key))
    const missing = spark.filter((s) => !ourKeys.has(s.key)).map((s) => s.key)
    const extra = ours.filter((o) => o.is_publishable && !sparkKeys.has(o.listing_key)).map((o) => o.listing_key)
    const excluded = ours.filter((o) => !o.is_publishable).length
    const underAcre = (lot: number | null) => lot == null || lot < 1
    const missingShare = spark.length === 0 ? (ours.length === 0 ? 0 : 1) : missing.length / spark.length
    const extraShare = spark.length === 0 ? (extra.length === 0 ? 0 : 1) : extra.length / spark.length
    results.push({
      city: c.label,
      month,
      sparkClosings: spark.length,
      ourClosings: ours.length,
      missingFromUs: missing,
      extraInOurs: extra,
      excludedByMethod: excluded,
      sparkUnderAcre: spark.filter((s) => underAcre(s.lot)).length,
      ourPublishedUnderAcre: ours.filter((o) => o.is_publishable && underAcre(o.lot_acres)).length,
      missingShare,
      extraShare,
      ok: missingShare <= RECONCILE_TOLERANCE && extraShare <= RECONCILE_TOLERANCE,
    })
  }
  return results
}

export function reconciliationLine(r: CityReconciliation): string {
  return `${r.city} ${r.month}: Spark ${r.sparkClosings} closings, Supabase ${r.ourClosings} (${r.missingFromUs.length} missing, ${(r.missingShare * 100).toFixed(1)}%; ${r.extraInOurs.length} extra, ${(r.extraShare * 100).toFixed(1)}%; ${r.excludedByMethod} excluded by method). Under an acre: Spark ${r.sparkUnderAcre}, published ${r.ourPublishedUnderAcre}. ${r.ok ? 'PASS' : 'FAIL'}`
}
