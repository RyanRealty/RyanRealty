'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState } from 'react'
import { kbMoneyFull } from '@/components/site/kb/types'
import type { HomeDPolygonFeature, HomeDTown } from './types'

const TownsMap = dynamic(
  () => import('./HomeDTownsMapImpl').then((m) => m.HomeDTownsMapImpl),
  {
    ssr: false,
    loading: () => <div className="home-d-towns-map-el animate-pulse bg-card" aria-hidden />,
  },
)

export function HomeDTowns({
  towns,
  polygons,
  notes,
}: {
  towns: HomeDTown[]
  polygons: HomeDPolygonFeature[]
  notes?: string[]
}) {
  const [activeSlug, setActiveSlug] = useState<string | null>(towns[0]?.slug ?? null)
  const countLabel = towns.length === 1 ? 'One town' : `${towns.length} towns`

  if (towns.length === 0) return null

  return (
    <section className="home-d-section" id="towns">
      <div className="home-d-wrap">
        <div className="home-d-section-head">
          <span className="home-d-eyebrow">Towns</span>
          <h2 className="home-d-display">Where to start</h2>
          <p className="home-d-kicker">{countLabel}.</p>
        </div>
        <div className="home-d-towns-split">
          <ul className="home-d-towns-list">
            {towns.map((t) => (
              <li key={t.slug}>
                <Link
                  href={t.href}
                  data-active={activeSlug === t.slug ? 'true' : 'false'}
                  onMouseEnter={() => setActiveSlug(t.slug)}
                  onFocus={() => setActiveSlug(t.slug)}
                >
                  {t.img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="home-d-thumb" src={t.img} alt="" width={72} height={52} />
                  ) : (
                    <span className="home-d-thumb" aria-hidden />
                  )}
                  <span>
                    <span className="home-d-towns-name">{t.name}</span>
                    <span className="home-d-towns-meta">
                      {t.activeCount != null ? `${t.activeCount.toLocaleString('en-US')} active` : null}
                      {t.activeCount != null && kbMoneyFull(t.medianPrice) ? ' · ' : null}
                      {kbMoneyFull(t.medianPrice) ? `${kbMoneyFull(t.medianPrice)} median` : null}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {polygons.length > 0 ? (
            <div className="home-d-towns-map">
              <TownsMap polygons={polygons} activeSlug={activeSlug} onActiveSlug={setActiveSlug} />
            </div>
          ) : null}
        </div>
        {notes && notes.length > 0 ? (
          <div className="home-d-towns-notes">
            {notes.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
