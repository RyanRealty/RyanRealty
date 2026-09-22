/**
 * H8 active-inventory warehouse writer.
 *
 * The cron imports this module. Vercel does not ship `scripts/`, so spawning
 * the CLI left `analytics_inventory_snapshot` frozen while the route still
 * returned HTTP 200. The CLI is a thin caller of the same function.
 *
 * Not a public figure. Nothing on the site reads this table.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

/** Same proper names the August 2026 writer used. Do not derive a new list. */
export const ACTIVE_INVENTORY_CITIES = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'La Pine',
  'Terrebonne',
  'Tumalo',
  'Prineville',
  'Madras',
  'Culver',
  'Powell Butte',
  'Crooked River Ranch',
  'Black Butte Ranch',
  'Camp Sherman',
  'Brothers',
  'Alfalfa',
  'Metolius',
  'Warm Springs',
  'Gateway',
  'Ashwood',
  'Crooked River',
  'Paulina',
  'Post',
  'Mitchell',
] as const

export const ACTIVE_INVENTORY_METHODOLOGY = 'active_ilike+service_area_v1' as const
export const ACTIVE_INVENTORY_GEO = 'central-oregon-service-area' as const

export function activeInventoryCitySlug(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, '-')
}

export type InventorySnapshotCity = {
  city: string
  city_slug: string
  active: number | null
  error?: string
}

export type InventorySnapshotResult = {
  ok: boolean
  as_of: string
  computedAt: string
  written: number
  attempted: number
  totalActive: number
  error: string | null
  errors: { city: string; error: string }[]
  dryRun: boolean
  byCity: InventorySnapshotCity[]
  geo: typeof ACTIVE_INVENTORY_GEO
  methodology: typeof ACTIVE_INVENTORY_METHODOLOGY
}

type SnapshotRow = {
  as_of: string
  city: string
  city_slug: string
  active_count: number
  geo_scope: typeof ACTIVE_INVENTORY_GEO
  methodology: typeof ACTIVE_INVENTORY_METHODOLOGY
  computed_at: string
}

/**
 * HTTP 200 only when the upsert wrote every city we attempted.
 * A missing client, a failed write, or zero rows is 500. `ok: false` is not a 200.
 */
export function inventorySnapshotHttpStatus(result: {
  ok: boolean
  written: number
  attempted: number
}): 200 | 500 {
  if (result.ok === true && result.written > 0 && result.written === result.attempted) return 200
  return 500
}

async function countActive(
  client: SupabaseClient,
  city: string,
): Promise<{ active: number | null; error: string | null }> {
  const listed = client.from('listings')
  // stat-source-ok: operational warehouse count for analytics_inventory_snapshot. No public surface reads it.
  const { count, error } = await listed
    .select('*', { count: 'exact', head: true })
    .eq('City', city)
    .ilike('StandardStatus', 'Active%')
  if (error) return { active: null, error: error.message }
  return { active: count ?? 0, error: null }
}

export async function snapshotActiveInventory(opts: {
  client: SupabaseClient | null
  dryRun?: boolean
  now?: Date
}): Promise<InventorySnapshotResult> {
  const now = opts.now ?? new Date()
  const as_of = now.toISOString().slice(0, 10)
  const computedAt = now.toISOString()
  const dryRun = opts.dryRun === true
  const attempted = ACTIVE_INVENTORY_CITIES.length
  const base = {
    as_of,
    computedAt,
    attempted,
    dryRun,
    geo: ACTIVE_INVENTORY_GEO,
    methodology: ACTIVE_INVENTORY_METHODOLOGY,
  } as const

  if (!opts.client) {
    return {
      ...base,
      ok: false,
      written: 0,
      totalActive: 0,
      error: 'Supabase client is missing',
      errors: [],
      byCity: [],
    }
  }

  const client = opts.client
  try {
    const byCity: InventorySnapshotCity[] = await Promise.all(
      ACTIVE_INVENTORY_CITIES.map(async (city) => {
        const counted = await countActive(client, city)
        return {
          city,
          city_slug: activeInventoryCitySlug(city),
          active: counted.active,
          ...(counted.error ? { error: counted.error } : {}),
        }
      }),
    )

    const errors = byCity
      .filter((row): row is InventorySnapshotCity & { error: string } => typeof row.error === 'string')
      .map((row) => ({ city: row.city, error: row.error }))
    const totalActive = byCity.reduce((sum, row) => sum + (typeof row.active === 'number' ? row.active : 0), 0)

    if (errors.length > 0 || dryRun) {
      return {
        ...base,
        ok: false,
        written: 0,
        totalActive,
        error: errors.length > 0 ? errors.map((row) => `${row.city}: ${row.error}`).join('; ') : null,
        errors,
        byCity,
      }
    }

    const rows: SnapshotRow[] = byCity.map((row) => ({
      as_of,
      city: row.city,
      city_slug: row.city_slug,
      active_count: row.active ?? 0,
      geo_scope: ACTIVE_INVENTORY_GEO,
      methodology: ACTIVE_INVENTORY_METHODOLOGY,
      computed_at: computedAt,
    }))

    const { error: writeError } = await client.from('analytics_inventory_snapshot').upsert(rows, {
      onConflict: 'as_of,city_slug',
    })
    if (writeError) {
      return {
        ...base,
        ok: false,
        written: 0,
        totalActive,
        error: writeError.message,
        errors: [],
        byCity,
      }
    }

    const written = rows.length
    return {
      ...base,
      ok: written > 0 && written === attempted,
      written,
      totalActive,
      error: null,
      errors: [],
      byCity,
    }
  } catch (e) {
    return {
      ...base,
      ok: false,
      written: 0,
      totalActive: 0,
      error: e instanceof Error ? e.message : String(e),
      errors: [],
      byCity: [],
    }
  }
}
