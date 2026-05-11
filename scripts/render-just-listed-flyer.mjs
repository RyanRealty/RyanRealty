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
 *   "photos": ["hero.jpg", "kitchen.jpg", "living.jpg", "rear.jpg"],
 *   "heroZoom": 1.35,
 *   "thumbZoom": 1.12,
 *   "address": "5663 SW Impala Avenue",
 *   "cityLine": "Redmond, OR 97756",
 *   "price": "$650,000",
 *   "beds": 4, "baths": 2, "sqft": 1903,
 *   "mls": "220221088", "status": "Active",
 *   "headshot": "agent.png",
 *   "agent": { "name": "...", "title": "Broker", "phone": "...", "email": "...", "cta": "...", "url": "..." }
 * }
 *
 * First photo = hero (cover fit + zoom). Remaining photos = filmrow (max 3).
 * If only one photo, hero expands and filmrow is omitted.
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
 * zoom 1 = standard cover; 1.35 = punch in ~35%.
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
  return { displayFamily, hasAzo: existsSync(azo) }
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
   *   mls: string
   *   status: string
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

  const heroZoom = Number(cfg.heroZoom ?? 1.32)
  const thumbZoom = Number(cfg.thumbZoom ?? 1.12)
  const fontInfo = registerFlyerFonts()
  const displayFamily = fontInfo.displayFamily

  const W = 1080
  const H = 1350
  const HEADER_H = 82
  const FOOTER_H = 156
  const SPECS_H = 248
  const GAP = 12
  const FILM_H = photos.length > 1 ? 186 : 0
  const HERO_H = H - HEADER_H - FOOTER_H - SPECS_H - GAP - (FILM_H ? FILM_H + GAP : 0)

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context missing')

  const heroImg = await loadImage(photos[0])
  const thumbImgs = photos.length > 1 ? await Promise.all(photos.slice(1, 4).map((p) => loadImage(p))) : []

  // Header
  ctx.fillStyle = COLORS.navy
  ctx.fillRect(0, 0, W, HEADER_H)
  ctx.fillStyle = COLORS.gold
  ctx.font = fontInfo.hasAzo ? '600 22px AzoSans' : '600 22px Geist-Bold'
  ctx.fillText('JUST LISTED', 28, 38)
  ctx.fillStyle = 'rgba(250,248,244,0.92)'
  ctx.font = '500 15px Geist'
  ctx.fillText('Ryan Realty | Central Oregon', 28, 62)

  const logoPath = join(REPO_ROOT, 'listing_video_v4/public/brand/stacked_logo_white.png')
  if (existsSync(logoPath)) {
    const logo = await loadImage(logoPath)
    const lh = 52
    const lw = (logo.width / logo.height) * lh
    ctx.drawImage(logo, W - lw - 24, (HEADER_H - lh) / 2, lw, lh)
  }

  // Hero
  const heroY = HEADER_H
  drawCoverZoom(ctx, heroImg, 0, heroY, W, HERO_H, heroZoom)

  // Bottom hero gradient for legibility
  const gy = heroY + HERO_H - 120
  const grad = ctx.createLinearGradient(0, gy, 0, heroY + HERO_H)
  grad.addColorStop(0, 'rgba(16,39,66,0)')
  grad.addColorStop(1, 'rgba(16,39,66,0.55)')
  ctx.fillStyle = grad
  ctx.fillRect(0, gy, W, heroY + HERO_H - gy)

  ctx.fillStyle = COLORS.white
  ctx.font = `600 28px ${displayFamily}`
  ctx.fillText(cfg.address, 28, heroY + HERO_H - 78)
  ctx.font = '500 17px Geist'
  ctx.fillText(cfg.cityLine, 28, heroY + HERO_H - 48)

  // Price pill
  const priceText = cfg.price
  ctx.font = '700 26px Geist-Bold'
  const pw = ctx.measureText(priceText).width + 48
  const px = W - pw - 24
  const py = heroY + HERO_H - 70
  ctx.fillStyle = COLORS.gold
  roundRect(ctx, px, py, pw, 44, 10)
  ctx.fill()
  ctx.fillStyle = COLORS.navy
  ctx.fillText(priceText, px + 24, py + 30)

  let yAfterHero = heroY + HERO_H

  // Filmstrip
  if (FILM_H > 0 && thumbImgs.length > 0) {
    yAfterHero += GAP
    ctx.fillStyle = COLORS.cream
    ctx.fillRect(0, yAfterHero, W, FILM_H)
    const pad = 18
    const n = thumbImgs.length
    const gap = 10
    const cell = (W - pad * 2 - gap * (n - 1)) / n
    for (let i = 0; i < n; i++) {
      const x = pad + i * (cell + gap)
      ctx.save()
      roundRect(ctx, x, yAfterHero + 14, cell, FILM_H - 28, 12)
      ctx.clip()
      drawCoverZoom(ctx, thumbImgs[i], x, yAfterHero + 14, cell, FILM_H - 28, thumbZoom)
      ctx.restore()
      ctx.strokeStyle = 'rgba(16,39,66,0.12)'
      ctx.lineWidth = 2
      roundRect(ctx, x, yAfterHero + 14, cell, FILM_H - 28, 12)
      ctx.stroke()
    }
    yAfterHero += FILM_H
  }

  // Specs
  yAfterHero += GAP
  ctx.fillStyle = COLORS.cream
  ctx.fillRect(0, yAfterHero, W, SPECS_H)

  const cards = [
    [`${cfg.beds} beds`, 'Bedrooms'],
    [`${cfg.baths} baths`, 'Bathrooms'],
    [`${Number(cfg.sqft).toLocaleString()} sq ft`, 'Living area'],
    [`MLS ${cfg.mls}`, cfg.status],
  ]
  const cPad = 20
  const cGap = 12
  const cW = (W - cPad * 2 - cGap * 3) / 4
  const cTop = yAfterHero + 22
  const cH = SPECS_H - 44
  cards.forEach((pair, i) => {
    const cx = cPad + i * (cW + cGap)
    ctx.fillStyle = COLORS.white
    roundRect(ctx, cx, cTop, cW, cH, 14)
    ctx.fill()
    ctx.strokeStyle = 'rgba(16,39,66,0.08)'
    ctx.lineWidth = 1
    roundRect(ctx, cx, cTop, cW, cH, 14)
    ctx.stroke()
    ctx.fillStyle = COLORS.navy
    ctx.font = '600 20px Geist-SemiBold'
    ctx.fillText(pair[0], cx + 16, cTop + 44)
    ctx.fillStyle = 'rgba(26,26,26,0.55)'
    ctx.font = '500 13px Geist'
    ctx.fillText(pair[1], cx + 16, cTop + 72)
  })

  yAfterHero += SPECS_H

  // Footer
  ctx.fillStyle = COLORS.navy
  ctx.fillRect(0, yAfterHero, W, FOOTER_H)
  let tx = 28
  if (cfg.headshot) {
    const hp = resolve(baseDir, cfg.headshot)
    if (existsSync(hp)) {
      const face = await loadImage(hp)
      const d = 96
      const fy = yAfterHero + (FOOTER_H - d) / 2
      const fx = 24
      ctx.save()
      ctx.beginPath()
      ctx.arc(fx + d / 2, fy + d / 2, d / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(face, fx, fy, d, d)
      ctx.restore()
      ctx.strokeStyle = 'rgba(200,168,100,0.5)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(fx + d / 2, fy + d / 2, d / 2, 0, Math.PI * 2)
      ctx.stroke()
      tx = fx + d + 22
    }
  }

  ctx.fillStyle = COLORS.white
  ctx.font = '600 22px Geist-Bold'
  ctx.fillText(`${cfg.agent.name} | ${cfg.agent.title}`, tx, yAfterHero + 46)
  ctx.font = '500 15px Geist'
  ctx.fillText(cfg.agent.phone, tx, yAfterHero + 72)
  ctx.fillText(cfg.agent.email, tx, yAfterHero + 94)
  ctx.fillStyle = COLORS.gold
  ctx.font = '600 14px Geist-SemiBold'
  ctx.fillText(cfg.agent.cta, tx, yAfterHero + 122)
  ctx.fillStyle = 'rgba(250,248,244,0.75)'
  ctx.font = '400 11px Geist'
  const url = cfg.agent.url
  const maxW = W - tx - 24
  let shown = url
  if (ctx.measureText(url).width > maxW) {
    shown = url.slice(0, 56) + '…'
  }
  ctx.fillText(shown, tx, yAfterHero + 142)

  const outPath = values.out ? resolve(process.cwd(), values.out) : join(baseDir, 'just-listed-render.png')
  mkdirSync(dirname(outPath), { recursive: true })
  const png = await canvas.encode('png')
  writeFileSync(outPath, png)

  const slug = dirname(cfgPath).split('/').pop() || 'flyer'
  const meta = {
    output: outPath,
    dimensions: { w: W, h: H },
    heroZoom,
    thumbZoom,
    photoCount: photos.length,
    displayFont: displayFamily,
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
