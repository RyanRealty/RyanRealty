import { chromium } from 'playwright'

const URL = 'https://jackson-real-estate-photography.aryeo.com/videos/01901324-0269-7223-9f62-314b7a1d07b6'
const b = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] })
const ctx = await b.newContext({ viewport: { width: 800, height: 500 } })
const p = await ctx.newPage()
await p.goto(URL, { waitUntil: 'load', timeout: 45000 }).catch((e) => console.log('goto warn', e.message))
await p.waitForTimeout(5000)
// is there a <video> element and is it playing?
const info = await p.evaluate(() => {
  const v = document.querySelector('video')
  return {
    hasVideo: !!v,
    playing: v ? !v.paused && v.currentTime > 0 : false,
    currentTime: v ? Number(v.currentTime.toFixed(2)) : null,
    muted: v ? v.muted : null,
    src: v ? (v.currentSrc || v.src || '').slice(0, 80) : null,
    iframes: document.querySelectorAll('iframe').length,
  }
})
console.log('ARYEO:', JSON.stringify(info))
await p.screenshot({ path: '/tmp/aryeo.png' })
console.log('shot /tmp/aryeo.png')
await b.close()
