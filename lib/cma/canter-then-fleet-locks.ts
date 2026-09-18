/**
 * Matt 2026-09-17: Prove CMA locks on Canter first (near Flex / live bar),
 * then apply ALL locks to every CMA via these shared engine paths.
 * Tip Ready: node scripts/lib/taste-receipt.mjs --ship lib/cma/canter-then-fleet-locks.parity.json
 *
 * HOLD send until Matt clears Flex A/B for the Canter dollar bar.
 */

/** Shared modules that carry the Matt CMA lock set (not Canter-only forks). */
export const CMA_FLEET_LOCK_MODULES = [
  'lib/pricing/closed-comp-weight.ts',
  'lib/pricing/recommended-in-band.ts',
  'lib/pricing/active-dom-nudge.ts',
  'lib/pricing/exclusive-pocket-date-adj.ts',
  'lib/cma/comparable-dom-history.ts',
  'lib/cma/cover-value.ts',
  'lib/cma/render-pricing-page.ts',
  'lib/cma/build.ts',
] as const

export function isFleetSharedLockPath(path: string): boolean {
  const norm = path.replace(/\\/g, '/')
  return CMA_FLEET_LOCK_MODULES.some((m) => norm.endsWith(m) || norm.includes(`/${m}`))
}
