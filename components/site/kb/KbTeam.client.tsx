'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * KB Work-with-us / Team — three brokers, big portraits, each routing to their
 * own broker page. Positions on direct-broker accountability (no headcount /
 * smallness language). Brokers are fixed.
 */
const BROKERS = [
  { name: 'Matt Ryan', role: 'Principal Broker', slug: 'matt-ryan', img: '/images/brokers/ryan-matt.png', first: 'Matt' },
  { name: 'Paul Stevenson', role: 'Broker', slug: 'paul-stevenson', img: '/images/brokers/stevenson-paul.png', first: 'Paul' },
  { name: 'Rebecca Peterson', role: 'Broker', slug: 'rebecca-peterson', img: '/images/brokers/peterson-rebecca.png', first: 'Rebecca' },
]

export function KbTeam() {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>('.ww-card')
      if (reduce) gsap.set(cards, { opacity: 1, y: 0 })
      else
        gsap.from(cards, {
          opacity: 0,
          y: 26,
          duration: 0.6,
          ease: 'power3.out',
          stagger: 0.08,
          scrollTrigger: { trigger: root.current, start: 'top 78%', once: true },
        })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section className="section workwith" id="team" ref={root}>
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">The team</span>
          <h2 className="sec-title display">Work with us</h2>
        </div>
        <div className="ww-grid">
          {BROKERS.map((b) => (
            <a key={b.slug} className="ww-card" href={`/team/${b.slug}`}>
              <div className="ww-photo">
                <img src={b.img} alt={`${b.name}, ${b.role}`} loading="lazy" />
              </div>
              <div className="ww-name">{b.name}</div>
              <div className="ww-role">{b.role}</div>
              <span className="ww-link">
                Work with {b.first} <span className="arr">→</span>
              </span>
            </a>
          ))}
        </div>
        <div className="sec-cta">
          <a href="/sell" className="btn alt">
            Talk to a broker <span className="arr">→</span>
          </a>
        </div>
      </div>
    </section>
  )
}
