/**
 * dog-floater.mjs — SITE-153 floating dog CTA lock (crop: SITE-146).
 *
 * Matt 2026-09-21: mid-end (not the cream-on-cream cookie corner), brief
 * flip/spin/invert (not a continuous idle), six doors, click the dog to
 * toggle, no Close link. Inner head crop stays the SITE-146 lock.
 * Header Work with us is SITE-155 — this gate does not police V3Chrome.
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

/** Matt lock 2026-09-21: six doors, these strings, this order. Do not shorten. */
export const DOG_FLOATER_DOOR_LABELS = Object.freeze([
  'List your home',
  'Read our reviews',
  'Give us a call',
  'Send us a message',
  "Get your home's value",
  'Learn more about us',
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
    p.push(`${PATHS.floater}: Give us a call must use CONTACT.phoneDirectTel. Do not invent a number.`)
  }
  if (!floater.includes("from '@/components/ui/dialog'")) {
    p.push(`${PATHS.floater}: menu must be the catalog Dialog (focus trap + Esc).`)
  }
  if (!floater.includes('DialogTrigger')) {
    p.push(`${PATHS.floater}: FAB must be DialogTrigger so a second tap on the dog closes.`)
  }
  if (!/modal=\{false\}/.test(floater)) {
    p.push(`${PATHS.floater}: Dialog must be modal={false} so the dog is not inert while open.`)
  }
  if (/<DialogClose\b/.test(floater) || /v3-dog-floater-menu__close/.test(floater)) {
    p.push(`${PATHS.floater}: no Close link — click the dog to toggle.`)
  }
  if (/>\s*Close\s*</.test(stripComments(floater))) {
    p.push(`${PATHS.floater}: no Close link in the menu.`)
  }
  if (!floater.includes('data-v3-dog-place="mid-end"')) {
    p.push(`${PATHS.floater}: trigger must mark mid-end placement (data-v3-dog-place=mid-end).`)
  }
  if (!/>\s*Help\s*</.test(floater) && !floater.includes('>Help<')) {
    p.push(`${PATHS.floater}: expanded title is Help (or omitted) — not a pun.`)
  }
  p.push(...doorLabelProblems(floater, PATHS.floater))
  if (!floater.includes("href: '/sell'") || !floater.includes("href: '/reviews'")) {
    p.push(`${PATHS.floater}: List your home → /sell and Read our reviews → /reviews are required.`)
  }
  if (!floater.includes("href: '/contact'") || !floater.includes("href: '/sell#get-value'") || !floater.includes("href: '/about'")) {
    p.push(`${PATHS.floater}: Send us a message → /contact, Get value → /sell#get-value, Learn more about us → /about.`)
  }
  if (!/tel:\$\{CONTACT\.phoneDirectTel\}/.test(floater)) {
    p.push(`${PATHS.floater}: Give us a call door must be tel:\${CONTACT.phoneDirectTel}.`)
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
  if (!floater.includes('data-v3-dog-idle="notice"')) {
    p.push(`${PATHS.floater}: head must mark the brief notice motion (data-v3-dog-idle=notice).`)
  }
  if (/woof|How can we help|get a take/i.test(floater)) {
    p.push(`${PATHS.floater}: six plain items only — no pun / woof copy.`)
  }

  if (css == null) {
    p.push(`${PATHS.css}: missing.`)
  } else {
    if (!/position:\s*fixed/.test(css)) {
      p.push(`${PATHS.css}: floater must be position:fixed.`)
    }
    if (!/\.v3-dog-floater\s*\{[^}]*top:\s*50%/.test(css)) {
      p.push(`${PATHS.css}: floater must sit mid-end (top: 50%), not the bottom-end cookie corner.`)
    }
    if (/\.v3-dog-floater\s*\{[^}]*bottom:\s*calc/.test(css) || /--v3-dog-fab-bottom/.test(css)) {
      p.push(`${PATHS.css}: do not pin the FAB to the bottom edge or rest it on the cookie bar.`)
    }
    if (/cookie-bar-h/.test(css)) {
      p.push(`${PATHS.css}: do not rest the FAB on --v3-cookie-bar-h (cream-on-cream). Mid-end clears consent chrome.`)
    }
    if (!/right:\s*calc\(var\(--v3-space-md\) \+ env\(safe-area-inset-right/.test(css)) {
      p.push(`${PATHS.css}: floater must clear the iPhone home-indicator / notch side.`)
    }
    if (!/@keyframes v3-dog-notice/.test(css)) {
      p.push(`${PATHS.css}: dog head must brief-notice in CSS (flip/spin/invert). No video.`)
    }
    if (!/rotateY\(/.test(css)) {
      p.push(`${PATHS.css}: notice motion must flip (rotateY).`)
    }
    if (!/rotate\(360deg\)/.test(css)) {
      p.push(`${PATHS.css}: notice motion must spin (rotate(360deg)).`)
    }
    if (!/invert\(/.test(css) && !/@keyframes v3-dog-notice-disc/.test(css)) {
      p.push(`${PATHS.css}: notice motion must invert (filter invert, or navy/cream disc swap).`)
    }
    if (!/ease-in-out/.test(css)) {
      p.push(`${PATHS.css}: notice motion must be ease-in-out, not a bounce ease.`)
    }
    p.push(...noticeMotionProblems(css, PATHS.css))
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
    if (!/min-width:\s*var\(--v3-tap\)/.test(css) || !/min-height:\s*var\(--v3-tap\)/.test(css)) {
      p.push(`${PATHS.css}: tap target must be at least --v3-tap (44px).`)
    }
    if (!/@keyframes v3-dog-menu-in/.test(css) || !/180ms/.test(css)) {
      p.push(`${PATHS.css}: menu must rise+fade in 150–220ms with no bounce.`)
    }
    if (!/--v3-travel/.test(css) && !/translateY\((8|9|10|11|12)px\)/.test(css)) {
      p.push(`${PATHS.css}: menu rise must be 8–12px (--v3-travel) with no overshoot.`)
    }
    if (/v3-dog-bob|v3-dog-blink|v3-dog-door-in|v3-dog-tilt/.test(css)) {
      p.push(`${PATHS.css}: SITE-153 motion is a brief flip/spin/invert, not tilt/bob/blink.`)
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
    if (!/v3-dog-floater-scrim[\s\S]{0,280}pointer-events:\s*none/.test(css)) {
      p.push(`${PATHS.css}: scrim must use pointer-events:none so a second tap on the dog closes.`)
    }
    if (!/background:\s*var\(--v3-navy\)/.test(css)) {
      p.push(`${PATHS.css}: default disc is navy (not cream-on-cream).`)
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

/** Matt lock: exact six door strings, in order. No shorten. No U+2014 in public copy. */
export function doorLabelProblems(floater, label = PATHS.floater) {
  const p = []
  const found = menuDoorLabels(floater)
  if (!found) {
    p.push(`${label}: DOG_FLOATER_MENUS must list the six locked door labels.`)
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
 * SITE-153: brief flip/spin/invert. A loop (infinite) is refuse.
 * One play, duration ≤2s. Continuous idle tilt is gone.
 */
export function noticeMotionProblems(css, label = PATHS.css) {
  const p = []
  const decls = css.match(/animation:\s*v3-dog-notice(?!-)[^;]*/g) ?? []
  if (!decls.length) {
    p.push(`${label}: v3-dog-notice animation must declare a brief duration.`)
    return p
  }
  for (const decl of decls) {
    if (/\binfinite\b/.test(decl)) {
      p.push(`${label}: notice motion must be brief, not continuous (no infinite).`)
    }
    const sec = decl.match(/v3-dog-notice\s+([0-9.]+)s/)
    const ms = decl.match(/v3-dog-notice\s+(\d{3,4})ms/)
    const duration = sec ? Number(sec[1]) : ms ? Number(ms[1]) / 1000 : null
    if (duration == null) {
      p.push(`${label}: v3-dog-notice animation must declare a ≤2s duration.`)
    } else if (!(duration > 0 && duration <= 2)) {
      p.push(`${label}: notice play must be ≤2s (got ${duration}s).`)
    }
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
