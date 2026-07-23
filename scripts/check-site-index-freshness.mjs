#!/usr/bin/env node
/**
 * check-site-index-freshness.mjs — ci:site-index-freshness (W3.4 mechanism).
 *
 * The /site-index internal-link layer is AUTO-DERIVED from live inventory
 * (getSiteIndexLinks) on a cache schedule — there is no cron. Its freshness
 * therefore rests on exactly two invariants, and the audit found nothing pinned
 * them, so a refactor could silently serve a stale-forever or empty site index:
 *
 *   1. BOUNDED refresh. getSiteIndexLinks is makeResilientCached with a bounded
 *      `revalidate` (CACHE_WINDOWS.*, not false/Infinity), and the page carries a
 *      bounded ISR `revalidate`. An unbounded cache = stale forever.
 *   2. EMPTY IS NEVER PINNED. The payload exposes a `generatedAt` sentinel that is
 *      null on the empty/failed fallback, and the page calls noStore() when
 *      generatedAt === null — so a transient derivation failure can't be baked
 *      into the ISR HTML for the TTL window (the "ISR caches empty fallback"
 *      class). makeResilientCached itself THROWS on a DB error (only a genuine
 *      empty returns the fallback), so a blip doesn't strand the page.
 *
 * Static text checks — no DB, no network — safe for the secret-less ci:gates
 * chain. This is the "record the TTL model as the accepted mechanism" option the
 * W3.4 audit offered: the model is now mechanically enforced, not prose.
 *
 * Usage: node scripts/check-site-index-freshness.mjs
 */
import { readFileSync, existsSync } from 'node:fs'

const PAGE = 'app/site-index/page.tsx'
const DAL = 'lib/data/seo/getSiteIndexLinks.ts'
const problems = []

// Reduce source to CODE ONLY so a guard that appears merely as text — in a
// comment, a string, or a backtick template — can never satisfy these checks.
// A char-by-char scanner (not chained regexes) so delimiters that appear inside
// each other are handled correctly: an apostrophe inside a comment, a `//`
// inside a 'https://…' string, a quote inside a template — none corrupt the
// strip. String/template CONTENTS are blanked (delimiters kept); comments are
// dropped (newlines preserved). Closes the comment / template-literal /
// decoy-string bypasses a naive grep is fooled by.
function stripNonCode(src) {
  let out = ''
  let state = 'code' // code | line | block | sq | dq | tpl
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    const c2 = src[i + 1]
    if (state === 'code') {
      if (c === '/' && c2 === '/') { state = 'line'; i++; continue }
      if (c === '/' && c2 === '*') { state = 'block'; i++; continue }
      if (c === "'") { state = 'sq'; out += "''"; continue }
      if (c === '"') { state = 'dq'; out += '""'; continue }
      if (c === '`') { state = 'tpl'; out += '``'; continue }
      out += c
    } else if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c }
    } else if (state === 'block') {
      if (c === '*' && c2 === '/') { state = 'code'; i++ }
    } else if (state === 'sq') {
      if (c === '\\') { i++ } else if (c === "'") { state = 'code' }
    } else if (state === 'dq') {
      if (c === '\\') { i++ } else if (c === '"') { state = 'code' }
    } else if (state === 'tpl') {
      if (c === '\\') { i++ } else if (c === '`') { state = 'code' }
    }
  }
  return out
}

function must(path) {
  if (!existsSync(path)) {
    problems.push(`${path} does not exist (the site-index freshness surface moved — update this gate)`)
    return ''
  }
  return stripNonCode(readFileSync(path, 'utf8'))
}

// Extract the balanced argument text of a call, given the index just after its
// `(`. Runs on comment/string-stripped code, so parens inside strings/comments
// can't skew the depth count — a robust scope (no char-window guessing).
function callArgs(src, openParenIdx) {
  let depth = 1
  let i = openParenIdx
  for (; i < src.length && depth > 0; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')') depth--
  }
  return src.slice(openParenIdx, i - 1)
}

// Split a call's argument text into its TOP-LEVEL arguments (depth-aware over
// (), [], {}), so a check can bind to a specific positional argument rather than
// searching the whole blob for a token.
function splitTopLevelArgs(argsText) {
  const parts = []
  let depth = 0
  let start = 0
  for (let i = 0; i < argsText.length; i++) {
    const c = argsText[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (c === ',' && depth === 0) { parts.push(argsText.slice(start, i)); start = i + 1 }
  }
  parts.push(argsText.slice(start))
  return parts.map((s) => s.trim()).filter(Boolean)
}

// A load-bearing IMPORT (getSiteIndexLinks, noStore, makeResilientCached,
// CACHE_WINDOWS) is only safe if it resolves to the real module export. A local
// re-declaration of the same name (a memo wrapper, a no-op, a bad cache stub)
// shadows the import and silently defeats the freshness contract while every
// call-site text check still passes. Forbid the shadow. (Only pass names that
// are IMPORTED in the given file — never a name the file legitimately declares.)
function forbidLocalShadow(codeOnly, file, importedIds) {
  for (const id of importedIds) {
    if (new RegExp(`\\b(?:const|let|var|function)\\s+${id}\\b`).test(codeOnly)) {
      problems.push(`${file}: \`${id}\` is locally re-declared, shadowing the import — a wrapper (memo, no-op, bad cache) would silently defeat the freshness contract while the call-site text looks identical. Use the imported ${id} directly.`)
    }
  }
}

const page = must(PAGE)
const dal = must(DAL)
// Raw page kept for the import-path check (the module string is blanked in the
// tokenized `page`). NOTE: the tokenizer treats `/` conservatively — a regex
// literal whose body ends in a bare `//` sequence on the SAME line as a checked
// construct could make it misfire and false-FAIL (report the construct missing on
// legit code). That is safe-fail (CI goes red, a human looks), not a false-pass.
// The one regex literal in these files today — app/site-index/page.tsx `/\/$/`
// (strip trailing slash) — is benign (its `\/` is followed by `$`, not `/`, so no
// bare `//` forms). Revisit with a real lexer only if a `//`-forming literal ever
// lands on a checked construct's line.
const rawPage = existsSync(PAGE) ? readFileSync(PAGE, 'utf8') : ''

if (page) {
  // Bounded ISR revalidate (a positive integer, not false/0).
  if (!/export const revalidate\s*=\s*([1-9]\d*)/.test(page)) {
    problems.push(`${PAGE}: needs a bounded \`export const revalidate = <positive int>\` — an unbounded/absent ISR window serves the derived index stale forever.`)
  }
  // noStore() must be invoked DIRECTLY in the generatedAt===null branch — the
  // tight adjacent pattern `…generatedAt === null ) [{] noStore()`. No slack
  // window (which let a real generatedAt-null block call something unrelated
  // while an unconnected noStore() sat nearby and still passed).
  const guards = /generatedAt\s*===\s*null\s*\)\s*\{?\s*noStore\s*\(\s*\)/.test(page)
  if (!guards) {
    problems.push(`${PAGE}: must call noStore() DIRECTLY in the \`if (data.generatedAt === null)\` branch so a transient-empty derivation is not baked into the ISR page for the TTL window (ISR-caches-empty-fallback class).`)
  }
  // The guard only works if `noStore` is the REAL next/cache export.
  if (!/import\s*\{[^}]*\bnoStore\b[^}]*\}\s*from\s*['"]next\/cache['"]/.test(rawPage)) {
    problems.push(`${PAGE}: must import noStore (unstable_noStore) from 'next/cache' — the guard is a no-op without the real binding.`)
  }
  if (!/getSiteIndexLinks\(\)/.test(page)) {
    problems.push(`${PAGE}: must render from getSiteIndexLinks() (the auto-derived link layer), not a hand-curated snapshot.`)
  }
  // Both load-bearing page imports must not be locally shadowed: `noStore` (a
  // no-op shadow defeats the empty-guard) and `getSiteIndexLinks` (a module-scope
  // memo wrapper would cache the result past the TTL — unbounded-refresh drift).
  forbidLocalShadow(page, PAGE, ['noStore', 'getSiteIndexLinks'])
}

if (dal) {
  // NOTE: the EMPTY_SITE_INDEX.generatedAt === null sentinel is verified
  // authoritatively (on the REAL imported value, text-immune) by the contract
  // test lib/data/seo/site-index-freshness.contract.test.ts — not re-checked as
  // text here, which would only be a weaker, decoy-able blob scan.
  //
  // Bounded, resilient cache — SCOPED to the actual getSiteIndexLinks binding.
  // Require getSiteIndexLinks ITSELF to be the makeResilientCached call (a leftover
  // helper elsewhere doesn't count), and check each requirement against the SPECIFIC
  // positional argument (makeResilientCached(fetchFn, keyParts, options, fallback)),
  // never the whole arg blob — a token in the wrong argument must not satisfy a check.
  // (?:<[^>]*>)? tolerates explicit generic type args on the call.
  const bind = dal.match(/export const getSiteIndexLinks\s*=\s*makeResilientCached\s*(?:<[^>]*>)?\s*\(/)
  if (!bind) {
    problems.push(`${DAL}: getSiteIndexLinks must be defined as \`export const getSiteIndexLinks = makeResilientCached(...)\` (throws on DB error, only caches genuine data). A bare unstable_cache export — even with a leftover makeResilientCached helper elsewhere — does not count.`)
  } else {
    const topArgs = splitTopLevelArgs(callArgs(dal, bind.index + bind[0].length))
    if (topArgs.length < 4) {
      problems.push(`${DAL}: makeResilientCached(getSiteIndexLinks) must be called as (fetchFn, keyParts, options, fallback) — found ${topArgs.length} top-level args.`)
    } else {
      const optionsArg = topArgs[2] // the 3rd (options) argument, positionally
      const fallbackArg = topArgs[topArgs.length - 1] // the last (fallback) argument
      // Bounded window — checked against the OPTIONS argument specifically, so a
      // `revalidate: false` in options can't be masked by a decoy CACHE_WINDOWS
      // reference in the key-parts (2nd) argument.
      if (!/revalidate:\s*CACHE_WINDOWS\./.test(optionsArg)) {
        problems.push(`${DAL}: the options (3rd) argument of makeResilientCached(getSiteIndexLinks) must set a bounded \`revalidate: CACHE_WINDOWS.<window>\` — not false/Infinity (stale forever). Found options: ${optionsArg.slice(0, 80)}`)
      }
      // Fallback (last arg) must be EMPTY_SITE_INDEX itself — the exact object the
      // import-based contract test pins to generatedAt: null. Positional, not
      // token-presence: the sentinel name elsewhere in the call does not satisfy it.
      if (fallbackArg !== 'EMPTY_SITE_INDEX') {
        problems.push(`${DAL}: makeResilientCached's fallback (LAST) argument for getSiteIndexLinks must be exactly EMPTY_SITE_INDEX (found: ${fallbackArg}). The served-on-failure object must be the one whose generatedAt:null sentinel the contract test verifies.`)
      }
    }
  }
  // The wrapper + window are only meaningful if makeResilientCached and
  // CACHE_WINDOWS resolve to the real imports — a local re-declaration (a bad
  // cache stub, or `const CACHE_WINDOWS = { marketStats: false }`) would pass the
  // text checks above while unbounding the refresh. (getSiteIndexLinks is NOT in
  // this list — the DAL legitimately declares it as the export.)
  forbidLocalShadow(dal, DAL, ['makeResilientCached', 'CACHE_WINDOWS'])
}

console.log('Site-index freshness gate (ci:site-index-freshness)')
console.log('===================================================')
if (problems.length) {
  console.error(`\n[31m✗ ci:site-index-freshness: ${problems.length} problem(s)[0m`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log('✓ /site-index refresh is bounded and its empty derivation is never pinned (TTL + noStore-on-empty enforced).')
process.exit(0)
