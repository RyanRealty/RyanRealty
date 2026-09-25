/**
 * Monthly market report: the Supabase side of the Spark reconciliation gate.
 *
 * CLAUDE.md §0 makes a Spark × Supabase cross-check a hard pre-render gate for
 * market reports. For a month's closed sales the question the gate answers is
 * "did any closing Spark knows about fail to reach us": this returns every
 * detached closing we hold for a city and month (publishable or not), so the
 * caller can set it against Spark's list by listing key.
 */
import { createServiceClient } from '@/lib/data/client'

export type OurClosing = {
  listing_key: string
  close_price: number | null
  lot_acres: number | null
  is_publishable: boolean
  exclusion_reasons: string[]
}

export async function getOurDetachedClosings(opts: {
  citySlug: string
  monthStart: string
  monthEnd: string
}): Promise<OurClosing[]> {
  const sb = createServiceClient()
  const out: OurClosing[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('market_fact_sale')
      .select('listing_key, close_price, lot_acres, is_publishable, exclusion_reasons')
      .eq('city_slug', opts.citySlug)
      .eq('segment', 'detached')
      .gte('close_date', opts.monthStart)
      .lte('close_date', opts.monthEnd)
      .order('listing_key')
      .range(from, from + 999)
    if (error) throw new Error(`[getOurDetachedClosings] ${error.message}`)
    const rows = (data ?? []) as Record<string, unknown>[]
    for (const r of rows) {
      out.push({
        listing_key: String(r.listing_key),
        close_price: r.close_price == null ? null : Number(r.close_price),
        lot_acres: r.lot_acres == null ? null : Number(r.lot_acres),
        is_publishable: r.is_publishable === true,
        exclusion_reasons: Array.isArray(r.exclusion_reasons) ? (r.exclusion_reasons as string[]) : [],
      })
    }
    if (rows.length < 1000) break
  }
  return out
}
