import { chromium } from 'playwright'

const b = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--ignore-gpu-blocklist'],
})
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
for (const [path, name] of [
  ['/', 'home'],
  ['/cities/bend', 'bend'],
]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: UA, reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.goto('http://localhost:3010' + path, { waitUntil: 'load', timeout: 60000 }).catch((e) => console.log('warn', e.message))
  await p.waitForTimeout(2500)
  const el = await p.$('#market-report')
  if (el) {
    await el.scrollIntoViewIfNeeded()
    await p.waitForTimeout(2200)
    await el.screenshot({ path: `/tmp/mkt-${name}.png` })
    console.log('OK /tmp/mkt-' + name + '.png')
  } else console.log('MISS market ' + name)
  await ctx.close()
}
await b.close()
