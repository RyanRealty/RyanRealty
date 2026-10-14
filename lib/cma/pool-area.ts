/**
 * One geography for homes for sale, under contract, and off the market unsold
 * (Matt 2026-10-10). The subject's recorded plat, every plat that touches it,
 * and the next row only when those two still hold fewer than five homes that
 * pass the hard walls. Year built never removes a home. Price is not a wall.
 */

import { formatDate } from '@/lib/format/date'
import { compAreaIn, type CompArea } from '@/lib/pricing/comp-area'
import { countWord } from '@/lib/pricing/estimate'
import type { PoolPlace } from '@/lib/pricing/best-pool'

/** A query ceiling. Not a membership rule. The rank decides price. */
export const POOL_QUERY_LO = 1
export const POOL_QUERY_HI = 50_000_000
export const POOL_CAP = 5
export const POOL_EXPIRED_MONTHS = 36

export type PoolPlat = { slug: string; label: string }

export type PoolMeta = {
  ownSlugs: string[]
  adjacentSlugs: string[]
  nextSlugs: string[]
  ownLabel: string
  adjacentLabels: string[]
  nextLabels: string[]
  openedNext: boolean
}

const CONDO_PLAT = /\bcondominiums?\b|\bcondos?\b/i

export function isCondoPlat(label: string, slug?: string | null): boolean {
  const text = `${label} ${(slug ?? '').replace(/-/g, ' ')}`
  return CONDO_PLAT.test(text)
}

export function subjectIsCondo(propertySubType: string | null | undefined): boolean {
  return /\bcondo/i.test(propertySubType ?? '')
}

/** House subjects do not take condo plats as comps. The subject's own plat stays. No cap. */
export function keepHousePoolPlats<T extends { slug: string; label?: string | null }>(
  plats: readonly T[],
  propertySubType: string | null | undefined,
  ownSlug: string,
): T[] {
  if (subjectIsCondo(propertySubType)) return [...plats]
  const own = ownSlug.trim()
  return plats.filter((plat) => plat.slug === own || !isCondoPlat(plat.label ?? plat.slug, plat.slug))
}

export function platLabelFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Absolute whole-count gap. Unknown or non-positive on either side is 0. */
export function wholeCountGap(subject: number | null | undefined, candidate: number | null | undefined): number {
  if (subject == null || candidate == null) return 0
  if (!Number.isFinite(subject) || !Number.isFinite(candidate) || subject <= 0 || candidate <= 0) return 0
  return Math.abs(Math.floor(subject) - Math.floor(candidate))
}

/** Full baths when both sides carry a positive full count, otherwise the totals. */
export function bathCountGap(
  subject: { baths?: number | null; bathsFull?: number | null },
  candidate: { baths?: number | null; bathsFull?: number | null },
): number {
  const subjectFull = subject.bathsFull
  const candidateFull = candidate.bathsFull
  if (
    subjectFull != null &&
    candidateFull != null &&
    subjectFull > 0 &&
    candidateFull > 0 &&
    Number.isFinite(subjectFull) &&
    Number.isFinite(candidateFull)
  ) {
    return wholeCountGap(subjectFull, candidateFull)
  }
  return wholeCountGap(subject.baths, candidate.baths)
}

export function poolWhere(input: { ownLabel: string; openedNext: boolean; negative?: boolean }): string {
  const own = input.ownLabel.trim() || 'this plat'
  if (!input.openedNext) {
    return input.negative ? `${own} or the plats that touch it` : `${own} and the plats that touch it`
  }
  return input.negative
    ? `${own}, the plats that touch it, or the plats that touch those`
    : `${own}, the plats that touch it, and the plats that touch those`
}

function uniqueLabels(plats: readonly PoolPlat[]): string[] {
  const names: string[] = []
  for (const plat of plats) {
    const label = plat.label.trim()
    if (!label) continue
    if (names.some((name) => name.toLowerCase() === label.toLowerCase())) continue
    names.push(label)
  }
  return names
}

/** Plat membership only. No city. No mile radius. Next-row slugs stay out until that row is opened. */
export function poolCompArea(input: {
  own: PoolPlat
  adjacent: readonly PoolPlat[]
  next: readonly PoolPlat[]
  openedNext: boolean
  centre: { lat: number; lng: number } | null
}): CompArea {
  const plats = [input.own, ...input.adjacent, ...(input.openedNext ? input.next : [])]
  const names = uniqueLabels(plats)
  const where = poolWhere({ ownLabel: input.own.label, openedNext: input.openedNext })
  const nextClause = input.openedNext ? ', and the plats that touch those' : ''
  return {
    kind: names.length <= 1 ? 'subdivision' : 'subdivisions',
    names,
    radiusMiles: null,
    centre: input.centre,
    platSlugs: plats.map((plat) => plat.slug).filter(Boolean),
    source: `Recorded plat ${input.own.label} and the plats that touch it${nextClause}. The price was not a filter. The plats were.`,
    sentence: `Homes in ${where}.`,
  }
}

function pendingClause(pending: number): string {
  if (!(pending > 0)) return 'None are under contract right now.'
  const verb = pending === 1 ? 'is' : 'are'
  const homes = pending === 1 ? 'home' : 'homes'
  return `${pending} other ${homes} like yours ${verb} under contract.`
}

function heldBackClause(heldBack: number | null | undefined): string {
  const n = heldBack ?? 0
  if (n <= 0) return ''
  const homes = n === 1 ? 'home' : 'homes'
  const verb = n === 1 ? 'was' : 'were'
  return ` ${countWord(n, true)} more ${homes} like yours ${verb} in that pool.`
}

export function poolCompetitionSentence(input: {
  ownLabel: string
  openedNext: boolean
  activeCount: number
  pendingCount: number
  roomNote?: string | null
  /** Homes that passed the hard walls and were not printed. */
  heldBack?: number | null
}): string {
  const where = poolWhere({ ownLabel: input.ownLabel, openedNext: input.openedNext })
  const whereOr = poolWhere({ ownLabel: input.ownLabel, openedNext: input.openedNext, negative: true })
  const rooms = input.roomNote?.trim() ? ` ${input.roomNote.trim()}` : ''
  const more = heldBackClause(input.heldBack)
  const active = input.activeCount
  const pending = input.pendingCount
  if (active === 0 && pending === 0) {
    return `No home like yours is for sale or under contract in ${whereOr}.${more}`
  }
  if (active === 0) {
    const verb = pending === 1 ? 'is' : 'are'
    return `No home like yours is for sale in ${whereOr}, but ${countWord(pending)} ${verb} under contract.${rooms}${more}`
  }
  const sale =
    active === 1
      ? `1 home like yours is for sale in ${where}.`
      : `${active} homes like yours are for sale in ${where}.`
  return `${sale} ${pendingClause(pending)}${rooms}${more}`
}

export function poolCompetitionSource(input: {
  ownLabel: string
  openedNext: boolean
  asOfIso?: string | null
}): string {
  const formatted = input.asOfIso ? formatDate(input.asOfIso) : ''
  const when = formatted && formatted !== '—' ? ` as of ${formatted}` : ''
  const where = poolWhere({ ownLabel: input.ownLabel, openedNext: input.openedNext })
  return `Homes for sale and under contract in ${where}, from the Oregon Data Share MLS${when}. The price was not a filter. The plats were.`
}

export const POOL_NO_PLAT_SENTENCE =
  'This home is not inside a recorded plat, so no homes for sale were compared. The search did not use the city or a mile radius.'

export function poolReadFailedSentence(where: string): string {
  return `The homes for sale in ${where} were not read, so none are compared here.`
}

export function poolExpiredSentence(input: {
  ownLabel?: string | null
  openedNext?: boolean
  area?: CompArea | null
  count: number
  subjectCameOff?: boolean
  months?: number
  /** Homes that passed the hard walls and were not printed. */
  heldBack?: number | null
}): string {
  const months = input.months ?? POOL_EXPIRED_MONTHS
  const word = countWord(months)
  const where = input.ownLabel
    ? `in ${poolWhere({ ownLabel: input.ownLabel, openedNext: input.openedNext === true })}`
    : input.area
      ? compAreaIn(input.area)
      : 'in this area'
  const whereOr = input.ownLabel
    ? `in ${poolWhere({ ownLabel: input.ownLabel, openedNext: input.openedNext === true, negative: true })}`
    : input.area
      ? compAreaIn(input.area, { negative: true })
      : 'in this area'
  const more = heldBackClause(input.heldBack)
  if (input.count === 0) {
    const lead = input.subjectCameOff ? 'No other home like yours' : 'No home like yours'
    return `${lead} ${whereOr} came off the market without selling in the last ${word} months.${more}`
  }
  const homes = `${countWord(input.count, true)} ${input.count === 1 ? 'home' : 'homes'} like yours`
  return `${homes} ${where} came off the market without selling in the last ${word} months.${more}`
}

export function poolPlace(input: {
  ownPlat: boolean
  slug?: string | null
  name?: string | null
  ownSlugs: ReadonlySet<string>
  ownNames: ReadonlySet<string>
  adjacentSlugs: ReadonlySet<string>
  adjacentNames: ReadonlySet<string>
  nextSlugs: ReadonlySet<string>
  nextNames: ReadonlySet<string>
  openedNext: boolean
}): PoolPlace {
  const slug = (input.slug ?? '').trim()
  const name = (input.name ?? '').trim().toLowerCase()
  if (input.ownPlat || (slug && input.ownSlugs.has(slug)) || (name && input.ownNames.has(name))) return 'own'
  if ((slug && input.adjacentSlugs.has(slug)) || (name && input.adjacentNames.has(name))) return 'adjacent'
  if (input.openedNext && ((slug && input.nextSlugs.has(slug)) || (name && input.nextNames.has(name)))) return 'next'
  return input.openedNext ? 'next' : 'adjacent'
}
