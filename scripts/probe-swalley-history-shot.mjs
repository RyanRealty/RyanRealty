#!/usr/bin/env node
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const ART = '/opt/cursor/artifacts'
const URL = 'https://ryan-realty.com/homes-for-sale/bend/65255-swalley-220207865'

async function main() {
  mkdirSync(ART, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  for (const [w, h] of [
    [390, 844],
    [1280, 800],
  ]) {
    const context = await browser.newContext({
      viewport: { width: w, height: h },
      userAgent: 'rr-ci-probe/1.0 (+https://ryan-realty.com/robots.txt)',
    })
    const page = await context.newPage()
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(2000)
    for (const label of ['Accept all', 'Essential only', 'Not now']) {
      const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first()
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 2000 }).catch(() => {})
        await page.waitForTimeout(400)
      }
    }
    const found = await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2')].find((n) => /Listing history/i.test(n.textContent || ''))
      el?.scrollIntoView({ block: 'start' })
      return {
        found: Boolean(el),
        text: (document.body.innerText || '').includes('ListPrice: 14900000'),
        threeMil: /3,000,000 down/.test(document.body.innerText || ''),
      }
    })
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${ART}/before_swalley_${w}_listing_history.png`, fullPage: false })
    console.log(JSON.stringify({ w, ...found }))
    await context.close()
  }
  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
