import { describe, expect, it } from 'vitest'
import { parseDialSalesHistory } from '@/lib/expired-owner-lookup'
import {
  composeParcelRecord,
  parseDialPermitsHtml,
  renderParcelRecordHtml,
  renderParcelRecordScene,
} from '@/lib/cma/parcel-record'

const DIAL_SALES = `
<html><body>
<table class="table">
  <tr><th>Sale Date</th><th>Seller</th><th>Buyer</th><th>Sale Amount</th><th>Instrument</th></tr>
  <tr><td>07/29/2021</td><td>SMITH, ANN</td><td>JONES, PAT</td><td>$445,000</td><td>2021-123</td></tr>
  <tr><td>08/18/2016</td><td>LEE, KIM</td><td>SMITH, ANN</td><td>$229,900</td><td>2016-88</td></tr>
</table>
</body></html>`

const DIAL_PERMITS = `
<html><body>
<p>247-B12345 building</p>
<p>247-E99001 electrical</p>
<p>247-P22002 plumbing</p>
</body></html>`

describe('parcel record', () => {
  it('keeps the full deed chain and municipal permits', () => {
    const record = composeParcelRecord({
      taxAccount: '129007',
      currentOwner: 'JONES, PAT',
      sales: parseDialSalesHistory(DIAL_SALES),
      permits: parseDialPermitsHtml(DIAL_PERMITS),
    })
    expect(record).not.toBeNull()
    expect(record!.sales).toHaveLength(2)
    expect(record!.sales[0]!.date).toBe('2016-08-18')
    expect(record!.ownedSince).toBe('2021-07-29')
    expect(record!.acquiredAt).toBe(445000)
    expect(record!.permits.map((p) => p.type)).toEqual(['Building', 'Electrical', 'Plumbing'])
    expect(record!.agentNotes.some((n) => /JONES, PAT/.test(n))).toBe(true)
    expect(record!.agentNotes.some((n) => /3 permits/.test(n))).toBe(true)
  })

  it('renders seller language without marketing or confidence pills', () => {
    const record = composeParcelRecord({
      taxAccount: '129007',
      currentOwner: 'JONES, PAT',
      sales: parseDialSalesHistory(DIAL_SALES),
      permits: parseDialPermitsHtml(DIAL_PERMITS),
    })
    const html = renderParcelRecordHtml(record)
    expect(html).toContain('Who has owned this house')
    expect(html).toContain('SMITH, ANN')
    expect(html).toContain('JONES, PAT')
    expect(html).toContain('$445,000')
    expect(html).toContain('247-B12345')
    expect(html).not.toMatch(/how we would market|Confidence:|not the ZIP/i)
    expect(renderParcelRecordScene(record)).toContain('id="ownership"')
  })

  it('does not print UNKNOWN on a blank DIAL party', () => {
    const record = composeParcelRecord({
      taxAccount: '129007',
      currentOwner: 'JONES, PAT',
      sales: [
        { date: '1990-01-25', seller: '', buyer: 'UNKNOWN', amount: 55700, instrument: '1990-1' },
        { date: '2021-07-29', seller: 'SMITH, ANN', buyer: 'JONES, PAT', amount: 445000, instrument: '2021-123' },
      ],
      permits: [],
    })
    const html = renderParcelRecordHtml(record)
    expect(html).toContain('Not recorded')
    expect(html).not.toContain('UNKNOWN')
  })

  it('refuses an empty record', () => {
    expect(
      composeParcelRecord({ taxAccount: '129007', currentOwner: null, sales: [], permits: [] }),
    ).toBeNull()
  })
})
