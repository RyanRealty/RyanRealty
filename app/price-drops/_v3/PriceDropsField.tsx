/**
 * Photographed price-cut houses. Count is a caption beside the Field.
 * The page mounts V3Field so mockup-parity and the hidden-home contract
 * still see the Field import on the route file.
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3Heading, V3_ROOT_CLASS } from '@/components/site/v3'
import {
  LISTING_FIELD_LEAD_PHOTO_SIZE,
  listingRowPhotoSrc,
} from '@/lib/listing/row-photo'
import type { PriceDropFieldItem } from './drops-field-items'
import './price-drops-field.css'

export function PriceDropPhotos({ items }: { items: readonly PriceDropFieldItem[] }) {
  return (
    <ul className="m-0 grid list-none gap-6 p-0">
      {items.map((item, index) => (
        <li key={item.id} className="min-w-0">
          <Link
            href={item.href}
            className="grid gap-2 text-foreground no-underline"
          >
            {item.photoSrc ? (
              <span className="relative block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={listingRowPhotoSrc(item.photoSrc, LISTING_FIELD_LEAD_PHOTO_SIZE)}
                  alt=""
                  width={720}
                  height={192}
                  className="h-48 w-full object-cover"
                  loading={index < 2 ? 'eager' : 'lazy'}
                  fetchPriority={index === 0 ? 'high' : 'auto'}
                />
                {item.overlay ? (
                  <span className="absolute bottom-2 left-2 bg-foreground/70 px-2 py-1 text-sm text-primary-foreground">
                    {item.overlay}
                  </span>
                ) : null}
              </span>
            ) : item.overlay ? (
              <span className="text-sm text-muted-foreground">{item.overlay}</span>
            ) : null}
            <span className="pd-card__ask">
              <span className="text-base font-medium tabular-nums">{item.priceLabel}</span>
              {/* THE CUT AS A MARK, not only as a percent in the meta line
                  (SITE-49). One ratio, one meter: the fill is this home's cut
                  as a share of the deepest cut on the page, so the rows read
                  against each other the way the strip above reads. A row with
                  no percent draws no track. */}
              {item.cutShare != null ? (
                <span className="pd-card__cut" aria-hidden="true">
                  <span style={{ width: `${(item.cutShare * 100).toFixed(1)}%` }} />
                </span>
              ) : null}
            </span>
            <span className="break-words text-sm">{item.title}</span>
            {item.meta ? (
              <span className="text-sm text-muted-foreground">{item.meta}</span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function PriceDropsOpening({
  heading,
  headline,
  captionValue,
  captionLabel,
}: {
  heading: string
  headline?: string
  captionValue: string
  captionLabel: string
}) {
  const title = headline ?? heading
  return (
    <div className={cn(V3_ROOT_CLASS, 'mx-auto max-w-6xl px-4 pt-8')}>
      {/* THE COUNT SITS UNDER THE HEADING AT EVERY WIDTH. Split across the row
          at md and up, it floated alone in the top-right with nothing aligning
          it to the H1 or to the drawing that counts the same cuts — "a stray
          fragment" (evaluator, 2026-09-09), while the phone layout already had
          it right. One placement, the one that reads. */}
      <div className="mb-6 flex flex-col gap-2">
        <V3Heading level={1}>{title}</V3Heading>
        <p className="text-sm text-muted-foreground">
          <span className="tabular-nums text-foreground">{captionValue}</span>
          {` ${captionLabel}`}
        </p>
      </div>
    </div>
  )
}
