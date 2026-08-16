/**
 * Production accept probe for one published Tetherow HOA annual.
 * Run after deploy:verify READY. Writes shots under out/tetherow-hoa-prod/
 * and /opt/cursor/artifacts/ when that dir exists.
 *
 *   node scripts/probe-tetherow-hoa-prod.mjs
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const URL = 'https://ryan-realty.com/communities/tetherow'
const OUT = 'out/tetherow-hoa-prod'
const ART = '/opt/cursor/artifacts'

function extract(html, text) {
  const glance = text.match(/Master HOA\s*\$([0-9,]+)\/yr/i)
  const faq = text.match(/annual HOA fees in Tetherow start around \$([0-9,]+)/i)
  const jsonLd = [...html.matchAll(/annual HOA fees in Tetherow start around \$([0-9,]+)/gi)].map(
    (m) => m[1],
  )
  return {
    glanceAnnual: glance?.[1] ?? null,
    faqAnnual: faq?.[1] ?? null,
    has2244: /2,244/.test(text) || /2,244/.test(html),
    has1464: /1,464/.test(text) || /1,464/.test(html),
    jsonLdAnnuals: [...new Set(jsonLd)],
  }
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
  const html = await page.content()
  const text = await page.locator('body').innerText()
  const glance = page.locator('.ov-fact, dt').filter({ hasText: /Master HOA/i }).first()
  if ((await glance.count()) > 0) {
    await glance.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
  }
  await page.screenshot({ path: `${OUT}/${name}_overview.png`, fullPage: false })
  const faq = page.locator('h3, dt').filter({ hasText: /Does Tetherow have an HOA/i }).first()
  if ((await faq.count()) > 0) {
    await faq.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/${name}_faq.png`, fullPage: false })
  }
  return { viewport, ...extract(html, text), consoleErrors: errors }
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
  const report = { url: URL, fetchedAt: new Date().toISOString(), desktop, mobile }
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  try {
    mkdirSync(ART, { recursive: true })
    for (const name of ['1280_overview', '1280_faq', '390_overview', '390_faq']) {
      copyFileSync(`${OUT}/${name}.png`, `${ART}/tetherow_hoa_${name}.png`)
    }
  } catch {
    // artifacts dir may be missing in some environments
  }
  const ok =
    desktop.glanceAnnual === '1,464' &&
    desktop.faqAnnual === '1,464' &&
    mobile.glanceAnnual === '1,464' &&
    mobile.faqAnnual === '1,464' &&
    !desktop.has2244 &&
    !mobile.has2244
  if (!ok) {
    console.error('ACCEPT FAIL')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
