import { describe, expect, it } from 'vitest'
import {
  competitiveBriefProblems,
  competitiveBriefShapeProblems,
  competitiveBriefVerdict,
  parseCompetitiveBrief,
  siteQueueDoneEvidenceProblems,
  tasteDoneProblems,
} from '../lib/taste-receipt.mjs'

const ABOUT_BRIEF = {
  id: 'about-researchy-1-8',
  source: 'Researchy About beats 1–8',
  productLock: 'firm story + reviews + closings + Call|Text|Email|Schedule + team teaser→/team + inquiry→/contact',
  refuse: 'AboutFaces three broker Cards as the opener.',
  beats: [
    { id: '1', text: 'Firm story opens the page: since 2014, Bend office, who you call works your deal.' },
    { id: '2', text: 'Firm reviews: brokerage Google record as words (V3Proof), with a door to /reviews.' },
    { id: '3', text: 'Firm closings: recent Ryan Realty sales as house-row cards with recorded prices.' },
    { id: '4', text: 'Call is the primary conversion on the reach control, carrying live hours.' },
    { id: '5', text: 'Text sits on the same reach control as Call, not a seven-row phone book.' },
    { id: '6', text: 'Email sits on the same reach control as Call, Text, and Schedule.' },
    { id: '7', text: 'Schedule sits on the same reach control as Call, Text, and Email.' },
    { id: '8', text: 'Team teaser doors to /team (and /team/[slug]); inquiry doors to /contact.' },
  ],
}

function receipt(over = {}) {
  return {
    evaluatedAt: '2026-09-12',
    rubricVersion: 'v1-2026-09-12',
    comparedToPrior: 'rose',
    score: 72,
    demoMatch: true,
    ...over,
  }
}

describe('parseCompetitiveBrief', () => {
  it('loads Researchy beats 1–8', () => {
    const brief = parseCompetitiveBrief(ABOUT_BRIEF)
    expect(brief?.beats).toHaveLength(8)
    expect(brief?.beats.map((b) => b.id)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
  })

  it('refuses prose-only competitiveTarget as a brief', () => {
    expect(parseCompetitiveBrief('Beat Compass by opening on faces')).toBeNull()
    expect(competitiveBriefShapeProblems(null).join('\n')).toMatch(/structured checklist/)
  })
})

describe('competitiveBriefProblems — omit / false refuse', () => {
  it('refuses omitted competitiveBriefPass on a briefed route', () => {
    const p = competitiveBriefProblems(receipt(), ABOUT_BRIEF)
    expect(p.join('\n')).toMatch(/competitiveBriefPass must be true or false/)
    expect(p.join('\n')).toMatch(/not done/)
  })

  it('refuses a rise with competitiveBriefPass false', () => {
    const p = competitiveBriefProblems(receipt({ competitiveBriefPass: false }), ABOUT_BRIEF)
    expect(p.join('\n')).toMatch(/competitiveBriefPass is false/)
    expect(p.join('\n')).toMatch(/Researchy checklist/)
  })

  it('refuses a finish-line score without a true pass', () => {
    const p = competitiveBriefProblems(
      receipt({ comparedToPrior: 'rebaselined', score: 71, competitiveBriefPass: false }),
      ABOUT_BRIEF,
    )
    expect(p.join('\n')).toMatch(/finish line is not done/)
  })

  it('passes a rise when competitiveBriefPass is true', () => {
    expect(competitiveBriefProblems(receipt({ competitiveBriefPass: true }), ABOUT_BRIEF)).toEqual([])
  })

  it('passes when the checklist is all true even if the boolean is omitted', () => {
    const checklist = Object.fromEntries(ABOUT_BRIEF.beats.map((b) => [b.id, true]))
    expect(competitiveBriefVerdict(receipt({ competitiveBriefChecklist: checklist }), ABOUT_BRIEF)).toBe(true)
    expect(competitiveBriefProblems(receipt({ competitiveBriefChecklist: checklist }), ABOUT_BRIEF)).toEqual([])
  })

  it('refuses a partial checklist (not all true)', () => {
    const checklist = Object.fromEntries(ABOUT_BRIEF.beats.map((b) => [b.id, true]))
    checklist['1'] = false
    const p = competitiveBriefProblems(receipt({ competitiveBriefChecklist: checklist }), ABOUT_BRIEF)
    expect(p.join('\n')).toMatch(/not done/)
  })

  it('lets an in-progress rebaseline record false below 70', () => {
    expect(
      competitiveBriefProblems(
        receipt({ comparedToPrior: 'rebaselined', score: 52, competitiveBriefPass: false }),
        ABOUT_BRIEF,
      ),
    ).toEqual([])
  })

  it('ignores routes with no competitiveBrief', () => {
    expect(competitiveBriefProblems(receipt(), null)).toEqual([])
  })
})

describe('tasteDoneProblems — Tip Ready refuse', () => {
  it('refuses omitted competitiveBriefPass when a brief exists', () => {
    expect(tasteDoneProblems({ demoMatch: true }, { competitiveBrief: ABOUT_BRIEF }).join('\n')).toMatch(
      /competitiveBriefPass must be true or false/,
    )
  })

  it('refuses competitiveBriefPass false', () => {
    expect(
      tasteDoneProblems({ demoMatch: true, competitiveBriefPass: false }, { competitiveBrief: ABOUT_BRIEF }).join(
        '\n',
      ),
    ).toMatch(/competitiveBriefPass is false/)
  })

  it('passes only when both demoMatch and competitiveBriefPass are true', () => {
    expect(
      tasteDoneProblems({ demoMatch: true, competitiveBriefPass: true }, { competitiveBrief: ABOUT_BRIEF }),
    ).toEqual([])
  })
})

describe('siteQueueDoneEvidenceProblems — About / SITE-90 brief', () => {
  it('refuses SITE-90 evidence without competitiveBriefPass true', () => {
    const p = siteQueueDoneEvidenceProblems('npx tsx scripts/taste-evaluate.ts about — grok-4.6 demoMatch: true, median 71', {
      versionGap: 'SITE-90',
    })
    expect(p.join('\n')).toMatch(/competitiveBriefPass: true/)
    expect(p.join('\n')).toMatch(/Tip Ready/)
  })

  it('refuses a recorded false brief verdict', () => {
    const p = siteQueueDoneEvidenceProblems(
      'grok-4.6 median 72, demoMatch: true, competitiveBriefPass: false',
      { versionGap: 'SITE-90' },
    )
    expect(p.join('\n')).toMatch(/competitiveBriefPass false/)
  })

  it('passes honest demoMatch true and competitiveBriefPass true', () => {
    expect(
      siteQueueDoneEvidenceProblems(
        'npx tsx scripts/taste-evaluate.ts about — grok-4.6 demoMatch: true, competitiveBriefPass: true, median 71',
        { versionGap: 'SITE-90' },
      ),
    ).toEqual([])
  })
})
