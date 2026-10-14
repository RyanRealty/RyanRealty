/**
 * Pure helpers for the hosted-migration Action
 * (.github/workflows/supabase-migrations.yml).
 *
 * The Action dry-runs `supabase db push` against production, logs every
 * pending file, then applies only the migrations in THAT push. It does not
 * pass `--include-all` on apply: pre-2026-10-01 MCP applies were recorded
 * under a different version than their files (docs/DATABASE_FOR_AI_AGENTS.md
 * §8.12), and `20261013180000_crm_suppressions_cleared.sql` stays a standing
 * hold. Already-applied SQL is repaired, not failed.
 */

export const PRODUCTION_PROJECT_REF = 'dwvlophlbvvygjfxcrhm'

/** Repo secrets the Action needs. Names only — never log values. */
export const REQUIRED_SECRETS = ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD']

/**
 * Filenames that must never be auto-applied, even if they are in the push.
 * Standing hold: docs/plans/handoffs/README.md.
 */
export const HOSTED_MIGRATION_HOLDS = Object.freeze([
  '20261013180000_crm_suppressions_cleared.sql',
])

const ZERO_SHA = /^0+$/

export function missingSecretNames(env = process.env) {
  return REQUIRED_SECRETS.filter((name) => !String(env[name] ?? '').trim())
}

export function missingSecretsMessage(names) {
  const list = names.join(', ')
  return [
    `Missing required GitHub Actions secrets: ${list}.`,
    'Matt must add each name under Settings → Secrets and variables → Actions.',
    'Do not put the values in chat, logs, or the issue body.',
  ].join(' ')
}

export function migrationVersion(file) {
  const base = String(file ?? '').split('/').pop() ?? ''
  const match = base.match(/^(\d{14})_/)
  return match?.[1] ?? ''
}

export function migrationFileName(file) {
  return String(file ?? '').split('/').pop() ?? ''
}

export function isHeldMigration(file) {
  return HOSTED_MIGRATION_HOLDS.includes(migrationFileName(file))
}

export function parsePendingMigrations(output) {
  const pending = []
  const seen = new Set()
  for (const rawLine of String(output ?? '').split(/\r?\n/)) {
    const line = rawLine.trim()
    const bullet = line.match(/^(?:[•*]|\d+\.)\s+(\S+\.sql)\s*$/)
    const bare = line.match(/^(\S+\.sql)\s*$/)
    const named = line.match(/\b([\w./-]+\.sql)\b/)
    const hit = bullet?.[1] ?? bare?.[1] ?? (line.includes('pending') ? named?.[1] : null)
    if (!hit) continue
    const name = migrationFileName(hit)
    if (!name.endsWith('.sql') || seen.has(name)) continue
    seen.add(name)
    pending.push(name)
  }
  return pending
}

export function parseThisPushMigrations(diffOutput) {
  const files = []
  const seen = new Set()
  for (const raw of String(diffOutput ?? '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line.startsWith('supabase/migrations/') || !line.endsWith('.sql')) continue
    const name = migrationFileName(line)
    if (seen.has(name)) continue
    seen.add(name)
    files.push(name)
  }
  return files
}

export function isZeroSha(sha) {
  return !sha || ZERO_SHA.test(String(sha).trim())
}

/**
 * Which pending files this run should apply.
 * - only files in the triggering push
 * - minus standing holds
 * - already-applied files are not pending, so they are not in the plan
 */
export function selectMigrationsToApply({ pending = [], thisPush = [] } = {}) {
  const pushSet = new Set(thisPush.map(migrationFileName))
  const apply = []
  const skippedHold = []
  const skippedNotInPush = []
  for (const file of pending.map(migrationFileName)) {
    if (isHeldMigration(file)) {
      skippedHold.push(file)
      continue
    }
    if (!pushSet.has(file)) {
      skippedNotInPush.push(file)
      continue
    }
    apply.push(file)
  }
  return { apply, skippedHold, skippedNotInPush }
}

const ALREADY_APPLIED =
  /already exists|duplicate (key|object)|already an object|conflicts with existing|already present/i

export function isAlreadyAppliedError(output) {
  return ALREADY_APPLIED.test(String(output ?? ''))
}

export function canLinearDbPush({ pending = [], apply = [] } = {}) {
  const pendingNames = pending.map(migrationFileName)
  const applySet = new Set(apply.map(migrationFileName))
  if (apply.length === 0 || pendingNames.length !== apply.length) return false
  if (pendingNames.some((name) => isHeldMigration(name))) return false
  return pendingNames.every((name) => applySet.has(name))
}

export function redactSecrets(text, env = process.env) {
  let out = String(text ?? '')
  for (const name of REQUIRED_SECRETS) {
    const value = String(env[name] ?? '').trim()
    if (value.length >= 4) out = out.split(value).join('***')
  }
  return out
}

export function splitSqlStatements(sql) {
  return String(sql ?? '')
    .split(/;\s*(?:\r?\n|$)/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.endsWith(';') ? part : `${part};`))
}

/** Drop comment-only statements the splitter can leave behind. */
export function executableSqlStatements(sql) {
  return splitSqlStatements(sql).filter((statement) => {
    const withoutComments = statement
      .split('\n')
      .map((line) => line.replace(/--.*$/, '').trim())
      .filter(Boolean)
      .join(' ')
    return withoutComments.length > 1
  })
}
