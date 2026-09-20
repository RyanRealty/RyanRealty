#!/usr/bin/env node
/**
 * build-jax-head.mjs — SITE-146
 *
 * Re-export the INNER dog head from the FULL seal (public/brand/jax-navy.png
 * / jax-white.png — same artwork as brand-kit/rasta/blue-dog-transparent.png
 * and white-dog-trans.png). The dog is a knockout hole in the inner disc.
 * Painting that hole (and only that hole) yields a silhouette with the
 * complete muzzle, ears, and crown. Padding lives in the square so the
 * FAB circle mask cannot eat the head.
 *
 * Do not crop the already-clipped jax-head disc. That file has no snout.
 *
 * Usage: node scripts/build-jax-head.mjs
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SEAL_NAVY = join(ROOT, 'public/brand/jax-navy.png')
const OUT_NAVY = join(ROOT, 'public/brand/jax-head-navy.png')
const OUT_CREAM = join(ROOT, 'public/brand/jax-head-cream.png')

const NAVY = { r: 16, g: 39, b: 66 }
const CREAM = { r: 255, g: 255, b: 255 }
const SIZE = 1024
const PAD = 0.16
const INK = 16

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
  const inner = Math.max(dogW, dogH)
  const side = Math.ceil(inner / (1 - 2 * PAD))
  const out = Buffer.alloc(side * side * 4)
  const ox = Math.round((side - dogW) / 2)
  const oy = Math.round((side - dogH) / 2)

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
    pad: { x: ox / side, y: oy / side },
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

const { data, info } = await sharp(SEAL_NAVY).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const mask = extractHead(data, info.width, info.height)
await paintHead(mask, NAVY, OUT_NAVY)
await paintHead(mask, CREAM, OUT_CREAM)

console.log(
  JSON.stringify(
    {
      source: 'public/brand/jax-navy.png',
      discR: mask.discR,
      dogBBox: mask.bbox,
      dogSize: [mask.dogW, mask.dogH],
      square: mask.side,
      pad: {
        x: +((mask.pad.x) * 100).toFixed(1) + '%',
        y: +((mask.pad.y) * 100).toFixed(1) + '%',
      },
      wrote: [OUT_NAVY, OUT_CREAM],
    },
    null,
    2,
  ),
)
