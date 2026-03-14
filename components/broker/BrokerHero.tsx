import Image from 'next/image'
import Link from 'next/link'
import type { AgentDetail } from '@/app/actions/agents'
import BrokerHeroCtaButtons from '@/components/broker/BrokerHeroCtaButtons'

type Props = {
  broker: AgentDetail
  /** Base path for breadcrumb and context (e.g. 'agents' or 'team'). Default 'agents'. */
  basePath?: 'agents' | 'team'
  /** When broker has no photo_url, use this image (e.g. from Unsplash). */
  fallbackImageUrl?: string | null
}

function StarDisplay({ rating, count }: { rating: number | null; count: number }) {
  if (count === 0) return null
  const r = rating ?? 0
  const full = Math.floor(r)
  const half = r - full >= 0.5 ? 1 : 0
  const empty = 5 - full - half
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${r} out of 5 stars, ${count} reviews`}>
      {[...Array(full)].map((_, i) => (
        <span key={`f-${i}`} className="text-accent-foreground">★</span>
      ))}
      {half ? <span className="text-accent-foreground">★</span> : null}
      {[...Array(empty)].map((_, i) => (
        <span key={`e-${i}`} className="text-border">★</span>
      ))}
      <span className="ml-2 text-muted">{r.toFixed(1)} — {count} reviews</span>
    </span>
  )
}

const DEFAULT_AGENT_PLACEHOLDER = 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=560&q=80'

export default function BrokerHero({ broker, basePath = 'agents', fallbackImageUrl }: Props) {
  const firstName = broker.display_name.split(' ')[0] ?? broker.display_name
  const listHref = basePath === 'team' ? '/team' : '/agents'
  const listLabel = basePath === 'team' ? 'Team' : 'Agents'
  const agentImageUrl = broker.photo_url ?? fallbackImageUrl ?? DEFAULT_AGENT_PLACEHOLDER
  const showInitial = !broker.photo_url && !fallbackImageUrl
  const introVideoUrl = broker.intro_video_url?.trim() || null

  return (
    <section className="bg-card" aria-labelledby="broker-hero-heading">
      {introVideoUrl && (
        <div className="relative w-full overflow-hidden bg-primary" style={{ maxHeight: '40vh' }} aria-label="Intro video">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
            src={introVideoUrl}
            aria-hidden
          />
        </div>
      )}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">/</span>
          <Link href={listHref} className="hover:text-primary">{listLabel}</Link>
          <span className="mx-2">/</span>
          <span className="text-primary">{broker.display_name}</span>
        </nav>
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-12">
          <div className="shrink-0">
            <div className="relative h-48 w-48 overflow-hidden rounded-lg bg-muted shadow-md sm:h-56 sm:w-56">
              {showInitial ? (
                <div className="flex h-full w-full items-center justify-center text-5xl font-bold text-muted-foreground">
                  {broker.display_name.charAt(0)}
                </div>
              ) : (
                <Image
                  src={agentImageUrl}
                  alt={`${broker.display_name} — real estate agent photo`}
                  fill
                  className="object-cover"
                  sizes="224px"
                  priority
                />
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 id="broker-hero-heading" className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
              {broker.display_name}
            </h1>
            {broker.title && (
              <p className="mt-1 text-lg text-muted-foreground">{broker.title}</p>
            )}
            {(broker.designations ?? []).filter(Boolean).length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {(broker.designations ?? []).filter(Boolean).join(' · ')}
              </p>
            )}
            {broker.tagline?.trim() && (
              <p className="mt-2 text-muted-foreground">{broker.tagline.trim()}</p>
            )}
            {broker.reviewCount > 0 && (
              <div className="mt-3">
                <StarDisplay rating={broker.avgRating} count={broker.reviewCount} />
              </div>
            )}
            <BrokerHeroCtaButtons
              firstName={firstName}
              slug={broker.slug}
              phone={broker.phone}
              email={broker.email}
            />
            <div className="mt-6 flex flex-wrap items-center gap-4">
              {broker.google_review_url?.trim() && (
                <a
                  href={broker.google_review_url.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-muted-foreground hover:text-primary"
                >
                  Google
                </a>
              )}
              {broker.zillow_review_url?.trim() && (
                <a
                  href={broker.zillow_review_url.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-muted-foreground hover:text-primary"
                >
                  Zillow
                </a>
              )}
              {(broker.social_instagram?.trim() || broker.social_facebook?.trim() || broker.social_linkedin?.trim() || broker.social_youtube?.trim() || broker.social_tiktok?.trim()) && (
                <span className="flex items-center gap-2">
                  {broker.social_instagram?.trim() && (
                    <a href={broker.social_instagram.trim()} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary" aria-label="Instagram">
                      <SocialIcon name="instagram" />
                    </a>
                  )}
                  {broker.social_facebook?.trim() && (
                    <a href={broker.social_facebook.trim()} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary" aria-label="Facebook">
                      <SocialIcon name="facebook" />
                    </a>
                  )}
                  {broker.social_linkedin?.trim() && (
                    <a href={broker.social_linkedin.trim()} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary" aria-label="LinkedIn">
                      <SocialIcon name="linkedin" />
                    </a>
                  )}
                  {broker.social_youtube?.trim() && (
                    <a href={broker.social_youtube.trim()} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary" aria-label="YouTube">
                      <SocialIcon name="youtube" />
                    </a>
                  )}
                  {broker.social_tiktok?.trim() && (
                    <a href={broker.social_tiktok.trim()} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary" aria-label="TikTok">
                      <SocialIcon name="tiktok" />
                    </a>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SocialIcon({ name }: { name: 'instagram' | 'facebook' | 'linkedin' | 'youtube' | 'tiktok' }) {
  const className = 'h-5 w-5'
  switch (name) {
    case 'instagram':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      )
    case 'facebook':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      )
    case 'linkedin':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      )
    case 'youtube':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.03 2.01-.01 4.02-.01 6.02-.67-.21-1.37-.31-2.08-.28-1.12.05-2.19.43-3.1 1.08-.28.2-.54.42-.78.66-.01-.98-.01-1.96.01-2.94.09-.95.47-1.8 1.09-2.53 1.08-1.27 2.55-2.1 4.2-2.32.02-.01.04-.01.06-.02v4.02c-.14.01-.28.02-.42.03-1.18.09-2.27.53-3.2 1.2-.9.64-1.56 1.5-1.9 2.48-.12.34-.18.7-.2 1.06-.02.37 0 .74.05 1.1.43 2.26 2.29 3.94 4.56 4.28.93.14 1.88.1 2.79-.1 2.1-.47 3.66-2.2 4.04-4.3.07-.44.1-.88.1-1.33.01-2.99-.01-5.98.02-8.97z" />
        </svg>
      )
    default:
      return null
  }
}
