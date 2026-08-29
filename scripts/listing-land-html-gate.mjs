#!/usr/bin/env node
/**
 * Land listing HTML gate. Fail if the proof path still reads as a house
 * or still carries Market Truth leftover labels.
 *
 * Usage:
 *   node scripts/listing-land-html-gate.mjs <file.html>
 *   node scripts/listing-land-html-gate.mjs --stdin
 */

export const LAND_HTML_ANTI_TELLS = [
  { id: 'leftover-true', re: /leftover\s*:\s*true/i },
  { id: 'leftover-json', re: /"leftover"\s*:\s*true/ },
  { id: 'market-truth-leftover', re: /Market Truth leftover/i },
  { id: 'compact-price', re: /\$380K/ },
  { id: 'imagine-this-room', re: /Imagine this room/i },
  { id: 'this-house', re: /THIS HOUSE|This house/ },
  { id: 'this-home-sits', re: /This home sits/i },
  { id: 'rental-analysis', re: /rental analysis/i },
  { id: 'homes-for-sale-crumb', re: /v3-breadcrumb[\s\S]{0,1600}Homes for sale/ },
  { id: 'homes-like-this', re: /Get alerts for homes like this|Get free alerts for homes/i },
  { id: 'about-this-home', re: /About this home/ },
  { id: 'zero-bed', re: /\b0\s*beds?\b/i },
]

export function listingLandHtmlGate(html) {
  const fails = LAND_HTML_ANTI_TELLS.filter((rule) => rule.re.test(html)).map((rule) => rule.id)
  return { ok: fails.length === 0, fails }
}

function readArgHtml() {
  const stdin = process.argv.includes('--stdin')
  if (stdin) return null
  const file = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
  if (!file) {
    console.error('usage: node scripts/listing-land-html-gate.mjs <file.html>')
    process.exit(2)
  }
  return file
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('node:fs')
  const file = readArgHtml()
  const html = file ? readFileSync(file, 'utf8') : await new Promise((resolve, reject) => {
    let body = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      body += chunk
    })
    process.stdin.on('end', () => resolve(body))
    process.stdin.on('error', reject)
  })
  const result = listingLandHtmlGate(html)
  if (!result.ok) {
    console.error(`FAIL listing-land-html-gate: ${result.fails.join(', ')}`)
    process.exit(1)
  }
  console.log('PASS listing-land-html-gate')
}
