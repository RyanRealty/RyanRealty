import { describe, expect, it } from 'vitest'
import type { MlsRemovalNotice } from '@/lib/data/sync/closingsReconcile'
import { TEXT_BUDGET, heldSalesText, noticeText, removalFailedText, saleLine } from './mlsRemovedText'

/**
 * The owner's texts about MLS-removed sales (Matt 2026-09-30). A health text is
 * cut at 600 characters after its `[crm-health:<key>] ` marker, so the count and
 * the pointer to the saved records come first and the list fits what is left.
 */
function notice(over: Partial<MlsRemovalNotice> = {}): MlsRemovalNotice {
  return {
    logId: 3637,
    kind: 'removed',
    listingKey: 'GONE',
    listNumber: '220217062',
    streetNumber: '15714',
    streetName: 'Tumble Weed Turn',
    city: 'Sisters',
    closeDate: '2026-03-10',
    closePrice: 960000,
    ...over,
  }
}

const MARKER = '[crm-health:mls-restored-1234567] '

describe('saleLine', () => {
  it('names the sale by address, town, MLS number, close date and the exact price', () => {
    expect(saleLine(notice())).toBe('15714 Tumble Weed Turn, Sisters, MLS 220217062, closed Mar 10, 2026, $960,000')
  })

  it('never prints a placeholder house number, and leaves out what it does not have', () => {
    expect(saleLine(notice({ streetNumber: '0', streetName: 'Moonshadow Court', closePrice: null, closeDate: null }))).toBe(
      'Moonshadow Court, Sisters, MLS 220217062',
    )
    expect(saleLine(notice({ streetNumber: null, streetName: null, city: null, listNumber: null }))).toBe(
      'listing GONE, closed Mar 10, 2026, $960,000',
    )
  })
})

describe('noticeText', () => {
  it('one sale reads in the singular, with its repair log id', () => {
    expect(noticeText('removed', [notice()]).split('\n')).toEqual([
      'The MLS no longer has 1 closed sale, so it was removed from our site, reports and CMAs. Full records saved (repair log id 3637).',
      '15714 Tumble Weed Turn, Sisters, MLS 220217062, closed Mar 10, 2026, $960,000',
    ])
  })

  it('a restore says the sale is back from its saved record', () => {
    expect(noticeText('restored', [notice({ kind: 'restored', logId: 3640 })])).toMatch(
      /^The MLS has 1 closed sale again that was removed as gone, so it is back on our site from the saved record \(repair log id 3640\)\./,
    )
  })

  it('lists what fits inside 600 characters with its marker, counts the rest, and never cuts the log pointer', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      notice({ logId: 4000 + i, listingKey: `G${i}`, streetName: `Long Meadow Ridge Loop Number ${i}` }),
    )
    const text = noticeText('removed', many)
    expect((MARKER + text).length).toBeLessThanOrEqual(600)
    expect(text.length).toBeLessThanOrEqual(TEXT_BUDGET)
    const lines = text.split('\n')
    expect(lines[0]).toContain('The MLS no longer has 12 closed sales')
    expect(lines[0]).toContain('repair log ids 4000, 4001, 4002 and 9 more')
    const shown = lines.length - 2
    expect(shown).toBeGreaterThan(0)
    expect(lines[lines.length - 1]).toBe(`and ${12 - shown} more`)
  })

  it('names up to three ids and counts the rest, never as a range: other repair rows sit between them', () => {
    const three = [notice(), notice({ logId: 3639 }), notice({ logId: 3642 })]
    expect(noticeText('removed', three)).toContain('(repair log ids 3637, 3639, 3642)')
    expect(noticeText('removed', [...three, notice({ logId: 3701 })])).toContain('(repair log ids 3637, 3639, 3642 and 1 more)')
  })
})

describe('heldSalesText', () => {
  it('over the budget: how many are due, how many the day still allows, and that none were removed', () => {
    expect(heldSalesText({ reason: 'budget', due: 14, held: 14, budget: 7 })).toBe(
      '14 closed sales the MLS no longer has are due to be removed, more than the 7 it may still remove today, so the daily check removed none and is holding them. They stay out of the market report, and while they are still missing, nothing more is removed until someone checks and approves.',
    )
    expect(heldSalesText({ reason: 'budget', due: 1, held: 1, budget: 0 })).toBe(
      '1 closed sale the MLS no longer has is due to be removed, more than none it may still remove today, so the daily check removed none and is holding it. It stays out of the market report, and while it is still missing, nothing more is removed until someone checks and approves.',
    )
  })

  it('an earlier hold: how many wait for a person', () => {
    expect(heldSalesText({ reason: 'hold', due: 1, held: 15, budget: 10 })).toBe(
      '15 closed sales the MLS no longer has are held until someone checks and approves the removal, so the daily check removed none today. They stay out of the market report meanwhile.',
    )
  })
})

describe('removalFailedText', () => {
  it('never claims nothing was removed, says the rest stay out and the check tries again, with the error cut short', () => {
    const text = removalFailedText('x'.repeat(400))
    expect(text).toContain('Any it did remove are texted separately')
    expect(text).toContain('tries again tomorrow')
    expect(text.length).toBeLessThan(400)
  })
})
