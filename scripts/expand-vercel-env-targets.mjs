#!/usr/bin/env node
// Expand Vercel project env var targets via the Vercel REST API.
//
// Background:
//   The Vercel CLI (50.38.3 and 53.3.1) demands a positional <gitbranch>
//   argument when adding an env var to the `preview` target via a non-
//   interactive shell, even with `--yes --value --force --sensitive`. The
//   REST API has no such requirement. This script reads the CLI auth token
//   from ~/Library/Application Support/com.vercel.cli/auth.json plus the
//   project + team ids from .vercel/project.json, then PATCHes existing env
//   var records to add `preview` and `development` to their `target` array.
//   Result: the same encrypted value, now visible in three environments.
//
// Default behaviour: expand the three GA4 service account vars
// (GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
// GOOGLE_SERVICE_ACCOUNT_SUBJECT) so the marketing optimization cron can
// reach the GA4 Data API in preview/dev too.
//
// Usage:
//   node scripts/expand-vercel-env-targets.mjs
//   node scripts/expand-vercel-env-targets.mjs --keys FOO,BAR
//   node scripts/expand-vercel-env-targets.mjs --targets preview,development
//   node scripts/expand-vercel-env-targets.mjs --dry-run

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

// ── config ─────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2))
const REPO_ROOT = process.cwd()
const PROJECT_FILE = resolve(REPO_ROOT, '.vercel/project.json')
const AUTH_FILE = join(homedir(), 'Library', 'Application Support', 'com.vercel.cli', 'auth.json')

const DEFAULT_KEYS = [
  'GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL',
  'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
  'GOOGLE_SERVICE_ACCOUNT_SUBJECT',
]

const KEYS = (args.keys ? args.keys.split(',') : DEFAULT_KEYS).map((k) => k.trim()).filter(Boolean)
const TARGETS_TO_ADD = (args.targets ? args.targets.split(',') : ['preview', 'development']).map((t) => t.trim()).filter(Boolean)
const DRY_RUN = Boolean(args['dry-run'])

const VALID_TARGETS = new Set(['production', 'preview', 'development'])
for (const t of TARGETS_TO_ADD) {
  if (!VALID_TARGETS.has(t)) {
    console.error(`Invalid target: ${t}. Valid targets: production, preview, development`)
    process.exit(1)
  }
}

// ── boot ───────────────────────────────────────────────────────────────────

const { projectId, orgId } = JSON.parse(readFileSync(PROJECT_FILE, 'utf8'))
const { token } = JSON.parse(readFileSync(AUTH_FILE, 'utf8'))
if (!token) {
  console.error('No Vercel CLI auth token found. Run `vercel login` first.')
  process.exit(1)
}

const HEADERS = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
}

const BASE = `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}`
const TEAM_QS = orgId ? `teamId=${encodeURIComponent(orgId)}` : ''

console.log(`project_id=${projectId}`)
console.log(`team_id=${orgId}`)
console.log(`keys=${KEYS.join(', ')}`)
console.log(`adding_targets=${TARGETS_TO_ADD.join(', ')}`)
console.log(`dry_run=${DRY_RUN}`)
console.log('')

const envList = await fetchJson(`${BASE}/env?${TEAM_QS}`)
const records = Array.isArray(envList?.envs) ? envList.envs : []

let changed = 0
let skipped = 0
let missing = 0
const failures = []

for (const key of KEYS) {
  // A given key can have multiple env-var records, each with its own target
  // array. We expand every record so all known instances of the key are
  // available in the requested targets.
  const matches = records.filter((r) => r.key === key)
  if (matches.length === 0) {
    console.log(`[MISS] ${key} — not found in project env list`)
    missing += 1
    continue
  }
  for (const record of matches) {
    const currentTargets = Array.isArray(record.target) ? record.target : []
    const merged = Array.from(new Set([...currentTargets, ...TARGETS_TO_ADD]))
    if (merged.length === currentTargets.length) {
      console.log(`[SKIP] ${key} (id=${record.id}) — already has ${TARGETS_TO_ADD.join(' + ')}`)
      skipped += 1
      continue
    }
    if (DRY_RUN) {
      console.log(`[DRY ] ${key} (id=${record.id}) — would expand ${currentTargets.join('+') || '(none)'} → ${merged.join('+')}`)
      changed += 1
      continue
    }
    try {
      const updated = await fetchJson(`${BASE}/env/${encodeURIComponent(record.id)}?${TEAM_QS}`, {
        method: 'PATCH',
        body: JSON.stringify({ target: merged }),
      })
      const newTargets = Array.isArray(updated?.target) ? updated.target : merged
      console.log(`[OK  ] ${key} (id=${record.id}) — targets now ${newTargets.join('+')}`)
      changed += 1
    } catch (err) {
      console.log(`[FAIL] ${key} (id=${record.id}) — ${err.message}`)
      failures.push({ key, id: record.id, error: err.message })
    }
  }
}

console.log('')
console.log(`Result: ${changed} changed, ${skipped} skipped, ${missing} missing, ${failures.length} failed`)

if (failures.length > 0) process.exit(2)
if (missing === KEYS.length) process.exit(3)

// ── helpers ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[key] = next
      i += 1
    } else {
      out[key] = 'true'
    }
  }
  return out
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { ...HEADERS, ...(init.headers || {}) } })
  const text = await res.text()
  let payload
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`Non-JSON response from ${url}: HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  if (!res.ok) {
    const msg = payload?.error?.message || payload?.message || `HTTP ${res.status}`
    throw new Error(`${init.method || 'GET'} ${url} failed: ${msg}`)
  }
  return payload
}
