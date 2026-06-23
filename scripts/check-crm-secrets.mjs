#!/usr/bin/env node
/**
 * ci:crm-secrets — CRM ops hardening gate (CONTACT360 Phase 9.8).
 *
 * Two production gaps this gate closes, both pure-scannable:
 *
 * (1) BOOT-VISIBLE CRM SECRETS. The CRM send/track paths sign tokens + gate cron
 *     routes with secret env vars (EMAIL_TRACKING_SECRET, CRON_SECRET). Today a
 *     missing EMAIL_TRACKING_SECRET silently falls back to the service-role key
 *     then 'insecure-dev-secret' (lib/email-tracking.ts / lib/email/
 *     unsubscribe-token.ts) — a forgeable-token risk that fails open and silent.
 *     This gate asserts every CRM secret referenced in a send/track path is
 *     LISTED in lib/env.ts (EnvSchema), so a missing one is visible at boot
 *     instead of degrading quietly. It FAILS when a CRM send/track path
 *     references a CRM secret that the env schema does not list — forcing the
 *     new secret to be added to the schema (and thus the boot-time check).
 *
 * (2) ORPHAN CRM CRONS. A cron route that exists under app/api/cron but is not
 *     registered in vercel.json never runs — it is dead infrastructure that
 *     looks alive. This gate lists every CRM cron route NOT in vercel.json. A
 *     NEW orphan FAILS the build; known orphans are recorded in
 *     scripts/crm-secrets-baseline.json (the count may only SHRINK — schedule or
 *     delete to reduce it). It does NOT invent schedules.
 *
 * This is a RATCHET. Baseline: scripts/crm-secrets-baseline.json.
 * Re-baseline (only to LOCK A WIN — wire/delete an orphan, then shrink):
 *   npm run ci:crm-secrets:baseline
 *
 * Usage: node scripts/check-crm-secrets.mjs [--report | --write-baseline]
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.cwd()
const BASELINE = join(ROOT, 'scripts/crm-secrets-baseline.json')
const ENV_SCHEMA = join(ROOT, 'lib/env.ts')
const VERCEL_JSON = join(ROOT, 'vercel.json')
const CRON_DIR = 'app/api/cron'

// The CRM send/track surface whose referenced secrets must be boot-visible.
// These are the modules + cron routes that sign tokens or gate sends/tracking.
const SEND_TRACK_FILES = [
  'lib/email-tracking.ts',
  'lib/email/unsubscribe-token.ts',
  'lib/auth/cron-auth.ts',
]
const SEND_TRACK_DIRS = ['lib/crm', 'lib/email', 'lib/data/leads']

// A "CRM secret" is a high-entropy signing/auth secret a CRM send/track path
// uses. Matching the NAME shape (ends in _SECRET, or the two canonical ones)
// keeps this a precise, low-noise ratchet — not every env var is a CRM secret.
// Public/config vars (NEXT_PUBLIC_*, *_URL, *_KEY for an external API) are NOT
// CRM signing secrets and are excluded so the gate stays high-signal.
const CRM_SECRET_RE = /^(?:EMAIL_TRACKING_SECRET|CRON_SECRET|CMA_PREVIEW_SECRET|[A-Z0-9]+_SIGNING_SECRET|[A-Z0-9]+_TRACKING_SECRET)$/

const ENV_REF_RE = /process\.env\.([A-Z][A-Z0-9_]*)/g

/**
 * Pure: every distinct env var a CRM send/track source references that looks
 * like a CRM signing secret. Sorted, de-duplicated. (testable)
 */
export function referencedSecrets(src) {
  const found = new Set()
  let m
  while ((m = ENV_REF_RE.exec(src)) !== null) {
    if (CRM_SECRET_RE.test(m[1])) found.add(m[1])
  }
  ENV_REF_RE.lastIndex = 0
  return [...found].sort()
}

/**
 * Pure: does the env-schema source list this var as a known EnvSchema key?
 * Matches a `NAME:` property line (the zod field) — a bare comment mention
 * does not count. (testable)
 */
export function listsEnvVar(envSrc, name) {
  // The var must appear as an object-property key (`NAME:`), not just a comment
  // mention. Allow it to follow a line start, `{`, `,`, or whitespace so it
  // matches whether EnvSchema is formatted one-key-per-line or inline.
  return new RegExp(`(?:^|[\\s{,])${name}\\s*:`).test(envSrc)
}

/**
 * Pure: given the env-schema source and a map of file -> referenced secrets,
 * return the unlisted (var, file) pairs. (testable)
 */
export function unlistedSecrets(envSrc, refsByFile) {
  const out = []
  for (const [file, secrets] of Object.entries(refsByFile)) {
    for (const name of secrets) {
      if (!listsEnvVar(envSrc, name)) out.push({ name, file })
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name) || a.file.localeCompare(b.file))
}

/**
 * Pure: cron route dirs (under app/api/cron) that are NOT registered in
 * vercel.json. `crmFilter` decides which routes this gate cares about. (testable)
 */
export function orphanCrons(cronDirs, registeredPaths, crmFilter) {
  const registered = new Set(registeredPaths)
  return cronDirs
    .filter((d) => crmFilter(d))
    .map((d) => `/api/cron/${d}`)
    .filter((p) => !registered.has(p))
    .sort()
}

/** Which cron routes are in this gate's CRM scope. */
function isCrmCron(dir) {
  return /^crm-|^seller-(workflow|lead)|^sync-delta$|^visitor-hot-lead/.test(dir)
}

function walk(dir, out = []) {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return out
  for (const name of readdirSync(abs)) {
    if (name === 'node_modules' || name === '.next') continue
    const rel = `${dir}/${name}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name)) out.push(rel)
  }
  return out
}

function sendTrackSources() {
  const files = new Set(SEND_TRACK_FILES)
  for (const d of SEND_TRACK_DIRS) for (const f of walk(d)) files.add(f)
  // Cron routes are send/track paths too (sequence engine, gmail sync, etc.).
  for (const f of walk(CRON_DIR)) if (isCrmCron(f.split('/')[3] ?? '')) files.add(f)
  return [...files].filter((f) => existsSync(join(ROOT, f))).sort()
}

function collectRefs() {
  const refsByFile = {}
  for (const rel of sendTrackSources()) {
    const secrets = referencedSecrets(readFileSync(join(ROOT, rel), 'utf8'))
    if (secrets.length) refsByFile[rel] = secrets
  }
  return refsByFile
}

function cronDirs() {
  const abs = join(ROOT, CRON_DIR)
  if (!existsSync(abs)) return []
  return readdirSync(abs).filter((d) => statSync(join(abs, d)).isDirectory())
}

function registeredCronPaths() {
  if (!existsSync(VERCEL_JSON)) return []
  try {
    const v = JSON.parse(readFileSync(VERCEL_JSON, 'utf8'))
    return (v.crons ?? []).map((c) => c.path)
  } catch {
    return []
  }
}

function loadBaseline() {
  if (!existsSync(BASELINE)) return { orphan_crons: [] }
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8'))
  } catch {
    return { orphan_crons: [] }
  }
}

function run(mode) {
  const envSrc = existsSync(ENV_SCHEMA) ? readFileSync(ENV_SCHEMA, 'utf8') : ''
  const refsByFile = collectRefs()
  const unlisted = unlistedSecrets(envSrc, refsByFile)
  const orphans = orphanCrons(cronDirs(), registeredCronPaths(), isCrmCron)

  if (mode === '--write-baseline') {
    writeFileSync(
      BASELINE,
      JSON.stringify(
        {
          note:
            'Known CRM cron routes present under app/api/cron but NOT registered in vercel.json (they never run). KNOWN DEBT pending schedule-or-delete. Count may only SHRINK. Regenerate with `npm run ci:crm-secrets:baseline`.',
          generated_by: 'check-crm-secrets.mjs --write-baseline',
          orphan_crons: orphans,
        },
        null,
        2,
      ) + '\n',
    )
    console.log(`crm-secrets: baseline written — ${orphans.length} known orphan cron(s).`)
    return 0
  }

  const referencedAll = [...new Set(Object.values(refsByFile).flat())].sort()

  if (mode === '--report') {
    console.log(`crm-secrets: ${referencedAll.length} CRM secret(s) referenced across send/track paths:`)
    referencedAll.forEach((s) => console.log(`  - ${s} ${listsEnvVar(envSrc, s) ? '(listed)' : '(UNLISTED)'}`))
    console.log(`\ncrm-secrets: ${orphans.length} CRM cron(s) not in vercel.json:`)
    orphans.forEach((p) => console.log(`  - ${p}`))
    return 0
  }

  const baseline = loadBaseline()
  const baseOrphans = new Set(baseline.orphan_crons ?? [])
  const newOrphans = orphans.filter((p) => !baseOrphans.has(p))
  const fixedOrphans = (baseline.orphan_crons ?? []).filter((p) => !orphans.includes(p))

  console.log('CRM secrets + orphan-cron gate (9.8)')
  console.log('====================================\n')
  console.log(`CRM secrets referenced in send/track paths: ${referencedAll.length}`)
  referencedAll.forEach((s) => console.log(`  ${listsEnvVar(envSrc, s) ? '✓' : '✗'} ${s}`))
  console.log(`\nCRM crons not in vercel.json (orphans): ${orphans.length} (baseline ${baseOrphans.size})`)
  orphans.forEach((p) => console.log(`  · ${p}${baseOrphans.has(p) ? '' : '   <- NEW'}`))

  const fails = []
  if (unlisted.length) {
    fails.push(
      `${unlisted.length} CRM secret(s) referenced in a send/track path are NOT listed in lib/env.ts (EnvSchema) — a missing one degrades silently instead of failing at boot:\n` +
        unlisted.map((u) => `      ${u.name}  (referenced in ${u.file})`).join('\n') +
        `\n  Add each to EnvSchema + the partition lists in lib/env.ts so its presence is checked at boot.`,
    )
  }
  if (newOrphans.length) {
    fails.push(
      `${newOrphans.length} NEW CRM cron route(s) exist under ${CRON_DIR} but are NOT registered in vercel.json (they never run):\n` +
        newOrphans.map((p) => `      ${p}`).join('\n') +
        `\n  Register a schedule in vercel.json, OR delete the dead route, OR (if intentionally manual) re-baseline: npm run ci:crm-secrets:baseline`,
    )
  }
  if (fixedOrphans.length) {
    fails.push(
      `${fixedOrphans.length} baselined orphan cron(s) are no longer orphaned (scheduled or removed):\n` +
        fixedOrphans.map((p) => `      ${p}`).join('\n') +
        `\n  Lock the win — the baseline may only shrink: npm run ci:crm-secrets:baseline`,
    )
  }

  if (fails.length) {
    console.error('\n✗ crm-secrets:\n\n  ' + fails.join('\n\n  ') + '\n')
    return 1
  }

  if (orphans.length) {
    console.log(
      `\n⚠ FLAGGED (baselined, non-blocking): ${orphans.length} CRM cron(s) registered nowhere in vercel.json — schedule or delete to clear:`,
    )
    orphans.forEach((p) => console.log(`    ${p}`))
  }
  console.log('\n✓ crm-secrets: every referenced CRM secret is boot-visible in lib/env.ts; no new orphan crons.')
  return 0
}

// Only execute when invoked directly, so a vitest can import the pure helpers.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(run(process.argv[2]))
}
