import { describe, expect, it } from 'vitest'
import { countedAddressesMissingFromDocument } from '@/lib/cma/counted-rows'
import { countedRowsInDocumentCheck } from '@/lib/cma/letter-consistency'
import { unsoldPeersFor } from '@/lib/cma/matrix-sets'
import { buildExpiredPeerSet } from '@/lib/cma/market-status'
import type { CompArea } from '@/lib/pricing/comp-area'

const SALES = ['3847 Tellus', '3759 Tellus', '3831 Tellus', '3903 Oakside', '62899 Daniel']

describe('a counted sale missing from the table fails', () => {
  it('fails when 62899 Daniel is counted and the table only has the Petrosa sales', () => {
    const html = SALES.filter((a) => a !== '62899 Daniel')
      .map((a) => `<th>${a}</th>`)
      .join('')
    const missing = countedAddressesMissingFromDocument(SALES, html)
    expect(missing).toEqual(['62899 Daniel'])
    const check = countedRowsInDocumentCheck({ html, sales: SALES })
    expect(check.pass).toBe(false)
    expect(check.detail).toContain('62899 Daniel')
  })

  it('passes when every counted sale is in the table', () => {
    const html = SALES.map((a) => `<th>${a}</th>`).join('')
    expect(countedAddressesMissingFromDocument(SALES, html)).toEqual([])
    expect(countedRowsInDocumentCheck({ html, sales: SALES }).pass).toBe(true)
  })

  it('does not treat a sentence that names Daniel as the sales table', () => {
    const html = `<p>Four of the five sales are in Petrosa. One more was added: 62899 Daniel in Mirada.</p>
      <table><tr><th>3847 Tellus</th><th>3759 Tellus</th><th>3831 Tellus</th><th>3903 Oakside</th></tr></table>`
    const missing = countedAddressesMissingFromDocument(SALES, html)
    expect(missing).toEqual(['62899 Daniel'])
  })

  it('fails when an expired listing the sentence counted is missing from the table', () => {
    const html = '<table><tr><td>100 Portland</td><td>101 Portland</td></tr></table>'
    const check = countedRowsInDocumentCheck({
      html,
      expired: ['100 Portland', '101 Portland', '102 Portland'],
    })
    expect(check.pass).toBe(false)
    expect(check.detail).toContain('102 Portland')
  })
})

describe('expired rows match the count', () => {
  const area: CompArea = {
    kind: 'neighborhood',
    names: ['River West'],
    radiusMiles: null,
    centre: { lat: 44.0645, lng: -121.3237 },
    source: 'test',
    sentence: 'River West, the neighborhood around your home.',
  }
  const subject = {
    beds: 3,
    sqft: 1200,
    latitude: 44.0645,
    longitude: -121.3237,
    listingKey: 'SUBJ',
    mlsNumber: '1',
    streetAddress: '1617 NW 8th',
  }

  function rows(beds: number, sqft: number) {
    return Array.from({ length: 7 }, (_, i) => ({
      ListingKey: `K${i}`,
      StreetNumber: String(100 + i),
      StreetName: 'Portland',
      StandardStatus: 'Canceled',
      ListPrice: 900_000 + i * 1000,
      ClosePrice: null,
      CloseDate: null,
      BedroomsTotal: beds,
      TotalLivingAreaSqFt: sqft,
      SubdivisionName: null,
      status_change_timestamp: '2026-08-20',
      OnMarketDate: '2026-05-01',
      Latitude: 44.0645,
      Longitude: -121.3237,
    }))
  }

  it('does not pin unlike homes when seven came off and none fit', () => {
    const set = buildExpiredPeerSet({
      rows: rows(4, 2400) as never,
      subject,
      area,
      asOf: new Date('2026-09-08T12:00:00.000Z'),
      // The list-price window the read counted; the count sentence names it.
      priceBand: { lo: 403_000, hi: 1_356_000 },
    })
    expect(set.count).toBe(0)
    expect(set.likeYours).toBe(false)
    expect(set.peers).toHaveLength(0)
    expect(set.sentence).toBe(
      'No home like yours in River West came off the market without selling in the last 36 months.',
    )
    expect(set.sentence).not.toContain('None were close')
    expect(set.sentence).not.toContain('bedrooms, bathrooms, size or age')
    expect(set.sentence).not.toMatch(/between \$|[—–]/)
    const shown = unsoldPeersFor({
      subject: { listingKey: 'SUBJ', mlsNumber: '1', streetAddress: '1617 NW 8th' },
      peers: set.peers,
    })
    expect(shown).toHaveLength(0)
  })

  it('prints five of seven fitting homes, and the matrix keeps those five', () => {
    const set = buildExpiredPeerSet({
      rows: rows(3, 1200) as never,
      subject,
      area,
      asOf: new Date('2026-09-08T12:00:00.000Z'),
    })
    expect(set.count).toBe(5)
    expect(set.peers).toHaveLength(5)
    expect(set.peers.map((p) => p.listingKey)).toEqual(['K0', 'K1', 'K2', 'K3', 'K4'])
    expect(set.sentence).toBe(
      'Five homes like yours in River West came off the market without selling in the last 36 months. Two more homes like yours were in that pool.',
    )
    const shown = unsoldPeersFor({
      subject: { listingKey: 'SUBJ', mlsNumber: '1', streetAddress: '1617 NW 8th' },
      peers: set.peers,
    })
    expect(shown).toHaveLength(5)
    const html = shown.map((p) => `<td>${p.address}</td>`).join('')
    expect(countedAddressesMissingFromDocument(set.peers.map((p) => p.address), html)).toEqual([])
  })
})
