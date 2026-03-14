#!/usr/bin/env tsx
/**
 * map-neighborhoods.ts
 *
 * Loads a GeoJSON FeatureCollection of neighborhood boundary polygons,
 * upserts them into the `neighborhoods` table with their boundary_geojson,
 * then uses PostGIS spatial queries to:
 *   1. Set properties.neighborhood_id for every property whose lat/lng falls inside a neighborhood polygon
 *   2. Set communities.neighborhood_id / city_id based on which neighborhood contains the most listings for that subdivision
 *
 * Usage:
 *   npx tsx scripts/map-neighborhoods.ts <path-to-geojson> [--dry-run]
 *
 * The GeoJSON file must be a FeatureCollection with features that have:
 *   - properties.NAME  (neighborhood name)
 *   - geometry         (Polygon or MultiPolygon in EPSG:4326)
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ─── Inline .env.local parser (avoids dotenv dependency) ──────────────────────
function loadEnvLocal(): void {
  const envPath = join(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eqIdx = line.indexOf('=')
    if (eqIdx < 1) continue
    const key = line.slice(0, eqIdx).trim()
    let val = line.slice(eqIdx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnvLocal()

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry-run')
const geojsonPath = process.argv.find((a) => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1])

if (!geojsonPath) {
  console.error('Usage: npx tsx scripts/map-neighborhoods.ts <path-to-geojson> [--dry-run]')
  process.exit(1)
}

// ─── Slug helper (mirrors lib/slug.ts) ────────────────────────────────────────
function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown'
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface GeoJSONFeature {
  type: 'Feature'
  geometry: { type: string; coordinates: number[][][] | number[][][][] }
  properties: Record<string, unknown>
}

interface GeoJSONCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const fullPath = resolve(geojsonPath!)
  if (!existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`)
    process.exit(1)
  }

  console.log(`\n📍 Neighborhood Boundary Mapper`)
  console.log(`   GeoJSON: ${fullPath}`)
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`)
  console.log()

  const raw = readFileSync(fullPath, 'utf-8')
  const geojson: GeoJSONCollection = JSON.parse(raw)

  if (geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    console.error('Invalid GeoJSON: expected a FeatureCollection')
    process.exit(1)
  }

  // Filter out "Undesignated" polygons
  const neighborhoods = geojson.features.filter((f) => {
    const name = (f.properties?.NAME as string) ?? ''
    return name.trim() !== '' && name.trim().toLowerCase() !== 'undesignated'
  })

  console.log(`Found ${neighborhoods.length} named neighborhood polygons (skipped ${geojson.features.length - neighborhoods.length} undesignated)\n`)

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // ── Step 1: Resolve city ──────────────────────────────────────────────────
  // Determine the city from the GeoJSON filename or default to "Bend"
  // Future: accept --city flag
  const cityName = 'Bend'
  const citySlug = slugify(cityName)

  let cityId: string

  const { data: existingCity } = await supabase
    .from('cities')
    .select('id')
    .eq('slug', citySlug)
    .maybeSingle()

  if (existingCity) {
    cityId = existingCity.id
    console.log(`✅ City "${cityName}" found (${cityId})`)
  } else if (!DRY_RUN) {
    const { data: newCity, error } = await supabase
      .from('cities')
      .insert({ name: cityName, slug: citySlug, state: 'Oregon' })
      .select('id')
      .single()
    if (error || !newCity) {
      console.error(`Failed to create city "${cityName}":`, error)
      process.exit(1)
    }
    cityId = newCity.id
    console.log(`🆕 Created city "${cityName}" (${cityId})`)
  } else {
    cityId = 'dry-run-city-id'
    console.log(`🔍 [DRY RUN] Would create city "${cityName}"`)
  }

  // ── Step 2: Upsert neighborhoods with boundaries ─────────────────────────
  console.log(`\n── Upserting ${neighborhoods.length} neighborhoods ──`)

  const neighborhoodMap = new Map<string, string>() // name → id

  for (const feature of neighborhoods) {
    const name = (feature.properties.NAME as string).trim()
    const slug = slugify(name)
    const boundaryGeojson = feature.geometry

    const { data: existing } = await supabase
      .from('neighborhoods')
      .select('id')
      .eq('slug', slug)
      .eq('city_id', cityId)
      .maybeSingle()

    if (existing) {
      // Update boundary
      if (!DRY_RUN) {
        await supabase
          .from('neighborhoods')
          .update({ boundary_geojson: boundaryGeojson })
          .eq('id', existing.id)
      }
      neighborhoodMap.set(name, existing.id)
      console.log(`  ✏️  Updated boundary for "${name}" (${existing.id})`)
    } else if (!DRY_RUN) {
      const { data: created, error } = await supabase
        .from('neighborhoods')
        .insert({
          name,
          slug,
          city_id: cityId,
          boundary_geojson: boundaryGeojson,
        })
        .select('id')
        .single()
      if (error || !created) {
        console.error(`  ❌ Failed to create "${name}":`, error)
        continue
      }
      neighborhoodMap.set(name, created.id)
      console.log(`  🆕 Created "${name}" (${created.id})`)
    } else {
      neighborhoodMap.set(name, `dry-run-${slug}`)
      console.log(`  🔍 [DRY RUN] Would create "${name}"`)
    }
  }

  // ── Step 3: Spatial mapping — properties → neighborhoods ──────────────────
  console.log(`\n── Spatial mapping: properties → neighborhoods ──`)
  console.log(`   Using PostGIS ST_Within to match property points to neighborhood polygons\n`)

  // We'll use a Supabase RPC call that runs PostGIS SQL
  // First, let's create the mapping via raw SQL using supabase.rpc
  // Since we can't run arbitrary SQL via the JS client, we'll do it neighborhood by neighborhood
  // by calling a stored function. But since we may not have one yet, let's create it inline.

  // Alternative approach: for each neighborhood, query properties whose point falls within the polygon
  // using the Supabase PostgREST geo filters... but those are limited.
  // Best approach: create a temporary RPC function, or use the SQL approach.

  // We'll batch this with a single SQL statement via supabase.rpc.
  // Let's create a migration for the RPC function first, then call it.

  // Actually, simplest approach: for each neighborhood polygon, use raw SQL via supabase's
  // built-in `rpc` with a helper function we create as part of the migration.

  // For now, let's build the SQL and output it for manual execution if in dry-run,
  // or attempt to use a lighter approach: query all properties with geography, check containment in JS.

  // Most robust approach for production: create an RPC function.
  // Let me do it the JS way for now — pull all Bend properties with lat/lng, check containment in PostGIS via RPC.

  // We'll create the RPC function inline if it doesn't exist
  const rpcSQL = `
CREATE OR REPLACE FUNCTION map_properties_to_neighborhood(
  p_neighborhood_id uuid,
  p_boundary_geojson jsonb,
  p_dry_run boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_boundary geometry;
  v_count integer;
BEGIN
  -- Convert GeoJSON to PostGIS geometry
  v_boundary := ST_SetSRID(ST_GeomFromGeoJSON(p_boundary_geojson::text), 4326);

  IF p_dry_run THEN
    SELECT count(*) INTO v_count
    FROM properties
    WHERE geography IS NOT NULL
      AND ST_Within(geography::geometry, v_boundary);
    RETURN v_count;
  END IF;

  UPDATE properties
  SET neighborhood_id = p_neighborhood_id,
      updated_at = now()
  WHERE geography IS NOT NULL
    AND ST_Within(geography::geometry, v_boundary);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
  `.trim()

  // Also create a function to map communities based on which neighborhood has the most listings
  const communityRpcSQL = `
CREATE OR REPLACE FUNCTION map_communities_to_neighborhoods(
  p_city_id uuid,
  p_dry_run boolean DEFAULT false
)
RETURNS TABLE(community_name text, neighborhood_name text, listing_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- For each community (SubdivisionName), find which neighborhood contains the most of its listings
  RETURN QUERY
  WITH ranked AS (
    SELECT
      l."SubdivisionName" AS community_name,
      n.name AS neighborhood_name,
      n.id AS neighborhood_id,
      count(*) AS listing_count,
      ROW_NUMBER() OVER (PARTITION BY l."SubdivisionName" ORDER BY count(*) DESC) AS rn
    FROM listings l
    JOIN properties p ON l.property_id = p.id
    JOIN neighborhoods n ON p.neighborhood_id = n.id
    WHERE p.neighborhood_id IS NOT NULL
      AND l."SubdivisionName" IS NOT NULL
      AND l."SubdivisionName" != ''
    GROUP BY l."SubdivisionName", n.name, n.id
  )
  SELECT r.community_name, r.neighborhood_name, r.listing_count
  FROM ranked r
  WHERE r.rn = 1;

  -- If not dry run, update communities table
  IF NOT p_dry_run THEN
    UPDATE communities c
    SET neighborhood_id = sub.neighborhood_id,
        city_id = p_city_id,
        updated_at = now()
    FROM (
      SELECT
        r.community_name,
        r.neighborhood_id
      FROM (
        SELECT
          l."SubdivisionName" AS community_name,
          n.id AS neighborhood_id,
          count(*) AS cnt,
          ROW_NUMBER() OVER (PARTITION BY l."SubdivisionName" ORDER BY count(*) DESC) AS rn
        FROM listings l
        JOIN properties p ON l.property_id = p.id
        JOIN neighborhoods n ON p.neighborhood_id = n.id
        WHERE p.neighborhood_id IS NOT NULL
          AND l."SubdivisionName" IS NOT NULL
        GROUP BY l."SubdivisionName", n.id
      ) r
      WHERE r.rn = 1
    ) sub
    WHERE lower(c.name) = lower(sub.community_name)
       OR lower(c.slug) = lower(replace(sub.community_name, ' ', '-'));
  END IF;
END;
$$;
  `.trim()

  // Create the RPC functions via a migration-style approach
  // We'll write them as a migration file
  console.log(`Creating PostGIS helper functions...`)

  // Write the migration
  const migrationPath = join(
    process.cwd(),
    'supabase/migrations/20260312100001_neighborhood_mapping_rpcs.sql'
  )

  if (!DRY_RUN) {
    const { writeFileSync } = await import('fs')
    writeFileSync(
      migrationPath,
      `-- PostGIS RPC functions for neighborhood spatial mapping
-- Created by scripts/map-neighborhoods.ts

${rpcSQL}

${communityRpcSQL}
`,
      'utf-8'
    )
    console.log(`  📄 Wrote migration: supabase/migrations/20260312100001_neighborhood_mapping_rpcs.sql`)
    console.log(`\n⚠️  You need to apply these migrations before the spatial queries will work:`)
    console.log(`     npx supabase db push`)
    console.log(`     -- or --`)
    console.log(`     npx supabase migration up`)
    console.log(`\n   Then re-run this script to perform the spatial mapping.\n`)

    // Try to call the function anyway (it may already exist if re-running)
    let rpcsReady = false
    try {
      const { error } = await supabase.rpc('map_properties_to_neighborhood', {
        p_neighborhood_id: '00000000-0000-0000-0000-000000000000',
        p_boundary_geojson: '{"type":"Point","coordinates":[0,0]}',
        p_dry_run: true,
      })
      // If function exists (even if it errors on bad input), we're good
      rpcsReady = !error || !error.message.includes('function')
    } catch {
      rpcsReady = false
    }

    if (rpcsReady) {
      console.log(`✅ RPC functions already available — running spatial mapping now\n`)
      await runSpatialMapping(supabase, neighborhoodMap, cityId)
    } else {
      console.log(`ℹ️  RPC functions not yet deployed. Apply the migration and re-run.\n`)
      outputManualSQL(neighborhoodMap)
    }
  } else {
    console.log(`  🔍 [DRY RUN] Would create migration with PostGIS RPC functions`)
    console.log()
    outputManualSQL(neighborhoodMap)
  }

  console.log(`\n✅ Done!\n`)
}

// ─── Run spatial mapping via RPC ──────────────────────────────────────────────
async function runSpatialMapping(
  supabase: SupabaseClient,
  neighborhoodMap: Map<string, string>,
  cityId: string
) {
  let totalMapped = 0

  for (const [name, neighborhoodId] of Array.from(neighborhoodMap.entries())) {
    // Get the boundary we just stored
    const { data: nbr } = await supabase
      .from('neighborhoods')
      .select('boundary_geojson')
      .eq('id', neighborhoodId)
      .single()

    if (!nbr?.boundary_geojson) {
      console.log(`  ⏭️  "${name}" — no boundary stored, skipping`)
      continue
    }

    const { data: count, error } = await supabase.rpc('map_properties_to_neighborhood', {
      p_neighborhood_id: neighborhoodId,
      p_boundary_geojson: nbr.boundary_geojson,
      p_dry_run: DRY_RUN,
    })

    if (error) {
      console.error(`  ❌ "${name}": ${error.message}`)
      continue
    }

    const n = typeof count === 'number' ? count : 0
    totalMapped += n
    console.log(`  📍 "${name}" — ${n} properties ${DRY_RUN ? 'would be' : ''} mapped`)
  }

  console.log(`\n  Total: ${totalMapped} properties ${DRY_RUN ? 'would be' : ''} mapped to neighborhoods`)

  // Now map communities
  console.log(`\n── Mapping communities to neighborhoods (by listing concentration) ──\n`)

  const { data: mappings, error: mapErr } = await supabase.rpc('map_communities_to_neighborhoods', {
    p_city_id: cityId,
    p_dry_run: DRY_RUN,
  })

  if (mapErr) {
    console.error(`  ❌ Community mapping failed: ${mapErr.message}`)
    return
  }

  if (Array.isArray(mappings) && mappings.length > 0) {
    console.log(`  Community → Neighborhood (by most listings):`)
    for (const row of mappings) {
      console.log(`    ${row.community_name} → ${row.neighborhood_name} (${row.listing_count} listings)`)
    }
  } else {
    console.log(`  No community-to-neighborhood mappings found (no listings with neighborhood_id set yet)`)
  }
}

// ─── Output manual SQL for when RPCs aren't deployed yet ──────────────────────
function outputManualSQL(neighborhoodMap: Map<string, string>) {
  console.log(`── Manual SQL (run in Supabase SQL Editor if RPCs aren't deployed) ──\n`)
  console.log(`-- After applying the migration, run this to map all properties:`)
  console.log(`
-- Map properties to neighborhoods using PostGIS
UPDATE properties p
SET neighborhood_id = n.id,
    updated_at = now()
FROM neighborhoods n
WHERE n.boundary_geojson IS NOT NULL
  AND p.geography IS NOT NULL
  AND ST_Within(
    p.geography::geometry,
    ST_SetSRID(ST_GeomFromGeoJSON(n.boundary_geojson::text), 4326)
  );

-- Check results
SELECT n.name AS neighborhood, count(*) AS properties
FROM properties p
JOIN neighborhoods n ON p.neighborhood_id = n.id
GROUP BY n.name
ORDER BY count(*) DESC;

-- Map communities to neighborhoods (by listing concentration)
WITH ranked AS (
  SELECT
    l."SubdivisionName",
    n.name AS neighborhood,
    n.id AS neighborhood_id,
    count(*) AS cnt,
    ROW_NUMBER() OVER (PARTITION BY l."SubdivisionName" ORDER BY count(*) DESC) AS rn
  FROM listings l
  JOIN properties p ON l.property_id = p.id
  JOIN neighborhoods n ON p.neighborhood_id = n.id
  WHERE p.neighborhood_id IS NOT NULL
    AND l."SubdivisionName" IS NOT NULL
  GROUP BY l."SubdivisionName", n.name, n.id
)
SELECT "SubdivisionName", neighborhood, cnt
FROM ranked WHERE rn = 1
ORDER BY cnt DESC;
`)
}

// ─── Run ──────────────────────────────────────────────────────────────────────
main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
