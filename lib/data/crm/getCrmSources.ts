import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * getCrmSources — every distinct crm_people.source string in the account,
 * rendered VERBATIM (no normalization, no dedup of near-duplicates) per the
 * §28 §3 mobile Source picker spec (mob-54: FUB lists the raw stored strings,
 * kebab-case cron sources included, `<unspecified>` pinned first by the
 * caller). Alphabetical, case-insensitive.
 *
 * DAL boundary (G1): the raw .from('crm_people') read lives here. Paged scan
 * of the source column only (the 1000-row cap means NEVER rows.length — page
 * until short read). Cached 10 min — the source vocabulary changes rarely
 * (new values arrive from lead-capture pipelines, not per-request).
 *
 * Fails SOFT (empty array) so the picker degrades to `<unspecified>` only.
 */
export const getCrmSources = unstable_cache(
  async (): Promise<string[]> => {
    const sb = createServiceClient()
    const seen = new Set<string>()
    const PAGE = 1000
    for (let fromRow = 0; fromRow < 100_000; fromRow += PAGE) {
      const { data, error } = await sb
        .from('crm_people')
        .select('source')
        .not('source', 'is', null)
        .range(fromRow, fromRow + PAGE - 1)
      if (error) {
        console.error('[getCrmSources]', error.message)
        break
      }
      for (const r of (data ?? []) as Array<{ source: string | null }>) {
        const s = (r.source ?? '').trim()
        if (s) seen.add(s)
      }
      if (!data || data.length < PAGE) break
    }
    return [...seen].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  },
  ['crm-sources-v1'],
  { revalidate: 600, tags: ['crm-people-sources'] },
)
