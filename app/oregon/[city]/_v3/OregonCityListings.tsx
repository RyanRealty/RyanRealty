/**
 * SITE-105 listings — catalog Card Image + Size demos, not a house Ledger.
 *
 * ui.shadcn.com/docs/components/card: image first, then CardHeader
 * (Title, Description, Action), then CardContent. Lead card is default
 * size and spans the measure; the rest are size="sm" for density.
 * Hover/focus reveals the sourced extra fact inside CardContent, not
 * as an orphaned line between cards. No MLS plat / internal `when`.
 */
import Link from 'next/link'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading, V3SourceLine } from '@/components/site/v3'
import { cn } from '@/lib/utils'
import './OregonCityListings.css'

export type OregonCityListingCard = {
  href: string
  address: string
  detail?: string
  price: string
  photoSrc?: string
  reveal?: string
  id: string
}

export function OregonCityListings(props: {
  heading: string
  eyebrow: string
  items: readonly OregonCityListingCard[]
  emptyMessage?: string
  note?: string
  source: string
  actionLabel: string
  actionHref: string
  id?: string
}) {
  const id = props.id ?? 'listings'
  const headingId = `${id}-heading`

  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'oregon-city-listings')}
      aria-labelledby={headingId}
    >
      <V3Eyebrow>{props.eyebrow}</V3Eyebrow>
      <V3Heading level={2} id={headingId}>
        {props.heading}
      </V3Heading>
      {props.note ? <p className="oregon-city-listings__note">{props.note}</p> : null}

      {props.items.length === 0 ? (
        <p className="oregon-city-listings__empty">{props.emptyMessage}</p>
      ) : (
        <div className="oregon-city-listings__grid">
          {props.items.map((item, index) => {
            const lead = index === 0
            return (
              <Link key={item.id} href={item.href} className="oregon-city-listings__link">
                <Card
                  size={lead ? 'default' : 'sm'}
                  className={lead ? 'oregon-city-listings__lead' : undefined}
                >
                  {item.photoSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.photoSrc}
                      alt=""
                      className="oregon-city-listings__photo"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : null}
                  <CardHeader>
                    <CardTitle>{item.address}</CardTitle>
                    {item.detail ? <CardDescription>{item.detail}</CardDescription> : null}
                    <CardAction>{item.price}</CardAction>
                  </CardHeader>
                  {item.reveal ? (
                    <CardContent className="hidden group-hover/card:block group-focus-within/card:block">
                      {item.reveal}
                    </CardContent>
                  ) : null}
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      <V3SourceLine source={props.source} className="oregon-city-listings__source" />
      <div className="oregon-city-listings__action">
        <Button asChild variant="outline">
          <Link href={props.actionHref}>{props.actionLabel}</Link>
        </Button>
      </div>
    </section>
  )
}
