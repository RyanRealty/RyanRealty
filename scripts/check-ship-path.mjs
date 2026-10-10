#!/usr/bin/env node
/**
 * check-ship-path.mjs — finished code lands with `npm run ship` (Matt 2026-10-09).
 *
 * A living instruction that still tells an agent to wait for Matt to merge code
 * fails. Archive and plan history are not scanned. The command itself must
 * merge a pull request and must not git-push main.
 *
 * Usage: node scripts/check-ship-path.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const FAIL_PHRASE = 'Matt merges'
const FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  'docs/RUN_LOOP.md',
  'docs/VERCEL_DEPLOY.md',
  'docs/DEVELOPMENT_PROCESS.md',
]
const DIRS = ['.cursor/rules', 'marketing_brain_skills', 'social_media_skills']

function walk(dir, out) {
  let names
  try {
    names = readdirSync(dir)
  } catch {
    return
  }
  for (const name of names) {
    if (name === 'node_modules' || name === 'archive') continue
    const p = join(dir, name)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(p, out)
    else if (p.endsWith('.md') || p.endsWith('.mdc')) out.push(p)
  }
}

const files = [...FILES]
for (const d of DIRS) walk(d, files)

const fails = []
for (const f of files) {
  if (!existsSync(f)) {
    fails.push(`missing ${f}`)
    continue
  }
  const text = readFileSync(f, 'utf8')
  const line = text.split('\n').findIndex((l) => l.includes(FAIL_PHRASE))
  if (line >= 0) {
    fails.push(`${f}:${line + 1} still says "${FAIL_PHRASE}". Finished code is npm run ship.`)
  }
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const shipScript = String(pkg.scripts?.ship ?? '')
if (!shipScript.includes('scripts/ship-pr.sh')) {
  fails.push('package.json scripts.ship must run scripts/ship-pr.sh')
}
const chain = String(pkg.scripts?.['ci:gates:chain'] ?? '')
if (!chain.includes('npm run ci:ship-path')) {
  fails.push('ci:gates:chain must run ci:ship-path')
}

const ship = existsSync('scripts/ship-pr.sh') ? readFileSync('scripts/ship-pr.sh', 'utf8') : ''
if (!ship) fails.push('scripts/ship-pr.sh is missing')
if (!ship.includes('gh pr merge')) fails.push('ship-pr.sh must merge with gh pr merge')
if (!ship.includes('--merge')) fails.push('ship-pr.sh must use a merge commit')
if (ship.includes('--rebase') || ship.includes('--squash') || ship.includes('--auto')) {
  fails.push('ship-pr.sh must not rebase, squash, or wait on remote checks')
}
if (ship.includes('HEAD:main')) fails.push('ship-pr.sh must not name a direct push of main')
if (!ship.includes('deploy:verify')) fails.push('ship-pr.sh must run deploy:verify when the app changes')
if (!ship.includes("''|main)")) fails.push('ship-pr.sh must refuse to run from main')

const loop = existsSync('docs/RUN_LOOP.md') ? readFileSync('docs/RUN_LOOP.md', 'utf8') : ''
if (!loop.includes('npm run ship')) fails.push('docs/RUN_LOOP.md must name npm run ship')
if (/pushes `main`/.test(loop)) fails.push('docs/RUN_LOOP.md must not tell a session to push main')

for (const f of ['AGENTS.md', 'CLAUDE.md']) {
  const text = existsSync(f) ? readFileSync(f, 'utf8') : ''
  if (!text.includes('npm run ship')) fails.push(`${f} must name npm run ship`)
}

if (fails.length) {
  console.error('ship path gate FAILED')
  for (const f of fails) console.error(`  ${f}`)
  process.exit(1)
}
console.log(`ship path gate ok (${files.length} living files)`)
