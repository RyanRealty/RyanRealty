import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildSavedViewSeeds, SAVED_VIEW_SEED_NAMES } from './saved-view-seeds'
import { validateSegment } from './segment-ast'
import { CRM_STAGES } from './constants'

/**
 * The canonical smart-list seeds (streamline v2) are the migration's correctness
 * contract. Two things must hold: (1) every seed AST validates against the
 * resolver's schema, and (2) the migration's seed block carries the same 12 names
 * in the same order. Drift between the TS defs and the SQL is what this catches.
 */
const MIGRATION_PATH = join(
  __dirname, '..', '..', 'supabase', 'migrations',
  '20260703140000_crm_saved_views_canonical.sql',
)

describe('saved-view seeds (canonical smart lists)', () => {
  const seeds = buildSavedViewSeeds()

  it('produces exactly 12 canonical lists', () => {
    expect(seeds).toHaveLength(12)
  })

  it('every seed AST validates against the resolver schema', () => {
    for (const seed of seeds) expect(() => validateSegment(seed.ast)).not.toThrow()
  })

  it('positions are a dense 0..11 sequence in order', () => {
    expect(seeds.map((s) => s.position)).toEqual(seeds.map((_, i) => i))
  })

  it('every seed has a non-empty name and description', () => {
    for (const seed of seeds) {
      expect(seed.name.length).toBeGreaterThan(0)
      expect(seed.description.length).toBeGreaterThan(0)
    }
  })

  it('stage-based seeds reference real CRM_STAGES keys', () => {
    const stageValues: string[] = []
    const collect = (node: unknown): void => {
      if (typeof node !== 'object' || node === null) return
      const n = node as { field?: string; value?: string; nodes?: unknown[] }
      if (n.field === 'stage' && typeof n.value === 'string') stageValues.push(n.value)
      if (Array.isArray(n.nodes)) n.nodes.forEach(collect)
    }
    seeds.forEach((s) => collect(s.ast))
    expect(stageValues.length).toBeGreaterThan(0)
    for (const v of stageValues) expect(CRM_STAGES as readonly string[]).toContain(v)
  })

  it('Sellers keys on the canonical segment:seller tag (stage-only was folded into it)', () => {
    const sellers = seeds.find((s) => s.name === 'Sellers')!
    expect(sellers.ast.nodes).toEqual([{ field: 'tag', op: 'has', value: 'segment:seller' }])
  })

  it('each workflow list keys on exactly ONE canonical signal', () => {
    const expect1 = {
      Buyers: 'segment:buyer', Expired: 'segment:expired', FSBO: 'segment:fsbo',
      'Out Of Area Home Owners': 'segment:out-of-area', 'Local Realtors': 'realtor:local',
      'Migration Realtors': 'realtor:migration', Vendors: 'segment:vendor',
      'Compliance Blocked': 'compliance:hard-stop',
    } as const
    for (const [name, tag] of Object.entries(expect1)) {
      const s = seeds.find((x) => x.name === name)!
      expect(s.ast.nodes).toEqual([{ field: 'tag', op: 'has', value: tag }])
    }
  })
})

describe('canonical saved-view seed migration mirrors the TS defs', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8')

  it('the migration insert names match the seed names in order', () => {
    const insertIdx = sql.indexOf('insert into public.crm_saved_views (name')
    expect(insertIdx).toBeGreaterThan(-1)
    const block = sql.slice(insertIdx)
    const rowRe = /\(\s*\n\s*'([^']+)'\s*,\s*\n\s*'[^']+'\s*,/g
    const names: string[] = []
    let m: RegExpExecArray | null
    while ((m = rowRe.exec(block)) !== null) names.push(m[1])
    expect(names).toEqual(SAVED_VIEW_SEED_NAMES)
  })

  it('seeds system views: owner_email null, protected, shared', () => {
    const tails = sql.match(/null,\s*true,\s*true,\s*\d+\s*\n?\s*\)/g) ?? []
    expect(tails.length).toBeGreaterThanOrEqual(12)
  })

  it('replaces the system set (delete owner_email null) and keeps the idempotent guard', () => {
    expect(sql).toMatch(/delete from public\.crm_saved_views where owner_email is null/)
    expect(sql).toMatch(/on conflict \(name\) where owner_email is null do nothing/)
  })
})
