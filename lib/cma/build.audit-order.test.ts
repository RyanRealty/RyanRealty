import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = readFileSync(join(process.cwd(), 'lib/cma/build.ts'), 'utf8')

describe('CMA first-build audit order', () => {
  it('stamps the failed last cycle and honest narrative before the adversarial audit', () => {
    const cycle = src.indexOf('lastCycleFailed')
    // The honest line prints from the one narrative gate (lib/cma/narrative-final.ts).
    const honest = src.indexOf('narrativeGate.gate(')
    const cap = src.indexOf('applyFailedAskCap(pricing')
    const audit = src.indexOf('let audit = await auditCma')
    expect(cycle).toBeGreaterThan(0)
    expect(honest).toBeGreaterThan(0)
    expect(cap).toBeGreaterThan(0)
    expect(audit).toBeGreaterThan(0)
    expect(cycle).toBeLessThan(audit)
    expect(honest).toBeLessThan(audit)
    expect(cap).toBeLessThan(audit)
  })

  it('grades the one stored audit on the list after the nudge and the rounding', () => {
    const finish = src.indexOf('finishRecommendedAfterActives(')
    const audit = src.indexOf('let audit = await auditCma')
    const graded = src.indexOf('evaluateAccuracyContract(accuracyContractInput)')
    expect(finish).toBeGreaterThan(0)
    expect(audit).toBeGreaterThan(finish)
    expect(graded).toBeGreaterThan(audit)
    expect(src).not.toContain('rebaseAuditToFinalRec')
  })
})
