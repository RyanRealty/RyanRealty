import { describe, expect, it } from 'vitest'
import { buildListingAskHeadline, leftoverMarketReportHref } from '@/components/site/listing-detail/listing-ask'

describe('listing ask copy', () => {
  it("never says ask in the visitor headline", () => {
    expect(buildListingAskHeadline('Sunriver', 570_000, 928_250)).toBe(
      "This home's price sits 38.6% under the Sunriver median list",
    )
    expect(buildListingAskHeadline('Sunriver', 570_000, 928_250)).not.toMatch(/ask/i)
  })

  it('sends a core city grain to its market report, not search', () => {
    expect(leftoverMarketReportHref('sunriver')).toBe('/housing-market/sunriver')
    expect(leftoverMarketReportHref('tetherow')).toBeNull()
  })
})
