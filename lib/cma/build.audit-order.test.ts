import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = readFileSync(join(process.cwd(), 'lib/cma/build.ts'), 'utf8')

describe('CMA first-build audit order', () => {
  it('stamps the failed last cycle and honest narrative before the adversarial audit', () => {
    const cycle = src.indexOf('lastCycleFailed')
    const honest = src.indexOf('honestComparabilityLine')
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

  it('grades the audit on the list after the nudge and the rounding', () => {
    const finish = src.lastIndexOf('finishRecommendedAfterActives(')
    const refresh = src.indexOf('rebaseAuditToFinalRec(audit')
    const graded = src.lastIndexOf('evaluateAccuracyContract({ ...accuracyContractInput, pricing, audit })')
    expect(finish).toBeGreaterThan(0)
    expect(refresh).toBeGreaterThan(finish)
    expect(graded).toBeGreaterThan(refresh)
  })
})
