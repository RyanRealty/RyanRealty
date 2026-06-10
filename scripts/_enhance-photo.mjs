/**
 * AI photo enhancement pipeline — Ryan Realty consistent polished look.
 *
 * Two layers (Matt directive 2026-06-09: "we can use AI in these images...
 * we want a consistent polished site"):
 *   1. AI fidelity   — Replicate Real-ESRGAN upscale/denoise (x2 detail
 *                      recovery, x4 for small sources). Enhancement ONLY —
 *                      never generative replacement. Fabricated Bend
 *                      geography stays banned per media-sourcing SKILL §0.
 *   2. Brand grade   — ONE deterministic sharp() curve applied identically
 *                      to every image: gentle contrast S-curve, +7%
 *                      saturation, light dehaze, mild sharpen. The shared
 *                      grade is what makes the site read as one shoot.
 *
 * Usage:
 *   node scripts/_enhance-photo.mjs <input> <outdir> [scale=2]
 * Writes: <outdir>/<stem>-enhanced.jpg + <stem>-compare.jpg (before/after).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import sharp from 'sharp'

const TOKEN = process.env.REPLICATE_API_TOKEN || readFileSync('.env.local', 'utf-8').match(/^REPLICATE_API_TOKEN=(.+)$/m)?.[1]
if (!TOKEN) throw new Error('REPLICATE_API_TOKEN missing')

const [input, outdir = 'out/photo-enhance', scaleArg = '2'] = process.argv.slice(2)
if (!input) throw new Error('usage: node scripts/_enhance-photo.mjs <input> [outdir] [scale]')
mkdirSync(outdir, { recursive: true })
const stem = basename(input).replace(/\.[A-Za-z]+$/, '')

// Sources already ≥4200px on the long side don't need ESRGAN (capping the
// upload at 1500px and 3x-ing back would LOSE native resolution) — they get
// the brand grade only, at native res. GRADE_ONLY=1 forces it.
const srcMeta = await sharp(input).metadata()
const gradeOnly = process.env.GRADE_ONLY === '1' || Math.max(srcMeta.width || 0, srcMeta.height || 0) >= 4200

async function rep(path, opts = {}) {
  const r = await fetch(`https://api.replicate.com/v1${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
  if (!r.ok) throw new Error(`replicate ${path}: ${r.status} ${await r.text()}`)
  return r.json()
}

// ── Layer 1: Real-ESRGAN via Replicate (skipped for ≥4200px sources) ───────
let aiBuf
if (gradeOnly) {
  aiBuf = await sharp(input).jpeg({ quality: 95 }).toBuffer()
  console.log(`  [grade-only] ${stem} (${srcMeta.width}x${srcMeta.height})`)
} else {
  const model = await rep('/models/nightmareai/real-esrgan')
  const version = model.latest_version.id

  // This Replicate ESRGAN deployment caps input at ~2.1M pixels (GPU memory).
  // Cap the long side at 1500px (≤1.8M px) and recover resolution on the way
  // back up via the scale factor.
  const srcBuf = await sharp(input).resize(1500, 1500, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer()
  const dataUri = `data:image/jpeg;base64,${srcBuf.toString('base64')}`

  let pred = await rep('/predictions', {
    method: 'POST',
    body: JSON.stringify({ version, input: { image: dataUri, scale: Number(scaleArg), face_enhance: false } }),
  })
  const t0 = Date.now()
  while (!['succeeded', 'failed', 'canceled'].includes(pred.status)) {
    if (Date.now() - t0 > 180_000) throw new Error('replicate timeout')
    await new Promise((r) => setTimeout(r, 2500))
    pred = await rep(`/predictions/${pred.id}`)
  }
  if (pred.status !== 'succeeded') throw new Error(`prediction ${pred.status}: ${JSON.stringify(pred.error)}`)
  const outUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output
  aiBuf = Buffer.from(await (await fetch(outUrl)).arrayBuffer())
}

// ── Layer 2: the ONE brand grade (identical for every image) ───────────────
function brandGrade(img) {
  return img
    .linear(1.07, -9)                                  // gentle contrast + dehaze
    .modulate({ saturation: 1.07, brightness: 1.01 })  // quiet color lift
    .gamma(1.02)                                       // open shadows a touch
    .sharpen({ sigma: 1.1, m1: 0.6, m2: 2.2 })         // crisp, not crunchy
}

const enhancedPath = resolve(outdir, `${stem}-enhanced.jpg`)
await brandGrade(sharp(aiBuf)).jpeg({ quality: 90, mozjpeg: true }).toFile(enhancedPath)

// ── Before/after compare strip (1600px wide, labeled halves) ───────────────
const half = 800
const before = await sharp(input).resize(half, 900, { fit: 'cover' }).toBuffer()
const after = await sharp(enhancedPath).resize(half, 900, { fit: 'cover' }).toBuffer()
const label = (text) => Buffer.from(
  `<svg width="${half}" height="44"><rect width="100%" height="100%" fill="#102742" opacity="0.85"/><text x="16" y="29" font-family="Helvetica" font-size="20" fill="#faf8f4">${text}</text></svg>`
)
await sharp({ create: { width: half * 2, height: 900, channels: 3, background: '#102742' } })
  .composite([
    { input: before, left: 0, top: 0 },
    { input: after, left: half, top: 0 },
    { input: await sharp(label('BEFORE')).png().toBuffer(), left: 0, top: 0 },
    { input: await sharp(label('AFTER — AI fidelity + brand grade')).png().toBuffer(), left: half, top: 0 },
  ])
  .jpeg({ quality: 88 })
  .toFile(resolve(outdir, `${stem}-compare.jpg`))

const meta = await sharp(enhancedPath).metadata()
console.log(`${stem}: ${meta.width}x${meta.height} -> ${enhancedPath}`)
console.log(`compare: ${resolve(outdir, `${stem}-compare.jpg`)}`)
