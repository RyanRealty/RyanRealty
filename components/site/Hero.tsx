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

/**
 * Site v2 hero — full-bleed Old Mill photo with Ken Burns, navy overlay (bottom-up),
 * H1 + lede, search bar, 7 city chips. Mirrors design_system/ryan-realty/ui_kits/website/index.html §hero.
 *
 * Per CLAUDE.md / SITE_SPEC: canonical brand hero is the Old Mill master at
 * public/brand/hero/hero-old-mill-master-4k.jpg.
 *
 * Lifted onto Wave 2 Layer 1 primitives 2026-05-27. Em-dashes in JSX text
 * (lede) and alt attribute (photo) replaced with periods + cleaner phrasing
 * to clear the brand-voice gate. Search form + Ken Burns + chip nav stay
 * inline because they're hero-specific patterns with no clean primitive yet.
 */
const HERO_IMAGE = '/brand/hero/hero-old-mill-master-4k.jpg'

const CITY_CHIPS = [
  { label: 'Bend', href: '/cities/bend' },
  { label: 'Redmond', href: '/cities/redmond' },
  { label: 'Sisters', href: '/cities/sisters' },
  { label: 'Sunriver', href: '/cities/sunriver' },
  { label: 'Tumalo', href: '/cities/tumalo' },
  { label: 'La Pine', href: '/cities/la-pine' },
  { label: 'Prineville', href: '/cities/prineville' },
] as const

export default function Hero() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    router.push(`/search?keywords=${encodeURIComponent(q)}`)
  }

  return (
    <section
      aria-label="Hero"
      className="relative flex items-end overflow-hidden min-h-[620px] pt-[120px] pb-16"
    >
      {/* Background photo with slow Ken Burns */}
      <div className="absolute inset-0 site-hero-kenburns">
        <Image
          src={HERO_IMAGE}
          alt="Old Mill District drone view with the American flag, the Deschutes River, and the Cascade mountains."
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>

      {/* Navy overlay, stronger at the bottom for legibility, fading to clear at the top so the photo reads. */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            'linear-gradient(to top, rgba(16,39,66,0.70) 0%, rgba(16,39,66,0.35) 45%, rgba(16,39,66,0.05) 100%)',
        }}
      />

      <Container className="relative w-full">
        <div className="max-w-[780px] text-white">
          <DisplayHeading
            as="h1"
            className="text-white text-[clamp(2.5rem,5vw,4rem)] leading-[1.02] tracking-[-0.02em] m-0"
            style={{ filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.25))' }}
          >
            Find Your Home in Central Oregon
          </DisplayHeading>
          <Body
            size="large"
            tone="on-photo"
            className="mt-3.5 mb-7 text-white/92 max-w-[560px] leading-[1.55]"
          >
            Search homes for sale across Bend, Redmond, Sisters, Sunriver, and
            surrounding communities. Honest guidance from your local team.
          </Body>

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

          <nav aria-label="Browse cities" className="mt-[18px]">
            <ul className="flex flex-wrap gap-2">
              {CITY_CHIPS.map((chip) => (
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
        </div>
      </Container>
    </section>
  )
}
