import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOOR, TABLE, inScope, scanSource } from '../check-market-metric-cached.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('R1: pages and components cannot query market_metric', () => {
  it('FIRES on a page .from("market_metric")', () => {
    const v = scanSource(
      'app/communities/[slug]/page.tsx',
      "const sb = createServiceClient()\nawait sb.from('market_metric').select('stat_id')\n",
    )
    expect(v).toEqual([
      `app/communities/[slug]/page.tsx:2 queries ${TABLE} from a page/route/component; use lib/data/market-truth`,
    ])
  })

  it('FIRES on a route handler', () => {
    const v = scanSource(
      'app/api/cron/compute-neighborhood-metrics/route.ts',
      "await supabase.from(\"market_metric\").select('geo_slug')\n",
    )
    expect(v[0]).toMatch(/queries market_metric from a page\/route\/component/)
  })

  it('stays GREEN when a page only names the table in a comment', () => {
    expect(
      scanSource(
        'app/sell/page.tsx',
        "// overlays from market_metric via getDetachedOverlays\nawait getDetachedOverlays([])\n",
      ),
    ).toEqual([])
  })
})

describe('R2: DAL files that query market_metric must wrap unstable_cache', () => {
  it('FIRES on an uncached DAL read', () => {
    const v = scanSource(
      'lib/data/market-truth/getMetric.ts',
      "import { createServiceClient } from '@/lib/data/client'\nexport async function getMetrics() {\n  return createServiceClient().from('market_metric').select('stat_id')\n}\n",
    )
    expect(v[0]).toContain(`queries ${TABLE} without wrapping unstable_cache from ${DOOR}`)
  })

  it('stays GREEN when the file imports the door and calls unstable_cache', () => {
    expect(
      scanSource(
        'lib/data/market-truth/getMetric.ts',
        "import { unstable_cache } from '@/lib/data/cache/next-cache'\nimport { createServiceClient } from '@/lib/data/client'\nconst load = unstable_cache(async () => createServiceClient().from('market_metric').select('stat_id'), ['k'])\n",
      ),
    ).toEqual([])
  })
})

describe('scope', () => {
  it('skips tests and scripts', () => {
    expect(inScope('lib/data/market-truth/getMetric.test.ts')).toBe(false)
    expect(inScope('scripts/check-market-metric-cached.mjs')).toBe(false)
    expect(inScope('lib/data/market-truth/getMetric.ts')).toBe(true)
    expect(inScope('app/communities/[slug]/page.tsx')).toBe(true)
  })
})

describe('repo', () => {
  it('the live tree passes', () => {
    const run = spawnSync(process.execPath, ['scripts/check-market-metric-cached.mjs'], {
      cwd: REPO,
      encoding: 'utf8',
    })
    expect(run.status, run.stderr || run.stdout).toBe(0)
  })
})
