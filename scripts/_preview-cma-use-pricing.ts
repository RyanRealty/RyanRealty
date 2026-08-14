/**
 * One-off preview: render the use-of-property + pricing pages with the live
 * Redmond R-2 resolver (3480 SW 45th facts) and the CMA stylesheet.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { resolveDevelopmentOpportunities } from '@/lib/cma/development'
import { resolveRentalPotential } from '@/lib/cma/rental-potential'
import { propertyUsePage } from '@/lib/cma/render-use-of-property'
import { pricingPage } from '@/lib/cma/render-pricing-page'
import { cmaStylesheet } from '@/lib/cma/render-css'
import type { CmaSiteData } from '@/lib/cma/county'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'

const SITE_URL = 'https://ryan-realty.com'
const OUT = path.resolve('docs/plans/PUBLIC_PRODUCT/looks/2026-08-14-cma-use-and-pricing')

const subject = {
  listingKey: '2025042521',
  mlsNumber: '220214000',
  streetAddress: '3480 SW 45th St',
  city: 'Redmond',
  state: 'OR',
  postalCode: '97756',
  subdivision: null,
  latitude: 44.25,
  longitude: -121.18,
  beds: 3,
  baths: 2,
  sqft: 1631,
  lotAcres: 0.23,
  propertySubType: 'Single Family Residence',
  yearBuilt: 2018,
  garageSpaces: 2,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: 'Mountain(s)',
  taxAnnual: 4200,
  standardStatus: 'Closed',
  lastListPrice: 655000,
  lastListDate: '2026-07-01',
  listingHistoryLine: null,
} as CmaSubject

const site = {
  taxAccount: '100000',
  taxlot: '1513000000100',
  trs: '15-13-00',
  acreage: 0.23,
  zone: 'R-2',
  zoneOverlays: [],
  overlays: [],
  wildfireHazard: false,
  flood: { zone: 'X', inSFHA: false },
  water: {
    source: 'municipal',
    providerName: 'City of Redmond',
    wellLog: null,
    irrigationDistrict: null,
    rights: [],
    mappedIrrigationAcres: null,
    primaryIrrigationPriorityDate: null,
    hasPrivateAppurtenant: false,
    rightsQueryOk: true,
    rightsUsedPolygon: true,
  },
  septic: { status: 'municipal-sewer', permit: null },
  permits: [],
  entitlement: null,
  hunting: null,
  isMunicipal: true,
  insideUGB: true,
  publicLand: false,
  constraints: [],
  fieldConfirm: [],
  resolved: true,
  notes: [],
  citations: [],
} as CmaSiteData

const comps = [
  {
    address: '3344 SW Cascade Vista',
    closePrice: 655000,
    timeAdjustment: 0,
    sizeAdjustment: -23200,
    adjustedPrice: 636000,
  },
  {
    address: '3638 SW 45th St',
    closePrice: 770000,
    timeAdjustment: 0,
    sizeAdjustment: -80000,
    adjustedPrice: 670000,
  },
] as CmaAdjustedComp[]

const pricing = {
  method1Low: 620000,
  method1Mid: 640000,
  method1High: 644000,
  method2: 630000,
  method3: 650000,
  conservative: 639000,
  recommended: 655000,
  highEnd: 669000,
  valueLow: 639000,
  valueHigh: 669000,
  confidence: 'High',
  confidenceReason: 'Seven closed sales in a tight size band.',
  priceOverride: null,
  improvementsValueAdd: null,
  notes: [],
  sellerNet: null,
} as unknown as CmaPricing

const market = {
  geoLabel: 'Redmond',
  saleToListRatio: 0.989,
} as CmaMarketContext

const development = resolveDevelopmentOpportunities(site, subject)
const rental = resolveRentalPotential(subject, site)
const useOf = propertyUsePage({ streetAddress: subject.streetAddress, development, rental })
const priced = pricingPage({ subject, comps, market, pricing })

function wrap(page: { meta: string; body: string }): string {
  return `<section class="page">
  <header class="pg-header">
    <img src="${SITE_URL}/images/brand/logo-blue.png" alt="Ryan Realty" class="logo" />
    <div class="pg-meta">${page.meta}</div>
  </header>
  ${page.body}
</section>`
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>CMA preview · 3480 SW 45th · use + pricing</title>
<style>${cmaStylesheet(SITE_URL)}</style>
</head>
<body>
${useOf ? wrap(useOf) : '<p>No use-of-property page.</p>'}
${wrap(priced)}
</body>
</html>`

mkdirSync(OUT, { recursive: true })
const dest = path.join(OUT, 'preview.html')
writeFileSync(dest, html)
console.log(`wrote ${dest}`)
console.log(`zone=${development?.zone} items=${development?.items.length} tenures=${rental?.tenures.length}`)
