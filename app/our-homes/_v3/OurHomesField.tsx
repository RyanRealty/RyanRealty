/**
 * Office inventory Field. PUBLIC_UI.md §3 Homes: houses fill the fold.
 * Count is a caption. Towns are filters. The next tap is a house.
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  V3Button,
  V3Field,
  V3Heading,
  V3SourceLine,
  V3_ROOT_CLASS,
  type V3FieldItem,
} from '@/components/site/v3'
import './our-homes-field.css'

function OurHomePhotos({ items }: { items: readonly V3FieldItem[] }) {
  return (
    <ul className="m-0 grid list-none gap-6 p-0">
      {items.map((item, index) => (
        <li key={item.id} className="min-w-0">
          <Link href={item.href} className="grid gap-2 text-foreground no-underline">
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

export function OurHomesField({
  heading,
  captionValue,
  captionLabel,
  source,
  items,
  towns,
  emptyMessage,
}: {
  heading: string
  captionValue: string
  captionLabel: string
  source: string
  items: readonly V3FieldItem[]
  towns: readonly { label: string; href: string }[]
  emptyMessage: string
}) {
  const [first] = items
  const [firstTown, ...restTowns] = towns
  return (
    <div className={cn(V3_ROOT_CLASS, 'mx-auto max-w-6xl px-4 pt-8')}>
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <V3Heading level={1}>{heading}</V3Heading>
        {first ? (
          <p className="text-sm text-muted-foreground">
            <span className="tabular-nums text-foreground">{captionValue}</span>
            {` ${captionLabel}`}
          </p>
        ) : null}
      </div>
      {firstTown ? (
        <nav aria-label="Towns" className="mb-6 flex flex-wrap gap-2">
          <V3Button href={firstTown.href} variant="ghost">
            {firstTown.label}
          </V3Button>
          {restTowns.map((town) => (
            <V3Button key={town.href} href={town.href} variant="ghost">
              {town.label}
            </V3Button>
          ))}
        </nav>
      ) : null}
      <V3Field
        id="listed"
        className="our-homes-field"
        ariaLabel="Homes listed by Ryan Realty"
        items={[...items]}
        mapSlot={first ? <OurHomePhotos items={items} /> : undefined}
        emptyMessage={emptyMessage}
      />
      {first ? <V3SourceLine source={source} className="mt-6" /> : null}
    </div>
  )
}
