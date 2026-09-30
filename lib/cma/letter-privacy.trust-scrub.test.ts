/**
 * Trust-name tokens from MLS text must not reach the letter.
 * Names here are made up.
 */
import { describe, expect, it } from 'vitest'
import {
  letterOwnerNameCheck,
  scrubMlsOwnerTokens,
  scrubMlsTextRow,
  scrubOwnerTokensInHtml,
} from '@/lib/cma/letter-privacy'

const NAMES = { clientName: 'Jan North & Dana North Rev Liv Trust' }

describe('MLS owner and trust tokens are scrubbed before print', () => {
  it('removes the trust name from remarks and spells a colliding month out', () => {
    const remarks = 'Owner Jan North will consider a lease. Contact Dana North Rev Liv Trust.'
    const history = 'Listed Jan 7, 2026 at $2,195,000, came off expired.'
    expect(scrubMlsOwnerTokens(remarks, NAMES)).not.toMatch(/\b(Jan|North|Dana|Rev|Liv|Trust)\b/)
    const line = scrubMlsOwnerTokens(history, NAMES)
    expect(line).toContain('January 7, 2026')
    expect(line).not.toMatch(/\bJan\b/)
    const row = scrubMlsTextRow(
      { publicRemarks: remarks, listingHistoryLine: history, viewDescription: 'Trust the view from the green.' },
      NAMES,
    )
    expect(row.viewDescription).not.toMatch(/\bTrust\b/)
    expect(row.listingHistoryLine).toContain('January')
  })

  it('the name check still fails if a token is left in the letter', () => {
    const dirty = '<p>Prepared for the owners of 10 Moss. Jan liked the price.</p>'
    expect(letterOwnerNameCheck(dirty, NAMES).pass).toBe(false)
    const html = scrubOwnerTokensInHtml(dirty, NAMES)
    expect(letterOwnerNameCheck(html, NAMES).pass).toBe(true)
    expect(html).not.toMatch(/\bJan\b/)
  })

  it('a history line that only said Jan does not fail the check after scrub', () => {
    const html = '<td>Listed Jan 7, 2026 at $1,799,999, came off expired.</td>'
    expect(letterOwnerNameCheck(html, NAMES).pass).toBe(false)
    const clean = scrubOwnerTokensInHtml(html, NAMES)
    expect(clean).toContain('January 7, 2026')
    expect(letterOwnerNameCheck(clean, NAMES).pass).toBe(true)
  })
})
