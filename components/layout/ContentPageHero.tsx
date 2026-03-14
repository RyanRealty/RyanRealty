'use client'

import Image from 'next/image'
import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'

export type ContentPageHeroCta = { label: string; href: string; primary?: boolean }

export type ContentPageHeroProps = {
  /** Main heading (e.g. "Buy With Us") */
  title: string
  /** Optional subheading or supporting line */
  subtitle?: string
  /** Optional hero background image URL (Unsplash or local). When absent, solid navy. */
  imageUrl?: string | null
  /** Optional CTAs shown below subtitle */
  ctas?: ContentPageHeroCta[]
}

/**
 * Consistent hero for content pages: buy, sell, about, contact, open houses, team, etc.
 * Full-width, heading + subheading overlay, optional image and CTAs. Design tokens only.
 */
export default function ContentPageHero({ title, subtitle, imageUrl, ctas }: ContentPageHeroProps) {
  return (
    <section
      className="relative min-h-[40vh] sm:min-h-[50vh] overflow-hidden bg-primary"
      aria-label="Page hero"
    >
      {imageUrl && (
        <div className="absolute inset-0">
          <Image
            src={imageUrl}
            alt={`${title} — hero image`}
            fill
            className="object-cover object-center"
            sizes="100vw"
            priority
          />
        </div>
      )}
      {/* Overlay for readability; stronger when no image */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/70 to-primary/50"
        aria-hidden
      />
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute top-0 left-0 h-full w-[60%] bg-gradient-to-r from-transparent via-white/10 to-transparent animate-hero-shine" />
      </div>
      <div className="relative z-10 flex min-h-[40vh] sm:min-h-[50vh] flex-col justify-center px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto w-full max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            {title}
          </h1>
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
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-base font-semibold text-primary shadow-md transition hover:bg-accent/90 hover:shadow-lg"
                  >
                    {cta.label}
                    <HugeiconsIcon icon={ArrowRight01Icon} className="h-5 w-5" />
                  </Link>
                ) : (
                  <Link
                    key={cta.href}
                    href={cta.href}
                    className="inline-flex items-center gap-2 rounded-lg border-2 border-white/40 bg-card/10 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-card/20"
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
