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

  it('blocks SITE-99 with no grok-4.6 demoMatch (CLI missing)', () => {
    const p = siteQueueDoneEvidenceProblems(
      'eight catalog files imported; Tip Ready; no grok CLI at GROK_CLI',
      { versionGap: 'SITE-99' },
    )
    expect(p.join('\n')).toMatch(/CLI missing/)
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
