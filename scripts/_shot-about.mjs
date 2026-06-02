import { chromium } from 'playwright'

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })

const pageErrors = []
const consoleErrors = []
p.on('pageerror', (e) => pageErrors.push(String(e)))
p.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})

const r = await p.goto('http://localhost:3000/about', { waitUntil: 'load', timeout: 90000 })
console.error('HTTP', r.status())
await p.waitForTimeout(4000)

// Scroll the whole page to trigger lazy content + Ken Burns, then back to top.
await p.evaluate(async () => {
  const h = document.documentElement.scrollHeight
  for (let y = 0; y < h; y += 600) {
    window.scrollTo(0, y)
    await new Promise((r) => setTimeout(r, 150))
  }
  window.scrollTo(0, 0)
  await new Promise((r) => setTimeout(r, 500))
})

// Which section headings rendered (confirm the new sections exist).
const headings = await p.evaluate(() =>
  Array.from(document.querySelectorAll('h1,h2,h3')).map((n) => n.textContent.trim()).filter(Boolean),
)
const dims = await p.evaluate(() => ({ h: document.documentElement.scrollHeight }))

console.error('PAGE height', dims.h)
console.error('HEADINGS', JSON.stringify(headings))
console.error('PAGE ERRORS', pageErrors.length ? JSON.stringify(pageErrors) : 'none')
console.error('CONSOLE ERRORS', consoleErrors.length ? JSON.stringify(consoleErrors.slice(0, 10)) : 'none')

await p.screenshot({ path: 'out/about-full.png', fullPage: true })

await p.setViewportSize({ width: 390, height: 844 })
await p.waitForTimeout(800)
await p.screenshot({ path: 'out/about-mobile.png', fullPage: true })

await b.close()
