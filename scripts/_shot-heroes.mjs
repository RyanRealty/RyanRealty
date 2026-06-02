import { chromium } from 'playwright'

const PAGES = ['/about', '/team', '/sell']
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })

for (const route of PAGES) {
  const errs = []
  const onErr = (e) => errs.push(String(e))
  p.on('pageerror', onErr)
  const r = await p.goto(`http://localhost:3000${route}`, { waitUntil: 'load', timeout: 90000 })
  await p.waitForTimeout(3000)
  for (const label of ['Maybe later', 'Accept All', 'Accept all']) {
    await p.getByText(label, { exact: false }).first().click({ timeout: 1200 }).catch(() => {})
  }
  await p.waitForTimeout(400)
  const slug = route.replace(/\//g, '') || 'home'
  await p.screenshot({ path: `out/hero-${slug}.png` })
  const h1 = await p.evaluate(() => document.querySelector('h1')?.textContent?.trim() ?? '')
  console.error(`${route}  HTTP ${r.status()}  H1="${h1}"  errs=${errs.length}`)
  p.off('pageerror', onErr)
}
await b.close()
