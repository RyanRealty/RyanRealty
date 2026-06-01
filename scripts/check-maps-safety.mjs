#!/usr/bin/env node
/**
 * Maps-safety gate.
 *
 * `google.maps.*` must NOT be touched at render/module scope — only inside
 * effects/callbacks that run AFTER the Maps API script has loaded. Touching it
 * early (e.g. `position: google.maps.ControlPosition.RIGHT_TOP` in an inline
 * <GoogleMap options={...}>) throws "Cannot read properties of undefined" and
 * crashes the WHOLE page via the error boundary — it took down every city,
 * community, neighborhood, search, and listing page at once.
 *
 * This bans the inline ControlPosition pattern that caused it. The single
 * canonical, guarded reference lives in lib/maps/markers.ts getBaseMapOptions()
 * (which checks `typeof google !== 'undefined'` first) — use that instead.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!/node_modules|\.next|\.git/.test(p)) walk(p, out)
    } else if (/\.(tsx|ts)$/.test(e.name)) {
      out.push(p)
    }
  }
  return out
}

const files = ['app', 'components'].flatMap((d) =>
  fs.existsSync(path.join(ROOT, d)) ? walk(path.join(ROOT, d)) : [],
)
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/')

const bad = []
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  if (/position:\s*google\.maps\.ControlPosition/.test(src)) {
    bad.push(
      `${rel(f)} -> inline 'google.maps.ControlPosition' crashes before the Maps API loads. ` +
        `Remove the zoomControlOptions line or use lib/maps getBaseMapOptions() (guarded).`,
    )
  }
}

if (bad.length) {
  console.error('Maps-safety gate FAILED — render-time google.maps access:')
  for (const b of bad) console.error('  - ' + b)
  process.exit(1)
}
console.log('Maps-safety gate passed.')
