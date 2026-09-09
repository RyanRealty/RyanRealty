import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import {
  auditCityRouteGuards,
  middlewareGuardedSegments,
  rewriteAliasSegments,
} from '../check-city-route-guard.mjs'

const MIDDLEWARE_WITH_RULE = `
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
function resolveGeoCityRedirect(pathname) {
  const cityMatch = pathname.match(/^\\/cities\\/([^/]+)\\/?$/)
  if (cityMatch) return null
  const openHouseMatch = pathname.match(/^\\/open-houses\\/([^/]+)\\/?$/)
  if (openHouseMatch) {
    const slug = openHouseMatch[1].toLowerCase()
    if (!CENTRAL_OREGON_CITY_SLUGS.has(slug)) return '/oregon/' + slug
  }
  const homesMatch = pathname.match(/^\\/homes-for-sale\\/([^/]+)\\/?$/)
  if (homesMatch) {
    const slug = homesMatch[1].toLowerCase()
    if (!CENTRAL_OREGON_CITY_SLUGS.has(slug)) return '/oregon/' + slug
  }
  return null
}
export default resolveGeoCityRedirect
`

const MIDDLEWARE_WITHOUT_RULE = `
function resolveGeoCityRedirect(pathname) {
  const cityMatch = pathname.match(/^\\/cities\\/([^/]+)\\/?$/)
  return cityMatch ? null : null
}
export default resolveGeoCityRedirect
`

const NEXT_CONFIG = `
const nextConfig = {
  async redirects() {
    return [{ source: '/areas/:slug', destination: '/homes-for-sale', permanent: true }]
  },
  async rewrites() {
    return [
      { source: '/homes-for-sale/:path*', destination: '/search/:path*' },
    ]
  },
}
export default nextConfig
`

function write(root, rel, body) {
  const full = join(root, rel)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, body, 'utf8')
}

/**
 * A miniature app tree with the same shape as the real one: a statewide
 * getCityFromSlug, one page that calls it directly, one page that reaches it
 * through a helper in its own route directory, and one page that imports a
 * SIBLING export from the same module and must stay OUT of scope.
 */
function buildFixture(middlewareSource) {
  const root = mkdtempSync(join(tmpdir(), 'city-route-guard-'))
  write(root, 'lib/central-oregon.ts', `
export const CENTRAL_OREGON_CITY_SLUGS = new Set(['bend'])
export const SITE_CITY_SLUGS = ['bend']
`)
  write(root, 'app/actions/listings.ts', `
export async function getCityFromSlug(slug) { return slug ?? null }
export async function getBrowseCities() { return [] }
`)
  write(root, 'app/actions/cities.ts', `
import { getCityFromSlug } from '@/app/actions/listings'
export async function getNeighborhoodBySlug(citySlug) {
  return getCityFromSlug(citySlug)
}
export async function getCitiesForIndex() { return [] }
`)
  // Direct caller.
  write(root, 'app/open-houses/[city]/page.tsx', `
import { getCityFromSlug } from '@/app/actions/listings'
export const dynamicParams = true
export default async function Page({ params }) {
  const { city } = await params
  return getCityFromSlug(city)
}
`)
  // Reaches it through a helper in its own route directory.
  write(root, 'app/search/[...slug]/resolve-slug.ts', `
import { getCityFromSlug } from '@/app/actions/listings'
export async function resolveSlug(slug) { return getCityFromSlug(slug[0]) }
`)
  write(root, 'app/search/[...slug]/page.tsx', `
import { resolveSlug } from './resolve-slug'
export default async function Page({ params }) {
  const { slug } = await params
  return resolveSlug(slug)
}
`)
  // Imports a SIBLING export of a reaching module — must stay out of scope.
  write(root, 'app/page.tsx', `
import { getCitiesForIndex } from '@/app/actions/cities'
export default async function Page() { return getCitiesForIndex() }
`)
  write(root, 'middleware.ts', middlewareSource)
  write(root, 'next.config.ts', NEXT_CONFIG)
  return root
}

describe('middlewareGuardedSegments', () => {
  it('reads the first path segment out of every `/^\\/<seg>\\/` rule', () => {
    const segs = middlewareGuardedSegments(MIDDLEWARE_WITH_RULE)
    expect([...segs].sort()).toEqual(['cities', 'homes-for-sale', 'open-houses'])
  })

  it('finds no segment when the rules are absent', () => {
    expect([...middlewareGuardedSegments(MIDDLEWARE_WITHOUT_RULE)]).toEqual(['cities'])
  })
})

describe('rewriteAliasSegments', () => {
  it('maps a rewrite destination segment back to its public source segment', () => {
    const aliases = rewriteAliasSegments(NEXT_CONFIG)
    expect([...(aliases.get('search') ?? [])]).toEqual(['homes-for-sale'])
  })

  it('ignores redirects() — a redirect never makes one route answer under another segment', () => {
    const aliases = rewriteAliasSegments(NEXT_CONFIG)
    expect(aliases.has('homes-for-sale')).toBe(false)
  })
})

describe('auditCityRouteGuards', () => {
  let passing
  let failing

  beforeAll(() => {
    passing = buildFixture(MIDDLEWARE_WITH_RULE)
    failing = buildFixture(MIDDLEWARE_WITHOUT_RULE)
  })
  afterAll(() => {
    rmSync(passing, { recursive: true, force: true })
    rmSync(failing, { recursive: true, force: true })
  })

  it('PASSES when every city-slug route has a middleware rule on its public segment', () => {
    const { findings, covered } = auditCityRouteGuards({ root: passing })
    expect(findings).toHaveLength(0)
    expect(covered.map((c) => c.route).sort()).toEqual(['/open-houses/[city]', '/search/[...slug]'])
  })

  it('FAILS the direct caller and the helper caller when the rules are gone', () => {
    const { findings } = auditCityRouteGuards({ root: failing })
    expect(findings.map((f) => f.route).sort()).toEqual(['/open-houses/[city]', '/search/[...slug]'])
  })

  it('resolves the /homes-for-sale rewrite so /search is checked under its public segment', () => {
    const { covered } = auditCityRouteGuards({ root: passing })
    const search = covered.find((c) => c.route === '/search/[...slug]')
    expect(search.publicSegments.sort()).toEqual(['homes-for-sale', 'search'])
  })

  it('keeps a page that imports a SIBLING export of a reaching module out of scope', () => {
    const { findings, covered } = auditCityRouteGuards({ root: failing })
    const routes = [...findings, ...covered].map((e) => e.route)
    expect(routes).not.toContain('/')
  })

  it('does not accept a bare textual mention of the allowlist as a guard', () => {
    const root = buildFixture(MIDDLEWARE_WITHOUT_RULE)
    // A comment naming SITE_CITY_SLUGS, with no import and no rejection.
    write(root, 'app/open-houses/[city]/page.tsx', `
import { getCityFromSlug } from '@/app/actions/listings'
/** A city not in SITE_CITY_SLUGS still resolves through getCityFromSlug. */
export const dynamicParams = true
export default async function Page({ params }) {
  const { city } = await params
  return getCityFromSlug(city)
}
`)
    const { findings } = auditCityRouteGuards({ root })
    expect(findings.map((f) => f.route)).toContain('/open-houses/[city]')
    rmSync(root, { recursive: true, force: true })
  })

  it('accepts a real allowlist test: imported, used, and rejecting in the same file', () => {
    const root = buildFixture(MIDDLEWARE_WITHOUT_RULE)
    write(root, 'app/open-houses/[city]/page.tsx', `
import { notFound } from 'next/navigation'
import { getCityFromSlug } from '@/app/actions/listings'
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
export const dynamicParams = true
export default async function Page({ params }) {
  const { city } = await params
  if (!CENTRAL_OREGON_CITY_SLUGS.has(city)) notFound()
  return getCityFromSlug(city)
}
`)
    const { findings, covered } = auditCityRouteGuards({ root })
    expect(findings.map((f) => f.route)).not.toContain('/open-houses/[city]')
    expect(covered.find((c) => c.route === '/open-houses/[city]').allowlistFile).toBe(
      'app/open-houses/[city]/page.tsx',
    )
    rmSync(root, { recursive: true, force: true })
  })
})
