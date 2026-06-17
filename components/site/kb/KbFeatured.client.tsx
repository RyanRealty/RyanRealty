'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { kbMoneyFull, type KbFeaturedItem } from './types'

/**
 * KB Featured homes (04) — asymmetric poster grid of the highest-value active
 * listings, video-tour homes first. Each card routes to the listing detail and,
 * when the MLS feed has a video tour, plays it as a muted background loop on
 * hover (an iframe embed or a direct mp4) over the poster — like the demo. Only
 * the hovered card mounts its video, so the page never autoplays six at once.
 */
export function KbFeatured({ items }: { items: KbFeaturedItem[] }) {
  const root = useRef<HTMLElement>(null)
  const [playing, setPlaying] = useState<string | null>(null)

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
            const isPlaying = playing === it.href && !!it.video
            return (
              <a
                key={it.href}
                className={`lst-card${isPlaying ? ' playing' : ''}`}
                href={it.href}
                onMouseEnter={() => it.video && setPlaying(it.href)}
                onMouseLeave={() => setPlaying((p) => (p === it.href ? null : p))}
              >
                <div className="lst-media">
                  <img className="lst-img" src={it.img} alt={it.address} loading="lazy" />
                  {isPlaying && it.video ? (
                    it.video.embedType === 'video-tag' ? (
                      <video
                        className="lst-video"
                        src={it.video.url}
                        autoPlay
                        muted
                        loop
                        playsInline
                        poster={it.img}
                      />
                    ) : (
                      <iframe
                        className="lst-video"
                        src={it.video.url}
                        title={`${it.address} video tour`}
                        allow="autoplay; fullscreen; picture-in-picture"
                        loading="lazy"
                        style={{ border: 0 }}
                      />
                    )
                  ) : null}
                  {it.video ? (
                    <span className="lst-reel" aria-hidden="true">
                      ▶ Tour
                    </span>
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
