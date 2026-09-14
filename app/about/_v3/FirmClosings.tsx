'use client'

/**
 * Firm closings as the shadcn carousel demo (SITE-90 / Matt 2026-09-12).
 * Lives beside the page so about/page.tsx never mounts a city-stats Ledger.
 *
 * Catalog: V3Carousel → ui/carousel (prev/next, rail peek). Each slide is a
 * Card: photo, address, recorded ClosePrice, close date, beds/baths/sqft,
 * listing door. Mini 2026-09-14: not a photo-only thumbnail strip.
 * As many real closings as the firm record returned — no invented rows.
 */

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Carousel, V3Heading, type V3LedgerFigureRow } from '@/components/site/v3'

export function FirmClosings({
  id = 'firm-sales',
  rows,
}: {
  id?: string
  rows: readonly V3LedgerFigureRow[]
}) {
  if (rows.length === 0) return null
  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'about-closings')}
      aria-labelledby="firm-sales-heading"
    >
      <p className="about-closings__eyebrow">Ryan Realty · Closings</p>
      <V3Heading level={2} id="firm-sales-heading" className="about-closings__heading">
        Recent brokerage closings
      </V3Heading>
      <V3Carousel label="Ryan Realty closings" mode="rail" className="about-closings__carousel">
        {rows.map((row, index) => {
          const key = String(row.id ?? row.href ?? `closing-${index}`)
          return (
            <Card key={key} className="about-closings__card">
              {row.media?.src ? (
                <div className="about-closings__photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.media.src} alt="" width={800} height={600} />
                </div>
              ) : null}
              <CardHeader>
                <CardTitle>{row.what}</CardTitle>
                <CardDescription>{row.value}</CardDescription>
              </CardHeader>
              <CardContent>
                {row.when ? <p className="about-closings__when">{row.when}</p> : null}
                {row.detail ? <p className="about-closings__specs">{row.detail}</p> : null}
                <Button asChild variant="link">
                  <Link href={row.href}>See this closing</Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </V3Carousel>
    </section>
  )
}
