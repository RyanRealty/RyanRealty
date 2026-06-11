#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const STATE_PATH = 'tmp/skyslope-session.json'
const OUT = 'tmp/712-ui-checklist-explore'
const TXN_B64 = Buffer.from('21849771').toString('base64')
const URL = `https://app.skyslope.com/CreateTransaction.aspx?TransactionID=${TXN_B64}&ListingID=MA==&checklistId=MA==`
await fs.mkdir(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ storageState: STATE_PATH, viewport: { width: 1500, height: 950 } })
const page = await context.newPage()
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

const before = await page.evaluate(() => {
  const ddl = document.getElementById('ContentPlaceHolder1_ddlProperty')
  return {
    disabled: ddl?.disabled,
    options: ddl ? [...ddl.options].map((o) => ({ text: o.text, value: o.value })) : [],
    editLinks: [...document.querySelectorAll('a, input[type="image"], img, span')].filter((el) => {
      const t = (el.title || el.alt || el.innerText || el.id || '').toLowerCase()
      return /edit|pencil|change|checklist|property type/.test(t)
    }).map((el) => ({
      tag: el.tagName,
      id: el.id,
      title: el.title || el.alt || el.innerText?.slice(0, 40) || '',
      onclick: el.getAttribute('onclick')?.slice(0, 120) || '',
      href: el.getAttribute('href')?.slice(0, 120) || '',
    })).slice(0, 40),
  }
})
console.log('BEFORE edit click:', JSON.stringify(before, null, 2))

// Common SkySlope pattern: pencil icon near checklist type
const editCandidates = [
  '#ContentPlaceHolder1_imgEditPropertyType',
  '#ContentPlaceHolder1_imgEditCheckList',
  '#ContentPlaceHolder1_lnkEditProperty',
  'a[title*="Edit"]',
  'img[alt*="Edit"]',
  '#ContentPlaceHolder1_TransactionDetails1_editPropertyType',
]
for (const sel of editCandidates) {
  const loc = page.locator(sel).first()
  if ((await loc.count()) === 0) continue
  console.log(`Trying click: ${sel}`)
  await loc.click({ timeout: 3000 }).catch((e) => console.log(`  fail: ${e.message.slice(0, 80)}`))
  await page.waitForTimeout(1500)
}

// Also try any postback containing Edit + Property or CheckList
const postbacks = await page.evaluate(() =>
  [...document.querySelectorAll('[onclick*="PostBack"]')]
    .map((el) => ({ tag: el.tagName, id: el.id, onclick: el.getAttribute('onclick') || '' }))
    .filter((x) => /property|checklist|office/i.test(x.onclick + x.id))
    .slice(0, 20),
)
console.log('Postback candidates:', JSON.stringify(postbacks, null, 2))
for (const pb of postbacks.slice(0, 3)) {
  if (!pb.id) continue
  console.log(`Click postback id=${pb.id}`)
  await page.locator(`#${pb.id}`).click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(1500)
}

const after = await page.evaluate(() => {
  const ddl = document.getElementById('ContentPlaceHolder1_ddlProperty')
  const office = document.getElementById('ddlCheckListOffice')
  return {
    ddlDisabled: ddl?.disabled,
    ddlOptions: ddl ? [...ddl.options].map((o) => ({ text: o.text.trim(), value: o.value })) : [],
    officeDisabled: office?.disabled,
    officeOptions: office ? [...office.options].map((o) => ({ text: o.text.trim(), value: o.value })) : [],
    bodySnippet: document.body.innerText.replace(/\s+/g, ' ').match(/CHECKLIST TYPE.{0,200}/)?.[0] || '',
  }
})
console.log('AFTER:', JSON.stringify(after, null, 2))
await page.screenshot({ path: path.join(OUT, 'create-transaction-edit-probe.png'), fullPage: true })
await browser.close()
