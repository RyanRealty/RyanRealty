import { describe, expect, it } from 'vitest'
import {
  AEO_HUB_GUIDES,
  AEO_HUB_OMIT,
  AEO_HUB_TIP_MINS,
  aeoHubHomeStripDoors,
  aeoHubLedgerRows,
  aeoHubQuietItems,
} from './aeo-hub-guides'

describe('aeo-hub-guides', () => {
  it('keeps the SEO Desk live list and the published closing-costs slug', () => {
    expect(AEO_HUB_GUIDES.buy).toHaveLength(9)
    expect(AEO_HUB_GUIDES.buy.map((g) => g.href)).toContain('/blog/closing-costs-buyers-bend-oregon')
    expect(AEO_HUB_GUIDES.sell.map((g) => g.href)).toContain('/blog/how-to-sell-your-home-bend')
    expect(AEO_HUB_GUIDES.sell.map((g) => g.href)).toContain('/blog/cost-to-sell-house-bend-oregon')
    expect(AEO_HUB_GUIDES.neighborhoods.map((g) => g.href)).toEqual([
      '/blog/best-neighborhoods-bend-buyers',
      '/blog/westside-vs-eastside-bend',
      '/blog/bend-vs-redmond-vs-sisters',
    ])
    const allHrefs = Object.values(AEO_HUB_GUIDES).flatMap((rows) => rows.map((g) => g.href))
    expect(allHrefs).toContain('/blog/closing-costs-buyers-bend-oregon')
    expect(allHrefs).not.toContain('/blog/buyers-agent-bend-buyer-broker-agreement')
    expect(AEO_HUB_OMIT).not.toContain('/blog/closing-costs-buyers-bend-oregon')
  })

  it('uses authentic titles as ledger and Quiet anchors', () => {
    const buyRows = aeoHubLedgerRows('buy')
    expect(buyRows.length).toBeGreaterThanOrEqual(AEO_HUB_TIP_MINS.buy.length)
    expect(String(buyRows[0]?.what)).toBe('First-Time Home Buyer Guide for Bend and Central Oregon')
    expect(buyRows[0]?.href).toBe('/blog/first-time-home-buyer-guide-central-oregon')

    const sellItems = aeoHubQuietItems('sell')
    expect(sellItems).toEqual(
      expect.arrayContaining([
        {
          kind: 'link',
          label: 'How to Sell Your House in Bend, Oregon',
          href: '/blog/how-to-sell-your-home-bend',
        },
        {
          kind: 'link',
          label: 'What It Costs to Sell a House in Bend (and Oregon)',
          href: '/blog/cost-to-sell-house-bend-oregon',
        },
      ]),
    )
  })

  it('homepage strip doors are the unique tip-min union with published titles', () => {
    const doors = aeoHubHomeStripDoors()
    expect(doors.map((door) => door.href)).toEqual([...new Set(Object.values(AEO_HUB_TIP_MINS).flat())])
    expect(doors).toHaveLength(9)
    expect(doors.every((door) => door.label && door.group)).toBe(true)
    expect(doors.map((door) => door.href)).toContain('/blog/closing-costs-buyers-bend-oregon')
  })
})
