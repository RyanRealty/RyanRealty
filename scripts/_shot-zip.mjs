import { chromium } from 'playwright'

const ZIP = process.argv[2] || '97703'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1300 } })

const pageErrors = []
const consoleErrors = []
p.on('pageerror', (e) => pageErrors.push(String(e)))
p.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
p.on('response', (resp) => {
  if (resp.status() >= 400) console.error('BAD RESPONSE', resp.status(), resp.url())
})

const r = await p.goto(`http://localhost:3000/zip/${ZIP}`, { waitUntil: 'load', timeout: 90000 })
console.error('HTTP', r.status())
await p.waitForTimeout(3500)
for (const label of ['Maybe later', 'Accept All', 'Accept all']) {
  await p.getByText(label, { exact: false }).first().click({ timeout: 1500 }).catch(() => {})
}
await p.waitForTimeout(500)

const headings = await p.evaluate(() =>
  Array.from(document.querySelectorAll('h1,h2,h3')).map((n) => n.textContent.trim()).filter(Boolean),
)
console.error('HEADINGS', JSON.stringify(headings))
console.error('PAGE ERRORS', pageErrors.length ? JSON.stringify(pageErrors) : 'none')
console.error('CONSOLE ERRORS', consoleErrors.length ? JSON.stringify(consoleErrors.slice(0, 10)) : 'none')

const total = await p.evaluate(() => document.documentElement.scrollHeight)
let i = 0
for (let y = 0; y < total; y += 1300) {
  await p.evaluate((yy) => window.scrollTo(0, yy), y)
  await p.waitForTimeout(350)
  await p.screenshot({ path: `out/zip-band-${i}.png` })
  i++
}
console.error('bands', i, 'total', total)
await b.close()
