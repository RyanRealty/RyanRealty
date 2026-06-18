'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { KbCommunityItem } from './types'
import { useInViewAutoplay } from './use-in-view-autoplay'

/**
 * KB Communities (02) — horizontal drag/swipe rail of marquee resort/golf
 * communities with live active counts. Each card shows its photo by default and
 * plays its silent Area Guide clip (muted background loop, no controls / no play
 * button) when it becomes the in-focus card on screen or on hover — same model
 * as a listing tile. Routes to /communities/[slug].
 */
export function KbCommunities({ communities, eyebrow = 'Communities' }: { communities: KbCommunityItem[]; eyebrow?: string }) {
  const root = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const { inViewKey, register } = useInViewAutoplay()
  const [hovered, setHovered] = useState<string | null>(null)
  const activeHref = hovered ?? inViewKey

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>('.comm-card')
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

    // pointer drag-to-scroll on desktop (touch uses native scroll-snap)
    const el = track.current
    let down = false
    let startX = 0
    let startScroll = 0
    let moved = false
    const onDown = (e: PointerEvent) => {
      down = true
      moved = false
      startX = e.clientX
      startScroll = el!.scrollLeft
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      const dx = e.clientX - startX
      if (Math.abs(dx) > 4) moved = true
      el!.scrollLeft = startScroll - dx
    }
    const onUp = () => {
      down = false
    }
    const onClick = (e: MouseEvent) => {
      if (moved) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    if (el) {
      el.addEventListener('pointerdown', onDown)
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      el.addEventListener('click', onClick, true)
    }
    return () => {
      ctx.revert()
      if (el) {
        el.removeEventListener('pointerdown', onDown)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        el.removeEventListener('click', onClick, true)
      }
    }
  }, [])

  if (communities.length === 0) return null

  return (
    <section className="section comm" id="communities" ref={root}>
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">{eyebrow}</span>
          <h2 className="sec-title display">Communities</h2>
        </div>
      </div>
      <div className="comm-viewport">
        <div className="comm-track" ref={track}>
          {communities.map((c) => {
            const playing = activeHref === c.href && !!c.video
            return (
              <a
                key={c.href}
                ref={register(c.href)}
                className={`comm-card${playing ? ' playing' : ''}`}
                href={c.href}
                onMouseEnter={() => setHovered(c.href)}
                onMouseLeave={() => setHovered((p) => (p === c.href ? null : p))}
                onFocus={() => setHovered(c.href)}
                onBlur={() => setHovered((p) => (p === c.href ? null : p))}
              >
                <div className="comm-media">
                  <img className="comm-img" src={c.img} alt={`${c.name}, ${c.town}`} loading="lazy" />
                  {playing && c.video ? (
                    c.video.embedType === 'video-tag' ? (
                      <video className="comm-video" src={c.video.url} autoPlay muted loop playsInline poster={c.img} />
                    ) : (
                      <iframe
                        className="comm-video"
                        src={c.video.url}
                        title={`${c.name} area guide`}
                        allow="autoplay; fullscreen; picture-in-picture"
                        loading="lazy"
                      />
                    )
                  ) : null}
                </div>
                <div className="comm-body">
                  <div className="comm-name">{c.name}</div>
                  <div className="comm-sub">
                    <span className="ct mono-num">{c.activeCount.toLocaleString('en-US')}</span> active · {c.town}
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      </div>
      <div className="comm-hint">
        <span>← Drag / swipe →</span>
      </div>
      <div className="wrap">
        <div className="sec-cta">
          <a href="/communities" className="btn alt">
            Browse every community <span className="arr">→</span>
          </a>
        </div>
      </div>
    </section>
  )
}
