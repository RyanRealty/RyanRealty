#!/usr/bin/env node
/**
 * /sell/valuation HTML craft gate. Fail if the public face still carries
 * leftover labels, Market Truth leftover, or a buyer/seller market H2.
 *
 * Usage:
 *   node scripts/valuation-html-gate.mjs <file.html>
 *   node scripts/valuation-html-gate.mjs --stdin
 */

export const VALUATION_HTML_ANTI_TELLS = [
  { id: 'leftover', re: /\bleftover\b/i },
  { id: 'market-truth-leftover', re: /Market Truth leftover/i },
  { id: 'leftover-true', re: /leftover\s*:\s*true/i },
  { id: 'leftover-json', re: /"leftover"\s*:\s*true/ },
  { id: 'leftover-membership', re: /leftover membership/i },
  { id: 'methodology-v3', re: /methodology v3/i },
  { id: 'city-quarter-sale-to-ask', re: /city_quarter_sale_to_ask/ },
  {
    id: 'buyer-seller-market-h2',
    re: /Is [^\n<]{0,120}buyer(?:'|’|&rsquo;|&#39;|&#x27;|&apos;)s or seller(?:'|’|&rsquo;|&#39;|&#x27;|&apos;)s market\?/,
  },
]

export function valuationHtmlGate(html) {
  const fails = VALUATION_HTML_ANTI_TELLS.filter((rule) => rule.re.test(html)).map((rule) => rule.id)
  return { ok: fails.length === 0, fails }
}

function readArgHtml() {
  const stdin = process.argv.includes('--stdin')
  if (stdin) return null
  const file = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
  if (!file) {
    console.error('usage: node scripts/valuation-html-gate.mjs <file.html>')
    process.exit(2)
  }
  return file
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('node:fs')
  const file = readArgHtml()
  const html = file
    ? readFileSync(file, 'utf8')
    : await new Promise((resolve, reject) => {
        let body = ''
        process.stdin.setEncoding('utf8')
        process.stdin.on('data', (chunk) => {
          body += chunk
        })
        process.stdin.on('end', () => resolve(body))
        process.stdin.on('error', reject)
      })
  const result = valuationHtmlGate(html)
  if (!result.ok) {
    console.error(`FAIL valuation-html-gate: ${result.fails.join(', ')}`)
    process.exit(1)
  }
  console.log('PASS valuation-html-gate')
}
