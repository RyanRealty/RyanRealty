/**
 * community-own-names — which `subdivision_aliases` entries name the COMMUNITY
 * ITSELF rather than a subdivision inside it.
 *
 * WHY THIS EXISTS. `subdivision_aliases` in data/resort-communities.json does
 * double duty: it is the set of MLS `SubdivisionName` values that mean this
 * community (which is what makes the alias-aware count, the market scope, and
 * the CMA resort guard work), AND every entry that is not the community's own
 * name is rendered as a literal membership claim — "Subdivisions in {name}".
 *
 * Three renderers had their own copy of the same one-line filter
 * (`a !== name`): KbResortOverview's alias chips, place-knowledge's child-plat
 * doors, and peerPlatsForResort. One line each, three chances to disagree.
 *
 * The rename that forced the issue: Juniper Preserve. The hospitality brand
 * renamed from Pronghorn in October 2022, but the recorded plats, the HOA
 * (PRONGHORN COMMUNITY ASSOC INC), the streets, and — decisively — the MLS
 * `SubdivisionName` are all still "Pronghorn", with zero MLS rows anywhere
 * containing "preserve". So "Pronghorn" MUST stay a live alias or the community
 * loses every one of its listings. But with the label now "Juniper Preserve",
 * the old `a !== name` filter would have published "Pronghorn" as a CHILD
 * SUBDIVISION of Juniper Preserve — a place claiming its own former self as a
 * neighbourhood. That is the same class of false membership claim the
 * 2026-08-26 audit removed 23 of (CLAUDE.md §0).
 *
 * A former label is NOT a redirect-only relic: it stays in
 * `subdivision_aliases` and keeps matching listings. It is only hidden from the
 * membership rendering.
 */

/** Registry shape this reads. `former_labels` is optional and usually absent. */
export type CommunityNaming = {
  label: string
  former_labels?: readonly string[]
}

function norm(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Every name that IS this community: its current label plus any former label.
 * Lower-cased and trimmed, ready for membership tests.
 */
export function communityOwnNames(entry: CommunityNaming): ReadonlySet<string> {
  const names = new Set<string>([norm(entry.label)])
  for (const former of entry.former_labels ?? []) {
    const key = norm(former)
    if (key) names.add(key)
  }
  return names
}

/**
 * The aliases that name a subdivision INSIDE the community — i.e. the only ones
 * a "Subdivisions in X" heading may honestly list. Drops the community's own
 * current and former names, preserving input order.
 */
export function childAliasesOf(
  entry: CommunityNaming,
  aliases: readonly string[] | undefined,
): string[] {
  const own = communityOwnNames(entry)
  return (aliases ?? []).filter((alias) => !own.has(norm(alias)))
}

/** True when `alias` is the community's own name (current or former). */
export function isOwnCommunityName(entry: CommunityNaming, alias: string): boolean {
  return communityOwnNames(entry).has(norm(alias))
}
