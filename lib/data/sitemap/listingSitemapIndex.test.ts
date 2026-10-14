import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LISTING_SITEMAP_STATUSES } from '@/lib/listing-status-public'

/**
 * The listings sitemap read has an index only while its status set and a
 * partial index predicate on listing_tile_mv_src are the SAME set.
 *
 * WHY (2026-10-14). getListingSitemapRows pages listing_tile_mv by
 * `standard_status IN (LISTING_SITEMAP_STATUSES) ORDER BY listing_key` as
 * anon (statement_timeout 3s). #533 added Pending to the set; the partial
 * index from 20260916080000 covered only Active + Active Under Contract, so
 * the planner walked the unique key index over all ~600K rows instead
 * (3,622 ms, 577,011 rows filtered). That was 588 statement timeouts in one
 * day, the largest source on the database, and every sitemap build after a
 * deploy ran it. Nothing failed in CI: the change was one array spread.
 *
 * An IN-list proves a partial predicate only when its values are a subset of
 * the predicate's, so a superset predicate would also be used; equality is
 * pinned because that is what the migration on record builds, and a change
 * to the set should come with its own index decision.
 */

const MIGRATIONS = join(process.cwd(), 'supabase/migrations')

type PartialKeyIndex = { file: string; name: string; statuses: string[] }

function parseStatusList(list: string): string[] {
  return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]!)
}

function migrationSql(): Array<{ file: string; sql: string }> {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => ({ file, sql: readFileSync(join(MIGRATIONS, file), 'utf8') }))
}

/** Partial btree indexes on listing_tile_mv_src (listing_key) WHERE standard_status IN (...), net of later drops. */
function liveSitemapKeyIndexes(): PartialKeyIndex[] {
  const live = new Map<string, PartialKeyIndex>()
  const create =
    /create\s+index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?(\w+)\s+on\s+(?:public\.)?listing_tile_mv_src\s+(?:using\s+btree\s+)?\(\s*listing_key\s*\)\s+where\s+\(?\s*standard_status\s+in\s*\(([^)]*)\)/gi
  const drop = /drop\s+index\s+(?:concurrently\s+)?(?:if\s+exists\s+)?(?:public\.)?(\w+)/gi
  for (const { file, sql } of migrationSql()) {
    const body = sql.replace(/--.*$/gm, '')
    for (const m of body.matchAll(create)) {
      live.set(m[1]!, { file, name: m[1]!, statuses: parseStatusList(m[2]!) })
    }
    for (const m of body.matchAll(drop)) live.delete(m[1]!)
  }
  return [...live.values()]
}

describe('listings sitemap read keeps an index (2026-10-14)', () => {
  it('a partial key index on listing_tile_mv_src has exactly the sitemap status set', () => {
    const want = [...LISTING_SITEMAP_STATUSES].sort()
    const indexes = liveSitemapKeyIndexes()
    const match = indexes.find((ix) => JSON.stringify([...ix.statuses].sort()) === JSON.stringify(want))
    expect(
      match,
      `no migration builds listing_tile_mv_src (listing_key) WHERE standard_status IN (${want.join(', ')}). ` +
        `Found: ${indexes.map((ix) => `${ix.name} [${ix.statuses.join(', ')}]`).join('; ') || 'none'}. ` +
        'Add a partial index migration for the new status set in the same PR.',
    ).toBeDefined()
  })

  it('reads the migrations on record (the parser is not finding nothing)', () => {
    const names = liveSitemapKeyIndexes().map((ix) => ix.name)
    expect(names).toContain('listing_tile_mv_src_public_active_key')
    expect(names).toContain('listing_tile_mv_src_on_market_key')
  })
})
