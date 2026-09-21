'use client'

/**
 * /team closings rail — the shadcn carousel + Card demo (SITE-113).
 *
 * Catalog: ui/carousel prev/next + peek (md:basis-1/2). Each slide is a Card:
 * photo, address, recorded ClosePrice, close date, beds/baths/sqft, listing
 * door. The Card is one Link to the row's existing listing href.
 */

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import type { V3LedgerFigureRow } from '@/components/site/v3'
import './team-closings.css'

export function TeamClosings({
  id = 'closings-rail',
  rows,
}: {
  id?: string
  rows: readonly V3LedgerFigureRow[]
}) {
  if (rows.length === 0) return null
  return (
    <section id={id} className="team-closings" aria-labelledby="team-closings-heading">
      <p className="team-closings__eyebrow">Recorded closings</p>
      <h2 id="team-closings-heading" className="team-closings__heading">
        Houses the brokers closed
      </h2>
      <div className="team-closings__stage">
        <Carousel
          opts={{ align: 'start', loop: false }}
          className="team-closings__carousel w-full"
          aria-label="Ryan Realty recorded closings"
        >
          <CarouselContent>
            {rows.map((row, index) => {
              const key = String(row.id ?? row.href ?? `closing-${index}`)
              const href = row.href.trim()
              const card = (
                <Card>
                  {row.media?.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.media.src} alt="" width={800} height={600} />
                  ) : null}
                  <CardHeader>
                    <CardTitle>{row.what}</CardTitle>
                    <CardDescription>{row.value}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {row.when ? <p>{row.when}</p> : null}
                    {row.detail ? <p>{row.detail}</p> : null}
                  </CardContent>
                  <CardFooter>
                    <Button asChild variant="link">
                      <span>See this closing</span>
                    </Button>
                  </CardFooter>
                </Card>
              )
              return (
                <CarouselItem key={key} className="basis-[86%] md:basis-1/2">
                  <div className="p-1">
                    {href ? (
                      <Link href={href} className="team-closings__card-link">
                        {card}
                      </Link>
                    ) : (
                      card
                    )}
                  </div>
                </CarouselItem>
              )
            })}
          </CarouselContent>
          {rows.length > 1 ? (
            <>
              {/* size-11 is 44x44. The carousel default is icon-sm (size-7,
                  28px), which is the only unexcused tap target on the public
                  site: WCAG 2.5.8 wants 44x44, and these arrows have no
                  equivalent full-size control on this page to borrow from. */}
              <CarouselPrevious className="size-11" />
              <CarouselNext className="size-11" />
            </>
          ) : null}
        </Carousel>
      </div>
    </section>
  )
}
