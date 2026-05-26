import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ storageState: 'tmp/skyslope-session.json', viewport: { width: 1600, height: 1200 } })
const page = await ctx.newPage()
function b64(n) { return Buffer.from(String(n)).toString('base64') }
const url = `https://app.skyslope.com/BrokerCheckListActivityListTransaction.aspx?PropertyTypeId=${b64(1784578)}&CheckListType=1&officeid=-1&CheckListName=Residential+Sale+%E2%80%94+Legacy+%28Master%29&ParentID=0&checkSingleOfficeAuditor=No`
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
const info = await page.evaluate(() => {
  const candidates = [...document.querySelectorAll('a, input[type="submit"], button')].filter(e =>
    e.offsetParent !== null && /add items/i.test(e.innerText || e.value || ''))
  return candidates.map(e => ({ tag: e.tagName, id: e.id, name: e.name, text: (e.innerText || e.value).trim(), href: e.href || null, onclick: (e.getAttribute('onclick') || '').substring(0, 200) }))
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
