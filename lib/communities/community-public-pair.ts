/**
 * Public name + URL pairing for registry communities.
 *
 * The durable registry slug is a data key (geo_snapshot_mv, market_stats_cache,
 * CMA resort guard). The visitor door is the public name. Those two stay the
 * same string for every community except a rebrand.
 *
 * Juniper Preserve (W5 + SITE-136): MLS, HOA, plats, and geo_key stay
 * `pronghorn`. The hospitality brand and every public label are Juniper
 * Preserve. One live URL: `/communities/juniper-preserve`. `/communities/pronghorn`
 * 308s there. Do not invent a second live URL, and do not paint "Juniper
 * Preserve" on a `/communities/pronghorn` href (or the reverse).
 *
 * Edge-safe: committed JSON + string work only.
 */

import registry from '@/data/resort-communities.json' assert { type: 'json' }

export type CommunityNamingEntry = {
  slug: string
  label: string
  former_labels?: readonly string[]
  subdivision_aliases?: readonly string[]
}

export type CommunityPublicPair = {
  displayName: string
  publicSlug: string
  durableSlug: string
  href: string
}

type RegistryFile = { communities: CommunityNamingEntry[] }

const ENTRIES = (registry as unknown as RegistryFile).communities

/** Byte-identical to the Edge slugify in canonical-community-slug.ts. */
export function slugifyCommunityName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'unknown'
  )
}

function labelRoundTrips(label: string, slug: string): boolean {
  return slug.replace(/-/g, ' ') === label.trim().toLowerCase()
}

/**
 * Visitor URL slug for a registry entry. Prefer slugify(label) when the label
 * survives slugify → spaces (so the path and the name agree). Fall back to the
 * durable slug when the label cannot be a path (apostrophe, period).
 */
export function publicCommunitySlug(entry: CommunityNamingEntry): string {
  const fromLabel = slugifyCommunityName(entry.label)
  if (fromLabel !== 'unknown' && labelRoundTrips(entry.label, fromLabel)) {
    return fromLabel
  }
  return entry.slug.trim().toLowerCase()
}

export function communityPublicPair(entry: CommunityNamingEntry): CommunityPublicPair {
  const publicSlug = publicCommunitySlug(entry)
  return {
    displayName: entry.label.trim(),
    publicSlug,
    durableSlug: entry.slug.trim().toLowerCase(),
    href: `/communities/${publicSlug}`,
  }
}

function entryKeys(entry: CommunityNamingEntry): string[] {
  const keys = [
    entry.slug,
    publicCommunitySlug(entry),
    slugifyCommunityName(entry.label),
    entry.label,
    ...(entry.former_labels ?? []),
    ...(entry.subdivision_aliases ?? []),
  ]
  return keys.map((value) => value.trim().toLowerCase()).filter(Boolean)
}

const ENTRY_BY_KEY: ReadonlyMap<string, CommunityNamingEntry> = (() => {
  const map = new Map<string, CommunityNamingEntry>()
  for (const entry of ENTRIES) {
    for (const key of entryKeys(entry)) {
      if (!map.has(key)) map.set(key, entry)
      const dashed = slugifyCommunityName(key)
      if (dashed !== 'unknown' && !map.has(dashed)) map.set(dashed, entry)
    }
  }
  return map
})()

export function registryCommunityByAnyKey(
  raw: string | null | undefined,
): CommunityNamingEntry | null {
  const key = (raw ?? '').trim().toLowerCase()
  if (!key) return null
  return ENTRY_BY_KEY.get(key) ?? ENTRY_BY_KEY.get(slugifyCommunityName(key)) ?? null
}

/** Durable registry slug (geo key). Unknown input is returned trimmed. */
export function resolveDurableCommunitySlug(raw: string): string {
  const key = raw.trim().toLowerCase()
  return registryCommunityByAnyKey(key)?.slug ?? key
}

/** Visitor URL slug. Unknown input is returned trimmed. */
export function resolvePublicCommunitySlug(raw: string): string {
  const key = raw.trim().toLowerCase()
  const entry = registryCommunityByAnyKey(key)
  return entry ? publicCommunitySlug(entry) : key
}

/**
 * Name + href for a rail / nav / place-link input. Null when the string is
 * not a registered community (ordinary plats stay on their own doors).
 */
export function communityPublicPairForPlace(input: {
  slug?: string | null
  name?: string | null
}): CommunityPublicPair | null {
  const entry =
    registryCommunityByAnyKey(input.slug) ?? registryCommunityByAnyKey(input.name)
  return entry ? communityPublicPair(entry) : null
}

/** True when slugify(displayName) is the live /communities path. */
export function communityPairAgrees(pair: CommunityPublicPair): boolean {
  const fromName = slugifyCommunityName(pair.displayName)
  return fromName === pair.publicSlug && pair.href === `/communities/${pair.publicSlug}`
}

/**
 * Slugs the edge may serve on /communities/[slug] before a 308 hop.
 * Durable keys stay allowed so /communities/pronghorn can 308; public slugs
 * stay allowed so the live door is not a hard 404.
 */
export function allowedCommunityUrlSlugs(): string[] {
  const slugs = new Set<string>()
  for (const entry of ENTRIES) {
    const durable = entry.slug.trim().toLowerCase()
    if (durable) slugs.add(durable)
    slugs.add(publicCommunitySlug(entry))
  }
  return [...slugs]
}
