#!/usr/bin/env node
/**
 * check-newsletter-schema.mjs — gate G-NL-14 + the Phase 1 schema invariants
 * (spec §3.1). Newsletter send reliability + per-broker analytics rest on a set of
 * schema facts that, if wrong, break the build in ways prose can't catch:
 *
 *   • the newsletter_recipients status CHECK MUST allow 'queued' (+ 'skipped') or
 *     the Phase 3 queue is dead on arrival — every enqueue is rejected (audit A1).
 *   • the newsletters status CHECK MUST allow 'scheduled' + 'canceled' or the
 *     schedule/cancel lifecycle throws (audit C2).
 *   • the newsletter_recipient_events LEDGER must exist with a UNIQUE dedupe_key
 *     and a broker column, or open/click counts double-count on webhook redelivery
 *     and per-broker engagement analytics is impossible (T-2, §5).
 *   • newsletter_send_schedule must exist (the tranche drain reads it, §6.5).
 *   • newsletter_recipients must carry broker + tier (frozen broker + tier, §5/§6.5).
 *   • newsletter_subscribers must carry bounced_at / complained_at (observability).
 *
 * This is a STATIC gate: it reads supabase/migrations/*.sql, strips SQL comments
 * (so the DDL is checked, never a doc comment that merely mentions 'queued'), and
 * asserts each invariant against the FINAL declared state (last `add constraint`
 * wins, since migrations run in filename/timestamp order). It fails the build if an
 * invariant is missing or a later migration regresses it.
 *
 * It does NOT hit the DB — the authoritative live-schema check is the nightly
 * data-access gate (G16). This one keeps the migrations honest in the secret-less
 * CI chain so a regression is caught at PR time, not at send time.
 *
 * Usage:
 *   node scripts/check-newsletter-schema.mjs           # 0 = pass, 1 = fail
 *   node scripts/check-newsletter-schema.mjs --report   # human-readable, exit 0
 *   node scripts/check-newsletter-schema.mjs --json      # machine-readable
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.cwd()
const MIG_DIR = join(ROOT, 'supabase', 'migrations')

/** Strip SQL comments (-- to EOL and /* *​/ blocks) so matching sees DDL only. Pure. */
export function stripSqlComments(sql) {
  let out = ''
  let i = 0
  const n = sql.length
  let inLine = false
  let inBlock = false
  let inStr = false
  while (i < n) {
    const ch = sql[i]
    const next = i + 1 < n ? sql[i + 1] : ''
    if (inLine) {
      if (ch === '\n') { inLine = false; out += ch }
      i++
      continue
    }
    if (inBlock) {
      if (ch === '*' && next === '/') { inBlock = false; i += 2 } else i++
      continue
    }
    if (inStr) {
      out += ch
      if (ch === "'") inStr = false
      i++
      continue
    }
    if (ch === '-' && next === '-') { inLine = true; i += 2; continue }
    if (ch === '/' && next === '*') { inBlock = true; i += 2; continue }
    if (ch === "'") { inStr = true; out += ch; i++; continue }
    out += ch
    i++
  }
  return out
}

/** Load every migration's comment-stripped, lowercased SQL, in timestamp order. Pure-ish (reads fs). */
export function loadMigrations() {
  if (!existsSync(MIG_DIR)) return []
  return readdirSync(MIG_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ file: f, sql: stripSqlComments(readFileSync(join(MIG_DIR, f), 'utf8')).toLowerCase() }))
}

/** The FINAL `add constraint <name> ... ;` text across all migrations (last wins), or null. Pure. */
export function finalConstraint(migs, name) {
  const re = new RegExp(`add\\s+constraint\\s+${name}\\b[\\s\\S]*?;`, 'i')
  let found = null
  for (const { sql } of migs) {
    const m = sql.match(re)
    if (m) found = m[0]
  }
  return found
}

/** The migration files whose SQL creates `table <name>`. Pure. */
export function creators(migs, table) {
  const re = new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?(public\\.)?${table}\\b`, 'i')
  return migs.filter((m) => re.test(m.sql))
}

/** All migration SQL concatenated (comment-stripped, lowercased). Pure. */
export function allSql(migs) {
  return migs.map((m) => m.sql).join('\n')
}

/**
 * Compute every invariant check. Returns [{ id, desc, ok, detail }]. Pure over `migs`
 * so it is unit-testable without the fs.
 */
export function checkInvariants(migs) {
  const results = []
  const add = (id, desc, ok, detail) => results.push({ id, desc, ok, detail })

  // A1 — recipients status CHECK must allow 'queued' AND 'skipped'.
  const recCheck = finalConstraint(migs, 'newsletter_recipients_status_check')
  add(
    'A1-recipients-status-queued',
    "newsletter_recipients status CHECK allows 'queued' + 'skipped' (else the Phase 3 queue is dead on arrival)",
    !!recCheck && recCheck.includes("'queued'") && recCheck.includes("'skipped'"),
    recCheck ? `final add: ${recCheck.replace(/\s+/g, ' ').trim()}` : 'no add constraint newsletter_recipients_status_check found',
  )

  // C2 — newsletters status CHECK must allow 'scheduled' AND 'canceled'.
  const nlCheck = finalConstraint(migs, 'newsletters_status_check')
  add(
    'C2-newsletters-status-scheduled',
    "newsletters status CHECK allows 'scheduled' + 'canceled' (schedule/cancel lifecycle)",
    !!nlCheck && nlCheck.includes("'scheduled'") && nlCheck.includes("'canceled'"),
    nlCheck ? `final add: ${nlCheck.replace(/\s+/g, ' ').trim()}` : 'no add constraint newsletters_status_check found',
  )

  // T-2 / §5 — the engagement ledger must exist with a UNIQUE dedupe_key + broker.
  const ledger = creators(migs, 'newsletter_recipient_events')
  const ledgerSql = ledger.map((m) => m.sql).join('\n')
  add(
    'T2-ledger-table',
    'newsletter_recipient_events ledger exists with UNIQUE dedupe_key + broker column',
    ledger.length > 0 && /dedupe_key\b[\s\S]*?unique/.test(ledgerSql) && /\bbroker\b/.test(ledgerSql) && /\bevent\b/.test(ledgerSql),
    ledger.length ? `created in ${ledger.map((m) => m.file).join(', ')}` : 'no create table newsletter_recipient_events found',
  )

  // §6.5 — the tranche schedule table must exist with its per-issue-day-tier unique.
  const sched = creators(migs, 'newsletter_send_schedule')
  const schedSql = sched.map((m) => m.sql).join('\n')
  add(
    'S65-send-schedule-table',
    'newsletter_send_schedule exists with unique (newsletter_id, day_index, tier)',
    sched.length > 0 && /unique\s*\(\s*newsletter_id\s*,\s*day_index\s*,\s*tier\s*\)/.test(schedSql),
    sched.length ? `created in ${sched.map((m) => m.file).join(', ')}` : 'no create table newsletter_send_schedule found',
  )

  // §5 / §6.5 — recipients must gain broker + tier columns.
  const sql = allSql(migs)
  const recBrokerTier =
    /alter\s+table\s+(public\.)?newsletter_recipients[\s\S]*?add\s+column\s+(if\s+not\s+exists\s+)?broker\b/.test(sql) &&
    /alter\s+table\s+(public\.)?newsletter_recipients[\s\S]*?\btier\b/.test(sql)
  add('BT-recipients-broker-tier', 'newsletter_recipients gains broker + tier columns', recBrokerTier, recBrokerTier ? 'present' : 'missing broker and/or tier add-column on newsletter_recipients')

  // Observability — subscribers must gain bounced_at + complained_at.
  const subCols =
    /alter\s+table\s+(public\.)?newsletter_subscribers[\s\S]*?bounced_at/.test(sql) &&
    /alter\s+table\s+(public\.)?newsletter_subscribers[\s\S]*?complained_at/.test(sql)
  add('OBS-subscribers-bounce-cols', 'newsletter_subscribers gains bounced_at + complained_at', subCols, subCols ? 'present' : 'missing bounced_at and/or complained_at on newsletter_subscribers')

  return results
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const report = process.argv.includes('--report')
  const asJson = process.argv.includes('--json')
  const migs = loadMigrations()
  const results = checkInvariants(migs)
  const failed = results.filter((r) => !r.ok)

  if (asJson) {
    console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2))
    process.exit(report ? 0 : failed.length ? 1 : 0)
  }

  for (const r of results) {
    console.log(`${r.ok ? '✓' : '✗'} newsletter-schema ${r.id}: ${r.desc}`)
    if (!r.ok) console.log(`    → ${r.detail}`)
  }
  if (failed.length && !report) {
    console.error(`\n✗ newsletter-schema: ${failed.length} invariant(s) failed. Fix the Phase 1 migration(s) in supabase/migrations/.`)
    process.exit(1)
  }
  console.log(`\n✓ newsletter-schema: all ${results.length} Phase 1 schema invariants hold.`)
  process.exit(0)
}
