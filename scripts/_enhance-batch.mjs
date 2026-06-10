/**
 * Batch enhancement — full grade-A pool + site geo images.
 * Same two-layer pipeline as _enhance-photo.mjs (ESRGAN only for <4200px
 * sources, ONE deterministic brand grade for everything).
 *
 *   node scripts/_enhance-batch.mjs            # A-pool -> photos/enhanced/
 *   node scripts/_enhance-batch.mjs --site     # site images in place
 *
 * Skips: already-enhanced rows, the 4 RED-mismatch site files (wrong photo,
 * pending replacement — no point polishing them), maps/screenshots/logos.
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const LOG = resolve(ROOT, 'out/photo-enhance/batch.log')
const log = (m) => { console.log(m); appendFileSync(LOG, m + '\n') }

const siteMode = process.argv.includes('--site')

let jobs = []
if (!siteMode) {
  const m = JSON.parse(readFileSync(resolve(ROOT, 'data/asset-library/manifest.json'), 'utf-8'))
  const rows = Array.isArray(m) ? m : m.assets || []
  for (const a of rows) {
    if (a.type !== 'photo' || a.vision_quality !== 'A' || a.enhanced_path) continue
    let src = null
    for (const d of ['curated', 'pexels', 'unsplash', 'stock', 'wikimedia'])
      for (const ext of ['.jpg', '.JPG', '.jpeg', '.png', '.PNG'])
        if (existsSync(resolve(ROOT, `public/asset-library/photos/${d}/${a.id}${ext}`))) {
          src = `public/asset-library/photos/${d}/${a.id}${ext}`; break
        }
    if (src) jobs.push({ id: a.id, src, out: 'public/asset-library/photos/enhanced' })
  }
} else {
  const RED = ['pronghorn-01', 'sunriver-river', 'eagle-crest-01', 'three-sisters-backdrop']
  const SKIP = /map|logo|jax|hero-bend|hero-deschutes|architects|brokers|office|brand|team/
  const list = execFileSync('find', ['public/lp', 'public/images/communities', 'public/images/hero', '-type', 'f', '(', '-iname', '*.jpg', '-o', '-iname', '*.jpeg', ')'], { cwd: ROOT }).toString().trim().split('\n')
  for (const f of list) {
    if (!f || f.includes('_archive')) continue
    if (RED.some((r) => f.includes(r)) || SKIP.test(f)) continue
    jobs.push({ id: f, src: f, out: null }) // in place
  }
}
log(`batch start: ${jobs.length} jobs (${siteMode ? 'site in-place' : 'A-pool'}) ${new Date().toISOString()}`)

let done = 0, failed = 0
const CONC = 4
async function worker(queue) {
  for (;;) {
    const j = queue.shift()
    if (!j) return
    try {
      if (j.out) {
        execFileSync('node', ['scripts/_enhance-photo.mjs', j.src, j.out, '3'], { cwd: ROOT, stdio: 'pipe', timeout: 240_000 })
      } else {
        // in place: enhance to tmp then overwrite source
        execFileSync('node', ['scripts/_enhance-photo.mjs', j.src, 'out/photo-enhance/site-tmp', '3'], { cwd: ROOT, stdio: 'pipe', timeout: 240_000 })
        const stem = j.src.split('/').pop().replace(/\.[A-Za-z]+$/, '')
        execFileSync('cp', [`out/photo-enhance/site-tmp/${stem}-enhanced.jpg`, j.src], { cwd: ROOT })
      }
      done += 1
      log(`ok  ${done + failed}/${jobs.length}  ${j.id}`)
    } catch (e) {
      failed += 1
      log(`FAIL ${j.id}: ${String(e.message || e).slice(0, 120)}`)
    }
  }
}
const queue = [...jobs]
await Promise.all(Array.from({ length: CONC }, () => worker(queue)))

if (!siteMode) {
  // record enhanced_path on manifest rows that now have files
  const mPath = resolve(ROOT, 'data/asset-library/manifest.json')
  const m = JSON.parse(readFileSync(mPath, 'utf-8'))
  const rows = Array.isArray(m) ? m : m.assets || []
  let n = 0
  for (const a of rows) {
    const p = `public/asset-library/photos/enhanced/${a.id}-enhanced.jpg`
    if (!a.enhanced_path && existsSync(resolve(ROOT, p))) {
      a.enhanced_path = p
      a.enhanced_at = new Date().toISOString().slice(0, 10)
      a.enhanced_pipeline = 'real-esrgan+brand-grade-v1'
      n += 1
    }
  }
  writeFileSync(mPath, JSON.stringify(m, null, 2))
  log(`manifest: enhanced_path recorded on ${n} rows`)
}
log(`batch done: ${done} ok, ${failed} failed ${new Date().toISOString()}`)
