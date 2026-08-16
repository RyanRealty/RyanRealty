import { describe, expect, it } from 'vitest'
import {
  hostPath,
  nodeKind,
  plainBlockedReason,
  plainBot,
  plainDomain,
  plainEvidence,
  plainFindingSeverity,
  plainFindingStatus,
  plainNodeTitle,
  plainShipClass,
  upcomingHint,
} from './status-copy'

describe('loop status copy (Matt-facing, no shop jargon)', () => {
  it('strips fleet prefixes and keeps the problem', () => {
    expect(
      plainNodeTitle(
        'Fleet finding [p0]: Neighborhoods index tile for Awbrey Butte shows 52 Active. The Awbrey',
      ),
    ).toBe('Neighborhoods index tile for Awbrey Butte shows 52 Active. The Awbrey')
    expect(plainNodeTitle('Matt ADD [major]: xAI-only image, video, voice, and content gen')).toBe(
      'You asked: xAI-only image, video, voice, and content gen',
    )
    expect(plainNodeTitle('CMA/pricing production residual')).toBe('CMA/pricing production residual')
  })

  it('does not leave Fleet finding or p0 in the title Matt reads', () => {
    const title = plainNodeTitle('Fleet finding [major]: Hero has two side-by-side primary CTAs')
    expect(title).not.toMatch(/Fleet finding/i)
    expect(title).not.toMatch(/\[p0\]/i)
    expect(title).not.toMatch(/\[major\]/i)
  })

  it('labels urgency in English', () => {
    expect(nodeKind('Fleet finding [p0]: counts disagree').kind).toBe('Urgent')
    expect(nodeKind('Fleet finding [major]: chips are 0x0').kind).toBe('Fix')
    expect(nodeKind('Fleet finding [minor]: two CTAs').kind).toBe('Polish')
    expect(nodeKind('Matt ADD [major]: xAI-only gen').kind).toBe('You asked')
    expect(nodeKind('CMA/pricing production residual').kind).toBe('Plan')
  })

  it('names domains and bots the way a person would', () => {
    expect(plainDomain('public-ux')).toBe('the website')
    expect(plainDomain('sales-insights')).toBe('pricing and market numbers')
    expect(plainBot('stats-truth')).toBe('Number check')
    expect(plainBot('walker-mobile')).toBe('Phone walk')
    expect(plainBot('flow-prover')).toBe('Form submit test')
  })

  it('translates finding status and severity', () => {
    expect(plainFindingStatus('node_created')).toBe('In the fix list')
    expect(plainFindingStatus('confirmed')).toBe('Noted, not a fix')
    expect(plainFindingStatus('rejected')).toBe('False alarm')
    expect(plainFindingSeverity('p0').kind).toBe('Urgent')
    expect(plainFindingSeverity('info').kind).toBe('Note')
  })

  it('translates known blockers without the gate names', () => {
    expect(plainBlockedReason('G6 accept stays blocked (live marketing-line APPROVE)')).toBe(
      'Waiting on you: approve a real reply on the marketing text line',
    )
    expect(plainBlockedReason('holdMet=false until 2026-08-22 calendar accept')).toBe(
      'Waiting until August 22: seven-day audience check has to finish',
    )
  })

  it('turns deploy evidence into a live-site sentence', () => {
    expect(
      plainEvidence(
        'READY AxpVMY6cXodZpfNkjSQ5M7NsJ2tY (606s) main@9cac09b1f. Class: one DAL neighborhood-public-inventory. Probe ok.',
      ),
    ).toBe('Live on the site. one DAL neighborhood-public-inventory.')
    expect(plainEvidence(null)).toBe('Finished')
  })

  it('summarizes the upcoming pile', () => {
    expect(upcomingHint({ urgent: 17, fix: 20, polish: 19, plan: 16 })).toBe(
      '17 urgent · 20 website fixes · 19 polish · 16 on the company list',
    )
    expect(upcomingHint({ urgent: 0, fix: 0, polish: 0, plan: 0 })).toBe('Nothing waiting')
  })

  it('names a ship class the way a person would', () => {
    expect(plainShipClass('fleet:public-ux:place-pages')).toBe('place pages')
    expect(plainShipClass('gap:G32')).toBe('G32')
    expect(plainShipClass('solo:factory:abc')).toBe('this item')
  })

  it('shows a page path instead of a full URL', () => {
    expect(hostPath('https://ryan-realty.com/cities/bend/awbrey-butte')).toBe(
      '/cities/bend/awbrey-butte',
    )
  })
})
