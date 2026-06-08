'use client'

import Image from 'next/image'
import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { trackCtaClick } from '@/lib/cta-tracking'
import { DisplayHeading } from '@/components/site/primitives'

export type ContentPageHeroCta = { label: string; href: string; primary?: boolean }

/** Canonical brand hero — the locked Old Mill District photo. Used when a page
 *  passes no imageUrl, so a content hero is NEVER a flat navy bar. Pages should
 *  still pass a page-specific imageUrl (enforced by the ci:hero-image gate). */
const BRAND_HERO_FALLBACK = '/images/hero/hero-old-mill-master-4k.jpg'

export type ContentPageHeroProps = {
  /** Main heading (e.g. "Buy With Us") */
  title: string
  /** Optional subheading or supporting line */
  subtitle?: string
  /** Hero background image URL. When absent, falls back to the brand hero (never flat navy). */
  imageUrl?: string | null
  /** Optional CTAs shown below subtitle */
  ctas?: ContentPageHeroCta[]
}

/**
 * Consistent hero for content pages: buy, sell, about, contact, open houses, team, etc.
 * Full-width, heading + subheading overlay, optional image and CTAs. Design tokens only.
 */
export default function ContentPageHero({ title, subtitle, imageUrl, ctas }: ContentPageHeroProps) {
  const heroSrc = imageUrl || BRAND_HERO_FALLBACK
  return (
    <section
      className="relative min-h-[40vh] sm:min-h-[50vh] overflow-hidden bg-primary"
      aria-label="Page hero"
    >
      <div className="absolute inset-0">
        <Image
          src={heroSrc}
          alt={`${title}, hero image`}
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority
        />
      </div>
      {/* Overlay for readability */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/50 to-primary/30"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-[40vh] sm:min-h-[50vh] flex-col justify-center px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto w-full max-w-4xl text-center">
          <DisplayHeading
            as="h1"
            className="text-4xl text-primary-foreground sm:text-5xl lg:text-6xl"
          >
            {title}
          </DisplayHeading>
          {subtitle && (
            <p className="mt-4 text-lg text-muted/95 sm:text-xl md:mt-6">
              {subtitle}
            </p>
          )}
          {ctas && ctas.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:mt-10">
              {ctas.map((cta) =>
                cta.primary ? (
                  <Link
                    key={cta.href}
                    href={cta.href}
                    onClick={() =>
                      trackCtaClick({
                        label: cta.label,
                        destination: cta.href,
                        context: `content_hero:${title.toLowerCase().replace(/\s+/g, '_')}`,
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-base font-semibold text-primary shadow-md transition hover:bg-accent/90 hover:shadow-lg"
                  >
                    {cta.label}
                    <HugeiconsIcon icon={ArrowRight01Icon} className="h-5 w-5" />
                  </Link>
                ) : (
                  <Link
                    key={cta.href}
                    href={cta.href}
                    onClick={() =>
                      trackCtaClick({
                        label: cta.label,
                        destination: cta.href,
                        context: `content_hero:${title.toLowerCase().replace(/\s+/g, '_')}`,
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-lg border-2 border-primary-foreground/40 bg-card/10 px-6 py-3.5 text-base font-semibold text-primary-foreground backdrop-blur-sm transition hover:bg-card/20"
                  >
                    {cta.label}
                  </Link>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
