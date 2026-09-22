/**
 * dog-floater.mjs — SITE-134 / SITE-135 / SITE-146 floating dog CTA lock.
 *
 * Matt 2026-09-19 + Critiquito + Matt phone 2026-09-20: sitewide circle
 * with the INNER dog-head crop (not the wordmark seal). Idle tilt must
 * be visible on a phone (motion in the first 40% of a ≤4s cycle — not a
 * 70% static hold). Head assets are the full-seal knockout (muzzle,
 * ears, crown) with a thin 4–8% pad inside the square before the
 * circle masks — not the 16% fat ring that left a tiny head in an
 * empty disc. CSS contain cannot restore pixels a circular pre-crop
 * already cut. Placement is circle-aware so the left muzzle is not
 * the thing kissing the rim.
 * Click opens five plain doors. Replaces sticky Call / Text /
 * Work-with-us bars. Header Work with us is OUT (SITE-155, Matt 2026-09-21:
 * the dog is that door). Tip Ready --ship and ci:dog-floater refuse a
 * missing floater, a seal FAB, a circular pre-crop, an edge-tight head,
 * cover-crop, frozen idle, a returned phone dock, or Work with us back in
 * the chrome.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

export const DOG_FLOATER_GATE = 'ci:dog-floater'
export const DOG_FLOATER_SCRIPT = 'scripts/check-dog-floater.mjs'
/** SITE-146 rematch #3: thin safety inset (4–8%), not the 16% fat ring. */
export const DOG_HEAD_PAD = 0.06
export const DOG_HEAD_MIN_INSET = 0.04
/** Tightest side ≥ this means the prior fat-pad rematch shipped again. */
export const DOG_HEAD_MAX_MIN_INSET = 0.1
/** Farthest opaque pixel as a fraction of the inscribed-circle radius. */
export const DOG_HEAD_MIN_RADIUS_FILL = 0.88
export const DOG_HEAD_MAX_RADIUS_FILL = 0.97
/** Outer-ray CV below this means the glyph is still a pre-cropped disc. */
export const DOG_HEAD_CIRCULAR_CV_MAX = 0.18

const PATHS = Object.freeze({
  floater: 'components/site/v3/V3DogFloater.client.tsx',
  css: 'components/site/v3/V3DogFloater.css',
  barrel: 'components/site/v3/index.ts',
  layout: 'app/layout.tsx',
  chrome: 'components/site/v3/V3Chrome.tsx',
  dock: 'components/site/v3/V3PhoneDock.client.tsx',
  stickyCss: 'components/site/v3/V3StickyAsk.css',
  listingPage: 'app/listing/[listingKey]/page.tsx',
  builder: 'scripts/build-jax-head.mjs',
  assetNavy: 'public/brand/jax-head-navy.png',
  assetCream: 'public/brand/jax-head-cream.png',
  sealNavy: 'public/brand/jax-navy.png',
  sealWhite: 'public/brand/jax-white.png',
})

/** Cos 2026-09-20: these two files on the repo tree are the crop source. */
export const JAX_HEAD_SEALS = Object.freeze([
  { src: PATHS.sealNavy, dest: PATHS.assetNavy, width: 3635, height: 3417, tint: { r: 16, g: 39, b: 66 } },
  { src: PATHS.sealWhite, dest: PATHS.assetCream, width: 3635, height: 3417, tint: { r: 255, g: 255, b: 255 } },
])

/** Matt permanent lock 2026-09-20: five doors, these strings, this order. Do not shorten. */
export const DOG_FLOATER_DOOR_LABELS = Object.freeze([
  'Sell your home',
  'Buy your home',
  'Text us',
  "Get your home's value",
  'Learn about us',
])

function readRel(root, rel, override) {
  if (typeof override === 'string') return override
  const abs = join(root, rel)
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null
}

export function dogFloaterProblems({ root = process.cwd(), files = {} } = {}) {
  const p = []
  const floater = readRel(root, PATHS.floater, files.floater)
  const css = readRel(root, PATHS.css, files.css)
  const barrel = readRel(root, PATHS.barrel, files.barrel)
  const layout = readRel(root, PATHS.layout, files.layout)
  const chrome = readRel(root, PATHS.chrome, files.chrome)
  const dock = readRel(root, PATHS.dock, files.dock)
  const stickyCss = readRel(root, PATHS.stickyCss, files.stickyCss)
  const listingPage = readRel(root, PATHS.listingPage, files.listingPage)
  const builder = readRel(root, PATHS.builder, files.builder)

  if (floater == null) {
    p.push(`${PATHS.floater}: missing — SITE-134 dog floater is gone.`)
    return p
  }
  if (!floater.includes('export function V3DogFloater')) {
    p.push(`${PATHS.floater}: must export V3DogFloater.`)
  }
  if (!floater.includes('Open Ryan Realty menu')) {
    p.push(`${PATHS.floater}: trigger must name itself (Open Ryan Realty menu).`)
  }
  if (!floater.includes('shouldHidePublicChrome')) {
    p.push(`${PATHS.floater}: must hide on LP / admin / sign / account.`)
  }
  if (!floater.includes('CONTACT.phoneDirectTel')) {
    p.push(`${PATHS.floater}: Text us must use CONTACT.phoneDirectTel. Do not invent a number.`)
  }
  if (!floater.includes("from '@/components/ui/dialog'")) {
    p.push(`${PATHS.floater}: menu must be the catalog Dialog (focus trap + Esc).`)
  }
  if (!floater.includes('DialogTrigger')) {
    p.push(`${PATHS.floater}: FAB must be DialogTrigger so a second tap on the dog closes.`)
  }
  if (!floater.includes('DialogClose') || !floater.includes('Close')) {
    p.push(`${PATHS.floater}: menu must be closable.`)
  }
  if (!floater.includes('v3-dog-floater--listing')) {
    p.push(`${PATHS.floater}: listing paths must mark --listing so the FAB sits above Tour.`)
  }
  if (!/>\s*Help\s*</.test(floater) && !floater.includes('>Help<')) {
    p.push(`${PATHS.floater}: expanded title is Help (or omitted) — not a pun.`)
  }
  p.push(...doorLabelProblems(floater, PATHS.floater))
  if (!floater.includes("href: '/sell'") || !floater.includes("href: '/buy'")) {
    p.push(`${PATHS.floater}: Sell → /sell and Buy → /buy are required.`)
  }
  if (!floater.includes("href: '/sell#get-value'") || !floater.includes("href: '/about'")) {
    p.push(`${PATHS.floater}: Get value → /sell#get-value and Learn about us → /about are required.`)
  }
  if (!/sms:\$\{CONTACT\.phoneDirectTel\}/.test(floater)) {
    p.push(`${PATHS.floater}: Text us door must be sms:\${CONTACT.phoneDirectTel}.`)
  }
  if (!floater.includes('/brand/jax-head-navy.png') || !floater.includes('/brand/jax-head-cream.png')) {
    p.push(`${PATHS.floater}: must paint the inner dog-head crop (jax-head-navy / jax-head-cream), not the wordmark seal.`)
  }
  if (/\bsrc=\{?['"`]\/brand\/jax-(white|navy)\.png/.test(stripComments(floater))) {
    p.push(`${PATHS.floater}: FAB must be the inner dog-head circle, not the full RYAN REALTY seal.`)
  }
  if (/brand-kit\/rasta|blue-dog-transparent|white-dog-trans/.test(floater)) {
    p.push(`${PATHS.floater}: crop source is public/brand/jax-navy.png + jax-white.png. brand-kit/rasta is not on this tree.`)
  }
  if (!floater.includes('data-v3-dog-head="inner"')) {
    p.push(`${PATHS.floater}: trigger must mark the inner-head crop (data-v3-dog-head=inner).`)
  }
  if (!floater.includes('data-v3-dog-idle="tilt"')) {
    p.push(`${PATHS.floater}: head must mark the one quiet tilt (data-v3-dog-idle=tilt).`)
  }
  if (/woof|How can we help|get a take/i.test(floater)) {
    p.push(`${PATHS.floater}: five plain items only — no pun / woof copy.`)
  }

  if (css == null) {
    p.push(`${PATHS.css}: missing.`)
  } else {
    if (!/position:\s*fixed/.test(css) || !/bottom:\s*calc\(var\(--v3-space-md\) \+ env\(safe-area-inset-bottom/.test(css)) {
      p.push(`${PATHS.css}: floater must be fixed bottom-right and safe-area aware.`)
    }
    if (!/right:\s*calc\(var\(--v3-space-md\) \+ env\(safe-area-inset-right/.test(css)) {
      p.push(`${PATHS.css}: floater must clear the iPhone home-indicator / notch side.`)
    }
    if (!/@keyframes v3-dog-tilt/.test(css)) {
      p.push(`${PATHS.css}: dog head must quiet-tilt in CSS (≤4s + pause). No video.`)
    }
    if (!/ease-in-out/.test(css)) {
      p.push(`${PATHS.css}: idle tilt must be ease-in-out, not a bounce ease.`)
    }
    if (!/rotate\(-?[3-6]deg\)/.test(css)) {
      p.push(`${PATHS.css}: idle tilt must stay in the 3–6° range.`)
    }
    p.push(...tiltVisibilityProblems(css, PATHS.css))
    if (/object-fit:\s*cover/.test(css)) {
      p.push(`${PATHS.css}: object-fit:cover crops muzzle/ears — use contain.`)
    }
    if (!/\.v3-dog-floater__dog\s*\{[^}]*object-fit:\s*contain/.test(css)) {
      p.push(`${PATHS.css}: dog image must use object-fit:contain so the full head stays readable.`)
    }
    const headRule = css.match(/\.v3-dog-floater__head\s*\{([^}]*)\}/)
    if (headRule && /overflow:\s*hidden/.test(headRule[1]) && /animation:/.test(headRule[1])) {
      p.push(`${PATHS.css}: do not overflow:hidden on the animated head — iOS reads that pair as frozen. Clip on .v3-dog-floater.`)
    }
    if (!/\.v3-dog-floater\s*\{[^}]*overflow:\s*hidden/.test(css)) {
      p.push(`${PATHS.css}: the circle (.v3-dog-floater) must overflow:hidden so the clip is not on the animated node.`)
    }
    if (/@media[^{]*(hover:\s*none|max-width)[^{]*\{[^}]*v3-dog-floater__head[\s\S]{0,160}animation:\s*none/.test(css)) {
      p.push(`${PATHS.css}: do not treat iOS / hover:none as reduced-motion. Only prefers-reduced-motion: reduce stills the dog.`)
    }
    if (!/scale\(0\.96\)/.test(css)) {
      p.push(`${PATHS.css}: press must scale(0.96).`)
    }
    if (!/@keyframes v3-dog-menu-in/.test(css) || !/180ms/.test(css)) {
      p.push(`${PATHS.css}: menu must rise+fade in 150–220ms with no bounce.`)
    }
    if (!/--v3-travel/.test(css) && !/translateY\((8|9|10|11|12)px\)/.test(css)) {
      p.push(`${PATHS.css}: menu rise must be 8–12px (--v3-travel) with no overshoot.`)
    }
    if (!/v3-dog-floater--listing/.test(css) || !/listing-ask-row/.test(css)) {
      p.push(`${PATHS.css}: listing FAB must offset above .listing-ask-row (Tour inline).`)
    }
    if (/v3-dog-bob|v3-dog-blink|v3-dog-door-in/.test(css)) {
      p.push(`${PATHS.css}: Critiquito idle is one tilt, not bob/blink/stagger.`)
    }
    if (!/prefers-reduced-motion/.test(css)) {
      p.push(`${PATHS.css}: reduced-motion must still the dog.`)
    }
    if (!/border-radius:\s*50%/.test(css)) {
      p.push(`${PATHS.css}: trigger must be a circle.`)
    }
    if (/box-shadow\s*:\s*(?!none)(?![^;]*inset)[^;]*\b\d+px\s+\d+px/i.test(css)) {
      p.push(`${PATHS.css}: no elevation shadow (PUBLIC_UI §6 / ci:one-design-system). Focus ring only.`)
    }
    if (!/z-index:\s*95/.test(css)) {
      p.push(`${PATHS.css}: floater must sit above the cookie chip (z-index 95).`)
    }
    if (!/data-cookie-notice='chip'/.test(css) || !/data-cookie-notice='bar'/.test(css)) {
      p.push(`${PATHS.css}: floater must clear the cookie chip and bar, not sit under Cookies.`)
    }
  }

  if (!existsSync(join(root, PATHS.assetNavy))) {
    p.push(`${PATHS.assetNavy}: missing inner navy dog-head crop.`)
  }
  if (!existsSync(join(root, PATHS.assetCream))) {
    p.push(`${PATHS.assetCream}: missing inner cream dog-head crop.`)
  }
  p.push(...sealSourceProblems(builder, PATHS.builder))

  if (barrel == null || !barrel.includes("from './V3DogFloater.client'")) {
    p.push(`${PATHS.barrel}: V3DogFloater must leave through the v3 barrel.`)
  }

  if (layout == null) {
    p.push(`${PATHS.layout}: missing.`)
  } else {
    if (!layout.includes('<V3DogFloater') || !layout.includes('V3DogFloater')) {
      p.push(`${PATHS.layout}: public layout must mount <V3DogFloater />.`)
    }
    if (/<V3PhoneDock[\s/>]/.test(layout)) {
      p.push(`${PATHS.layout}: sticky V3PhoneDock returned. SITE-134 replaces that bar.`)
    }
  }

  if (chrome == null || /<V3WorkWithUs/.test(chrome)) {
    p.push(`${PATHS.chrome}: header Work with us is out (SITE-155). The dog is that door.`)
  }

  if (listingPage) {
    if (/<ListingBrokerBar/.test(listingPage) || /<ListingMobileContactBar/.test(listingPage)) {
      p.push(`${PATHS.listingPage}: listing sticky Call/Text/Work-with-us bar returned.`)
    }
    if (/<V3PhoneDock[\s/>]/.test(listingPage)) {
      p.push(`${PATHS.listingPage}: listing must not remount V3PhoneDock.`)
    }
  }

  if (stickyCss) {
    if (!/@media \(max-width: 63\.99rem\)\s*\{\s*\.v3-sticky-ask\s*\{[\s\S]{0,80}display:\s*none/.test(stickyCss)) {
      p.push(`${PATHS.stickyCss}: phone sticky Value-my-home bar must stay retired. A bottom dock is refuse.`)
    }
  }

  if (dock && /<V3PhoneDock[\s/>]/.test(layout ?? '')) {
    p.push(`${PATHS.layout}: do not remount the retired phone dock.`)
  }

  return p
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function menuDoorLabels(src) {
  const block = src.match(/export const DOG_FLOATER_MENUS = \[([\s\S]*?)\] as const/)
  if (!block) return null
  return [...block[1].matchAll(/label:\s*(['"])(.*?)\1/g)].map((m) => m[2])
}

function sealSourceProblems(builder, label = PATHS.builder) {
  const p = []
  if (builder == null) {
    p.push(`${label}: missing jax-head extractor.`)
    return p
  }
  if (/brand-kit\/rasta/.test(builder)) {
    p.push(`${label}: brand-kit/rasta is not on the Mini/repo tree. Crop from ${PATHS.sealNavy} and ${PATHS.sealWhite}.`)
  }
  if (!builder.includes(PATHS.sealNavy) || !builder.includes(PATHS.sealWhite)) {
    p.push(`${label}: must crop the inner head from ${PATHS.sealNavy} and ${PATHS.sealWhite}.`)
  }
  if (!builder.includes('DOG_HEAD_PAD')) {
    p.push(`${label}: must use DOG_HEAD_PAD (4–8% thin safety), not a fat ~16% ring.`)
  }
  return p
}

/** Matt lock: exact five door strings, in order. No shorten. No U+2014 in public copy. */
export function doorLabelProblems(floater, label = PATHS.floater) {
  const p = []
  const found = menuDoorLabels(floater)
  if (!found) {
    p.push(`${label}: DOG_FLOATER_MENUS must list the five locked door labels.`)
    return p
  }
  if (found.length !== DOG_FLOATER_DOOR_LABELS.length || found.some((v, i) => v !== DOG_FLOATER_DOOR_LABELS[i])) {
    p.push(
      `${label}: door labels must stay EXACTLY ${DOG_FLOATER_DOOR_LABELS.join(' / ')}. Do not shorten.`,
    )
  }
  const publicSrc = stripComments(floater)
  if (publicSrc.includes('\u2014')) {
    p.push(`${label}: no em dashes (U+2014) in public copy (Matt 2026-09-20).`)
  }
  return p
}

/**
 * SITE-135: the 70% hold at rotate(0) read as no motion on Matt's phone.
 * The first 3–6° peak must land by 40%, and the cycle must stay ≤4s.
 */
export function tiltVisibilityProblems(css, label = PATHS.css) {
  const p = []
  const block = css.match(/@keyframes\s+v3-dog-tilt\s*\{([\s\S]*?)\n\}/)
  if (!block) return p
  const body = block[1]
  if (/0%\s*,\s*70%\s*,\s*100%\s*\{[^}]*rotate\(\s*0deg/.test(body)) {
    p.push(`${label}: idle keyframes must not hold rotate(0) through 70% — that reads as frozen on a phone.`)
  }
  const stops = []
  const re = /((?:[\d.]+%|from|to)(?:\s*,\s*(?:[\d.]+%|from|to))*)\s*\{([^}]*)\}/g
  let m
  while ((m = re.exec(body))) {
    const rot = m[2].match(/rotate\(\s*(-?[\d.]+)deg/)
    const deg = rot ? Number(rot[1]) : 0
    for (const part of m[1].split(',')) {
      const raw = part.trim()
      const pct = raw === 'from' ? 0 : raw === 'to' ? 100 : Number.parseFloat(raw)
      if (Number.isFinite(pct)) stops.push({ pct, deg })
    }
  }
  const firstMove = stops
    .slice()
    .sort((a, b) => a.pct - b.pct)
    .find((s) => Math.abs(s.deg) >= 3)
  if (!firstMove) {
    p.push(`${label}: idle tilt must reach 3–6° so the head is perceptibly moving.`)
  } else if (firstMove.pct > 40) {
    p.push(
      `${label}: first 3–6° tilt is at ${firstMove.pct}% — must move by 40% so @375 / a phone sees it.`,
    )
  }
  const dur = css.match(/animation:\s*v3-dog-tilt\s+([0-9.]+)s/)
  if (dur) {
    const sec = Number(dur[1])
    if (!(sec > 0 && sec <= 4)) {
      p.push(`${label}: idle cycle must be ≤4s (got ${dur[1]}s).`)
    }
  } else if (!/animation:\s*v3-dog-tilt\s+\d{3,4}ms/.test(css)) {
    p.push(`${label}: v3-dog-tilt animation must declare a ≤4s duration.`)
  }
  return p
}

function alphaAt(data, w, h, x, y) {
  if (x < 0 || y < 0 || x >= w || y >= h) return 0
  return data[(y * w + x) * 4 + 3]
}

/**
 * SITE-146: jax-head PNGs must be the full-seal inner head (not a circular
 * pre-crop) with a thin 4–8% pad so the FAB circle cannot eat muzzle/ears
 * and the face still fills the disc (no fat empty ring).
 */
export async function dogHeadCropProblems({ root = process.cwd() } = {}) {
  const p = []
  for (const spec of JAX_HEAD_SEALS) {
    const abs = join(root, spec.src)
    if (!existsSync(abs)) {
      p.push(`${spec.src}: missing full seal. Inner heads crop from this 3635x3417 file.`)
      continue
    }
    const meta = await sharp(abs).metadata()
    if (meta.width !== spec.width || meta.height !== spec.height) {
      p.push(
        `${spec.src}: expected ${spec.width}x${spec.height} full seal, got ${meta.width}x${meta.height}.`,
      )
    }
  }
  for (const rel of [PATHS.assetNavy, PATHS.assetCream]) {
    const abs = join(root, rel)
    if (!existsSync(abs)) continue
    const { data, info } = await sharp(abs).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const { width, height } = info
    const inset = opaqueInsetFromRaw(data, width, height)
    if (inset.edgeHits > 0) {
      p.push(
        `${rel}: opaque head pixels touch the square edge (${inset.edgeHits} px). That is a no-padding crop — muzzle/ears will clip under the circle mask.`,
      )
    }
    const tight = Object.entries(inset.sides).filter(([, v]) => v < DOG_HEAD_MIN_INSET)
    if (tight.length) {
      p.push(
        `${rel}: dog silhouette is too tight (${tight
          .map(([k, v]) => `${k}=${(v * 100).toFixed(1)}%`)
          .join(', ')}). Keep ≥${Math.round(DOG_HEAD_MIN_INSET * 100)}% inset so the circle cannot crop muzzle/ears.`,
      )
    }
    const minSide = Math.min(...Object.values(inset.sides))
    if (minSide >= DOG_HEAD_MAX_MIN_INSET) {
      p.push(
        `${rel}: fat pad (tightest side=${(minSide * 100).toFixed(1)}%). Target 4–8% inside the square so the face fills the FAB, not a tiny head in a ring.`,
      )
    }
    const fill = farthestRadiusFill(data, width, height)
    if (fill != null && fill < DOG_HEAD_MIN_RADIUS_FILL) {
      p.push(
        `${rel}: head does not fill the disc (farthest pixel at ${(fill * 100).toFixed(1)}% of radius). Re-export with a thin 4–8% pad — the 16% ring is refuse.`,
      )
    }
    if (fill != null && fill > DOG_HEAD_MAX_RADIUS_FILL) {
      p.push(
        `${rel}: farthest head pixel is at ${(fill * 100).toFixed(1)}% of the inscribed radius. Leave a thin safety so the circle + idle tilt cannot clip the muzzle.`,
      )
    }
    const cv = outerRayCv(data, width, height)
    if (cv != null && cv < DOG_HEAD_CIRCULAR_CV_MAX) {
      p.push(
        `${rel}: outer contour is a circular pre-crop (cv=${cv.toFixed(3)}). Re-export the inner head from the full seal — do not pad the already-clipped disc.`,
      )
    }
  }
  return p
}

/** Farthest opaque pixel / inscribed-circle radius. ~0.81 was the fat 16% ring. */
export function farthestRadiusFill(data, width, height) {
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  let found = false
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= 16) continue
      found = true
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (!found) return null
  const cx = width / 2
  const cy = height / 2
  const R = Math.min(width, height) / 2
  if (R <= 0) return null
  let max = 0
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= 16) continue
      const d = Math.hypot(x - cx, y - cy)
      if (d > max) max = d
    }
  }
  return max / R
}

function opaqueInsetFromRaw(data, width, height) {
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  let edgeHits = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= 16) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) edgeHits += 1
    }
  }
  return {
    edgeHits,
    sides: {
      left: minX / width,
      top: minY / height,
      right: (width - 1 - maxX) / width,
      bottom: (height - 1 - maxY) / height,
    },
  }
}

/** Coefficient of variation of last-ink radius on rays from the opaque bbox center. */
export function outerRayCv(data, width, height) {
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  let found = false
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= 16) continue
      found = true
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (!found) return null
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const radii = []
  const maxR = Math.hypot(width, height)
  for (let a = 0; a < 360; a += 2) {
    const ux = Math.cos((a * Math.PI) / 180)
    const uy = Math.sin((a * Math.PI) / 180)
    let last = 0
    for (let r = 0; r < maxR; r += 1) {
      const x = Math.round(cx + ux * r)
      const y = Math.round(cy + uy * r)
      if (alphaAt(data, width, height, x, y) > 16) last = r
    }
    if (last > 0) radii.push(last)
  }
  if (radii.length < 24) return null
  const mean = radii.reduce((a, b) => a + b, 0) / radii.length
  if (mean <= 0) return null
  const variance = radii.reduce((a, b) => a + (b - mean) ** 2, 0) / radii.length
  return Math.sqrt(variance) / mean
}
