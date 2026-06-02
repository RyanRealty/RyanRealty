import { chromium } from 'playwright'

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1300 } })
const pageErrors = []
const consoleErrors = []
p.on('pageerror', (e) => pageErrors.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })

const r = await p.goto('http://localhost:3000/team', { waitUntil: 'load', timeout: 90000 })
console.error('HTTP', r.status())
await p.waitForTimeout(3500)
for (const label of ['Maybe later', 'Accept All', 'Accept all']) {
  await p.getByText(label, { exact: false }).first().click({ timeout: 1500 }).catch(() => {})
}
await p.waitForTimeout(500)

// Dump the visible names + specialties + phones to confirm real DB data.
const info = await p.evaluate(() => {
  const txt = document.querySelector('main')?.innerText ?? ''
  return txt.slice(0, 2600)
})
console.error('PAGE ERRORS', pageErrors.length ? JSON.stringify(pageErrors) : 'none')
console.error('CONSOLE ERRORS', consoleErrors.filter((e) => !/google|widgetbe|CSP|403|Content Security/.test(e)).slice(0, 5))
console.error('--- MAIN TEXT ---')
console.error(info)

const total = await p.evaluate(() => document.documentElement.scrollHeight)
let i = 0
for (let y = 0; y < total; y += 1300) {
  await p.evaluate((yy) => window.scrollTo(0, yy), y)
  await p.waitForTimeout(300)
  await p.screenshot({ path: `out/team-band-${i}.png` })
  i++
}
console.error('bands', i, 'total', total)
await b.close()
