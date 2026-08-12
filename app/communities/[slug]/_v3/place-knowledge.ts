/**
 * Route-local: the community node's authored knowledge, shaped into V3Quiet rows.
 *
 * WHY IT IS A MODULE AND NOT INLINE. The page is under the ci:file-size-budget
 * floor and the gate's own instruction when a file approaches it is to split
 * rather than re-baseline. Nothing here fetches, formats a figure, or derives a
 * market number: it takes the already-loaded, already-verified per-community
 * config (data/resort-community-<slug>.json, through lib/resort-community-content)
 * plus the resort registry and the school registry, and turns them into rows.
 *
 * THE SOURCE SET IS CLOSED, and it is the same set the KB overview read: the
 * config's prose, at-a-glance facts, drive times, amenities, course, membership
 * and builders; the registry's subdivision aliases and HOA estimate; the verified
 * city-to-district registry in data/co-schools.ts. No fact is composed from two
 * sources and none is invented — a community with no config yields fewer rows,
 * which is what the page then shows.
 *
 * MARKET FIGURES DO NOT BELONG HERE. Prices, medians, inventory counts, days on
 * market and months of supply are live and are rendered by the Instruments with
 * their own traces. ci:community-depth bans them from the static configs for the
 * same reason: a figure frozen in JSON is stale the day it ships.
 */

import type { V3QuietItem } from '@/components/site/v3'
import type { ResortCommunityContent } from '@/lib/resort-community-content'
import { slugify } from '@/lib/slug'

/**
 * One MLS subdivision string whose raw form is not a readable name. Copied, with
 * its reason, from the KB overview that owned it: the slug must still be built
 * from the RAW alias because /subdivisions/[slug] filters listings by that exact
 * string, so only the visible text is corrected. It is duplicated rather than
 * imported because the only copy lives inside components/site/kb, which this
 * register may not import; the correction belongs in lib/ and that gap is
 * reported. "Lodges at Bachelor V" stays unmapped rather than guessed (§0).
 */
const ALIAS_DISPLAY: Record<string, string> = {
  Triple: 'Triple Knot',
}

type Registry = {
  subdivision_aliases?: string[]
  hoa_annual_estimate?: number | null
  description?: string | null
}

/** A paragraph row, dropped when the body is empty. */
function prose(term: string, body: string): V3QuietItem[] {
  return body.trim().length > 0 ? [{ kind: 'prose', term, body }] : []
}

/**
 * The authored knowledge rows, in reading order: what the place is, what it
 * costs to belong to it, how long it takes to get anywhere, what is there, who
 * built it, and where its children go to school.
 */
export function buildPlaceKnowledge(input: {
  name: string
  city: string
  aboutParagraphs: readonly string[]
  content: ResortCommunityContent | null
  registry: Registry | null
  schoolDistrictName: string | null
  schoolDistrictSlug: string | null
  isResort: boolean
  /**
   * True only when the published count WAS built from the alias set — the page's
   * alias-aware branch. False on every other branch, including the market-pulse
   * and snapshot rows, which count by the literal subdivision name.
   *
   * The subdivisions row used to say the aliases "all count toward the figures
   * above" unconditionally, and on 2026-08-12 /communities/three-rivers published
   * that sentence under a count that came from its market pulse row — the same
   * page whose Field states, three sections up, that the count "carries the number
   * without the listings behind it". Two claims about one read, contradicting each
   * other. The row still carries every alias as a door; only the sentence that
   * describes the count is conditional on the count.
   */
  countIsAliasAware: boolean
  contactHref: string
  /**
   * Published posts keyed by the amenity's `blog_slug`, already filtered to
   * published by the DAL. An amenity whose slug is absent gets no edge, which is
   * the whole reason the lookup happens: a link to an unpublished post is a dead
   * door, and the config cannot know a post's status.
   */
  amenityPosts: Readonly<Record<string, { slug: string; title: string }>>
}): V3QuietItem[] {
  const { name, content, registry } = input
  const items: V3QuietItem[] = []

  for (const paragraph of input.aboutParagraphs) {
    if (paragraph.trim().length > 0) items.push({ kind: 'prose', body: paragraph })
  }

  // At a glance. Every value is a config or registry field, printed as stored.
  const glance: string[] = []
  if (content?.founded) glance.push(`Founded ${String(content.founded)}`)
  if (content?.acres) glance.push(`${content.acres.toLocaleString('en-US')} acres`)
  if (content?.architect) glance.push(`Course architect ${content.architect}`)
  if (content?.hoaMasterAnnual) {
    glance.push(`Master HOA $${content.hoaMasterAnnual.toLocaleString('en-US')} a year`)
  } else if (registry?.hoa_annual_estimate) {
    glance.push(`HOA estimate $${registry.hoa_annual_estimate.toLocaleString('en-US')} a year`)
  }
  const topRanking = content?.courseRankings?.[0]
  if (topRanking) glance.push(`${topRanking.rank} ${topRanking.publication}`)
  items.push(...prose('At a glance', glance.join(' · ')))

  // Drive times, minutes first, exactly as the config states them.
  const drives = (content?.driveTimes ?? [])
    .filter((d) => Number.isFinite(d.minutes) && d.destination)
    .map((d) => `${d.minutes} minutes to ${d.destination}${d.note ? ` (${d.note})` : ''}`)
  items.push(...prose('Drive times', drives.join(' · ')))

  // Amenities, grouped by the config's own category so the row count stays
  // scannable on 390. A category with no named amenity produces no row.
  const byCategory = new Map<string, string[]>()
  for (const amenity of content?.amenities ?? []) {
    const category = amenity.category?.trim() || 'On site'
    const label = amenity.access ? `${amenity.name} (${amenity.access})` : amenity.name
    if (!label?.trim()) continue
    const list = byCategory.get(category) ?? []
    list.push(label)
    byCategory.set(category, list)
  }
  for (const [category, names] of byCategory) {
    items.push(...prose(category, names.join(' · ')))
  }

  // The amenity edges. One row per amenity the config points at a post that is
  // actually published, so the block that describes the lifestyle also carries
  // the way to read more about it.
  const seenPost = new Set<string>()
  for (const amenity of content?.amenities ?? []) {
    const post = amenity.blog_slug ? input.amenityPosts[amenity.blog_slug] : undefined
    if (!post || seenPost.has(post.slug)) continue
    seenPost.add(post.slug)
    items.push({ label: post.title, href: `/blog/${post.slug}` })
  }

  // The course. Specs are printed only when the config carries them.
  const specs = content?.courseSpecs
  if (specs) {
    const line: string[] = []
    if (specs.par) line.push(`Par ${specs.par}`)
    if (specs.yardage) line.push(`${specs.yardage.toLocaleString('en-US')} yards`)
    if (specs.rating) line.push(`Rating ${specs.rating}`)
    if (specs.slope) line.push(`Slope ${specs.slope}`)
    if (specs.season) line.push(`Season ${specs.season}`)
    items.push(...prose('The course', [specs.summary ?? '', line.join(' · ')].filter(Boolean).join(' ')))
  }

  // Membership. Tier names and their stated price or waitlist status, no more:
  // a dues figure the config does not carry is not one this page can supply.
  const tiers = (content?.membershipTiers ?? [])
    .map((tier) => {
      const label = String(tier.name ?? tier.tier ?? tier.label ?? '').trim()
      if (!label) return ''
      const price = tier.price == null || tier.price === '' ? '' : ` ${String(tier.price)}`
      const wait = tier.waitlist_status ? ` (${tier.waitlist_status})` : ''
      return `${label}${price}${wait}`
    })
    .filter(Boolean)
  items.push(...prose('Membership', tiers.join(' · ')))
  if (content?.membershipOfficePhone) {
    items.push(...prose('Membership office', content.membershipOfficePhone))
  }

  // Builders.
  const builders = (content?.builders ?? [])
    .map((b) => String(b.name ?? '').trim())
    .filter(Boolean)
  items.push(...prose('Builders', builders.join(' · ')))

  // Schools. The district registry is the only permitted source, and it answers
  // at city scope, so the row says city scope. Individual school assignment is
  // per address and this system does not hold it, so it is not claimed.
  if (input.schoolDistrictName) {
    items.push({
      kind: 'prose',
      term: 'Schools',
      body: `${name} is inside ${input.schoolDistrictName}, the district serving ${input.city}. Assignment is by address, so confirm the school for a specific home before you rely on it.`,
    })
    if (input.schoolDistrictSlug) {
      items.push({
        label: `${input.schoolDistrictName}`,
        href: `/schools/${input.schoolDistrictSlug}`,
      })
    }
  }

  // Second homes. Generic framing only: no permit caps, occupancy limits, or
  // income figures, which are the §0 hard rule on this subject.
  if (input.isResort) {
    items.push({
      kind: 'prose',
      term: 'Second homes',
      body: `Short-term rental potential in ${name} varies by HOA rules, community covenants, and Oregon regulations. Ask for the current rental guidelines before you assume what is permitted or what it could earn.`,
    })
    items.push({ label: `Ask about renting in ${name}`, href: input.contactHref })
  }

  // The subdivisions the MLS files this community under. The row carries the edge
  // into each subdivision node, and it explains the count ONLY on the branch where
  // the count is actually built from these names (see countIsAliasAware).
  const aliases = (registry?.subdivision_aliases ?? []).filter(
    (a) => a.toLowerCase().trim() !== name.toLowerCase().trim(),
  )
  if (aliases.length > 0) {
    items.push({
      kind: 'prose',
      term: `Subdivisions in ${name}`,
      body: input.countIsAliasAware
        ? `The MLS files these homes under more than one subdivision name, and every one of them counts toward the figures above.`
        : `The MLS files these homes under more than one subdivision name.`,
    })
    for (const alias of aliases) {
      items.push({ label: ALIAS_DISPLAY[alias] ?? alias, href: `/subdivisions/${slugify(alias)}` })
    }
  }

  return items
}
