'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Body,
  Container,
  DisplayHeading,
} from '@/components/site/primitives'
import { cn } from '@/lib/utils'

/**
 * Site v2 unified hero block — config-driven hero suitable for the
 * homepage, city / community / zip pages, market reports, and any other
 * page that needs a big photo + headline + lede + optional search bar
 * and chip nav. Supersedes the homepage-specific `Hero` component;
 * `Hero` stays as a thin wrapper that calls HeroBlock with the
 * homepage's locked config.
 *
 * Per plan §9 Layer 3. Per CLAUDE.md Brand-voice + Design System v2:
 *   - DisplayHeading (Amboqia) renders the H1
 *   - Body renders the lede; em-dash / banned-word ESLint catches slips
 *   - Photo is full-bleed; Ken Burns slow zoom; navy bottom-up overlay
 *   - Search bar + chips are optional surface flags
 *
 * Defaults (when no override):
 *   - photo = canonical Old Mill master (CLAUDE.md locked 2026-05-13)
 *   - alt = brand-voice clean drone description
 *   - search action = /search?keywords=<q>
 *
 * Example (homepage):
 *   <HeroBlock
 *     headline="Find Your Home in Central Oregon"
 *     lede="Search homes for sale across Bend, Redmond, Sisters, Sunriver, and surrounding communities. Honest guidance from your local team."
 *     showSearch
 *     chips={CITY_CHIPS}
 *   />
 *
 * Example (city page):
 *   <HeroBlock
 *     headline="Bend, Oregon"
 *     lede="Median list price $825,000. 787 active homes."
 *     photo={{ src: '/brand/hero/bend-master.jpg', alt: 'Drone view of Drake Park and the Deschutes River through downtown Bend.' }}
 *     minHeight={520}
 *   />
 */

type Chip = {
  label: string
  href: string
}

type Photo = {
  src: string
  alt: string
  /** Set true for the page hero so Next preloads + marks LCP. */
  priority?: boolean
}

type Props = {
  headline: string
  lede?: string
  photo?: Photo
  /** Show the search input + Search button. Default false. */
  showSearch?: boolean
  /** Override default search submit target. Default `/search?keywords=<q>`. */
  searchAction?: (query: string) => string
  /** Optional chip-style nav row beneath the form. */
  chips?: ReadonlyArray<Chip>
  /** Minimum hero height in px. Default 620. */
  minHeight?: number
  /** Override the navy bottom-up overlay opacity at the foot of the image. Default 0.70. */
  overlayBottomOpacity?: number
  className?: string
}

const DEFAULT_PHOTO: Photo = {
  src: '/brand/hero/hero-old-mill-master-4k.jpg',
  alt: 'Old Mill District drone view with the American flag, the Deschutes River, and the Cascade mountains.',
  priority: true,
}

function defaultSearchAction(q: string): string {
  return `/search?keywords=${encodeURIComponent(q)}`
}

export function HeroBlock({
  headline,
  lede,
  photo = DEFAULT_PHOTO,
  showSearch = false,
  searchAction = defaultSearchAction,
  chips,
  minHeight = 620,
  overlayBottomOpacity = 0.7,
  className,
}: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    router.push(searchAction(q))
  }

  const overlayBg = `linear-gradient(to top, rgba(16,39,66,${overlayBottomOpacity}) 0%, rgba(16,39,66,${Math.max(overlayBottomOpacity * 0.5, 0.2)}) 45%, rgba(16,39,66,0.05) 100%)`

  return (
    <section
      aria-label="Hero"
      className={cn(
        'relative flex items-end overflow-hidden pt-[120px] pb-16',
        className,
      )}
      style={{ minHeight }}
    >
      <div className="absolute inset-0 site-hero-kenburns">
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          priority={photo.priority ?? true}
          sizes="100vw"
          className="object-cover"
        />
      </div>

      <div
        className="absolute inset-0"
        aria-hidden
        style={{ background: overlayBg }}
      />

      <Container className="relative w-full">
        <div className="max-w-[780px] text-white">
          <DisplayHeading
            as="h1"
            className="text-white text-[clamp(2.5rem,5vw,4rem)] leading-[1.02] tracking-[-0.02em] m-0"
            style={{ filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.25))' }}
          >
            {headline}
          </DisplayHeading>
          {lede ? (
            <Body
              size="large"
              tone="on-photo"
              className="mt-3.5 mb-7 text-white/92 max-w-[560px] leading-[1.55]"
            >
              {lede}
            </Body>
          ) : null}

          {showSearch ? (
            <form
              onSubmit={handleSubmit}
              className="flex bg-white rounded-xl shadow-lg max-w-[720px] overflow-hidden"
            >
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="City, community, neighborhood, address, or broker"
                aria-label="Search homes for sale in Central Oregon"
                className="flex-1 min-w-0 px-[18px] py-4 text-[15px] text-foreground placeholder:text-muted-foreground bg-transparent border-0 outline-none"
              />
              <button
                type="submit"
                className="bg-secondary text-secondary-foreground px-7 font-semibold text-sm hover:bg-secondary/80 transition active:translate-y-px"
              >
                Search
              </button>
            </form>
          ) : null}

          {chips && chips.length > 0 ? (
            <nav aria-label="Quick navigation" className="mt-[18px]">
              <ul className="flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <li key={chip.href}>
                    <Link
                      href={chip.href}
                      className="inline-block rounded-full border border-white/28 bg-white/14 px-3 py-[5px] text-xs font-medium text-white backdrop-blur-sm hover:bg-white/22 transition"
                    >
                      {chip.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </Container>
    </section>
  )
}
