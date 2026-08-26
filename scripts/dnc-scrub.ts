/**
 * DNC scrub runner — works through the backlog of never-checked phone numbers.
 *
 *   npx tsx scripts/dnc-scrub.ts --limit 25            # scrub 25 numbers
 *   npx tsx scripts/dnc-scrub.ts --limit 25 --dry-run  # show the backlog, spend nothing
 *   npx tsx scripts/dnc-scrub.ts --limit 5000 --source Farm   # the unscreened cohort
 *
 * SPENDS MONEY. BatchData bills per number, so --limit is required and there is
 * no default that quietly scrubs the whole book. Start with --dry-run, then a
 * small --limit, and read the printed cost before scaling.
 *
 * What it does per batch of 100:
 *   1. pull unchecked/stale numbers (crm_unchecked_dnc_phones, SECURITY DEFINER)
 *   2. ask BatchData
 *   3. record every ANSWER in crm_phone_dnc_checks (an unmatched or errored
 *      number is recorded as nothing, never as clean)
 *   4. for a number on the registry, tag + suppress every live contact holding
 *      it, so the send chokepoint blocks them from that moment
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import path from 'node:path'
import Module from 'node:module'

const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (
  this: unknown, request: string, ...args: unknown[]
) {
  const req = request === 'server-only' || request === 'client-only' ? STUB
    : request === 'next/cache' ? CACHE_STUB : request
  return resolveFilename.call(this, req, ...args)
}


/**
 * Retry a transient failure. A scrub run is minutes long, costs money per
 * number, and talks to two networks — a single Supabase 521 (Cloudflare
 * reporting the origin unreachable) killed a run mid-way once. Work already
 * recorded is never lost (each batch commits before the next), so a retry only
 * has to get past the blip.
 */
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i === attempts) break
      const waitMs = 2000 * 2 ** (i - 1)
      console.warn(`  ${label} failed (attempt ${i}/${attempts}): ${e instanceof Error ? e.message.slice(0, 120) : e}`)
      console.warn(`  retrying in ${waitMs / 1000}s`)
      await new Promise((r) => setTimeout(r, waitMs))
    }
  }
  throw lastErr
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? '') : null
}

async function main() {
  const limitRaw = arg('limit')
  const dryRun = process.argv.includes('--dry-run')
  const source = arg('source')
  const limit = Number(limitRaw)
  if (!limitRaw || !Number.isFinite(limit) || limit <= 0) {
    console.error('Refusing to run without an explicit --limit (this spends money per number).')
    process.exit(1)
  }

  const { listUncheckedPhones } = await import('@/lib/data/crm/dncChecks')
  const { runDncScrub } = await import('@/lib/crm/dnc-scrub-run')

  if (dryRun) {
    const backlog = await listUncheckedPhones(limit, source)
    console.log(`backlog: ${backlog.length} number(s) (limit ${limit}${source ? `, source=${source}` : ''})`)
    console.log('DRY RUN — nothing sent, nothing spent. Sample:', backlog.slice(0, 5).join(', '))
    return
  }

  // One shared implementation with the weekly cron, so a scrub applies flags
  // the same way whoever starts it.
  const r = await runDncScrub({ limit, source, onProgress: (m) => console.log('  ' + m) })

  console.log(`\nasked      ${r.asked}`)
  console.log(`answered   ${r.answered}  (recorded)`)
  console.log(`no answer  ${r.asked - r.answered}  (left UNCHECKED on purpose — not recorded as clean)`)
  console.log(`on registry ${r.onRegistry}  -> ${r.contactsFlagged} contact(s) tagged + suppressed`)
  console.log(`litigator   ${r.litigators} of ${r.litigatorChecked} answered`)
  if (r.litigatorChecked > 0 && r.litigators === 0) {
    console.log('  note: zero litigator hits. Expected on a small batch (they are rare);')
    console.log('  if this holds across thousands, ask BatchData whether the product is enabled.')
  }
  if (r.batchesAbandoned > 0) {
    console.log(`\nBATCHES ABANDONED: ${r.batchesAbandoned} — those numbers are still unchecked; re-run to pick them up.`)
  }
  console.log(`\nAt roughly $0.02-0.05/number this batch cost about $${(r.answered * 0.03).toFixed(2)}.`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
