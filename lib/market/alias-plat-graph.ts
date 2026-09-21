/**
 * Human-curated MLS-alias → recorded-plat graph.
 *
 * data/subdivision-alias-plats.json is the reviewed evidence map (W1/W2).
 * Membership is exact slug / exact MLS name only — never a prefix (C-21:
 * Triple must not become Triple Ridge).
 *
 * SITE-144: Tetherow and NorthWest Crossing child/nearby doors use
 * visitorChildren, not the GIS phase dump or historically false lookalikes.
 */
import aliasPlats from '@/data/subdivision-alias-plats.json'
import { publishPlatDisplayName } from '@/lib/market/publish-plat-display-name'
import { subdivisionHref } from '@/lib/site/place-href'

export type AliasMemberPlat = {
  slug: string
  name: string
  csnum: string
}

export type AliasVisitorChild = {
  slug: string
  name: string
}

export type AliasLookalike = {
  slug: string
  name: string
}

export type AliasPlatEntry = {
  aliasSlug: string
  mlsName: string
  city: string
  shape: string
  memberPlats: AliasMemberPlat[]
  mlsAliasSlugs?: string[]
  visitorChildren?: AliasVisitorChild[]
  excludedLookalikes?: AliasLookalike[]
  childJoin?: 'visitor-children' | 'member-plats'
}

type NearbyDoor = { name: string; href: string }

type RawFile = { entries?: unknown[] }

const COVERING_SHARE = 0.8
const COVERING_MIN_HITS = 2

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function norm(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseMember(raw: unknown): AliasMemberPlat | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const slug = asString(rec.slug).toLowerCase()
  const name = asString(rec.name)
  const csnum = asString(rec.csnum)
  if (!slug || !name || !csnum) return null
  return { slug, name, csnum }
}

function parseNamed(raw: unknown): { slug: string; name: string } | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const slug = asString(rec.slug).toLowerCase()
  const name = asString(rec.name)
  if (!slug || !name) return null
  return { slug, name }
}

function parseEntry(raw: unknown): AliasPlatEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const aliasSlug = asString(rec.aliasSlug).toLowerCase()
  const mlsName = asString(rec.mlsName)
  const city = asString(rec.city)
  const shape = asString(rec.shape)
  const memberPlats = Array.isArray(rec.memberPlats)
    ? rec.memberPlats.map(parseMember).filter((row): row is AliasMemberPlat => row != null)
    : []
  if (!aliasSlug || !mlsName || !city || !shape || memberPlats.length === 0) return null
  const mlsAliasSlugs = Array.isArray(rec.mlsAliasSlugs)
    ? rec.mlsAliasSlugs.map((s) => asString(s).toLowerCase()).filter(Boolean)
    : undefined
  const visitorChildren = Array.isArray(rec.visitorChildren)
    ? rec.visitorChildren.map(parseNamed).filter((row): row is AliasVisitorChild => row != null)
    : undefined
  const excludedLookalikes = Array.isArray(rec.excludedLookalikes)
    ? rec.excludedLookalikes.map(parseNamed).filter((row): row is AliasLookalike => row != null)
    : undefined
  const childJoin =
    rec.childJoin === 'visitor-children' || rec.childJoin === 'member-plats' ? rec.childJoin : undefined
  return {
    aliasSlug,
    mlsName,
    city,
    shape,
    memberPlats,
    ...(mlsAliasSlugs?.length ? { mlsAliasSlugs } : {}),
    ...(visitorChildren?.length ? { visitorChildren } : {}),
    ...(excludedLookalikes?.length ? { excludedLookalikes } : {}),
    ...(childJoin ? { childJoin } : {}),
  }
}

export const ALIAS_PLAT_ENTRIES: readonly AliasPlatEntry[] = (
  Array.isArray((aliasPlats as RawFile).entries) ? (aliasPlats as RawFile).entries : []
)
  .map(parseEntry)
  .filter((row): row is AliasPlatEntry => row != null)

function slugFromHref(href: string): string {
  return href.split('/').filter(Boolean).at(-1)?.toLowerCase() ?? ''
}

export function findAliasPlatEntry(mlsNameOrSlug: string | null | undefined): AliasPlatEntry | null {
  const needle = norm(mlsNameOrSlug)
  if (!needle) return null
  return (
    ALIAS_PLAT_ENTRIES.find((entry) => {
      if (norm(entry.mlsName) === needle) return true
      if (norm(entry.aliasSlug.replace(/-/g, ' ')) === needle) return true
      if (entry.aliasSlug === needle) return true
      return (entry.mlsAliasSlugs ?? []).some((slug) => slug === needle || norm(slug.replace(/-/g, ' ')) === needle)
    }) ?? null
  )
}

function memberSlugSet(entry: AliasPlatEntry): Set<string> {
  const slugs = new Set<string>([entry.aliasSlug, ...entry.memberPlats.map((plat) => plat.slug)])
  for (const slug of entry.mlsAliasSlugs ?? []) slugs.add(slug)
  for (const child of entry.visitorChildren ?? []) slugs.add(child.slug)
  return slugs
}

export function aliasEntryForSelfSlug(selfSlug: string | null | undefined): AliasPlatEntry | null {
  const slug = asString(selfSlug).toLowerCase()
  if (!slug) return null
  return ALIAS_PLAT_ENTRIES.find((entry) => memberSlugSet(entry).has(slug)) ?? null
}

function lookalikeSlugSet(entry: AliasPlatEntry): Set<string> {
  const slugs = new Set<string>()
  const names = new Set<string>()
  for (const look of entry.excludedLookalikes ?? []) {
    slugs.add(look.slug)
    names.add(norm(look.name))
    const other = findAliasPlatEntry(look.slug) ?? findAliasPlatEntry(look.name)
    if (other && other.aliasSlug !== entry.aliasSlug) {
      slugs.add(other.aliasSlug)
      names.add(norm(other.mlsName))
      for (const plat of other.memberPlats) {
        slugs.add(plat.slug)
        names.add(norm(plat.name))
      }
    }
  }
  return slugs
}

function lookalikeNameSet(entry: AliasPlatEntry): Set<string> {
  const names = new Set<string>()
  for (const look of entry.excludedLookalikes ?? []) {
    names.add(norm(look.name))
    const other = findAliasPlatEntry(look.slug) ?? findAliasPlatEntry(look.name)
    if (other && other.aliasSlug !== entry.aliasSlug) {
      names.add(norm(other.mlsName))
      for (const plat of other.memberPlats) names.add(norm(plat.name))
    }
  }
  return names
}

export function isExcludedLookalikeDoor(
  entry: AliasPlatEntry,
  slug: string | null | undefined,
  name?: string | null,
): boolean {
  const key = asString(slug).toLowerCase()
  const label = norm(name)
  if (key && lookalikeSlugSet(entry).has(key)) return true
  if (label && lookalikeNameSet(entry).has(label)) return true
  return false
}

export function curatedVisitorChildDoors(entry: AliasPlatEntry): NearbyDoor[] {
  const out: NearbyDoor[] = []
  const seen = new Set<string>()
  for (const child of entry.visitorChildren ?? []) {
    const published = publishPlatDisplayName(child.name) ?? child.name.trim()
    const href = subdivisionHref(child.slug)
    if (!published || !href) continue
    if (seen.has(href)) continue
    seen.add(href)
    out.push({ name: published, href })
  }
  return out
}

function coveringVisitorJoinEntry(cards: readonly NearbyDoor[]): AliasPlatEntry | null {
  if (cards.length === 0) return null
  let best: { entry: AliasPlatEntry; hits: number } | null = null
  for (const entry of ALIAS_PLAT_ENTRIES) {
    if (entry.childJoin !== 'visitor-children' || !entry.visitorChildren?.length) continue
    const members = memberSlugSet(entry)
    const lookSlugs = lookalikeSlugSet(entry)
    const lookNames = lookalikeNameSet(entry)
    let hits = 0
    for (const card of cards) {
      const slug = slugFromHref(card.href)
      const label = norm(card.name)
      if (members.has(slug) || lookSlugs.has(slug) || (label && lookNames.has(label))) hits += 1
    }
    if (hits < COVERING_MIN_HITS) continue
    if (hits / cards.length < COVERING_SHARE) continue
    if (!best || hits > best.hits) best = { entry, hits }
  }
  return best?.entry ?? null
}

/**
 * Child doors for a place index. When the card set is a curated parent
 * (Tetherow / NWC), replace the GIS/MLS dump with visitor children and drop
 * lookalikes. Other places keep caller order.
 */
export function joinCuratedChildEntries(cards: readonly NearbyDoor[]): NearbyDoor[] {
  const covering = coveringVisitorJoinEntry(cards)
  if (covering) return curatedVisitorChildDoors(covering)
  return [...cards]
}

/** Nearby rails: if self belongs to a curated parent, drop that parent's lookalikes. */
export function dropCuratedLookalikes(selfSlug: string, cards: readonly NearbyDoor[]): NearbyDoor[] {
  const home = aliasEntryForSelfSlug(selfSlug)
  if (!home?.excludedLookalikes?.length) return [...cards]
  return cards.filter((card) => !isExcludedLookalikeDoor(home, slugFromHref(card.href), card.name))
}
