/**
 * scripts/cma-lanes-check.ts — READ-ONLY lane census for the CMA queue.
 *
 * Prints the unified queue broken out by origin (lane) × state, so the effect
 * of the `request_source` backfill migration is a measured before/after rather
 * than a claim. Writes nothing, sends nothing.
 *
 *   npx tsx -r ./scripts/lib/server-only-shim.cjs scripts/cma-lanes-check.ts
 *   npx tsx -r ./scripts/lib/server-only-shim.cjs scripts/cma-lanes-check.ts --json
 *
 * Everything comes through `listCmaQueue` — the same DAL read the queue page
 * renders — so this census and the screen can never disagree (§7 DAL-first).
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()

import type { CmaOrigin } from '@/lib/cma/origin'
import type { CmaQueueState } from '@/lib/data/cma/unified-queue'

const ORIGIN_ORDER: CmaOrigin[] = [
  'expired',
  'fsbo',
  'seller-valuation',
  'lead-form',
  'bpo',
  'broker',
  'internal',
  'unknown',
]

const STATE_ORDER: CmaQueueState[] = [
  'ready',
  'flagged',
  'unvetted',
  'audit-failed',
  'failed',
  'building',
  'queued',
  'sent',
  'archived',
]

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length)
}

function padLeft(s: string, n: number): string {
  return s.length >= n ? s : ' '.repeat(n - s.length) + s
}

async function main() {
  const asJson = process.argv.includes('--json')
  const { listCmaQueue } = await import('@/lib/data')

  const { rows, total } = await listCmaQueue({ limit: 1000, includeArchived: true })

  const grid = new Map<string, number>()
  const originTotals = new Map<CmaOrigin, number>()
  const stateTotals = new Map<CmaQueueState, number>()
  for (const r of rows) {
    const key = `${r.origin}|${r.state}`
    grid.set(key, (grid.get(key) ?? 0) + 1)
    originTotals.set(r.origin, (originTotals.get(r.origin) ?? 0) + 1)
    stateTotals.set(r.state, (stateTotals.get(r.state) ?? 0) + 1)
  }

  // Lanes that actually appear, in canonical order, plus anything unforeseen.
  const originsSeen = ORIGIN_ORDER.filter((o) => (originTotals.get(o) ?? 0) > 0)
  for (const o of originTotals.keys()) if (!originsSeen.includes(o)) originsSeen.push(o)

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          fetched_at: new Date().toISOString(),
          queue_rows: rows.length,
          cmas_total: total,
          by_origin: Object.fromEntries(originsSeen.map((o) => [o, originTotals.get(o) ?? 0])),
          by_state: Object.fromEntries(STATE_ORDER.map((s) => [s, stateTotals.get(s) ?? 0])),
          grid: Object.fromEntries(
            originsSeen.map((o) => [
              o,
              Object.fromEntries(STATE_ORDER.map((s) => [s, grid.get(`${o}|${s}`) ?? 0])),
            ]),
          ),
        },
        null,
        2,
      ),
    )
    return
  }

  const W = 18
  const C = 13
  console.log(`\nCMA lanes — ${rows.length} queue rows (cmas total ${total}) · ${new Date().toISOString()}`)
  console.log(`source: listCmaQueue({ limit: 1000, includeArchived: true })\n`)
  console.log(pad('lane', W) + STATE_ORDER.map((s) => padLeft(s, C)).join('') + padLeft('total', C))
  console.log('-'.repeat(W + C * (STATE_ORDER.length + 1)))
  for (const o of originsSeen) {
    console.log(
      pad(o, W) +
        STATE_ORDER.map((s) => padLeft(String(grid.get(`${o}|${s}`) ?? 0), C)).join('') +
        padLeft(String(originTotals.get(o) ?? 0), C),
    )
  }
  console.log('-'.repeat(W + C * (STATE_ORDER.length + 1)))
  console.log(
    pad('total', W) +
      STATE_ORDER.map((s) => padLeft(String(stateTotals.get(s) ?? 0), C)).join('') +
      padLeft(String(rows.length), C),
  )
  console.log('')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : String(e))
  process.exit(1)
})
