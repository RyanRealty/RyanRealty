#!/usr/bin/env node
/**
 * secrets-pack.mjs — package .env.local for the DOTENV_LOCAL Codespaces secret.
 *
 * The dev box needs 109 environment variables. One base64 secret beats 109
 * hand-entered ones, and .devcontainer/post-create.sh decodes it back into
 * .env.local so every script that reads that file works unchanged.
 *
 *   npm run secrets:pack              # write the value to a file, print nothing
 *   npm run secrets:pack -- --stdout  # print to stdout (careful: it is a secret)
 *
 * By default the packed value goes to a gitignored scratch file rather than
 * your terminal, so it does not end up in scrollback or a shared session log.
 * Upload it as a repository secret named DOTENV_LOCAL:
 *   GitHub → repo → Settings → Secrets and variables → Codespaces → New secret
 *
 * SECURITY: this is the entire credential surface in one blob. Anyone who can
 * open a Codespace on this repo can read it. That is the same trust boundary as
 * a checked-out .env.local on a laptop, but it is worth being deliberate about.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, '.env.local')
const out = path.join(root, 'tmp', 'DOTENV_LOCAL.b64')
const envOut = path.join(root, 'tmp', 'cloud-env.txt')
const STDOUT = process.argv.includes('--stdout')
const ENV = process.argv.includes('--env')

/**
 * Variables that must NOT go into a Claude Code cloud environment.
 *
 * ANTHROPIC_API_KEY: Claude Code prefers an API key over your subscription when
 * one is present, which bills per token and disables subscription-only
 * features. The headless producer crons that need it run on Vercel, not in a
 * dev session.
 */
const CLOUD_EXCLUDE = new Set(['ANTHROPIC_API_KEY'])

if (!existsSync(src)) {
  console.error(`No .env.local at ${src} — nothing to pack.`)
  process.exit(1)
}

const raw = readFileSync(src, 'utf8')
const vars = raw.split('\n').filter((l) => /^[A-Z0-9_]+=/.test(l.trim())).length
const packed = Buffer.from(raw, 'utf8').toString('base64')

/**
 * `--env` — the paste-ready body for the Claude Code cloud environment's
 * "Environment variables" field.
 *
 * That field takes `.env` format, one KEY=value per line, and stores any
 * surrounding quotes AS PART OF THE VALUE. It is NOT base64 — pasting the
 * base64 blob (which is what `--stdout` emits, for the Codespaces DOTENV_LOCAL
 * secret) yields one garbage variable. The two targets take different formats
 * and this flag exists so they cannot be confused.
 *
 * Comments and blank lines are dropped, surrounding quotes are stripped, and
 * CLOUD_EXCLUDE is removed.
 */
if (ENV) {
  const kept = []
  const dropped = []
  for (const line of raw.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)=([\s\S]*)$/.exec(line)
    if (!m) continue
    const [, key, rawVal] = m
    if (CLOUD_EXCLUDE.has(key)) {
      dropped.push(key)
      continue
    }
    const val = rawVal.trim().replace(/^(['"])([\s\S]*)\1$/, '$2')
    kept.push(`${key}=${val}`)
  }
  const body = kept.join('\n') + '\n'
  if (STDOUT) {
    process.stdout.write(body)
    process.exit(0)
  }
  writeFileSync(envOut, body, { mode: 0o600 })
  console.log(`Wrote ${kept.length} variables in .env format for the cloud environment.`)
  if (dropped.length) console.log(`  excluded: ${dropped.join(', ')}`)
  console.log(`  → ${path.relative(root, envOut)}`)
  console.log('')
  console.log('Paste the file contents into claude.ai/code → environment → Environment variables.')
  console.log('Anyone who can edit that environment can read these values.')
  console.log('')
  console.log('  (or pipe it straight to your clipboard tool — no macOS command is')
  console.log('   assumed here, since the point of the cloud box is leaving the Mac)')
  process.exit(0)
}

if (STDOUT) {
  process.stdout.write(packed + '\n')
  process.exit(0)
}

writeFileSync(out, packed + '\n', { mode: 0o600 })
console.log(`Packed ${vars} variables (${packed.length} base64 chars)`)
console.log(`  → ${path.relative(root, out)}`)
console.log('')
console.log('Add it as a Codespaces repository secret named DOTENV_LOCAL:')
console.log('  https://github.com/RyanRealty/RyanRealty/settings/secrets/codespaces')
console.log('')
console.log('Or with the GitHub CLI:')
console.log(`  gh secret set DOTENV_LOCAL --app codespaces < ${path.relative(root, out)}`)
