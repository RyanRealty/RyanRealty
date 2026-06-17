import { chromium } from 'playwright'

// Dev/review tool: screenshot the KB community + featured sections from a local
// prod server WITH motion enabled, so viewport-autoplay actually fires and we can
// see a card playing its video. Not part of the build.
const URL = process.env.SHOT_URL || 'http://localhost:3010/'
const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
})
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
})
const page = await ctx.newPage()
await page.goto(URL, { waitUntil: 'load', timeout: 60000 }).catch((e) => console.log('goto warn', e.message))
await page.waitForTimeout(2500)

async function shot(sel, name) {
  const el = await page.$(sel)
  if (!el) {
    console.log(`MISS ${sel}`)
    return
  }
  await el.scrollIntoViewIfNeeded()
  // let IntersectionObserver fire + the video crossfade in + start playing
  await page.waitForTimeout(3500)
  await el.screenshot({ path: `/tmp/kb-${name}.png` })
  console.log(`OK /tmp/kb-${name}.png`)
}

await shot('#towns', 'towns')
await shot('#map', 'map')
await shot('#communities', 'communities')
await shot('#listings', 'featured')
await ctx.close()
await browser.close()
