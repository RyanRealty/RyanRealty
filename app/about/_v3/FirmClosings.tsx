'use client'

/**
 * Firm closings as the shadcn carousel demo (SITE-90 / Matt 2026-09-12).
 * Lives beside the page so about/page.tsx never mounts a city-stats Ledger.
 *
 * Catalog: V3Carousel → ui/carousel (prev/next, rail peek). Each slide is a
 * shadcn Card (ui/card): photo, the address as the CardTitle (the whole Card
 * is the listing door, so the title is its name), the close month as the
 * CardDescription, then the recorded ClosePrice and the house row (beds ·
 * baths · sqft · subdivision) in the CardContent. As many real closings as
 * the firm record returned — no invented rows, no MOS. The count in the
 * heading is the rows on the rail.
 */

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
      <div className="about-closings__head">
        <p className="about-closings__eyebrow">Ryan Realty · Closings</p>
        <V3Heading level={2} id="firm-sales-heading" className="about-closings__heading">
          {rows.length} recent brokerage closings
        </V3Heading>
      </div>
      <V3Carousel label="Ryan Realty closings" mode="rail" className="about-closings__carousel">
        {rows.map((row, index) => {
          const key = String(row.id ?? row.href ?? `closing-${index}`)
          return (
            // The whole Card is the listing door (one 44px+ target, no nested
            // control); its accessible name is the address.
            <Link key={key} href={row.href} className="about-closings__door" title="See this closing">
              <Card size="sm" className="about-closings__card">
                {row.media?.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.media.src} alt="" width={800} height={450} loading={index < 2 ? 'eager' : 'lazy'} decoding="async" />
                ) : (
                  <div className="about-closings__nophoto" aria-hidden="true" />
                )}
                {/* The Card as the demo reads it: title + description in the
                    header (the address is the door's name, the close month
                    under it), the figures in the body. */}
                <CardHeader className="about-closings__card-head">
                  <CardTitle className="about-closings__addr">{row.what}</CardTitle>
                  {row.when ? <CardDescription className="about-closings__when">{row.when}</CardDescription> : null}
                </CardHeader>
                <CardContent className="about-closings__card-body">
                  <span className="about-closings__price">{row.value}</span>
                  {row.detail ? <span className="about-closings__facts">{row.detail}</span> : null}
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </V3Carousel>
    </section>
  )
}
