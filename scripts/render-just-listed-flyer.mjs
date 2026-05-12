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
 *   "brokerHighlights": ["ignored — beds/baths/sqft/acres always from listing on hero"],
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
    join(REPO_ROOT, 'listing_video_v4/public/fonts/Amboqia.otf'),
  ].filter(Boolean)
  for (const p of amboqiaCandidates) {
    if (p && existsSync(p)) {
      GlobalFonts.registerFromPath(/** @type {string} */ (p), 'Amboqia')
      displayFamily = 'Amboqia'
      break
    }
  }
  const hasAmboqia = displayFamily === 'Amboqia'
  return { displayFamily, hasAmboqia }
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
  const { displayFamily, hasAmboqia } = registerFlyerFonts()

  const W = 1080
  const H = 1350
  /** No top bar — stacked logo overlays hero top-right only */
  const HEADER_H = 0
  const GAP = 6
  const FILM_H = photos.length > 1 ? 158 : 0
  const LOGO_OVERLAY_H = 52
  const LOGO_PAD_TOP = 20
  const LOGO_PAD_RIGHT = 22

  /** Footer: 2/3 MLS description + highlights | 1/3 broker (all white). */
  const FOOTER_LEFT_W = Math.floor((W * 2) / 3)
  const FOOTER_RIGHT_W = W - FOOTER_LEFT_W
  const footerLeftPad = 28
  const footerRightPad = 20
  const descLineH = 21
  const maxDescLines = 12
  const descW = FOOTER_LEFT_W - 2 * footerLeftPad
  const infoTopPad = 20
  const infoBottomPad = 20
  const GOLD_RULE = 2

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

  /** Beds/baths/sqft/acres overlay on hero only (not in footer). */
  const heroSpecLines = bulletTexts

  ctx.font = '15px Geist'
  const descLines = wrapText(ctx, cfg.description || '', descW, maxDescLines)
  const descColH = descLines.length * descLineH
  const leftFooterH = infoTopPad + descColH + infoBottomPad

  const hasHeadshot = Boolean(cfg.headshot && existsSync(resolve(baseDir, cfg.headshot)))
  const rightInner = FOOTER_RIGHT_W - 2 * footerRightPad
  let rightFooterH = footerRightPad
  if (hasHeadshot) rightFooterH += 100 + 14
  ctx.font = '600 15px Geist-SemiBold'
  const lineIntro = `${cfg.agent.name} | ${cfg.agent.title}`
  const introLines = wrapText(ctx, lineIntro, rightInner, 3)
  rightFooterH += introLines.length * 20 + 6
  ctx.font = '500 14px Geist'
  rightFooterH += 18
  const emailLines = wrapText(ctx, cfg.agent.email || '', rightInner, 2)
  rightFooterH += emailLines.length * 17 + 10
  rightFooterH += 56
  rightFooterH += footerRightPad

  const FOOTER_H = Math.max(leftFooterH, rightFooterH, 168)
  const BOTTOM_TOTAL = GAP + GOLD_RULE + FOOTER_H

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

  // Hero gradient — MLS, price, address, city (left)
  const gradH = 180
  const gy = heroY + HERO_H - gradH
  const grad = ctx.createLinearGradient(0, gy, 0, heroY + HERO_H)
  grad.addColorStop(0, 'rgba(16,39,66,0)')
  grad.addColorStop(0.55, 'rgba(16,39,66,0.45)')
  grad.addColorStop(1, 'rgba(16,39,66,0.72)')
  ctx.fillStyle = grad
  ctx.fillRect(0, gy, W, heroY + HERO_H - gy)

  // Script-style kicker — top-left (Amboqia when on disk; Geist fallback in meta.fontNote)
  const jlFamily = hasAmboqia ? 'Amboqia' : displayFamily
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.42)'
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 2
  ctx.fillStyle = COLORS.gold
  ctx.font = `400 54px ${jlFamily}`
  ctx.textAlign = 'left'
  ctx.fillText('Just Listed', 24, heroY + 58)
  ctx.restore()

  // Spec line overlay — lower-right on photo (beds, baths, sqft, acres)
  const specLineH = 26
  const specPad = 14
  const specFont = '600 16px Geist-SemiBold'
  ctx.font = specFont
  const bulletGap = 8
  let maxSpecW = 0
  for (const line of heroSpecLines) {
    const tw = ctx.measureText(line).width
    const bw = ctx.measureText('•').width
    maxSpecW = Math.max(maxSpecW, tw + bulletGap + bw)
  }
  const scrSpecW = Math.min(W * 0.46, Math.max(220, maxSpecW + specPad * 2))
  const scrSpecH = heroSpecLines.length * specLineH + specPad * 2
  const scrSpecX = W - scrSpecW - 20
  const scrSpecY = heroY + HERO_H - scrSpecH - 22
  ctx.fillStyle = 'rgba(16,39,66,0.68)'
  roundRect(ctx, scrSpecX, scrSpecY, scrSpecW, scrSpecH, 12)
  ctx.fill()
  let sy = scrSpecY + specPad + 16
  const sxR = scrSpecX + scrSpecW - specPad
  ctx.textAlign = 'right'
  ctx.font = specFont
  for (const line of heroSpecLines) {
    const tw = ctx.measureText(line).width
    ctx.fillStyle = COLORS.gold
    ctx.fillText('•', sxR - tw - bulletGap, sy)
    ctx.fillStyle = 'rgba(255,255,255,0.96)'
    ctx.fillText(line, sxR, sy)
    sy += specLineH
  }
  ctx.textAlign = 'left'

  // Stacked mark on hero photo, top-right (replaces former navy header bar)
  if (logoImg) {
    const lh = LOGO_OVERLAY_H
    const lw = (logoImg.width / logoImg.height) * lh
    ctx.drawImage(logoImg, W - lw - LOGO_PAD_RIGHT, heroY + LOGO_PAD_TOP, lw, lh)
  }

  const hx = 28
  let hy = heroY + HERO_H - 28
  ctx.font = '500 16px Geist'
  ctx.fillStyle = 'rgba(250,248,244,0.92)'
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

  ctx.fillStyle = COLORS.gold
  ctx.fillRect(0, yAfterHero, W, GOLD_RULE)
  const footerY = yAfterHero + GOLD_RULE

  ctx.fillStyle = COLORS.white
  ctx.fillRect(0, footerY, W, FOOTER_H)

  ctx.strokeStyle = 'rgba(16,39,66,0.14)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(FOOTER_LEFT_W, footerY + 10)
  ctx.lineTo(FOOTER_LEFT_W, footerY + FOOTER_H - 10)
  ctx.stroke()

  let ly = footerY + infoTopPad
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(26,26,26,0.88)'
  ctx.font = '15px Geist'
  for (const ln of descLines) {
    ctx.fillText(ln, footerLeftPad, ly)
    ly += descLineH
  }

  const rx0 = FOOTER_LEFT_W
  const rInnerX = rx0 + footerRightPad
  const footerRightYOff = Math.max(0, Math.floor((FOOTER_H - rightFooterH) / 2))
  let ry = footerY + footerRightYOff + footerRightPad
  const imgW = 92
  const imgH = 100

  if (hasHeadshot && cfg.headshot) {
    const hp = resolve(baseDir, cfg.headshot)
    const face = await loadImage(hp)
    const ix = rInnerX + (rightInner - imgW) / 2
    ctx.save()
    roundRect(ctx, ix, ry, imgW, imgH, 4)
    ctx.clip()
    drawCoverZoom(ctx, face, ix, ry, imgW, imgH, 1.08)
    ctx.restore()
    ry += imgH + 14
  }

  ctx.textAlign = 'left'
  ctx.font = '600 15px Geist-SemiBold'
  ctx.fillStyle = COLORS.navy
  for (const ln of introLines) {
    ctx.fillText(ln, rInnerX, ry)
    ry += 20
  }
  ry += 2
  ctx.font = '500 14px Geist'
  ctx.fillStyle = 'rgba(26,26,26,0.88)'
  ctx.fillText(cfg.agent.phone, rInnerX, ry)
  ry += 18
  for (const ln of emailLines) {
    ctx.fillText(ln, rInnerX, ry)
    ry += 17
  }
  ry += 16
  ctx.textAlign = 'center'
  const cx = rx0 + FOOTER_RIGHT_W / 2
  ctx.font = '600 18px Geist-Bold'
  ctx.fillStyle = COLORS.navy
  ctx.fillText('Ryan Realty', cx, ry)
  ry += 22
  ctx.font = '500 12px Geist'
  ctx.fillStyle = 'rgba(26,26,26,0.55)'
  ctx.fillText('Central Oregon', cx, ry)
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
    footerH: FOOTER_H,
    footerSplit: { leftPx: FOOTER_LEFT_W, rightPx: FOOTER_RIGHT_W },
    fontNote: hasAmboqia
      ? 'Amboqia on disk: script Just Listed + display address use heritage face.'
      : 'Add Amboqia.otf (see FLYER_FONT_AMBOQIA or listing_video_v4/public/fonts/) so Just Listed reads in brand script; address falls back to Geist-Bold.',
  }
  writeFileSync(join(baseDir, 'fonts_used.json'), `${JSON.stringify(meta, null, 2)}\n`)

  console.log(`Wrote ${outPath}`)
  console.log(meta.fontNote)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
