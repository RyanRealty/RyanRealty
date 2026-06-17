'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { kbMoneyFull, type KbFeaturedItem } from './types'

/**
 * KB Featured homes (04) — asymmetric poster grid of the highest-value active
 * listings, video-tour homes first. Each home with an MLS video tour AUTOPLAYS
 * it as a muted background loop over the poster (no hover, no play-button icon).
 * Iframe embeds use native lazy-loading so off-screen tours don't load until the
 * tile scrolls into view; the video fades in over the poster once it has loaded.
 */
export function KbFeatured({ items }: { items: KbFeaturedItem[] }) {
  const root = useRef<HTMLElement>(null)
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})
  const markLoaded = (href: string) => setLoaded((p) => (p[href] ? p : { ...p, [href]: true }))

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

  return (
    <section className="section listings" id="listings" ref={root}>
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">04 / Featured Homes</span>
          <h2 className="sec-title display">
            Featured
            <br />
            homes
          </h2>
        </div>
        <div className="lst-grid">
          {items.map((it) => {
            const playing = !!it.video && !!loaded[it.href]
            return (
              <a key={it.href} className={`lst-card${playing ? ' playing' : ''}`} href={it.href}>
                <div className="lst-media">
                  <img className="lst-img" src={it.img} alt={it.address} loading="lazy" />
                  {it.video ? (
                    it.video.embedType === 'video-tag' ? (
                      <video
                        className="lst-video"
                        src={it.video.url}
                        autoPlay
                        muted
                        loop
                        playsInline
                        poster={it.img}
                        onLoadedData={() => markLoaded(it.href)}
                      />
                    ) : (
                      <iframe
                        className="lst-video"
                        src={it.video.url}
                        title={`${it.address} video tour`}
                        allow="autoplay; fullscreen; picture-in-picture"
                        loading="lazy"
                        style={{ border: 0 }}
                        onLoad={() => markLoaded(it.href)}
                      />
                    )
                  ) : null}
                </div>
                <div className="lst-info">
                  <div>
                    <div className="lst-price mono-num">{kbMoneyFull(it.price)}</div>
                    <div className="lst-addr">
                      {it.address}
                      <span className="sub">
                        {it.sub ? it.sub + ' · ' : ''}
                        {it.city}
                      </span>
                    </div>
                  </div>
                  <div className="lst-specs">
                    {it.beds != null ? <span>{it.beds} bd</span> : null}
                    {it.baths != null ? <span>{it.baths} ba</span> : null}
                    {it.sqft ? <span>{Number(it.sqft).toLocaleString('en-US')} sf</span> : null}
                  </div>
                </div>
              </a>
            )
          })}
        </div>
        <div className="lst-foot">
          <a href="/homes-for-sale" className="btn alt">
            All homes for sale <span className="arr">→</span>
          </a>
        </div>
      </div>
    </section>
  )
}
