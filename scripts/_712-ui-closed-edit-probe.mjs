#!/usr/bin/env node
import { chromium } from 'playwright'
const STATE='tmp/skyslope-session.json'
const TXN_B64=Buffer.from('21849771').toString('base64')
const URL=`https://app.skyslope.com/CreateTransaction.aspx?TransactionID=${TXN_B64}&ListingID=MA==&checklistId=MA==`
const browser=await chromium.launch({headless:true})
const page=await (await browser.newContext({storageState:STATE})).newPage()
await page.goto(URL,{waitUntil:'domcontentloaded'})
await page.waitForTimeout(2000)
const hits=await page.evaluate(()=>[...document.querySelectorAll('a,input,button,span')].map(el=>(el.innerText||el.value||'').trim()).filter(t=>/reopen|edit|unlock|change checklist|property type|office/i.test(t)).slice(0,40))
console.log(hits)
const submits=await page.evaluate(()=>[...document.querySelectorAll('input[type=submit],button')].map(b=>({text:(b.value||b.innerText||'').trim(),id:b.id,visible:b.offsetParent!==null})).filter(b=>b.text))
console.log('buttons',submits)
await browser.close()
