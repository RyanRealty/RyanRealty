'use client'

/**
 * Photographed price-cut houses as a V3Carousel rail (shadcn carousel job).
 * Count stays a caption beside the Field; this slot is photographs first.
 */
import Link from 'next/link'
import { V3Carousel } from '@/components/site/v3'
import {
  LISTING_FIELD_LEAD_PHOTO_SIZE,
  listingRowPhotoSrc,
} from '@/lib/listing/row-photo'
import type { PriceDropFieldItem } from './drops-field-items'
import './price-drops-field.css'

export function PriceDropPhotos({ items }: { items: readonly PriceDropFieldItem[] }) {
  // Photographs first: a cut without a plate does not take a gray slot in the rail.
  const photographed = items.filter((item) => Boolean(item.photoSrc?.trim()))
  const rail = photographed.length > 0 ? photographed : items

  return (
    <V3Carousel
      label="Homes with a price cut this week"
      mode="rail"
      className="pd-cuts-rail"
    >
      {rail.map((item, index) => (
        <Link
          key={item.id}
          href={item.href}
          className="pd-card"
          aria-label={
            item.specs
              ? `${item.priceLabel}, ${item.title}, ${item.specs}`
              : `${item.priceLabel}, ${item.title}`
          }
        >
          {item.photoSrc ? (
            <span className="pd-card__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={listingRowPhotoSrc(item.photoSrc, LISTING_FIELD_LEAD_PHOTO_SIZE)}
                alt=""
                width={800}
                height={600}
                className="pd-card__photo"
                loading={index < 8 ? 'eager' : 'lazy'}
                fetchPriority={index < 2 ? 'high' : 'auto'}
                decoding="async"
              />
              {item.overlay ? (
                <span className="pd-card__badge">{item.overlay}</span>
              ) : null}
            </span>
          ) : null}
          <span className="pd-card__body">
            <span className="pd-card__ask">
              <span className="pd-card__price">{item.priceLabel}</span>
              {item.cutShare != null ? (
                <span className="pd-card__cut" aria-hidden="true">
                  <span style={{ width: `${(item.cutShare * 100).toFixed(1)}%` }} />
                </span>
              ) : null}
            </span>
            {item.dropLine ? <span className="pd-card__drop">{item.dropLine}</span> : null}
            <span className="pd-card__addr">{item.title}</span>
            {item.specs ? <span className="pd-card__specs">{item.specs}</span> : null}
          </span>
        </Link>
      ))}
    </V3Carousel>
  )
}
