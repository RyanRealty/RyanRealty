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
 * and builders, the registry's subdivision aliases and HOA estimate, the verified
 * city-to-district registry in data/co-schools.ts. No fact is composed from two
 * sources and none is invented. A community with no config yields fewer rows,
 * which is what the page then shows.
 *
 * MARKET FIGURES DO NOT BELONG HERE. Prices, medians, inventory counts, days on
 * market and months of supply are live and are rendered by the Instruments with
 * their own traces. ci:community-depth bans them from the static configs for the
 * same reason: a figure frozen in JSON is stale the day it ships.
 */

import type { V3QuietItem } from '@/components/site/v3'
import type { ResortCommunityContent } from '@/lib/resort-community-content'
import type { PlaceCharacter } from '@/lib/data/places/getPlaceCharacter'
import { publishPlaceHoa } from '@/lib/market/publish-place-hoa'
import { measuredPlaceHoaInput } from './place-hoa-measured'
import { slugify } from '@/lib/slug'

/**
 * One MLS subdivision string whose raw form is not a readable name. Copied, with
 * its reason, from the KB overview that owned it: the slug must still be built
 * from the RAW alias because /subdivisions/[slug] filters listings by that exact
 * string, so only the visible text is corrected. It is duplicated rather than
 * imported because the only copy lives inside components/site/kb, which this
 * register may not import. The correction belongs in lib/ and that gap is
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

function childPlatItems(input: {
  name: string
  aliases: readonly string[]
  countIsAliasAware: boolean
}): V3QuietItem[] {
  if (input.aliases.length === 0) return []
  const items: V3QuietItem[] = [
    {
      kind: 'prose',
      term: `Subdivisions in ${input.name}`,
      body: input.countIsAliasAware
        ? `The MLS files these homes under more than one subdivision name, and every one of them counts toward the figures above.`
        : `The MLS files these homes under more than one subdivision name.`,
    },
  ]
  for (const alias of input.aliases) {
    items.push({ label: ALIAS_DISPLAY[alias] ?? alias, href: `/subdivisions/${slugify(alias)}` })
  }
  return items
}

/**
 * The authored knowledge rows, in reading order: what belonging costs, what the
 * place is, the child plats, how long it takes to get anywhere, what is there,
 * who built it, and where its children go to school.
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
   * True only when the published count WAS built from the alias set, the page's
   * alias-aware branch. False on every other branch, including the market-pulse
   * and snapshot rows, which count by the literal subdivision name.
   *
   * The subdivisions row used to say the aliases "all count toward the figures
   * above" unconditionally, and on 2026-08-12 /communities/three-rivers published
   * that sentence under a count that came from its market pulse row, the same
   * page whose Field states, three sections up, that the count "carries the number
   * without the listings behind it". Two claims about one read, contradicting each
   * other. The row still carries every alias as a door. Only the sentence that
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
  amenityPosts: Readonly<Record<string, { slug: string, title: string }>>
  /**
   * Measured build years + HOA from member listings (PLACE_CONTENT_RULES
   * R1-R3), the same read V3PlaceCharacter renders lower on the page. A
   * measured HOA median outranks both the master assessment and the registry
   * estimate here, so this row cannot print a different annual than the
   * character block measured. (§0, D103 2026-08-27)
   */
  character?: PlaceCharacter | null
}): V3QuietItem[] {
  const { name, content, registry } = input
  const items: V3QuietItem[] = []

  const { measuredAnnual, measuredBasis } = measuredPlaceHoaInput(input.character)
  const hoa = publishPlaceHoa({
    measuredAnnual,
    measuredBasis,
    masterAnnual: content?.hoaMasterAnnual,
    estimateAnnual: registry?.hoa_annual_estimate,
  })
  if (hoa) {
    items.push({
      kind: 'prose',
      term: hoa.kind === 'measured' ? 'HOA (measured)' : hoa.kind === 'master' ? 'Master HOA' : 'HOA estimate',
      body:
        hoa.kind === 'measured'
          ? `$${hoa.annual.toLocaleString('en-US')} a year, the ${hoa.basis}.`
          : hoa.kind === 'master'
            ? `$${hoa.annual.toLocaleString('en-US')} a year. Membership is separate from the home.`
            : `$${hoa.annual.toLocaleString('en-US')} a year.`,
    })
  }

  for (const paragraph of input.aboutParagraphs) {
    if (paragraph.trim().length > 0) items.push({ kind: 'prose', body: paragraph })
  }

  const glance: string[] = []
  if (content?.founded) glance.push(`Founded ${String(content.founded)}`)
  if (content?.acres) glance.push(`${content.acres.toLocaleString('en-US')} acres`)
  if (content?.architect) glance.push(`Course architect ${content.architect}`)
  const topRanking = content?.courseRankings?.[0]
  if (topRanking) glance.push(`${topRanking.rank} ${topRanking.publication}`)
  items.push(...prose('At a glance', glance.join(' · ')))

  const aliases = (registry?.subdivision_aliases ?? []).filter(
    (a) => a.toLowerCase().trim() !== name.toLowerCase().trim(),
  )
  items.push(...childPlatItems({ name, aliases, countIsAliasAware: input.countIsAliasAware }))

  const drives = (content?.driveTimes ?? [])
    .filter((d) => Number.isFinite(d.minutes) && d.destination)
    .map((d) => `${d.minutes} minutes to ${d.destination}${d.note ? ` (${d.note})` : ''}`)
  items.push(...prose('Drive times', drives.join(' · ')))

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

  const seenPost = new Set<string>()
  for (const amenity of content?.amenities ?? []) {
    const post = amenity.blog_slug ? input.amenityPosts[amenity.blog_slug] : undefined
    if (!post || seenPost.has(post.slug)) continue
    seenPost.add(post.slug)
    items.push({ label: post.title, href: `/blog/${post.slug}` })
  }

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

  const tiers = (content?.membershipTiers ?? [])
    .map((tier) => {
      const label = String(tier.name ?? tier.tier ?? tier.label ?? '').trim()
      if (!label) return ''
      const rawPrice = tier.price == null || tier.price === '' ? '' : String(tier.price).trim()
      const price = rawPrice && !/[\u2014\u2013]/.test(rawPrice) ? ` ${rawPrice}` : ''
      const wait = tier.waitlist_status ? ` (${tier.waitlist_status})` : ''
      return `${label}${price}${wait}`
    })
    .filter(Boolean)
  items.push(...prose('Membership', tiers.join(' · ')))
  if (content?.membershipOfficePhone) {
    items.push(...prose('Membership office', content.membershipOfficePhone))
  }

  const builders = (content?.builders ?? [])
    .map((b) => String(b.name ?? '').trim())
    .filter(Boolean)
  items.push(...prose('Builders', builders.join(' · ')))

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

  if (input.isResort) {
    items.push({
      kind: 'prose',
      term: 'Second homes',
      body: `Short-term rental potential in ${name} varies by HOA rules, community covenants, and Oregon regulations. Ask for the current rental guidelines before you assume what is permitted or what it could earn.`,
    })
    items.push({ label: `Ask about renting in ${name}`, href: input.contactHref })
  }

  return items
}
