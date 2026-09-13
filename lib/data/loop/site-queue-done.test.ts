import { describe, expect, it } from 'vitest'
import { siteQueueDoneEvidenceProblems } from './site-queue-done'

const PASSING_RECEIPT = {
  competitiveBriefPass: true,
  demoMatch: true,
  evaluatorModel: 'grok-4.6',
  shotsHash: `sha256:${'a'.repeat(64)}`,
} as const

describe('siteQueueDoneEvidenceProblems', () => {
  it('blocks Tip Ready on a cream-box score rise', () => {
    const p = siteQueueDoneEvidenceProblems(
      'SITE-90 About: FacePortrait imported Avatar, ci:catalog-install green, score rose 31 → 48. Tip Ready.',
      { versionGap: 'SITE-90' },
    )
    expect(p.join('\n')).toMatch(/demoMatch: true/)
  })

  it('blocks SITE-99 with no demoMatch (CLI missing, no fallback verdict)', () => {
    const p = siteQueueDoneEvidenceProblems(
      'eight catalog files imported; Tip Ready; no grok CLI at GROK_CLI',
      { versionGap: 'SITE-99' },
    )
    expect(p.join('\n')).toMatch(/CLI missing/)
  })

  it('blocks a bare 402 with no fallback verdict', () => {
    const p = siteQueueDoneEvidenceProblems(
      'taste-evaluate: grok CLI 402 (subscription/quota). Tip Ready anyway, files on disk.',
      { versionGap: 'SITE-99' },
    )
    expect(p.join('\n')).toMatch(/402 and no fallback verdict/)
  })

  it('accepts a 402 followed by the claude fallback when the receipt backs it', () => {
    expect(
      siteQueueDoneEvidenceProblems(
        'grok 402 → fell back to claude-sonnet-5 via taste-evaluate.ts listing-detail — demoMatch: true, median 72',
        {
          versionGap: 'SITE-99',
          tasteReview: { demoMatch: true, evaluatorModel: 'claude-sonnet-5', shotsHash: PASSING_RECEIPT.shotsHash },
        },
      ),
    ).toEqual([])
  })

  it('refuses a 402 + claimed fallback when no receipt is on disk', () => {
    const p = siteQueueDoneEvidenceProblems(
      'grok 402 → fell back to claude — demoMatch: true, median 72',
      { versionGap: 'SITE-99', loadParity: false },
    )
    expect(p.join('\n')).toMatch(/fallback verdict must be on the route/)
  })

  it('refuses a builder model signing as the judge', () => {
    const p = siteQueueDoneEvidenceProblems(
      'npx tsx scripts/taste-evaluate.ts about — demoMatch: true, competitiveBriefPass: true, median 71',
      { versionGap: 'SITE-90', tasteReview: { ...PASSING_RECEIPT, evaluatorModel: 'grok-4.5' } },
    )
    expect(p.join('\n')).toMatch(/evaluatorModel must be one of the judge chain/)
  })

  it('accepts claude-opus-5 as the fallback judge on a briefed route', () => {
    expect(
      siteQueueDoneEvidenceProblems(
        'npx tsx scripts/taste-evaluate.ts about — claude-opus-5 demoMatch: true, competitiveBriefPass: true, median 71',
        { versionGap: 'SITE-90', tasteReview: { ...PASSING_RECEIPT, evaluatorModel: 'claude-opus-5' } },
      ),
    ).toEqual([])
  })

  it('refuses a hand-typed competitiveBriefPass:true when parity pass is false', () => {
    const p = siteQueueDoneEvidenceProblems(
      'npx tsx scripts/taste-evaluate.ts about — grok-4.6 demoMatch: true, competitiveBriefPass: true, median 71',
      {
        versionGap: 'SITE-90',
        tasteReview: {
          competitiveBriefPass: false,
          demoMatch: false,
          evaluatorModel: 'grok-4.6',
        },
      },
    )
    expect(p.join('\n')).toMatch(/competitiveBriefPass must be the boolean true/)
    expect(p.join('\n')).toMatch(/Bare evidence prose/)
  })

  it('refuses SITE-90 Tip Ready when competitiveBriefPass is omitted', () => {
    const p = siteQueueDoneEvidenceProblems(
      'npx tsx scripts/taste-evaluate.ts about — grok-4.6 demoMatch: true, median 71',
      { versionGap: 'SITE-90' },
    )
    expect(p.join('\n')).toMatch(/competitiveBriefPass: true/)
  })

  it('refuses competitiveBriefPass false', () => {
    const p = siteQueueDoneEvidenceProblems(
      'grok-4.6 demoMatch: true, competitiveBriefPass: false',
      { versionGap: 'SITE-90' },
    )
    expect(p.join('\n')).toMatch(/competitiveBriefPass false/)
  })

  it('accepts a real demo match only when the receipt boolean is true', () => {
    expect(
      siteQueueDoneEvidenceProblems(
        'npx tsx scripts/taste-evaluate.ts about — grok-4.6 demoMatch: true, competitiveBriefPass: true, median 71',
        { versionGap: 'SITE-90', tasteReview: PASSING_RECEIPT },
      ),
    ).toEqual([])
  })
})
