import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The lead-flow report (/admin/reports/lead-flow) is where spend is judged.
 * Its LEAD_SURFACES rows went stale once already: after the /lp pages 308'd on
 * 2026-09-06 they kept naming paths that redirect, GA4 variants nothing sends
 * and CRM sources nothing writes, and every row still rendered a number. This
 * reads the registry and fails when a row stops matching the code.
 */
const REPORT = 'app/admin/(protected)/reports/lead-flow/page.tsx'
const report = readFileSync(REPORT, 'utf8')
const registry = report.slice(report.indexOf('const LEAD_SURFACES'), report.indexOf('\n]\n', report.indexOf('const LEAD_SURFACES')))

const listOf = (key) =>
  [...registry.matchAll(new RegExp(`${key}: \\[([^\\]]*)\\]`, 'g'))].flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]))
const variants = listOf('lp_variants')
const prefixes = listOf('path_prefixes')
const sources = [...registry.matchAll(/assignment_source: '([^']+)'/g)].map((m) => m[1])

function sourceFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p))
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && p !== REPORT) out.push(p)
  }
  return out
}
const corpus = [...sourceFiles('app'), ...sourceFiles('lib')].map((f) => readFileSync(f, 'utf8')).join('\n')
const lines = corpus.split('\n')
/** A literal on a line that sets the field, not in a map, a list or a comment that merely names it. */
const setOnLine = (field, value) => lines.some((l) => field.test(l) && l.includes(`'${value}'`) && !/^\s*(\*|\/\/)/.test(l))

/** Variants built from a template rather than written as a literal, with the template that builds them. */
const TEMPLATED = {
  'lead-landing-buyer': 'lead-landing-${input.audience}',
  'page-cta-general': "page-cta-${input.leadType ?? 'general'}",
}

// next.config.ts redirects() (not headers(), whose sources carry cache rules) plus
// middleware's legacy map (data/legacy-redirects.json, path -> destination).
const nextConfig = readFileSync('next.config.ts', 'utf8')
const redirectsBlock = nextConfig.slice(nextConfig.indexOf('async redirects()'), nextConfig.indexOf('async rewrites()'))
const redirectSources = [
  ...[...redirectsBlock.matchAll(/source: '([^']+)'/g)].map((m) => m[1]),
  ...Object.entries(JSON.parse(readFileSync('data/legacy-redirects.json', 'utf8')))
    .filter(([from, to]) => from !== to) // '/contact' -> '/contact' is an identity entry, not a redirect
    .map(([from]) => from),
]

describe('lead-flow LEAD_SURFACES matches the live code', () => {
  it('the registry and the redirect lists parse', () => {
    expect(redirectSources).toContain('/lp/seller-home-value')
    expect(variants.length).toBeGreaterThan(5)
    expect(sources.length).toBeGreaterThan(3)
    expect(prefixes.length).toBeGreaterThan(3)
  })

  it('every GA4 variant is one a door still sends', () => {
    const missing = variants.filter((v) => (TEMPLATED[v] ? !corpus.includes(TEMPLATED[v]) : !setOnLine(/lp_variant/, v)))
    expect(missing).toEqual([])
  })

  it('every CRM source is one a door still writes', () => {
    // Written, not read: `source: 'x'`, or a door constant `X_SOURCE = 'x'` / `X_DOOR = 'x'`.
    // (A comparison such as source === 'expired-lp' is a reader of a retired door.)
    const written = (v) => lines.some((l) => !/^\s*(\*|\/\/)/.test(l) && (l.includes(`source: '${v}'`) || new RegExp(`_(SOURCE|DOOR)\\s*=\\s*'${v}'`).test(l)))
    expect(sources.filter((s) => !written(s))).toEqual([])
  })

  it('no row counts sessions on a path that redirects', () => {
    const redirecting = prefixes.filter((p) =>
      p.endsWith('/') ? redirectSources.some((r) => r.startsWith(p) && r.includes(':path')) : redirectSources.includes(p),
    )
    expect(redirecting).toEqual([])
  })
})
