'use client'

/**
 * Dual-pane list ↔ map for place pages (subdivision / neighborhood inventory).
 * Hover/select a row → emphasize matching map pin via shared active key.
 * Editorial ledger + KbListingMap (no second card grid).
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { formatPrice } from '@/lib/format/money'

export type PlaceMapListRow = {
  key: string
  href: string
  title: string
  subtitle?: string | null
  price: number | null
  photoUrl?: string | null
  lat?: number | null
  lng?: number | null
}

type Props = {
  rows: PlaceMapListRow[]
  mapGeo: KbMapGeo
  polygons?: {
    type: 'FeatureCollection'
    features: Array<{ type: 'Feature'; geometry: unknown; properties: { name: string } }>
  }
  eyebrow: string
  title: string
  subtitle?: string
  totalActive: number
  viewAllHref?: string
  viewAllLabel?: string
}

export function PlaceMapListSplit({
  rows,
  mapGeo,
  polygons,
  eyebrow,
  title,
  subtitle,
  totalActive,
  viewAllHref,
  viewAllLabel,
}: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const list = useMemo(() => rows.slice(0, 24), [rows])

  if (list.length === 0) return null

  return (
    <section className="section" aria-label={title}>
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">{eyebrow}</span>
          <h2 className="sec-title display">{title}</h2>
        </div>
        {subtitle ? (
          <p className="mt-2 max-w-prose text-sm" style={{ color: 'var(--navy-70)' }}>
            {subtitle}
          </p>
        ) : null}
        <div className="place-map-split mt-6 grid gap-6 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] lg:items-start">
            <div
              className="max-h-[min(70vh,560px)] overflow-y-auto rounded-sm border border-[rgba(16,39,66,0.12)]"
              style={{ background: 'var(--cream)' }}
            >
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {list.map((row) => {
                  const selected = activeKey === row.key
                  return (
                    <li key={row.key} style={{ borderBottom: '1px solid rgba(16,39,66,0.1)' }}>
                      <Link
                        href={row.href}
                        onMouseEnter={() => setActiveKey(row.key)}
                        onFocus={() => setActiveKey(row.key)}
                        style={{
                          display: 'flex',
                          gap: 12,
                          padding: '12px 14px',
                          textDecoration: 'none',
                          color: 'var(--navy)',
                          background: selected ? 'rgba(16,39,66,0.06)' : 'transparent',
                          boxShadow: selected ? 'inset 3px 0 0 var(--navy)' : undefined,
                        }}
                      >
                        {row.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.photoUrl}
                            alt=""
                            width={72}
                            height={54}
                            style={{
                              width: 72,
                              height: 54,
                              objectFit: 'cover',
                              borderRadius: 2,
                              flexShrink: 0,
                              border: '1px solid rgba(16,39,66,0.12)',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 72,
                              height: 54,
                              background: 'rgba(16,39,66,0.08)',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            className="mono-num"
                            style={{ fontWeight: 700, fontSize: '1rem' }}
                          >
                            {formatPrice(row.price)}
                          </div>
                          <div
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {row.title}
                          </div>
                          {row.subtitle ? (
                            <div style={{ fontSize: '0.78rem', color: 'var(--navy-70)' }}>
                              {row.subtitle}
                            </div>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
              {viewAllHref && viewAllLabel ? (
                <div style={{ padding: 14 }}>
                  <Link href={viewAllHref} className="btn alt" style={{ fontSize: '0.85rem' }}>
                    {viewAllLabel} <span className="arr">→</span>
                  </Link>
                </div>
              ) : null}
            </div>
            <div>
              <KbListingMap
                geojson={mapGeo}
                totalActive={totalActive}
                fitToFeatures
                showRegionMarkers={false}
                polygons={polygons}
                eyebrow={eyebrow}
                title={title.includes('\n') ? title : `Map\n${title}`}
                subtitle={
                  activeKey
                    ? 'Hover a home in the list. That pin lifts on the map.'
                    : 'Hover the list to light a pin. Zoom for photo stamps.'
                }
                countNoun="active listings"
                activeKey={activeKey}
              />
            </div>
        </div>
      </div>
    </section>
  )
}
