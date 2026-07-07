import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildMarketReportAreas } from '@/lib/data/crm/getContactReportSubscriptions'

/**
 * Seed parity for crm_report_areas.
 *
 * The config-table seed MUST exactly mirror buildMarketReportAreas() (the source
 * the DB-backed catalog replaces: Central Oregon cities + resort communities from
 * data/resort-communities.json + the Bend neighborhood districts, de-duped by
 * slug). The seed now spans TWO migrations: the original 20260625171000 catalog
 * (25 areas) and the 20260707101000 Bend-district extension (13 areas). This
 * test runs the live builder and asserts the union of seeded (key, label) pairs
 * equals its output, so a future edit to the builder or the registry without a
 * matching migration fails CI rather than silently drifting.
 */

const ROOT = join(__dirname, '..', '..')

const SEED_MIGRATIONS = [
  '20260625171000_crm_report_areas.sql',
  '20260707101000_crm_report_areas_bend_districts.sql',
] as const

/** Parse the seeded (key, label, ...) tuples out of a migration's VALUES block. */
function readSeededRows(file: string): Array<{ key: string; label: string }> {
  const src = readFileSync(join(ROOT, 'supabase', 'migrations', file), 'utf8')
  // Each seed row: ('<key>','<label>', <position>, <protected>)
  return [...src.matchAll(/\(\s*'([a-z0-9-]+)'\s*,\s*'([^']+)'\s*,/g)].map((m) => ({
    key: m[1],
    label: m[2],
  }))
}

function readAllSeededRows(): Array<{ key: string; label: string }> {
  return SEED_MIGRATIONS.flatMap((f) => readSeededRows(f))
}

const byKey = (a: { key: string }, b: { key: string }) => a.key.localeCompare(b.key)

describe('crm_report_areas seed', () => {
  it('seeds exactly buildMarketReportAreas() across both seed migrations', () => {
    const seeded = [...readAllSeededRows()].sort(byKey)
    const built = buildMarketReportAreas()
      .map((a) => ({ key: a.slug, label: a.label }))
      .sort(byKey)
    expect(seeded).toEqual(built)
  })

  it('original migration keeps builder label-sort order for its 25 areas', () => {
    const seeded = readSeededRows(SEED_MIGRATIONS[0])
    const builtSubset = buildMarketReportAreas()
      .map((a) => ({ key: a.slug, label: a.label }))
      .filter((a) => seeded.some((s) => s.key === a.key))
    expect(seeded).toEqual(builtSubset)
  })

  it('seeds 38 areas (7 cities + 18 resort communities + 13 Bend districts)', () => {
    expect(readAllSeededRows()).toHaveLength(38)
  })

  it('protects Bend, the report engine anchor geography', () => {
    const src = readFileSync(
      join(ROOT, 'supabase', 'migrations', SEED_MIGRATIONS[0]),
      'utf8',
    )
    // Bend stays protected (is_protected=true) at whatever sorted position it lands.
    expect(/\(\s*'bend'\s*,\s*'Bend'\s*,\s*\d+\s*,\s*true\s*\)/.test(src)).toBe(true)
  })
})
