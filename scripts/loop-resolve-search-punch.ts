/**
 * Append punch dispositions for the served fleet:public-ux:search slice.
 *
 *   npx tsx scripts/loop-resolve-search-punch.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { appendPunchDispositions, openPunchLines } from '../lib/data/loop/fleet-intake-core'

config({ path: '.env.local' })

const ID = '3a6198cd-fcd5-4aa2-b51a-3b62c2c0e437'
const OWNER = 'cursor-loop-chain-2026-08-17t03-23-70dd'

const RESOLUTIONS = [
  {
    fingerprint: 'fleet:c5507dfbad0fa07a59ff32ed332c9f36',
    status: 'rejected' as const,
    note: 'Does not reproduce at 390+1280. /homes-for-sale?beds=4 paints 372 homes / 244 in this map view. 0 of Search took too long.',
  },
  {
    fingerprint: 'fleet:8dbca1d99a7c4b2ad2273fb5cde0b4aa',
    status: 'rejected' as const,
    note: 'Does not reproduce. Unfiltered 1,294 homes; beds=3 is 875 (decreases). Headline vs map is labeled filter-match vs in this map view (publishSearchCountPair).',
  },
  {
    fingerprint: 'fleet:bd08fd51f91314013e636d4218550db4',
    status: 'rejected' as const,
    note: 'Does not reproduce. Beds click stays on /homes-for-sale and opens Min bedrooms. URL unchanged.',
  },
  {
    fingerprint: 'fleet:705f2898188f7c5f6d15eb0b6e263009',
    status: 'rejected' as const,
    note: 'Does not reproduce as a defect. After beds=3: 875 homes + 594+ homes in this map view. Different populations, labeled (publishSearchCountPair).',
  },
  {
    fingerprint: 'fleet:7d08fc7ab78acdf3e0525baf36ce52fb',
    status: 'rejected' as const,
    note: 'Does not reproduce as a defect. Save this search is visible at 390+1280. Get listing alerts is visible at 1280. Footer Listing alerts is the closed V3 chrome panel (visibility:hidden by design).',
  },
  {
    fingerprint: 'fleet:23a9ac8b87a2f093ef9bf05c550ac1e2',
    status: 'fixed' as const,
    note: 'Reproduced at 390: Owner financing clipped because default Sheet is w-3/4. Class: AllFiltersSheet is data-[side=right]:w-full + overflow-x-hidden; boolean labels stack (grid-cols-1 sm:grid-cols-2). Find-a-filter does not close the sheet (rejected that clause).',
  },
  {
    fingerprint: 'fleet:e438ef63159977d30cf83cf4cdff71bc',
    status: 'rejected' as const,
    note: 'Does not reproduce on the search surface. 654 Providence Drive is not in the /homes-for-sale result set. Listing-detail price history is a leftover listing family line.',
  },
  {
    fingerprint: 'fleet:7644f0913c59ebe272f880261f804547',
    status: 'rejected' as const,
    note: 'Does not reproduce. Price/Beds/Baths/Home type chips are in the 390 layout (44px tall). All filters is not the only control. hidden sm:contents already gone.',
  },
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const { data: row, error: readErr } = await sb
    .from('loop_work_nodes')
    .select('id,objective,owner_session,state')
    .eq('id', ID)
    .single()
  if (readErr || !row) {
    console.error('read failed', readErr?.message ?? 'missing')
    process.exit(1)
  }
  if (row.owner_session !== OWNER) {
    console.error(`owner mismatch: ${row.owner_session}`)
    process.exit(1)
  }
  const objective = appendPunchDispositions(String(row.objective ?? ''), RESOLUTIONS)
  const { data, error } = await sb
    .from('loop_work_nodes')
    .update({ objective, updated_at: new Date().toISOString() })
    .eq('id', ID)
    .select('id,objective')
    .single()
  if (error || !data?.id) {
    console.error(error?.message ?? 'update failed')
    process.exit(1)
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        id: data.id,
        openRemaining: openPunchLines(String(data.objective ?? '')).length,
        resolved: RESOLUTIONS.length,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
