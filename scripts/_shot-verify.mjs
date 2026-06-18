import { chromium } from 'playwright'

const b = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--ignore-gpu-blocklist'],
})
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: UA, reducedMotion: 'no-preference' })
const p = await ctx.newPage()
await p.goto('http://localhost:3010/cities/bend', { waitUntil: 'load', timeout: 60000 }).catch((e) => console.log('warn', e.message))
await p.waitForTimeout(2500)

// dismiss cookie banner if present
await p.getByRole('button', { name: /essential only|accept all/i }).first().click().catch(() => {})
await p.waitForTimeout(400)

// open the menu
await p.getByRole('button', { name: /open menu|menu \+/i }).first().click().catch(() => {})
await p.waitForTimeout(1100)
await p.screenshot({ path: '/tmp/v-menu.png' })
console.log('OK /tmp/v-menu.png')
await p.keyboard.press('Escape')
await p.waitForTimeout(600)

for (const [sel, name] of [['#open-houses', 'openhouses'], ['#reviews', 'testimonials']]) {
  const el = await p.$(sel)
  if (el) {
    await el.scrollIntoViewIfNeeded()
    await p.waitForTimeout(2200)
    await el.screenshot({ path: `/tmp/v-${name}.png` })
    console.log(`OK /tmp/v-${name}.png`)
  } else console.log('MISS ' + sel)
}
await b.close()
