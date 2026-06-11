import { chromium } from 'playwright'
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const XFF={ 'x-forwarded-for':'73.157.10.20' }
const URL='http://localhost:3000/lp/seller-home-value'
const b=await chromium.launch()
const ctx=await b.newContext({userAgent:UA,extraHTTPHeaders:XFF,viewport:{width:1440,height:1600}})
const p=await ctx.newPage()
await p.goto(URL,{waitUntil:'networkidle',timeout:90000})
await p.fill('#seller-lp-address','1234 NW Riverside Blvd, Bend, OR 97703')
await p.getByRole('button',{name:/get my home value/i}).first().click()
await p.getByText('Where should we send it?').waitFor({timeout:12000})
await p.waitForTimeout(700)
const form=p.locator('form[aria-labelledby="seller-lp-form-heading-2"]')
await form.scrollIntoViewIfNeeded()
await form.screenshot({path:'out/lp-review/_qualify.png'})
await b.close()
console.log('qualify shot written')
