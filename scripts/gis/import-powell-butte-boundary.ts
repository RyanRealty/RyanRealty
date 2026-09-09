/**
 * SITE-23 part 1 — insert the Powell Butte CCD polygon into public.boundaries.
 * Same statement the migration file carries; applied through PostgREST so the
 * 30KB of TIGER geometry does not have to travel through the agent transcript.
 *   npx tsx scratchpad/insert-powell-butte.ts
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const gj = JSON.parse(readFileSync('scratchpad/powell-butte-ccd.geojson', 'utf8'))
const f = gj.features[0]
if (f.properties.GEOID !== '4101392550' || f.properties.BASENAME !== 'Powell Butte') {
  throw new Error('unexpected TIGER feature: ' + JSON.stringify(f.properties))
}
if (f.geometry.type !== 'Polygon') throw new Error('expected Polygon, got ' + f.geometry.type)

const rings = (f.geometry.coordinates as number[][][])
  .map((ring) => '(' + ring.map(([x, y]) => `${x} ${y}`).join(',') + ')')
  .join(',')
const ewkt = `SRID=4326;MULTIPOLYGON((${rings}))`

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const existing = await sb
    .from('boundaries')
    .select('id, geo_slug, source')
    .eq('geo_type', 'city')
    .eq('geo_slug', 'powell-butte')
  if (existing.error) throw existing.error
  if ((existing.data ?? []).length > 0) {
    console.log('already present, nothing to do:', existing.data)
    return
  }

  const ins = await sb
    .from('boundaries')
    .insert({
      geo_type: 'city',
      geo_slug: 'powell-butte',
      geo_label: 'Powell Butte',
      polygon: ewkt,
      source:
        'TIGER/Line 2024 County Subdivisions (Oregon) (GEOID=4101392550, Powell Butte CCD, MTFCC G4040, Crook County)',
      source_url:
        'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/1',
    })
    .select('id, geo_type, geo_slug, geo_label, source, imported_at')
  if (ins.error) throw ins.error
  console.log('inserted:', JSON.stringify(ins.data, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
