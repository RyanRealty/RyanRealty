#!/usr/bin/env node
/**
 * G38 — Content-Security-Policy beacon-domain gate.
 *
 * The site runs on paid ads. The measurement beacons (Google Analytics 4,
 * Google Ads conversions, Meta Pixel) are loaded/connected from specific hosts.
 * If the CSP `connect-src` / `script-src` in next.config.ts drops one of them,
 * the beacon is silently blocked and tracking dies with ZERO runtime error —
 * exactly the bug that killed GA4 (www.google.com/g/collect blocked) and the
 * Meta Pixel (connect.facebook.net blocked). This gate hard-fails if any
 * required host is missing, so a future CSP edit can't re-break attribution.
 *
 * Run: node scripts/check-csp.mjs   (wired into ci:gates)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = path.join(ROOT, 'next.config.ts')

// host required in a given directive. Wildcards are literal substrings to find.
const REQUIRED = {
  'script-src': [
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://*.adtrafficquality.google',
    'https://connect.facebook.net',
  ],
  'connect-src': [
    'https://*.google-analytics.com',
    'https://www.google-analytics.com',
    'https://*.analytics.google.com',
    'https://www.google.com',
    'https://*.doubleclick.net',
    'https://*.adtrafficquality.google',
    'https://connect.facebook.net',
    'https://www.facebook.com',
  ],
}

const src = fs.readFileSync(CONFIG, 'utf8')
const cspMatch = src.match(/Content-Security-Policy['"]\s*,\s*value:\s*"([^"]+)"/)
if (!cspMatch) {
  console.error('CSP gate FAILED — could not find the Content-Security-Policy header value in next.config.ts.')
  process.exit(1)
}
const csp = cspMatch[1]

// Split the CSP into directives: "connect-src host1 host2; script-src ..."
const directives = {}
for (const part of csp.split(';')) {
  const trimmed = part.trim()
  if (!trimmed) continue
  const [name, ...tokens] = trimmed.split(/\s+/)
  directives[name] = tokens
}

const missing = []
for (const [directive, hosts] of Object.entries(REQUIRED)) {
  const present = directives[directive] ?? []
  for (const host of hosts) {
    if (!present.includes(host)) missing.push(`${directive} is missing ${host}`)
  }
}

if (missing.length) {
  console.error('CSP gate FAILED — required analytics/ads beacon hosts missing (tracking will silently break):')
  for (const m of missing) console.error('  - ' + m)
  console.error('\nFix: add the host(s) to the CSP value in next.config.ts.')
  process.exit(1)
}
console.log(`CSP gate passed (all ${Object.values(REQUIRED).flat().length} required GA4/ads/Meta beacon hosts present).`)
