import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildMarketReportAreas } from '@/lib/data/crm/getContactReportSubscriptions'

/**
 * Seed parity for crm_report_areas.
 *
 * The config-table seed MUST exactly mirror buildMarketReportAreas() (the source
 * the DB-backed catalog replaces: Central Oregon cities + resort communities from
 * data/resort-communities.json, de-duped by slug, sorted by label). This test
 * runs the live builder and asserts the seeded (key, label) pairs equal its
 * output, in order, so a future edit to the builder or the registry without the
 * migration fails CI rather than silently drifting.
 */

const ROOT = join(__dirname, '..', '..')

/** Parse the seeded (key, label, ...) tuples out of the migration VALUES block. */
function readSeededRows(): Array<{ key: string; label: string }> {
  const src = readFileSync(
    join(ROOT, 'supabase', 'migrations', '20260625171000_crm_report_areas.sql'),
    'utf8',
  )
  // Each seed row: ('<key>','<label>', <position>, <protected>)
  return [...src.matchAll(/\(\s*'([a-z0-9-]+)'\s*,\s*'([^']+)'\s*,/g)].map((m) => ({
    key: m[1],
    label: m[2],
  }))
}

describe('crm_report_areas seed', () => {
  it('seeds exactly buildMarketReportAreas(), in builder order', () => {
    const seeded = readSeededRows()
    const built = buildMarketReportAreas().map((a) => ({ key: a.slug, label: a.label }))
    expect(seeded).toEqual(built)
  })

  it('seeds 20 areas (7 cities + 13 resort communities)', () => {
    expect(readSeededRows()).toHaveLength(20)
  })

  it('protects Bend, the report engine anchor geography', () => {
    const src = readFileSync(
      join(ROOT, 'supabase', 'migrations', '20260625171000_crm_report_areas.sql'),
      'utf8',
    )
    expect(/\(\s*'bend'\s*,\s*'Bend'\s*,\s*1\s*,\s*true\s*\)/.test(src)).toBe(true)
  })
})
