/**
 * What a /subdivisions/[slug] page prints about the plat FAMILY it belongs to
 * (Matt 2026-09-23; visibility audit 2026-09-22 SEO-7, EXP-3, EXP-7, VOICE-8).
 *
 * A family's main page owns the family's name and lists every phase with a
 * link. A phase page names its family in the breadcrumb and in a visible link
 * under its H1, and titles itself as a PART of the family, so the one page a
 * reader means is the one that carries the name in its title. Pure: the page
 * hands in what it read, this module returns strings and rows.
 *
 * Visitor copy says "phase", the reader's word, and never "plat".
 */

import type { V3PlaceIndexEntry } from '@/components/site/v3'
import {
  platFamilyDisplayName,
  platMemberDisplayName,
  type PlatFamily,
  type PlatFamilyRole,
} from '@/lib/market/plat-family'
import { platPageTitle } from './plat-title'

export type FamilyCrumb = { label: string; href: string }

/** The crumb a phase page puts between its city/community and its own name. */
export function familyCrumb(role: PlatFamilyRole | null): FamilyCrumb | null {
  if (!role || role.role !== 'member') return null
  return { label: platFamilyDisplayName(role.family), href: role.family.mainHref }
}

/**
 * Insert the family crumb before the page's own (unlinked) crumb. A trail
 * that already links the same page (a phase of Tetherow whose registry
 * community crumb is /communities/tetherow) is left as it is.
 */
export function withFamilyCrumb<T extends { label: string; href?: string }>(
  trail: readonly T[],
  crumb: FamilyCrumb | null,
): Array<T | FamilyCrumb> {
  if (!crumb) return [...trail]
  if (trail.some((c) => c.href === crumb.href)) return [...trail]
  const out: Array<T | FamilyCrumb> = [...trail]
  const last = out.length > 0 && !out[out.length - 1]?.href ? out.length - 1 : out.length
  out.splice(last, 0, crumb)
  return out
}

/**
 * The document title. A family's main page and a plat with no family keep the
 * place-first "{Name} homes for sale · {City}, Oregon" (Matt 2026-09-17). A
 * phase does NOT bid for "{Family} homes for sale": its title names itself as a
 * part of the family, so search sees one page per family name (gsc-trend-4:
 * 'brasada ranch' impressions spread over 65 URLs). County land-use file
 * numbers never reach a title (SEO-7); the legal label stays in the body.
 */
export function platDocumentTitle(input: {
  displayName: string
  cityName: string | null
  role: PlatFamilyRole | null
}): string {
  if (input.role?.role === 'member') {
    const family = platFamilyDisplayName(input.role.family)
    const phase = platMemberDisplayName(input.role.member.label)
    const city = (input.cityName ?? '').trim()
    const withCity = city && !/^central oregon$/i.test(city) ? `, ${city}` : ''
    return `${phase} · part of ${family}${withCity}`
  }
  return platPageTitle(input.displayName, input.cityName)
}

/** The meta description for a phase, in the same subordinate voice. */
export function platPhaseDescription(role: PlatFamilyRole | null, cityName: string | null): string | null {
  if (!role || role.role !== 'member') return null
  const family = platFamilyDisplayName(role.family)
  const phase = platMemberDisplayName(role.member.label)
  const where = cityName && !/^central oregon$/i.test(cityName) ? ` in ${cityName}` : ''
  return `${phase} is one of the ${role.family.members.length} recorded phases of ${family}${where}. Boundary map, homes for sale, and what sold here.`
}

/** The visible line under a phase page's H1, with its link up. */
export function familyMemberLine(role: PlatFamilyRole | null): {
  lead: string
  linkLabel: string
  href: string
  tail: string
} | null {
  if (!role || role.role !== 'member') return null
  const family = platFamilyDisplayName(role.family)
  const n = role.family.members.length
  return {
    lead: 'One of the ',
    linkLabel: `${n} recorded phases of ${family}`,
    href: role.family.mainHref,
    tail: '.',
  }
}

/**
 * The phase index on a family's main page: every recorded phase, each a link,
 * each carrying its own lifetime closed count from subdivision_plat_closed_mv
 * (null prints nothing, §0). The display name drops the county file numbers;
 * the legal label is each phase page's own H1 business.
 */
export function familyPhaseEntries(family: PlatFamily): V3PlaceIndexEntry[] {
  return family.members.map((member) => ({
    key: member.slug,
    name: platMemberDisplayName(member.label),
    href: `/subdivisions/${member.slug}`,
    count: member.closedCount > 0 ? member.closedCount : null,
  }))
}

/** The §0 trace under the phase index. */
export function familyPhaseTrace(familyName: string, phases: number): string {
  return (
    `Deschutes and Crook County recorded subdivisions: the ${phases} recorded phases, units, ` +
    `additions and replats whose county names share the name ${familyName}. Each count is that ` +
    `phase's own lifetime closed sales from the regional MLS through Oregon Data Share, a sale ` +
    `counted when its coordinates fall inside the phase's recorded boundary or it was filed under ` +
    `the phase's name. Every property type. A replat's sales also sit inside the phase it ` +
    `replatted, so these counts are not added into one total here.`
  )
}

/** The sentence under the family's map, saying what the outline is. */
export function familyOutlineNote(familyName: string, phases: number): string {
  return `The outline is the ${phases} recorded phases of ${familyName} joined into one shape, from Deschutes County GIS recorded subdivisions.`
}

/** The §0 trace for the family's own lifetime closed count and its by-year series. */
export function familyClosedTrace(familyName: string, phases: number): string {
  return (
    `regional MLS through Oregon Data Share, every closed sale whose recorded coordinates fall ` +
    `inside the outline of the ${phases} recorded phases of ${familyName}, each sale counted once ` +
    `however many phases overlap it. Lifetime, every property type; the by-year series is the same ` +
    `set grouped by the year of the close. Counts only: a closed-price statistic at this grain is withheld.`
  )
}

/**
 * VOICE-8. "Homes for sale in {place}" means ONE counted set on this page: the
 * single-family homes the market figures and the asking-price bands count.
 * The map's own count covers every unsold listing of every kind inside the
 * boundary (townhomes, tenancy-in-common fractions, lots), so it is said in
 * those words and never under the phrase the single-family count owns.
 */
export function platAtlasClaim(input: {
  displayName: string
  mixed: boolean
  listedCount: number
  houseCount: number | null
  /** Type labels present among the unsold marks, in the map key's order. */
  typeLabels: readonly string[]
}): string {
  const { displayName, mixed, listedCount, houseCount } = input
  if (mixed && listedCount > 0) {
    const kinds = input.typeLabels.map((label) => label.toLowerCase())
    const list =
      kinds.length > 1 ? `${kinds.slice(0, -1).join(', ')} and ${kinds[kinds.length - 1]}` : (kinds[0] ?? '')
    const noun = listedCount === 1 ? 'listing' : 'listings'
    const kindsClause = list ? `: ${list}` : ''
    return `${listedCount.toLocaleString('en-US')} active and pending ${noun} of every kind inside the ${displayName} boundary${kindsClause}. Toggle a type on the map.`
  }
  if (houseCount != null && houseCount > 0) {
    return `${houseCount.toLocaleString('en-US')} ${houseCount === 1 ? 'home' : 'homes'} for sale in ${displayName}.`
  }
  return `Homes for sale in ${displayName}.`
}
