/**
 * Vault mail golden-set runner: replays `data/tc-mail-golden.json` through the
 * PRODUCTION filing decision — `indexGmailMessage(..., dryRun: true)`, the
 * exact path the 15-minute CRM Gmail sync and the daily sweep call — and
 * scores it against what the 2026-09-24 audit says should have happened.
 * READ-ONLY: Gmail is opened with the readonly scope only, every call passes
 * `dryRun: true` (asserted below, so a future edit cannot silently drop it),
 * and nothing in Supabase is written.
 *
 * Needs GOOGLE_SERVICE_ACCOUNT_* and SUPABASE_* in the process env, so this is
 * a local/nightly check, not part of the secret-less `ci:gates` chain — see
 * docs/TC_MAIL_FILING_RULES.md "Golden evaluation set".
 *
 *   npm run tc:mail-eval -- [--slice <name>] [--limit N] [--only-errors]
 *       [--concurrency N] [--baseline <file>] [--save-baseline <file>]
 *
 *   --slice <name>          Evaluate only one slice (filed-matt, filed-rp,
 *                            missed-notdeal, missed-bulk, deal-recall, queue).
 *   --limit N                Evaluate only the first N (post-filter) rows —
 *                            a smoke-test knob.
 *   --only-errors            Also print every row whose outcome is not TP,
 *                            TN or TP_QUEUE (mailbox + gmail_id + expect vs.
 *                            actual only — no content).
 *   --concurrency N           Gmail calls in flight at once (default 5).
 *   --baseline <file>         Compare this run's per-row outcomes against a
 *                            file `--save-baseline` wrote earlier, and print
 *                            every row whose outcome changed. Exits 1 if any
 *                            row got WORSE (§0: a rule change must not lower
 *                            precision or raise wrong-deal/false-file counts).
 *   --save-baseline <file>    Save this run's per-row outcomes (ids + outcome
 *                            only, no content) to `file`, so a later run can
 *                            `--baseline` against it.
 *
 * Full per-row results (still ids + outcome only) always land in
 * tmp/tc-mail-eval.json (gitignored).
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import Module from 'node:module'
import {
  scoreRow,
  summarizeBy,
  summarizeRows,
  type EvalOutcome,
  type EvalRow,
  type GoldenRow,
  type ProductionStatus,
  type Summary,
} from '@/lib/tc/mail-golden'

// Same require-hook pattern as scripts/tc-mail-backfill.ts: 'server-only' and
// 'next/cache' resolve to CLI-safe stubs BEFORE any module that imports them
// (lib/tc/mail-index.ts, lib/crm/gmail.ts's transitive deps) is required —
// which is why those are dynamic `await import()`s below, not static imports;
// a static import is hoisted above this patch and would fail to resolve.
const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
  const req = request === 'server-only' || request === 'client-only' ? STUB : request === 'next/cache' ? CACHE_STUB : request
  return resolveFilename.call(this, req, ...args)
}

const GOLDEN_PATH = path.resolve(__dirname, '../data/tc-mail-golden.json')
const OUT_PATH = path.resolve(__dirname, '../tmp/tc-mail-eval.json')
const READONLY = ['https://www.googleapis.com/auth/gmail.readonly']

/** Never flip this. `indexGmailMessage` is asserted below to have been called with it true. */
const DRY_RUN = true as const

function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i > 0 ? (process.argv[i + 1] ?? null) : null
}
const has = (name: string) => process.argv.includes(name)

function loadGolden(): GoldenRow[] {
  if (!fs.existsSync(GOLDEN_PATH)) {
    throw new Error(`${GOLDEN_PATH} does not exist — run: npx tsx scripts/tc-mail-golden-build.ts`)
  }
  const raw = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8')) as unknown
  if (!Array.isArray(raw)) throw new Error(`${GOLDEN_PATH} is not a JSON array`)
  return raw as GoldenRow[]
}

function isRetryable(message: string): boolean {
  return /\b429\b|rate limit|\b5\d\d\b|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(message)
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      if (i === attempts - 1 || !isRetryable(msg)) throw err
      const backoff = 500 * 2 ** i
      console.warn(`[tc-mail-eval] retryable error (${msg.slice(0, 140)}), attempt ${i + 2}/${attempts} in ${backoff}ms`)
      await new Promise((r) => setTimeout(r, backoff))
    }
  }
  throw lastErr
}

type BaselineRow = {
  mailbox: string
  gmail_id: string
  slice: string
  expect: GoldenRow['expect']
  outcome: EvalOutcome
  actual_status: ProductionStatus
  actual_deal_id: string | null
}

function fmtPct(n: number | null): string {
  return n == null ? 'n/a' : `${(n * 100).toFixed(1)}%`
}

function printRow(label: string, s: Summary) {
  console.log(
    `  ${label.padEnd(34)} n=${String(s.total).padStart(5)}  precision=${fmtPct(s.precision).padStart(7)}  recall=${fmtPct(s.recall).padStart(
      7,
    )}  wrong_deal=${String(s.wrongDeal).padStart(3)}  false_file=${String(s.falseFile).padStart(3)}  queue_rate=${fmtPct(s.queueRate).padStart(7)}`,
  )
}

function printSummaryTables(results: readonly EvalRow[]) {
  console.log('\n=== overall ===')
  printRow('all', summarizeRows(results))

  console.log('\n=== by slice ===')
  for (const [slice, s] of summarizeBy(results, (r) => r.slice)) printRow(slice, s)

  console.log('\n=== by mailbox ===')
  for (const [mailbox, s] of summarizeBy(results, (r) => r.mailbox)) printRow(mailbox, s)

  console.log('\n=== outcome counts (overall) ===')
  console.log(' ', summarizeRows(results).outcomes)
}

function saveBaseline(results: readonly EvalRow[], filePath: string) {
  const rows: BaselineRow[] = results
    .map((r) => ({ mailbox: r.mailbox, gmail_id: r.gmail_id, slice: r.slice, expect: r.expect, outcome: r.outcome, actual_status: r.actualStatus, actual_deal_id: r.actualDealId }))
    .sort((a, b) => (a.mailbox === b.mailbox ? a.gmail_id.localeCompare(b.gmail_id) : a.mailbox.localeCompare(b.mailbox)))
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, `${JSON.stringify(rows, null, 2)}\n`)
  console.log(`\n[tc-mail-eval] saved baseline (${rows.length} rows, outcomes only) to ${abs}`)
}

const GOOD_OUTCOMES: ReadonlySet<EvalOutcome> = new Set(['TP', 'TN', 'TP_QUEUE'])

function compareToBaseline(results: readonly EvalRow[], filePath: string) {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
  if (!fs.existsSync(abs)) {
    console.warn(`\n[tc-mail-eval] --baseline ${abs} does not exist — skipping comparison`)
    return
  }
  const baseline = JSON.parse(fs.readFileSync(abs, 'utf8')) as BaselineRow[]
  const byKey = new Map(baseline.map((r) => [`${r.mailbox}|${r.gmail_id}`, r]))
  let better = 0
  let worse = 0
  let unchanged = 0
  let notInBaseline = 0
  console.log(`\n=== baseline diff (${abs}) ===`)
  for (const r of results) {
    const prior = byKey.get(`${r.mailbox}|${r.gmail_id}`)
    if (!prior) {
      notInBaseline++
      continue
    }
    if (prior.outcome === r.outcome) {
      unchanged++
      continue
    }
    const wasGood = GOOD_OUTCOMES.has(prior.outcome)
    const isGood = GOOD_OUTCOMES.has(r.outcome)
    const verdict = isGood && !wasGood ? 'BETTER' : !isGood && wasGood ? 'WORSE' : 'CHANGED'
    if (verdict === 'BETTER') better++
    else if (verdict === 'WORSE') worse++
    console.log(`  [${verdict}] [${r.slice}] ${r.mailbox} ${r.gmail_id}: ${prior.outcome} -> ${r.outcome}`)
  }
  console.log(`\n[tc-mail-eval] baseline diff: ${better} better, ${worse} worse, ${unchanged} unchanged, ${notInBaseline} not in baseline`)
  if (worse > 0) {
    console.error(`[tc-mail-eval] ${worse} row(s) regressed — §0: a rule change must not lower precision or raise wrong-deal/false-file counts`)
    process.exitCode = 1
  }
}

async function main() {
  let golden = loadGolden()
  const sliceFilter = arg('--slice')
  if (sliceFilter) golden = golden.filter((r) => r.slice === sliceFilter)
  const limitArg = arg('--limit')
  if (limitArg) golden = golden.slice(0, Number(limitArg))
  if (!golden.length) {
    console.error('[tc-mail-eval] no golden rows match the given filters')
    process.exit(2)
  }
  const onlyErrors = has('--only-errors')
  const concurrency = Math.max(1, Math.min(6, Number(arg('--concurrency') ?? 5)))

  const { CRM_MAILBOXES, getGmailFor } = await import('@/lib/crm/gmail')
  const { indexGmailMessage, loadMailUniverse } = await import('@/lib/tc/mail-index')
  const { createServiceClient } = await import('@/lib/supabase/service')

  const sb = createServiceClient()
  console.log('[tc-mail-eval] loading the deal universe...')
  const universe = await loadMailUniverse(sb)
  console.log(`[tc-mail-eval] ${universe.deals.length} deals loaded`)

  const slugByEmail = new Map(CRM_MAILBOXES.map((m) => [m.email, m.slug] as const))
  const gmailByMailbox = new Map<string, NonNullable<ReturnType<typeof getGmailFor>>>()
  for (const email of new Set(golden.map((r) => r.mailbox))) {
    if (!slugByEmail.has(email)) {
      console.error(`[tc-mail-eval] golden row names mailbox "${email}", which is not in CRM_MAILBOXES`)
      process.exit(2)
    }
    const gmail = getGmailFor(email, READONLY)
    if (!gmail) {
      console.error(`[tc-mail-eval] no Gmail credentials for ${email} — is GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL / _PRIVATE_KEY set?`)
      process.exit(2)
    }
    gmailByMailbox.set(email, gmail)
  }

  console.log(
    `[tc-mail-eval] evaluating ${golden.length} golden rows, concurrency ${concurrency}${sliceFilter ? `, slice=${sliceFilter}` : ''}${
      limitArg ? `, limit=${limitArg}` : ''
    }`,
  )

  const results: EvalRow[] = []
  let done = 0
  let errors = 0
  const todo = [...golden]

  async function worker() {
    while (todo.length) {
      const g = todo.shift()!
      const gmail = gmailByMailbox.get(g.mailbox)!
      const brokerSlug = slugByEmail.get(g.mailbox)!
      let actualStatus: ProductionStatus
      let actualDealId: string | null
      try {
        const result = await withRetry(() =>
          indexGmailMessage({
            gmail,
            mailbox: g.mailbox,
            brokerSlug,
            gmailId: g.gmail_id,
            universe,
            dryRun: DRY_RUN,
            sb,
          }),
        )
        if (!DRY_RUN) throw new Error('tc-mail-eval: dryRun must always be true — refusing to trust a non-dry-run result')
        actualStatus = result.status as ProductionStatus
        actualDealId = result.dealId ?? null
      } catch (err) {
        actualStatus = 'error'
        actualDealId = null
        errors++
        console.warn(`[tc-mail-eval] ${g.mailbox} ${g.gmail_id}: ${err instanceof Error ? err.message : String(err)}`)
      }
      const outcome = scoreRow({ expect: g.expect, expectedDealId: g.deal_id, actualStatus, actualDealId })
      results.push({
        mailbox: g.mailbox,
        gmail_id: g.gmail_id,
        slice: g.slice,
        confidence: g.confidence,
        expect: g.expect,
        expectedDealId: g.deal_id,
        actualStatus,
        actualDealId,
        outcome,
      })
      done++
      if (done % 50 === 0) console.log(`[tc-mail-eval] ${done}/${golden.length} evaluated (${errors} errors so far)`)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2))
  console.log(`\n[tc-mail-eval] wrote ${OUT_PATH} (${results.length} rows, ${errors} errors)`)

  printSummaryTables(results)

  if (onlyErrors) {
    const bad = results.filter((r) => !GOOD_OUTCOMES.has(r.outcome))
    console.log(`\n[tc-mail-eval] ${bad.length} non-clean row(s):`)
    for (const r of bad) {
      console.log(
        `  [${r.slice}] ${r.mailbox} ${r.gmail_id}: expect=${r.expect}(${r.expectedDealId ?? 'null'}) actual=${r.actualStatus}(${r.actualDealId ?? 'null'}) -> ${r.outcome}`,
      )
    }
  }

  const baselinePath = arg('--baseline')
  if (baselinePath) compareToBaseline(results, baselinePath)

  const saveBaselinePath = arg('--save-baseline')
  if (saveBaselinePath) saveBaseline(results, saveBaselinePath)
}

main().catch((err) => {
  console.error('[tc-mail-eval] failed:', err instanceof Error ? err.stack ?? err.message : err)
  process.exitCode = 1
})
