import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CRM_STAGES } from './constants'

/**
 * The crm_stages seed must mirror the retired CRM_STAGES const exactly, in order
 * — that is the migration's correctness contract (existing crm_people.stage
 * values must keep resolving). This parses the migration's seed VALUES block and
 * checks it against the const. When the const is eventually deleted, this test
 * is the record of what the seed encoded.
 */
const MIGRATION_PATH = join(
  __dirname,
  '..',
  '..',
  'supabase',
  'migrations',
  '20260625160000_crm_stages_config_table.sql',
)

type SeedRow = { key: string; label: string; position: number; isProtected: boolean }

function parseSeed(sql: string): SeedRow[] {
  // Grab the lines inside the `values ( ... )` insert block. Each row looks like:
  //   ('Lead', 'Lead', 0, false),
  const rowRe = /\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*(\d+)\s*,\s*(true|false)\s*\)/g
  const rows: SeedRow[] = []
  let m: RegExpExecArray | null
  while ((m = rowRe.exec(sql)) !== null) {
    rows.push({
      key: m[1],
      label: m[2],
      position: Number(m[3]),
      isProtected: m[4] === 'true',
    })
  }
  return rows
}

describe('crm_stages seed', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8')
  const seed = parseSeed(sql)

  it('seeds exactly one row per CRM_STAGES entry', () => {
    expect(seed).toHaveLength(CRM_STAGES.length)
  })

  it('preserves the const order via position', () => {
    CRM_STAGES.forEach((stage, index) => {
      const row = seed[index]
      expect(row.key).toBe(stage)
      expect(row.label).toBe(stage)
      expect(row.position).toBe(index)
    })
  })

  it('positions are a dense 0..n-1 sequence', () => {
    expect(seed.map((r) => r.position)).toEqual(seed.map((_, i) => i))
  })

  it('marks only the terminal/system buckets protected (Trash, Archive)', () => {
    const protectedKeys = seed.filter((r) => r.isProtected).map((r) => r.key).sort()
    expect(protectedKeys).toEqual(['Archive', 'Trash'])
  })

  it('every seed row has a non-empty key and label', () => {
    for (const row of seed) {
      expect(row.key.length).toBeGreaterThan(0)
      expect(row.label.length).toBeGreaterThan(0)
    }
  })
})
