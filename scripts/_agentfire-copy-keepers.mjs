#!/usr/bin/env node
/**
 * Copy the keeper photos (everything in the "photos" buckets EXCEPT the 2022
 * group) into a clean flat folder. Same classification as the pick-list so the
 * set matches exactly what Matt approved.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.join(process.cwd(), 'out/agentfire-media')
const UPLOADS = path.join(ROOT, 'wp-content/uploads')
const DEST = path.join(ROOT, 'selected-photos')

const IMG_RE = /\.(jpe?g|png|webp|gif|svg)$/i
const THUMB_RE = /-\d+x\d+\.\w+$/i
const GRAPHIC_NAME_RE = /(icon|favicon|logo|brand|avatar|sprite|placeholder|pattern|loader|spinner|divider|badge|bullet|watermark|stamp|button|bg-pattern|apple-touch)/i
const DROP_GROUPS = new Set(['2022'])

function walk(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}
function dimsFor(files) {
  const map = new Map()
  for (let i = 0; i < files.length; i += 150) {
    const chunk = files.slice(i, i + 150).filter((f) => !/\.svg$/i.test(f))
    if (!chunk.length) continue
    let out = ''
    try { out = execSync(`sips -g pixelWidth -g pixelHeight ${chunk.map((f) => JSON.stringify(f)).join(' ')}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }) }
    catch (e) { out = e.stdout || '' }
    let cur = null
    for (const line of out.split('\n')) {
      if (line.startsWith('/')) cur = line.trim()
      else if (cur) { const w = line.match(/pixelWidth:\s*(\d+)/); const h = line.match(/pixelHeight:\s*(\d+)/); const d = map.get(cur) || {}; if (w) d.w = +w[1]; if (h) d.h = +h[1]; map.set(cur, d) }
    }
  }
  return map
}

const kept = walk(UPLOADS).filter((f) => IMG_RE.test(f)).filter((f) => {
  const rel = f.slice(UPLOADS.length + 1)
  if (THUMB_RE.test(f)) return false
  if (/^WPL\//i.test(rel)) return false
  if (/^nsl_avatars\//i.test(rel)) return false
  return true
})
const dims = dimsFor(kept)

const photos = kept.filter((f) => {
  const name = path.basename(f)
  const d = dims.get(f) || {}
  const maxDim = Math.max(d.w || 0, d.h || 0)
  const size = fs.statSync(f).size
  if (/\.svg$/i.test(f) || GRAPHIC_NAME_RE.test(name)) return false
  if (maxDim >= 400) return true
  if (maxDim === 0) return size > 80 * 1024
  return false
})

const keepers = photos.filter((f) => {
  const top = path.relative(UPLOADS, path.dirname(f)).split(path.sep)[0] || '.'
  return !DROP_GROUPS.has(top)
})

fs.rmSync(DEST, { recursive: true, force: true })
fs.mkdirSync(DEST, { recursive: true })
let copied = 0, bytes = 0
const used = new Set()
for (const f of keepers) {
  let base = path.basename(f)
  if (used.has(base.toLowerCase())) {
    const top = path.relative(UPLOADS, path.dirname(f)).split(path.sep)[0]
    base = `${top}-${base}`
  }
  used.add(base.toLowerCase())
  const dest = path.join(DEST, base)
  fs.copyFileSync(f, dest)
  copied++; bytes += fs.statSync(dest).size
}
console.log(`Copied ${copied} keeper photos (${(bytes / 1048576).toFixed(0)} MB) -> ${DEST}`)
console.log(`(dropped ${photos.length - keepers.length} from 2022; excluded thumbnails/WPL/avatars/graphics)`)
