'use client'

/**
 * SITE-105 listings — official shadcn Card Image + Empty demos, then navy/cream.
 *
 * Card composition is the docs demo (ui.shadcn.com/docs/components/card):
 * img first, CardHeader (Title, Description, Action), CardContent, CardFooter.
 * No house lead span. No 2-col photo|void split. Content stays in the stack.
 *
 * Empty composition is the docs demo (ui.shadcn.com/docs/components/empty):
 * Empty, EmptyHeader (Media, Title, Description), EmptyContent. Tabs switch
 * live / empty / feed-miss so those catalog demoStates are capturable.
 */
import Link from 'next/link'
import { HomeIcon, InboxIcon } from 'lucide-react'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

export type OregonCityListingView = 'live' | 'empty' | 'feed-miss'

export function OregonCityListings(props: {
  heading: string
  eyebrow: string
  items: readonly OregonCityListingCard[]
  emptyMessage: string
  feedMissMessage: string
  note?: string
  source: string
  actionLabel: string
  actionHref: string
  id?: string
  forcedView?: OregonCityListingView
}) {
  const id = props.id ?? 'listings'
  const headingId = `${id}-heading`
  const defaultView: OregonCityListingView =
    props.forcedView ?? (props.items.length > 0 ? 'live' : 'empty')

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

      <Tabs defaultValue={defaultView} className="oregon-city-listings__tabs">
        <TabsList variant="line">
          <TabsTrigger value="live" data-demo-state="live">
            On the market
          </TabsTrigger>
          <TabsTrigger value="empty" data-demo-state="empty">
            No matches
          </TabsTrigger>
          <TabsTrigger value="feed-miss" data-demo-state="feed-miss">
            Feed miss
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live">
          {props.items.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {props.items.map((item) => (
                <Card key={item.id} size="sm">
                  {item.photoSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.photoSrc}
                      alt=""
                      className="aspect-video w-full object-cover"
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
                    <CardContent>
                      <p>{item.reveal}</p>
                    </CardContent>
                  ) : (
                    <CardContent>
                      <p>{item.detail ?? item.price}</p>
                    </CardContent>
                  )}
                  <CardFooter>
                    <Button asChild variant="outline" size="sm">
                      <Link href={item.href}>Open</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <ListingEmpty
              title="No matches"
              description={props.emptyMessage}
              actionLabel={props.actionLabel}
              actionHref={props.actionHref}
              icon="home"
            />
          )}
        </TabsContent>

        <TabsContent value="empty">
          <ListingEmpty
            title="No matches"
            description={props.emptyMessage}
            actionLabel={props.actionLabel}
            actionHref={props.actionHref}
            icon="home"
          />
        </TabsContent>

        <TabsContent value="feed-miss">
          <ListingEmpty
            title="Feed miss"
            description={props.feedMissMessage}
            actionLabel={props.actionLabel}
            actionHref={props.actionHref}
            icon="inbox"
          />
        </TabsContent>
      </Tabs>

      <V3SourceLine source={props.source} className="oregon-city-listings__source" />
    </section>
  )
}

function ListingEmpty(props: {
  title: string
  description: string
  actionLabel: string
  actionHref: string
  icon: 'home' | 'inbox'
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {props.icon === 'inbox' ? <InboxIcon /> : <HomeIcon />}
        </EmptyMedia>
        <EmptyTitle>{props.title}</EmptyTitle>
        <EmptyDescription>{props.description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href={props.actionHref}>{props.actionLabel}</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
