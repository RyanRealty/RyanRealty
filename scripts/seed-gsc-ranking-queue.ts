/**
 * Ranking seed (THE LOOP measurer half) — CLI.
 *
 * The diagnosis lives in lib/data/loop/gsc-ranking-seed.ts (visibility audit
 * 2026-09-22, PROCESS-1) so this CLI, the Monday cron
 * (app/api/cron/loop-weekly-measure) and the boot brief seed from one rule set.
 * Taste `--seed-draft` mints catalog/look nodes from the table under 70.
 * This mints SITE-* nodes from Search Console gaps: position 5–20 with volume,
 * high-impression zero-click place queries, split landings, and missing p1
 * target queries. SITE-62 still bans auto-seed from a taste score. Every row
 * has a diagnose rule and a PAGE_OUTLINE winner URL.
 *
 *   npx tsx scripts/seed-gsc-ranking-queue.ts
 *   npx tsx scripts/seed-gsc-ranking-queue.ts --from-json scratchpad/seo-aeo-gsc-2026-09-22.json
 *   npx tsx scripts/seed-gsc-ranking-queue.ts --apply
 *
 * Dry-run is the default (prints drafts, writes scratchpad/gsc-ranking-seed-draft.ts).
 * `--apply` upserts loop_work_nodes on version_gap with ignoreDuplicates and
 * never clobbers an existing node's state.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import { createGscQuery } from '../lib/data/loop/gsc-api'
import {
  buildGscGapDrafts,
  formatDrafts,
  formatSiteGap,
  insertGscGapNodes,
  nextSiteNumber,
  pullGscSeedRows,
  readSeedContext,
  seedWindow,
  type GscQueryPageRow,
  type GscRow,
  type Landing,
} from '../lib/data/loop/gsc-ranking-seed'

for (const f of ['.env.local', '.env']) if (existsSync(f)) loadEnv({ path: f })

const APPLY = process.argv.includes('--apply')
const fromJsonIdx = process.argv.indexOf('--from-json')
const fromJsonRaw = fromJsonIdx >= 0 ? process.argv[fromJsonIdx + 1] : null
const fromJsonArg = fromJsonRaw && !fromJsonRaw.startsWith('-') ? fromJsonRaw : null
const DEFAULT_CACHE = 'scratchpad/seo-aeo-gsc-2026-09-22.json'
const OUT_PATH = 'scratchpad/gsc-ranking-seed-draft.ts'

type CachedJson = {
  named?: Record<string, { top?: GscRow[] }>
  pos515?: GscRow[]
  highImpLowCtr?: GscRow[]
  posGt15Pri?: GscRow[]
  topQueries?: GscRow[]
  landings?: Record<string, Landing[]>
}

function queriesFromCachedJson(raw: CachedJson): GscRow[] {
  const seen = new Map<string, GscRow>()
  const add = (rows: GscRow[] | undefined) => {
    for (const r of rows ?? []) {
      if (!r?.q) continue
      const prev = seen.get(r.q)
      if (!prev || r.impressions > prev.impressions) seen.set(r.q, r)
    }
  }
  add(raw.topQueries)
  add(raw.pos515)
  add(raw.highImpLowCtr)
  add(raw.posGt15Pri)
  for (const bucket of Object.values(raw.named ?? {})) add(bucket.top)
  return [...seen.values()]
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)

  const ctx = await readSeedContext(sb)
  if (ctx.error) {
    console.error('SITE gaps unreadable:', ctx.error)
    process.exit(1)
  }
  if (ctx.targetQueriesError) console.error('target_queries:', ctx.targetQueriesError)
  const used = ctx.existing.map((r) => String(r.version_gap ?? ''))

  let jsonPath = fromJsonArg && existsSync(fromJsonArg) ? fromJsonArg : null
  let queries: GscRow[] = []
  let livePages: GscQueryPageRow[] | null = null
  if (!jsonPath) {
    try {
      const gsc = await createGscQuery()
      if (!gsc) throw new Error('GSC service-account env missing')
      const rows = await pullGscSeedRows(gsc, seedWindow())
      queries = rows.queries
      livePages = rows.queryPages
    } catch (err) {
      if (!existsSync(DEFAULT_CACHE)) throw err
      console.error(`GSC live pull failed (${(err as Error).message}); falling back to ${DEFAULT_CACHE}`)
      jsonPath = DEFAULT_CACHE
    }
  }
  let landings: Record<string, Landing[]> | null = null
  if (jsonPath) {
    const raw = JSON.parse(readFileSync(jsonPath, 'utf8')) as CachedJson
    queries = queriesFromCachedJson(raw)
    landings = raw.landings ?? {}
  }

  const { drafts, gaps } = buildGscGapDrafts({
    queries,
    queryPages: livePages,
    landings,
    targetQueries: ctx.targetQueries,
    existing: ctx.existing,
  })

  let inserted = 0
  if (APPLY && drafts.length) {
    const res = await insertGscGapNodes(sb, drafts)
    if (res.error) {
      console.error('seed-gsc-ranking-queue apply failed:', res.error)
      process.exit(1)
    }
    inserted = res.inserted
  }

  const text = formatDrafts(drafts, APPLY ? { inserted } : null)
  try {
    mkdirSync(dirname(OUT_PATH), { recursive: true })
    writeFileSync(OUT_PATH, text)
  } catch (err) {
    console.error(`could not write ${OUT_PATH}: ${(err as Error).message}`)
  }

  const source = jsonPath ? `json ${jsonPath}` : 'live GSC'
  console.log(
    `used SITE gaps ${used.length} · next ${formatSiteGap(nextSiteNumber(used))} · GSC queries ${queries.length} (${source}) · drafts ${drafts.length}${APPLY ? ` · inserted ${inserted}` : ' · dry-run'}`,
  )
  console.log(text)
  console.log(`RESULT drafts=${drafts.length} inserted=${APPLY ? inserted : 0} skipped=${gaps.length - drafts.length} apply=${APPLY}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
