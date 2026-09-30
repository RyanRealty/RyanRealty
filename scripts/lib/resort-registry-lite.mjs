/**
 * Derives the client-safe "lite" resort registry from the source of truth,
 * data/resort-communities.json.
 *
 * WHY THIS EXISTS. The source registry is ~50 KB because it carries the prose
 * and finance detail of every sub-neighborhood (HOA figures, character copy,
 * image hints, boundary notes). A handful of client-reachable modules
 * (search filters, the saved-search model, the CRM criteria editor, the
 * community naming pair) only ever needed each community's name, city and
 * aliases, but they imported the whole file. Turbopack then emitted that
 * 44 KB JSON module into 26 separate route chunks: 1.15 MB of the 10.93 MB
 * client bundle, and the reason a 18 KB registry edit added 0.42 MB and
 * failed ci:bundle-budget on PR #386.
 *
 * The lite file keeps exactly the naming/lookup fields. Server code that
 * needs the prose keeps reading the source registry through
 * lib/data/communities/registry.ts. Nothing client-reachable may import the
 * source file (ci:server-only-imports, the transitive rule).
 *
 * Regenerate after ANY edit to data/resort-communities.json:
 *   node scripts/build-resort-communities-lite.mjs
 * ci:resort-definitions fails if the committed lite file drifts.
 */

/** Source-of-truth path and the generated lite path, relative to repo root. */
export const RESORT_REGISTRY_PATH = 'data/resort-communities.json'
export const RESORT_REGISTRY_LITE_PATH = 'data/resort-communities.lite.json'
export const RESORT_REGISTRY_LITE_GENERATOR = 'scripts/build-resort-communities-lite.mjs'

function pickSubNeighborhood(sub) {
  const out = { slug: sub.slug, name: sub.name }
  if (Array.isArray(sub.mls_aliases) && sub.mls_aliases.length > 0) out.mls_aliases = sub.mls_aliases
  return out
}

function pickCommunity(c) {
  const out = {
    slug: c.slug,
    label: c.label,
    city: c.city,
    city_slug: c.city_slug,
    is_resort: c.is_resort === true,
    subdivision_aliases: Array.isArray(c.subdivision_aliases) ? c.subdivision_aliases : [],
  }
  if (Array.isArray(c.former_labels) && c.former_labels.length > 0) out.former_labels = c.former_labels
  if (Array.isArray(c.mls_cities) && c.mls_cities.length > 0) out.mls_cities = c.mls_cities
  out.sub_neighborhoods = Array.isArray(c.sub_neighborhoods)
    ? c.sub_neighborhoods.map(pickSubNeighborhood)
    : []
  return out
}

/** @param {{ communities: any[] }} full parsed data/resort-communities.json */
export function deriveResortRegistryLite(full) {
  if (!full || !Array.isArray(full.communities)) {
    throw new Error(`${RESORT_REGISTRY_PATH}: missing or non-array "communities"`)
  }
  return {
    generated_from: `${RESORT_REGISTRY_PATH} by ${RESORT_REGISTRY_LITE_GENERATOR}`,
    communities: full.communities.map(pickCommunity),
  }
}

/** The exact bytes the generator writes (and the gate compares against). */
export function serializeResortRegistryLite(lite) {
  return JSON.stringify(lite, null, 2) + '\n'
}
