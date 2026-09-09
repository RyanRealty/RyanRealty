/**
 * The static shell's one rule, held mechanically (SITE-29).
 *
 * A place page prerenders and revalidates only while its server render reads
 * no request state and its client tree never calls next/navigation's
 * `useSearchParams()` (which bails the tree out to client rendering up to
 * loading.tsx during a static render, leaving the loading skeleton as the
 * page's HTML). Every reader under the split view goes through the store in
 * lib/search/url-search-params.client instead; the store's one real
 * `useSearchParams()` sits in the root bridge, inside its own Suspense.
 *
 * Source-text assertions, on purpose: the failure this guards is a build
 * classification, which no runtime unit test can see.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..', '..', '..')
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8')
const codeLines = (src: string) =>
  src.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))

/** Client files reachable from PlaceSplitView that read the URL. */
const SPLIT_VIEW_CLIENT_FILES = [
  'components/search/SearchFilters.tsx',
  'components/search/MapSearchView.tsx',
  'components/search/AllFiltersSheet.tsx',
  'components/search/SearchAlertCapture.tsx',
  'components/SaveSearchButton.tsx',
]

/** The four place routes plus the shell they share. */
const STATIC_SHELL_SERVER_FILES = [
  'app/cities/[slug]/page.tsx',
  'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
  'app/communities/[slug]/page.tsx',
  'app/subdivisions/[slug]/page.tsx',
  'components/search/PlaceSplitView.tsx',
]

describe('static shell: the split view client tree reads the URL through the store', () => {
  for (const file of SPLIT_VIEW_CLIENT_FILES) {
    it(`${file} does not call next/navigation useSearchParams`, () => {
      const code = codeLines(read(file)).join('\n')
      expect(code).not.toMatch(/\buseSearchParams\b/)
      expect(code).toMatch(/useUrlSearchParams\(\)/)
    })
  }

  it('the store owns the only useSearchParams call, inside a Suspense bridge', () => {
    const src = read('lib/search/url-search-params.client.tsx')
    expect(src).toMatch(/import \{[^}]*\buseSearchParams\b[^}]*\} from 'next\/navigation'/)
    expect(src).toMatch(/<Suspense fallback=\{null\}>\s*<Bridge \/>\s*<\/Suspense>/)
    expect(src).toMatch(/useLayoutEffect\(\(\) => \{\s*publishUrlSearchParams\(search\)/)
  })

  it('the root mounts the bridge once', () => {
    const src = read('components/site/providers/IdentityBridges.tsx')
    expect(src).toMatch(/<UrlSearchParamsBridge \/>/)
  })
})

describe('static shell: the place pages read no request state', () => {
  for (const file of STATIC_SHELL_SERVER_FILES) {
    it(`${file} does not await searchParams, cookies, or headers`, () => {
      const code = codeLines(read(file)).join('\n')
      expect(code).not.toMatch(/\bsearchParams\b/)
      expect(code).not.toMatch(/\bcookies\(\)/)
      expect(code).not.toMatch(/\bheaders\(\)/)
      expect(code).not.toMatch(/force-dynamic/)
    })
  }

  it('PlaceSplitView hands both client halves the staticShell flag, and the map its footprint', () => {
    const src = read('components/search/PlaceSplitView.tsx')
    expect(src).toMatch(/<SearchFilters[\s\S]*?staticShell[\s\S]*?\/>/)
    expect(src).toMatch(/<MapSearchView[\s\S]*?staticShell[\s\S]*?\/>/)
    // The refetch searches inside the same seed ring the server list came
    // from, so a filtered count describes the population the page opened on.
    expect(src).toMatch(/<MapSearchView[\s\S]*?scopePolygon=\{seedPoly\}[\s\S]*?\/>/)
    const map = read('components/search/MapSearchView.tsx')
    expect(map).toMatch(/shapes\.length === 0 && scopePolygonRef\.current != null/)
  })

  it('every place route declares a revalidate window', () => {
    for (const file of STATIC_SHELL_SERVER_FILES.filter((f) => f.startsWith('app/'))) {
      expect(read(file)).toMatch(/^export const revalidate = \d+$/m)
    }
  })
})

describe('static shell: the dynamic search pages seed the store with the request query', () => {
  for (const file of ['app/search/page.tsx', 'app/search/[...slug]/sections/MapSplitView.tsx']) {
    it(`${file} wraps its tree in UrlSearchParamsProvider`, () => {
      const src = read(file)
      expect(src).toMatch(/<UrlSearchParamsProvider search=\{queryStringFromSearchParams\(sp/)
      expect(src).toMatch(/<\/UrlSearchParamsProvider>/)
    })
  }
})

describe('static shell: the client writes the URL without a server round trip', () => {
  it('SearchFilters and MapSearchView route every query write through navigateQuery', () => {
    for (const file of ['components/search/SearchFilters.tsx', 'components/search/MapSearchView.tsx']) {
      const code = codeLines(read(file)).join('\n')
      // The one router.push left in SearchFilters is a route change (a place
      // pick navigates to another page); query writes carry staticShell.
      const pushes = code.match(/router\.(push|replace)\(/g) ?? []
      const allowed = file.endsWith('SearchFilters.tsx') ? 1 : 0
      expect(pushes.length).toBe(allowed)
      expect(code).toMatch(/navigateQuery\(router,/)
    }
  })
})
