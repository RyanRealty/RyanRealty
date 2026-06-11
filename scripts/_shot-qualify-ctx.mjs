import { chromium } from 'playwright'
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const XFF={ 'x-forwarded-for':'73.157.10.20' }
const b=await chromium.launch()
const ctx=await b.newContext({userAgent:UA,extraHTTPHeaders:XFF,viewport:{width:1440,height:1300}})
const p=await ctx.newPage()
await p.goto('http://localhost:3000/lp/seller-home-value',{waitUntil:'networkidle',timeout:90000})
await p.fill('#seller-lp-address','1234 NW Riverside Blvd, Bend, OR 97703')
await p.getByRole('button',{name:/get my home value/i}).first().click()
await p.getByText('Where should we send it?').waitFor({timeout:12000})
await p.waitForTimeout(700)
await p.screenshot({path:'out/lp-review/_qualify-ctx.png'})  // viewport
await b.close()
console.log('ctx shot written')
