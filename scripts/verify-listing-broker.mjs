#!/usr/bin/env node
/**
 * verify-listing-broker.mjs — proves the listing detail page shows ONE broker.
 * Loads 55620 Wagon Master (external-listed → ctaBroker falls back to Matt)
 * twice: once with a Rebecca attribution cookie, once with none. Reports which
 * broker labels render + screenshots both.
 *
 * Expected after the fix:
 *   WITH rebecca cookie → ["Your broker"]            (single card, Rebecca)
 *   NO cookie           → ["Want to see it?"]        (single card, Matt fallback)
 * Before the fix the cookie case showed BOTH "Your broker" + "Want to see it?".
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const URL = process.env.LISTING_URL
  ?? 'https://ryan-realty.com/homes-for-sale/bend/stage-stop-meadows/55620-wagon-master-220223345'
mkdirSync('out', { recursive: true })

const LABELS = /Your broker|Want to see it\?|Listing agent/i

async function run(browser, withCookie) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 })
  if (withCookie) {
    await ctx.addCookies([{
      name: 'rr_agent_attribution',
      value: encodeURIComponent(JSON.stringify({ slug: 'rebecca' })),
      domain: 'ryan-realty.com',
      path: '/',
    }])
  }
  const page = await ctx.newPage()
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(3000) // client cookie-read components settle
  const labels = (await page.locator(`text=${LABELS}`).allTextContents()).map((s) => s.trim()).filter(Boolean)
  const file = `out/listing-${withCookie ? 'rebecca-cookie' : 'no-cookie'}.png`
  await page.screenshot({ path: file })
  await ctx.close()
  console.log(`${withCookie ? 'WITH rebecca cookie' : 'NO cookie       '} → labels: ${JSON.stringify(labels)}  (${file})`)
  return labels
}

const browser = await chromium.launch()
const withCookie = await run(browser, true)
const noCookie = await run(browser, false)
await browser.close()

const ok =
  withCookie.filter((l) => /Want to see it\?/i.test(l)).length === 0 &&
  withCookie.filter((l) => /Your broker/i.test(l)).length === 1 &&
  noCookie.filter((l) => /Want to see it\?/i.test(l)).length === 1 &&
  noCookie.filter((l) => /Your broker/i.test(l)).length === 0
console.log(ok ? '\nPASS — one broker in each case.' : '\nFAIL — broker cards not deduped as expected.')
process.exit(ok ? 0 : 1)
