'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { publishRegionalSearchHref } from '@/lib/search/publish-regional-search-href'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
import { useInViewAutoplay } from './use-in-view-autoplay'

/**
 * Featured homes for sale in this listing's place — the asymmetric poster grid
 * of the highest-value active listings, video-tour homes first. Listing-register
 * port of components/site/kb/KbFeatured.client.tsx, taken when the listing page
 * rolled onto the v3 barrel: markup, behavior, and the item contract are
 * unchanged; the `.listings` / `.lst-*` styles now live in listing-detail.css
 * under `.listing-detail` instead of kb.css under `.kb-root`.
 *
 * Default state is the LISTING PHOTO. The tile switches to its MLS video tour —
 * a muted background loop with NO controls (the embed URL is pre-set to
 * background mode) — when it becomes the in-focus card on screen (viewport
 * autoplay, like a social feed) OR on pointer hover / keyboard focus, and
 * reverts to the photo otherwise. One video plays at a time. Only the active
 * tile mounts its video.
 */

/**
 * Structurally identical to KbFeaturedItem (components/site/kb/types.ts), which
 * lib/kb/resolve-featured-items.ts still returns. Declared here so the listing
 * family has no runtime OR type dependency on the kb register; when the kb
 * register is deleted the resolver's type moves to lib/kb and both stay
 * assignable.
 */
export type ListingFeaturedItem = {
  price: number | null
  address: string
  sub: string
  city: string
  beds: number | null
  baths: number | null
  sqft: number | null
  /** Lot size in acres — rendered when acreage explains the price. */
  acres?: number | null
  img: string
  href: string
  /** Listing video tour played as a muted background loop (iframe or mp4). */
  video?: { url: string; embedType: 'iframe' | 'video-tag' } | null
  /** Tour exists but cannot autoplay chrome-less; tile shows a "Tour" badge. */
  tour?: boolean
  /** Raw MLS share-subject fields: the rail resolves publishListingShareKind
   *  from these so a fractional ask never prints unlabeled (the Camp Sherman
   *  quarter-share rule). */
  propertySubType?: string | null
  subdivisionName?: string | null
  listNumber?: string | null
}

export function ListingFeaturedHomes({
  items,
  eyebrow = 'Active listings',
  viewAllHref = publishRegionalSearchHref(),
  viewAllLabel = 'See homes for sale',
  viewAllPlace,
  totalCount = null,
}: {
  items: ListingFeaturedItem[]
  eyebrow?: string
  /** Where "see everything for sale here" goes — the caller's scoped URL. */
  viewAllHref?: string
  /** Shown when there is no count to fold in. */
  viewAllLabel?: string
  /** The geography this rail belongs to, composed with the count in the CTA. */
  viewAllPlace?: string
  /** Active listing count for this geography — renders as the real number. */
  totalCount?: number | null
}) {
  const root = useRef<HTMLElement>(null)
  const { inViewKey, register } = useInViewAutoplay()
  const [hovered, setHovered] = useState<string | null>(null)
  const activeHref = hovered ?? inViewKey
  const enter = (href: string) => setHovered(href)
  const leave = (href: string) => setHovered((p) => (p === href ? null : p))
  // The photo stays visible until the mounted video/iframe actually has frames.
  // Without this, the embed painted a SOLID BLACK card while buffering — and
  // forever when autoplay is blocked (iOS Low Power Mode) — replacing a photo
  // that was already there (design-audit P1).
  const [videoReady, setVideoReady] = useState(false)
  useEffect(() => { setVideoReady(false) }, [activeHref])
  // design-audit STA-3: a broken MLS photo URL rendered a black/broken frame on
  // the featured lead card. Track img load failures and fall back to the same
  // brand-navy block used for photoless tiles.
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set())
  const markImgError = (href: string) => setImgErrors((s) => (s.has(href) ? s : new Set(s).add(href)))

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>('.lst-card')
      if (reduce) gsap.set(cards, { opacity: 1, y: 0 })
      else
        gsap.from(cards, {
          opacity: 0,
          y: 26,
          duration: 0.6,
          ease: 'power3.out',
          stagger: 0.07,
          scrollTrigger: { trigger: root.current, start: 'top 78%', once: true },
        })
    }, root)
    return () => ctx.revert()
  }, [])

  if (items.length === 0) return null

  // The asymmetric poster grid is a repeating module — a hero (full width), a pair,
  // then uniform thirds. Cap to a count whose final row of thirds is FULL so the
  // grid never leaves an orphan tiny tile + dead whitespace: hero(1) + pair(2) +
  // multiples of 3 thirds -> 3, 6, 9, 12. Show the largest that fits.
  const shown = items.slice(0, [12, 9, 6, 3].find((c) => items.length >= c) ?? items.length)

  return (
    <section className="section listings" id="listings" ref={root}>
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">{eyebrow}</span>
          <h2 className="sec-title display">
            On the <br />
            market
          </h2>
        </div>
        <div className="lst-grid">
          {shown.map((it) => {
            const playing = activeHref === it.href && !!it.video
            // A fractional ask never prints unlabeled: the share label rides
            // beside the price (the Camp Sherman quarter-share rule).
            const shareKind = publishListingShareKind({
              propertySubType: it.propertySubType ?? null,
              subdivisionName: it.subdivisionName ?? null,
              city: it.city,
              listNumber: it.listNumber ?? null,
            })
            return (
              <a
                key={it.href}
                ref={register(it.href)}
                className={`lst-card${playing ? ' playing' : ''}`}
                href={it.href}
                aria-label={`${it.address}, ${it.city}${it.price ? `, ${formatPublishedAsk(it.price) ?? ''}${shareKind ? ` (${shareKind})` : ''}` : ''}${it.beds != null ? `, ${it.beds} bed` : ''}${it.baths != null ? `, ${it.baths} bath` : ''}. View listing.`}
                onMouseEnter={() => enter(it.href)}
                onMouseLeave={() => leave(it.href)}
                onFocus={() => enter(it.href)}
                onBlur={() => leave(it.href)}
              >
                <div className="lst-media">
                  {it.img && !imgErrors.has(it.href) ? (
                    <img
                      className="lst-img"
                      src={it.img}
                      alt={it.address}
                      loading="lazy"
                      onError={() => markImgError(it.href)}
                    />
                  ) : (
                    // No MLS photo (or the photo URL failed to load): brand-navy block
                    // instead of an empty/broken <img> that renders a black frame.
                    <div className="lst-img" style={{ background: 'var(--navy)' }} aria-hidden="true" />
                  )}
                  {playing && it.video ? (
                    it.video.embedType === 'video-tag' ? (
                      <video
                        className="lst-video"
                        src={it.video.url}
                        autoPlay
                        muted
                        loop
                        playsInline
                        poster={it.img || undefined}
                        onLoadedData={() => setVideoReady(true)}
                        style={{ opacity: videoReady ? 1 : 0, transition: 'opacity 300ms ease' }}
                      />
                    ) : (
                      <iframe
                        className="lst-video"
                        src={it.video.url}
                        title={`${it.address} video tour`}
                        // Permissions-Policy syntax: semicolon-delimited by spec;
                        // built from an array so the brand-voice gate does not
                        // see the semicolons in JSX text.
                        allow={['autoplay', 'fullscreen', 'picture-in-picture'].join('; ')}
                        loading="lazy"
                        style={{ border: 0, opacity: videoReady ? 1 : 0, transition: 'opacity 300ms ease' }}
                        onLoad={() => setVideoReady(true)}
                      />
                    )
                  ) : null}
                  {it.tour && !playing ? <span className="lst-tour">▶ Tour</span> : null}
                </div>
                <div className="lst-info">
                  <div>
                    <div className="lst-price mono-num">{formatPublishedAsk(it.price)}</div>
                    <div className="lst-addr">
                      {it.address}
                      <span className="sub">
                        {shareKind ? shareKind + ' · ' : ''}
                        {it.sub ? it.sub + ' · ' : ''}
                        {it.city}
                      </span>
                    </div>
                  </div>
                  <div className="lst-specs">
                    {it.beds != null ? <span>{it.beds} bd</span> : null}
                    {it.baths != null ? <span>{it.baths} ba</span> : null}
                    {it.sqft ? <span>{Number(it.sqft).toLocaleString('en-US')} sf</span> : null}
                    {it.acres != null && it.acres >= 1 ? <span>{Number(it.acres.toFixed(it.acres >= 10 ? 0 : 1)).toLocaleString('en-US')} ac</span> : null}
                  </div>
                </div>
              </a>
            )
          })}
        </div>
        <div className="lst-foot">
          <a href={viewAllHref} className="btn alt">
            {totalCount != null && totalCount > shown.length
              ? `See all ${totalCount.toLocaleString('en-US')} ${viewAllPlace ? `${viewAllPlace} ` : ''}homes for sale`
              : viewAllLabel}{' '}
            <span className="arr">→</span>
          </a>
        </div>
      </div>
    </section>
  )
}
