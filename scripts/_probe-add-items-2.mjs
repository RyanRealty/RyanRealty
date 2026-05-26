import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ storageState: 'tmp/skyslope-session.json', viewport: { width: 1600, height: 1200 } })
const page = await ctx.newPage()
function b64(n) { return Buffer.from(String(n)).toString('base64') }
const url = `https://app.skyslope.com/BrokerCheckListActivityListTransaction.aspx?PropertyTypeId=${b64(1784578)}&CheckListType=1&officeid=-1&CheckListName=Residential+Sale+%E2%80%94+Legacy+%28Master%29&ParentID=0&checkSingleOfficeAuditor=No`
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
console.log('Before:', page.url())
await page.evaluate(() => {
  const link = document.getElementById('ContentPlaceHolder1_ibtnCreateCheckList')
  if (link) link.click()
})
await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(4000)
console.log('After click:', page.url())
const inputs = await page.evaluate(() => {
  const all = [...document.querySelectorAll('input, select, textarea')].filter(e => e.offsetParent !== null)
  return all.slice(0, 30).map(e => ({ tag: e.tagName, type: e.type, name: e.name, id: e.id }))
})
console.log('Visible inputs:', inputs.length)
for (const i of inputs.slice(0, 15)) console.log(`  ${i.tag}/${i.type} id="${i.id}" name="${i.name}"`)
await page.screenshot({ path: 'tmp/probe-add-items-after.png' })
await browser.close()
