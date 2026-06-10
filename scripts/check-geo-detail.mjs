#!/usr/bin/env node
/**
 * check-geo-detail.mjs — content-correctness gate for IDX geo detail pages.
 *
 * WHY: /schools/[slug], /parks/[slug], and /subdivisions/[slug] are unsmoked
 * IDX surfaces (P1.12 from site-consistency-audit-2026-06-09.md). A boundary-
 * resolution failure, a DAL regression, or a getGeoBoundaryMapData miss causes
 * these pages to notFound() or render a hollow shell — all on HTTP 200. The
 * generic route-smoke gate cannot catch this. This gate asserts that:
 *
 *   (a) Each page returns HTTP 200 with no error boundary.
 *   (b) An H1 heading renders (the school/park/subdivision name).
 *   (c) The page is not "Page not found" or an error page.
 *   (d) The page body is substantial (>= 3 KB) — catches hollow-shell renders.
 *
 * Representative slugs are chosen to be stable (large, well-known in their
 * registry) and guaranteed to exist in the static-params set. Override with
 * env vars if inventory changes require a different anchor.
 *
 * It ALSO asserts the inverse for the /subdivisions space: a MARKETING-level
 * area name (e.g. 'awbrey-butte', 'tetherow') — which has no plat boundary and
 * is served at /communities/<slug> or /cities/bend/<slug> — must PERMANENT-
 * REDIRECT (301/308) to its canonical home, NOT soft-404 as a hollow 200. This
 * is the regression that motivated the redirect: a bare 200 with a not-found
 * shell is invisible to this gate's content checks but poison for UX + SEO.
 *
 * Environment:
 *   GEO_SMOKE_BASE         — base URL (default: https://ryan-realty.com)
 *   SMOKE_SCHOOL_SLUG      — school slug (default: summit-high)
 *   SMOKE_PARK_SLUG        — park slug   (default: drake-park)
 *   SMOKE_SUBDIVISION_SLUG — PLAT-level subdivision slug (default: tetherow-phase-1)
 *   SMOKE_NEIGHBORHOOD_REDIRECT_SLUG — marketing slug expected to 301/308 to
 *                            /cities/bend/* (default: awbrey-butte)
 *   SMOKE_COMMUNITY_REDIRECT_SLUG    — marketing slug expected to 301/308 to
 *                            /communities/* (default: tetherow)
 *
 * Usage:
 *   node scripts/check-geo-detail.mjs
 *   node scripts/check-geo-detail.mjs --json
 */

const BASE = (process.env.GEO_SMOKE_BASE ?? process.env.SMOKE_BASE_URL ?? 'https://ryan-realty.com').replace(/\/+$/, '')
const TIMEOUT_MS = Number(process.env.GEO_SMOKE_TIMEOUT_MS ?? 15_000)
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
const JSON_OUT = process.argv.includes('--json')

// ---------------------------------------------------------------------------
// Representative slugs (from registry — stable, large, guaranteed to exist)
// ---------------------------------------------------------------------------

/**
 * Summit High — the largest high school in the Bend-La Pine district;
 * slug from CO_SCHOOLS in data/co-schools.ts; generateStaticParams includes it.
 */
const SCHOOL_SLUG = process.env.SMOKE_SCHOOL_SLUG ?? 'summit-high'

/**
 * Drake Park — central Bend city park on Mirror Pond; slug 'drake-park' from
 * data/co-parks.ts; has a boundaries polygon + active nearby listings.
 */
const PARK_SLUG = process.env.SMOKE_PARK_SLUG ?? 'drake-park'

/**
 * tetherow-phase-1 — a real PLAT-level slug in the boundaries table
 * (geo_type='subdivision'). The /subdivisions/[slug] URL space is the 3,213
 * county plat slugs ('tetherow-phase-1', 'awbrey-butte-homesites-phase-eight'),
 * NOT marketing-level area names ('awbrey-butte', 'tetherow' — those are
 * geo_type='neighborhood' and live under /communities). An unknown slug
 * notFound()s, which streams as a hollow 200 shell — exactly what this smoke
 * exists to distinguish from a real content render.
 */
const SUBDIVISION_SLUG = process.env.SMOKE_SUBDIVISION_SLUG ?? 'tetherow-phase-1'

/**
 * Marketing-level slugs that must NOT live at /subdivisions/* — they have no
 * plat boundary and resolve to a canonical home, so /subdivisions/<slug> has to
 * permanent-redirect rather than soft-404:
 *   - 'awbrey-butte'  is a Bend neighborhood  → /cities/bend/awbrey-butte
 *   - 'tetherow'      is a resort community   → /communities/tetherow
 */
const NEIGHBORHOOD_REDIRECT_SLUG = process.env.SMOKE_NEIGHBORHOOD_REDIRECT_SLUG ?? 'awbrey-butte'
const COMMUNITY_REDIRECT_SLUG = process.env.SMOKE_COMMUNITY_REDIRECT_SLUG ?? 'tetherow'

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

/**
 * H1 heading — rendered by the <H1> primitive from @/components/site/primitives
 * on all three detail pages. We look for any non-empty <h1> tag.
 */
const H1_RE = /<h1[^>]*>[\s\S]{2,200}<\/h1>/i

/**
 * Stat / content band marker — each page renders a stat or homes-for-sale count.
 * Schools: "Homes for sale that feed this school"
 * Parks: "Homes for sale" (Eyebrow label)
 * Subdivisions: "homes for sale" in the page body description OR breadcrumb
 * We look for any mention of "home" near the page body (very loose, just
 * ensures the page is not a pure navigation shell).
 */
const CONTENT_RE = /homes? for sale|properties? (near|in)|subdivision/i

// ---------------------------------------------------------------------------
// Fetch + check
// ---------------------------------------------------------------------------

async function check(label, path) {
  const url = `${BASE}${path}?_smoke=${Date.now()}`
  let res, html
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': UA }, redirect: 'follow' })
    clearTimeout(t)
    html = await res.text()
  } catch (e) {
    const msg = String(e?.message ?? e)
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('fetch failed')) {
      return { label, path, ok: false, fails: [`Cannot reach ${BASE} — start the server with npm run dev or set GEO_SMOKE_BASE to a running deploy`] }
    }
    return { label, path, ok: false, fails: [`fetch error: ${msg}`] }
  }

  const fails = []
  if (res.status !== 200) fails.push(`HTTP ${res.status} (expected 200)`)
  if (html.includes('Page not found')) fails.push('"Page not found" — slug not resolving in DAL or boundary missing')
  if (html.includes('Application error')) fails.push('"Application error" — server threw during render')
  if (/"digest":"\d+"/.test(html)) fails.push('Next.js error boundary digest — server threw during render')
  if (html.length < 3_000) fails.push(`body too small (${html.length} bytes) — hollow shell render`)
  if (!H1_RE.test(html)) fails.push('no <h1> heading found — page did not render its geo name')
  if (!CONTENT_RE.test(html)) fails.push('no content band found ("homes for sale" / "properties" / "subdivision") — page body is a navigation shell')

  return { label, path, ok: fails.length === 0, status: res.status, bodyLen: html.length, fails }
}

/**
 * Assert that `path` PERMANENT-redirects (301/308) to a Location containing
 * `expectLocationIncludes`, AND that the destination itself resolves (200) —
 * i.e. the marketing slug single-hops to a real page, not a soft-404 and not a
 * redirect-to-404.
 *
 *   1. redirect:'manual' — read the 3xx status + Location directly (a 200 here
 *      is the exact soft-404 regression: the slug rendered a hollow not-found
 *      shell under a 200 instead of redirecting).
 *   2. follow the hop — confirm the canonical destination returns 200, so the
 *      map can never point a slug at a 404.
 */
async function checkRedirect(label, path, expectLocationIncludes) {
  const url = `${BASE}${path}?_smoke=${Date.now()}`
  let res
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': UA }, redirect: 'manual' })
    clearTimeout(t)
  } catch (e) {
    const msg = String(e?.message ?? e)
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('fetch failed')) {
      return { label, path, ok: false, fails: [`Cannot reach ${BASE} — start the server with npm run dev or set GEO_SMOKE_BASE to a running deploy`] }
    }
    return { label, path, ok: false, fails: [`fetch error: ${msg}`] }
  }

  const fails = []
  const status = res.status
  const location = res.headers.get('location') ?? ''
  // 301 (classic permanent) or 308 (App Router permanentRedirect) both count —
  // Google treats them equivalently. A 307/302 (temporary) is a fail: a slug
  // that will never live here should signal a permanent move. A 200 means the
  // redirect did not fire → the hollow soft-404 regression is back.
  if (status !== 301 && status !== 308) {
    fails.push(`HTTP ${status} (expected permanent redirect 301/308 — a marketing slug must not soft-404 as a hollow 200)`)
  }
  if (!location) {
    fails.push('no Location header on the redirect response')
  } else if (!location.includes(expectLocationIncludes)) {
    fails.push(`Location '${location}' does not point to '${expectLocationIncludes}'`)
  }

  // Destination must resolve — follow the hop and assert a real 200 (no
  // redirect-to-404). Only attempt when we actually got a Location.
  let destStatus
  if (location) {
    const destUrl = location.startsWith('http') ? location : `${BASE}${location}`
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
      const destRes = await fetch(destUrl, { signal: ctrl.signal, headers: { 'user-agent': UA }, redirect: 'follow' })
      clearTimeout(t)
      destStatus = destRes.status
      if (destStatus !== 200) {
        fails.push(`destination ${location} → HTTP ${destStatus} (redirect points at a non-200 page)`)
      }
    } catch (e) {
      fails.push(`destination ${location} unreachable: ${String(e?.message ?? e)}`)
    }
  }

  const detail = destStatus ? `${status} → ${location} → ${destStatus}` : `${status} → ${location}`
  return { label, path, ok: fails.length === 0, status, location, detail, fails }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Content cases — page must render H1 + a content band (not a nav shell).
  const contentCases = [
    { label: `school: ${SCHOOL_SLUG}`,      path: `/schools/${SCHOOL_SLUG}` },
    { label: `park: ${PARK_SLUG}`,          path: `/parks/${PARK_SLUG}` },
    { label: `subdivision: ${SUBDIVISION_SLUG}`, path: `/subdivisions/${SUBDIVISION_SLUG}` },
  ]

  // Redirect cases — a marketing-level slug under /subdivisions/* must
  // permanent-redirect to its canonical home, NOT hollow-200 as a soft-404.
  const redirectCases = [
    {
      label: `redirect (neighborhood): /subdivisions/${NEIGHBORHOOD_REDIRECT_SLUG}`,
      path: `/subdivisions/${NEIGHBORHOOD_REDIRECT_SLUG}`,
      expect: '/cities/bend/',
    },
    {
      label: `redirect (community): /subdivisions/${COMMUNITY_REDIRECT_SLUG}`,
      path: `/subdivisions/${COMMUNITY_REDIRECT_SLUG}`,
      expect: '/communities/',
    },
  ]

  const results = await Promise.all([
    ...contentCases.map((c) => check(c.label, c.path)),
    ...redirectCases.map((c) => checkRedirect(c.label, c.path, c.expect)),
  ])
  const failed = results.filter((r) => !r.ok)

  if (JSON_OUT) {
    console.log(JSON.stringify({ base: BASE, results, failCount: failed.length }, null, 2))
    process.exit(failed.length === 0 ? 0 : 1)
  }

  console.log('Geo-detail content gate')
  console.log('=======================')
  console.log(`Base URL: ${BASE}`)
  console.log()

  for (const r of results) {
    if (r.ok) {
      const detail = r.detail ?? (r.location ? `${r.status} → ${r.location}` : `${r.status}, ${r.bodyLen} bytes`)
      console.log(`  OK    ${r.label}  (${detail})`)
    } else {
      console.log(`  FAIL  ${r.label}`)
      for (const f of r.fails) console.log(`         - ${f}`)
    }
  }
  console.log()

  if (failed.length === 0) {
    console.log('All geo-detail pages render H1 + content band (not a navigation shell).')
    process.exit(0)
  }

  console.log(`${failed.length}/${results.length} geo-detail pages FAILED.`)
  console.log('A school/park/subdivision detail page returning HTTP 200 but no H1 or content')
  console.log('means the boundary polygon is missing or the DAL returned empty.')
  process.exit(1)
}

main()
