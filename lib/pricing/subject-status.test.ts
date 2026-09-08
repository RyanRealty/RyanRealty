/**
 * Round four, class D. 1617 NW 8th is an ACTIVE listing held by another
 * brokerage and the closing chapter solicited it. 2465 7th is Withdrawn, not
 * Expired, so the owner may still be under a listing agreement. Neither
 * document carried a carve-out, because nothing on `render_args` said so.
 */
import { describe, expect, it } from 'vitest'
import { buildSubjectStatus } from '@/lib/pricing/subject-status'

describe('buildSubjectStatus', () => {
  it('1617 NW 8th: Active with another brokerage, do not solicit', () => {
    const s = buildSubjectStatus({
      standardStatus: 'Active',
      listAgentName: 'Someone Else',
      listAgentEmail: 'someone@othershop.com',
      listOfficeName: 'Cascade Hasson SIR',
    })
    expect(s.standardStatus).toBe('Active')
    expect(s.isActiveWithOtherBrokerage).toBe(true)
    expect(s.listingAgentIsUs).toBe(false)
    expect(s.isWithdrawnNotExpired).toBe(false)
    expect(s.note).toMatch(/another brokerage/i)
  })

  it('2465 7th: Withdrawn is not Expired, and the note says why that matters', () => {
    const s = buildSubjectStatus({
      standardStatus: 'Withdrawn',
      listAgentName: 'Brian Ladd',
      listOfficeName: 'Cascade Hasson SIR',
    })
    expect(s.isWithdrawnNotExpired).toBe(true)
    expect(s.isActiveWithOtherBrokerage).toBe(false)
    expect(s.note).toMatch(/listing agreement/i)
  })

  it('65365 Concorde: Expired is not withdrawn, and carries no carve-out', () => {
    const s = buildSubjectStatus({
      standardStatus: 'Expired',
      listOfficeName: 'eXp Realty, LLC',
    })
    expect(s.isWithdrawnNotExpired).toBe(false)
    expect(s.isActiveWithOtherBrokerage).toBe(false)
    expect(s.listingAgentIsUs).toBe(false)
    expect(s.note).toBeNull()
  })

  it('Canceled is treated the same as Withdrawn', () => {
    expect(buildSubjectStatus({ standardStatus: 'Canceled' }).isWithdrawnNotExpired).toBe(true)
  })

  it('Pending is live too, so it is not solicitable either', () => {
    expect(
      buildSubjectStatus({ standardStatus: 'Pending', listOfficeName: 'Other Shop' })
        .isActiveWithOtherBrokerage,
    ).toBe(true)
  })

  it('our own live listing is not a third-party solicitation', () => {
    const byOffice = buildSubjectStatus({ standardStatus: 'Active', listOfficeName: 'Ryan Realty' })
    expect(byOffice.listingAgentIsUs).toBe(true)
    expect(byOffice.isActiveWithOtherBrokerage).toBe(false)
    const byEmail = buildSubjectStatus({
      standardStatus: 'Active',
      listAgentEmail: 'matt@ryan-realty.com',
      listOfficeName: 'Some Other Shop',
    })
    expect(byEmail.listingAgentIsUs).toBe(true)
    expect(byEmail.isActiveWithOtherBrokerage).toBe(false)
  })

  it('an unknown status claims nothing', () => {
    const s = buildSubjectStatus({ standardStatus: null })
    expect(s.standardStatus).toBeNull()
    expect(s.isActiveWithOtherBrokerage).toBe(false)
    expect(s.isWithdrawnNotExpired).toBe(false)
    expect(s.listingAgentIsUs).toBe(false)
  })

  it('a stale-cycle suppression rides on the note rather than inventing a field', () => {
    const s = buildSubjectStatus({
      standardStatus: 'Closed',
      suppressedReason: 'The last listing period at this address came off the market on 2004-12-14.',
    })
    expect(s.note).toContain('2004-12-14')
  })

  it('every note is seller-safe prose', () => {
    const notes = [
      buildSubjectStatus({ standardStatus: 'Active', listOfficeName: 'Other' }).note,
      buildSubjectStatus({ standardStatus: 'Withdrawn' }).note,
    ].filter((n): n is string => n != null)
    expect(notes.length).toBe(2)
    for (const note of notes) {
      expect(note).not.toMatch(/[—–;]/)
      expect(note.endsWith('.')).toBe(true)
    }
  })
})
