'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { BrokerRow } from '@/app/actions/brokers'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type Props = {
  broker: BrokerRow
}

/** Single broker card: headshot, name, contact, tagline. Used in carousel next to CTA. */
export default function BrokerCardCompact({ broker }: Props) {
  const name = broker.display_name ?? 'Agent'
  const photo = broker.photo_url?.trim() || null
  const tagline = (broker.tagline ?? broker.title ?? '').trim().slice(0, 120)

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-4">
        <div className="flex gap-4">
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full bg-border">
            {photo ? (
              <Image src={photo} alt={`${name} — real estate agent`} width={64} height={64} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-primary/10" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-primary">{name}</h3>
            {broker.title && <p className="text-xs text-muted-foreground">{broker.title}</p>}
            {tagline && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{tagline}</p>}
            <div className="mt-2 space-y-0.5 text-sm">
              {broker.email && (
                <a href={`mailto:${broker.email}`} className="block truncate text-accent-foreground hover:underline">
                  {broker.email}
                </a>
              )}
              {broker.phone && (
                <a href={`tel:${broker.phone}`} className="block text-muted-foreground hover:underline">
                  {broker.phone}
                </a>
              )}
            </div>
          </div>
        </div>
        <Button asChild className="mt-4 w-full">
          <Link href={`/team/${encodeURIComponent(broker.slug)}`}>
            Meet {name.split(/\s+/)[0] ?? name}
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
