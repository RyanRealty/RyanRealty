import { chromium } from '@playwright/test'

const BASE = 'http://localhost:3109'
const OUT = 'design_system/ryan-realty/ui_kits/contact/shots'

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
})

async function grab(path, name, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const res = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 240000 })
  console.log(`${path} @${width} -> ${res?.status()} ${page.url()}`)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  const text = await page.evaluate(() => {
    const s = document.querySelector('section[aria-label="Response clock"]')
    return s ? s.innerText : document.body.innerText.slice(0, 600)
  })
  console.log('---- panel text ----')
  console.log(text)
  console.log('--------------------')
  await ctx.close()
}

// /admin/crm itself redirects to Google OAuth on this dev server, so the panel
// is rendered by the throwaway harness at /zz-site09-preview (deleted before
// commit). Same component, same DAL, same admin token scope.
await grab('/zz-site09-preview', 'admin-crm-desktop', 1440, 1000)
await grab('/zz-site09-preview', 'admin-crm-mobile375', 375, 800)

await browser.close()
console.log('done')
