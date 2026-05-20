#!/usr/bin/env node
// Render all 6 city compositions sequentially via Remotion CLI.
// (Sequential to avoid overwhelming the GPU/CPU.)

import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const CITIES = process.argv.slice(2).filter(s => !s.startsWith('--'))
const ALL = ['bend', 'redmond', 'sisters', 'la-pine', 'prineville', 'sunriver']
const targets = CITIES.length ? CITIES : ALL

const force = process.argv.includes('--force')

const exists = async (p) => {
  try { await (await import('node:fs/promises')).access(p); return true } catch { return false }
}

for (const slug of targets) {
  const propsPath = resolve(ROOT, 'out', slug, 'props.json')
  const outPath = resolve(ROOT, 'out', slug, 'render.mp4')
  if (!force && await exists(outPath)) {
    console.log(`Skipping ${slug} (render.mp4 exists; pass --force to re-render)`)
    continue
  }
  console.log(`\n=== Rendering ${slug} ===`)
  const t0 = Date.now()
  const code = await new Promise((res, rej) => {
    const p = spawn('npx', ['remotion','render','src/index.ts','MarketReport', outPath, `--props=${propsPath}`, '--log=warn'], { cwd: ROOT, stdio: 'inherit' })
    p.on('exit', res)
    p.on('error', rej)
  })
  if (code !== 0) { console.error(`Render failed for ${slug} (exit ${code})`); process.exit(1) }
  const dt = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`✓ ${slug} rendered in ${dt}s → ${outPath}`)

  // First-frame thumbnail gate (ship-blocker, locked 2026-05-20).
  // Runs check_first_frame.py from the repo root. Fails the build if non-zero.
  const REPO_ROOT = resolve(ROOT, '../..')
  const checkScript = resolve(REPO_ROOT, 'scripts/check_first_frame.py')
  console.log(`  → running first-frame check on ${outPath}`)
  const checkCode = await new Promise((res, rej) => {
    const p = spawn('python3', [checkScript, outPath], { cwd: REPO_ROOT, stdio: 'inherit' })
    p.on('exit', res)
    p.on('error', rej)
  })
  if (checkCode !== 0) {
    console.error(`\nSHIP-BLOCKER: first-frame check failed for ${slug}. Fix the opening frame before publishing.`)
    process.exit(1)
  }
  console.log(`  ✓ first-frame check passed for ${slug}`)
}
console.log('\nAll renders complete.')
