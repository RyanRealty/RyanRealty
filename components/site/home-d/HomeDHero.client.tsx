'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import VoiceSearchButton from '@/components/VoiceSearchButton'
import { formatPriceExact } from '@/lib/format/money'
import { publishDaysLabel } from '@/lib/market/publish-days-figure'
import { searchHrefForQuery } from '@/lib/parse-search-query'
import { publishRegionalSearchHref } from '@/lib/search/publish-regional-search-href'
import { valuationHref } from '@/lib/site/valuation-href'
import type { HomeDHeroData } from './types'

export function HomeDHero({
  data,
  titleTop,
  titleBottom,
  lead,
  videoSrc = '/videos/hero-optimized.mp4',
  posterSrc = '/images/hero/hero-old-mill-master-4k.jpg',
  cta = { href: publishRegionalSearchHref(), label: 'See homes' },
  ctaSecondary = { href: valuationHref('/'), label: 'Value my home' },
}: {
  data: HomeDHeroData
  titleTop: string
  titleBottom: string
  lead: string
  videoSrc?: string | null
  posterSrc?: string
  cta?: { href: string; label: string } | null
  ctaSecondary?: { href: string; label: string } | null
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduceMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const routeFor = (raw: string) => router.push(searchHrefForQuery(raw))
  function submit(e: FormEvent) {
    e.preventDefault()
    routeFor(q)
  }

  const median = formatPriceExact(data.medianListPrice)
  const pendingDays = publishDaysLabel(data.medianDaysToPending)
  const showVideo = Boolean(videoSrc) && reduceMotion === false
  const stats = [
    data.activeCount != null
      ? `${data.activeCount.toLocaleString('en-US')} ${data.activeCount === 1 ? 'home' : 'homes'}`
      : null,
    median !== '—' ? `median list ${median}` : null,
    pendingDays ? `pending ${pendingDays}` : null,
  ].filter(Boolean)

  return (
    <section className="home-d-hero" id="top">
      <link rel="preload" as="image" href={posterSrc} fetchPriority="high" />
      <div className="home-d-hero-media">
        {showVideo ? (
          <video autoPlay muted loop playsInline preload="auto" poster={posterSrc}>
            <source src={videoSrc ?? undefined} type="video/mp4" />
          </video>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterSrc} alt="" fetchPriority="high" />
        )}
      </div>
      <div className="home-d-hero-scrim" aria-hidden="true" />
      <div className="home-d-hero-inner">
        <h1 className="home-d-display" aria-label={`${titleTop} ${titleBottom}`}>
          <span>{titleTop}</span>
          <span>{titleBottom}</span>
        </h1>
        <p className="home-d-hero-lead">{lead}</p>
        <form className="home-d-search" role="search" onSubmit={submit}>
          <Input
            className="home-d-search-input"
            type="text"
            autoComplete="off"
            aria-label="Search homes by city, community, or address"
            placeholder="City, community, or address"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <VoiceSearchButton
            className="home-d-search-mic"
            onTranscript={(t) => {
              setQ(t)
              routeFor(t)
            }}
          />
          <Button type="submit" className="home-d-search-go">
            Go
          </Button>
        </form>
        {stats.length > 0 ? <p className="home-d-hero-stats">{stats.join(' · ')}</p> : null}
        {cta || ctaSecondary ? (
          <div className="home-d-hero-ctas">
            {cta ? (
              <Link href={cta.href} className="home-d-btn">
                {cta.label}
              </Link>
            ) : null}
            {ctaSecondary ? (
              <Link href={ctaSecondary.href} className="home-d-btn home-d-btn-ghost">
                {ctaSecondary.label}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
