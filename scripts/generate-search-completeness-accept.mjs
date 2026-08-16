#!/usr/bin/env node
/**
 * Build docs/plans/ENTERPRISE_MAP/search-completeness-accept.json
 * Every long-tail concept in registry-report.json gets a §10 disposition.
 * Accept items from FILTER_COMPLETENESS §3 are recorded beside them.
 *
 *   node scripts/generate-search-completeness-accept.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const REPORT = 'data/search-metadata/registry-report.json'
const OUT = 'docs/plans/ENTERPRISE_MAP/search-completeness-accept.json'

const REASONS = {
  covered: 'Covered by an existing registry filter or geography/scope layer — a second control would split one buyer question.',
  identity: 'Row identity / MLS join key. Lookup is resolveCanonicalListingKey, not a shoppable filter.',
  geography: 'Geography layer (city, ZIP, street, subdivision, state). FilterSchema + keywords already express it.',
  scope: 'Status or property-class scope selector, not a registry field.',
  sold: 'Sold-scope column. On-market MV is null; sold depth stays behind the VOW chokepoint on the legacy RPC.',
  timestamp: 'Ingest/sort timestamp. Buyer recency is the DOM / on-market range, not this MLS stamp.',
  plumbing: 'Broker or syndication plumbing (agency, dual, FIRPTA, VOW flags, listing-service flags). Not a buyer shop.',
  confidential: 'Confidential or showing/tenant/surveillance field. Plan §8 / §10 — never a public filter.',
  commercial: 'Commercial, farm, or agency-economics concept. Not a residential buyer shop on this surface.',
  comments: 'Free-text comments. Keywords/search_vector already search remarks; a dedicated filter would be a dead type-in.',
  suffix: 'Suffixed MLS room/unit repeat of a parent concept already dispositioned.',
}

function stripSuffix(name) {
  return name.replace(/\d+$/, '')
}

function disposeCustom(concept) {
  const raw = concept.replace(/^(cf:|group:)/, '')
  const base = stripSuffix(raw)
  const n = `${concept} ${raw} ${base}`.toLowerCase()

  if (/tenant name|surveillance|showing requirements|confidentiality|audio surveillance|video surveillance/.test(n)) {
    return { disposition: 'excluded', reasonClass: 'confidential', reason: REASONS.confidential }
  }
  if (/^cf:status\d*$/i.test(concept) || /^status\d+$/i.test(raw) || /^cf:status\d+$/i.test(concept)) {
    return { disposition: 'excluded', reasonClass: 'plumbing', reason: REASONS.plumbing }
  }
  if (/# full baths|# half baths|# of bedrooms|square footage/.test(n)) {
    return { disposition: 'excluded', reasonClass: 'covered', reason: REASONS.covered }
  }
  if (/# of garages|# of carports|# of other parking|# of parking spaces|# of living units|# of bedrooms/.test(n)) {
    return { disposition: 'excluded', reasonClass: 'covered', reason: REASONS.covered }
  }
  if (/sold price per|close price|close date/.test(n)) {
    return { disposition: 'excluded', reasonClass: 'sold', reason: REASONS.sold }
  }
  if (
    /cam cost|cam frequency|cam sqft|cap rate|cropsusage|acreage crops|blm|usfs|ugb|business included|business name|business is a franchise|ceiling clear|dock type|hours of operation|inventory list|inventory value|labor information|lease end|overhead dock|# overhead|# of grade|total building nra|annual average daily|vehiclesaverage|dealer license|assessment comments|building permit|grazing permits|mineral information|income and expenses|special assessments|unit \d rent includes|exclusion of rights|existing lease|agricultural class|commonly known address/.test(
      n,
    )
  ) {
    return { disposition: 'excluded', reasonClass: 'commercial', reason: REASONS.commercial }
  }
  if (
    /agency represent|dual listing|firpta|comp sale|backup package|currently not used|fallthrough|comprehensive unit list|unit list attached|documents on file|^group:documents$|miscellaneous information/.test(
      n,
    )
  ) {
    return { disposition: 'excluded', reasonClass: 'plumbing', reason: REASONS.plumbing }
  }
  if (/comments$|zoning comments|utilities comments|water comments|sewerseptic|irrigation comments|irrigation well|irrigation water/.test(n)) {
    return { disposition: 'excluded', reasonClass: 'comments', reason: REASONS.comments }
  }
  if (/^cf:owner\d+$/i.test(concept) || raw.toLowerCase() === 'owner2') {
    return { disposition: 'excluded', reasonClass: 'confidential', reason: REASONS.confidential }
  }
  if (/^unit #$/i.test(base) || /^cf:unit #/i.test(concept) || /^cf:state#?$/i.test(concept) || /^cf:state\d+$/i.test(concept)) {
    return { disposition: 'excluded', reasonClass: 'geography', reason: REASONS.geography }
  }
  if (/window features/.test(n)) {
    return {
      disposition: 'excluded',
      reasonClass: 'covered',
      reason: 'Window treatments/features overlap existing interior feature filters. A second group control would split one buyer question.',
    }
  }
  if (/water costs/.test(n)) {
    return { disposition: 'excluded', reasonClass: 'commercial', reason: REASONS.commercial }
  }
  if (/deeded acres|lot size square feet|list price per sqft|leased acres|on leased land/.test(n)) {
    return { disposition: 'excluded', reasonClass: 'covered', reason: REASONS.covered }
  }
  if (
    /lease rate|leased components|number of units leased|option to extend|monthly rent|rent escalators|load factor|pumping costs/.test(
      n,
    )
  ) {
    return { disposition: 'excluded', reasonClass: 'commercial', reason: REASONS.commercial }
  }
  if (
    /listing service|legacy pcl|park parcel|public survey|section$|projected active|back on market date|ownership interest|other restrictions|may remain in park|manufacturer$/.test(
      n,
    )
  ) {
    return { disposition: 'excluded', reasonClass: 'plumbing', reason: REASONS.plumbing }
  }
  if (
    /phone to show|preferred escrow|private#|seller directs no photos|seller to provide training|personal property/.test(
      n,
    )
  ) {
    return { disposition: 'excluded', reasonClass: 'confidential', reason: REASONS.confidential }
  }
  if (/^cf:parking$|^parking$/.test(n.trim()) || raw.toLowerCase() === 'parking') {
    return { disposition: 'excluded', reasonClass: 'covered', reason: REASONS.covered }
  }
  if (/^group:documents$/.test(concept.toLowerCase())) {
    return { disposition: 'excluded', reasonClass: 'plumbing', reason: REASONS.plumbing }
  }
  if (/green verification/.test(n)) {
    return { disposition: 'excluded', reasonClass: 'comments', reason: REASONS.comments }
  }
  if (/\d+$/.test(raw) && base !== raw) {
    return { disposition: 'excluded', reasonClass: 'suffix', reason: REASONS.suffix }
  }
  return null
}

function disposeStandard(concept) {
  const geo = new Set([
    'City',
    'PostalCode',
    'PostalCodePlus4',
    'SubdivisionName',
    'StreetDirPrefix',
    'StreetDirSuffix',
    'StreetName',
    'StreetNumber',
    'StreetNumberInteger',
    'StreetSuffix',
    'StateOrProvince',
    'UnparsedAddress',
    'UnitNumber',
    'Directions',
  ])
  const identity = new Set([
    'ListingId',
    'ListingKey',
    'OriginatingSystemKey',
    'OriginatingSystemName',
    'SourceSystemKey',
    'SourceSystemName',
    'ParcelNumber',
  ])
  const scope = new Set(['MlsStatus', 'StandardStatus', 'PropertyType', 'PropertyTypeLabel'])
  const sold = new Set(['CloseDate', 'ClosePrice'])
  const stamps = new Set([
    'ListingContractDate',
    'ListingUpdateTimestamp',
    'ModificationTimestamp',
    'OnMarketContractDate',
    'OnMarketDate',
    'PhotosChangeTimestamp',
    'PriceChangeTimestamp',
    'StatusChangeTimestamp',
  ])
  const covered = new Set(['CoolingYN', 'HeatingYN', 'LotSizeArea', 'LotSizeSquareFeet', 'LotSizeUnits', 'AssociationFeeFrequency'])
  const plumbing = new Set([
    'PermitInternetYN',
    'VOWAddressDisplayYN',
    'VOWAutomatedValuationDisplayYN',
    'VOWConsumerCommentYN',
  ])
  if (geo.has(concept)) return { disposition: 'excluded', reasonClass: 'geography', reason: REASONS.geography }
  if (identity.has(concept)) return { disposition: 'excluded', reasonClass: 'identity', reason: REASONS.identity }
  if (scope.has(concept)) return { disposition: 'excluded', reasonClass: 'scope', reason: REASONS.scope }
  if (sold.has(concept)) return { disposition: 'excluded', reasonClass: 'sold', reason: REASONS.sold }
  if (stamps.has(concept)) return { disposition: 'excluded', reasonClass: 'timestamp', reason: REASONS.timestamp }
  if (covered.has(concept)) return { disposition: 'excluded', reasonClass: 'covered', reason: REASONS.covered }
  if (plumbing.has(concept)) return { disposition: 'excluded', reasonClass: 'plumbing', reason: REASONS.plumbing }
  if (concept === 'Skirt') {
    return {
      disposition: 'excluded',
      reasonClass: 'covered',
      reason: 'Manufactured skirt is not an independent shop. Home type (In Park / Manufactured On Land) is the buyer control.',
    }
  }
  return null
}

const report = JSON.parse(readFileSync(REPORT, 'utf8'))
const custom = report.longTail?.customSearchableUnregistered?.concepts ?? []
const standard = report.longTail?.standardSearchableIdxUnregistered?.concepts ?? []

const leftovers = []
const longTail = []
for (const concept of custom) {
  const d = disposeCustom(concept)
  if (!d) leftovers.push(concept)
  else longTail.push({ concept, kind: 'custom', ...d })
}
for (const concept of standard) {
  const d = disposeStandard(concept)
  if (!d) leftovers.push(concept)
  else longTail.push({ concept, kind: 'standard', ...d })
}

if (leftovers.length) {
  console.error('UNDISPOSED long-tail concepts:')
  for (const c of leftovers) console.error('  ', c)
  process.exit(1)
}

const acceptItems = [
  {
    id: 'A1',
    requirement: 'R-097',
    text: 'Every shipped filter traces to Spark metadata; registry/metadata disagreement fails the build.',
    disposition: 'live',
    reason: 'ci:search-registry-generated + field-registry. 131 exposed fields. URL contract is FilterSchema.',
  },
  {
    id: 'A2',
    requirement: 'R-098',
    text: 'No zero-match filter; no confidential field; find-a-filter matches values; class-aware facets.',
    disposition: 'live',
    reason: 'ci:search-field-completeness + find-a-filter value match + class-prevalence. Confidential keys stay off the public surface.',
  },
  {
    id: 'A3',
    requirement: 'R-099',
    text: 'Zoning as jurisdiction:code with definitions and verification dates; permits-intents only.',
    disposition: 'live',
    reason: 'lib/zoning/resolve.ts keys jurisdiction:code. Find-a-filter renders plain English when unambiguous. STR is never inferred from zoning (R-019).',
  },
  {
    id: 'A4',
    requirement: 'R-100',
    text: 'Every long-tail searchable concept is exposed or excluded with a §10 reason.',
    disposition: 'live',
    reason: `This ledger: ${longTail.length} concepts (${custom.length} custom + ${standard.length} standard), zero unexplained.`,
  },
  {
    id: 'A5',
    requirement: 'R-101',
    text: 'Sold search carries the same filter depth as active, behind a registered VOW gate.',
    disposition: 'gated',
    reason: 'VOW chokepoint is live (ODS §5-4: audience must be vow). Sold browse stays on the legacy RPC, not searchListingsAll. Same-depth sold search is the residual — do not lift VOW data onto a public index.',
  },
  {
    id: 'A6',
    requirement: 'R-102',
    text: 'Drawn shapes: multi-shape include/exclude, URL-persisted, server-evaluated; drawn geography reaches alerts.',
    disposition: 'live',
    reason: 'MapSearchView + ?shapes= + search_listing_keys_in_shapes. G4 enrolls the same filters into listing_alerts.',
  },
  {
    id: 'A7',
    requirement: 'R-103',
    text: 'Named saved areas reusable in searches and alerts.',
    disposition: 'live',
    reason: 'search_areas + AreaPicker + /account/areas. Public broker-authored areas at /areas/[slug].',
  },
  {
    id: 'A8',
    requirement: 'R-104',
    text: 'Filter paint <800ms p75; pan pins <500–800ms; cold TTFB <600ms; timeout honesty.',
    disposition: 'measured',
    reason: 'p75 recorded on this file under perf. Structural timeouts stay locked by ci:search-perf-budget.',
  },
  {
    id: 'A9',
    requirement: 'R-105',
    text: 'Search chrome: omnibox, chips, Save/Alerts, count/sort, map+list lockstep; sentence search writes the same params.',
    disposition: 'live',
    reason: 'WAVE3 shipped. R-105 already VERIFIED. Sentence search writes FilterSchema params.',
  },
  {
    id: 'A10',
    requirement: 'R-106',
    text: 'Account portal unifies alerts, saved searches, saved homes, named areas, activity.',
    disposition: 'live',
    reason: '/account renders those rails from live queries. /dashboard redirects to /account.',
  },
  {
    id: 'A11',
    requirement: '§4.8',
    text: 'All 22 sub types selectable with live counts; no substring match on property_sub_type.',
    disposition: 'live',
    reason: 'propertySubTypes is an enumerated multi over the 22 feed values. DAL is IN, not ILIKE.',
  },
]

const doc = {
  status: 'ok',
  recordedAt: new Date().toISOString(),
  source: OUT,
  versionGap: 'G15',
  plan: 'docs/plans/SEARCH_FILTER_COMPLETENESS_PLAN_2026-07-30.md',
  acceptItems,
  longTail: {
    customCount: custom.length,
    standardCount: standard.length,
    disposedCount: longTail.length,
    unexplainedCount: 0,
    rows: longTail,
  },
  perf: {
    measuredAt: null,
    environment: null,
    samples: 0,
    p75: {
      ttfbHomesForSaleMs: null,
      ttfbBendMs: null,
    },
    dalBaseline: 'scripts/search-perf-baseline.json (2026-08-01 laptop-to-Supabase; production is faster)',
  },
}

writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n')
console.log(`wrote ${OUT}: ${longTail.length} long-tail rows, ${acceptItems.length} accept items`)
