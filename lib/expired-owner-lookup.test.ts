/**
 * Ownership-tenure extraction from the Deschutes DIAL deed/sales history —
 * the "how long they owned it" source for the expired story.
 *
 * The fixture mirrors the LIVE page structure verified 2026-07-21 against
 * https://dial.deschutes.org/Real/Sales/129007 (table: Sale Date · Seller ·
 * Buyer · Sale Amount · Recording Instrument, dates MM/DD/YYYY, `&amp;`
 * entities, re-title rows with an empty amount). Locks the §0 rules: the date
 * is used only when the deed chain provably leads to today's owner, and an
 * ambiguous chain returns null (omit, never guess).
 */
import { describe, expect, it } from 'vitest'
import {
  deriveOwnershipFromSales,
  ownershipCustomFields,
  parseDialSalesHistory,
  type DialSaleRow,
} from './expired-owner-lookup'

// Modeled on the live DIAL markup: header row uses <th>, data rows <td>.
const DIAL_FIXTURE = `
<html><body>
<table class="table">
  <tr><th>Sale Date 129007</th><th>Seller</th><th>Buyer</th><th>Sale Amount</th><th>Recording Instrument 129007</th></tr>
  <tr><td>06/10/2009</td><td>COLVIN,GREGORY P &amp; LORRAINE MARIE</td><td>COLVIN, GREGORY P &amp; LORI M</td><td></td><td>2009-25222</td></tr>
  <tr><td>04/29/2004</td><td>MCCORMICK,LESTER M</td><td>COLVIN,GREGORY P &amp; LORRAINE MARIE</td><td>$251,000</td><td>2004-24902</td></tr>
  <tr><td>07/26/1991</td><td>EDWARDS CARLA MARIE PERS REP</td><td>MCCORMICK LESTER M</td><td>$115,000</td><td>1991-2411904</td></tr>
</table>
</body></html>`

describe('parseDialSalesHistory', () => {
  it('parses the deed table into structured rows, newest first', () => {
    const rows = parseDialSalesHistory(DIAL_FIXTURE)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({
      date: '2009-06-10',
      seller: 'COLVIN,GREGORY P & LORRAINE MARIE',
      buyer: 'COLVIN, GREGORY P & LORI M',
      amount: null,
      instrument: '2009-25222',
    })
    expect(rows[1].date).toBe('2004-04-29')
    expect(rows[1].amount).toBe(251000)
    expect(rows[2].date).toBe('1991-07-26')
  })

  it('skips the header row and returns [] on markup without a table', () => {
    expect(parseDialSalesHistory('<html><body><p>No sales found</p></body></html>')).toEqual([])
    const rows = parseDialSalesHistory(DIAL_FIXTURE)
    expect(rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))).toBe(true)
  })

  it('sorts newest first even when the page order is oldest first', () => {
    const reversed = DIAL_FIXTURE.replace(
      /<tr><td>06\/10\/2009[\s\S]*?<\/tr>\s*(<tr><td>04\/29\/2004[\s\S]*?<\/tr>)/,
      '$1',
    )
    // Regardless of markup order, the first parsed row is the newest date.
    const rows = parseDialSalesHistory(reversed)
    expect(rows[0].date >= rows[rows.length - 1].date).toBe(true)
  })
})

describe('deriveOwnershipFromSales', () => {
  const rows = parseDialSalesHistory(DIAL_FIXTURE)

  it('walks past a same-surname re-title to the arms-length acquisition', () => {
    // 2009 row is COLVIN → COLVIN (spouse name change) — ownership really
    // began at the 2004 purchase from MCCORMICK.
    const res = deriveOwnershipFromSales(rows, 'COLVIN, GREGORY P & LORI M')
    expect(res).toEqual({ since: '2004-04-29', salePrice: 251000 })
  })

  it('stops at the newest row when it is already arms-length', () => {
    const armsLength: DialSaleRow[] = [
      { date: '2021-03-01', seller: 'JONES, A', buyer: 'SMITH, B', amount: 700000, instrument: null },
      { date: '2010-01-01', seller: 'DOE, C', buyer: 'JONES, A', amount: 300000, instrument: null },
    ]
    expect(deriveOwnershipFromSales(armsLength, 'SMITH, B')).toEqual({
      since: '2021-03-01',
      salePrice: 700000,
    })
  })

  it('returns null when the chain does not lead to the current county owner', () => {
    // County says NGUYEN owns it; the deed rows end at COLVIN → ambiguous → omit.
    expect(deriveOwnershipFromSales(rows, 'NGUYEN, T')).toBeNull()
  })

  it('treats a transfer into a same-surname family trust as a re-title', () => {
    const trust: DialSaleRow[] = [
      { date: '2020-05-05', seller: 'SMITH, JOHN', buyer: 'SMITH FAMILY TRUST', amount: null, instrument: null },
      { date: '2005-08-15', seller: 'BROWN, K', buyer: 'SMITH, JOHN', amount: 400000, instrument: null },
    ]
    expect(deriveOwnershipFromSales(trust, 'SMITH FAMILY TRUST')).toEqual({
      since: '2005-08-15',
      salePrice: 400000,
    })
  })

  it('falls back to the oldest row when every row is a same-surname re-title', () => {
    const all: DialSaleRow[] = [
      { date: '2018-01-01', seller: 'LEE, A', buyer: 'LEE, B', amount: null, instrument: null },
      { date: '2012-01-01', seller: 'LEE, C', buyer: 'LEE, A', amount: null, instrument: null },
    ]
    expect(deriveOwnershipFromSales(all, 'LEE, B')).toEqual({ since: '2012-01-01', salePrice: null })
  })

  it('returns null on an empty history', () => {
    expect(deriveOwnershipFromSales([], 'COLVIN')).toBeNull()
  })
})

describe('ownershipCustomFields', () => {
  it('maps a resolved date to the namespaced crm_people.custom keys', () => {
    expect(
      ownershipCustomFields({ ownershipSince: '2004-04-29', ownershipSource: 'deschutes-dial-deed-history' }),
    ).toEqual({
      customOwnershipSince: '2004-04-29',
      customOwnershipSource: 'deschutes-dial-deed-history',
    })
  })

  it('returns {} when no source proved a date — nothing is persisted', () => {
    expect(ownershipCustomFields({ ownershipSince: null, ownershipSource: null })).toEqual({})
    expect(ownershipCustomFields({})).toEqual({})
  })
})
