/**
 * A database write the app issued and Postgres refused must leave one line in
 * the logs naming the table, the column, and the value that was refused.
 *
 * Why this exists (2026-10-15). Three writers lost data for weeks because the
 * refusal was swallowed: the Resend webhook's `crm_timeline` upserts never read
 * `error` (418 rows in one day failed `crm_timeline_kind_check`), the CMA reply
 * stamp read `error` only to return false, and the delta sync's `sync_history`
 * insert returned `{ ok: false }` to a caller that ignored it (94 rows in one
 * day failed `sync_history_run_type_check`). Nothing in app logs said so; the
 * only trace was Postgres's own log.
 *
 * What is logged: the table, the column, the rejected value (a closed
 * vocabulary word like `email_delivered` or `delta`, never free text), the
 * Postgres error code, and the constraint-level message. NEVER the row, the
 * payload, an email address, a phone number, or the PostgREST `details` string
 * (which prints the whole failing row).
 *
 * Pure, dependency-free, no `server-only`: unit-testable and safe to import
 * from a route, a server action or the DAL.
 */

/** The slice of a PostgREST / supabase-js error this helper reads. */
export type WriteError = {
  code?: string | null
  message?: string | null
} | null | undefined

export type RejectedWrite = {
  table: string
  /** The constrained column whose value was refused. */
  column: string
  /** The refused value. Pass only closed-vocabulary words, never free text. */
  value: string
  error: WriteError
}

/** Postgres SQLSTATE for `check_violation`. */
export const PG_CHECK_VIOLATION = '23514'
/** Postgres SQLSTATE for `unique_violation`. */
export const PG_UNIQUE_VIOLATION = '23505'

/** Longest message kept. A constraint-level message is well under this. */
const MAX_MESSAGE = 200

/**
 * Log one rejected write. `seen` makes it once-per-key for a caller that loops
 * (a webhook fanning one event out to several people would otherwise print the
 * same line per person): pass one Set per request and the key is
 * `table.column=value:code`. Returns true when a line was written.
 */
export function logRejectedWrite(
  scope: string,
  write: RejectedWrite,
  seen?: Set<string>,
): boolean {
  const code = write.error?.code ?? 'unknown'
  const key = `${write.table}.${write.column}=${write.value}:${code}`
  if (seen) {
    if (seen.has(key)) return false
    seen.add(key)
  }
  const message = String(write.error?.message ?? '').slice(0, MAX_MESSAGE)
  console.error(
    `[${scope}] write rejected: table=${write.table} column=${write.column} value=${write.value} code=${code}${message ? ` message="${message}"` : ''}`,
  )
  return true
}
