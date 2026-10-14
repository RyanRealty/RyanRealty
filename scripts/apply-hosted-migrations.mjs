#!/usr/bin/env node
/**
 * Dry-run then apply hosted Supabase migrations for a push to main.
 *
 * Used by .github/workflows/supabase-migrations.yml. Never prints secret
 * values. Missing secrets are listed by name so Matt can add them.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import {
  PRODUCTION_PROJECT_REF,
  canLinearDbPush,
  executableSqlStatements,
  isAlreadyAppliedError,
  isZeroSha,
  missingSecretNames,
  missingSecretsMessage,
  migrationFileName,
  migrationVersion,
  parsePendingMigrations,
  parseThisPushMigrations,
  redactSecrets,
  selectMigrationsToApply,
} from './lib/hosted-migrations.mjs'

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF?.trim() || PRODUCTION_PROJECT_REF
const BEFORE_SHA = process.env.BEFORE_SHA ?? process.env.GITHUB_EVENT_BEFORE ?? ''
const AFTER_SHA = process.env.AFTER_SHA ?? process.env.GITHUB_SHA ?? 'HEAD'
const ROOT = process.cwd()

function supabaseBin() {
  const fromEnv = process.env.SUPABASE_BIN?.trim()
  if (!fromEnv) return ['npx', 'supabase']
  return fromEnv.split(/\s+/).filter(Boolean)
}

function run(command, args, { allowFail = false } = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    cwd: ROOT,
    env: process.env,
  })
  const output = redactSecrets(`${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim())
  if (result.status !== 0 && !allowFail) {
    const error = new Error(`${command} ${args.join(' ')} failed`)
    error.output = output
    error.status = result.status ?? 1
    throw error
  }
  return { status: result.status ?? 0, output }
}

function supabase(args, opts) {
  const bin = supabaseBin()
  return run(bin[0], [...bin.slice(1), ...args], opts)
}

function ensureConfig() {
  const path = join(ROOT, 'supabase', 'config.toml')
  if (existsSync(path)) return
  mkdirSync(join(ROOT, 'supabase'), { recursive: true })
  writeFileSync(path, `project_id = "${PROJECT_REF}"\n`, 'utf8')
  console.log('Wrote a minimal supabase/config.toml for CI link (not committed).')
}

function thisPushFiles() {
  if (isZeroSha(BEFORE_SHA)) {
    const range = AFTER_SHA && AFTER_SHA !== 'HEAD' ? AFTER_SHA : 'HEAD'
    const result = run('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', range, '--', 'supabase/migrations/'], {
      allowFail: true,
    })
    return parseThisPushMigrations(result.output)
  }
  if (!BEFORE_SHA) {
    console.log('No BEFORE_SHA (workflow_dispatch). Dry-run only; nothing to apply.')
    return []
  }
  const result = run(
    'git',
    ['diff', '--name-only', '--diff-filter=ACMR', `${BEFORE_SHA}...${AFTER_SHA}`, '--', 'supabase/migrations/'],
    { allowFail: true },
  )
  return parseThisPushMigrations(result.output)
}

function dryRunPending() {
  const linear = supabase(['db', 'push', '--dry-run', '--yes', '-p', process.env.SUPABASE_DB_PASSWORD], {
    allowFail: true,
  })
  console.log('=== supabase db push --dry-run ===')
  console.log(linear.output || '(no output)')
  if (linear.status === 0) {
    return { pending: parsePendingMigrations(linear.output), linearOk: true, output: linear.output }
  }

  const all = supabase(
    ['db', 'push', '--dry-run', '--include-all', '--yes', '-p', process.env.SUPABASE_DB_PASSWORD],
    { allowFail: true },
  )
  console.log('=== supabase db push --dry-run --include-all (linear dry-run failed) ===')
  console.log(all.output || '(no output)')
  const pending = parsePendingMigrations(`${all.output}\n${linear.output}`)
  return { pending, linearOk: false, output: all.output || linear.output }
}

async function runSql(sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Apikey: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  const text = redactSecrets(await res.text())
  return { ok: res.ok, status: res.status, text }
}

function repairApplied(version) {
  const result = supabase(
    ['migration', 'repair', version, '--status', 'applied', '--yes', '-p', process.env.SUPABASE_DB_PASSWORD],
    { allowFail: true },
  )
  console.log(`migration repair ${version} applied:`)
  console.log(result.output || '(no output)')
  if (result.status === 0 || isAlreadyAppliedError(result.output)) return
  throw Object.assign(new Error(`migration repair ${version} failed`), { output: result.output })
}

async function applyFile(file) {
  const rel = join('supabase', 'migrations', migrationFileName(file))
  const sql = readFileSync(join(ROOT, rel), 'utf8')
  const statements = executableSqlStatements(sql)
  console.log(`Applying ${rel} (${statements.length} statement(s))`)
  for (const statement of statements) {
    const result = await runSql(statement)
    if (result.ok) continue
    if (isAlreadyAppliedError(result.text)) {
      console.log(`Already applied (tolerated): ${rel}`)
      continue
    }
    throw Object.assign(new Error(`SQL failed for ${rel} (HTTP ${result.status})`), {
      output: result.text,
    })
  }
  const version = migrationVersion(file)
  if (!version) throw new Error(`No 14-digit version in ${file}`)
  repairApplied(version)
}

function applyLinearPush(apply) {
  const result = supabase(['db', 'push', '--yes', '-p', process.env.SUPABASE_DB_PASSWORD], {
    allowFail: true,
  })
  console.log('=== supabase db push ===')
  console.log(result.output || '(no output)')
  if (result.status === 0) return
  if (!isAlreadyAppliedError(result.output)) {
    throw Object.assign(new Error('supabase db push failed'), { output: result.output })
  }
  console.log('db push hit already-applied SQL; repairing those versions and retrying.')
  for (const file of apply) {
    const version = migrationVersion(file)
    if (version) repairApplied(version)
  }
  const retry = supabase(['db', 'push', '--yes', '-p', process.env.SUPABASE_DB_PASSWORD], {
    allowFail: true,
  })
  console.log('=== supabase db push (retry after repair) ===')
  console.log(retry.output || '(no output)')
  if (retry.status === 0 || isAlreadyAppliedError(retry.output)) return
  throw Object.assign(new Error('supabase db push failed after already-applied repair'), {
    output: retry.output,
  })
}

function writeSummary(lines) {
  const path = process.env.GITHUB_STEP_SUMMARY
  if (!path) {
    console.log(lines.join('\n'))
    return
  }
  writeFileSync(path, `${lines.join('\n')}\n`, { flag: 'a' })
}

async function main() {
  const missing = missingSecretNames()
  if (missing.length) {
    const message = missingSecretsMessage(missing)
    console.error(message)
    writeSummary(['## Hosted migrations', '', message])
    process.exit(2)
  }

  ensureConfig()
  console.log(`Linking project ${PROJECT_REF} (password and token not printed).`)
  const linked = supabase(['link', '--project-ref', PROJECT_REF, '-p', process.env.SUPABASE_DB_PASSWORD, '--yes'], {
    allowFail: true,
  })
  console.log(linked.output || '(link produced no output)')
  if (linked.status !== 0) {
    throw Object.assign(new Error('supabase link failed'), { output: linked.output })
  }

  const { pending, linearOk } = dryRunPending()
  console.log(`Pending migrations (${pending.length}):`)
  for (const file of pending) console.log(` - ${file}`)
  if (pending.length === 0) console.log(' - (none)')

  const thisPush = thisPushFiles()
  console.log(`Migrations in this push (${thisPush.length}):`)
  for (const file of thisPush) console.log(` - ${file}`)
  if (thisPush.length === 0) console.log(' - (none)')

  const plan = selectMigrationsToApply({ pending, thisPush })
  if (plan.skippedHold.length) {
    console.log('Skipped standing holds:')
    for (const file of plan.skippedHold) console.log(` - ${file}`)
  }
  if (plan.skippedNotInPush.length) {
    console.log('Pending but not in this push (not applied; historical mismatch or hand apply):')
    for (const file of plan.skippedNotInPush) console.log(` - ${file}`)
  }

  writeSummary([
    '## Hosted migrations',
    '',
    `Project: \`${PROJECT_REF}\``,
    `Dry-run pending: ${pending.length ? pending.map((f) => `\`${f}\``).join(', ') : '(none)'}`,
    `This push: ${thisPush.length ? thisPush.map((f) => `\`${f}\``).join(', ') : '(none)'}`,
    `Applying: ${plan.apply.length ? plan.apply.map((f) => `\`${f}\``).join(', ') : '(none)'}`,
  ])

  if (plan.apply.length === 0) {
    console.log('Nothing to apply. Already-applied or not in this push. Success.')
    return
  }

  if (linearOk && canLinearDbPush({ pending, apply: plan.apply })) {
    applyLinearPush(plan.apply)
    console.log('Applied via supabase db push.')
    return
  }

  console.log('Applying this-push files individually (linear db push would include other pending files).')
  for (const file of plan.apply) await applyFile(file)
  console.log('Applied this-push migrations.')
}

main().catch((err) => {
  const output = redactSecrets(err?.output ?? err?.message ?? String(err))
  console.error(output)
  writeSummary(['## Hosted migrations failed', '', '```', output, '```'])
  process.exit(err?.status === 2 ? 2 : 1)
})
