import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Source contract for the CMA performance report.
 *
 * On 2026-07-30 this report counted 9 documents as sent when the truth was 4.
 * The query filtered `status != 'archived'`, but archiving in this schema sets
 * the `archived_at` TIMESTAMP and leaves `status` alone — so five archived
 * zz-test-rebrand rows, each carrying a real delivered_at written by an
 * integration test, were counted as client sends.
 *
 * A source-text contract rather than a DB test on purpose: this asserts the
 * FILTER exists, which is the thing that regressed, and it runs in the unit
 * suite with no credentials.
 */
const SRC = readFileSync(join(process.cwd(), 'lib/data/cma/getCmaPerformance.ts'), 'utf8')

describe('getCmaPerformance — archived rows never reach the funnel counts', () => {
  it("excludes rows by archived_at, not only by status", () => {
    expect(SRC).toMatch(/\.is\(\s*'archived_at'\s*,\s*null\s*\)/)
  })

  it('still excludes the archived status, so both spellings are covered', () => {
    expect(SRC).toMatch(/\.neq\(\s*'status'\s*,\s*'archived'\s*\)/)
  })

  it('gates every downstream funnel stage on delivered_at', () => {
    // opened/viewed are meaningless on a document that was never sent.
    expect(SRC).toMatch(/delivered_at\s*!=\s*null/)
  })
})
