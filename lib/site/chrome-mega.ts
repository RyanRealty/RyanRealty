/**
 * Desktop mega-menu model for V3Chrome.
 *
 * Matt via Cos (2026-09-18): all five chrome menus are the same job —
 * Homes / Places / Market / Sell / About — dense balanced panels, one row
 * language, no empty dead columns, real padding. Places-only columns were
 * the miss; this file is the shared packer so a sixth special case cannot
 * grow.
 *
 * Destinations still come from site-nav. This only groups and packs them.
 */
import type { NavLink } from '@/lib/site-nav'

export const CHROME_MEGA_GROUP_KEYS = ['Buy', 'Areas', 'Market', 'Sell', 'About'] as const
export type ChromeMegaGroupKey = (typeof CHROME_MEGA_GROUP_KEYS)[number]

export type ChromeMegaSection = {
  heading: string
  links: NavLink[]
}

export type ChromeMegaNow = {
  heading: string
  facts: readonly { figure: string; label: string }[]
  note?: string
  field?: { w: number; h: number; d: string }
}

export type ChromeMegaLive = {
  eyebrow?: string
  facts: readonly { figure: string; label: string }[]
  note?: string
  field?: { w: number; h: number; d: string }
}

export type ChromeMegaModel = {
  caption: string | null
  sections: ChromeMegaSection[]
  now: ChromeMegaNow | null
  colCount: number
}

type Bucket = {
  heading: string
  test: (path: string) => boolean
}

export function isChromeMegaGroupKey(key: string): key is ChromeMegaGroupKey {
  return (CHROME_MEGA_GROUP_KEYS as readonly string[]).includes(key)
}

/** Path only — query and hash do not change which column a door belongs to. */
export function chromeMegaPath(href: string): string {
  return href.split('?')[0]?.split('#')[0] ?? href
}

export function packMegaSections(sections: readonly ChromeMegaSection[]): ChromeMegaSection[] {
  const filled = sections
    .filter((section) => section.links.length > 0)
    .map((section) => ({ heading: section.heading, links: [...section.links] }))
  if (filled.length <= 1) return filled

  const fat: ChromeMegaSection[] = []
  const thin: NavLink[] = []
  for (const section of filled) {
    if (section.links.length < 2) thin.push(...section.links)
    else fat.push(section)
  }
  if (thin.length === 0) return fat
  if (thin.length >= 2) return [...fat, { heading: 'More', links: thin }]
  if (fat.length === 0) return [{ heading: filled[0]?.heading ?? 'Pages', links: thin }]

  const shortest = fat.reduce((best, section, index) => {
    return section.links.length < fat[best]!.links.length ? index : best
  }, 0)
  const target = fat[shortest]
  if (!target) return fat
  fat[shortest] = { heading: target.heading, links: [...target.links, ...thin] }
  return fat
}

function bucketsFor(key: ChromeMegaGroupKey): Bucket[] {
  switch (key) {
    case 'Buy':
      return [
        {
          heading: 'Search',
          test: (path) => path === '/homes-for-sale' || path.startsWith('/homes-for-sale/'),
        },
        {
          heading: 'Activity',
          test: (path) => path === '/open-houses' || path === '/price-drops',
        },
        {
          heading: 'Collections',
          test: () => true,
        },
      ]
    case 'Areas':
      return [
        {
          heading: 'Cities',
          test: (path) => path === '/cities' || path.startsWith('/cities/'),
        },
        {
          heading: 'Communities',
          test: (path) => path === '/communities' || path.startsWith('/communities/'),
        },
        {
          heading: 'Browse',
          test: (path) =>
            path === '/neighborhoods' ||
            path.startsWith('/neighborhoods/') ||
            path === '/subdivisions' ||
            path.startsWith('/subdivisions/') ||
            path === '/schools' ||
            path.startsWith('/schools/'),
        },
      ]
    case 'Market':
      return [
        {
          heading: 'Pulse',
          test: (path) =>
            path === '/housing-market' ||
            path === '/housing-market/central-oregon' ||
            path === '/months-of-supply',
        },
        {
          heading: 'Sales',
          test: (path) => path === '/housing-market/history' || path === '/housing-market/reports',
        },
        {
          heading: 'Reading',
          test: () => true,
        },
      ]
    case 'Sell':
      return [
        {
          heading: 'Sell',
          test: () => true,
        },
      ]
    case 'About':
      return [
        {
          heading: 'Firm',
          test: (path) => path === '/about' || path === '/team' || path === '/join',
        },
        {
          heading: 'Reach',
          test: () => true,
        },
      ]
    default: {
      const _exhaustive: never = key
      return _exhaustive
    }
  }
}

function assignSections(links: readonly NavLink[], buckets: readonly Bucket[]): ChromeMegaSection[] {
  const out: ChromeMegaSection[] = buckets.map((bucket) => ({ heading: bucket.heading, links: [] }))
  const other: NavLink[] = []
  for (const link of links) {
    const path = chromeMegaPath(link.href)
    const index = buckets.findIndex((bucket) => bucket.test(path))
    if (index >= 0) out[index]?.links.push({ href: link.href, label: link.label })
    else other.push({ href: link.href, label: link.label })
  }
  if (other.length > 0) out.push({ heading: 'More', links: other })
  return out
}

export function chromeMegaModel(
  groupKey: string,
  links: readonly NavLink[],
  live?: ChromeMegaLive | null,
): ChromeMegaModel {
  const sections = isChromeMegaGroupKey(groupKey)
    ? packMegaSections(assignSections(links, bucketsFor(groupKey)))
    : packMegaSections([{ heading: 'Pages', links: links.map((link) => ({ href: link.href, label: link.label })) }])

  const caption = live?.eyebrow?.trim() ? live.eyebrow.trim() : null
  const now =
    live != null && (live.facts.length > 0 || live.field != null)
      ? {
          heading: 'Now',
          facts: live.facts,
          note: live.note,
          field: live.field,
        }
      : null

  return {
    caption,
    sections,
    now,
    colCount: Math.max(1, sections.length + (now ? 1 : 0)),
  }
}
