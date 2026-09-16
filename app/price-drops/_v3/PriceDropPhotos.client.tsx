'use client'

/**
 * The week's cuts as a field of cut houses on the installed shadcn carousel
 * (`@/components/ui/carousel` through the house wrapper `V3Carousel`).
 *
 * SITE-108. The 2026-09-15 evaluator scored the old cell "photo, badge, price,
 * address — indistinguishable from a portal's price-reduced search results",
 * and the control "a strip of same-size cards with overlay chevrons", not the
 * shadcn Carousel a visitor would recognise. Both are answered here:
 *
 *  · THE CARD IS A CUT, not a listing tile. The percent is the headline and
 *    the photograph is its evidence; under the percent sits a meter whose
 *    track is the deepest cut ON THIS PAGE and whose notch is the middle cut
 *    on this page, so two cards compare at a glance instead of asking the
 *    reader to subtract two percents. The drawing directly under the rail
 *    names that notch, so the scale is explained once rather than by a
 *    template clause repeating down 48 cards. Beside the percent sits what
 *    the seller actually gave up ("$300,000 off the ask"), and under the
 *    specs, how fresh the cut is ("Cut 2 days ago") — neither of which the
 *    old card carried. Price, prior ask, address and beds/baths/sqft all
 *    stay: nothing the page carried is gone.
 *  · THE DEEPEST CUT LEADS at a wider slide, so the opening reads as an
 *    edited field rather than a grid of equal tiles.
 *  · THE CONTROL IS THE DEMO'S. shadcn's own prev/next, flanking the track
 *    from OUTSIDE it, painted navy on cream; `.pd-cuts-stage` is the room
 *    they need (the same stage `place-type` uses).
 *
 * Every figure on the card comes off the one getPriceDrops call the route
 * makes. Nothing here rounds, estimates or fills a gap (§0): a row with no
 * percent draws no meter, and a row with no cut amount prints none.
 */
import Link from 'next/link'
import { V3Carousel } from '@/components/site/v3'
import {
  LISTING_FIELD_LEAD_PHOTO_SIZE,
  listingRowPhotoSrc,
} from '@/lib/listing/row-photo'
import type { PriceDropFieldItem } from './drops-field-items'
import './price-drops-field.css'

function pctWidth(share: number): string {
  return `${(Math.min(1, Math.max(0, share)) * 100).toFixed(1)}%`
}

export function PriceDropPhotos({ items }: { items: readonly PriceDropFieldItem[] }) {
  // Photographs first: a cut without a plate does not take a gray slot in the rail.
  const photographed = items.filter((item) => Boolean(item.photoSrc?.trim()))
  const rail = photographed.length > 0 ? photographed : items

  return (
    <div className="pd-cuts-stage">
      <V3Carousel
        label="Homes with a price cut this week, deepest cut first"
        mode="rail"
        className="pd-cuts-rail"
      >
        {rail.map((item, index) => (
          <Link
            key={item.id}
            href={item.href}
            className="pd-cut"
            data-lead={index === 0 ? 'true' : undefined}
            aria-label={[
              item.cutLabel,
              item.cutAmountLabel,
              item.priceLabel,
              item.wasLabel,
              item.title,
              item.specs,
              item.cutAgo,
            ]
              .filter((part): part is string => Boolean(part))
              .join(', ')}
          >
            {item.photoSrc ? (
              <span className="pd-cut__media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={listingRowPhotoSrc(item.photoSrc, LISTING_FIELD_LEAD_PHOTO_SIZE)}
                  alt=""
                  width={800}
                  height={600}
                  className="pd-cut__photo"
                  loading={index < 8 ? 'eager' : 'lazy'}
                  fetchPriority={index < 2 ? 'high' : 'auto'}
                  decoding="async"
                />
              </span>
            ) : null}
            <span className="pd-cut__body">
              {item.cutLabel ? (
                <span className="pd-cut__mark">
                  <span className="pd-cut__pct">{item.cutLabel}</span>
                  {item.cutAmountLabel ? (
                    <span className="pd-cut__off">{item.cutAmountLabel}</span>
                  ) : null}
                </span>
              ) : null}
              {item.cutShare != null ? (
                <span className="pd-cut__meter" aria-hidden="true">
                  <span
                    className="pd-cut__fill"
                    style={{ width: pctWidth(item.cutShare) }}
                  />
                  {item.medianShare != null ? (
                    <span
                      className="pd-cut__median"
                      style={{ insetInlineStart: pctWidth(item.medianShare) }}
                    />
                  ) : null}
                </span>
              ) : null}
              <span className="pd-cut__ask">
                <span className="pd-cut__now">{item.priceLabel}</span>
                {item.wasLabel ? <span className="pd-cut__was">{item.wasLabel}</span> : null}
              </span>
              <span className="pd-cut__addr">{item.title}</span>
              {item.specs ? <span className="pd-cut__specs">{item.specs}</span> : null}
              {item.cutAgo ? <span className="pd-cut__when">{item.cutAgo}</span> : null}
            </span>
          </Link>
        ))}
      </V3Carousel>
    </div>
  )
}
