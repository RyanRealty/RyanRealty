import Link from 'next/link'

export function CommDHero({
  posterSrc,
  posterAlt,
  lead,
  homesHref,
  mediaCaption,
}: {
  posterSrc: string
  posterAlt: string
  lead: string
  homesHref: string
  mediaCaption?: string
}) {
  return (
    <section className="comm-d-hero" id="top">
      <link rel="preload" as="image" href={posterSrc} fetchPriority="high" />
      <div className="comm-d-hero-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={posterSrc} alt={posterAlt} fetchPriority="high" />
      </div>
      <div className="comm-d-hero-scrim" aria-hidden="true" />
      <div className="comm-d-hero-inner">
        <p className="comm-d-hero-lead">{lead}</p>
        <div className="comm-d-hero-ctas">
          <Link href={homesHref} className="comm-d-btn">
            See homes
          </Link>
        </div>
        {mediaCaption ? <span className="comm-d-hero-caption">{mediaCaption}</span> : null}
      </div>
    </section>
  )
}
