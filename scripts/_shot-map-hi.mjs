import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--ignore-gpu-blocklist'] })
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ctx = await b.newContext({ viewport:{width:1400,height:1000}, userAgent:UA, deviceScaleFactor:2, reducedMotion:'reduce' })
const p = await ctx.newPage()
await p.goto('http://localhost:3010/cities/bend',{waitUntil:'load',timeout:60000}).catch(e=>console.log('warn',e.message))
await p.waitForTimeout(2000)
const el = await p.$('#map'); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(6000)
await el.screenshot({path:'/tmp/kb-map-hi.png'}); console.log('OK /tmp/kb-map-hi.png')
await b.close()
