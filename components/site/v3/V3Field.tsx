'use client'
// Client boundary: the row-to-pin binding is hover and focus state, so this
// primitive owns useState. Nothing else here needs the client.

/**
 * v3 PATTERN 2: FIELD. Inventory as a spatial surface.
 *
 * Locked definition (design_system/public/PUBLIC_UI.md section 3): "live
 * inventory as a spatial surface: map + list in one frame, hover/tap bound both
 * ways, counts honest to the viewport." Proven in the moving prototype at
 * app/dev/public-v3 (base node + homes node); this generalizes that surface and
 * changes none of its look.
 *
 * What it is:
 *  - One frame, two columns: the map on the left, the list on the right, one
 *    column stacked on 390.
 *  - Every row is a door. A row is a next/link, never a card with a button in
 *    it, so the whole row is the target and the target is the listing.
 *  - The binding runs both ways. Pointing at a row lights its pin; pointing at a
 *    pin lights its row. That highlight is a state change the visitor caused,
 *    which is the only kind of motion section 5 allows.
 *
 * The map is a SLOT, not a dependency. Production passes the real Google map
 * (as `mapSlot` or as children), and the map reads and writes the same binding
 * through `useV3FieldBinding()` or the render-prop form. When no slot is passed
 * and three or more items carry `photoSrc`, the frame is those MLS photographs,
 * each a door into the listing — that is the Homes inventory surface. When no
 * slot is passed and the set has no photographs, the frame plots coordinates so
 * the pattern still shows its shape. That plot is a relative plot, not a map,
 * and the component says so itself: `PLOT_DISCLOSURE` renders under the plot
 * whenever a pin is drawn, with no prop to switch it off. A caller can add its
 * own line through `mapNote`; a caller cannot ship the pins without the label.
 *
 * Barrel law honored here:
 *  - No import from the deleted KB register, components/site (flat legacy),
 *    components/site/primitives, components/site/explore, or components/ui.
 *  - `ariaLabel` is required in the type, so a nameless section cannot compile.
 *  - Every color comes from ./tokens.css through ./V3Field.css. No raw hex.
 *  - No formatting happens here. `priceLabel` and `meta` arrive preformatted, so
 *    rounding and currency rules stay in lib/format and the figure a visitor
 *    reads is the figure its source trace covers.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3SourceLine } from './atoms'
import './tokens.css'
import './V3Field.css'

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type V3FieldItem = {
  /** Stable identity. Shared by the row and its pin, which is what binds them. */
  id: string
  /** Where the row goes. A row without a destination is not a Field row. */
  href: string
  /**
   * The price exactly as it should read, already formatted by the caller
   * through lib/format/money (formatPrice, formatPriceCompact). A string keeps
   * this primitive from inventing a figure.
   */
  priceLabel: string
  /** The address or name the row is known by. */
  title: string
  /** The supporting line, preformatted and preassembled (beds, baths, sqft). */
  meta?: string
  /** Real latitude, when the feed reports one. Absent means listed, not plotted. */
  lat?: number | null
  /** Real longitude, when the feed reports one. */
  lng?: number | null
  /**
   * Live MLS photograph URL. When three or more items carry one and no map
   * slot is passed, those photographs become the spatial surface (each a door
   * into the listing) instead of the relative plot.
   */
  photoSrc?: string
}

/**
 * What a map inside the frame reads and writes. A real map component gets this
 * either from the render-prop form of the slot or from `useV3FieldBinding()`.
 */
export type V3FieldBinding = {
  /** The item currently lit, or null. */
  activeId: string | null
  /** Light an item, or pass null to clear. Pointing at a pin calls this. */
  setActiveId: (id: string | null) => void
  /** The same set the list is rendering, in the same order. */
  items: V3FieldItem[]
}

/** A map element, or a function that receives the binding and returns one. */
export type V3FieldMapSlot = ReactNode | ((binding: V3FieldBinding) => ReactNode)

export type V3FieldProps = {
  /**
   * REQUIRED. The accessible name of the section, because a Field carries no
   * heading of its own (the node's heading sits above it). Typed non-optional so
   * a nameless landmark is a compile error rather than an audit finding.
   */
  ariaLabel: string
  /** The inventory. Order is the order the list renders. */
  items: V3FieldItem[]
  /**
   * The real map. Production passes the Google map here; the prototype passes a
   * placeholder. Omit it and the frame plots the coordinates it was given.
   */
  mapSlot?: V3FieldMapSlot
  /** Same slot, in children position. Ignored when `mapSlot` is passed. */
  children?: V3FieldMapSlot
  /**
   * The honest count of what is in view, with the trace that backs it. Renders
   * as a caption, never a number hero (Page Grade auto-fail 2). Source arrives
   * with the figure so a count cannot render without the line that says where
   * it came from.
   */
  count?: {
    /** Preformatted, e.g. "128". */
    value: string
    /** What the count counts, e.g. "homes in view". */
    label: string
    /** The trace, without the word Source. */
    source: string
    /** Last refresh. Rendered through the canonical date formatter. */
    updatedAt?: string | number | Date | null
  }
  /**
   * One line under the map, for whatever this caller's map needs said. The
   * fallback plot's own disclosure does not come from here: it renders on its
   * own whenever pins are drawn, so omitting this prop cannot produce an
   * unlabeled pseudo-map.
   */
  mapNote?: string
  /** One line under the list, for whatever the set does not show. */
  footNote?: string
  /** Shown when `items` is empty. Say the reason, not just the absence. */
  emptyMessage?: string
  /** Controlled binding. Pass with `onActiveChange` when the map owns the state. */
  activeId?: string | null
  /** Fires on every change, controlled or not. */
  onActiveChange?: (id: string | null) => void
  id?: string
  className?: string
}

/* -------------------------------------------------------------------------- */
/* Binding context                                                             */
/* -------------------------------------------------------------------------- */

const V3FieldBindingContext = createContext<V3FieldBinding | null>(null)

/**
 * Read the Field binding from inside the map slot. Lets a map that sits several
 * levels below the slot light a row without prop drilling.
 *
 * Throws outside a V3Field rather than returning a silent no-op binding: a map
 * whose hover does nothing is a defect that should surface at the first render,
 * not read as a design choice.
 */
export function useV3FieldBinding(): V3FieldBinding {
  const binding = useContext(V3FieldBindingContext)
  if (binding == null) {
    throw new Error('useV3FieldBinding must be called inside a V3Field map slot.')
  }
  return binding
}

/* -------------------------------------------------------------------------- */
/* Fallback plot                                                               */
/* -------------------------------------------------------------------------- */

type PlottedPin = { item: V3FieldItem; left: number; top: number }

/**
 * What the fallback plot is, in the visitor's words. The component renders it,
 * never the caller, because the line is what separates a relative plot from a
 * map a visitor will read as geography: each axis is normalized on its own
 * inside a fixed 4/3 box, so the distance and the bearing between two pins are
 * artifacts of the frame.
 */
const PLOT_DISCLOSURE =
  'Relative positions inside this set, not a map. On-screen distance and direction are not to scale.'

/** Enough live photographs to be an inventory surface, not a lonely thumbnail. */
const PHOTO_SURFACE_MIN = 3
/** First-viewport mosaic: one lead plus a two-column set. The list still holds the rest. */
const PHOTO_SURFACE_MAX = 7

function hasListingPhoto(
  item: V3FieldItem,
): item is V3FieldItem & { photoSrc: string } {
  return typeof item.photoSrc === 'string' && item.photoSrc.trim().length > 0
}

/** The inset that keeps an edge pin off the frame edge, and the box it leaves. */
const PLOT_INSET_PCT = 10
const PLOT_EXTENT_PCT = 100 - PLOT_INSET_PCT * 2

/**
 * Below this, an axis is one place rather than a spread. Two homes 8 m apart
 * carry different coordinates, and normalizing a span that short across the
 * whole box would throw them to opposite edges over a gap a visitor could step
 * across. 1e-4 degrees is about 11 m of latitude, and about 8 m of longitude at
 * 44 N. It also makes the degenerate case a range rather than an exact-equality
 * knife edge, which floating point does not reward.
 */
const MIN_SPAN_DEG = 1e-4

/**
 * Where one coordinate lands on its axis, as a 0..1 fraction of the set's span.
 * An axis with no usable span returns 0.5: with nothing to be relative to, the
 * honest placement is the middle of the axis. Returning 0 would push a single
 * listing, a set sharing one latitude, or a set sharing one longitude into a
 * corner or against an edge, which reads as a position the data never carried.
 */
function axisFraction(value: number, min: number, span: number): number {
  if (span < MIN_SPAN_DEG) return 0.5
  return (value - min) / span
}

/**
 * Places every item that has coordinates inside the bounding box of the set,
 * with a 10% inset so an edge pin is not clipped. When the set changes the box
 * changes and the pins travel, which is the continuity motion section 5 asks
 * for. Items without coordinates are counted, never guessed at.
 */
function plotItems(items: V3FieldItem[]): { pins: PlottedPin[]; missing: number } {
  const geo = items.filter(
    (item): item is V3FieldItem & { lat: number; lng: number } =>
      typeof item.lat === 'number' &&
      Number.isFinite(item.lat) &&
      typeof item.lng === 'number' &&
      Number.isFinite(item.lng),
  )
  if (geo.length === 0) return { pins: [], missing: items.length }

  const lats = geo.map((item) => item.lat)
  const lngs = geo.map((item) => item.lng)
  const south = Math.min(...lats)
  const north = Math.max(...lats)
  const west = Math.min(...lngs)
  const east = Math.max(...lngs)
  const spanLat = north - south
  const spanLng = east - west

  const pins = geo.map((item) => {
    // A single point, or a set on one line, has no span on that axis, and
    // axisFraction centers it there. A one-listing Field puts its pin in the
    // middle of the frame; a set sharing one latitude spreads across the
    // horizontal and holds the vertical center line.
    const acrossFrac = axisFraction(item.lng, west, spanLng)
    const upFrac = axisFraction(item.lat, south, spanLat)
    return {
      item,
      left: PLOT_INSET_PCT + acrossFrac * PLOT_EXTENT_PCT,
      // North is up, so the largest latitude sits at the top of the box.
      top: PLOT_INSET_PCT + (1 - upFrac) * PLOT_EXTENT_PCT,
    }
  })
  return { pins, missing: items.length - geo.length }
}

/* -------------------------------------------------------------------------- */
/* V3Field                                                                     */
/* -------------------------------------------------------------------------- */

export function V3Field({
  ariaLabel,
  items,
  mapSlot,
  children,
  count,
  mapNote,
  footNote,
  emptyMessage = 'No listings in this view.',
  activeId,
  onActiveChange,
  id,
  className,
}: V3FieldProps) {
  const [internalActive, setInternalActive] = useState<string | null>(null)
  const isControlled = activeId === undefined ? false : true
  const active = isControlled ? activeId ?? null : internalActive

  const setActive = useCallback(
    (next: string | null) => {
      if (isControlled === false) setInternalActive(next)
      onActiveChange?.(next)
    },
    [isControlled, onActiveChange],
  )

  const binding = useMemo<V3FieldBinding>(
    () => ({ activeId: active, setActiveId: setActive, items }),
    [active, setActive, items],
  )

  const slot = mapSlot ?? children
  const mapContent = typeof slot === 'function' ? slot(binding) : slot
  const hasSlot =
    mapContent === undefined || mapContent === null || mapContent === false
      ? false
      : true

  const photoItems = useMemo(() => items.filter(hasListingPhoto), [items])
  const usePhotoSurface =
    hasSlot === false && photoItems.length >= PHOTO_SURFACE_MIN
  const mosaic = usePhotoSurface ? photoItems.slice(0, PHOTO_SURFACE_MAX) : []

  const { pins, missing } = useMemo(
    () =>
      hasSlot || usePhotoSurface
        ? { pins: [] as PlottedPin[], missing: 0 }
        : plotItems(items),
    [hasSlot, usePhotoSurface, items],
  )
  // The disclosure is bound to the pins, not to the caller: if this frame drew
  // a pseudo-map, the line that says it is not a map renders with it. No pins
  // means nothing to mislabel, and the missing-coordinates note below covers
  // the set that carried no geography at all. Photographs are not that plot.
  const showPlotDisclosure = hasSlot === false && usePhotoSurface === false && pins.length > 0
  const showMissingNote = hasSlot === false && usePhotoSurface === false && missing > 0

  return (
    <V3FieldBindingContext.Provider value={binding}>
      {/* The token scope. Re-declaring it is idempotent, so the section renders
          correctly whether or not an ancestor already opened one. */}
      <section
        id={id}
        aria-label={ariaLabel}
        className={cn(
          V3_ROOT_CLASS,
          'v3-field',
          usePhotoSurface && 'v3-field--photos',
          className,
        )}
      >
        {count ? (
          <p className="v3-field__count">
            <span className="v3-field__count-value">{count.value}</span>
            {` ${count.label}`}
          </p>
        ) : null}

        <div
          className={cn(
            'v3-field__frame',
            usePhotoSurface && 'v3-field__frame--photos',
          )}
          onMouseLeave={() => setActive(null)}
        >
          <div className="v3-field__col">
            <div
              className={cn(
                'v3-field__map',
                usePhotoSurface && 'v3-field__map--photos',
              )}
            >
              {hasSlot ? (
                mapContent
              ) : usePhotoSurface ? (
                <div className="v3-field__photos">
                  {mosaic.map((item, index) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={cn(
                        'v3-field__photo',
                        index === 0 && 'v3-field__photo--lead',
                        active === item.id && 'is-active',
                      )}
                      aria-label={
                        item.meta
                          ? `${item.priceLabel}, ${item.meta}, ${item.title}`
                          : `${item.priceLabel}, ${item.title}`
                      }
                      onMouseEnter={() => setActive(item.id)}
                      onFocus={() => setActive(item.id)}
                      onBlur={() => setActive(null)}
                    >
                      <img
                        src={item.photoSrc}
                        alt=""
                        width={index === 0 ? 1280 : 640}
                        height={index === 0 ? 720 : 400}
                        loading={index < 3 ? 'eager' : 'lazy'}
                        fetchPriority={index < 3 ? 'high' : 'auto'}
                      />
                      <span
                        className={cn(
                          index === 0 ? 'v3-field__lead-cap' : 'v3-field__photo-cap',
                        )}
                      >
                        <span className="v3-field__photo-price">{item.priceLabel}</span>
                        {item.meta ? (
                          <span className="v3-field__photo-meta">{item.meta}</span>
                        ) : null}
                        <span className="v3-field__photo-title">{item.title}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                /* The plot duplicates the list, so it is hidden from assistive
                   technology and holds nothing focusable. The list is the
                   accessible representation of this data. */
                <div className="v3-field__plot" aria-hidden="true">
                  <div className="v3-field__grid" />
                  {pins.map(({ item, left, top }) => (
                    <span
                      key={item.id}
                      className={cn(
                        'v3-field__pin',
                        active === item.id && 'is-active',
                      )}
                      style={{ left: `${left}%`, top: `${top}%` }}
                      onMouseEnter={() => setActive(item.id)}
                    >
                      <span className="v3-field__pin-label">{item.priceLabel}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            {mapNote ? <p className="v3-field__note">{mapNote}</p> : null}
            {showPlotDisclosure ? (
              <p className="v3-field__note">{PLOT_DISCLOSURE}</p>
            ) : null}
            {showMissingNote ? (
              <p className="v3-field__note">
                {missing === 1
                  ? '1 of these carries no coordinates, so it is listed but not plotted.'
                  : `${missing} of these carry no coordinates, so they are listed but not plotted.`}
              </p>
            ) : null}
          </div>

          {usePhotoSurface ? (
            footNote ? <p className="v3-field__note">{footNote}</p> : null
          ) : (
            <div className="v3-field__col">
              <ul className="v3-field__list" role="list">
                {items.map((item) => (
                  <li key={item.id} className="v3-field__item">
                    <Link
                      href={item.href}
                      className={cn(
                        'v3-field__row',
                        hasListingPhoto(item) && 'v3-field__row--has-photo',
                        active === item.id && 'is-active',
                      )}
                      onMouseEnter={() => setActive(item.id)}
                      onFocus={() => setActive(item.id)}
                      onBlur={() => setActive(null)}
                    >
                      {hasListingPhoto(item) ? (
                        <img
                          className="v3-field__thumb"
                          src={item.photoSrc}
                          alt=""
                          width={120}
                          height={120}
                          loading="lazy"
                        />
                      ) : null}
                      <span className="v3-field__copy">
                        <span className="v3-field__price">{item.priceLabel}</span>
                        <span className="v3-field__title">{item.title}</span>
                        {item.meta ? (
                          <span className="v3-field__meta">{item.meta}</span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
                {items.length === 0 ? (
                  <li className="v3-field__empty">{emptyMessage}</li>
                ) : null}
              </ul>
              {footNote ? <p className="v3-field__note">{footNote}</p> : null}
            </div>
          )}
        </div>

        {count ? (
          <V3SourceLine
            source={count.source}
            updatedAt={count.updatedAt}
            className="v3-field__source"
          />
        ) : null}
      </section>
    </V3FieldBindingContext.Provider>
  )
}
