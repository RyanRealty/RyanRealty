import Link from 'next/link'

export function CityDHero({
  cityName,
  h1,
  lead,
  videoSrc,
  posterSrc,
  posterAlt,
  mediaCaption,
  cta,
}: {
  cityName: string
  h1: string
  lead: string
  videoSrc?: string | null
  posterSrc: string
  posterAlt: string
  mediaCaption?: string
  cta: { href: string; label: string }
}) {
  return (
    <section className="city-d-hero" id="top">
      <link rel="preload" as="image" href={posterSrc} fetchPriority="high" />
      <div className="city-d-hero-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={posterSrc} alt={posterAlt} fetchPriority="high" />
        {videoSrc ? (
          <video autoPlay muted loop playsInline preload="auto" poster={posterSrc}>
            <source src={videoSrc} type="video/mp4" />
          </video>
        ) : null}
      </div>
      <div className="city-d-hero-scrim" aria-hidden="true" />
      <div className="city-d-hero-inner">
        <h1 className="city-d-display" aria-label={h1}>
          <span>{cityName}</span>
          <span className="city-d-hero-homes">homes for sale</span>
        </h1>
        <p className="city-d-hero-lead">{lead}</p>
        <Link href={cta.href} className="city-d-btn">
          {cta.label}
        </Link>
        {mediaCaption ? <p className="city-d-hero-caption">{mediaCaption}</p> : null}
      </div>
    </section>
  )
}
