/**
 * Sarah navigate tool. Moves the visitor to a public site page with
 * client-side router.push so the chat, panel, and voice session stay up.
 *
 * Property criteria and published pages only. No off-site or admin paths.
 */
import { communityPath } from '@/lib/communities/community-public-pair'
import { getAllResortCommunitiesLite } from '@/lib/communities/registry-lite'
import { homesForSalePath, slugify } from '@/lib/slug'
import { homeSearchSeeAllHref, parseHomeSearch } from './home-search'

export const NAVIGATE_TOOL = {
  type: 'function',
  name: 'navigate',
  description:
    'Take the visitor to a public Ryan Realty page without reloading: a prefilled search, city or community page, listing, sell, home value, or contact. Say "Taking you there now" and keep talking. Chat and voice stay open.',
  parameters: {
    type: 'object',
    properties: {
      href: {
        type: 'string',
        description: 'Same-origin path, e.g. /homes-for-sale/sisters or /sell/valuation',
      },
    },
    required: ['href'],
  },
} as const

export const SARAH_NAVIGATE_VOICE = 'Taking you there now'

const NAV_VERB_RE =
  /\b(show me|take me|take us|go to|open|bring (?:me|us)|send me to|take us there)\b/i
const HOMES_RE = /\b(homes?|houses?|listings?|for sale|search)\b/i
const SELL_RE = /\b(sell(?:ing)?(?: page)?|list my home)\b/i
const VALUE_RE = /\b(home value|valuation|what(?:'s| is) my home worth|value my home)\b/i
const CONTACT_RE = /\b(contact|get in touch|write (?:a |the )?broker)\b/i
const MLS_RE = /\b(22\d{6,8})\b/
const BLOCKED_PREFIX = /^\/(admin|api|account|sign|dashboard|studio)(\/|$)/i

export type SarahNavigateDest = {
  href: string
  label: string
  reply: string
  voice: string
}

export function isPublicSarahHref(href: string): boolean {
  if (!href.startsWith('/') || href.startsWith('//')) return false
  if (/[\s\\]/.test(href)) return false
  const path = href.split('?')[0].split('#')[0]
  if (!path || path === '/') return true
  if (BLOCKED_PREFIX.test(path)) return false
  return true
}

export function looksLikeNavigate(text: string): boolean {
  const q = text.trim()
  if (!q) return false
  if (NAV_VERB_RE.test(q)) return true
  if (VALUE_RE.test(q) && /\b(page|open|go|take|show)\b/i.test(q)) return true
  return false
}

function communityFromText(text: string): { slug: string; label: string } | null {
  const lower = text.toLowerCase()
  let best: { slug: string; label: string; len: number } | null = null
  for (const row of getAllResortCommunitiesLite()) {
    const names = [row.label, row.slug, ...(row.former_labels ?? []), ...row.subdivision_aliases]
    for (const name of names) {
      const key = name.trim()
      if (key.length < 4) continue
      const re = new RegExp(`\\b${escapeRe(key)}\\b`, 'i')
      if (!re.test(lower)) continue
      if (!best || key.length > best.len) best = { slug: row.slug, label: row.label, len: key.length }
    }
  }
  return best ? { slug: best.slug, label: best.label } : null
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function dest(href: string, label: string): SarahNavigateDest | null {
  if (!isPublicSarahHref(href)) return null
  return {
    href,
    label,
    reply: `${SARAH_NAVIGATE_VOICE}. ${label}.`,
    voice: SARAH_NAVIGATE_VOICE,
  }
}

export function resolveSarahNavigate(text: string): SarahNavigateDest | null {
  const q = text.trim()
  if (!q) return null

  const mls = q.match(MLS_RE)?.[1]
  if (mls) return dest(`/homes-for-sale/listing/${mls}`, `Listing ${mls}`)

  if (VALUE_RE.test(q)) return dest('/sell/valuation', 'Home value')
  if (CONTACT_RE.test(q) && !HOMES_RE.test(q)) return dest('/contact', 'Contact')
  if (SELL_RE.test(q) && !HOMES_RE.test(q) && !VALUE_RE.test(q)) return dest('/sell', 'Sell')

  const community = communityFromText(q)
  if (community && !HOMES_RE.test(q)) {
    return dest(communityPath(community.slug), community.label)
  }

  const parsed = parseHomeSearch(q)
  if (parsed.city || parsed.subdivision || community) {
    if (HOMES_RE.test(q) || parsed.beds || parsed.baths || parsed.minPrice || parsed.maxPrice) {
      const href = community && !parsed.city
        ? `/homes-for-sale?subdivision=${encodeURIComponent(community.label)}`
        : homeSearchSeeAllHref(parsed)
      const label = parsed.city
        ? `${parsed.city} homes for sale`
        : community
          ? `${community.label} homes for sale`
          : 'Homes for sale'
      return dest(href, label)
    }
    if (parsed.city) return dest(`/cities/${slugify(parsed.city)}`, parsed.city)
  }

  if (community) return dest(communityPath(community.slug), community.label)
  if (parsed.city) return dest(homesForSalePath(parsed.city), `${parsed.city} homes for sale`)
  return null
}

export function runNavigate(href: string): SarahNavigateDest | null {
  const path = href.trim()
  if (!isPublicSarahHref(path)) return null
  return dest(path, 'That page')
}
