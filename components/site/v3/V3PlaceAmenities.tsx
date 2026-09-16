/**
 * PATTERN 10: BOARD. The places that make a place — named, grouped, sourced.
 *
 * WHY A TENTH PATTERN AND NOT THE BELONGING QUIET (site queue SITE-116, Matt
 * 2026-09-16: "These master planned communities have excellent restaurants,
 * parks etc, we just are not doing them justice").
 *
 * Every authored community config (data/resort-community-<slug>.json, 27 of
 * them) carries an `amenities[]` array with a name, a category, one line, and
 * who can use it — Tetherow's three dining rooms, spa, sport, courts and Nordic
 * loops; NorthWest Crossing's two parks, the Neighborhood Center, the farmers
 * market, its schools and its trail access — each row backed by the config's
 * `sources[]`. Measured on a production build on 2026-09-16, the community page
 * printed all of it as chip rows inside the #belonging Quiet, fifth section of
 * ten, after HOA, founded, acres and drive times: "Recreation Discovery Park
 * (Public, Bend Park and Recreation District) Compass Park (...)". The resort's
 * own homepage leads with a grid of six photo tiles for the same places
 * (tetherow.com, read the same day). PLACE_PAGES.md has asked for an amenity
 * grid as item 3 of the master-plan order since 2026-09-05; it was never built.
 *
 * THE FORM IS A BOARD, not a list and not six cream cards: one packed grid of
 * places in the config's own order, every tile its kind as an eyebrow, a
 * display-face name, one plain line and an access line, hairlines between
 * tiles instead of boxes. The chips in the head are the board's index — each
 * one a real in-page anchor to the first place of that kind, so the
 * interaction is the same on a phone, on a keyboard, and for a crawler.
 *
 * WHAT IT WILL NOT DO (§0). It prints exactly the rows the caller passes: no
 * invented amenity, no coordinate, no price, no hours a row does not carry. A
 * tile's door is either the published guide about that place (the caller has
 * already resolved the post to a published title) or the row's own recorded
 * URL; a row with neither has no door. The section renders nothing for a
 * community with no amenities on file — an empty board is not a fact about the
 * place, it is a fact about our file.
 *
 * Barrel law honored here:
 *  - Imports only ./atoms, ./tokens.css, next/link and @/lib/utils.
 *  - No 'use client'. Pure server component: no state, no effects, no hooks.
 *  - Every color, size, rule and duration comes from ./tokens.css.
 *  - Chips and doors are `--v3-tap` tall (WCAG 2.5.8).
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3Eyebrow, V3Heading, V3Lede, V3SourceDisclosure, V3_ROOT_CLASS } from './atoms'
import type { V3IconName } from './V3Icon'
import { V3Number } from './V3Number.client'
import './tokens.css'
import './V3PlaceAmenities.css'

/**
 * THE KIND'S MARK — RETIRED FROM THE TILE (SITE-116 round 3, 2026-09-16).
 *
 * Round 2 put an Iconoir stroke mark at a control's height on every tile we
 * hold no photograph of, so a tile without a picture was "plainly a drawing".
 * The separate evaluator read the result by TASTE.md's own name: "every
 * non-golf amenity wears an identical square icon badge (wine glass, flower,
 * dumbbell) over a name and a paragraph — the banned 'card grids with icons'
 * tell". It was right. Eight identical badges are a grid of icons whatever
 * the intent, and a badge says nothing about Coorie that its name and its
 * line do not.
 *
 * So a tile we cannot photograph is carried by TYPE and FACTS: the kind as a
 * running head, the name in the display face at heading size, the authored
 * line, and a short fact list — who can use it, hours when the config records
 * them, anything else the access line states — set as a description list.
 * The resort's own homepage leads with photo tiles; where we hold a frame OF
 * the place it stands on its tile and the tile leads the board. Where we do
 * not, the honest thing is the information, not a pictogram standing in for
 * a picture.
 *
 * `amenityKindMark` stays exported: the Place JSON-LD and any caller that
 * needs a kind's mark for a control (not a card) can still resolve one.
 */
const KIND_MARK: Record<string, V3IconName> = {
  golf: 'Golf',
  dining: 'Cutlery',
  restaurants: 'Cutlery',
  food: 'Cutlery',
  cafe: 'CoffeeCup',
  coffee: 'CoffeeCup',
  parks: 'Leaf',
  park: 'Leaf',
  trails: 'PineTree',
  trail: 'PineTree',
  recreation: 'Walking',
  schools: 'Book',
  school: 'Book',
  education: 'Book',
  wellness: 'Flower',
  spa: 'Flower',
  fitness: 'Gym',
  racquet: 'TennisBall',
  tennis: 'TennisBall',
  winter: 'Snow',
  shopping: 'Shop',
  retail: 'Shop',
  events: 'Calendar',
  landmark: 'MapPin',
  lodging: 'Home',
  other: 'Building',
  'on site': 'Building',
}

/** The mark for a kind, always something: an unmapped kind is the building. */
export function amenityKindMark(category: string | null | undefined): V3IconName {
  const key = category?.trim().toLowerCase() ?? ''
  return KIND_MARK[key] ?? 'Building'
}

/**
 * One recorded fact about a place, as a label and its value — "Who can use
 * it · Open to public", "Hours · 7am to 2pm seasonally". Both halves are
 * authored text the caller already holds; the tile prints them as a
 * description list and invents neither.
 */
export type V3PlaceAmenityFact = {
  label: string
  value: string
}

/** One recorded place inside the place this section sits on. */
export type V3PlaceAmenity = {
  /** The published name. */
  name: string
  /** The config's own grouping word: Dining, Recreation, Wellness, Trails … */
  category?: string | null
  /** One plain line about it, as authored. */
  description?: string | null
  /** Who can use it, as authored: "Open to public", "Members only". */
  access?: string | null
  /**
   * The tile's fact list (SITE-116 round 3). When present it replaces the
   * bare access line on the tile: the caller has split the authored access
   * text into its parts (who can use it, hours, booking) or added facts it
   * can vouch for. `access` stays on the row for the JSON-LD and any caller
   * that reads it whole.
   */
  facts?: readonly V3PlaceAmenityFact[] | null
  /**
   * The door. Either our own published guide about this place (the caller has
   * resolved the post and its title) or the row's recorded external URL. A
   * tile with neither renders no door rather than a dead one.
   */
  door?: { href: string; label: string; external?: boolean } | null
  /**
   * A photograph OF THIS PLACE — the cover of our published guide about it, or
   * a frame the caller can vouch for. Never a stock frame of somewhere else.
   */
  image?: { src: string; alt: string } | null
  /** React key when two rows could share a name. Defaults to the name. */
  key?: string
}

/** One photograph of the place itself, for the strip above the tiles. */
export type V3PlacePhoto = {
  src: string
  alt: string
  /** Photographer / licensor credit when the frame is not our own. */
  credit?: string | null
}

export type V3PlaceAmenitiesProps = {
  id: string
  /** The uppercase context line. */
  eyebrow?: string
  /** The section's visible title and its accessible name. */
  heading: string
  /** One plain sentence: what this board is. Built by amenityBoardLede when omitted. */
  lede?: string
  amenities: readonly V3PlaceAmenity[]
  /**
   * Photographs of the place, at most three, above the tiles. The resort's
   * homepage leads with photo tiles; ours are the frames we own or have
   * graded (lib/place-photos.ts), captioned with what they show. Omit and the
   * board is type alone — honest, and the thing the rule says to fix by
   * grading more of the place's photographs, not by borrowing someone else's.
   */
  photos?: readonly V3PlacePhoto[]
  /** What the strip is, for the caption: "Photographs of Tetherow". */
  photosCaption?: string
  /** The §0 trace: who recorded these facts. Rendered as the collapsed disclosure. */
  source?: string
  /** The source's name for the disclosure's compact clause. */
  sourceName?: string | null
  className?: string
}

export type V3PlaceAmenityGroup = {
  category: string
  /** The in-page anchor id of this group, derived from the section id. */
  id: string
  rows: Array<Required<Pick<V3PlaceAmenity, 'name' | 'key'>> & Omit<V3PlaceAmenity, 'name' | 'key'>>
}

function trimmed(value: string | null | undefined): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Groups the rows by category IN THE ORDER THE CONFIG LISTS THEM — the author
 * chose that order (Tetherow leads with dining, Broken Top with golf), and the
 * board keeps it rather than sorting into alphabetical noise. A row with no
 * category joins "On site". A row with no name cannot render and is dropped.
 * Duplicate keys collapse to the first.
 */
export function amenityGroups(id: string, amenities: readonly V3PlaceAmenity[]): V3PlaceAmenityGroup[] {
  const seen = new Set<string>()
  const groups = new Map<string, V3PlaceAmenityGroup>()
  for (const row of amenities) {
    if (!row || typeof row !== 'object') continue
    const name = trimmed(row.name)
    if (!name) continue
    const key = trimmed(row.key) ?? name
    if (seen.has(key)) continue
    seen.add(key)
    const category = trimmed(row.category) ?? 'On site'
    const group = groups.get(category) ?? { category, id: `${id}-${slugify(category) || 'on-site'}`, rows: [] }
    group.rows.push({
      ...row,
      name,
      key,
      description: trimmed(row.description) ?? null,
      access: trimmed(row.access) ?? null,
      // A fact is the pair. Half of one is a dangling label or a naked value.
      facts: (row.facts ?? []).filter((f) => f && trimmed(f.label) && trimmed(f.value)),
      door: row.door && trimmed(row.door.href) && trimmed(row.door.label) ? row.door : null,
    })
    groups.set(category, group)
  }
  return [...groups.values()]
}

const SMALL_NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

function spelled(n: number): string {
  return n >= 0 && n < SMALL_NUMBERS.length ? SMALL_NUMBERS[n]! : n.toLocaleString('en-US')
}

function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  if (words.length === 2) return `${words[0]} and ${words[1]}`
  return `${words.slice(0, -1).join(', ')}, and ${words[words.length - 1]}`
}

/**
 * The board's one claim sentence: how many places are on file and what kinds.
 * "Eight places on file — dining, wellness, fitness, racquet, winter, and
 * trails — each with who can use it and where the fact was recorded." The count
 * is the list the reader can see, not a headline statistic (DATA_GRAPHICS.md).
 */
export function amenityBoardLede(groups: readonly V3PlaceAmenityGroup[]): string | undefined {
  const count = groups.reduce((n, g) => n + g.rows.length, 0)
  if (count === 0) return undefined
  const kinds = joinWords(groups.map((g) => g.category.toLowerCase()))
  const places = count === 1 ? 'One place on file' : `${spelled(count)[0]!.toUpperCase()}${spelled(count).slice(1)} places on file`
  return `${places} — ${kinds} — each with who can use it and where the fact was recorded.`
}

function AmenityTile({
  row,
  kind,
  anchorId,
}: {
  row: V3PlaceAmenityGroup['rows'][number]
  kind: string
  /** Set on the first tile of a kind: the chip in the head lands here. */
  anchorId?: string
}) {
  const door = row.door
  const image = row.image && row.image.src?.trim() ? row.image : null
  const facts = row.facts ?? []
  return (
    <li
      className={cn(
        'v3-place-amenities__tile',
        image ? 'v3-place-amenities__tile--pictured' : 'v3-place-amenities__tile--typed',
      )}
      id={anchorId}
    >
      {/* A PHOTOGRAPH IS PLAIN, ALWAYS-ON, FIRST-BYTE HTML — never behind an
          entrance a record or a fast scroller can catch empty (round 2 measured
          the Tetherow course frame blank in three capture runs behind the
          scroll reveal). A tile with no frame OF this place shows no picture
          and no pictogram standing in for one (round 3): the kind, the name at
          heading size, the line and the facts carry it. */}
      {image ? (
        <div className="v3-place-amenities__media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="v3-place-amenities__photo" src={image.src} alt={image.alt} loading="lazy" decoding="async" />
        </div>
      ) : null}
      <p className="v3-place-amenities__kind">{kind}</p>
      <h3 className="v3-place-amenities__name">{row.name}</h3>
      {row.description ? <p className="v3-place-amenities__line">{row.description}</p> : null}
      {facts.length > 0 ? (
        <dl className="v3-place-amenities__facts">
          {facts.map((fact) => (
            <div className="v3-place-amenities__fact" key={`${fact.label}:${fact.value}`}>
              <dt className="v3-place-amenities__fact-label">{fact.label}</dt>
              <dd className="v3-place-amenities__fact-value">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : row.access ? (
        <p className="v3-place-amenities__access">
          <span className="v3-place-amenities__access-label">Access</span> {row.access}
        </p>
      ) : null}
      {door ? (
        door.external ? (
          <a className="v3-place-amenities__door" href={door.href} rel="noopener">
            {door.label}
          </a>
        ) : (
          <Link className="v3-place-amenities__door" href={door.href}>
            {door.label}
          </Link>
        )
      ) : null}
    </li>
  )
}

/**
 * The board. A head with the category index as in-page chips, one group per
 * category with its places in columns, and the §0 disclosure naming who
 * recorded the facts.
 */
export function V3PlaceAmenities({
  id,
  eyebrow,
  heading,
  lede,
  amenities,
  photos,
  photosCaption,
  source,
  sourceName,
  className,
}: V3PlaceAmenitiesProps) {
  const groups = amenityGroups(id, amenities)
  // Nothing on file: render nothing. A heading over an empty board would
  // claim the place has nothing, and this primitive will not invent the rows
  // that would fill it either.
  if (groups.length === 0) return null

  const title = trimmed(heading)
  if (!title) return null

  const headingId = `${id}-heading`
  const contextLine = trimmed(eyebrow)
  const claim = trimmed(lede) ?? amenityBoardLede(groups)
  const trace = trimmed(source)
  const strip = (photos ?? []).filter((p) => p && trimmed(p.src) && trimmed(p.alt)).slice(0, 3)
  const credits = [...new Set(strip.map((p) => trimmed(p.credit ?? undefined)).filter((c): c is string => Boolean(c)))]

  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-place-amenities', className)}
      aria-labelledby={headingId}
    >
      <div className="v3-place-amenities__head">
        {contextLine ? <V3Eyebrow>{contextLine}</V3Eyebrow> : null}
        <V3Heading level={2} id={headingId} className="v3-place-amenities__heading">
          {title}
        </V3Heading>
        {claim ? <V3Lede className="v3-place-amenities__lede">{claim}</V3Lede> : null}
        {groups.length > 1 ? (
          <nav className="v3-place-amenities__index" aria-label={`${title}: by kind`}>
            <ul className="v3-place-amenities__chips">
              {/* The count on each chip is the installed beUI number
                  (components/motion/number.tsx via V3Number): it counts up to
                  the figure the board can be checked against, and the SERVED
                  face is already the settled figure, so a crawler and a no-JS
                  reader never read a 0 beside a kind that has three places.
                  aria-hidden because the list under the chip is the count. */}
              {groups.map((group) => (
                <li key={group.id}>
                  <a className="v3-place-amenities__chip" href={`#${group.id}`}>
                    {group.category}
                    <span className="v3-place-amenities__chip-count" aria-hidden="true">
                      <V3Number value={group.rows.length} formatted={String(group.rows.length)} />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>

      {strip.length > 0 ? (
        <figure className="v3-place-amenities__strip" data-frames={strip.length}>
          {/* Plain, for the reason on the tile below: a photograph of the
              place is the point of this section, and it is never put behind
              an entrance that a record or a fast scroller can catch empty. */}
          {strip.map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.src}
              className="v3-place-amenities__frame"
              src={photo.src}
              alt={photo.alt}
              loading="lazy"
              decoding="async"
            />
          ))}
          <figcaption className="v3-place-amenities__strip-caption">
            {trimmed(photosCaption) ?? 'Photographs of the place'}
            {credits.length > 0 ? ` · ${credits.join(' · ')}` : ''}
          </figcaption>
        </figure>
      ) : null}

      {/* ONE grid, packed, in the config's order — not one block per kind. A
          board with six kinds and eight places would otherwise stack six
          one-row groups, four of them a single tile beside two empty columns
          (Tetherow measured 1,882px tall that way on 2026-09-16). The kind
          sits on each tile as its eyebrow, and the chip for a kind lands on
          that kind's first tile. A pictured tile spans two columns on a wide
          window (round 3): the frame we hold leads the board the way the
          resort's own tiles do, and the typed tiles run beside it. */}
      <ul className="v3-place-amenities__tiles">
        {groups
          .flatMap((group) =>
            group.rows.map((row, index) => ({
              row,
              kind: group.category,
              anchorId: index === 0 ? group.id : undefined,
            })),
          )
          .map((tile) => (
            <AmenityTile key={tile.row.key} row={tile.row} kind={tile.kind} anchorId={tile.anchorId} />
          ))}
      </ul>

      {trace ? (
        <V3SourceDisclosure source={trace} sourceName={sourceName} className="v3-place-amenities__source" />
      ) : null}
    </section>
  )
}
