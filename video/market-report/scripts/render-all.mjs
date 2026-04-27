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
}
console.log('\nAll renders complete.')
