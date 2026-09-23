/**
 * The /subdivisions A-to-Z directory, as data (visibility audit 2026-09-22
 * SEO-4 / EXP-3; Matt 2026-09-23 plat families).
 *
 * WHAT WAS WRONG. The directory listed 47 registry plats. The sitemap submitted
 * 2,642 plat pages, and 1,716 of them (65%) had no inbound link from any page
 * that is not another plat: no hub, no index, no directory pointed at them.
 *
 * WHAT THIS BUILDS. One group per town. In each town, every multi-phase family
 * under its recorded name with every phase nested beneath it, and every other
 * indexable subdivision by name. Every page the sitemap submits for this route
 * is an anchor here: an indexable plat is either a standalone row, a phase
 * nested under its family, or a family's own row. The directory test pins that.
 *
 * Pure: the page hands in the cached reads it already makes.
 */

import type { V3PlaceDirectoryEntry, V3PlaceDirectoryGroup } from '@/components/site/v3'
import type { IndexableSubdivision } from '@/lib/data/subdivisions/subdivision-index'
import { formatCount } from '@/lib/format/count'
import {
  platFamilyDisplayName,
  platMemberDisplayName,
  type PlatFamily,
} from '@/lib/market/plat-family'
import { publishPlatDisplayName } from '@/lib/market/publish-plat-display-name'

const OTHER_KEY = 'other'

/** "la-pine" -> "La Pine". The label is the town's own name, cased. */
function townLabel(citySlug: string): string {
  if (!citySlug) return 'Elsewhere in Central Oregon'
  return citySlug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Names for siblings. Stripping county file numbers can fold two recorded
 * plats onto one string ("Demaris Acres" and "Demaris Acres See Cs06623");
 * two rows reading the same while opening different pages is worse than a
 * long name, so a collision keeps the published legal label.
 */
function siblingNames(labels: readonly string[]): string[] {
  const short = labels.map((label) => platMemberDisplayName(label))
  const seen = new Map<string, number>()
  for (const n of short) seen.set(n.toLowerCase(), (seen.get(n.toLowerCase()) ?? 0) + 1)
  return short.map((n, i) =>
    (seen.get(n.toLowerCase()) ?? 0) > 1 ? (publishPlatDisplayName(labels[i]) ?? labels[i]!) : n,
  )
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'en-US', { numeric: true, sensitivity: 'base' })

export function buildSubdivisionDirectory(input: {
  indexable: readonly IndexableSubdivision[]
  families: readonly PlatFamily[]
}): V3PlaceDirectoryGroup[] {
  const indexableSlugs = new Set(input.indexable.map((row) => row.slug))

  // A family is listed when its own page or any of its phases is indexable, or
  // its main page is a community page (always indexed on its own route).
  const listed = input.families.filter(
    (family) =>
      family.mainKind === 'community' ||
      indexableSlugs.has(family.slug) ||
      family.members.some((m) => indexableSlugs.has(m.slug)),
  )
  const nested = new Set<string>()
  for (const family of listed) {
    if (family.mainKind === 'subdivision') nested.add(family.slug)
    for (const member of family.members) nested.add(member.slug)
  }

  const byTown = new Map<string, V3PlaceDirectoryEntry[]>()
  const push = (town: string, entry: V3PlaceDirectoryEntry) => {
    const key = town || OTHER_KEY
    const list = byTown.get(key) ?? []
    list.push(entry)
    byTown.set(key, list)
  }

  for (const family of listed) {
    // The head plat (Tetherow Crossing is both a plat and the family page) is
    // the family's own row, never its own child.
    const phases = family.members.filter((m) => m.slug !== family.slug)
    const names = siblingNames(phases.map((m) => m.label))
    const n = family.members.length
    push(family.citySlug, {
      name: platFamilyDisplayName(family),
      href: family.mainHref,
      detail: `${formatCount(n)} recorded phases`,
      childrenLabel: `${formatCount(phases.length)} ${phases.length === 1 ? 'phase' : 'phases'}`,
      children: phases.map((m, i) => ({ name: names[i]!, href: `/subdivisions/${m.slug}` })),
    })
  }

  const standalone = input.indexable.filter((row) => !nested.has(row.slug))
  const standaloneNames = siblingNames(standalone.map((row) => row.name))
  standalone.forEach((row, i) => {
    push(row.citySlug, { name: standaloneNames[i]!, href: `/subdivisions/${row.slug}` })
  })

  const groups: V3PlaceDirectoryGroup[] = []
  for (const [key, entries] of byTown) {
    entries.sort(byName)
    groups.push({
      key,
      label: townLabel(key === OTHER_KEY ? '' : key),
      countLabel: `${formatCount(entries.length)} ${entries.length === 1 ? 'subdivision' : 'subdivisions'}`,
      entries,
    })
  }
  // Biggest town first, then by name; the catch-all group always last.
  groups.sort((a, b) => {
    if (a.key === OTHER_KEY) return 1
    if (b.key === OTHER_KEY) return -1
    return b.entries.length - a.entries.length || a.label.localeCompare(b.label)
  })
  return groups
}

/** Every href the directory renders, children included. The test's and gate's view. */
export function directoryHrefs(groups: readonly V3PlaceDirectoryGroup[]): Set<string> {
  const out = new Set<string>()
  for (const group of groups) {
    for (const entry of group.entries) {
      out.add(entry.href)
      for (const child of entry.children ?? []) out.add(child.href)
    }
  }
  return out
}

/** The §0 trace printed under the directory. */
export const SUBDIVISION_DIRECTORY_TRACE =
  'Deschutes and Crook County recorded subdivisions (public.boundaries). Listed: every subdivision page ' +
  'with a recorded boundary and at least 10 closed sales on record from the regional MLS through Oregon ' +
  'Data Share, and every subdivision the county recorded in phases, under the name the county, the MLS or ' +
  'our community registry records for it, with each recorded phase beneath it. Grouped by the town the ' +
  "county's boundary tree places it in, or the town its sales were filed under."
