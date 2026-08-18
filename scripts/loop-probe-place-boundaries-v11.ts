/**
 * Second-shape existence check for served subdivision slugs.
 *   npx tsx scripts/loop-probe-place-boundaries-v11.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const SLUGS = [
  'aubrey-heights',
  'chase-village',
  'chloe-estates',
  'brookswood-estates',
  'brentwood',
  'blue-chip-ranch',
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)

  const { data: rows, error } = await sb
    .from('boundaries')
    .select('geo_type,geo_slug,geo_label')
    .in('geo_slug', SLUGS)

  const { count: subdivisionCount, error: countErr } = await sb
    .from('boundaries')
    .select('geo_slug', { count: 'exact', head: true })
    .eq('geo_type', 'subdivision')

  const { data: likeChloe, error: likeErr } = await sb
    .from('boundaries')
    .select('geo_type,geo_slug,geo_label')
    .ilike('geo_slug', '%chloe%')
    .limit(20)

  const { data: likeBlue, error: likeBlueErr } = await sb
    .from('boundaries')
    .select('geo_type,geo_slug,geo_label')
    .ilike('geo_slug', '%blue-chip%')
    .limit(20)

  const { data: likeChip, error: likeChipErr } = await sb
    .from('boundaries')
    .select('geo_type,geo_slug,geo_label')
    .ilike('geo_label', '%Blue Chip%')
    .limit(20)

  console.log(
    JSON.stringify(
      {
        fetchedAt: new Date().toISOString(),
        exact: rows,
        exactError: error?.message ?? null,
        subdivisionCount,
        countError: countErr?.message ?? null,
        likeChloe,
        likeChloeError: likeErr?.message ?? null,
        likeBlue,
        likeBlueError: likeBlueErr?.message ?? null,
        likeChip,
        likeChipError: likeChipErr?.message ?? null,
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
