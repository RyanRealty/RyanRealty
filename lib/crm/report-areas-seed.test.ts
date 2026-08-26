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

/**
 * Migrations that RENAME a seeded label after the fact. A place can be renamed
 * without being re-seeded — Pronghorn became Juniper Preserve in October 2022
 * and the registry caught up on 2026-08-26 — and the row `key` deliberately does
 * NOT change, because it is the join key for existing contact subscriptions.
 *
 * Parsed rather than hardcoded so this test keeps checking the real migration.
 */
const RENAME_MIGRATIONS = ['20260826140000_crm_report_areas_juniper_preserve.sql'] as const

/** key -> { from, to } for every label rename applied after the seed. */
function readLabelRenames(): Map<string, { from: string; to: string }> {
  const renames = new Map<string, { from: string; to: string }>()
  for (const file of RENAME_MIGRATIONS) {
    const src = readFileSync(join(ROOT, 'supabase', 'migrations', file), 'utf8')
    const re =
      /update\s+public\.crm_report_areas\s+set\s+label\s*=\s*'([^']+)'\s+where\s+key\s*=\s*'([a-z0-9-]+)'\s*and\s+label\s*=\s*'([^']+)'/gi
    for (const m of src.matchAll(re)) renames.set(m[2], { from: m[3], to: m[1] })
  }
  return renames
}

/** The catalog as it stands in the DB: seeded rows with renames applied. */
function effectiveRows(): Array<{ key: string; label: string }> {
  const renames = readLabelRenames()
  return readAllSeededRows().map((row) =>
    renames.get(row.key)?.from === row.label
      ? { key: row.key, label: renames.get(row.key)!.to }
      : row,
  )
}

/** Undo the renames on builder output, giving the labels as they were at seed time. */
function asSeedTimeLabels(
  rows: Array<{ key: string; label: string }>,
): Array<{ key: string; label: string }> {
  const renames = readLabelRenames()
  return rows.map((row) =>
    renames.get(row.key)?.to === row.label
      ? { key: row.key, label: renames.get(row.key)!.from }
      : row,
  )
}

const byKey = (a: { key: string }, b: { key: string }) => a.key.localeCompare(b.key)

describe('crm_report_areas seed', () => {
  it('seeds exactly buildMarketReportAreas() across both seed migrations', () => {
    // Compares the catalog's EFFECTIVE state — seed plus any later rename
    // migration — so a registry rename must be carried into the DB, and a
    // registry edit with no migration still fails.
    const seeded = [...effectiveRows()].sort(byKey)
    const built = buildMarketReportAreas()
      .map((a) => ({ key: a.slug, label: a.label }))
      .sort(byKey)
    expect(seeded).toEqual(built)
  })

  it('original migration keeps builder label-sort order for its 25 areas', () => {
    // This one is about the seed FILE's physical row order, which was written in
    // the builder's label-sort order and cannot be rewritten now. A rename moves
    // a place in that sort (Pronghorn sat between Powell Butte and Redmond;
    // Juniper Preserve sorts up under J), so the builder is compared at its
    // SEED-TIME labels. The rename migration renumbers `position`, which is what
    // actually drives display order.
    const seeded = readSeededRows(SEED_MIGRATIONS[0])
    const builtSubset = asSeedTimeLabels(
      buildMarketReportAreas().map((a) => ({ key: a.slug, label: a.label })),
    )
      // Re-sort on the seed-time labels: reversing the rename is not enough,
      // because the builder emits label-sorted and the rename moved the row.
      .sort((a, b) => a.label.localeCompare(b.label))
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
