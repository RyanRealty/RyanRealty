/**
 * dog-floater.mjs — SITE-134 / SITE-135 floating dog CTA lock.
 *
 * Matt 2026-09-19 + Critiquito + Matt phone 2026-09-20: sitewide circle
 * with the INNER dog-head crop (not the wordmark seal). Idle tilt must
 * be visible on a phone (motion in the first 40% of a ≤4s cycle — not a
 * 70% static hold). Head uses object-fit:contain + padded jax-head
 * assets so muzzle/ears stay inside the circle. Click opens five plain
 * doors. Replaces sticky Call / Text / Work-with-us bars. Header Work
 * with us stays. Tip Ready --ship and ci:dog-floater refuse a missing
 * floater, a seal FAB, cover-crop, frozen idle, or a returned phone dock.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

export const DOG_FLOATER_GATE = 'ci:dog-floater'
export const DOG_FLOATER_SCRIPT = 'scripts/check-dog-floater.mjs'
/** SITE-135: opaque head pixels must sit inside this inset so a circle clip cannot eat muzzle/ears. */
export const DOG_HEAD_MIN_INSET = 0.1

const PATHS = Object.freeze({
  floater: 'components/site/v3/V3DogFloater.client.tsx',
  css: 'components/site/v3/V3DogFloater.css',
  barrel: 'components/site/v3/index.ts',
  layout: 'app/layout.tsx',
  chrome: 'components/site/v3/V3Chrome.tsx',
  dock: 'components/site/v3/V3PhoneDock.client.tsx',
  stickyCss: 'components/site/v3/V3StickyAsk.css',
  listingPage: 'app/listing/[listingKey]/page.tsx',
  assetNavy: 'public/brand/jax-head-navy.png',
  assetCream: 'public/brand/jax-head-cream.png',
})

const DOOR_LABELS = [
  'Sell your home',
  'Buy your home',
  'Text us',
  "Get your home's value",
  'Learn about us',
]

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
  for (const label of DOOR_LABELS) {
    if (!floater.includes(label)) {
      p.push(`${PATHS.floater}: menu must include the label "${label}".`)
    }
  }
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
  if (floater.includes('/brand/jax-white.png') || floater.includes('/brand/jax-navy.png')) {
    p.push(`${PATHS.floater}: FAB must be the inner dog-head circle, not the full RYAN REALTY seal.`)
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

  if (chrome == null || !chrome.includes('<V3WorkWithUs surface="chrome" placement="chrome"')) {
    p.push(`${PATHS.chrome}: header Work with us must stay.`)
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

async function opaqueInset(abs) {
  const { data, info } = await sharp(abs).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 16) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  return {
    left: minX / width,
    top: minY / height,
    right: (width - 1 - maxX) / width,
    bottom: (height - 1 - maxY) / height,
  }
}

/** SITE-135: jax-head PNGs must keep muzzle/ears inside the circle (not edge-tight). */
export async function dogHeadCropProblems({ root = process.cwd() } = {}) {
  const p = []
  for (const rel of [PATHS.assetNavy, PATHS.assetCream]) {
    const abs = join(root, rel)
    if (!existsSync(abs)) continue
    const inset = await opaqueInset(abs)
    const tight = Object.entries(inset).filter(([, v]) => v < DOG_HEAD_MIN_INSET)
    if (tight.length) {
      p.push(
        `${rel}: dog silhouette is too tight (${tight
          .map(([k, v]) => `${k}=${(v * 100).toFixed(1)}%`)
          .join(', ')}). Keep ≥${Math.round(DOG_HEAD_MIN_INSET * 100)}% inset so the circle cannot crop muzzle/ears.`,
      )
    }
  }
  return p
}
