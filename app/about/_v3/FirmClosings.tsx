'use client'

/**
 * Firm closings as the shadcn Accordion demo (SITE-90 / Critiquito P0-3).
 * Lives beside the page so about/page.tsx never mounts a city-stats Ledger.
 *
 * Catalog: Accordion → AccordionItem → AccordionTrigger + AccordionContent.
 * Trigger carries address + recorded ClosePrice. Open reveals the photo,
 * beds/baths/sqft, and a listing door.
 */

import Link from 'next/link'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, v3Text, V3Heading, V3SourceLine, type V3LedgerFigureRow } from '@/components/site/v3'

const SOURCE = v3Text(
  'Closed MLS sales listed by Ryan Realty. Central Oregon zips starting with 977. Recorded ClosePrice.',
)

export function FirmClosings({ rows }: { rows: readonly V3LedgerFigureRow[] }) {
  if (rows.length === 0) return null
  const first = String(rows[0]?.id ?? rows[0]?.href ?? 'closing-0')
  return (
    <section
      id="firm-sales"
      className={cn(V3_ROOT_CLASS, 'about-closings')}
      aria-labelledby="firm-sales-heading"
    >
      <p className="about-closings__eyebrow">Ryan Realty · Closings</p>
      <V3Heading level={2} id="firm-sales-heading" className="about-closings__heading">
        Recent brokerage closings
      </V3Heading>
      <Accordion type="single" collapsible defaultValue={first} className="about-closings__accordion">
        {rows.map((row, index) => {
          const value = String(row.id ?? row.href ?? `closing-${index}`)
          const facts = [row.when, row.detail].filter(Boolean).join(' · ')
          return (
            <AccordionItem key={value} value={value}>
              <AccordionTrigger>
                <span className="about-closings__trigger">
                  <span className="about-closings__address">{row.what}</span>
                  <span className="about-closings__price">{row.value}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {row.media?.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.media.src} alt="" width={640} height={428} />
                ) : null}
                {facts ? <p className="about-closings__facts">{facts}</p> : null}
                <Button asChild variant="link">
                  <Link href={row.href}>See this closing</Link>
                </Button>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
      <V3SourceLine sourceName={v3Text('Ryan Realty closings')} source={SOURCE} />
    </section>
  )
}
