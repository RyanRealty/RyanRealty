import { chromium } from 'playwright'

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1300 } })
await p.goto('http://localhost:3000/about', { waitUntil: 'load', timeout: 90000 })
await p.waitForTimeout(3500)
// Dismiss the auto-popped sign-in modal + cookie banner so they don't obscure content.
for (const label of ['Maybe later', 'Accept All', 'Accept all']) {
  await p.getByText(label, { exact: false }).first().click({ timeout: 1500 }).catch(() => {})
}
await p.waitForTimeout(600)

const total = await p.evaluate(() => document.documentElement.scrollHeight)
const bandH = 1300
let i = 0
for (let y = 0; y < total; y += bandH) {
  await p.evaluate((yy) => window.scrollTo(0, yy), y)
  await p.waitForTimeout(350)
  await p.screenshot({ path: `out/about-band-${i}.png` })
  i++
}
console.error('bands', i, 'total height', total)
await b.close()
