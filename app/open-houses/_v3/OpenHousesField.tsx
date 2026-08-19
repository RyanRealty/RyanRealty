/**
 * Photographed open houses. Count is a caption beside the Field, never a
 * number hero. When sits on the photo. One list, no stamp mosaic + echo.
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  V3Field,
  V3Heading,
  V3SourceLine,
  V3_ROOT_CLASS,
} from '@/components/site/v3'
import type { OpenHouseFieldItem } from './oh-field-items'
import './open-houses-field.css'

function OpenHousePhotos({ items }: { items: readonly OpenHouseFieldItem[] }) {
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
                  src={item.photoSrc}
                  alt=""
                  width={720}
                  height={192}
                  className="h-48 w-full object-cover"
                  loading={index < 2 ? 'eager' : 'lazy'}
                  fetchPriority={index < 2 ? 'high' : 'auto'}
                />
              </span>
            ) : null}
            {item.when ? (
              <span className="text-sm text-muted-foreground">{item.when}</span>
            ) : null}
            <span className="text-base font-medium tabular-nums">{item.priceLabel}</span>
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

export function OpenHousesField({
  heading,
  headline,
  captionValue,
  captionLabel,
  source,
  items,
  ariaLabel,
  emptyMessage,
}: {
  heading: string
  headline?: string
  captionValue: string
  captionLabel: string
  source: string
  items: readonly OpenHouseFieldItem[]
  ariaLabel: string
  emptyMessage: string
}) {
  const [first] = items
  const title = headline ?? heading
  return (
    <div className={cn(V3_ROOT_CLASS, 'mx-auto max-w-6xl px-4 pt-8')}>
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <V3Heading level={1}>{title}</V3Heading>
        {first ? (
          <p className="text-sm text-muted-foreground">
            <span className="tabular-nums text-foreground">{captionValue}</span>
            {` ${captionLabel}`}
          </p>
        ) : null}
      </div>
      <V3Field
        id="calendar"
        className="oh-homes-field"
        ariaLabel={ariaLabel}
        items={[...items]}
        mapSlot={first ? <OpenHousePhotos items={items} /> : undefined}
        emptyMessage={emptyMessage}
      />
      {first ? <V3SourceLine source={source} className="mt-6" /> : null}
    </div>
  )
}
