import { chromium } from 'playwright'

const URL = process.env.SHOT_URL || 'https://ryan-realty.com/'
const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--ignore-gpu-blocklist'],
})
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

for (const [name, w, h] of [['tablet', 820, 1180], ['desktop', 1280, 880]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, userAgent: UA, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 }).catch((e) => console.log('goto warn', e.message))
  await page.waitForTimeout(3500)
  // scroll through so lazy media + scroll-triggered sections render
  await page.evaluate(async () => {
    const H = document.body.scrollHeight
    for (let y = 0; y < H; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 110)) }
    window.scrollTo(0, document.body.scrollHeight)
  })
  await page.waitForTimeout(1500)
  try {
    await page.screenshot({ path: `/tmp/home-${name}.png`, fullPage: true })
    console.log(`OK fullpage ${name} ${w}x${h}`)
  } catch (e) {
    // fullPage too tall — grab the top + the footer region instead
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: `/tmp/home-${name}-top.png` })
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(400)
    await page.screenshot({ path: `/tmp/home-${name}-bottom.png` })
    console.log(`OK split ${name} (fullpage failed: ${e.message})`)
  }
  await ctx.close()
}
await browser.close()
