#!/usr/bin/env node
/**
 * check-untracked-imports.mjs — build-safety gate.
 *
 * Catches the failure mode that broke every Vercel cutover deploy: a TRACKED file
 * imports a file that is only UNTRACKED in the working tree. `git add -u` stages
 * modified tracked files but NOT new untracked ones, so the import ships without
 * its target; local `npm run build` passes (the file is on disk) but CI/Vercel —
 * which only see committed code — fail "Module not found". pre-push runs ci:gates
 * but not a full build, so this closes that gap cheaply.
 *
 * Fails if any untracked .ts/.tsx under app/ components/ lib/ is imported (via the
 * @/ alias) by a tracked file. In CI there are no untracked files, so it's a no-op
 * there — its job is to fire LOCALLY (pre-push) before the broken commit leaves.
 *
 * Run: node scripts/check-untracked-imports.mjs   (wired into ci:gates)
 */

import { execSync } from 'node:child_process'

function sh(cmd) {
  try { return execSync(cmd, { encoding: 'utf8' }) } catch (e) { return (e.stdout || '').toString() }
}

const untracked = sh('git ls-files --others --exclude-standard')
  .split('\n').map((s) => s.trim()).filter(Boolean)
  .filter((f) => /^(app|components|lib)\/.*\.(ts|tsx)$/.test(f))

const offenders = []
for (const f of untracked) {
  const noExt = f.replace(/\.(tsx?)$/, '').replace(/\/index$/, '')
  const alias = '@/' + noExt
  // git grep searches ONLY tracked files — so a hit = tracked code importing this untracked file.
  const hits = sh(`git grep -lF ${JSON.stringify(alias)} -- '*.ts' '*.tsx'`)
    .split('\n').map((s) => s.trim()).filter(Boolean)
  if (hits.length) offenders.push({ file: f, alias, importedBy: hits })
}

if (offenders.length) {
  console.error('\nUntracked-import gate FAILED — tracked code imports UNTRACKED file(s):')
  for (const o of offenders) {
    console.error(`  ${o.file}`)
    console.error(`    imported as ${o.alias} by: ${o.importedBy.join(', ')}`)
  }
  console.error('\n`git add` the file(s) before pushing — otherwise the CI/Vercel build fails "Module not found".')
  process.exit(1)
}
console.log('Untracked-import gate passed — no tracked file imports an untracked source file.')
