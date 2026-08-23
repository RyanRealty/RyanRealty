#!/usr/bin/env node
/**
 * Retired 2026-08-23.
 *
 * Audit p2.2 froze every app/+lib file ≥600 LOC so the real god-file splits
 * (listings actions, DAL barrel, syncWrites) would not drift while they waited
 * on a later build. That freeze never shipped those splits. On origin/main the
 * ratchet was already red, skipped on push, and it forced route-file splinters
 * and comment-trims that did not improve the product.
 *
 * Matt 2026-08-23: remove the floor if it is a hindrance. The npm script stays
 * so ci:gates-wired / the nightly lane keep a target; it does not fail a build.
 */
console.log('ci:file-size-budget: retired 2026-08-23. The 600-LOC floor is not a gate.')
process.exit(0)
