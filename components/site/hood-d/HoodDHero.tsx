import Link from 'next/link'
import { formatPriceExact } from '@/lib/format/money'
import { publishDaysLabel } from '@/lib/market/publish-days-figure'
import type { HoodDHeroData } from './types'

export function HoodDHero({
  cityName,
  cityHref,
  name,
  lead,
  data,
  posterSrc,
  posterAlt,
  cta,
}: {
  cityName: string
  cityHref: string
  name: string
  lead: string
  data: HoodDHeroData
  posterSrc: string
  posterAlt: string
  cta: { href: string; label: string }
}) {
  const median = formatPriceExact(data.medianListPrice)
  const pendingDays = publishDaysLabel(data.medianDaysToPending)
  const stats = [
    data.activeCount != null
      ? `${data.activeCount.toLocaleString('en-US')} ${data.activeCount === 1 ? 'home' : 'homes'}`
      : null,
    median !== '—' ? `${median} median` : null,
    pendingDays ? `${pendingDays} pending` : null,
  ].filter(Boolean)
  const heading = `${name} homes for sale`

  return (
    <section className="hood-d-hero" id="top">
      <link rel="preload" as="image" href={posterSrc} fetchPriority="high" />
      <div className="hood-d-hero-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={posterSrc} alt={posterAlt} fetchPriority="high" />
      </div>
      <div className="hood-d-hero-scrim" aria-hidden="true" />
      <div className="hood-d-hero-inner">
        <p className="hood-d-crumb">
          <Link href={cityHref}>{cityName}</Link>
          <span aria-hidden="true">›</span>
          <span>{name}</span>
        </p>
        <h1 className="hood-d-display">{heading}</h1>
        <p className="hood-d-hero-lead">{lead}</p>
        {stats.length > 0 ? <p className="hood-d-hero-stats">{stats.join(' · ')}</p> : null}
        <div className="hood-d-hero-ctas">
          <Link href={cta.href} className="hood-d-btn">
            {cta.label}
          </Link>
        </div>
      </div>
    </section>
  )
}
