import { describe, expect, it } from 'vitest'
import {
  PUBLIC_CLOSED_SALES_METHODOLOGY,
  publicClosedSalesMethodology,
} from './publish-public-methodology'

describe('publicClosedSalesMethodology', () => {
  it('rewrites the internal closed_cte stamp (housing-market founding)', () => {
    const leaked =
      'closed_cte+service_area_v1: StandardStatus ILIKE %Closed%, ClosePrice>=1000, CloseDate set, City in CENTRAL_OREGON_CITY_SLUGS'
    expect(publicClosedSalesMethodology(leaked)).toBe(PUBLIC_CLOSED_SALES_METHODOLOGY)
    expect(publicClosedSalesMethodology(leaked)).not.toMatch(/closed_cte|ILIKE|StandardStatus/)
  })

  it('rewrites a table-name leak', () => {
    expect(publicClosedSalesMethodology('analytics_mart_market_annual city row')).toBe(
      PUBLIC_CLOSED_SALES_METHODOLOGY,
    )
  })
})
