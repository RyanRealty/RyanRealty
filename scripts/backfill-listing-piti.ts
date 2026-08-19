/**
 * Recompute `listings.estimated_monthly_piti` for ACTIVE listings at the LIVE
 * 30-yr mortgage rate.
 *
 * WHY THIS EXISTS
 * `computeTier1()` in lib/listing-mapper.ts carried `const rate = 0.065`, so
 * every row the sync ever wrote implies exactly 6.50% — including listings that
 * came on the market today. The rate is now an input threaded from
 * `market_history_weekly` (see lib/data/market/getLiveMortgageRate.ts), which
 * fixes rows going forward but does NOT touch a row until Spark next modifies
 * it. This script closes that gap once.
 *
 * `estimated_monthly_piti` is a PLAIN numeric column written by TypeScript. The
 * COMMENT on migration 20260414220000 calls it "GENERATED" and
 * 20260414210000 says `get_mortgage_rate()` feeds it — both are stale. The
 * ALTER TABLE in that same migration is a bare `ADD COLUMN ... numeric(10,2)`,
 * and `get_mortgage_rate()` is called from no application code (verified
 * 2026-08-17: the only repo hits are its own migration, the generated
 * types/database.ts row, and a prose comment). A plain UPDATE is therefore the
 * correct instrument — there is no generated-column expression to change.
 *
 * SCOPE: ACTIVE only. Closed / expired / withdrawn rows are a historical record
 * priced at the rate of their own moment; re-pricing them at today's rate would
 * be worse, not better.
 *
 * THE FORMULA IS NOT REIMPLEMENTED HERE. This calls the same `computeTier1()`
 * the sync calls, so the backfilled value and the next sync's value cannot
 * disagree.
 *
 * Usage:
 *   # dry run (default) — reads only, writes nothing
 *   npx tsx --env-file=.env.local scripts/backfill-listing-piti.ts
 *   # limit the scan while checking output
 *   npx tsx --env-file=.env.local scripts/backfill-listing-piti.ts --limit=200
 *   # write
 *   npx tsx --env-file=.env.local scripts/backfill-listing-piti.ts --apply
 *
 * Flags:
 *   --apply              perform the UPDATEs (absent = dry run)
 *   --rate=6.67          override the rate in PERCENT; skips the live read
 *   --status=Active      StandardStatus to match exactly (default "Active")
 *   --limit=N            cap rows scanned (default: all)
 *   --sample=N           before/after rows to print (default 10)
 *   --concurrency=N      parallel UPDATEs when applying (default 8)
 */

import { createClient } from '@supabase/supabase-js'
import { computeMonthlyPiti, normalizePitiRate, DEFAULT_PITI_RATE } from '@/lib/listing-tier1'
import { clampListingNumericBounds } from '@/lib/listing-numeric-bounds'
import { getLiveMortgageRate } from '@/lib/data/market/getLiveMortgageRate'

// ── args ────────────────────────────────────────────────────────────────────

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}

function num(name: string, fallback: number): number {
  const raw = arg(name)
  if (raw == null) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

const APPLY = flag('apply')
const STATUS = arg('status') ?? 'Active'
const LIMIT = arg('limit') != null ? Math.max(1, Math.floor(num('limit', 0))) : null
const SAMPLE = Math.max(0, Math.floor(num('sample', 10)))
const CONCURRENCY = Math.max(1, Math.min(32, Math.floor(num('concurrency', 8))))
const RATE_OVERRIDE = arg('rate') != null ? Number(arg('rate')) : null

const PAGE = 1000

// ── client ──────────────────────────────────────────────────────────────────

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url?.trim() || !serviceKey?.trim()) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(url, serviceKey)

// ── types ───────────────────────────────────────────────────────────────────

type ListingRow = {
  ListNumber: string | null
  ListingKey: string | null
  ListPrice: number | null
  StandardStatus: string | null
  tax_annual_amount: number | null
  hoa_monthly: number | null
  estimated_monthly_piti: number | null
}

/**
 * PITI at a given rate, through the SAME function the sync calls (computeTier1
 * delegates to it), so a backfilled value and the next sync's value cannot
 * disagree. This script writes exactly one column and computes nothing else.
 */
function pitiAt(row: ListingRow, ratePct: number): number | null {
  const value = computeMonthlyPiti({
    listPrice: row.ListPrice,
    taxAnnual: row.tax_annual_amount,
    hoaMonthly: row.hoa_monthly,
    mortgageRate: ratePct,
  })
  // Same numeric(10,2) capacity clamp the sync applies — an unfittable value
  // stores NULL rather than failing the UPDATE.
  const shaped: Record<string, unknown> = { estimated_monthly_piti: value }
  clampListingNumericBounds(shaped)
  const v = shaped.estimated_monthly_piti
  return typeof v === 'number' ? v : null
}

function money(n: number | null): string {
  return n == null ? '—' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── rate resolution (§0: name the source, print the vintage) ────────────────

type RateTrace = { ratePct: number; trace: string }

async function resolveRate(): Promise<RateTrace> {
  if (RATE_OVERRIDE != null) {
    if (!Number.isFinite(RATE_OVERRIDE)) {
      console.error(`--rate=${arg('rate')} is not a number`)
      process.exit(1)
    }
    // normalizePitiRate returns DEFAULT_PITI_RATE both for "you asked for the
    // default" and for "that is not a rate" — separate the two so an
    // out-of-band --rate is rejected loudly instead of silently becoming 6.5%.
    const normalized = normalizePitiRate(RATE_OVERRIDE)
    const askedForDefault =
      Math.abs(RATE_OVERRIDE - DEFAULT_PITI_RATE) < 1e-12 ||
      Math.abs(RATE_OVERRIDE - DEFAULT_PITI_RATE * 100) < 1e-9
    if (normalized === DEFAULT_PITI_RATE && !askedForDefault) {
      console.error(
        `--rate=${RATE_OVERRIDE} is outside the 2–20% band a 30-yr rate lives in; refusing to write a fabricated payment.`,
      )
      process.exit(1)
    }
    return {
      ratePct: normalized * 100,
      trace: `operator override --rate=${RATE_OVERRIDE} (no source trace — use only to reproduce a known figure)`,
    }
  }

  const live = await getLiveMortgageRate()
  if (!live) {
    console.error(
      'No usable 30-yr rate in market_history_weekly (national/us, mortgage_rate_30yr).\n' +
        'Refusing to run: backfilling at the hardcoded default would rewrite every row for no gain.\n' +
        'Check /api/cron/market-history-snapshot, or pass --rate=<percent> deliberately.',
    )
    process.exit(1)
  }
  return {
    ratePct: live.ratePct,
    trace:
      `${live.ratePct}% 30-yr fixed — Supabase market_history_weekly, ` +
      `geo_type='national', geo_slug='us', metric='mortgage_rate_30yr', ` +
      `week_start=${live.weekStart}, source=${live.source}, captured_at=${live.capturedAt}`,
  }
}

// ── read ────────────────────────────────────────────────────────────────────

/**
 * Every matching row, keyset-paged on ListNumber (the table's upsert conflict
 * key, so it is unique and stable). Read fully before any write so a concurrent
 * delta sync cannot shift the page window mid-run.
 */
async function readActiveRows(): Promise<ListingRow[]> {
  const out: ListingRow[] = []
  let cursor: string | null = null

  for (;;) {
    let q = sb
      .from('listings')
      .select('ListNumber, ListingKey, ListPrice, StandardStatus, tax_annual_amount, hoa_monthly, estimated_monthly_piti')
      .eq('StandardStatus', STATUS)
      .not('ListNumber', 'is', null)
      .order('ListNumber', { ascending: true })
      .limit(PAGE)
    if (cursor != null) q = q.gt('ListNumber', cursor)

    const { data, error } = await q
    if (error) {
      console.error(`read failed: ${error.message}`)
      process.exit(1)
    }
    const rows = (data ?? []) as ListingRow[]
    if (rows.length === 0) break
    out.push(...rows)
    cursor = rows[rows.length - 1].ListNumber
    if (rows.length < PAGE) break
    if (LIMIT != null && out.length >= LIMIT) break
  }

  return LIMIT != null ? out.slice(0, LIMIT) : out
}

/**
 * Broad status counts. §0: a filtered count is a fact about the filter first —
 * print what the exact match excluded so the scope is auditable, and so a
 * status-string drift ("Active " / "ACTIVE") cannot silently shrink the run.
 */
async function printStatusCounts(): Promise<void> {
  const statuses = ['Active', 'Pending', 'Closed', 'Expired', 'Withdrawn', 'Canceled']
  const counts: Record<string, number | string> = {}
  for (const s of statuses) {
    const { count, error } = await sb
      .from('listings')
      .select('ListNumber', { count: 'exact', head: true })
      .eq('StandardStatus', s)
    counts[s] = error ? `error: ${error.message}` : (count ?? 0)
  }
  console.log('StandardStatus counts (exact match):')
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(10)} ${v}`)
  console.log('')
}

// ── write ───────────────────────────────────────────────────────────────────

type Change = { listNumber: string; listingKey: string | null; before: number | null; after: number | null }

async function applyChanges(changes: Change[]): Promise<{ updated: number; failed: number }> {
  let updated = 0
  let failed = 0
  let index = 0

  async function worker(): Promise<void> {
    for (;;) {
      const i = index++
      if (i >= changes.length) return
      const c = changes[i]
      const { error } = await sb
        .from('listings')
        .update({ estimated_monthly_piti: c.after })
        .eq('ListNumber', c.listNumber)
      if (error) {
        failed++
        if (failed <= 10) console.error(`  update ${c.listNumber} failed: ${error.message}`)
      } else {
        updated++
        if (updated % 500 === 0) console.log(`  ...${updated}/${changes.length} updated`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return { updated, failed }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { ratePct, trace } = await resolveRate()

  console.log('')
  console.log('backfill-listing-piti')
  console.log(`mode      ${APPLY ? 'APPLY (writes)' : 'DRY RUN (no writes)'}`)
  console.log(`status    StandardStatus = "${STATUS}"`)
  console.log(`rate      ${trace}`)
  console.log(`replaces  the hardcoded ${(DEFAULT_PITI_RATE * 100).toFixed(2)}% every existing row was computed at`)
  console.log('')

  await printStatusCounts()

  const rows = await readActiveRows()
  console.log(`scanned   ${rows.length} rows${LIMIT != null ? ` (--limit=${LIMIT})` : ''}`)

  const changes: Change[] = []
  let unchanged = 0
  let noPrice = 0

  for (const row of rows) {
    if (row.ListNumber == null) continue
    if (row.ListPrice == null || row.ListPrice <= 0) {
      noPrice++
      continue
    }
    const after = pitiAt(row, ratePct)
    const before = row.estimated_monthly_piti == null ? null : Number(row.estimated_monthly_piti)
    if (before === after) {
      unchanged++
      continue
    }
    changes.push({ listNumber: row.ListNumber, listingKey: row.ListingKey, before, after })
  }

  console.log(`changed   ${changes.length}`)
  console.log(`unchanged ${unchanged}`)
  console.log(`no price  ${noPrice} (skipped — computeTier1 stores NULL PITI without a price)`)
  console.log('')

  if (changes.length > 0 && SAMPLE > 0) {
    console.log(`sample (first ${Math.min(SAMPLE, changes.length)} of ${changes.length}):`)
    console.log(`  ${'ListNumber'.padEnd(14)}${'before'.padStart(14)}${'after'.padStart(14)}${'delta'.padStart(14)}`)
    for (const c of changes.slice(0, SAMPLE)) {
      const delta = c.before != null && c.after != null ? c.after - c.before : null
      console.log(
        `  ${c.listNumber.padEnd(14)}${money(c.before).padStart(14)}${money(c.after).padStart(14)}${money(delta).padStart(14)}`,
      )
    }
    console.log('')
  }

  if (!APPLY) {
    console.log('DRY RUN — nothing written. Re-run with --apply to write these values.')
    return
  }

  console.log(`applying ${changes.length} updates at concurrency ${CONCURRENCY}...`)
  const { updated, failed } = await applyChanges(changes)
  console.log('')
  console.log(`updated   ${updated}`)
  console.log(`failed    ${failed}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
