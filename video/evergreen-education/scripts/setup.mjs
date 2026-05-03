#!/usr/bin/env node
/**
 * setup.mjs — one-time bootstrap for the evergreen-education video pipeline.
 *
 * - Copies commercial brand fonts (Amboqia, AzoSans) from /workspace/public/fonts
 *   into video/evergreen-education/public/. These are gitignored.
 * - Creates required out/ directories.
 *
 * Run once after cloning: node video/evergreen-education/scripts/setup.mjs
 */

import { copyFile, mkdir, stat } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const REPO = resolve(ROOT, '..', '..')

const FONTS = [
  ['public/fonts/Amboqia_Boriango.otf', 'public/Amboqia_Boriango.otf'],
  ['public/fonts/AzoSans-Medium.ttf', 'public/AzoSans-Medium.ttf'],
]

async function exists(p) {
  try { await stat(p); return true } catch { return false }
}

async function main() {
  await mkdir(resolve(ROOT, 'public'), { recursive: true })
  await mkdir(resolve(ROOT, 'public/4-pillars/illustrations'), { recursive: true })
  await mkdir(resolve(ROOT, 'public/library'), { recursive: true })
  await mkdir(resolve(ROOT, 'out/4-pillars/illustrations'), { recursive: true })
  await mkdir(resolve(ROOT, 'out/4-pillars/grok-video-scouts'), { recursive: true })
  await mkdir(resolve(ROOT, 'out/4-pillars/music-candidates'), { recursive: true })
  await mkdir(resolve(ROOT, 'out/4-pillars/segments'), { recursive: true })
  await mkdir(resolve(ROOT, 'out/4-pillars/post-scripts'), { recursive: true })

  for (const [src, dst] of FONTS) {
    const srcPath = resolve(REPO, src)
    const dstPath = resolve(ROOT, dst)
    if (!(await exists(srcPath))) {
      console.warn(`✗ source font missing: ${srcPath}`)
      continue
    }
    if (await exists(dstPath)) {
      console.log(`✓ ${dst} already exists`)
    } else {
      await copyFile(srcPath, dstPath)
      console.log(`✓ copied ${src} → ${dst}`)
    }
  }

  console.log('\nSetup complete. Next:')
  console.log('  node scripts/compute-equity-table.mjs')
  console.log('  node scripts/generate-illustrations.mjs')
  console.log('  node scripts/fetch-music.mjs')
  console.log('  node scripts/synth-vo.mjs                    (or --skip for visual-only)')
  console.log('  node scripts/render.mjs')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
