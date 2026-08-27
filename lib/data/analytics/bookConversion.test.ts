import { describe, expect, it } from 'vitest'
import { parseStageChange } from './bookConversion'

describe('parseStageChange — the transition lives in the title', () => {
  // The writers (app/actions/crm.ts, the sequence engine, the bulk set-stage
  // handler) record "Stage: Lead → Nurture" and leave payload {}. Reading only
  // the payload produced "? -> ?" for all 13 recorded moves, which is a funnel
  // report that cannot name a single transition.
  it('reads the real recorded shape', () => {
    expect(parseStageChange('Stage: Lead → Nurture', {})).toEqual({ from: 'Lead', to: 'Nurture' })
  })

  it('accepts an ascii arrow too', () => {
    expect(parseStageChange('Stage: Nurture -> Engaged', {})).toEqual({ from: 'Nurture', to: 'Engaged' })
  })

  it('handles multi-word stage names', () => {
    expect(parseStageChange('Stage: Nurture → Active Client', null)).toEqual({
      from: 'Nurture',
      to: 'Active Client',
    })
  })

  it('prefers a structured payload when the writers start sending one', () => {
    expect(parseStageChange('Stage: Lead → Nurture', { from: 'A', to: 'B' })).toEqual({ from: 'A', to: 'B' })
  })

  it('returns nulls rather than guessing on an unparseable title', () => {
    expect(parseStageChange('something else', {})).toEqual({ from: null, to: null })
    expect(parseStageChange(null, null)).toEqual({ from: null, to: null })
    expect(parseStageChange('', {})).toEqual({ from: null, to: null })
  })

  it('is case insensitive on the prefix', () => {
    expect(parseStageChange('stage: Lead → Nurture', {})).toEqual({ from: 'Lead', to: 'Nurture' })
  })
})

describe('parseStageChange — the sequence engine phrases it differently', () => {
  it('reads a workflow move, which has a destination but no origin', () => {
    // "Stage updated by workflow "Seller nurture": Nurture" — no arrow. Dropping
    // these would silently under-count every automated stage move.
    expect(parseStageChange('Stage updated by workflow "Seller nurture": Nurture', {})).toEqual({
      from: null,
      to: 'Nurture',
    })
  })

  it('reads the bulk handler suffix', () => {
    expect(parseStageChange('Stage: (none) → Nurture (bulk)', {})).toEqual({
      from: '(none)',
      to: 'Nurture',
    })
  })
})
