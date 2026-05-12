#!/usr/bin/env node
/**
 * Just-listed flyer compositor — multi-photo, hero zoom crop, brand colors.
 * Uses @napi-rs/canvas (already in devDependencies).
 *
 * Usage:
 *   node scripts/render-just-listed-flyer.mjs --config out/flyers/<mls>/config.json
 *
 * Config shape (JSON):
 * {
 *   "photos": [...],
 *   "heroZoom": 1.35,
 *   "thumbZoom": 1.12,
 *   "address": "...",
 *   "cityLine": "...",
 *   "price": "$650,000",
 *   "beds": 4, "baths": 2, "sqft": 1903,
 *   "acres": 3.36,
 *   "description": "MLS public remarks — wrapped, truncated with ellipsis if long",
 *   "mls": "220221088", "status": "Active",
 *   "brokerHighlights": ["Optional", "bullet lines"], // if non-empty, used on hero instead of beds/baths/specs
 *   "headshot": "agent.png",
 *   "agent": { ... }
 * }
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

const COLORS = {
  navy: '#102742',
  cream: '#faf8f4',
  gold: '#C8A864',
  white: '#ffffff',
  charcoal: '#1a1a1a',
}

/** @param {import('@napi-rs/canvas').SKRSContext2D} ctx */
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/**
 * Cover-fit dest rect with extra zoom (crop tighter from center).
 */
function drawCoverZoom(ctx, img, dx, dy, dw, dh, zoom) {
  const iw = img.width
  const ih = img.height
  const z = Math.max(1, zoom)
  const base = Math.max(dw / iw, dh / ih)
  const s = base * z
  const sw = dw / s
  const sh = dh / s
  const sx = Math.max(0, (iw - sw) / 2)
  const sy = Math.max(0, (ih - sh) / 2)
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
}

/**
 * @param {import('@napi-rs/canvas').SKRSContext2D} ctx
 * @param {string} text
 * @param {number} maxW
 * @param {number} maxLines
 */
function wrapText(ctx, text, maxW, maxLines) {
  const raw = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!raw) return []
  const words = raw.split(' ')
  /** @type {string[]} */
  const lines = []
  let i = 0
  while (i < words.length && lines.length < maxLines) {
    let line = ''
    while (i < words.length) {
      const w = words[i]
      const test = line ? `${line} ${w}` : w
      if (ctx.measureText(test).width > maxW && line) break
      line = test
      i++
    }
    if (!line && i < words.length) {
      line = words[i]
      i++
    }
    lines.push(line)
  }

  if (i < words.length && lines.length > 0) {
    let last = lines[lines.length - 1]
    const ell = '…'
    while (last.length > 0 && ctx.measureText(last + ell).width > maxW) {
      last = last.slice(0, -1).trimEnd()
    }
    lines[lines.length - 1] = last + ell
  }

  return lines
}

function registerFlyerFonts() {
  const geistDir = join(REPO_ROOT, 'node_modules/geist/dist/fonts/geist-sans')
  const geistBold = join(geistDir, 'Geist-Bold.ttf')
  const geistRegular = join(geistDir, 'Geist-Regular.ttf')
  const geistSemi = join(geistDir, 'Geist-SemiBold.ttf')
  const azo = join(REPO_ROOT, 'video/market-report/public/AzoSans-Medium.ttf')
  if (existsSync(geistBold)) GlobalFonts.registerFromPath(geistBold, 'Geist-Bold')
  if (existsSync(geistRegular)) GlobalFonts.registerFromPath(geistRegular, 'Geist')
  if (existsSync(geistSemi)) GlobalFonts.registerFromPath(geistSemi, 'Geist-SemiBold')
  if (existsSync(azo)) GlobalFonts.registerFromPath(azo, 'AzoSans')

  let displayFamily = 'Geist-Bold'
  const amboqiaCandidates = [
    process.env.FLYER_FONT_AMBOQIA,
    join(REPO_ROOT, 'video/market-report/public/Amboqia.otf'),
    join(REPO_ROOT, 'video/market-report/public/fonts/Amboqia.otf'),
  ].filter(Boolean)
  for (const p of amboqiaCandidates) {
    if (p && existsSync(p)) {
      GlobalFonts.registerFromPath(/** @type {string} */ (p), 'Amboqia')
      displayFamily = 'Amboqia'
      break
    }
  }
  return { displayFamily }
}

/** @param {number | undefined | null} n */
function formatAcres(n) {
  if (n == null || Number.isNaN(Number(n))) return null
  const a = Number(n)
  const s = a === Math.floor(a) ? String(Math.floor(a)) : String(parseFloat(a.toFixed(2)))
  return `${s} acres`
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      config: { type: 'string' },
      out: { type: 'string' },
    },
    allowPositionals: false,
  })

  if (!values.config) {
    console.error('Usage: node scripts/render-just-listed-flyer.mjs --config path/to/config.json [--out override.png]')
    process.exit(1)
  }

  const cfgPath = resolve(process.cwd(), values.config)
  if (!existsSync(cfgPath)) {
    console.error(`Config not found: ${cfgPath}`)
    process.exit(1)
  }

  /** @type {{
   *   photos: string[]
   *   heroZoom?: number
   *   thumbZoom?: number
   *   address: string
   *   cityLine: string
   *   price: string
   *   beds: number
   *   baths: number
   *   sqft: number
   *   acres?: number
   *   description?: string
   *   mls: string
   *   status: string
   *   brokerHighlights?: string[]
   *   headshot?: string
   *   agent: { name: string, title: string, phone: string, email: string, cta: string, url: string }
   * }} */
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
  const baseDir = dirname(cfgPath)
  const photos = cfg.photos.map((p) => resolve(baseDir, p))
  for (const p of photos) {
    if (!existsSync(p)) {
      console.error(`Photo missing: ${p}`)
      process.exit(1)
    }
  }

  const uniquePaths = new Set(photos.map((p) => resolve(p)))
  if (uniquePaths.size !== photos.length) {
    console.error(
      'Flyer config repeats the same image path. Each entry in config.photos must be a different file (distinct MLS photos). Run: node scripts/fetch-listing-photos-for-flyer.mjs --mls <number> --out-dir out/flyers/<mls>'
    )
    process.exit(1)
  }

  const heroZoom = Number(cfg.heroZoom ?? 1.32)
  const thumbZoom = Number(cfg.thumbZoom ?? 1.12)
  const { displayFamily } = registerFlyerFonts()

  const W = 1080
  const H = 1350
  /** No top bar — stacked logo overlays hero top-right only */
  const HEADER_H = 0
  const GAP = 6
  const FILM_H = photos.length > 1 ? 158 : 0
  const LOGO_OVERLAY_H = 52
  const LOGO_PAD_TOP = 20
  const LOGO_PAD_RIGHT = 22

  const infoPadX = 32
  const descLineH = 21
  const maxDescLines = 9
  /** Full-width MLS description in navy band (specs live on hero overlay). */
  const descW = W - 2 * infoPadX

  /** Pre-measure: navy content + gold rule + white agent bar */
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context missing')

  const acresLabel = formatAcres(cfg.acres)
  /** @type {string[]} */
  const bulletTexts = [
    `${cfg.beds} bedroom${cfg.beds === 1 ? '' : 's'}`,
    `${cfg.baths} bathroom${cfg.baths === 1 ? '' : 's'}`,
    `${Number(cfg.sqft).toLocaleString()} sq ft living`,
  ]
  if (acresLabel) bulletTexts.push(acresLabel)

  const brokerLines =
    Array.isArray(cfg.brokerHighlights) && cfg.brokerHighlights.length > 0
      ? cfg.brokerHighlights.map((s) => String(s).trim()).filter(Boolean)
      : []
  /** Shown on hero lower-right (broker copy wins when provided). */
  const heroOverlayLines = brokerLines.length > 0 ? brokerLines.slice(0, 6) : bulletTexts

  ctx.font = '15px Geist'
  const descLines = wrapText(ctx, cfg.description || '', descW, maxDescLines)
  const descColH = descLines.length * descLineH
  const textBlockH = descColH
  const infoTopPad = 20
  const infoBottomPad = 16
  const GOLD_RULE = 2
  const WHITE_FOOTER_H = 144
  const CONTENT_NAVY_H = infoTopPad + textBlockH + infoBottomPad
  const BOTTOM_TOTAL = CONTENT_NAVY_H + GOLD_RULE + WHITE_FOOTER_H

  const filmGap = FILM_H ? GAP : 0
  const HERO_H = H - HEADER_H - FILM_H - filmGap - BOTTOM_TOTAL - GAP

  const heroImg = await loadImage(photos[0])
  const thumbImgs = photos.length > 1 ? await Promise.all(photos.slice(1, 4).map((p) => loadImage(p))) : []

  const logoPath = join(REPO_ROOT, 'listing_video_v4/public/brand/stacked_logo_white.png')
  /** @type {import('@napi-rs/canvas').Image | null} */
  let logoImg = null
  if (existsSync(logoPath)) {
    logoImg = await loadImage(logoPath)
  }

  const heroY = HEADER_H
  drawCoverZoom(ctx, heroImg, 0, heroY, W, HERO_H, heroZoom)

  // Hero gradient — covers MLS, price, address, city (left) + lower-right scrim
  const gradH = 200
  const gy = heroY + HERO_H - gradH
  const grad = ctx.createLinearGradient(0, gy, 0, heroY + HERO_H)
  grad.addColorStop(0, 'rgba(16,39,66,0)')
  grad.addColorStop(0.55, 'rgba(16,39,66,0.45)')
  grad.addColorStop(1, 'rgba(16,39,66,0.72)')
  ctx.fillStyle = grad
  ctx.fillRect(0, gy, W, heroY + HERO_H - gy)

  // Stacked mark on hero photo, top-right (replaces former navy header bar)
  if (logoImg) {
    const lh = LOGO_OVERLAY_H
    const lw = (logoImg.width / logoImg.height) * lh
    ctx.drawImage(logoImg, W - lw - LOGO_PAD_RIGHT, heroY + LOGO_PAD_TOP, lw, lh)
  }

  // Home or broker highlights — lower-right on hero (scrim for contrast, not a gold price pill)
  const highlightLineH = 26
  const highlightPad = 14
  const highlightFont = '600 16px Geist-SemiBold'
  const bulletGap = 8
  ctx.font = highlightFont
  let maxHighlightW = 0
  for (const line of heroOverlayLines) {
    const tw = ctx.measureText(line).width
    const bw = ctx.measureText('•').width
    maxHighlightW = Math.max(maxHighlightW, tw + bulletGap + bw)
  }
  const scrimW = Math.min(W * 0.48, Math.max(200, maxHighlightW + highlightPad * 2))
  const scrimH = heroOverlayLines.length * highlightLineH + highlightPad * 2
  const scrimX = W - scrimW - 20
  const scrimY = heroY + HERO_H - scrimH - 22
  ctx.fillStyle = 'rgba(16,39,66,0.68)'
  roundRect(ctx, scrimX, scrimY, scrimW, scrimH, 12)
  ctx.fill()
  let hyR = scrimY + highlightPad + 16
  const hxR = scrimX + scrimW - highlightPad
  ctx.textAlign = 'right'
  ctx.font = highlightFont
  for (const line of heroOverlayLines) {
    const tw = ctx.measureText(line).width
    ctx.fillStyle = COLORS.gold
    ctx.fillText('•', hxR - tw - bulletGap, hyR)
    ctx.fillStyle = 'rgba(255,255,255,0.96)'
    ctx.fillText(line, hxR, hyR)
    hyR += highlightLineH
  }
  ctx.textAlign = 'left'

  const hx = 28
  let hy = heroY + HERO_H - 28
  ctx.fillStyle = 'rgba(250,248,244,0.92)'
  ctx.font = '500 16px Geist'
  ctx.fillText(cfg.cityLine, hx, hy)
  hy -= 30
  ctx.font = `600 26px ${displayFamily}`
  ctx.fillStyle = COLORS.white
  ctx.fillText(cfg.address, hx, hy)
  hy -= 32
  ctx.font = '700 22px Geist-Bold'
  ctx.fillStyle = COLORS.white
  ctx.fillText(String(cfg.price), hx, hy)
  hy -= 26
  ctx.font = '600 15px Geist-SemiBold'
  ctx.fillStyle = 'rgba(255,255,255,0.98)'
  ctx.fillText(`MLS ${cfg.mls} · ${cfg.status}`, hx, hy)

  let yAfterHero = heroY + HERO_H

  // Filmstrip — muted band, tighter
  if (FILM_H > 0 && thumbImgs.length > 0) {
    yAfterHero += filmGap
    ctx.fillStyle = '#e5e2db'
    ctx.fillRect(0, yAfterHero, W, FILM_H)
    const pad = 14
    const n = thumbImgs.length
    const gap = 8
    const cell = (W - pad * 2 - gap * (n - 1)) / n
    for (let i = 0; i < n; i++) {
      const x = pad + i * (cell + gap)
      ctx.save()
      roundRect(ctx, x, yAfterHero + 10, cell, FILM_H - 20, 10)
      ctx.clip()
      drawCoverZoom(ctx, thumbImgs[i], x, yAfterHero + 10, cell, FILM_H - 20, thumbZoom)
      ctx.restore()
      ctx.strokeStyle = 'rgba(16,39,66,0.15)'
      ctx.lineWidth = 1.5
      roundRect(ctx, x, yAfterHero + 10, cell, FILM_H - 20, 10)
      ctx.stroke()
    }
    yAfterHero += FILM_H
  }

  yAfterHero += GAP

  // Navy: MLS description only (specs are on hero overlay)
  ctx.fillStyle = COLORS.navy
  ctx.fillRect(0, yAfterHero, W, CONTENT_NAVY_H)

  let dy = yAfterHero + infoTopPad
  ctx.font = '15px Geist'
  ctx.fillStyle = 'rgba(250,248,244,0.9)'
  for (const ln of descLines) {
    ctx.fillText(ln, infoPadX, dy)
    dy += descLineH
  }

  const footBandTop = yAfterHero + CONTENT_NAVY_H
  ctx.fillStyle = COLORS.gold
  ctx.fillRect(0, footBandTop, W, GOLD_RULE)

  const whiteStart = footBandTop + GOLD_RULE
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, whiteStart, W, WHITE_FOOTER_H)

  const brandReserve = 220
  const imgW = 120
  const imgH = 132
  const ix = infoPadX
  const iy = whiteStart + (WHITE_FOOTER_H - imgH) / 2
  let photoAdvance = 0

  if (cfg.headshot) {
    const hp = resolve(baseDir, cfg.headshot)
    if (existsSync(hp)) {
      const face = await loadImage(hp)
      ctx.save()
      roundRect(ctx, ix, iy, imgW, imgH, 2)
      ctx.clip()
      drawCoverZoom(ctx, face, ix, iy, imgW, imgH, 1.08)
      ctx.restore()
      photoAdvance = imgW + 22
    }
  }

  let tx = infoPadX + photoAdvance
  let ty = whiteStart + 40

  const lineIntro = `${cfg.agent.name} | ${cfg.agent.title}`
  const sepChunk = '     ·     '
  const contactOneLine = `${lineIntro}${sepChunk}${cfg.agent.phone}${sepChunk}${cfg.agent.email}`

  ctx.fillStyle = COLORS.navy
  ctx.font = '500 15px Geist'
  const midMaxW = W - tx - infoPadX - brandReserve
  if (ctx.measureText(contactOneLine).width <= midMaxW) {
    ctx.fillText(contactOneLine, tx, ty)
    ty = whiteStart + 66
  } else {
    ctx.font = '600 15px Geist-SemiBold'
    ctx.fillText(lineIntro, tx, ty)
    ty += 22
    ctx.font = '500 14px Geist'
    ctx.fillStyle = 'rgba(26,26,26,0.85)'
    ctx.fillText(`${cfg.agent.phone}  ·  ${cfg.agent.email}`, tx, ty)
    ty = whiteStart + 72
  }

  ctx.fillStyle = COLORS.gold
  ctx.font = '600 14px Geist-SemiBold'
  ctx.fillText(cfg.agent.cta, tx, ty)
  ty += 22

  const url = cfg.agent.url
  ctx.fillStyle = 'rgba(16,39,66,0.58)'
  ctx.font = '400 12px Geist'
  const urlMaxW = W - tx - infoPadX - brandReserve
  let urlDraw = url
  if (ctx.measureText(url).width > urlMaxW) {
    let lo = url
    while (lo.length > 12 && ctx.measureText(lo + '…').width > urlMaxW) lo = lo.slice(0, -1)
    urlDraw = lo + '…'
  }
  ctx.fillText(urlDraw, tx, ty)

  const rx = W - infoPadX
  ctx.textAlign = 'right'
  ctx.fillStyle = COLORS.navy
  ctx.font = '600 20px Geist-Bold'
  ctx.fillText('Ryan Realty', rx, whiteStart + 46)
  ctx.font = '500 13px Geist'
  ctx.fillStyle = 'rgba(26,26,26,0.55)'
  ctx.fillText('Central Oregon', rx, whiteStart + 68)
  ctx.textAlign = 'left'

  const outPath = values.out ? resolve(process.cwd(), values.out) : join(baseDir, 'just-listed-render.png')
  mkdirSync(dirname(outPath), { recursive: true })
  const png = await canvas.encode('png')
  writeFileSync(outPath, png)

  const meta = {
    output: outPath,
    dimensions: { w: W, h: H },
    heroZoom,
    thumbZoom,
    photoCount: photos.length,
    displayFont: displayFamily,
    bottomContentNavyH: CONTENT_NAVY_H,
    whiteFooterH: WHITE_FOOTER_H,
    fontNote:
      displayFamily === 'Amboqia'
        ? 'Amboqia registered for display headlines.'
        : 'Amboqia not found on disk; hero address used Geist. Set FLYER_FONT_AMBOQIA or add Amboqia.otf under video/market-report/public/ for brand display.',
  }
  writeFileSync(join(baseDir, 'fonts_used.json'), `${JSON.stringify(meta, null, 2)}\n`)

  console.log(`Wrote ${outPath}`)
  console.log(meta.fontNote)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
