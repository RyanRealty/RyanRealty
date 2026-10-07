/**
 * Route-local constants for /housing-market/reports.
 *
 * Split out so the hub page stays under the ci:file-size-budget floor (600).
 * Nothing here fetches.
 */
import { siteOrigin } from '@/lib/site-origin'
import { valuationHref } from '@/lib/site/valuation-href'

export const CANONICAL_PATH = '/housing-market/reports'
export const REGION_GEO_SLUG = 'central-oregon'
export const REGION_LABEL = 'Central Oregon'
export const SELL_HREF = valuationHref(CANONICAL_PATH)

export const siteUrl = siteOrigin()
