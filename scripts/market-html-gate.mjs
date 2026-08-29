#!/usr/bin/env node
/**
 * /housing-market HTML craft gate. Fail if the public face still carries
 * leftover labels, Market Truth leftover, leftover:true, or Leftover membership.
 *
 * Usage:
 *   node scripts/market-html-gate.mjs <file.html>
 *   node scripts/market-html-gate.mjs --stdin
 */

export const MARKET_HTML_ANTI_TELLS = [
  { id: 'leftover', re: /\bleftover\b/i },
  { id: 'market-truth-leftover', re: /Market Truth leftover/i },
  { id: 'leftover-true', re: /leftover\s*:\s*true/i },
  { id: 'leftover-json', re: /"leftover"\s*:\s*true/ },
  { id: 'leftover-membership', re: /leftover membership/i },
]

export function marketHtmlGate(html) {
  const fails = MARKET_HTML_ANTI_TELLS.filter((rule) => rule.re.test(html)).map((rule) => rule.id)
  return { ok: fails.length === 0, fails }
}

function readArgHtml() {
  const stdin = process.argv.includes('--stdin')
  if (stdin) return null
  const file = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
  if (!file) {
    console.error('usage: node scripts/market-html-gate.mjs <file.html>')
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
        process.stdin.on('error', reject)
        process.stdin.on('end', () => resolve(body))
      })
  const result = marketHtmlGate(html)
  if (!result.ok) {
    console.error(`FAIL market-html-gate: ${result.fails.join(', ')}`)
    process.exit(1)
  }
  console.log('PASS market-html-gate')
}
