/**
 * TrustStrip — shared LP trust band per the approved Figma component spec:
 * five navy stars + "5.0 · Google reviews" + divider + three overlapping
 * broker avatars + "Bend brokers, licensed in Oregon".
 *
 * Server component. Review count comes from lib/testimonials.ts (verified
 * GBP reviews — the same number a visitor sees on the live Google profile).
 * Broker headshots are the canonical transparent PNGs at
 * public/images/brokers/ (CLAUDE.md broker-headshot spec).
 */

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { TESTIMONIALS } from '@/lib/testimonials'

const BROKER_AVATARS = [
  { src: '/images/brokers/ryan-matt.png', alt: 'Matt Ryan, Principal Broker' },
  { src: '/images/brokers/stevenson-paul.png', alt: 'Paul Stevenson, Broker' },
  { src: '/images/brokers/peterson-rebecca.png', alt: 'Rebecca Peterson, Broker' },
]

export function TrustStrip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5',
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          role="img"
          aria-label="Rated five out of five stars"
          className="text-lg leading-none tracking-tight text-primary"
        >
          <span aria-hidden="true">★★★★★</span>
        </span>
        <p className="text-sm font-semibold text-foreground">
          5.0 · Google reviews
          <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
            ({TESTIMONIALS.length})
          </span>
        </p>
      </div>

      <div className="hidden h-8 w-px bg-primary/12 sm:block" aria-hidden="true" />

      <div className="flex items-center gap-3">
        <div className="flex -space-x-2.5">
          {BROKER_AVATARS.map((b) => (
            <span
              key={b.src}
              className="relative inline-block h-10 w-10 overflow-hidden rounded-full bg-secondary ring-2 ring-background"
            >
              <Image
                src={b.src}
                alt={b.alt}
                fill
                sizes="40px"
                className="object-cover object-top"
              />
            </span>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Bend brokers, licensed in Oregon</p>
      </div>
    </div>
  )
}
