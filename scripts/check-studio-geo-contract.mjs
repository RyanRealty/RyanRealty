#!/usr/bin/env node
/**
 * check-studio-geo-contract.mjs — two column facts that fail SILENTLY.
 *
 * Both of these shipped in the studio's first draft and both produced an
 * empty result rather than an error, which is the dangerous shape: the
 * editorial layer concluded "nothing is on the market today" and acted on it.
 *
 *   1. listings SFR is `property_sub_type` (bare lower case).
 *      `PropertySubType` does not exist. PostgREST returns an error that
 *      calling code typically swallows into an empty array.
 *
 *   2. market_pulse_live holds ZERO rows at geo_type 'community'.
 *      Resort communities are stored as 'neighborhood'. A community lookup
 *      type-checks, runs, and returns null forever.
 *
 * Verified live 2026-08-26: 3,651 Active SFR via property_sub_type;
 * market_pulse_live geo_type counts are city 16, neighborhood 28, region 1.
 *
 * Usage: node scripts/check-studio-geo-contract.mjs [--json]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const JSON_OUT = process.argv.includes('--json')

const SCAN_DIRS = ['lib', 'app', 'scripts']
const SKIP = new Set(['node_modules', '.next', '.git', 'out', 'public'])
const SELF = 'scripts/check-studio-geo-contract.mjs'

/**
 * Both rules match the QUERY shape only, never the wire-field shape.
 *
 * `pick(fields, 'PropertySubType')` in lib/listing-mapper.ts is correct: that
 * IS the RETS field name arriving from Spark, and the mapper writes it into
 * the snake_case column. Only a Supabase filter or select on the mixed-case
 * name is wrong. Same discipline for 'community': it is a legitimate label in
 * type unions and on the MLS wire, and only a getMarketPulse call is broken.
 */
const RULES = [
  {
    id: 'sfr-column',
    pattern: /\.(?:eq|neq|filter|match|in)\(\s*['"`]PropertySubType['"`]/g,
    message:
      'listings has no `PropertySubType` column. Use `property_sub_type` (bare lower case). ' +
      'The wrong name returns a PostgREST error that reads as an empty result.',
  },
  {
    id: 'community-pulse',
    pattern: /getMarketPulse\(\s*\{[^}]*geoType:\s*['"]community['"]/g,
    message:
      "market_pulse_live has no geo_type='community' rows. Resort communities are " +
      "stored as geo_type='neighborhood'; getMarketPulse with 'community' returns null forever.",
  },
]

function walk(dir, acc = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const entry of entries) {
    if (SKIP.has(entry)) continue
    const full = join(dir, entry)
    let stats
    try {
      stats = statSync(full)
    } catch {
      continue
    }
    if (stats.isDirectory()) walk(full, acc)
    else if (/\.(ts|tsx|mjs|js)$/.test(entry)) acc.push(full)
  }
  return acc
}

const findings = []
for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file)
    if (rel === SELF) continue
    const source = readFileSync(file, 'utf8')
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0
      let match
      while ((match = rule.pattern.exec(source)) !== null) {
        const line = source.slice(0, match.index).split('\n').length
        // A doc comment naming the wrong spelling is the fix, not the bug.
        const lineText = source.split('\n')[line - 1] ?? ''
        if (/^\s*(\*|\/\/)/.test(lineText)) continue
        findings.push({ file: rel, line, rule: rule.id, message: rule.message })
      }
    }
  }
}

if (JSON_OUT) {
  console.log(JSON.stringify({ ok: findings.length === 0, findings }, null, 2))
} else if (findings.length > 0) {
  console.error('check-studio-geo-contract: FAIL\n')
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  [${f.rule}]`)
    console.error(`    ${f.message}\n`)
  }
} else {
  console.log('check-studio-geo-contract: OK. No silently-empty geo or SFR lookups.')
}

process.exit(findings.length === 0 ? 0 : 1)
