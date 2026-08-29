#!/usr/bin/env node
/**
 * Search / homes-for-sale HTML craft gate. Fail if the public face still
 * carries leftover labels, stock photography, or the old dual-count HUD.
 *
 * Usage:
 *   node scripts/search-html-gate.mjs <file.html>
 *   node scripts/search-html-gate.mjs --stdin
 */

export const SEARCH_HTML_ANTI_TELLS = [
  { id: 'market-truth-leftover', re: /Market Truth leftover/i },
  { id: 'leftover-true', re: /leftover\s*:\s*true/i },
  { id: 'leftover-json', re: /"leftover"\s*:\s*true/ },
  { id: 'leftover-membership', re: /leftover membership/i },
  { id: 'leftover-and-other-types', re: /leftover and other types/i },
  { id: 'market-truth-eyebrow', re: /Market Truth/ },
  { id: 'unsplash', re: /unsplash\.com|images\.unsplash/i },
  { id: 'loading-map', re: /Loading map/ },
]

export function searchHtmlGate(html) {
  const fails = SEARCH_HTML_ANTI_TELLS.filter((rule) => rule.re.test(html)).map((rule) => rule.id)
  return { ok: fails.length === 0, fails }
}

function readArgHtml() {
  const stdin = process.argv.includes('--stdin')
  if (stdin) return null
  const file = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
  if (!file) {
    console.error('usage: node scripts/search-html-gate.mjs <file.html>')
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
  const result = searchHtmlGate(html)
  if (result.ok === false) {
    console.error(`FAIL search-html-gate: ${result.fails.join(', ')}`)
    process.exit(1)
  }
  console.log('PASS search-html-gate')
}
