'use client'

import Image from 'next/image'
import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { CATEGORY_TONE, type LifestyleCard as LifestyleCardData } from '@/lib/pulse-lifestyle-cards'
import { recordLike } from '@/lib/pulse-signals'
import { trackEvent } from '@/lib/tracking'

type Props = {
  card: LifestyleCardData
  position?: number
}

/**
 * Lifestyle card in the /pulse feed. Simplified, photo-first.
 *
 * Layout: full-bleed photo, one chip (category) top-left, one tight content
 * block bottom-left. No date-meta pill, no redundant location tag, no word
 * wrap. CTA on the side as a tappable arrow rather than another button.
 */
export default function LifestyleCard({ card, position }: Props) {
  const tone = CATEGORY_TONE[card.category]
  const external = card.href.startsWith('http')

  function handleClick() {
    // Click on a lifestyle card is itself a soft preference signal — we count
    // it toward the user's category profile so subsequent feed renders bring
    // more of what they explore.
    recordLike({ source: 'lifestyle', category: card.category })
    trackEvent('click_cta', {
      source: 'pulse_lifestyle_card',
      lifestyle_card_id: card.id,
      lifestyle_category: card.category,
      position: position ?? null,
      href: card.href,
    })
  }

  const Wrapper = external ? 'a' : Link
  const wrapperProps = external
    ? { href: card.href, target: '_blank', rel: 'noopener noreferrer' }
    : { href: card.href }

  return (
    <article
      className="group relative isolate overflow-hidden rounded-2xl shadow-lg"
      style={{ scrollSnapAlign: 'start' }}
    >
      <Wrapper
        {...wrapperProps}
        onClick={handleClick}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`${card.kicker}: ${card.headline}`}
      >
        <div className="relative aspect-[9/16] w-full bg-foreground text-background">
          <Image
            src={card.backgroundImage}
            alt={card.backgroundAlt}
            fill
            sizes="(max-width: 640px) 100vw, 540px"
            className="object-cover"
            priority={false}
          />
          <div className={cn('absolute inset-0 bg-gradient-to-b', tone.gradient)} />

          {/* Top-left category chip only. No second tag. */}
          <div className="absolute left-3 top-3 z-10 sm:left-4 sm:top-4">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide shadow-sm',
                tone.chip
              )}
            >
              {card.kicker}
            </span>
          </div>

          {/* Bottom content. Title + one body line + arrow CTA at right. */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 px-4 pb-5 pt-12 sm:px-5 sm:pb-6">
            <div className="min-w-0 flex-1">
              <h3
                className="font-display text-3xl leading-[1.05] sm:text-4xl"
                style={{ fontFamily: 'var(--font-amboqia, ui-serif, Georgia, serif)' }}
              >
                {card.headline}
              </h3>
              <p className="mt-2 text-sm text-background/85">{card.body}</p>
            </div>
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-background text-foreground transition group-hover:bg-background/90"
              aria-label={card.ctaLabel}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} className="h-5 w-5" />
            </div>
          </div>

          {/* Photo credit, tiny, bottom-left under the safe zone */}
          {card.credit && (
            <span className="absolute bottom-1 left-3 z-20 text-[9px] font-medium uppercase tracking-[0.18em] text-background/55">
              {card.credit}
            </span>
          )}
        </div>
      </Wrapper>
    </article>
  )
}
