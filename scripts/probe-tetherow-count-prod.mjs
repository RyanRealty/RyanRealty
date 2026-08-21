/**
 * Production accept probe for the Tetherow counted-set list.
 * Run after deploy:verify READY. Writes shots under out/tetherow-count-prod/.
 *
 *   node scripts/probe-tetherow-count-prod.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const URL = 'https://ryan-realty.com/communities/tetherow'
const OUT = 'out/tetherow-count-prod'
const ALIAS_SLUGS = new Set([
  'tetherow',
  'triple',
  'triple-knot',
  'tetherow-phase-1',
  'tetherow-phase-2',
  'tetherow-phase-3',
  'tetherow-phase-4',
  'tetherow-phase-5',
  'tetherow-phase-6',
  'tetherow-phase-7',
  'tetherow-cascades-vista-phase-1',
  'tetherow-cascades-vista-phase-2',
  'north-forty-at-tetherow',
  'tetherow-rim',
  'trailhead-at-tetherow',
  'highlands-ridge',
  'outrider-overlook',
])

function listingSlug(href) {
  const m = String(href).match(/\/homes-for-sale\/bend\/([^/?#]+)\//i)
  return m ? m[1].toLowerCase() : null
}

function isInventoryHref(href) {
  const slug = listingSlug(href)
  return Boolean(slug && ALIAS_SLUGS.has(slug))
}

async function shot(page, viewport, name) {
  const errors = []
  page.on('pageerror', (err) => errors.push(String(err)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  await page.setViewportSize(viewport)
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/${name}-hero.png`, fullPage: false })
  const homes = page.locator('#homes')
  if ((await homes.count()) > 0) {
    await homes.scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)
    await homes.screenshot({ path: `${OUT}/${name}-homes.png` })
  }
  const heroText = (await page.locator('.kb-hero, [class*="hero"]').first().innerText().catch(() => '')) || ''
  const bodyText = await page.locator('body').innerText()
  const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href') || ''))
  const homesHrefs = await page.$$eval('#homes a[href]', (as) => as.map((a) => a.getAttribute('href') || ''))
  const heroCta = await page
    .locator('a.btn')
    .filter({ hasText: /See Tetherow homes/i })
    .first()
    .getAttribute('href')
    .catch(() => null)
  const featuredCta = await page
    .locator('a[href="#homes"]')
    .filter({ hasText: /See (every|all \d+) Tetherow home/i })
    .first()
    .getAttribute('href')
    .catch(() => null)
  const listRows = await page.locator('#homes ul li a[href*="/homes-for-sale/"]').count()
  return {
    viewport,
    heroText: heroText.slice(0, 400),
    heroHas35: /35\s+homes for sale/i.test(heroText) || /35\s+homes for sale/i.test(bodyText),
    heroCta,
    featuredCta,
    listRows,
    homesInventoryUnique: [...new Set(homesHrefs.filter(isInventoryHref))],
    pageInventoryUnique: [...new Set(hrefs.filter(isInventoryHref))],
    tetherowOnlyUnique: [...new Set(hrefs.filter((h) => /\/homes-for-sale\/bend\/tetherow\//i.test(h)))],
    consoleErrors: errors,
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const desktopPage = await browser.newPage()
  const desktop = await shot(desktopPage, { width: 1280, height: 900 }, '1280')
  await desktopPage.close()
  const mobilePage = await browser.newPage()
  const mobile = await shot(mobilePage, { width: 390, height: 844 }, '390')
  await mobilePage.close()
  await browser.close()
  const report = {
    url: URL,
    fetchedAt: new Date().toISOString(),
    desktop: {
      ...desktop,
      homesInventoryUnique: desktop.homesInventoryUnique.length,
      pageInventoryUnique: desktop.pageInventoryUnique.length,
      tetherowOnlyUnique: desktop.tetherowOnlyUnique.length,
      homesInventorySample: desktop.homesInventoryUnique.slice(0, 8),
    },
    mobile: {
      ...mobile,
      homesInventoryUnique: mobile.homesInventoryUnique.length,
      pageInventoryUnique: mobile.pageInventoryUnique.length,
      tetherowOnlyUnique: mobile.tetherowOnlyUnique.length,
    },
  }
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  const listOk = desktop.listRows >= 30 && Math.abs(desktop.listRows - 35) <= 5
  const ctaOk = desktop.heroCta === '#homes' && desktop.featuredCta === '#homes'
  if (!desktop.heroHas35 || !listOk || !ctaOk) {
    console.error('ACCEPT FAIL', { heroHas35: desktop.heroHas35, listRows: desktop.listRows, ctaOk })
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
