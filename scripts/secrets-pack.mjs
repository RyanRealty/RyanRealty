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
const STDOUT = process.argv.includes('--stdout')

if (!existsSync(src)) {
  console.error(`No .env.local at ${src} — nothing to pack.`)
  process.exit(1)
}

const raw = readFileSync(src, 'utf8')
const vars = raw.split('\n').filter((l) => /^[A-Z0-9_]+=/.test(l.trim())).length
const packed = Buffer.from(raw, 'utf8').toString('base64')

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
