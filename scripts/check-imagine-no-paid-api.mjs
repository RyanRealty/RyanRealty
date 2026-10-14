#!/usr/bin/env node
/**
 * check-imagine-no-paid-api.mjs (ci:imagine-no-paid-api). Matt rule: Grok
 * Imagine runs on the X subscription (Imagine app / grok CLI), never the paid
 * xAI API. Fails on any NEW file that calls the paid image/video endpoints or
 * models. Files already doing it on 2026-10-13 are a ratchet baseline: they
 * may shrink, never grow, and need Matt's call to remove.
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const PATTERN = /api\.x\.ai\/v1\/(images|videos?)\b|images\/generations|\/v1\/videos?\/generations|grok-imagine-(image|video)|grok-2-image/i
const BASELINE = new Set([
  'lib/grok/client.ts',
  'lib/grok/image.ts',
  'lib/grok/video.ts',
  'lib/studio/produce.ts',
  'lib/studio/spend.ts',
])
const files = execSync("git ls-files 'app/**' 'components/**' 'lib/**' 'scripts/**' '.claude/**'", { encoding: 'utf8' })
  .split('\n')
  .filter((f) => /\.(t|j)sx?$|\.mjs$|\.cjs$|\.py$|\.sh$/.test(f))
  .filter((f) => !/\.test\./.test(f) && f !== 'scripts/check-imagine-no-paid-api.mjs')
const hits = []
for (const f of files) {
  if (BASELINE.has(f)) continue
  const lines = readFileSync(f, 'utf8').split('\n')
  lines.forEach((l, i) => { if (PATTERN.test(l)) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 120)}`) })
}
console.log('Imagine uses the subscription, never the paid API (ci:imagine-no-paid-api)')
if (hits.length) {
  for (const h of hits) console.error('  ✗ ' + h)
  console.error('\nFAILED: generate Imagine stills and video in the Imagine app or grok CLI on the subscription. No paid xAI image/video API calls.')
  process.exit(1)
}
console.log(`OK: ${files.length} files checked, ${BASELINE.size} baseline files frozen.`)
