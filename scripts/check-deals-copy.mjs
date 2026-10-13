#!/usr/bin/env node
/**
 * check-deals-copy.mjs (ci:deals-copy). Best Deals in Bend brief, 2026-10-13:
 * the price-drops / deals pages never say "steal", "bargain", "below market
 * value", "under market" or "buyer's market", and never imply a seller is
 * distressed or desperate. A price cut is not proof of below-market.
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const BANNED = /\b(steals?|bargains?|below[- ]market(?: value)?|under[- ]market|buyer'?s market|distressed|desperate)\b/i
const files = execSync("git ls-files 'app/price-drops/**' 'app/deals/**' 'components/deals/**'", { encoding: 'utf8' })
  .split('\n').filter((f) => /\.(t|j)sx?$/.test(f) && !/\.test\./.test(f))
const hits = []
for (const f of files) readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
  if (BANNED.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l)) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 120)}`)
})
console.log('deals page copy (ci:deals-copy)')
if (hits.length) { for (const h of hits) console.error('  ✗ ' + h); console.error('\nFAILED: say "Buyers have leverage" and show the cut. No steal/bargain/below-market/buyer\'s market claims.'); process.exit(1) }
console.log(`OK: ${files.length} files.`)
