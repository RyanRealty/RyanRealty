/**
 * int-scope — the test-residue contract for `*.int.test.ts`.
 *
 * THE DEFECT (found 2026-07-30): integration tests write to the PRODUCTION
 * Supabase project. 17 rows in `public.cmas` with slugs like
 * `cma-582798-zztest-probe` had to be archived by hand; five were sitting in
 * `delivered` status and were inflating the count of documents actually sent to
 * clients. Real business data polluted by test runs, plus CMA build-worker
 * capacity consumed by phantom documents.
 *
 * WHY per-test teardown is not enough: every writing int test already has an
 * `afterAll` that deletes what it seeded. `afterAll` does not run when the
 * process is SIGKILLed, and this repo's test runs DO get killed (subagent
 * limits, pre-commit timeouts, sibling sessions). The residue survey on
 * 2026-07-30 found stranded rows in seven tables, including three
 * `marketing_brain_actions` rows stuck in `in_production` from a test whose
 * cleanup lives in a `finally` block. A crash-time hook cannot be the only net.
 *
 * WHY not block writes from a test context: nine of thirteen int tests exist
 * precisely to verify DB write contracts against real unique indexes, real
 * RPCs, and real triggers (the upsert-by-slug clobber guard, the
 * case-insensitive suppression lookup, the newsletter opt-out gate). Refusing
 * writes would delete the tests, not fix them.
 *
 * THE CONTRACT instead:
 *   1. Every identifier an int test writes — or feeds to production code that
 *      derives a row from it — contains INT_MARKER. Never hand-rolled: it comes
 *      from intId()/intEmail()/intAddress(), so there is exactly one spelling
 *      to sweep for (there were four before: `zztest`, `zz-test`, `Zztest`,
 *      `nl-oneoff`).
 *   2. Every table an int test writes is registered in INT_SWEEP_TARGETS.
 *   3. A sweep runs at the START of every int run (removing anything a killed
 *      run stranded) and again at teardown (removing this run's rows even when
 *      tests failed). Start-of-run is the crash-proof half: it does not depend
 *      on the previous run having survived.
 *
 * Residue is therefore bounded to "until the next int run" instead of forever,
 * and cannot accumulate. Enforced mechanically by
 * `scripts/check-int-test-residue.mjs` (ci:int-test-residue).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The ONE spelling. Deliberately unlike anything a real Bend address, client
 * name, slug, or subject line would contain, so an ILIKE sweep for it cannot
 * touch production data.
 */
export const INT_MARKER = 'zztest'

/**
 * Unique per int RUN (not per worker). Set by vitest.config.ts so every worker
 * process in a run shares it; two concurrent runs (sibling agent sessions) get
 * different values and cannot collide on unique indexes. The fallback keeps
 * direct `vitest run <file>` invocations working.
 */
export const INT_RUN_ID: string =
  process.env.RR_INT_RUN_ID?.trim() || `local${Date.now().toString(36)}${process.pid.toString(36)}`

/**
 * A slug/name-safe identifier: `zztest-<label>-<runId>`.
 * Lower-case and hyphenated so it survives address slugification unchanged.
 */
export function intId(label: string): string {
  const safe = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${INT_MARKER}-${safe}-${INT_RUN_ID}`
}

/** An address whose slugified form still carries the marker. */
export function intAddress(label: string, city = 'Bend'): string {
  return `${intId(label)} St, ${city}`
}

/**
 * An email on the reserved `.invalid` TLD (RFC 2606) — never routable, so a
 * stranded subscriber row can never become a real send.
 */
export function intEmail(label: string): string {
  return `${intId(label)}@${INT_MARKER}.invalid`
}

/** A table the sweep must clear, plus the text columns that carry the marker. */
export type SweepTarget = {
  table: string
  /** Text columns matched with ILIKE `%zztest%`. */
  markerColumns: string[]
  /** Timestamp column for the age window. Every registered table has one. */
  createdAt: string
  /**
   * Primary key. Not always `id`: crm_idempotency_keys is keyed on `key`, and
   * selecting a column that does not exist returns `data: null` with an error,
   * which reads exactly like "no rows" if you skip the error check.
   */
  idColumn?: string
  /**
   * Rows in these tables reference the parent row and must go first (FK order).
   * `fk` is the child column holding the parent's key.
   */
  children?: { table: string; fk: string }[]
}

/**
 * Every table an int test writes, directly or through the production code path
 * it exercises. `scripts/check-int-test-residue.mjs` fails the build if a test
 * writes a table that is not listed here — the registry cannot silently fall
 * behind the tests.
 *
 * Order matters: parents whose children are listed sweep their children first.
 */
export const INT_SWEEP_TARGETS: SweepTarget[] = [
  {
    // Written directly (seeded documents) and indirectly (createCmaRequest,
    // the CRM kick-off path) from a marked subject address.
    table: 'cmas',
    markerColumns: ['slug', 'subject_address', 'client_name', 'client_email', 'generation_reason'],
    createdAt: 'created_at',
    children: [
      { table: 'cma_comps', fk: 'cma_id' },
      { table: 'cma_document_registrations', fk: 'cma_id' },
    ],
  },
  {
    table: 'broker_price_opinions',
    markerColumns: ['slug', 'subject_address', 'build_error'],
    createdAt: 'created_at',
  },
  {
    // Queued by the CMA intake path, and seeded directly by the versions +
    // deliverable-library tests.
    table: 'marketing_brain_actions',
    markerColumns: ['target', 'topic', 'hook', 'generated_by'],
    createdAt: 'created_at',
  },
  {
    table: 'crm_people',
    markerColumns: ['first_name', 'last_name', 'name', 'source'],
    createdAt: 'created_at',
    children: [{ table: 'crm_timeline', fk: 'person_id' }],
  },
  {
    // Keys are `<scope>:<personId>:<idempotencyKey>`; the key half is marked.
    table: 'crm_idempotency_keys',
    markerColumns: ['key'],
    createdAt: 'created_at',
    idColumn: 'key',
  },
  {
    table: 'newsletter_subscribers',
    markerColumns: ['email', 'name', 'source'],
    createdAt: 'created_at',
  },
  {
    table: 'newsletters',
    markerColumns: ['subject', 'created_by'],
    createdAt: 'created_at',
    children: [
      { table: 'newsletter_recipients', fk: 'newsletter_id' },
      { table: 'newsletter_send_schedule', fk: 'newsletter_id' },
    ],
  },
]

/** Storage buckets an int test writes into; objects are swept by path prefix. */
export const INT_SWEEP_BUCKETS = ['marketing-deliverables']

export type SweepReport = {
  swept: { table: string; rows: number }[]
  errors: { table: string; message: string }[]
}

type SweepWindow =
  /** Clear anything a previous (possibly killed) run stranded. */
  | { mode: 'stale'; olderThanMinutes: number }
  /** Clear rows created since this run started, however the run ended. */
  | { mode: 'since'; sinceIso: string }

function orFilter(cols: string[]): string {
  return cols.map((c) => `${c}.ilike.*${INT_MARKER}*`).join(',')
}

/**
 * Delete every marker-bearing row in the registry inside the given time window.
 *
 * The window is what makes the sweep safe to run while a sibling agent session
 * has its own int run in flight: `stale` only touches rows old enough that no
 * live test could still need them, and `since` only touches rows created after
 * this run began.
 */
export async function sweepIntResidue(sb: SupabaseClient, window: SweepWindow): Promise<SweepReport> {
  const report: SweepReport = { swept: [], errors: [] }
  const cutoff =
    window.mode === 'stale'
      ? new Date(Date.now() - window.olderThanMinutes * 60_000).toISOString()
      : window.sinceIso

  for (const target of INT_SWEEP_TARGETS) {
    const idCol = target.idColumn ?? 'id'
    // 1. Find the marked parent rows inside the window.
    let q = sb.from(target.table).select(idCol).or(orFilter(target.markerColumns))
    q = window.mode === 'stale' ? q.lt(target.createdAt, cutoff) : q.gte(target.createdAt, cutoff)
    const { data, error } = await q.limit(2000)
    if (error) {
      report.errors.push({ table: target.table, message: error.message })
      continue
    }
    // `select()` with a runtime-chosen column defeats supabase-js's literal-type
    // inference, so the row type has to be widened explicitly.
    const rows = (data ?? []) as unknown as Record<string, unknown>[]
    const ids = rows.map((r) => r[idCol]).filter((v) => v != null)
    if (!ids.length) continue

    // 2. Children first — a parent delete would fail on the FK otherwise.
    for (const child of target.children ?? []) {
      const { error: childErr } = await sb.from(child.table).delete().in(child.fk, ids)
      if (childErr) report.errors.push({ table: child.table, message: childErr.message })
    }

    // 3. Then the parents.
    const { error: delErr } = await sb.from(target.table).delete().in(idCol, ids)
    if (delErr) {
      report.errors.push({ table: target.table, message: delErr.message })
      continue
    }
    report.swept.push({ table: target.table, rows: ids.length })
  }

  // 4. Storage objects. Buckets carry no timestamps we can window on, so the
  //    marker prefix alone is the filter — a real broker folder never has one.
  for (const bucket of INT_SWEEP_BUCKETS) {
    const { data: roots, error } = await sb.storage.from(bucket).list('', { limit: 1000 })
    if (error) {
      report.errors.push({ table: `storage:${bucket}`, message: error.message })
      continue
    }
    const marked = (roots ?? []).filter((o) => o.name.toLowerCase().includes(INT_MARKER))
    let removed = 0
    for (const folder of marked) {
      const { data: objects } = await sb.storage.from(bucket).list(folder.name, { limit: 1000 })
      const paths = (objects ?? []).map((o) => `${folder.name}/${o.name}`)
      if (!paths.length) continue
      const { error: rmErr } = await sb.storage.from(bucket).remove(paths)
      if (rmErr) report.errors.push({ table: `storage:${bucket}`, message: rmErr.message })
      else removed += paths.length
    }
    if (removed) report.swept.push({ table: `storage:${bucket}`, rows: removed })
  }

  return report
}
