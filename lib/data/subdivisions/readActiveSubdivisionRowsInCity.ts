/**
 * readActiveSubdivisionRowsInCity: every listing row of one city whose status
 * is active or not yet known, as (SubdivisionName, StandardStatus). The source
 * of getSubdivisionsInCity (app/actions/listings.ts), which counts them per
 * subdivision for the slug resolver, the content-refresh cron and the banners
 * page, and caches that for an hour.
 *
 * It THROWS when a page fails (SITE-212 review). The fetchAllRows read it
 * replaces turned a failed page into an empty one and stopped, so a timeout
 * came back as "no subdivisions" or as a partial list, and the hour-long cache
 * would have kept it. Pages are in ListingKey order, a total order (G48), so
 * no row is skipped or read twice between pages.
 */
import { supabaseAnon } from '@/lib/data/client'
import { PUBLIC_ACTIVE_OR_PREDICATE_EXACT } from '@/lib/listing-status-public'
import { fetchPagedRows } from '@/lib/supabase/paginate'

export type ActiveSubdivisionRow = {
  SubdivisionName: string | null
  StandardStatus: string | null
}

export async function readActiveSubdivisionRowsInCity(city: string): Promise<ActiveSubdivisionRow[]> {
  const sb = supabaseAnon()
  if (!sb) throw new Error('[readActiveSubdivisionRowsInCity] no Supabase client')
  const { rows, error } = await fetchPagedRows<ActiveSubdivisionRow>((from, to) =>
    sb
      .from('listings')
      .select('SubdivisionName, StandardStatus')
      .eq('City', city)
      .or(PUBLIC_ACTIVE_OR_PREDICATE_EXACT)
      .order('ListingKey', { ascending: true })
      .range(from, to),
  )
  if (error) throw new Error(`[readActiveSubdivisionRowsInCity] listings read failed for ${city}: ${error.message}`)
  return rows
}
