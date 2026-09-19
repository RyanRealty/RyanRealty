/**
 * dog-floater.mjs — SITE-134 floating dog CTA lock.
 *
 * Matt 2026-09-19: sitewide navy circle with the logo dog head. Click opens
 * a five-door menu. Replaces sticky Call / Text / Work-with-us bars.
 * Header Work with us stays. Tip Ready --ship and ci:dog-floater refuse
 * a missing floater or a returned phone dock.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const DOG_FLOATER_GATE = 'ci:dog-floater'
export const DOG_FLOATER_SCRIPT = 'scripts/check-dog-floater.mjs'

const PATHS = Object.freeze({
  floater: 'components/site/v3/V3DogFloater.client.tsx',
  css: 'components/site/v3/V3DogFloater.css',
  barrel: 'components/site/v3/index.ts',
  layout: 'app/layout.tsx',
  chrome: 'components/site/v3/V3Chrome.tsx',
  dock: 'components/site/v3/V3PhoneDock.client.tsx',
  stickyCss: 'components/site/v3/V3StickyAsk.css',
  listingPage: 'app/listing/[listingKey]/page.tsx',
  asset: 'public/brand/jax-white.png',
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
  if (!floater.includes('DialogClose') || !floater.includes('Close')) {
    p.push(`${PATHS.floater}: menu must be closable.`)
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
  if (!floater.includes('/brand/jax-white.png')) {
    p.push(`${PATHS.floater}: must paint the inner dog head from /brand/jax-white.png.`)
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
    if (!/@keyframes v3-dog-bob/.test(css) || !/@keyframes v3-dog-blink/.test(css)) {
      p.push(`${PATHS.css}: dog head must bob/tilt/blink in CSS (no video).`)
    }
    if (!/prefers-reduced-motion/.test(css)) {
      p.push(`${PATHS.css}: reduced-motion must still the dog.`)
    }
    if (!/border-radius:\s*50%/.test(css)) {
      p.push(`${PATHS.css}: trigger must be a circle.`)
    }
  }

  if (!existsSync(join(root, PATHS.asset))) {
    p.push(`${PATHS.asset}: missing dog-head asset.`)
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
