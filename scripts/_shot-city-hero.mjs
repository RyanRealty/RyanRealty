import { chromium } from 'playwright'

const b = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--ignore-gpu-blocklist'],
})
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, userAgent: UA, reducedMotion: 'reduce' })
const p = await ctx.newPage()
await p.goto(process.env.SHOT_URL || 'http://localhost:3010/cities/bend', { waitUntil: 'load', timeout: 60000 }).catch((e) =>
  console.log('warn', e.message),
)
await p.waitForTimeout(3000)
// dismiss the cookie banner so it doesn't cover the hero stat row
await p.getByRole('button', { name: /essential only|accept all/i }).first().click().catch(() => {})
await p.waitForTimeout(600)
await p.screenshot({ path: '/tmp/city-hero.png' })
console.log('OK /tmp/city-hero.png')
await b.close()
