import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
import {
  ACTIVE_INVENTORY_CITIES,
  ACTIVE_INVENTORY_GEO,
  ACTIVE_INVENTORY_METHODOLOGY,
  activeInventoryCitySlug,
  inventorySnapshotHttpStatus,
  snapshotActiveInventory,
} from './snapshotActiveInventory'

const NOW = new Date('2026-09-21T23:30:00.000Z')

function fakeClient(opts: {
  countFor?: (city: string) => { count: number | null; error: { message: string } | null }
  upsertError?: string | null
  onUpsert?: (rows: unknown, conflict: { onConflict?: string } | undefined) => void
}): SupabaseClient {
  const countFor = opts.countFor ?? (() => ({ count: 2, error: null }))
  return {
    from(table: string) {
      if (table === 'listings') {
        return {
          select(columns: string, options: { count?: string; head?: boolean }) {
            if (columns !== '*' || options?.count !== 'exact' || options?.head !== true) {
              throw new Error(`unexpected select ${columns} ${JSON.stringify(options)}`)
            }
            return {
              eq(column: string, city: string) {
                if (column !== 'City') throw new Error(`unexpected eq ${column}`)
                return {
                  ilike(col: string, pattern: string) {
                    if (col !== 'StandardStatus' || pattern !== 'Active%') {
                      throw new Error(`unexpected ilike ${col} ${pattern}`)
                    }
                    return Promise.resolve(countFor(city))
                  },
                }
              },
            }
          },
        }
      }
      if (table === 'analytics_inventory_snapshot') {
        return {
          upsert(rows: unknown, conflict?: { onConflict?: string }) {
            opts.onUpsert?.(rows, conflict)
            return Promise.resolve({ error: opts.upsertError ? { message: opts.upsertError } : null })
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as unknown as SupabaseClient
}

describe('snapshotActiveInventory', () => {
  it('keeps the service-area city list and the Active% count definition', () => {
    expect(ACTIVE_INVENTORY_CITIES).toEqual([
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
    ])
    expect(new Set(ACTIVE_INVENTORY_CITIES.map(activeInventoryCitySlug))).toEqual(CENTRAL_OREGON_CITY_SLUGS)
    expect(activeInventoryCitySlug('La Pine')).toBe('la-pine')
    expect(activeInventoryCitySlug('Crooked River Ranch')).toBe('crooked-river-ranch')
    expect(ACTIVE_INVENTORY_METHODOLOGY).toBe('active_ilike+service_area_v1')
  })

  it('reports failure and writes nothing when the upsert fails', async () => {
    let upserts = 0
    const result = await snapshotActiveInventory({
      client: fakeClient({
        upsertError: 'permission denied for table analytics_inventory_snapshot',
        onUpsert: () => {
          upserts += 1
        },
      }),
      now: NOW,
    })
    expect(upserts).toBe(1)
    expect(result.ok).toBe(false)
    expect(result.written).toBe(0)
    expect(result.attempted).toBe(ACTIVE_INVENTORY_CITIES.length)
    expect(result.error).toBe('permission denied for table analytics_inventory_snapshot')
    expect(result.as_of).toBe('2026-09-21')
    expect(inventorySnapshotHttpStatus(result)).toBe(500)
  })

  it('reports the written count when every city row upserts', async () => {
    let rows: Array<{
      city: string
      city_slug: string
      active_count: number
      methodology: string
      as_of: string
      computed_at: string
      geo_scope: string
    }> = []
    const result = await snapshotActiveInventory({
      client: fakeClient({
        countFor: (city) => ({ count: city === 'Bend' ? 10 : 1, error: null }),
        onUpsert: (payload) => {
          rows = payload as typeof rows
        },
      }),
      now: NOW,
    })
    expect(result.ok).toBe(true)
    expect(result.written).toBe(ACTIVE_INVENTORY_CITIES.length)
    expect(result.written).toBe(result.attempted)
    expect(result.totalActive).toBe(10 + (ACTIVE_INVENTORY_CITIES.length - 1))
    expect(result.error).toBeNull()
    expect(result.errors).toEqual([])
    expect(rows).toHaveLength(ACTIVE_INVENTORY_CITIES.length)
    expect(rows.map((row) => row.city)).toEqual([...ACTIVE_INVENTORY_CITIES])
    expect(rows[0]).toMatchObject({
      city: 'Bend',
      city_slug: 'bend',
      active_count: 10,
      as_of: '2026-09-21',
      computed_at: '2026-09-21T23:30:00.000Z',
      methodology: ACTIVE_INVENTORY_METHODOLOGY,
      geo_scope: ACTIVE_INVENTORY_GEO,
    })
    expect(new Set(rows.map((row) => row.computed_at))).toEqual(new Set(['2026-09-21T23:30:00.000Z']))
    expect(inventorySnapshotHttpStatus(result)).toBe(200)
  })

  it('does not upsert a partial day when a city count fails', async () => {
    let upserts = 0
    const result = await snapshotActiveInventory({
      client: fakeClient({
        countFor: (city) =>
          city === 'Madras' ? { count: null, error: { message: 'statement timeout' } } : { count: 4, error: null },
        onUpsert: () => {
          upserts += 1
        },
      }),
      now: NOW,
    })
    expect(upserts).toBe(0)
    expect(result.ok).toBe(false)
    expect(result.written).toBe(0)
    expect(result.errors).toEqual([{ city: 'Madras', error: 'statement timeout' }])
    expect(inventorySnapshotHttpStatus(result)).toBe(500)
  })

  it('reports failure when the client is missing and does not query', async () => {
    const result = await snapshotActiveInventory({ client: null, now: NOW })
    expect(result.ok).toBe(false)
    expect(result.written).toBe(0)
    expect(result.error).toBe('Supabase client is missing')
    expect(result.byCity).toEqual([])
    expect(inventorySnapshotHttpStatus(result)).toBe(500)
  })

  it('treats a dry run as not written', async () => {
    let upserts = 0
    const result = await snapshotActiveInventory({
      client: fakeClient({
        onUpsert: () => {
          upserts += 1
        },
      }),
      dryRun: true,
      now: NOW,
    })
    expect(upserts).toBe(0)
    expect(result.ok).toBe(false)
    expect(result.written).toBe(0)
    expect(result.dryRun).toBe(true)
    expect(result.error).toBeNull()
    expect(result.totalActive).toBe(ACTIVE_INVENTORY_CITIES.length * 2)
  })

  it('uses the UTC date, including just before midnight UTC', async () => {
    const late = await snapshotActiveInventory({
      client: fakeClient({}),
      now: new Date('2026-09-22T00:30:00.000Z'),
    })
    expect(late.as_of).toBe('2026-09-22')
  })
})

describe('inventorySnapshotHttpStatus', () => {
  it('maps a full successful write to 200 and every other outcome to 500', () => {
    const attempted = ACTIVE_INVENTORY_CITIES.length
    expect(inventorySnapshotHttpStatus({ ok: true, written: attempted, attempted })).toBe(200)
    expect(inventorySnapshotHttpStatus({ ok: false, written: 0, attempted })).toBe(500)
    expect(inventorySnapshotHttpStatus({ ok: true, written: 0, attempted })).toBe(500)
    expect(inventorySnapshotHttpStatus({ ok: true, written: attempted - 1, attempted })).toBe(500)
    expect(inventorySnapshotHttpStatus({ ok: false, written: attempted, attempted })).toBe(500)
    expect(inventorySnapshotHttpStatus({ ok: true, written: 0, attempted: 0 })).toBe(500)
  })
})

describe('callers', () => {
  it('the cron imports the writer and does not spawn the script', () => {
    const src = readFileSync('app/api/cron/snapshot-active-inventory/route.ts', 'utf8')
    expect(src).toContain('snapshotActiveInventory')
    expect(src).toContain('inventorySnapshotHttpStatus')
    expect(src).not.toMatch(/\bspawn\b/)
  })

  it('the CLI is a thin caller and does not count listings itself', () => {
    const src = readFileSync('scripts/analytics/snapshot-active-inventory.mjs', 'utf8')
    expect(src).toContain('snapshotActiveInventory.ts')
    const fromListings = `.from(${"'listings'"})`
    const fromListingsDq = `.from(${'"listings"'})`
    expect(src).not.toContain(fromListings)
    expect(src).not.toContain(fromListingsDq)
  })
})
