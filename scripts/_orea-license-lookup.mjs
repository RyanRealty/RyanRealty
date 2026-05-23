#!/usr/bin/env node
/**
 * Look up a specific Oregon real estate license via the OREA eLicense system
 * (a Tyler Technologies / MicroPact ASP.NET WebForms site). The site is form-
 * based; we have to fetch ViewState + EventValidation tokens first, then POST.
 *
 * Usage: node scripts/_orea-license-lookup.mjs <license-number>
 */

import fs from 'node:fs'

const LOOKUP_URL = 'https://orea.elicense.micropact.com/Lookup/LicenseLookup.aspx'

function extractAspNetToken(html, name) {
  // ASP.NET writes <input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="..." />
  // where name and id can be either order. Use a [\s\S] match so we span across attrs.
  const escaped = name.replace(/\$/g, '\\$')
  const patterns = [
    new RegExp(`name="${escaped}"[^>]*?value="([^"]*)"`, 'i'),
    new RegExp(`id="${escaped}"[^>]*?value="([^"]*)"`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m) return m[1]
  }
  return null
}

function extractAll(html, regex) {
  const out = []
  let m
  while ((m = regex.exec(html)) !== null) out.push(m[1])
  return out
}

async function main() {
  const licenseNumber = process.argv[2]
  if (!licenseNumber) {
    console.error('Usage: node scripts/_orea-license-lookup.mjs <license-number>')
    process.exit(1)
  }

  // Step 1 — GET the form to get cookies + viewstate
  const cookieJar = []
  const initRes = await fetch(LOOKUP_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; RyanRealty-License-Lookup/1.0)',
      Accept: 'text/html',
    },
  })
  const setCookies = initRes.headers.getSetCookie?.() || initRes.headers.raw?.()['set-cookie'] || []
  for (const c of setCookies) {
    const first = c.split(';')[0]
    if (first) cookieJar.push(first)
  }
  const html = await initRes.text()

  const viewState = extractAspNetToken(html, '__VIEWSTATE')
  const viewStateGen = extractAspNetToken(html, '__VIEWSTATEGENERATOR')
  const eventValidation = extractAspNetToken(html, '__EVENTVALIDATION')

  if (!viewState) {
    console.error('FATAL: could not extract ViewState from form page')
    fs.writeFileSync('/tmp/orea-form-debug.html', html)
    process.exit(2)
  }

  console.log(`✓ ViewState (${viewState.length} chars)`)
  console.log(`${eventValidation ? '✓' : '–'} EventValidation${eventValidation ? ` (${eventValidation.length} chars)` : ' (absent)'}`)
  console.log(`✓ Cookies: ${cookieJar.length} set`)

  // Step 2 — POST the lookup
  const formData = new URLSearchParams()
  formData.set('__VIEWSTATE', viewState)
  if (viewStateGen) formData.set('__VIEWSTATEGENERATOR', viewStateGen)
  if (eventValidation) formData.set('__EVENTVALIDATION', eventValidation)
  formData.set('__EVENTTARGET', '')
  formData.set('__EVENTARGUMENT', '')

  const FIELD_BASE = 'ctl00$MainContentPlaceHolder$ucLicenseLookup$ctl03$'
  formData.set(`${FIELD_BASE}tbCredentialNumber_Credential`, licenseNumber)
  formData.set(`${FIELD_BASE}tbFirstName_Contact`, '')
  formData.set(`${FIELD_BASE}tbLastName_Contact`, '')
  formData.set(`${FIELD_BASE}tbDBA_Contact`, '')
  formData.set(`${FIELD_BASE}tbAddress2_ContactAddress`, '')
  formData.set(`${FIELD_BASE}tbCity_ContactAddress`, '')
  formData.set(`${FIELD_BASE}ddStates`, '')
  formData.set(`${FIELD_BASE}tbZipCode_ContactAddress`, '')
  formData.set(`${FIELD_BASE}ddCounty`, '')
  formData.set(`${FIELD_BASE}lbMultipleCredentialTypePrefix`, '')

  // Submit button
  formData.set('ctl00$MainContentPlaceHolder$ucLicenseLookup$btnLookup', 'Search')

  console.log(`POSTing license number ${licenseNumber}...`)
  const postRes = await fetch(LOOKUP_URL, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; RyanRealty-License-Lookup/1.0)',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieJar.join('; '),
      Referer: LOOKUP_URL,
    },
    body: formData.toString(),
    redirect: 'manual',
  })

  console.log(`POST status: ${postRes.status}`)
  const postBody = await postRes.text()
  fs.writeFileSync('/tmp/orea-lookup-result.html', postBody)
  console.log('Result HTML → /tmp/orea-lookup-result.html')

  // Parse out the result rows
  const tableMatch = postBody.match(/<table[^>]*id="[^"]*gvSearchResults"[^>]*>([\s\S]*?)<\/table>/i)
  if (!tableMatch) {
    // Look for any data rows
    const rows = extractAll(postBody, /<tr[^>]*class="[^"]*GridRow[^"]*"[^>]*>([\s\S]*?)<\/tr>/g)
    console.log(`No gvSearchResults table found. ${rows.length} GridRow candidates.`)
  } else {
    console.log(`Result table found (${tableMatch[1].length} chars)`)
  }

  // Look for credential issuance / origination date patterns in the response
  const fieldPatterns = [
    /Original Issue Date[^<]*<[^>]*>\s*([0-9/]+)/i,
    /Issue Date[^<]*<[^>]*>\s*([0-9/]+)/i,
    /First Issued[^<]*<[^>]*>\s*([0-9/]+)/i,
    /Effective Date[^<]*<[^>]*>\s*([0-9/]+)/i,
    /Issuance Date[^<]*<[^>]*>\s*([0-9/]+)/i,
    /Original License Date[^<]*<[^>]*>\s*([0-9/]+)/i,
  ]
  for (const p of fieldPatterns) {
    const m = postBody.match(p)
    if (m) console.log(`MATCH (${p.source.slice(0, 30)}...): ${m[1]}`)
  }

  // Search for all dates in the result
  const dates = postBody.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g)
  if (dates) console.log(`Dates found in result: ${[...new Set(dates)].join(', ')}`)

  // Pull license number row
  const credNum = postBody.indexOf(licenseNumber)
  if (credNum >= 0) {
    console.log(`License number found at offset ${credNum}; surrounding 400 chars:`)
    const ctx = postBody.slice(Math.max(0, credNum - 200), credNum + 300)
    console.log(ctx.replace(/\s+/g, ' '))
  } else {
    console.log(`License number ${licenseNumber} NOT in response.`)
  }
}

main().catch((e) => {
  console.error(`FATAL: ${e?.message || e}`)
  process.exit(1)
})
