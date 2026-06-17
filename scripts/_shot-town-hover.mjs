import { chromium } from 'playwright'

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--ignore-gpu-blocklist'],
})
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' })
const page = await ctx.newPage()
await page.goto('http://localhost:3010/', { waitUntil: 'load', timeout: 60000 }).catch((e) => console.log('warn', e.message))
await page.waitForTimeout(2000)
const towns = page.locator('#towns')
await towns.scrollIntoViewIfNeeded()
await page.waitForTimeout(800)
const sunriver = page.locator('.town-row', { hasText: 'Sunriver' })
await sunriver.hover()
await page.waitForTimeout(900) // let the fill reveal
await towns.screenshot({ path: '/tmp/kb-towns-sunriver-hover.png' })
console.log('OK /tmp/kb-towns-sunriver-hover.png')
await ctx.close()
await browser.close()
