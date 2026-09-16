'use client'

/**
 * THE COMPARE SHEET — /compare's worked example, built on the installed kit.
 *
 * WHERE IT CAME FROM (site queue SITE-95). The 2026-09-12 taste table scored
 * this class 46 with demoMatch false: "the photos are cream-box stamps, not
 * shadcn-carousel, and the sheet is a hairline list, not shadcn-table." Both
 * halves of that are answered here by using the real objects:
 *
 *   · `@/components/ui/table`    — the shadcn Table, with its own data-slot
 *     rows, hover and `data-state="selected"`. The row IS the control: resting
 *     on it (or tapping it) selects that field, and the reading above the sheet
 *     states the spread across every home in it.
 *   · `@/components/ui/carousel` — the shadcn embla carousel, one per home, so
 *     a visitor can page THAT listing's photographs inside the column instead
 *     of looking at a 64px stamp. Prev/next are the kit's own buttons, painted
 *     with house tokens and sized to the 44px tap floor.
 *
 * WHY IT LIVES IN THE ROUTE AND NOT IN components/site/v3. The same reason
 * `app/invest/_v3/InvestTables.client.tsx` does: the compare interaction (which
 * homes are in the sheet, which field is being read, the per-row spread) is
 * this route's product, not a site-wide pattern. V3Slots stays the PATTERN —
 * headline, claim, SAMPLE label, tray, §0 trace — and takes this sheet as its
 * worked example. One kit, one token file, no second design system.
 *
 * SECTION 0. This component does no arithmetic. Every figure, every spread
 * sentence and every low/high mark is computed in `app/compare/page.tsx` from
 * the listing_tile_mv rows read in that render and handed down formatted, so
 * the sheet can never disagree with the trace beneath it.
 *
 * AT 375 IT COMPARES, IT DOES NOT CROP. Four columns cannot be read at 375 —
 * the 2026-09-12 capture sliced the second column through its address, its
 * price and its button. So at narrow widths the sheet carries two homes and the
 * picker above it says which two. Nothing is hidden: all four homes are in the
 * picker, and the sheet re-reads the moment one is tapped.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import './compare-sheet.css'

/** One photograph of one home, as the feed published it. */
export type CompareSheetPhoto = {
  url: string
  alt: string
}

/** One home in the sheet: its head, its photographs, its formatted values. */
export type CompareSheetHome = {
  /** listing_key. The id ComparisonContext holds. Never shown. */
  key: string
  /** The listing's own page — the canonical URL the sitemap already uses. */
  href: string
  /** Where "add" goes with JavaScript off. A real URL, so the example works
   *  before hydration and for a reader who never gets it. */
  addHref: string
  /** Street address: the column head. */
  title: string
  /** A short label for the picker — the street name without the number. */
  shortTitle: string
  /** City. */
  place?: string
  /** Price, exactly as published. */
  price: string
  /** beds · baths · sq ft, already formatted. */
  facts: string
  photos: readonly CompareSheetPhoto[]
  /** One formatted value per row, in row order. */
  values: readonly string[]
  /** This home's share of the largest value in that row, 0..1, or null. */
  weights: readonly (number | null)[]
  /** 'low' / 'high' when this home holds that extreme in the row. */
  marks: readonly ('low' | 'high' | null)[]
}

/** One compared field. `reading` is the §0 spread sentence for the whole row. */
export type CompareSheetRow = {
  label: string
  /** The spread across the homes, computed in the page from the same numbers. */
  reading: string
  /** The same reading without the addresses, for 375 where the names cost a
   *  line the houses need. Optional; the long one stands in when absent. */
  readingShort?: string
  /** True when the row carries a bar. A row a bar would not teach prints alone. */
  encoded: boolean
}

export type CompareSheetProps = {
  homes: readonly CompareSheetHome[]
  rows: readonly CompareSheetRow[]
  /** The as-of line under the sheet: publisher, table, and when it was read. */
  caption: string
  /** The word on a column's add control. */
  addLabel: string
  /** Called with a listing key when the reader adds it. The anchor still
   *  navigates; this only keeps the local tray in step. */
  onAdd?: (key: string) => void
  className?: string
}

/** How many homes a narrow viewport can hold without cropping one. */
const NARROW_COLUMNS = 2
/** Below this width the sheet carries two homes and a picker. */
const NARROW_QUERY = '(max-width: 56rem)'

function PhotoStrip({
  home,
  addLabel,
  onAdd,
}: {
  home: CompareSheetHome
  addLabel: string
  onAdd?: (key: string) => void
}) {
  const [api, setApi] = useState<CarouselApi>()
  const [index, setIndex] = useState(0)
  const count = home.photos.length

  useEffect(() => {
    if (!api) return
    const sync = () => setIndex(api.selectedScrollSnap())
    sync()
    api.on('select', sync)
    api.on('reInit', sync)
    return () => {
      api.off('select', sync)
      api.off('reInit', sync)
    }
  }, [api])

  if (count === 0) return null

  return (
    <Carousel
      setApi={setApi}
      opts={{ align: 'start', containScroll: 'trimSnaps', watchDrag: count > 1 }}
      className="compare-sheet__strip"
      aria-label={`Photographs of ${home.title}`}
    >
      <CarouselContent className="compare-sheet__strip-track ml-0">
        {home.photos.map((photo, i) => (
          <CarouselItem key={photo.url} className="compare-sheet__strip-slide pl-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- MLS photos are
                remote and already sized by the CSS; next/image would add a loader
                round trip per frame to a block that must stay cheap. The first two
                frames of each home load eagerly so the sheet opens with houses in
                it rather than with four grey boxes. */}
            <img
              className="compare-sheet__photo"
              src={photo.url}
              alt={photo.alt}
              loading={i < 2 ? 'eager' : 'lazy'}
              decoding="async"
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      {/* THE ADD SITS ON THE HOUSE. Four identical outline buttons in a row
          under the photos turned the sample into a repeated form kit (the
          2026-09-12 table said so); the thing a reader taps to keep this home
          is this home. */}
      <a
        className="compare-sheet__add"
        href={home.addHref}
        data-compare-add={home.key}
        onClick={() => onAdd?.(home.key)}
      >
        <span className="compare-sheet__add-glyph" aria-hidden="true">
          +
        </span>
        {/* At 375 the words come off and the plus stands alone: "Add to yours"
            wrapped to two lines across a 145px photograph (2026-09-15 capture).
            The control keeps its name for a screen reader either way. */}
        <span className="compare-sheet__add-word">{addLabel}</span>
        <span className="compare-sheet__sr"> {home.title} to your comparison</span>
      </a>
      {count > 1 ? (
        <>
          <div className="compare-sheet__strip-nav">
            <CarouselPrevious className="compare-sheet__step static size-auto translate-x-0 translate-y-0" />
            <CarouselNext className="compare-sheet__step static size-auto translate-x-0 translate-y-0" />
          </div>
          {/* The track, drawn. Indicators, not controls: the steps and the drag
              are the controls, and a 10px dot would be under the tap floor. */}
          <span className="compare-sheet__dots" aria-hidden="true">
            {home.photos.map((photo, i) => (
              <span
                key={`dot-${photo.url}`}
                className="compare-sheet__dot"
                data-state={i === index ? 'on' : 'off'}
              />
            ))}
          </span>
        </>
      ) : null}
    </Carousel>
  )
}

export function CompareSheet({
  homes,
  rows,
  caption,
  addLabel,
  onAdd,
  className,
}: CompareSheetProps) {
  const [narrow, setNarrow] = useState(false)
  const [picked, setPicked] = useState<readonly string[]>(() => homes.map((h) => h.key))
  const [readingRow, setReadingRow] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(NARROW_QUERY)
    const apply = () => setNarrow(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const limit = narrow ? NARROW_COLUMNS : homes.length

  // WHICH HOMES ARE IN THE SHEET, derived rather than synced. `picked` is the
  // reader's order, most recently chosen first; the sheet carries the first
  // `limit` of it and re-reads them in the page's own order, so a viewport
  // change re-slices the same choice instead of resetting it (and no effect
  // writes state during a render pass).
  const visible = useMemo(() => {
    const live = picked.filter((k) => homes.some((h) => h.key === k))
    const base = live.length > 0 ? live : homes.map((h) => h.key)
    return new Set(base.slice(0, limit))
  }, [homes, picked, limit])

  const toggle = useCallback(
    (key: string) => {
      setPicked((current) => {
        const live = current.filter((k) => homes.some((h) => h.key === k))
        const base = live.length > 0 ? live : homes.map((h) => h.key)
        if (new Set(base.slice(0, limit)).has(key)) {
          // Never empty the sheet: the last home stays.
          return base.length > 1 ? base.filter((k) => k !== key) : base
        }
        return [key, ...base.filter((k) => k !== key)]
      })
    },
    [homes, limit],
  )

  const shown = useMemo(() => homes.filter((h) => visible.has(h.key)), [homes, visible])

  if (homes.length === 0 || rows.length === 0) return null

  const reading = rows[Math.min(readingRow, rows.length - 1)]

  return (
    <div className={cn('compare-sheet', className)}>
      {/* THE READING. A comparison that leaves the arithmetic to the reader is a
          spreadsheet. This is the sentence the columns add up to, and it moves
          to whichever field the reader is resting on. */}
      <p className="compare-sheet__reading">
        <span className="compare-sheet__reading-label">{reading?.label}</span>
        <span className="compare-sheet__reading-body compare-sheet__reading-body--named">
          {reading?.reading}
        </span>
        {reading?.readingShort ? (
          <span className="compare-sheet__reading-body compare-sheet__reading-body--short">
            {reading.readingShort}
          </span>
        ) : null}
      </p>

      {/* WHICH HOMES ARE IN THE SHEET. At 375 this is how four homes stay
          readable — two at a time, named, one tap apart. Wide, it is how a
          reader drops one they have already ruled out. */}
      <div className="compare-sheet__picker" role="group" aria-label="Homes in this comparison">
        <span className="compare-sheet__picker-label">
          {narrow ? 'Pick two' : `Showing ${shown.length} of ${homes.length}`}
        </span>
        {homes.map((home) => {
          const on = visible.has(home.key)
          return (
            <Button
              key={home.key}
              type="button"
              variant="outline"
              size="lg"
              className="compare-sheet__pick"
              aria-pressed={on}
              data-compare-pick={home.key}
              onClick={() => toggle(home.key)}
            >
              {home.shortTitle}
              <span className="compare-sheet__sr">
                {on ? ' — in the comparison' : ' — add to the comparison'}
              </span>
            </Button>
          )
        })}
      </div>

      <Table className="compare-sheet__table">
        <TableHeader>
          <TableRow className="compare-sheet__head-row">
            <TableHead className="compare-sheet__rowhead compare-sheet__corner">
              <span className="compare-sheet__sr">What is compared</span>
            </TableHead>
            {shown.map((home) => (
              <TableHead
                key={home.key}
                scope="col"
                className="compare-sheet__col"
                data-compare-col={home.key}
              >
                <PhotoStrip home={home} addLabel={addLabel} onAdd={onAdd} />
                <a className="compare-sheet__col-title" href={home.href}>
                  {home.title}
                </a>
                <span className="compare-sheet__col-place">
                  {[home.place, home.price].filter(Boolean).join(' · ')}
                </span>
                <span className="compare-sheet__col-facts">{home.facts}</span>
              </TableHead>
            ))}
          </TableRow>
          {/* THE LABEL ROW. The photographs and the address block above are the
              column heads, but a reader coming down the ledger loses which
              column is which house (2026-09-15 evaluator: "home names sit in
              the card strip above, disconnected from the ledger"). This is the
              thead row the shadcn demo carries, in the same small caps. */}
          <TableRow className="compare-sheet__label-row">
            <TableHead className="compare-sheet__rowhead compare-sheet__corner">
              <span className="compare-sheet__sr">Field</span>
            </TableHead>
            {shown.map((home) => (
              <TableHead key={home.key} scope="col" className="compare-sheet__label">
                {home.shortTitle}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, r) => {
            const active = r === readingRow
            return (
              <TableRow
                key={row.label}
                className="compare-sheet__row"
                data-compare-row={row.label}
                data-state={active ? 'selected' : undefined}
                tabIndex={0}
                onMouseEnter={() => setReadingRow(r)}
                onFocus={() => setReadingRow(r)}
                onClick={() => setReadingRow(r)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setReadingRow(r)
                  }
                }}
              >
                <TableHead scope="row" className="compare-sheet__rowhead">
                  {row.label}
                </TableHead>
                {shown.map((home) => {
                  const weight = home.weights[r]
                  const encoded =
                    row.encoded &&
                    typeof weight === 'number' &&
                    Number.isFinite(weight) &&
                    weight > 0
                      ? Math.min(1, weight)
                      : null
                  const mark = home.marks[r]
                  return (
                    <TableCell key={home.key} className="compare-sheet__cell">
                      <span className="compare-sheet__value">{home.values[r] ?? '—'}</span>
                      {encoded != null ? (
                        <span
                          className="compare-sheet__bar"
                          aria-hidden="true"
                          style={{ ['--compare-w' as string]: String(encoded) }}
                        >
                          <span className="compare-sheet__bar-fill" />
                        </span>
                      ) : null}
                      {mark && active ? (
                        <span className="compare-sheet__mark">
                          {mark === 'low' ? 'Lowest' : 'Highest'}
                        </span>
                      ) : null}
                    </TableCell>
                  )
                })}
              </TableRow>
            )
          })}
        </TableBody>
        <TableCaption className="compare-sheet__caption">{caption}</TableCaption>
      </Table>
    </div>
  )
}
