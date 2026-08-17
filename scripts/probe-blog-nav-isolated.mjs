import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'

const ART = '/opt/cursor/artifacts'
mkdirSync(ART, { recursive: true })
const url = 'https://ryan-realty.com/blog/moving-to-bend-relocation-guide'

const browser = await chromium.launch({ headless: true })
const report = {}
for (const width of [390, 1280]) {
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 900 },
    extraHTTPHeaders: CI_PROBE_HEADERS,
  })
  const extra = []
  context.on('page', (p) => extra.push({ url: p.url(), t: Date.now() }))
  const page = await context.newPage()
  const navs = []
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navs.push({ url: frame.url(), t: Date.now() })
  })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForTimeout(1500)
  const schoolsLinks = await page.evaluate(() => {
    return [...document.querySelectorAll('a')]
      .filter(
        (a) =>
          /school/i.test(a.getAttribute('href') || '') || /school/i.test(a.textContent || ''),
      )
      .map((a) => {
        const r = a.getBoundingClientRect()
        return {
          href: a.getAttribute('href'),
          text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
          y: Math.round(r.y + window.scrollY),
          w: Math.round(r.width),
          h: Math.round(r.height),
        }
      })
  })
  const relatedHrefs = await page.evaluate(() => {
    return [...document.querySelectorAll('#related a, a[href^="/blog/"]')].map((a) => ({
      href: a.getAttribute('href'),
      text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    }))
  })
  const height = await page.evaluate(() => document.body.scrollHeight)
  for (let i = 1; i <= 16; i++) {
    await page.evaluate(
      ({ i, height }) => window.scrollTo(0, Math.round((height * i) / 16)),
      { i, height },
    )
    await page.waitForTimeout(280)
  }
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${ART}/before_moving_nav_isolated_${width}.png` })
  report[width] = {
    start: url,
    end: page.url(),
    navigated: page.url() !== url,
    navsAfterGoto: navs.filter((n) => n.url !== url),
    extra,
    schoolsLinks,
    relatedHrefs,
  }
  await context.close()
}
await browser.close()
console.log(JSON.stringify(report, null, 2))
