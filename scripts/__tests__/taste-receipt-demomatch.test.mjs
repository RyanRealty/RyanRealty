import { describe, expect, it } from 'vitest'
import {
  catalogDemoMatchProblems,
  siteQueueDoneEvidenceProblems,
  tasteDoneProblems,
} from '../lib/taste-receipt.mjs'

const catalogAdapted = [{ id: 'shadcn-avatar' }, { id: 'house-faces' }]

function receipt(over = {}) {
  return {
    evaluatedAt: '2026-09-12',
    rubricVersion: 'v1-2026-09-12',
    adaptedFrom: catalogAdapted,
    comparedToPrior: 'rose',
    score: 72,
    demoMatch: true,
    ...over,
  }
}

describe('catalogDemoMatchProblems — cream box vs demo match', () => {
  it('fails a cream-box receipt that claims rise without demoMatch', () => {
    const tr = receipt()
    delete tr.demoMatch
    const p = catalogDemoMatchProblems(tr)
    expect(p.join('\n')).toMatch(/demoMatch must be true or false/)
    expect(p.join('\n')).toMatch(/not done/)
  })

  it('fails a cream-box receipt that claims rise with demoMatch false', () => {
    const p = catalogDemoMatchProblems(receipt({ demoMatch: false }))
    expect(p.join('\n')).toMatch(/demoMatch is false/)
    expect(p.join('\n')).toMatch(/cream-box/)
  })

  it('fails a finish-line score without demoMatch true', () => {
    const p = catalogDemoMatchProblems(
      receipt({ comparedToPrior: 'rebaselined', score: 71, demoMatch: false }),
    )
    expect(p.join('\n')).toMatch(/finish line is not done/)
  })

  it('passes a catalog receipt with demoMatch true and a rise', () => {
    expect(catalogDemoMatchProblems(receipt())).toEqual([])
  })

  it('lets a pre-rule city-style rise sit (honest legacy, no demoMatch field)', () => {
    expect(
      catalogDemoMatchProblems({
        evaluatedAt: '2026-09-10',
        rubricVersion: 'v1-2026-09-10',
        adaptedFrom: [{ id: 'beui-number' }],
        comparedToPrior: 'rose',
        score: 63,
      }),
    ).toEqual([])
  })

  it('lets an in-progress rebaseline record demoMatch false below 70', () => {
    expect(
      catalogDemoMatchProblems(
        receipt({ comparedToPrior: 'rebaselined', score: 57, demoMatch: false }),
      ),
    ).toEqual([])
  })

  it('ignores house-only adaptedFrom', () => {
    expect(
      catalogDemoMatchProblems(
        receipt({ adaptedFrom: [{ id: 'house-atlas' }, { id: 'V3Proof' }], demoMatch: undefined }),
      ),
    ).toEqual([])
  })
})

describe('tasteDoneProblems — Tip Ready / node-complete', () => {
  it('refuses omitted demoMatch', () => {
    expect(tasteDoneProblems({ score: 80, adaptedFrom: catalogAdapted }).join('\n')).toMatch(
      /demoMatch must be true or false/,
    )
  })

  it('refuses demoMatch false', () => {
    expect(tasteDoneProblems({ demoMatch: false, adaptedFrom: catalogAdapted }).join('\n')).toMatch(
      /demoMatch is false/,
    )
  })

  it('passes demoMatch true on the grok-4.6 instrument when open-state + route import hold', () => {
    expect(
      tasteDoneProblems(
        {
          demoMatch: true,
          evaluatorModel: 'grok-4.6',
          adaptedFrom: catalogAdapted,
          shots: { 'desktop-search-open': 'shots/search-open.png' },
          shotSpec: { states: ['search-open'] },
        },
        {
          catalog: {
            installById: {
              'shadcn-avatar': {
                file: 'components/ui/avatar.tsx',
                import: '@/components/ui/avatar',
                add: 'avatar',
              },
            },
          },
          route: 'app/about/page.tsx',
          catalogIo: {
            existsSync: (p) => p === 'components/ui/avatar.tsx' || p === 'app/about/page.tsx',
            readFileSync: (p) =>
              p === 'app/about/page.tsx'
                ? "import { Avatar } from '@/components/ui/avatar'\nexport const Page = Avatar\n"
                : 'export function Avatar() { return null }\n',
            scanFiles: ['app/about/page.tsx'],
          },
        },
      ),
    ).toEqual([])
  })
})

describe('siteQueueDoneEvidenceProblems — SITE evidence text', () => {
  it('refuses SITE evidence without demoMatch true', () => {
    const p = siteQueueDoneEvidenceProblems('score rose 55 → 72, adaptedFrom shadcn-avatar', {
      versionGap: 'SITE-90',
    })
    expect(p.join('\n')).toMatch(/demoMatch: true/)
    expect(p.join('\n')).toMatch(/Tip Ready/)
  })

  it('refuses a recorded false verdict', () => {
    const p = siteQueueDoneEvidenceProblems('grok-4.6 median 72, demoMatch: false', {
      versionGap: 'SITE-90',
    })
    expect(p.join('\n')).toMatch(/demoMatch false/)
  })

  it('refuses a 402 with no invented pass', () => {
    const p = siteQueueDoneEvidenceProblems('taste-evaluate grok CLI 402 payment required', {
      versionGap: 'SITE-99',
    })
    expect(p.join('\n')).toMatch(/402/)
    expect(p.join('\n')).toMatch(/do not invent demoMatch/i)
  })

  it('refuses a missing CLI', () => {
    const p = siteQueueDoneEvidenceProblems('no grok CLI; claimed Tip Ready from score rise', {
      versionGap: 'SITE-99',
    })
    expect(p.join('\n')).toMatch(/CLI missing/)
  })

  it('passes honest grok-4.6 demoMatch true evidence only with a true receipt', () => {
    expect(
      siteQueueDoneEvidenceProblems(
        'grok-4.6 median 72 (70/74/72) demoMatch: true, competitiveBriefPass: true. SEO title + inventory facts on cards.',
        {
          versionGap: 'SITE-90',
          tasteReview: {
            competitiveBriefPass: true,
            demoMatch: true,
            evaluatorModel: 'grok-4.6',
            shotsHash: `sha256:${'a'.repeat(64)}`,
            competitiveBriefEvidence: {
              '1': 'Ryan Realty is a boutique brokerage in Central Oregon that helps clients buy and sell their properties.',
              '2': 'The brokers are on /team. The person you talk to first is the person who works with you through closing.',
              '3': 'Hero (office exterior + purpose), V3Proof as first proof, closings,',
              '4': 'Call | Text | Email | Schedule. Live hours stay V3OnDuty above this.',
              '5': "street: '115 NW Oregon Ave #2'",
              '6': '5. AboutOffice — 115 NW Oregon Ave #2 + firm OREA. Brokers on /team only. * 6. AboutInquiry GET to /contact.',
              '7': '/about first viewport — Redfin structure. Navy and cream only.',
              '8': 'Firm closings as the shadcn carousel + Card demo (SITE-90).',
            },
          },
        },
      ),
    ).toEqual([])
  })

  it('refuses SITE-90 evidence that omits competitiveBriefPass', () => {
    const p = siteQueueDoneEvidenceProblems(
      'grok-4.6 median 72 (70/74/72) demoMatch: true. SEO title + inventory facts on cards.',
      { versionGap: 'SITE-90' },
    )
    expect(p.join('\n')).toMatch(/competitiveBriefPass: true/)
  })

  it('does not bind a non-SITE node', () => {
    expect(siteQueueDoneEvidenceProblems('shipped', { versionGap: 'G12' })).toEqual([])
  })
})
