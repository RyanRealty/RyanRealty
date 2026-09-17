/**
 * Matt 2026-09-17: Canter first, then apply ALL locks to every CMA.
 * Tip Ready: node scripts/lib/taste-receipt.mjs --ship lib/cma/canter-then-fleet-locks.parity.json
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CMA_FLEET_LOCK_MODULES,
  isFleetSharedLockPath,
} from '@/lib/cma/canter-then-fleet-locks'

const root = process.cwd()

describe('Canter-first then fleet CMA locks', () => {
  it('contract: locks-live-on-shared-engine-paths', () => {
    expect(CMA_FLEET_LOCK_MODULES.length).toBeGreaterThanOrEqual(5)
    for (const rel of CMA_FLEET_LOCK_MODULES) {
      expect(isFleetSharedLockPath(rel)).toBe(true)
      const body = readFileSync(join(root, rel), 'utf8')
      // No Canter-only early return that would skip other subjects.
      expect(body).not.toMatch(/if\s*\([^)]*canter[^)]*\)\s*return/i)
      expect(body).not.toMatch(/ONLY_CANTER|canterOnly|skipUnlessCanter/i)
    }
  })

  it('contract: canter-proves-then-fleet-applies', () => {
    // Scope note lives on the letter FLOW Tip Ready + this list.
    expect(CMA_FLEET_LOCK_MODULES).toContain('lib/pricing/closed-comp-weight.ts')
    expect(CMA_FLEET_LOCK_MODULES).toContain('lib/pricing/recommended-in-band.ts')
    expect(CMA_FLEET_LOCK_MODULES).toContain('lib/pricing/active-dom-nudge.ts')
  })
})
