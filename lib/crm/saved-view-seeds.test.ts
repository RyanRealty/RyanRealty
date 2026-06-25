import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildSavedViewSeeds, SAVED_VIEW_SEED_NAMES } from './saved-view-seeds'
import { validateSegment } from './segment-ast'
import { CRM_STAGES } from './constants'

/**
 * The 12 FUB smart-list seeds are the migration's correctness contract. Two things
 * must hold: (1) every seed AST validates against the resolver's schema, and
 * (2) the migration's seed block carries the same 12 names in the same order.
 * A drift between the TS defs and the SQL is exactly what this test catches.
 */
const MIGRATION_PATH = join(
  __dirname,
  '..',
  '..',
  'supabase',
  'migrations',
  '20260625180500_crm_saved_views_ast.sql',
)

// A fixed clock so the date-window seeds are deterministic across machines/runs.
const FIXED_NOW = new Date('2026-06-25T12:00:00.000Z')

describe('saved-view seeds (the 12 FUB smart lists)', () => {
  const seeds = buildSavedViewSeeds(FIXED_NOW)

  it('produces exactly 12 seeds', () => {
    expect(seeds).toHaveLength(12)
  })

  it('every seed AST validates against the resolver schema', () => {
    for (const seed of seeds) {
      expect(() => validateSegment(seed.ast)).not.toThrow()
    }
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
    for (const v of stageValues) {
      expect(CRM_STAGES as readonly string[]).toContain(v)
    }
  })

  it('Sellers maps to an OR of audience:seller tag and Seller Prospect stage', () => {
    const sellers = seeds.find((s) => s.name === 'Sellers')!
    expect(sellers.ast.op).toBe('or')
    expect(sellers.ast.nodes).toEqual([
      { field: 'tag', op: 'has', value: 'audience:seller' },
      { field: 'stage', value: 'Seller Prospect' },
    ])
  })

  it('Buyers maps to the audience:buyer tag', () => {
    const buyers = seeds.find((s) => s.name === 'Buyers')!
    expect(buyers.ast.nodes).toEqual([{ field: 'tag', op: 'has', value: 'audience:buyer' }])
  })

  it('Stay In Touch is a last_activity before condition (the dormancy proxy)', () => {
    const stay = seeds.find((s) => s.name === 'Stay In Touch')!
    const node = stay.ast.nodes[0] as { field: string; op: string; value: string }
    expect(node.field).toBe('last_activity')
    expect(node.op).toBe('before')
    // 90 days before the fixed clock.
    expect(new Date(node.value).getTime()).toBe(FIXED_NOW.getTime() - 90 * 24 * 3600 * 1000)
    expect(stay.mappingNote.length).toBeGreaterThan(0)
  })

  it('Email + IDX Activity carry a mappingNote (they are approximations)', () => {
    const email = seeds.find((s) => s.name === 'Email Activity')!
    const idx = seeds.find((s) => s.name === 'IDX Activity')!
    expect(email.mappingNote.length).toBeGreaterThan(0)
    expect(idx.mappingNote.length).toBeGreaterThan(0)
  })
})

describe('saved-view seed migration mirrors the TS defs', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8')

  it('the migration insert names match the seed names in order', () => {
    // Grab the seed INSERT block (after the `insert into ... values`) and pull each
    // first quoted string per `( 'Name',` row.
    const insertIdx = sql.indexOf('insert into public.crm_saved_views (name')
    expect(insertIdx).toBeGreaterThan(-1)
    const block = sql.slice(insertIdx)
    // A row opener is `(\n 'Name',\n 'Description',` — two string literals back to
    // back. jsonb_build_object args (e.g. 'type','group') are paired key/value on
    // the SAME line, so anchoring on a newline between the two literals isolates
    // the row name from the AST internals.
    const rowRe = /\(\s*\n\s*'([^']+)'\s*,\s*\n\s*'[^']+'\s*,/g
    const names: string[] = []
    let m: RegExpExecArray | null
    while ((m = rowRe.exec(block)) !== null) names.push(m[1])
    expect(names).toEqual(SAVED_VIEW_SEED_NAMES)
  })

  it('seeds system views: owner_email null, protected, shared', () => {
    // The fixed (non-date) rows pass null,true,true,<pos>; assert the literal tail
    // appears for the first nine fixed-AST rows.
    const tails = sql.match(/null,\s*true,\s*true,\s*\d+\s*\n?\s*\)/g) ?? []
    expect(tails.length).toBeGreaterThanOrEqual(9)
  })

  it('the idempotent guard uses on conflict (name) where owner_email is null', () => {
    expect(sql).toMatch(/on conflict \(name\) where owner_email is null do nothing/)
  })
})
