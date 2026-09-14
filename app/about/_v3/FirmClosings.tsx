'use client'

/**
 * Firm closings as the shadcn carousel + Card demo (SITE-90).
 * Lives beside the page so about/page.tsx never mounts a city-stats Ledger.
 *
 * Catalog: ui/carousel prev/next + peek (md:basis-1/2 lg:basis-1/3). Each
 * slide is a Card: photo, address, recorded ClosePrice, close date,
 * beds/baths/sqft, listing door. As many real closings as the firm record
 * returned — no invented rows.
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

export function FirmClosings({
  id = 'firm-sales',
  rows,
}: {
  id?: string
  rows: readonly V3LedgerFigureRow[]
}) {
  if (rows.length === 0) return null
  return (
    <section id={id} className="about-closings" aria-labelledby="firm-sales-heading">
      <p className="about-closings__eyebrow">Ryan Realty · Closings</p>
      <h2 id="firm-sales-heading" className="about-closings__heading">
        Recent brokerage closings
      </h2>
      <Carousel
        opts={{ align: 'start', loop: false }}
        className="about-closings__carousel w-full"
        aria-label="Ryan Realty closings"
      >
        <CarouselContent>
          {rows.map((row, index) => {
            const key = String(row.id ?? row.href ?? `closing-${index}`)
            return (
              <CarouselItem key={key} className="md:basis-1/2 lg:basis-1/3">
                <div className="p-1">
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
                        <Link href={row.href}>See this closing</Link>
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              </CarouselItem>
            )
          })}
        </CarouselContent>
        {rows.length > 1 ? (
          <>
            <CarouselPrevious />
            <CarouselNext />
          </>
        ) : null}
      </Carousel>
    </section>
  )
}
