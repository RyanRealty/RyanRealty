import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { inSmsQuietHours } from '@/lib/crm/quiet-hours'

/**
 * C1 from the 2026-09-20 deep audit: the sequence engine kept a 9pm quiet-hours
 * fork while Oregon (ORS 646.563 after HB 3865) is 8pm. This file is the
 * ratchet so the copy cannot return.
 */
const helpers = readFileSync(
  new URL('./helpers.ts', import.meta.url),
  'utf8',
)

describe('sequence-engine SMS quiet hours', () => {
  it('does not keep a 9pm fork — Oregon is 8pm', () => {
    expect(helpers).not.toMatch(/h\s*>=\s*21/)
    expect(helpers).not.toMatch(/9 PM/)
    expect(helpers).toContain("@/lib/crm/quiet-hours")
  })

  it('shares the canonical 8pm window (8pm PDT is quiet)', () => {
    expect(inSmsQuietHours(new Date('2026-06-25T03:00:00Z'))).toBe(true)
  })
})
