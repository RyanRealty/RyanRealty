#!/usr/bin/env node
/**
 * check-valuation-engine.mjs — CMA, expired audit and BPO price the SAME way.
 *
 * Matt, Brain Dump 2 (2026-07-28): "CMAs, Audits, BPOs should all use the same
 * logic when determining price and information."
 *
 * At the time of writing they already did — `lib/cma/build.ts` (which builds both
 * `cma` and `expired-audit` documents, keyed by its `docType` input) and
 * `lib/bpo/build.ts` both route through the same three functions. This gate
 * exists so that stays true. The failure it prevents is quiet: someone adds a
 * bespoke `recommended = median(...)` to one build path, and two documents for
 * the same address start disagreeing on price with nothing failing.
 *
 * Two checks per build path:
 *   1. It imports the shared engine — selectComps (or selectCompsByKeys) from
 *      lib/cma/comps, and adjustComps + computePricing from lib/cma/pricing.
 *   2. It does NOT define its own comp-selection or pricing function.
 *
 * Usage: node scripts/check-valuation-engine.mjs
 */
import { readFileSync, existsSync } from 'node:fs'

/** Every path that produces a priced valuation document. */
const BUILD_PATHS = ['lib/cma/build.ts', 'lib/bpo/build.ts']

/** The shared engine. A build path must import each of these groups. */
const REQUIRED = [
  { label: 'comp selection (lib/cma/comps)', any: ['selectComps', 'selectCompsByKeys'], from: '@/lib/cma/comps' },
  { label: 'comp adjustment (lib/cma/pricing)', any: ['adjustComps'], from: '@/lib/cma/pricing' },
  { label: 'price computation (lib/cma/pricing)', any: ['computePricing'], from: '@/lib/cma/pricing' },
]

/**
 * A local re-implementation of the engine. Matching a DEFINITION, never a call —
 * `const p = computePricing(...)` is the correct usage and must not trip this.
 */
const FORBIDDEN_LOCAL_DEFS = [
  /\b(?:function|const|let)\s+computePricing\b/,
  /\b(?:function|const|let)\s+adjustComps\b/,
  /\b(?:function|const|let)\s+selectComps\b/,
]

const fails = []

for (const path of BUILD_PATHS) {
  if (!existsSync(path)) {
    fails.push(`${path}: build path missing from disk — update BUILD_PATHS or restore the file`)
    continue
  }
  const src = readFileSync(path, 'utf8')

  for (const req of REQUIRED) {
    // The symbol must be imported, and from the shared module.
    const imported = req.any.some((sym) => new RegExp(`\\b${sym}\\b`).test(src))
    const fromShared = src.includes(req.from)
    if (!imported || !fromShared) {
      fails.push(`${path}: does not use the shared ${req.label} — expected one of ${req.any.join('/')} from ${req.from}`)
    }
  }

  for (const re of FORBIDDEN_LOCAL_DEFS) {
    const m = src.match(re)
    if (m) {
      fails.push(
        `${path}: defines its own "${m[0]}" instead of importing the shared engine. ` +
          `Two build paths with two pricing implementations is exactly the drift this gate exists to stop.`,
      )
    }
  }
}

if (fails.length > 0) {
  console.error('Valuation-engine gate FAILED — CMA / audit / BPO pricing has diverged:\n')
  for (const f of fails) console.error(`  ✗ ${f}`)
  console.error(
    '\nEvery priced document must resolve comps and price through lib/cma/comps + lib/cma/pricing.\n' +
      'An intentional difference belongs in those functions as a documented parameter,\n' +
      'not as a second implementation in a build path.',
  )
  process.exit(1)
}

console.log(`Valuation-engine gate OK — ${BUILD_PATHS.length} build path(s) share one comp + pricing engine.`)
