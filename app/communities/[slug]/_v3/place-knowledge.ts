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
  // Prose only. The per-subdivision doors moved to the page's own
  // "Subdivisions" Ledger (2026-09-01), which counts each child from the same
  // city SFR set as the face and names it through publishPlatDisplayName —
  // this row keeps the knowledge (why several MLS names count as one place)
  // without duplicating the navigation.
  return [
    {
      kind: 'prose',
      term: `Subdivisions in ${input.name}`,
      body: input.countIsAliasAware
        ? `The MLS files these homes under more than one subdivision name, and every one of them counts toward the figures above.`
        : `The MLS files these homes under more than one subdivision name.`,
    },
  ]
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
      kind: 'fact',
      term: hoa.kind === 'measured' ? 'HOA (measured)' : hoa.kind === 'master' ? 'Master HOA' : 'HOA estimate',
      value: `$${hoa.annual.toLocaleString('en-US')} a year`,
      detail:
        hoa.kind === 'measured'
          ? hoa.basis
          : hoa.kind === 'master'
            ? 'membership separate'
            : undefined,
    })
  }

  // At a glance was four facts joined with ` · ` into one sentence. They are
  // four facts.
  if (content?.founded) items.push({ kind: 'fact', term: 'Founded', value: String(content.founded) })
  if (content?.acres) {
    items.push({ kind: 'fact', term: 'Acres', value: content.acres.toLocaleString('en-US') })
  }
  if (content?.architect) {
    items.push({ kind: 'fact', term: 'Course architect', value: content.architect })
  }
  const topRanking = content?.courseRankings?.[0]
  if (topRanking) {
    items.push({ kind: 'fact', term: 'Ranked', value: topRanking.rank, detail: topRanking.publication })
  }

  const aliases = (registry?.subdivision_aliases ?? []).filter(
    (a) => a.toLowerCase().trim() !== name.toLowerCase().trim(),
  )
  items.push(...childPlatItems({ name, aliases, countIsAliasAware: input.countIsAliasAware }))

  /**
   * Drive times are `{minutes, destination}` and were being written out as
   * "18 minutes to Bend · 25 minutes to Redmond Airport · ...". Nearest first,
   * each drawn as a share of the longest, so the set reads as one comparison
   * instead of a sentence. The share is computed here, beside the number it
   * formats, so the primitive never does arithmetic on a published figure.
   */
  const drives = (content?.driveTimes ?? [])
    .filter((d) => Number.isFinite(d.minutes) && d.destination)
    .sort((a, b) => a.minutes - b.minutes)
  const longestDrive = drives.reduce((max, d) => Math.max(max, d.minutes), 0)
  for (const drive of drives) {
    items.push({
      kind: 'fact',
      term: drive.destination,
      value: `${drive.minutes} min`,
      detail: drive.note ?? undefined,
      ...(longestDrive > 0 ? { weight: drive.minutes / longestDrive } : {}),
    })
  }

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
    items.push({ kind: 'chips', term: category, labels: names })
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
    // The summary is prose because it is prose. The specs are figures and were
    // being appended to the end of that paragraph. Three of them — the tee set,
    // the turf blend and where the bunker sand comes from — were in the config
    // and published nowhere, and they are the kind of thing no other page about
    // this course carries.
    items.push(...prose('The course', specs.summary ?? ''))
    if (specs.par) items.push({ kind: 'fact', term: 'Par', value: String(specs.par) })
    if (specs.yardage) {
      items.push({ kind: 'fact', term: 'Yardage', value: specs.yardage.toLocaleString('en-US') })
    }
    if (specs.rating) items.push({ kind: 'fact', term: 'Course rating', value: String(specs.rating) })
    if (specs.slope) items.push({ kind: 'fact', term: 'Slope', value: String(specs.slope) })
    if (specs.tees) items.push({ kind: 'fact', term: 'Tees', value: String(specs.tees) })
    if (specs.turf) items.push({ kind: 'fact', term: 'Turf', value: String(specs.turf) })
    if (specs.bunker_sand_source) {
      items.push({ kind: 'fact', term: 'Bunker sand', value: String(specs.bunker_sand_source) })
    }
    if (specs.season) items.push({ kind: 'fact', term: 'Season', value: String(specs.season) })
  }

  /**
   * A membership tier is a name, a price and a waitlist status — three columns,
   * previously "Golf $95,000 (closed) · Social $12,000 (open) · ..." in one
   * paragraph. A tier whose price is an em or en dash carries no price, which is
   * how the configs record "on application"; the row then prints the status
   * alone rather than a dash pretending to be a figure.
   */
  for (const tier of content?.membershipTiers ?? []) {
    const label = String(tier.name ?? tier.tier ?? tier.label ?? '').trim()
    if (!label) continue
    const rawPrice = tier.price == null || tier.price === '' ? '' : String(tier.price).trim()
    const price = rawPrice && !/[\u2014\u2013]/.test(rawPrice) ? rawPrice : ''
    const status = tier.waitlist_status ? String(tier.waitlist_status).trim() : ''
    if (!price && !status) continue
    items.push({
      kind: 'fact',
      term: label,
      value: price || status,
      detail: price && status ? status : undefined,
    })
  }
  if (content?.membershipOfficePhone) {
    items.push(...prose('Membership office', content.membershipOfficePhone))
  }

  const builders = (content?.builders ?? [])
    .map((b) => String(b.name ?? '').trim())
    .filter(Boolean)
  if (builders.length > 0) items.push({ kind: 'chips', term: 'Builders', labels: builders })

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

  /**
   * The authored story, last and folded.
   *
   * It used to open this section — five or six paragraphs above every figure —
   * which is how #belonging became a 2,974px essay and why a reader could not
   * find the HOA or the drive times without reading it first. The section now
   * leads with what belonging costs and what the place is, and the story is one
   * row the reader opens. Nothing is cut: the paragraphs are in the DOM for a
   * crawler whether or not the disclosure is open, and the first of them is
   * already on the page's first screen.
   */
  if (input.aboutParagraphs.length > 0) {
    items.push({
      kind: 'fold',
      term: `More about ${name}`,
      body: [...input.aboutParagraphs],
    })
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
