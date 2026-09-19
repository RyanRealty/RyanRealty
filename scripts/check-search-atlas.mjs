#!/usr/bin/env node
/**
 * check-search-atlas.mjs (ci:search-atlas) — SITE-110
 *
 * Search used to look like every portal: Google terrain greens, stacked price
 * pills, uniform filter chips, mute photo+price cards. SITE-44 shipped the
 * cream ladder and a hairline band; production still painted vector tiles
 * (styles ignored) and the list never showed the comparison claim.
 *
 * This gate keeps the visible half from regressing:
 *   - raster rendering so V3_BASEMAP_STYLE actually paints
 *   - search-only cluster radius (place Atlas stays on V3_CLUSTER_RADIUS_PX)
 *   - labeled PPSF glance on cards
 *   - key-chip hierarchy that is more than font-weight
 *   - Command / Empty / crawlable pagination on the search _v3 set
 *   - SERP title names the price band; ItemList carries Offer
 *   - no mapId assignment on public search maps
 */
import { readFileSync } from 'node:fs'

const files = {
  basemap: 'lib/maps/v3-basemap.ts',
  clustered: 'components/SearchMapClustered.tsx',
  split: 'components/search/MapSearchView.tsx',
  mapOnly: 'components/search/HideAwareSearchMap.tsx',
  place: 'components/site/v3/V3PlaceLookMap.client.tsx',
  filters: 'components/search/SearchFilters.tsx',
  results: 'components/search/SearchResults.tsx',
  card: 'components/search/SplitListingCard.tsx',
  ppsf: 'components/search/PpsfMark.tsx',
  css: 'components/search/search-ledger.css',
  page: 'app/search/page.tsx',
  title: 'lib/search/search-title.ts',
  jsonld: 'app/search/SearchRootJsonLd.tsx',
  catalog: 'app/search/_v3/catalog.ts',
  command: 'app/search/_v3/SearchCommandList.tsx',
  empty: 'app/search/_v3/SearchEmptyState.tsx',
  pager: 'app/search/_v3/SearchPagination.tsx',
}

const failures = []

function src(rel) {
  return readFileSync(rel, 'utf8')
}

function must(rel, re, label) {
  if (!re.test(src(rel))) failures.push(`${rel}: missing ${label}`)
}

function mustNot(rel, re, label) {
  if (re.test(src(rel))) failures.push(`${rel}: forbidden ${label}`)
}

must(files.basemap, /renderingType:\s*'RASTER'/, 'renderingType RASTER on getV3MapOptions')
must(files.basemap, /V3_SEARCH_CLUSTER_RADIUS_PX = V3_MARK_WIDTH_PX \* 2/, 'search cluster radius')
mustNot(files.basemap, /^\s*mapId\s*:/m, 'mapId assignment')

must(files.clustered, /clusterRadiusPx = V3_CLUSTER_RADIUS_PX/, 'place-safe default radius')
must(files.clustered, /radius:\s*clusterRadiusPx/, 'clusterer uses the prop, not a hard place radius')
must(files.split, /clusterRadiusPx=\{V3_SEARCH_CLUSTER_RADIUS_PX\}/, 'split search uses the search radius')
must(files.mapOnly, /clusterRadiusPx=\{V3_SEARCH_CLUSTER_RADIUS_PX\}/, 'map-only search uses the search radius')
mustNot(files.place, /V3_SEARCH_CLUSTER_RADIUS_PX/, 'place Atlas must not twin the search radius')

must(files.ppsf, /bandGlance/, 'labeled comparison glance')
must(files.results, /<PpsfMark/, 'list cards carry the comparison mark')
must(files.card, /<PpsfMark/, 'split cards carry the comparison mark')
must(files.css, /\.srch-ppsf-glance/, 'glance is painted, not mute')
must(files.css, /button\.srch-chip--key \{[\s\S]*box-shadow: inset/, 'key chips have a visible hierarchy beyond font-weight')

must(files.filters, /<SearchCommandList/, 'morph results are Command, not a plain list')
must(files.filters, /const morphOpen = locationOpen/, 'click opens the morph without waiting for a typed query')
must(files.filters, /DEFAULT_PLACE_SUGGESTIONS/, 'empty query seeds Bend/Redmond/Sisters/Sunriver/Tetherow')
must(files.results, /<SearchEmptyState/, 'empty/degraded use official Empty')
must(files.results, /<SearchPagination/, 'list view has crawlable pagination')
must(files.catalog, /from '@\/components\/ui\/command'/, 'command installed on the route _v3 set')
must(files.catalog, /from '@\/components\/ui\/pagination'/, 'pagination installed on the route _v3 set')
must(files.catalog, /from '@\/components\/ui\/empty'/, 'empty installed on the route _v3 set')
must(files.command, /shouldFilter=\{false\}/, 'Command does not re-filter fetched groups')
must(files.empty, /from '@\/components\/ui\/empty'/, 'Empty primitive')
must(files.pager, /from '@\/components\/ui\/pagination'/, 'Pagination primitive')

must(files.title, /formatSearchPriceBand/, 'SERP title names the price band')
must(files.page, /from '@\/lib\/search\/search-title'/, 'page title comes from the shared builder')
must(files.page, /searchRelHrefs/, 'list view emits rel prev/next')
must(files.jsonld, /'@type': 'Offer'/, 'ItemList carries Offer nodes')

if (failures.length > 0) {
  console.error('ci:search-atlas FAILED\n')
  for (const row of failures) console.error(`  - ${row}`)
  process.exit(1)
}

console.log(
  'ci:search-atlas OK — raster cream field, search cluster radius, labeled PPSF, key-chip hierarchy, Command/Empty/pagination, price-band title, Offer JSON-LD',
)
