/**
 * Pure address→slug helper, dependency-free so any runtime (server, edge,
 * client bundle graph) can import it without dragging node:crypto along
 * (lib/cma-request re-exports it for back-compat; importing cma-request pulls
 * the GA4 measurement-protocol module, which broke a Turbopack prod build
 * when the outreach DAL reached it — 2026-07-11).
 *
 * Slugify an address into `cma-<short-form>`, max 40 chars, kebab-case.
 * Stable for the same address — used as the public `public.cmas.slug`.
 */
export function slugifyAddress(address: string): string {
  const base = address
    .toLowerCase()
    .replace(/[,]/g, ' ')
    .replace(/\b(road|rd|street|st|avenue|ave|drive|dr|lane|ln|court|ct|place|pl|boulevard|blvd|highway|hwy|parkway|pkwy|circle|cir|trail|trl|terrace|ter|way|loop)\b/gi, '')
    .replace(/\b(oregon|or|bend|97701|97702|97703|97703|97707|97712|97739|97759|97760|97741)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
  const slug = `cma-${base}`
  return slug.length > 40 ? slug.slice(0, 40).replace(/-+$/g, '') : slug
}

// ── CMA slug versions ────────────────────────────────────────────────────────
// One address can carry MORE than one CMA document over time: a delivered CMA
// is a client-facing record whose /cma/[slug] link must never break, so a new
// request for the same address opens a NEW versioned slug instead of clobbering
// the existing row (adversarial review 2026-07-17 HIGH — the upsert-by-slug
// clobber class). Version 1 is the bare base slug; later documents append --vN.
//
// The double hyphen is load-bearing: slugifyAddress collapses hyphen runs
// (`-+` → `-`), so no address-derived slug can ever contain `--`. A single
// `-vN` tail would collide with real addresses ("… Unit V2" slugs to `…-v2`)
// and cross-wire two properties' version chains.

const CMA_VERSION_SUFFIX_RE = /--v(\d+)$/

/** Slug for the Nth CMA document on one address (v1 = the bare base slug). */
export function cmaSlugForVersion(baseSlug: string, version: number): string {
  return version <= 1 ? baseSlug : `${baseSlug}--v${version}`
}

/** The base (unversioned) slug for any CMA slug. */
export function cmaSlugBase(slug: string): string {
  return slug.replace(CMA_VERSION_SUFFIX_RE, '')
}

/** The version number encoded in a CMA slug (1 when unversioned). */
export function cmaSlugVersion(slug: string): number {
  const m = CMA_VERSION_SUFFIX_RE.exec(slug)
  return m ? Number(m[1]) : 1
}

const SLUG_DIRECTIONALS = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'])

function formatSlugDirectional(token: string): string {
  switch (token) {
    case 'n':
      return 'N'
    case 's':
      return 'S'
    case 'e':
      return 'E'
    case 'w':
      return 'W'
    case 'ne':
      return 'NE'
    case 'nw':
      return 'NW'
    case 'se':
      return 'SE'
    case 'sw':
      return 'SW'
    default:
      return token.toUpperCase()
  }
}

/** `cma-648-se-douglas` → `SE`. Bare `cma-648-douglas` → null. */
export function streetDirectionalFromCmaSlug(slug: string): string | null {
  const parts = cmaSlugBase(slug.trim().toLowerCase()).replace(/^cma-/, '').split('-')
  if (parts.length >= 3 && /^\d+$/.test(parts[0] ?? '') && SLUG_DIRECTIONALS.has(parts[1] ?? '')) {
    return formatSlugDirectional(parts[1]!)
  }
  return null
}

/**
 * Put a slug-encoded directional back on a stripped display address.
 * "648 Douglas, Bend, OR 97702" + `cma-648-se-douglas` → "648 SE Douglas, Bend, OR 97702".
 */
export function applySlugStreetDirectional(address: string, slug: string): string {
  const dir = streetDirectionalFromCmaSlug(slug)
  if (!dir) return address
  const text = address.trim()
  if (!text) return address
  const [street, ...rest] = text.split(',')
  const tokens = (street ?? '').trim().split(/\s+/).filter(Boolean)
  if (tokens.length < 2) return address
  if (tokens.some((t) => SLUG_DIRECTIONALS.has(t.toLowerCase()))) return address
  const restored = `${tokens[0]} ${dir} ${tokens.slice(1).join(' ')}`
  return rest.length > 0 ? `${restored}, ${rest.map((s) => s.trim()).join(', ')}` : restored
}

/** Persist the subject line with the slug-encoded directional still on it. */
export function formatPersistedCmaAddress(opts: {
  streetAddress: string
  city: string
  postalCode?: string | null
  slug: string
}): string {
  const zip = opts.postalCode?.trim() ? ` ${opts.postalCode.trim()}` : ''
  const city = opts.city.trim()
  const line = city
    ? `${opts.streetAddress.trim()}, ${city}, OR${zip}`.trim()
    : opts.streetAddress.trim()
  return applySlugStreetDirectional(line, opts.slug)
}

/**
 * From a set of cmas rows, the highest-version document for one address —
 * the row every address-keyed reader (outreach worklist, dashboards, send
 * rails) should treat as "the CMA for this address".
 */
export function pickLatestCmaVersion<T extends { slug: string }>(
  rows: readonly T[],
  baseSlug: string,
): T | null {
  let best: T | null = null
  let bestVersion = 0
  for (const row of rows) {
    if (row.slug !== baseSlug && cmaSlugBase(row.slug) !== baseSlug) continue
    const version = cmaSlugVersion(row.slug)
    if (version > bestVersion) {
      best = row
      bestVersion = version
    }
  }
  return best
}
