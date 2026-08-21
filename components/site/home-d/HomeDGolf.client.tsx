'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { HomeDCommunity } from './types'

export function HomeDGolf({ communities }: { communities: HomeDCommunity[] }) {
  const firstWithPhoto = communities.find((c) => c.img) ?? communities[0] ?? null
  const [activeHref, setActiveHref] = useState<string | null>(firstWithPhoto?.href ?? null)
  const active = communities.find((c) => c.href === activeHref) ?? firstWithPhoto

  if (communities.length === 0 || !active) return null

  return (
    <section className="home-d-section" id="communities">
      <div className="home-d-wrap">
        <span className="home-d-eyebrow">Golf and master-plan</span>
        <div className="home-d-golf-split">
          <div className="home-d-golf-photo">
            {active.img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={active.img} alt="" />
            ) : null}
          </div>
          <div className="home-d-golf-copy">
            <h2 className="home-d-display">{active.name}</h2>
            <p className="home-d-golf-sub">{active.town}</p>
            <ul className="home-d-golf-list">
              {communities.map((c) => (
                <li key={c.href}>
                  <Link
                    href={c.href}
                    data-active={c.href === active.href ? 'true' : 'false'}
                    onMouseEnter={() => setActiveHref(c.href)}
                    onFocus={() => setActiveHref(c.href)}
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/communities" className="home-d-golf-more">
              See every community
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
