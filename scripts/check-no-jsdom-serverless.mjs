#!/usr/bin/env node
/**
 * No-jsdom-in-server-path gate.
 *
 * `jsdom` (and `isomorphic-dompurify`, which bundles jsdom) instantiate a full
 * DOM at MODULE LOAD. In Vercel's serverless runtime that throws at import time,
 * so any route whose module graph reaches the import returns a 500 before a
 * single line of the handler runs — it took down the WHOLE site, not one page,
 * because the failing import sat in a shared lib. The poison was invisible in
 * dev (Node has the globals jsdom shims) and only surfaced in production.
 *
 * The rule: nothing in the server-rendered tree (app/ + lib/ + components/) may
 * import jsdom or isomorphic-dompurify. HTML sanitizing happens in lib/sanitize
 * with a DOM-free sanitizer. isomorphic-dompurify stays out of the graph even
 * though it's still in package.json — a gate is cheaper than re-learning the 500.
 *
 * Companion memory: ryanrealty-serverless-gotchas.md ("never reintroduce a
 * jsdom-backed lib into a server-rendered path"). This is that invariant as a
 * gate instead of prose.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const BANNED = ['jsdom', 'isomorphic-dompurify']
// import x from 'jsdom'  |  import 'jsdom'  |  require('jsdom')  |  await import('jsdom')
const importRe = new RegExp(
  `(?:from\\s*|import\\s*|require\\(\\s*)['"](${BANNED.join('|')})['"]`,
)

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!/node_modules|\.next|\.git/.test(p)) walk(p, out)
    } else if (/\.(tsx|ts|jsx|js|mjs)$/.test(e.name)) {
      out.push(p)
    }
  }
  return out
}

const files = ['app', 'lib', 'components'].flatMap((d) =>
  fs.existsSync(path.join(ROOT, d)) ? walk(path.join(ROOT, d)) : [],
)
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/')

const bad = []
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  if (importRe.test(src)) {
    const which = BANNED.find((b) =>
      new RegExp(`['"]${b}['"]`).test(src),
    )
    bad.push(
      `${rel(f)} -> imports '${which}', which loads jsdom at module init and ` +
        `500s every serverless route in its graph. Sanitize via lib/sanitize (DOM-free) instead.`,
    )
  }
}

if (bad.length) {
  console.error('No-jsdom-serverless gate FAILED — jsdom-backed import in a server-rendered path:')
  for (const b of bad) console.error('  - ' + b)
  process.exit(1)
}
console.log(`No-jsdom-serverless gate passed (${files.length} files scanned, 0 jsdom-backed imports).`)
