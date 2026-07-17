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
