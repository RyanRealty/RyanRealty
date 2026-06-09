import { describe, it, expect } from 'vitest'
import {
  buildLeadOriginNote,
  leadOriginNoteHasDetail,
  type LeadOriginContext,
} from './fub-lead-origin-note'

describe('buildLeadOriginNote', () => {
  it('renders all expected labelled lines for a full seller context', () => {
    const ctx: LeadOriginContext = {
      source: 'seller-lp',
      sourceLabel: 'Seller home value LP',
      landingPage: '/lp/seller-home-value',
      utmSource: 'facebook',
      utmMedium: 'paid',
      utmCampaign: 'bend-seller-q2',
      utmContent: 'carousel-a',
      audience: 'seller',
      tier: 'hot',
      tierReason: 'selling within 3 months',
      want: '1234 Wilson Ave, Bend. Timeline: 0 to 3 months',
      assignedAgent: 'Matt Ryan',
      assignmentReason: 'default routing',
      extra: 'Estimated value range requested',
    }

    const note = buildLeadOriginNote(ctx)
    const lines = note.split('\n')

    expect(lines[0]).toBe('LEAD ORIGIN')
    // sourceLabel wins over source
    expect(note).toContain('Source: Seller home value LP')
    expect(note).not.toContain('Source: seller-lp')
    expect(note).toContain('Page: /lp/seller-home-value')
    expect(note).toContain('Campaign: bend-seller-q2 (facebook/paid, ad=carousel-a)')
    expect(note).toContain('Wants: 1234 Wilson Ave, Bend. Timeline: 0 to 3 months')
    expect(note).toContain('Tier: hot (selling within 3 months)')
    expect(note).toContain('Assigned: Matt Ryan (default routing)')
    expect(note).toContain('Estimated value range requested')
  })

  it('renders just the header + Source line for a sparse context', () => {
    const note = buildLeadOriginNote({ source: 'contact-form' })
    const lines = note.split('\n')

    expect(lines).toEqual(['LEAD ORIGIN', 'Source: contact-form'])
    expect(note).not.toContain('Page:')
    expect(note).not.toContain('Campaign:')
    expect(note).not.toContain('Wants:')
    expect(note).not.toContain('Tier:')
    expect(note).not.toContain('Assigned:')
  })

  it('never outputs an em-dash, en-dash, or semicolon', () => {
    const ctx: LeadOriginContext = {
      source: 'buyer-lp',
      sourceLabel: 'Buyer listing alerts LP',
      landingPage: '/lp/buyer-listing-alerts',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'bend-buyers',
      utmContent: 'search-ad-1',
      audience: 'buyer',
      tier: 'warm',
      tierReason: 'browsing, no timeline yet',
      want: 'Bend, 3 plus beds, under 700,000',
      assignedAgent: 'Rebecca Peterson',
      assignmentReason: 'agent attribution cookie',
      extra: 'Wants new-listing alerts',
    }

    const note = buildLeadOriginNote(ctx)
    expect(note).not.toContain('—') // em-dash
    expect(note).not.toContain('–') // en-dash
    expect(note).not.toContain(';')

    // sparse context also clean
    expect(buildLeadOriginNote({ source: 'x' })).not.toMatch(/[—–;]/)
    // header-only context clean
    expect(buildLeadOriginNote({})).not.toMatch(/[—–;]/)
  })

  it('only renders the Campaign line when a utm field is present', () => {
    // no utm at all -> no Campaign line
    const noUtm = buildLeadOriginNote({
      source: 'saved-search',
      landingPage: '/search',
    })
    expect(noUtm).not.toContain('Campaign:')

    // any single utm field present -> Campaign line appears
    expect(buildLeadOriginNote({ utmSource: 'facebook' })).toContain('Campaign:')
    expect(buildLeadOriginNote({ utmMedium: 'paid' })).toContain('Campaign:')
    expect(buildLeadOriginNote({ utmCampaign: 'spring' })).toContain('Campaign:')
    expect(buildLeadOriginNote({ utmContent: 'ad-7' })).toContain('Campaign:')

    // utm source/medium only (no campaign name) renders the parenthetical
    expect(buildLeadOriginNote({ utmSource: 'facebook', utmMedium: 'paid' })).toContain(
      'Campaign: (facebook/paid)',
    )
  })

  it('omits the tier reason and assignment reason when only the value is present', () => {
    const note = buildLeadOriginNote({
      tier: 'hot',
      assignedAgent: 'Matt Ryan',
    })
    expect(note).toContain('Tier: hot')
    expect(note).not.toContain('Tier: hot (')
    expect(note).toContain('Assigned: Matt Ryan')
    expect(note).not.toContain('Assigned: Matt Ryan (')
  })

  it('treats whitespace-only fields as absent', () => {
    const note = buildLeadOriginNote({ source: '   ', landingPage: '\t', want: ' ' })
    expect(note).toBe('LEAD ORIGIN')
  })
})

describe('leadOriginNoteHasDetail', () => {
  it('is false for a header-only note', () => {
    expect(leadOriginNoteHasDetail(buildLeadOriginNote({}))).toBe(false)
  })

  it('is true once any detail line is present', () => {
    expect(leadOriginNoteHasDetail(buildLeadOriginNote({ source: 'contact' }))).toBe(true)
  })
})
