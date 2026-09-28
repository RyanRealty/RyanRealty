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
    expect(heading).toBe('You asked $616,900 for 40 days, then $589,900 and did not sell.')
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

  it('does not let a multi-step exposure end the heading on an earlier ask', () => {
    const heading = whatHappenedHeading({
      subject: { ...subject, streetAddress: '12 Cedar Post', lastListPrice: 745_000 },
      pricing: { recommended: 312_000, valueLow: 185_000, valueHigh: 429_000 } as CmaPricing,
      expiredAudit: {
        findings: [],
        finalCycle: { days: 180 },
        askExposure: {
          segments: [
            { ask: 775_000, from: '2026-02-01', to: '2026-04-01', days: 60, sharePct: 40, pctAboveRangeTop: null },
            { ask: 760_000, from: '2026-04-01', to: '2026-08-01', days: 120, sharePct: 60, pctAboveRangeTop: null },
          ],
          dominant: { ask: 760_000, from: '2026-04-01', to: '2026-08-01', days: 120, sharePct: 60, pctAboveRangeTop: null },
          final: { ask: 760_000, from: '2026-04-01', to: '2026-08-01', days: 120, sharePct: 60, pctAboveRangeTop: null },
          sentence: 'You asked $775,000 for 60 days, then $760,000 for 120.',
        },
      },
    } as unknown as OpinionPageArgs)
    expect(heading).toBe(
      'You asked $775,000 for 60 days, then $760,000 for 120, then $745,000 and did not sell.',
    )
    const banner = /you asked (\$[\d,]+[^.]*)\./i.exec(heading)
    expect(banner).not.toBeNull()
    const asks = [...banner![1]!.matchAll(/\$([\d,]+)/g)].map((m) => Number(m[1]!.replace(/,/g, '')))
    expect(asks[asks.length - 1]).toBe(745_000)
  })
})
