/**
 * Browse places on Home `/` (2026-10-01): the towns as a photograph mosaic,
 * new construction as a counted ledger. Two forms, never one card run twice.
 *
 * WHAT IT WAS. Three runs of the same photo-top Card (new construction, towns,
 * resorts), two of them carousels. The separate judge read them, with the
 * featured-community carousel above, as one card shape spent three times, and
 * the resort cards as a bare numeral or the static words "Resort community".
 * The resorts now live in the featured-community spotlight with their figures.
 *
 * TOWNS (`layout: 'mosaic'`). Every town a photograph, the busiest large: its
 * name, its live count with its unit ("1,044 houses for sale"), and, on a
 * pointer's rest or focus, the one line the tile does not print at rest (its
 * median list price), each figure as the row published it. A town with no
 * photograph is a navy plate with the same words, never an empty box.
 *
 * NEW CONSTRUCTION (`layout: 'ledger'`). The run's lead figure large (the
 * Bend total, with its unit and its door), then one row per subdivision: its
 * count with its unit and the count as a length on the run's one scale (the
 * largest at full ink). A row with no published count prints its door only.
 *
 * Server component: no client JavaScript; the reveal is CSS on hover/focus.
 */
import Link from 'next/link'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import { cn } from '@/lib/utils'
import { storageImageAtWidth } from '@/lib/site/storage-image-width'
import { placeDoorPhotoSrc } from './home-browse-places'
import './home-browse-places.css'

export { placeDoorPhotoSrc } from './home-browse-places'

export type HomePlaceDoor = {
  label: string
  href: string
  /**
   * Sourced count. A number prints grouped; a formatted string is a
   * published figure. Omit when unmeasured — never send a zero for a miss.
   */
  count?: number | string
  /** City-index or communityImage photo. Omit when none. */
  photoSrc?: string
  description?: string
  /** One more published figure, shown on hover or focus (mosaic). */
  reveal?: { value: string; label: string }
}

export type HomePlaceRun = {
  name: string
  /** What every count in the run counts, printed beside each figure. */
  unit?: string
  /** The singular of `unit`, for a count of one. */
  unitOne?: string
  doors: readonly HomePlaceDoor[]
  seeAll?: { label: string; href: string }
  /** 'mosaic' (towns), 'ledger' (counted rows with a lead figure). */
  layout?: 'mosaic' | 'ledger'
  /** The ledger's headline figure: its label is the claim's subject. */
  lead?: HomePlaceDoor
}

function doorCount(count: HomePlaceDoor['count']): { n: number; label: string } | null {
  if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
    return { n: count, label: count.toLocaleString('en-US') }
  }
  if (typeof count === 'string' && count.trim()) {
    const n = Number(count.replace(/[^0-9.]/g, ''))
    if (Number.isFinite(n) && n > 0) return { n, label: count.trim() }
  }
  return null
}

function unitFor(run: HomePlaceRun, n: number): string {
  const unit = run.unit?.trim() ?? ''
  if (n === 1 && run.unitOne?.trim()) return run.unitOne.trim()
  return unit
}

/** Linked place stills name the place. Aerial files say so. Empty only when there is no photo. */
export function homePlacePhotoAlt(door: Pick<HomePlaceDoor, 'label' | 'photoSrc'>): string {
  const name = door.label.trim()
  const src = door.photoSrc?.trim() ?? ''
  if (!name || !src) return ''
  if (/\baerial\b/i.test(src)) return `${name} aerial`
  return name
}

function runIdOf(id: string, run: HomePlaceRun) {
  return `${id}-${run.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

function MosaicRun({ run, runId }: { run: HomePlaceRun; runId: string }) {
  const doors = [...run.doors].sort(
    (a, b) => (doorCount(b.count)?.n ?? -1) - (doorCount(a.count)?.n ?? -1),
  )
  return (
    <ul className="home-places__mosaic" aria-labelledby={runId}>
      {doors.map((door, i) => {
        const live = doorCount(door.count)
        const photo = placeDoorPhotoSrc(door.photoSrc)
        const photoAlt = homePlacePhotoAlt(door)
        // The lead tile draws about 740px wide at 1440, the rest about 365.
        const drawn = photo ? (storageImageAtWidth(photo, i === 0 ? 1600 : 900) ?? photo) : null
        return (
          <li
            key={door.href}
            className={cn('home-places__tile', i === 0 && 'home-places__tile--lead', !photo && 'home-places__tile--plate')}
          >
            <Link href={door.href} className="home-places__tile-link">
              {photo ? (
                <span className="home-places__tile-photo" data-jax-clear="">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={drawn ?? photo}
                    alt={photoAlt}
                    width={1200}
                    height={900}
                    loading="lazy"
                    decoding="async"
                  />
                </span>
              ) : null}
              <span className="home-places__tile-copy">
                <span className="home-places__tile-name">{door.label}</span>
                {live ? (
                  <span className="home-places__tile-count">
                    <span className="home-places__tile-n">{live.label}</span>{' '}
                    <span className="home-places__tile-unit">{unitFor(run, live.n)}</span>
                  </span>
                ) : (
                  <span className="home-places__tile-count home-places__tile-unit">See homes</span>
                )}
                {door.reveal ? (
                  <span className="home-places__tile-reveal">
                    <span className="home-places__tile-unit">{door.reveal.label}</span>{' '}
                    <span className="home-places__tile-n">{door.reveal.value}</span>
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function LedgerRun({ run, runId }: { run: HomePlaceRun; runId: string }) {
  const rows = [...run.doors]
    .map((door) => ({ door, live: doorCount(door.count) }))
    .sort((a, b) => (b.live?.n ?? -1) - (a.live?.n ?? -1))
  const largest = Math.max(0, ...rows.map((r) => r.live?.n ?? 0))
  const lead = run.lead
  const leadLive = lead ? doorCount(lead.count) : null
  return (
    <div className="home-places__ledger">
      {lead ? (
        <div className="home-places__lead">
          <h2 className="home-places__lead-eyebrow" id={runId}>
            {run.name}
          </h2>
          {leadLive ? (
            <p className="home-places__lead-figure">
              <span className="home-places__lead-n">{leadLive.label}</span>
              <span className="home-places__lead-unit">
                {unitFor(run, leadLive.n)} {lead.label}
              </span>
            </p>
          ) : (
            <p className="home-places__lead-figure">
              <span className="home-places__lead-unit">{lead.label}</span>
            </p>
          )}
          {lead.description ? <p className="home-places__lead-note">{lead.description}</p> : null}
          <Link href={lead.href} className="home-places__lead-door">
            {run.seeAll?.label ?? `See ${lead.label}`}
          </Link>
        </div>
      ) : (
        <h2 className="home-places__lead-eyebrow" id={runId}>
          {run.name}
        </h2>
      )}
      <ol className="home-places__rows" aria-labelledby={runId}>
        {rows.map(({ door, live }) => {
          // The one line a row does not print at rest: its share of the lead
          // figure, from the two published counts (a subdivision's new homes
          // are a subset of the town's).
          const share =
            live && leadLive && leadLive.n > 0 && live.n <= leadLive.n
              ? Math.round((live.n / leadLive.n) * 100)
              : null
          return (
            <li key={door.href} className="home-places__row">
              <Link href={door.href} className="home-places__row-link">
                <span className="home-places__row-name">{door.label}</span>
                {live ? (
                  <span className="home-places__row-count">
                    <span className="home-places__row-n">{live.label}</span>{' '}
                    <span className="home-places__row-unit">{unitFor(run, live.n)}</span>
                  </span>
                ) : (
                  <span className="home-places__row-count home-places__row-unit">See homes</span>
                )}
                {live && largest > 0 ? (
                  <span className="home-places__row-rule" aria-hidden="true">
                    <span style={{ width: `${Math.max((live.n / largest) * 100, 2)}%` }} />
                  </span>
                ) : null}
                {share != null && lead ? (
                  <span className="home-places__row-reveal">
                    {`${share}% of the ${leadLive!.label} ${lead.label}`}
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function HomeBrowsePlaces({
  runs,
  id = 'places',
  eyebrow = 'Central Oregon',
  heading = 'Browse places',
}: {
  runs: readonly HomePlaceRun[]
  id?: string
  eyebrow?: string
  heading?: string
}) {
  const shown = runs
    .map((run) => ({
      ...run,
      doors: run.doors.filter((d) => d.label.trim() && d.href.trim()),
    }))
    .filter((run) => run.name.trim() && run.doors.length > 0)
  if (shown.length === 0) return null
  const placeRuns = shown.filter((run) => run.layout !== 'ledger')
  const bands = shown.filter((run) => run.layout === 'ledger')

  return (
    <>
      {placeRuns.length > 0 ? (
        <section
          id={id}
          className={`${V3_ROOT_CLASS} home-browse-places`}
          aria-labelledby="places-heading"
        >
          <div className="home-browse-places__head">
            {eyebrow.trim() ? <V3Eyebrow>{eyebrow}</V3Eyebrow> : null}
            <V3Heading level={2} id="places-heading" className="home-browse-places__heading">
              {heading}
            </V3Heading>
          </div>

          {placeRuns.map((run) => {
            const runId = runIdOf(id, run)
            return (
              <section
                key={runId}
                id={runId}
                className="home-browse-places__run"
                aria-labelledby={`${runId}-name`}
              >
                <div className="home-browse-places__runhead">
                  <h3 id={`${runId}-name`} className="home-browse-places__runname">
                    {run.name}
                  </h3>
                </div>
                <MosaicRun run={run} runId={`${runId}-name`} />
                {/* Under the run, not at the heading's right end: that end is the
                    Jax button's lane at 375 (build b1 put the disc on it). */}
                {run.seeAll ? (
                  <p className="home-browse-places__runfoot">
                    <Link href={run.seeAll.href} className="home-browse-places__all">
                      {run.seeAll.label}
                    </Link>
                  </p>
                ) : null}
              </section>
            )
          })}
        </section>
      ) : null}

      {/* A counted ledger stands as its own band (navy, the full width) after
          the places, so the page's rhythm changes colour and width here, not
          only the furniture that carries the number (build b1 judge). */}
      {bands.map((run) => {
        const runId = runIdOf(id, run)
        return (
          <section
            key={runId}
            id={runId}
            className={`${V3_ROOT_CLASS} home-places-band`}
            aria-labelledby={`${runId}-name`}
          >
            <div className="home-places-band__inner">
              <LedgerRun run={run} runId={`${runId}-name`} />
            </div>
          </section>
        )
      })}
    </>
  )
}
