/**
 * Nearby place peers for keep-exploring (SITE-128 Look punch, 2026-09-18).
 *
 * A city-wide lifetime-sales dump is not a neighbor list. Rank comes from the
 * GIS ring (plats that touch or sit next to this one), then resort siblings.
 * Closed-count sort never enters this file.
 */

export type NearbyPlacePeer = {
  name: string
  href: string
}

export type NearbyRingPlat = {
  slug: string
  label: string
  rank: number
}

const DEFAULT_CAP = 8

function slugFromHref(href: string): string {
  return href.split('/').filter(Boolean).at(-1) ?? ''
}

/**
 * Name-only doors, caller order preserved, self dropped, cap applied.
 * Empty when nothing nearby is named — the section then omits itself.
 */
export function nearbySubdivisionPeers(input: {
  selfSlug: string
  ring?: { ring: readonly NearbyRingPlat[] } | null
  resortPeers?: ReadonlyArray<{ name: string; href: string }>
  cap?: number
}): NearbyPlacePeer[] {
  const cap = input.cap ?? DEFAULT_CAP
  const self = input.selfSlug.trim()
  const seen = new Set<string>(self ? [self] : [])
  const out: NearbyPlacePeer[] = []

  const push = (slug: string, name: string, href?: string) => {
    const key = slug.trim()
    const label = name.trim()
    if (!key || !label || seen.has(key) || out.length >= cap) return
    seen.add(key)
    out.push({ name: label, href: href ?? `/subdivisions/${key}` })
  }

  const ranked = [...(input.ring?.ring ?? [])].sort((a, b) => a.rank - b.rank)
  for (const row of ranked) {
    push(row.slug, row.label)
  }
  for (const peer of input.resortPeers ?? []) {
    push(slugFromHref(peer.href), peer.name, peer.href)
  }
  return out
}

/** Deduped name-only child cards. First occurrence wins; counts never attach.
 *  Same visitor name on two hrefs is a twin (River Woods) — keep the first. */
export function nameOnlyChildEntries(
  groups: ReadonlyArray<ReadonlyArray<{ name: string; href: string }>>,
): NearbyPlacePeer[] {
  const seen = new Set<string>()
  const out: NearbyPlacePeer[] = []
  for (const group of groups) {
    for (const row of group) {
      const href = row.href.trim()
      const name = row.name.trim()
      const nameKey = `name:${name.toLowerCase().replace(/\s+/g, ' ')}`
      if (!href || !name || seen.has(href) || seen.has(nameKey)) continue
      seen.add(href)
      seen.add(nameKey)
      out.push({ name, href })
    }
  }
  return out
}
