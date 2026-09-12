/**
 * Firm closings as shadcn Cards (SITE-90). Lives beside the page so
 * about/page.tsx never mounts a city-stats Ledger (check-publish-months-of-supply).
 *
 * Catalog composition from ui.shadcn.com/docs/components/card:
 *   Card → photo → CardHeader → CardTitle / CardDescription / CardAction
 */

import Link from 'next/link'
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, v3Text, V3Heading, V3SourceLine, type V3LedgerFigureRow } from '@/components/site/v3'

const SOURCE = v3Text(
  'Closed MLS sales listed by Ryan Realty. Central Oregon zips starting with 977. Recorded ClosePrice.',
)

export function FirmClosings({ rows }: { rows: readonly V3LedgerFigureRow[] }) {
  if (rows.length === 0) return null
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
      <ul className="about-closings__grid">
        {rows.map((row) => (
          <li key={row.id ?? row.href}>
            <Link href={row.href} className="about-closings__link">
              <Card size="sm">
                {row.media?.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.media.src} alt="" width={640} height={428} />
                ) : null}
                <CardHeader>
                  <CardTitle>{row.what}</CardTitle>
                  {row.when || row.detail ? (
                    <CardDescription>
                      {[row.when, row.detail].filter(Boolean).join(' · ')}
                    </CardDescription>
                  ) : null}
                  <CardAction>{row.value}</CardAction>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      <V3SourceLine sourceName={v3Text('Ryan Realty closings')} source={SOURCE} />
    </section>
  )
}
