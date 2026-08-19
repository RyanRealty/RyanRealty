#!/usr/bin/env node
/**
 * ci:redirect-only — IA aliases emit a real HTTP 308.
 *
 * Next 16 prerender/streaming turns page-level permanentRedirect() into a
 * 200 HTML shell (generic title, no h1, no main). Redirect-only public pages
 * must therefore be declared in next.config.ts redirects() (or named as a
 * middleware 308). Founding case: /motivated-sellers (fleet 57eefae9).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const fails = []
function check(ok, msg) {
  if (!ok) fails.push(msg)
}

function walkPages(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name)
    if (name.isDirectory()) walkPages(p, acc)
    else if (name.name === 'page.tsx' || name.name === 'page.ts') acc.push(p)
  }
  return acc
}

function fileToSource(file) {
  const rel = file.replace(/^app\//, '').replace(/\/page\.tsx?$/, '')
  if (!rel || rel === 'page') return '/'
  return `/${rel
    .split('/')
    .map((seg) => (seg.startsWith('[') && seg.endsWith(']') ? `:${seg.slice(1, -1)}` : seg))
    .join('/')}`
}

const config = readFileSync('next.config.ts', 'utf8')
const pages = walkPages('app').filter((f) => !f.startsWith('app/admin/'))

for (const file of pages) {
  const src = readFileSync(file, 'utf8')
  const redirectOnly =
    /permanentRedirect\(/.test(src) &&
    (/never renders UI/.test(src) || /Redirect-only/.test(src) || /@data-free/.test(src))
  if (!redirectOnly) continue
  if (/middleware/.test(src) && /308/.test(src)) continue
  const source = fileToSource(file)
  const quoted = `'${source}'`
  check(
    config.includes(`source: ${quoted}`) || config.includes(`source: "${source}"`),
    `${file} is redirect-only (${source}) but next.config.ts has no matching redirects() source — page-level permanentRedirect() serves HTTP 200 under Next 16`,
  )
}

check(config.includes("source: '/motivated-sellers'"), 'next.config must 308 /motivated-sellers → /price-drops')
check(config.includes("source: '/motivated-sellers/:city'"), 'next.config must 308 /motivated-sellers/:city → /price-drops/:city')
check(config.includes("source: '/feed'"), 'next.config must 308 /feed → /videos?view=feed')

if (fails.length) {
  console.error('ci:redirect-only FAILED')
  for (const f of fails) console.error('  -', f)
  process.exit(1)
}
console.log('ci:redirect-only OK — redirect-only public aliases are declared as HTTP 308s.')
