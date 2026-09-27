import { describe, expect, it } from 'vitest'
import { resolveAskPosition } from '@/lib/cma/ask-position'
import { whatHappenedHeading } from '@/lib/cma/opinion-pages'
import { buildFailedAskItem } from '@/lib/cma/listing-plan'
import type { OpinionPageArgs } from '@/lib/cma/opinion-pages'
import type { CmaPricing, CmaSubject } from '@/lib/cma/types'

const subject = {
  streetAddress: '20594 Slate',
  city: 'Bend',
  lastListPrice: 589_900,
  standardStatus: 'Expired',
} as CmaSubject

describe('one ask position — Slate', () => {
  it('labels the original ask and the last ask instead of using both as the ask', () => {
    const position = resolveAskPosition({
      lastListPrice: 589_900,
      exposure: {
        segments: [{ ask: 616_900 }],
        final: 616_900,
      },
    })
    expect(position.originalAsk).toBe(616_900)
    expect(position.lastAsk).toBe(589_900)

    const heading = whatHappenedHeading({
      subject,
      pricing: { recommended: 620_000, valueLow: 594_000, valueHigh: 623_000 } as CmaPricing,
      expiredAudit: {
        findings: [],
        finalCycle: { days: 40 },
        askExposure: {
          segments: [
            {
              ask: 616_900,
              from: '2026-01-01',
              to: '2026-03-01',
              days: 40,
              sharePct: 100,
              pctAboveRangeTop: null,
            },
          ],
          dominant: { ask: 616_900, from: '2026-01-01', to: '2026-03-01', days: 40, sharePct: 100, pctAboveRangeTop: null },
          final: { ask: 616_900, from: '2026-01-01', to: '2026-03-01', days: 40, sharePct: 100, pctAboveRangeTop: null },
          sentence: 'You asked $616,900 for all 40 days you were on the market.',
        },
      },
    } as unknown as OpinionPageArgs)
    expect(heading).toContain('You first asked $616,900')
    expect(heading).toContain('The last listing asked $589,900')
    expect(heading).not.toBe('You asked $616,900 and did not sell.')

    const item = buildFailedAskItem(
      subject,
      { recommended: 620_000 } as CmaPricing,
      {
        findings: [],
        askExposure: {
          segments: [
            {
              ask: 616_900,
              from: '2026-01-01',
              to: '2026-03-01',
              days: 40,
              sharePct: 100,
              pctAboveRangeTop: null,
            },
          ],
          dominant: { ask: 616_900, from: '2026-01-01', to: '2026-03-01', days: 40, sharePct: 100, pctAboveRangeTop: null },
          final: { ask: 616_900, from: '2026-01-01', to: '2026-03-01', days: 40, sharePct: 100, pctAboveRangeTop: null },
          sentence: '',
        },
      } as never,
    )
    expect(item?.trigger).toContain('The last listing asked $589,900')
    expect(item?.trigger).toContain('The original ask was $616,900')
  })
})
