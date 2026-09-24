/**
 * ZIP inventory Field (SITE-114). City grain opening: claim-first sentence,
 * Atlas drawing beside the MOS figure + alerts sentence, then this ZIP's
 * photographed houses as the beUI masonry object. Count agrees with the
 * market Instrument. Atlas is the map — not a Google default embed.
 */
import type { ReactNode } from 'react'
import {
  V3Atlas,
  V3Heading,
  V3MosBars,
  V3SourceLine,
  v3Text,
  type AtlasDot,
  type AtlasEvent,
  type AtlasRegion,
  type AtlasType,
  type V3Text,
} from '@/components/site/v3'
import type { Basemap } from '@/lib/geo/basemap'
import type { PlaceMosView } from '@/lib/site/place-mos'
import { ZipClaim } from './ZipClaim.client'
import { ZipHomesMasonry } from './ZipHomesMasonry.client'
import type { ZipMasonryItem } from './zip-constants'
import { zipLeadItem } from './zip-constants'
import './zip-opening.css'
import { cityMarketPath } from '@/lib/market/canonical-market-path'

export function ZipHomesField({
  zip,
  area,
  city,
  citySlug,
  headline,
  claimCount,
  claimNoun,
  claimHref,
  cityHref,
  browseHref,
  masonryItems,
  caption,
  source,
  emptyMessage,
  boundary,
  atlas,
  mos,
  alerts,
}: {
  zip: string
  area: string
  city: string
  /** Market-report cache slug for the parent city (SEO door). */
  citySlug: string
  headline: V3Text
  /** Sourced active count shared with the market Instrument. Null omits the claim. */
  claimCount: number | null
  claimNoun: string
  claimHref: string
  cityHref: string
  browseHref: string
  masonryItems: readonly ZipMasonryItem[]
  caption: string | null
  source: string
  emptyMessage: string
  /** Census TIGER ZCTA for this ZIP. Null when the boundary row is missing. */
  boundary?: GeoJSON.Polygon | GeoJSON.MultiPolygon | null
  atlas: {
    dots: readonly AtlasDot[]
    regions: readonly AtlasRegion[]
    basemap: Basemap | null
    types: readonly AtlasType[]
    events: readonly AtlasEvent[]
    source: string
    stamp: string
    incomplete: boolean
  }
  mos: PlaceMosView | null
  /** ZipAlertsSheet mount — figure column beside the Atlas. */
  alerts: ReactNode
}) {
  const showAtlas = atlas.dots.length > 0 || (boundary != null && atlas.regions.length > 0)
  // Keep house marks + the house type chip so the dock scrubber cannot disagree
  // with the H1 / MOS inventory figure on first paint (city fold pattern).
  const foldAtlasDots = atlas.dots.filter((d) => d.t === 'house')
  const foldAtlasTypes = atlas.types.filter((t) => t.key === 'house')
  const foldDots = foldAtlasDots.length > 0 ? foldAtlasDots : atlas.dots
  const foldTypes = foldAtlasTypes.length > 0 ? foldAtlasTypes : atlas.types
  const lead = zipLeadItem(masonryItems)

  return (
    <div className="zip-opening">
      <V3Heading level={1} size="field" className="v3-field-place-name">
        {headline}
      </V3Heading>

      {claimCount != null && claimCount > 0 ? (
        <ZipClaim
          count={claimCount}
          zip={zip}
          area={area}
          noun={claimNoun}
          href={claimHref}
        />
      ) : null}

      <p className="zip-opening__doors">
        <a href={cityHref}>{city} real estate</a>
        {' · '}
        <a href={browseHref}>{zip} homes for sale</a>
        {' · '}
        <a href={cityMarketPath(citySlug)}>{city} market report</a>
        {' · '}
        <a href="/months-of-supply">Months of supply</a>
      </p>

      <div className="zip-opening__stage">
        {showAtlas ? (
          <div className="zip-opening__drawing">
            <V3Atlas
              id="atlas"
              headingLevel={2}
              headline={v3Text(`${zip} on the map`)}
              headlineTone="eyebrow"
              /* Inventory count lives in the H1 claim + MOS (same activeCount).
                 Atlas claimTone inventory would print every property type inside
                 the ZCTA and disagree with that detached figure. */
              claimTone="none"
              claimText="Every listing inside this ZIP's recorded boundary. Hover a mark for the home. Type chips and the price scrubber filter this set."
              keyPlacement="dock"
              sourceName="Oregon Data Share"
              dots={foldDots}
              regions={atlas.regions}
              basemap={atlas.basemap}
              types={foldTypes}
              events={atlas.events}
              source={
                foldAtlasDots.length > 0
                  ? `Detached single-family (Houses) active and pending marks inside ZIP ${zip}, from the same Oregon Data Share listing tiles the map draws. Price scrubber filters this set.`
                  : atlas.source
              }
              stamp={atlas.stamp}
              incomplete={atlas.incomplete}
            />
          </div>
        ) : null}

        <aside className="zip-opening__figure">
          {mos ? (
            <V3MosBars
              caption={mos.caption}
              plainLabel={mos.plainLabel}
              homesName={mos.homesName}
              homesLabel={mos.homesLabel}
              homesValue={mos.homesValue}
              salesName={mos.salesName}
              salesLabel={mos.salesLabel}
              salesValue={mos.salesValue}
              source={mos.source}
              asOf={mos.asOf}
              sourceName="Oregon Data Share"
              tooltip={mos.tooltip}
            />
          ) : null}
          {alerts}
        </aside>
      </div>

      {lead?.photoSrc ? (
        <a href={lead.href} className="zip-opening__lead">
          <img
            src={lead.photoSrc}
            alt={lead.title}
            width={1600}
            height={900}
            className="zip-opening__lead-photo"
          />
          <span className="zip-opening__lead-copy">
            <span className="zip-opening__lead-price">{lead.priceLabel}</span>
            <span className="zip-opening__lead-title">{lead.title}</span>
            {lead.meta ? <span className="zip-opening__lead-meta">{lead.meta}</span> : null}
          </span>
        </a>
      ) : null}

      <ZipHomesMasonry zip={zip} items={masonryItems} emptyMessage={emptyMessage} />
      {masonryItems.length > 0 ? <V3SourceLine source={source} /> : null}
      {caption ? <p className="zip-opening__caption">{caption}</p> : null}
    </div>
  )
}
