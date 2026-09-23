import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  SITE_DONE_RISE_FLOOR,
  SITE_DONE_RISE_FLOOR_FROM,
  siteQueueDoneEvidenceProblems,
  tasteFloorProblems,
} from './site-queue-done'

// Matt 2026-09-23 (visibility audit PROCESS-3 / UXLIVE-11): done is the
// docs/RUN_LOOP.md accept test; demoMatch / competitiveBriefPass are notes and
// the taste median is a floor that may not regress on the same instrument.

const RECEIPT = {
  evaluatorModel: 'grok-4.6',
  rubricVersion: 'v1-2026-09-12',
  evaluatedAt: '2026-09-23',
  shotsHash: `sha256:${'a'.repeat(64)}`,
  demoMatch: false,
  score: 60,
  comparedToPrior: 'held',
  priorMark: { score: 61, evaluatorModel: 'grok-4.6', rubricVersion: 'v1-2026-09-12' },
} as const

describe('siteQueueDoneEvidenceProblems (Matt 2026-09-23)', () => {
  it('stays in lockstep with the frozen rise floor (taste-rule-freeze.json, pinned to taste-receipt.mjs by ci:rubric-freeze)', () => {
    const freeze = JSON.parse(readFileSync('design_system/public/taste-rule-freeze.json', 'utf8')) as {
      riseFloor: number
      riseFloorFrom: string
    }
    expect(SITE_DONE_RISE_FLOOR).toBe(freeze.riseFloor)
    expect(SITE_DONE_RISE_FLOOR_FROM).toBe(freeze.riseFloorFrom)
  })

  it('accepts a visibility node with live evidence and no taste score at all', () => {
    expect(
      siteQueueDoneEvidenceProblems(
        'READY dpl_x at 1a2b3c. /communities/tetherow title now "Tetherow homes for sale"; canonical self; in sitemap once. Blocked to 2026-10-21 for GSC position.',
        { versionGap: 'SITE-182' },
      ),
    ).toEqual([])
  })

  it('no longer refuses a recorded demoMatch false or competitiveBriefPass false', () => {
    expect(
      siteQueueDoneEvidenceProblems('grok-4.6 median 60, demoMatch: false, competitiveBriefPass: false. Live page checked.', {
        versionGap: 'SITE-90',
        loadParity: false,
      }),
    ).toEqual([])
  })

  it('refuses empty evidence', () => {
    expect(siteQueueDoneEvidenceProblems('  ', { versionGap: 'SITE-9' }).join('\n')).toMatch(/evidence is required/)
  })

  it('refuses a judge failure with no signed receipt behind it', () => {
    const p = siteQueueDoneEvidenceProblems('taste-evaluate: grok CLI 402. Tip Ready anyway, files on disk.', {
      versionGap: 'SITE-99',
      loadParity: false,
    })
    expect(p.join('\n')).toMatch(/a failed judge is not a score/)
  })

  it('accepts a 402 followed by the claude fallback when the receipt backs it', () => {
    expect(
      siteQueueDoneEvidenceProblems('grok 402, fell back to claude-sonnet-5 via taste-evaluate.ts listing-detail, median 60', {
        versionGap: 'SITE-99',
        // listing-detail publishes a competitiveBrief, so the receipt records that verdict too.
        tasteReview: {
          ...RECEIPT,
          evaluatorModel: 'claude-sonnet-5',
          priorMark: undefined,
          comparedToPrior: 'rebaselined',
          competitiveBriefPass: false,
        },
      }),
    ).toEqual([])
  })

  it('refuses a builder model signing as the judge after a judge failure', () => {
    const p = siteQueueDoneEvidenceProblems('no grok CLI; scored it myself', {
      versionGap: 'SITE-99',
      tasteReview: { ...RECEIPT, evaluatorModel: 'grok-4.5' },
    })
    expect(p.join('\n')).toMatch(/evaluatorModel must be one of the judge chain/)
  })

  it('refuses a receipt whose median fell by the rise floor on the same instrument', () => {
    const p = siteQueueDoneEvidenceProblems('npx tsx scripts/taste-evaluate.ts about — median 58', {
      versionGap: 'SITE-90',
      tasteReview: { ...RECEIPT, score: 58 },
    })
    expect(p.join('\n')).toMatch(/taste floor regressed/)
  })

  it('accepts a fall inside the judge noise as held', () => {
    expect(tasteFloorProblems({ ...RECEIPT, score: 59 })).toEqual([])
  })

  it('does not compare across instruments', () => {
    expect(
      tasteFloorProblems({ ...RECEIPT, score: 40, priorMark: { ...RECEIPT.priorMark, evaluatorModel: 'claude-sonnet-5' } }),
    ).toEqual([])
  })

  it('refuses an honesty drop', () => {
    const p = tasteFloorProblems({
      ...RECEIPT,
      criteria: { honestyFunction: 7 },
      priorMark: { ...RECEIPT.priorMark, criteria: { honestyFunction: 9 } },
    })
    expect(p.join('\n')).toMatch(/honestyFunction 7 fell below the prior mark 9/)
  })

  it('refuses Tip Ready language without --ship exit 0', () => {
    const p = siteQueueDoneEvidenceProblems('median 60, held. Tip Ready.', {
      versionGap: 'SITE-90',
      tasteReview: RECEIPT,
    })
    expect(p.join('\n')).toMatch(/--ship/)
  })

  it('does not bind a non-SITE node', () => {
    expect(siteQueueDoneEvidenceProblems('shipped', { versionGap: 'G12' })).toEqual([])
  })
})
