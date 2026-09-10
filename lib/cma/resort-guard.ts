/**
 * Resort-community comp guard (Matt 2026-08-05: "if one of the comps comes
 * out in Crosswaters or Caldera, those homes are substantially more of a
 * premium, but somehow they get factored in. We never want to include homes
 * like that. That's a no-brainer.")
 *
 * The rule is SYMMETRIC: a resort-community sale prices a resort-community
 * home, and nothing else. A Caldera Springs comp never prices a plain La Pine
 * subject (premium contamination inflates it), and a plain-town comp never
 * prices a Caldera subject (it would deflate it). Same resort on both sides,
 * or no resort on either side.
 *
 * Membership comes from the ONE resort registry
 * (data/resort-communities.json, §7 canon) via exact subdivision-alias match,
 * lower-cased — the same matching the site's community pages use.
 */
import registry from '@/data/resort-communities.json'

type Community = { slug: string; is_resort?: boolean; subdivision_aliases?: string[] }

let aliasMap: Map<string, string> | null = null

function buildAliasMap(): Map<string, string> {
  const m = new Map<string, string>()
  for (const c of (registry as { communities: Community[] }).communities) {
    if (!c.is_resort) continue
    for (const alias of c.subdivision_aliases ?? []) {
      m.set(alias.trim().toLowerCase(), c.slug)
    }
  }
  return m
}

let anyCommunityMap: Map<string, string> | null = null

function buildAnyCommunityMap(): Map<string, string> {
  const m = new Map<string, string>()
  for (const c of (registry as { communities: Community[] }).communities) {
    for (const alias of c.subdivision_aliases ?? []) {
      m.set(alias.trim().toLowerCase(), c.slug)
    }
    m.set(c.slug.replace(/-/g, ' '), c.slug)
  }
  return m
}

/**
 * THE PARENT A PLAT SITS INSIDE (Matt 2026-09-09): "if that subdivision lies
 * within a planned community, a golf community, or a district neighborhood,
 * then we'll constrain the search within that. Basically, go up a parent
 * level." Every registry community counts here, not only the resorts — the
 * question this answers is containment, not premium. Membership is the same
 * recorded-plat alias set the resort guard and the community pages use.
 */
export function communitySlugForSubdivision(subdivision: string | null | undefined): string | null {
  if (!subdivision?.trim()) return null
  anyCommunityMap ??= buildAnyCommunityMap()
  const key = subdivision.trim().toLowerCase()
  const exact = anyCommunityMap.get(key)
  if (exact) return exact
  const stripped = key.replace(/\s+phase\s+\w+$/i, '').trim()
  if (stripped && stripped !== key) return anyCommunityMap.get(stripped) ?? null
  return null
}

/** True when the community is a resort or golf community, not a plain platted one. */
export function isResortCommunity(slug: string | null | undefined): boolean {
  if (!slug) return false
  return (registry as { communities: Community[] }).communities.some((c) => c.slug === slug && c.is_resort === true)
}

/** The resort community a subdivision name belongs to, or null. */
export function resortSlugForSubdivision(subdivision: string | null | undefined): string | null {
  if (!subdivision?.trim()) return null
  aliasMap ??= buildAliasMap()
  const key = subdivision.trim().toLowerCase()
  const exact = aliasMap.get(key)
  if (exact) return exact
  // County / RPR legal descriptions append a phase ("Caldera Springs Phase One").
  const stripped = key.replace(/\s+phase\s+\w+$/i, '').trim()
  if (stripped && stripped !== key) return aliasMap.get(stripped) ?? null
  return null
}

/**
 * True when the pair may price each other: both in the SAME resort community,
 * or neither in any.
 */
export function resortCommunityCompatible(
  subjectSubdivision: string | null | undefined,
  compSubdivision: string | null | undefined,
): boolean {
  const s = resortSlugForSubdivision(subjectSubdivision)
  const c = resortSlugForSubdivision(compSubdivision)
  return s === c
}
