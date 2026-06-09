#!/usr/bin/env node
/**
 * Embed ↔ CSP frame-src parity gate.
 *
 * A listing video/tour that normalizeEmbed (lib/data/videos/getListingVideos.ts)
 * returns as embedType:'iframe' renders inside an <iframe>. The browser only
 * loads that iframe if its host is in the Content-Security-Policy frame-src
 * allow-list in next.config.ts. Add a new tour host to normalizeEmbed but forget
 * CSP and the visitor sees "This content is blocked" — a silent break that looks
 * like the tour is missing, not a CSP error. (3D tours arrive via
 * details.VirtualTours, so new providers DO show up over time.)
 *
 * This gate reads the framable hosts straight out of normalizeEmbed's iframe
 * OR-block (so a newly-added provider is caught automatically) plus the stable
 * canonical providers it frames via video-embed.ts / the Google Drive branch,
 * and asserts every one is present in next.config.ts frame-src.
 *
 * Companion memory: ryanrealty-listing-video-sources.md ("every iframe-embedded
 * host must be in BOTH normalizeEmbed AND next.config.ts CSP frame-src").
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RESOLVER = path.join(ROOT, 'lib/data/videos/getListingVideos.ts')
const NEXT_CONFIG = path.join(ROOT, 'next.config.ts')

const fail = (lines) => {
  console.error('Embed/CSP-parity gate FAILED:')
  for (const l of [].concat(lines)) console.error('  - ' + l)
  process.exit(1)
}

for (const [label, p] of [['lib/data/videos/getListingVideos.ts', RESOLVER], ['next.config.ts', NEXT_CONFIG]]) {
  if (!fs.existsSync(p)) fail(`${label} is missing — cannot verify embed/CSP parity.`)
}
const resolverSrc = fs.readFileSync(RESOLVER, 'utf8')
const configSrc = fs.readFileSync(NEXT_CONFIG, 'utf8')

// ── Framable hosts FROM the code (dynamic — catches a new tour provider) ──
// normalizeEmbed's explicit iframe OR-block ends in: return { url, embedType: 'iframe' }
// (bare `url,` — distinct from the gdrive/parsed returns that build a new url).
// The condition is a pure chain of `low.includes('host') || ...` whose body is
// exactly `return { url, embedType: 'iframe' }`. Anchoring on that shape avoids
// swallowing the earlier dropbox/youtu.be branches (which return link/video-tag).
const blockMatch = resolverSrc.match(
  /if\s*\(\s*((?:low\.includes\([^)]*\)\s*\|\|\s*)*low\.includes\([^)]*\))\s*\)\s*\{\s*return\s*\{\s*url,\s*embedType:\s*['"]iframe['"]\s*\}/,
)
if (!blockMatch) {
  fail(
    "could not locate normalizeEmbed's iframe OR-block (the `if (...) return { url, embedType: 'iframe' }`). " +
      'It was refactored — update this gate so parity stays enforced rather than silently skipped.',
  )
}
const blockHosts = [...blockMatch[1].matchAll(/includes\(\s*['"]([^'"]+)['"]\s*\)/g)]
  .map((m) => m[1].toLowerCase())
  // strip any path (e.g. zillow.com/view-imx -> zillow.com) down to the host
  .map((h) => h.split('/')[0])
  .filter((h) => h.includes('.'))

// ── Stable canonical providers normalizeEmbed also frames (non OR-block paths) ──
// video-embed.ts emits www.youtube.com/embed + player.vimeo.com; the gdrive
// branch emits drive.google.com/.../preview. These rarely change; pin them so a
// CSP edit that drops one is still caught.
const BASELINE = ['youtube.com', 'drive.google.com']

const required = [...new Set([...blockHosts, ...BASELINE])].sort()

// ── frame-src directive from the CSP header in next.config.ts ──
const fsMatch = configSrc.match(/frame-src\s+([^;]+)/)
if (!fsMatch) fail('no frame-src directive found in next.config.ts CSP — every framable host would be blocked.')
const frameSrc = fsMatch[1].toLowerCase()

// A host is covered if frame-src lists it (allowing for *.host and www.host forms,
// which contain the bare host as a substring).
const missing = required.filter((h) => !frameSrc.includes(h))
if (missing.length) {
  fail(
    missing.map(
      (h) =>
        `'${h}' is framed by normalizeEmbed but NOT in next.config.ts CSP frame-src — its tour renders ` +
        `"This content is blocked." Add https://${h} (or https://*.${h}) to frame-src.`,
    ),
  )
}

console.log(
  `Embed/CSP-parity gate passed (${required.length} framable hosts all present in frame-src: ${required.join(', ')}).`,
)
