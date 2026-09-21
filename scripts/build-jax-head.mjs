#!/usr/bin/env node
/**
 * build-jax-head.mjs — SITE-146 rematch #3
 *
 * Re-export the INNER dog head from the FULL seals on this repo tree:
 *   public/brand/jax-navy.png  (3635x3417)
 *   public/brand/jax-white.png (3635x3417)
 *
 * Those two files are the source. Crop only from files that exist on
 * this repo tree. Do not cite an off-tree kit as a crop source.
 *
 * The dog is a knockout hole in the inner disc. Painting that hole
 * (and only that hole) yields a silhouette with the complete muzzle,
 * ears, and crown.
 *
 * Pad is a thin 4–8% safety inside the square BEFORE the FAB circle
 * masks — not the 16% fat ring that left a readable face sitting in
 * an empty disc. Placement is circle-aware: the upper-left muzzle
 * stays inside the inscribed circle at rest and at the -6° idle tilt
 * (transform-origin 50% / 78%). Extra left inset vs the right so the
 * nose is not the thing kissing the rim while dead space sits behind
 * the ears.
 *
 * Do not crop an already-clipped jax-head disc. That file has no snout.
 *
 * Usage: node scripts/build-jax-head.mjs
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import {
  DOG_HEAD_PAD,
  DOG_HEAD_TILT_DEG,
  DOG_HEAD_TILT_ORIGIN_Y,
  JAX_HEAD_SEALS,
} from './lib/dog-floater.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SIZE = 1024
const INK = 16
/** Radial keep-out so a 6° tilt around 50%/78% cannot push the muzzle out. */
const CIRCLE_KEEP = 0.955
const MIN_INSET = 0.04
const TILT_DEG = DOG_HEAD_TILT_DEG
const TILT_ORIGIN_Y = DOG_HEAD_TILT_ORIGIN_Y

function discOuterRadius(data, w, h, cx, cy) {
  let lastHigh = 0
  for (let r = 200; r <= 1400; r += 4) {
    let ink = 0
    let n = 0
    for (let a = 0; a < 360; a += 2) {
      const rad = (a * Math.PI) / 180
      const x = Math.round(cx + Math.cos(rad) * r)
      const y = Math.round(cy + Math.sin(rad) * r)
      if (x < 0 || y < 0 || x >= w || y >= h) continue
      n += 1
      if (data[(y * w + x) * 4 + 3] > INK) ink += 1
    }
    const frac = n ? ink / n : 0
    if (frac > 0.75) lastHigh = r
    if (lastHigh && r > lastHigh + 20 && frac < 0.25) break
  }
  if (lastHigh < 400) {
    throw new Error(`inner disc radius not found (lastHigh=${lastHigh})`)
  }
  return lastHigh
}

function tiltPoint(x, y, side) {
  const tcx = side * 0.5
  const tcy = side * TILT_ORIGIN_Y
  const rad = (TILT_DEG * Math.PI) / 180
  const vx = x - tcx
  const vy = y - tcy
  return {
    x: tcx + vx * Math.cos(rad) - vy * Math.sin(rad),
    y: tcy + vx * Math.sin(rad) + vy * Math.cos(rad),
  }
}

function insideCircle(x, y, side, keep = CIRCLE_KEEP) {
  const c = side / 2
  return Math.hypot(x - c, y - c) <= c * keep
}

function placeSquare(dogW, dogH, checks) {
  const inner = Math.max(dogW, dogH)
  let side = Math.ceil(inner / (1 - 2 * DOG_HEAD_PAD))

  function score(s, ox, oy) {
    const left = ox / s
    const top = oy / s
    const right = (s - ox - dogW) / s
    const bottom = (s - oy - dogH) / s
    if (left < MIN_INSET || top < MIN_INSET || right < MIN_INSET || bottom < MIN_INSET) {
      return null
    }
    for (const p of checks) {
      const x = ox + p.lx
      const y = oy + p.ly
      if (!insideCircle(x, y, s)) return null
      if (p.tilt) {
        const t = tiltPoint(x, y, s)
        if (!insideCircle(t.x, t.y, s, 0.97)) return null
      }
    }
    // Prefer extra left (muzzle) and a tight overall square (head fills the disc).
    return left * 1.4 + top + right + bottom - (s - inner) / s
  }

  let best = null
  for (let grow = 0; grow <= Math.ceil(inner * 0.12); grow += 4) {
    const s = side + grow
    const minO = Math.round(MIN_INSET * s)
    const maxOx = s - dogW - minO
    const maxOy = s - dogH - minO
    if (maxOx < minO || maxOy < minO) continue
    // Bias toward more left pad (muzzle) and a touch more top pad (crown).
    const midOx = Math.round((minO + maxOx) / 2)
    const midOy = Math.round((minO + maxOy) / 2)
    const oxCandidates = [maxOx, Math.round((midOx + maxOx) / 2), midOx, Math.round((minO + midOx) / 2), minO]
    const oyCandidates = [Math.round((midOy + maxOy) / 2), midOy, Math.round((minO + midOy) / 2), minO, maxOy]
    for (const ox of oxCandidates) {
      if (ox < minO || ox > maxOx) continue
      for (const oy of oyCandidates) {
        if (oy < minO || oy > maxOy) continue
        const sc = score(s, ox, oy)
        if (sc == null) continue
        if (!best || sc > best.sc || (sc === best.sc && s < best.side)) {
          best = { side: s, ox, oy, sc }
        }
      }
    }
    if (best && grow === 0) break
    if (best && grow > 0) break
  }
  if (!best) {
    throw new Error('could not place the inner head in a 4-8% circle-safe square')
  }
  return best
}

function extractHead(data, w, h) {
  const cx = Math.round(w / 2)
  const cy = Math.round(h / 2)
  const discR = discOuterRadius(data, w, h, cx, cy)
  const discR2 = discR * discR

  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  const cover = new Float32Array(w * h)

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy > discR2) continue
      const a = data[(y * w + x) * 4 + 3]
      const t = 1 - a / 255
      if (t <= 0.02) continue
      cover[y * w + x] = t
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  if (maxX <= minX || maxY <= minY) {
    throw new Error('dog knockout was not found inside the inner disc')
  }

  const dogW = maxX - minX + 1
  const dogH = maxY - minY + 1

  let leftMost = { x: w, y: 0 }
  let topMost = { x: 0, y: h }
  let rightMost = { x: 0, y: 0 }
  let botMost = { x: 0, y: 0 }
  const checks = []
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (cover[y * w + x] <= 0) continue
      if (x < leftMost.x) leftMost = { x, y }
      if (y < topMost.y) topMost = { x, y }
      if (x > rightMost.x) rightMost = { x, y }
      if (y > botMost.y) botMost = { x, y }
      const ly = y - minY
      if (ly <= dogH * 0.7 && (x + y) % 5 === 0) {
        checks.push({ lx: x - minX, ly, tilt: ly < dogH * 0.55 })
      }
    }
  }
  for (const p of [leftMost, topMost, rightMost, botMost]) {
    checks.push({ lx: p.x - minX, ly: p.y - minY, tilt: true })
  }

  const placed = placeSquare(dogW, dogH, checks)
  const { side, ox, oy } = placed
  const out = Buffer.alloc(side * side * 4)

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = cover[y * w + x]
      if (t <= 0) continue
      const i = ((oy + (y - minY)) * side + (ox + (x - minX))) * 4
      out[i] = 255
      out[i + 1] = 255
      out[i + 2] = 255
      out[i + 3] = Math.max(out[i + 3], Math.round(t * 255))
    }
  }

  return {
    raw: out,
    side,
    discR,
    bbox: [minX, minY, maxX, maxY],
    dogW,
    dogH,
    pad: { x: ox / side, y: oy / side, right: (side - ox - dogW) / side, bottom: (side - oy - dogH) / side },
  }
}

async function paintHead(mask, tint, dest) {
  const tinted = Buffer.from(mask.raw)
  for (let i = 0; i < tinted.length; i += 4) {
    if (tinted[i + 3] === 0) continue
    tinted[i] = tint.r
    tinted[i + 1] = tint.g
    tinted[i + 2] = tint.b
  }
  const png = await sharp(tinted, {
    raw: { width: mask.side, height: mask.side, channels: 4 },
  })
    .resize(SIZE, SIZE, { fit: 'fill', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer()
  writeFileSync(dest, png)
}

const wrote = []
for (const spec of JAX_HEAD_SEALS) {
  const abs = join(ROOT, spec.src)
  const { data, info } = await sharp(abs).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (info.width !== spec.width || info.height !== spec.height) {
    throw new Error(
      `${spec.src}: expected ${spec.width}x${spec.height}, got ${info.width}x${info.height}`,
    )
  }
  const mask = extractHead(data, info.width, info.height)
  const dest = join(ROOT, spec.dest)
  await paintHead(mask, spec.tint, dest)
  wrote.push({
    source: spec.src,
    size: [info.width, info.height],
    dest: spec.dest,
    discR: mask.discR,
    dogBBox: mask.bbox,
    dogSize: [mask.dogW, mask.dogH],
    square: mask.side,
    pad: {
      left: +((mask.pad.x) * 100).toFixed(1) + '%',
      top: +((mask.pad.y) * 100).toFixed(1) + '%',
      right: +((mask.pad.right) * 100).toFixed(1) + '%',
      bottom: +((mask.pad.bottom) * 100).toFixed(1) + '%',
    },
  })
}

console.log(JSON.stringify({ wrote }, null, 2))
