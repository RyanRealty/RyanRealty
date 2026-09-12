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

  it('passes demoMatch true', () => {
    expect(tasteDoneProblems({ demoMatch: true, adaptedFrom: catalogAdapted })).toEqual([])
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

  it('passes honest grok-4.6 demoMatch true evidence', () => {
    expect(
      siteQueueDoneEvidenceProblems(
        'grok-4.6 median 72 (70/74/72) demoMatch: true. SEO title + inventory facts on cards.',
        { versionGap: 'SITE-90' },
      ),
    ).toEqual([])
  })

  it('does not bind a non-SITE node', () => {
    expect(siteQueueDoneEvidenceProblems('shipped', { versionGap: 'G12' })).toEqual([])
  })
})
