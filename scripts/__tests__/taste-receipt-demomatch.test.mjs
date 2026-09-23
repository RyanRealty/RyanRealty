import { describe, expect, it } from 'vitest'
import {
  catalogDemoMatchProblems,
  regressionToleranceFor,
  siteQueueDoneEvidenceProblems,
  tasteDoneProblems,
  tasteFloorProblems,
} from '../lib/taste-receipt.mjs'

// Matt 2026-09-23 (visibility audit PROCESS-3 / UXLIVE-11): demoMatch is a
// RECORDED note, not a completion gate; the taste median is a floor that may
// not regress on the same instrument; the 70 finish line no longer decides done.

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

describe('catalogDemoMatchProblems — the verdict is recorded, not required true', () => {
  it('refuses a post-rule catalog receipt that omits demoMatch (a hidden verdict)', () => {
    const tr = receipt()
    delete tr.demoMatch
    expect(catalogDemoMatchProblems(tr).join('\n')).toMatch(/demoMatch must be recorded true or false/)
  })

  it('accepts demoMatch false on a rise (a note, Matt 2026-09-23)', () => {
    expect(catalogDemoMatchProblems(receipt({ demoMatch: false }))).toEqual([])
  })

  it('accepts demoMatch false at or above the old 70 line', () => {
    expect(catalogDemoMatchProblems(receipt({ comparedToPrior: 'rebaselined', score: 71, demoMatch: false }))).toEqual([])
  })

  it('lets a pre-rule receipt with no demoMatch field sit', () => {
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

  it('ignores house-only adaptedFrom', () => {
    expect(
      catalogDemoMatchProblems(receipt({ adaptedFrom: [{ id: 'house-atlas' }, { id: 'V3Proof' }], demoMatch: undefined })),
    ).toEqual([])
  })
})

describe('tasteFloorProblems — no regression on the same instrument', () => {
  const prior = { score: 61, evaluatorModel: 'grok-4.6', rubricVersion: 'v1-2026-09-12', evaluatedAt: '2026-09-13' }
  const held = (score, over = {}) => ({
    evaluatedAt: '2026-09-23',
    evaluatorModel: 'grok-4.6',
    rubricVersion: 'v1-2026-09-12',
    comparedToPrior: 'held',
    score,
    priorMark: prior,
    ...over,
  })

  it('the tolerance is one less than the rise floor', () => {
    expect(regressionToleranceFor('2026-09-23')).toBe(2)
    expect(regressionToleranceFor('2026-09-10')).toBe(0)
  })

  it('accepts a held mark inside the judge noise', () => {
    expect(tasteFloorProblems(held(59))).toEqual([])
    expect(tasteFloorProblems(held(61))).toEqual([])
  })

  it('refuses a fall of the full rise floor', () => {
    expect(tasteFloorProblems(held(58)).join('\n')).toMatch(/taste floor regressed/)
  })

  it('does not compare a mark from another judge', () => {
    expect(tasteFloorProblems(held(40, { evaluatorModel: 'claude-sonnet-5' }))).toEqual([])
  })

  it('still holds honesty', () => {
    const p = tasteFloorProblems(
      held(61, { criteria: { honestyFunction: 8 }, priorMark: { ...prior, criteria: { honestyFunction: 9 } } }),
    )
    expect(p.join('\n')).toMatch(/honestyFunction 8 fell below the prior mark 9/)
  })
})

describe('tasteDoneProblems — Tip Ready / node-complete', () => {
  it('refuses an omitted demoMatch on a catalog receipt', () => {
    expect(tasteDoneProblems({ score: 80, evaluatorModel: 'grok-4.6', adaptedFrom: catalogAdapted }).join('\n')).toMatch(
      /demoMatch must be recorded true or false/,
    )
  })

  it('no longer refuses demoMatch false', () => {
    expect(
      tasteDoneProblems({ demoMatch: false, evaluatorModel: 'grok-4.6', adaptedFrom: [{ id: 'house-faces' }] }).join('\n'),
    ).not.toMatch(/demoMatch is false|not a demo match/)
  })

  it('passes a recorded verdict on the judge chain when open-state + route import hold', () => {
    expect(
      tasteDoneProblems(
        {
          demoMatch: false,
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
  it('accepts evidence with no taste score (a visibility node)', () => {
    expect(
      siteQueueDoneEvidenceProblems('READY at 1a2b3c; title and canonical live on /communities/tetherow.', {
        versionGap: 'SITE-182',
      }),
    ).toEqual([])
  })

  it('accepts a recorded demoMatch false', () => {
    expect(
      siteQueueDoneEvidenceProblems('grok-4.6 median 60, demoMatch: false. Live page checked.', {
        versionGap: 'SITE-93',
        loadParity: false,
      }),
    ).toEqual([])
  })

  it('refuses a 402 with no receipt behind it', () => {
    const p = siteQueueDoneEvidenceProblems('taste-evaluate grok CLI 402 payment required', {
      versionGap: 'SITE-99',
      loadParity: false,
    })
    expect(p.join('\n')).toMatch(/402/)
    expect(p.join('\n')).toMatch(/a failed judge is not a score/)
  })

  it('refuses a missing CLI with no receipt behind it', () => {
    const p = siteQueueDoneEvidenceProblems('no grok CLI; claimed Tip Ready from score rise', {
      versionGap: 'SITE-99',
      loadParity: false,
    })
    expect(p.join('\n')).toMatch(/CLI missing/)
  })

  it('refuses Tip Ready prose without --ship', () => {
    const p = siteQueueDoneEvidenceProblems('grok-4.6 median 72. Tip Ready.', { versionGap: 'SITE-93', loadParity: false })
    expect(p.join('\n')).toMatch(/--ship/)
  })

  it('does not bind a non-SITE node', () => {
    expect(siteQueueDoneEvidenceProblems('shipped', { versionGap: 'G12' })).toEqual([])
  })
})
