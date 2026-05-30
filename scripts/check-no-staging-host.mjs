#!/usr/bin/env node
/**
 * check-no-staging-host.mjs — gate LAUNCH-03 / ADS-04 / FUNNEL-02.
 *
 * Bans the staging host (`*.vercel.app`) from leaking into OUTGOING URLs —
 * canonical tags, og:url, emails, CMA links, FUB lead `source`, CAPI
 * `event_source_url`. The classic bug is an env fallback default:
 *     const url = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.vercel.app'
 * If NEXT_PUBLIC_SITE_URL is ever unset in prod, every canonical/email/attribution
 * URL silently points at staging. After cutover that corrupts SEO + lead source.
 *
 * What it flags (in app/ + lib/ .ts/.tsx):
 *   1. Any full `https://...vercel.app` URL literal (an outgoing URL).
 *   2. Any `?? '...vercel.app'` / `|| '...vercel.app'` env-fallback default.
 *
 * What it ALLOWS (intentional INCOMING-host classification, not outgoing URLs):
 *   bare hostname comparisons like `host === 'ryanrealty.vercel.app'` in the
 *   visitor-tracking / admin code, and prose mentions without a scheme.
 *
 * Run: node scripts/check-no-staging-host.mjs   (wired into ci:gates)
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['app', 'lib']
const URL_LITERAL = /https?:\/\/[a-z0-9.-]*vercel\.app/i
const ENV_FALLBACK = /(\?\?|\|\|)\s*['"`][^'"`]*vercel\.app/i

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      walk(full, out)
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

const hits = []
for (const root of ROOTS) {
  let files = []
  try { files = walk(root) } catch { continue }
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return // skip comments
      // Explicit, auditable exception: an INCOMING-host allowlist entry (e.g. a
      // CORS origin set) is not an outgoing URL. Annotate the line `staging-host-ok`.
      if (line.includes('staging-host-ok')) return
      if (URL_LITERAL.test(line) || ENV_FALLBACK.test(line)) {
        hits.push(`${f}:${i + 1}  ${trimmed.slice(0, 120)}`)
      }
    })
  }
}

if (hits.length) {
  console.error('\nStaging-host gate FAILED — *.vercel.app in an outgoing-URL position:')
  for (const h of hits) console.error('  ' + h)
  console.error('\nUse NEXT_PUBLIC_SITE_URL (apex) — fallback to https://ryan-realty.com, never the staging host.')
  process.exit(1)
}
console.log('Staging-host gate passed — no *.vercel.app outgoing-URL leaks in app/ or lib/.')
