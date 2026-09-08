import { chromium } from '@playwright/test'

const BASE = 'http://localhost:3109'
const OUT = 'design_system/ryan-realty/ui_kits/contact/shots'
const IDENTITY = {
  name: 'Fleet Test',
  email: 'matt+fleet-test-site09@ryan-realty.com',
  phone: '500-555-0106',
  message: 'SITE-09 response clock verification. Please ignore.',
}

// The installed browser build (1194) predates what this @playwright/test
// expects (1208), so point at the real binary rather than installing anything.
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
})

async function shoot(page, name) {
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  console.log(`shot ${name}`)
}

for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile375', 375, 800]]) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle', timeout: 180000 })
  await shoot(page, name)
  await ctx.close()
}

{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/contact?listingKey=220171500&intent=tour`, { waitUntil: 'networkidle', timeout: 180000 })
  await shoot(page, 'tour-desktop')
  await ctx.close()
}

for (const [name, width, height] of [['sent-desktop', 1440, 1000], ['sent-mobile375', 375, 800]]) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('  [browser error]', m.text().slice(0, 200))
  })
  await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle', timeout: 180000 })
  await page.fill('#contact-name', IDENTITY.name)
  await page.fill('#contact-email', IDENTITY.email)
  await page.fill('#contact-phone', IDENTITY.phone)
  await page.fill('#contact-message', IDENTITY.message)
  await page.selectOption('select[name="inquiryType"]', 'Buying')
  await page.click('button[type="submit"]')
  await page.waitForSelector('text=Message received', { timeout: 180000 })
  await shoot(page, name)
  await ctx.close()
}

await browser.close()
console.log('done')
