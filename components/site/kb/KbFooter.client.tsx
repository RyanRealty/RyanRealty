'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { kbMoneyFull, type KbTownItem } from './types'
import { CONTACT } from '@/lib/brand/contact'

/**
 * KB footer — dual-audience close + full sitemap. Per-town inventory fine print
 * is live (from the towns prop). Contact/social/license static.
 */
export function KbFooter({ towns }: { towns: KbTownItem[] }) {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      if (reduce) return
      gsap.from('.foot-cta .display, .foot-cta .sub, .foot-cta .btn-row', {
        opacity: 0,
        y: 30,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.06,
        scrollTrigger: { trigger: '.foot-cta', start: 'top 85%', once: true },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  const fine = towns
    .map((t) => `${t.name} ${t.activeCount.toLocaleString('en-US')} / ${kbMoneyFull(t.medianPrice) ?? '—'}`)
    .join(' · ')

  return (
    <footer className="footer" ref={root}>
      <div className="wrap">
        <div className="foot-cta">
          <h2 className="display">Let&rsquo;s<br />talk.</h2>
          <p className="sub">
            Buying, selling, or still deciding which of the six cities fits. Tell us the street. We bring the
            comps and the number it trades for.
          </p>
          <div className="btn-row">
            <a href="/sell" className="btn">
              What&rsquo;s my home worth <span className="arr">→</span>
            </a>
            <a href="/homes-for-sale" className="btn ghost">
              Browse homes
            </a>
          </div>
        </div>
        <div className="foot-cols">
          <div className="foot-brand">
            <img className="logo-img" src="/images/brand/logo-white.png" alt="Ryan Realty" />
            <p>Central Oregon real estate across Bend, Redmond, Sisters, Sunriver, La Pine and Terrebonne.</p>
            <div className="foot-contact">
              <a href={`tel:${CONTACT.phoneDirectTel}`}>{CONTACT.phoneDirect}</a>
              <a href="mailto:matt@ryan-realty.com">matt@ryan-realty.com</a>
              <span>Bend · Oregon</span>
            </div>
            <div className="foot-social">
              <a href="https://instagram.com/ryanrealtybend">Instagram</a>
              <a href="https://facebook.com/ryanrealtybend">Facebook</a>
              <a href="https://youtube.com/@ryanrealtybend">YouTube</a>
            </div>
          </div>
          <nav className="foot-col" aria-label="Explore">
            <h3>Explore</h3>
            <a href="/cities/bend">Bend homes</a>
            <a href="/cities/redmond">Redmond homes</a>
            <a href="/cities/sisters">Sisters homes</a>
            <a href="/cities/sunriver">Sunriver homes</a>
            <a href="/cities/la-pine">La Pine homes</a>
            <a href="/cities/terrebonne">Terrebonne homes</a>
          </nav>
          <nav className="foot-col" aria-label="Communities">
            <h3>Communities</h3>
            <a href="/communities/tetherow">Tetherow</a>
            <a href="/communities/broken-top">Broken Top</a>
            <a href="/communities/northwest-crossing">NorthWest Crossing</a>
            <a href="/communities/caldera-springs">Caldera Springs</a>
          </nav>
          <nav className="foot-col" aria-label="Explore Central Oregon">
            <h3>Central Oregon</h3>
            <a href="/central-oregon/events">Events</a>
            <a href="/central-oregon/venues">Live music {'&'} shows</a>
            <a href="/central-oregon/trails">Trails</a>
            <a href="/lp/central-oregon-golf">Golf</a>
          </nav>
          <nav className="foot-col" aria-label="Buyers">
            <h3>Buyers</h3>
            <a href="/homes-for-sale">Search homes</a>
            <a href="/housing-market">The market</a>
            <a href="/team">The team</a>
          </nav>
          <nav className="foot-col" aria-label="Sellers">
            <h3>Sellers</h3>
            <a href="/sell">What&rsquo;s my home worth</a>
            <a href="/sell">Sell your home</a>
            <a href="/housing-market">Market reports</a>
          </nav>
        </div>
        <div className="foot-bottom">
          <p>&copy; 2026 Ryan Realty · Principal Broker Matt Ryan · Licensed in Oregon · Equal Housing Opportunity</p>
          {fine ? <p className="foot-fine">Active single-family by town: {fine}. Figures from the MLS.</p> : null}
        </div>
      </div>
    </footer>
  )
}
