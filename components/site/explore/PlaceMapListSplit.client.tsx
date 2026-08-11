'use client'

/**
 * Dual-pane list ↔ map for place pages (subdivision / neighborhood / city / community).
 * List hover OR pin click → shared activeKey (list highlight + pin bounce).
 * Editorial ledger + KbListingMap (no second card grid).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  /** Empty-map center when pins exist but dual-pane still wants a registry fallback. */
  centerLonLat?: [number, number]
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
  centerLonLat,
}: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const list = useMemo(() => rows.slice(0, 24), [rows])
  const listScrollRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map())

  const onPinSelect = useCallback((key: string | null) => {
    setActiveKey(key)
  }, [])

  // Pin click → scroll the matching list row into view.
  useEffect(() => {
    if (!activeKey) return
    const el = rowRefs.current.get(activeKey)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeKey])

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
              ref={listScrollRef}
              className="overflow-y-auto rounded-sm border border-[rgba(16,39,66,0.12)] bg-[color:var(--cream)]"
              style={{ maxHeight: 'min(70vh, 560px)' }}
            >
              <ul className="m-0 list-none p-0">
                {list.map((row) => {
                  const selected = activeKey === row.key
                  return (
                    <li
                      key={row.key}
                      ref={(node) => {
                        if (node) rowRefs.current.set(row.key, node)
                        else rowRefs.current.delete(row.key)
                      }}
                      className="border-b border-[rgba(16,39,66,0.1)]"
                    >
                      <Link
                        href={row.href}
                        onMouseEnter={() => setActiveKey(row.key)}
                        onFocus={() => setActiveKey(row.key)}
                        className={`flex gap-3 px-3.5 py-3 no-underline ${
                          selected ? 'bg-[rgba(16,39,66,0.06)]' : 'bg-transparent'
                        }`}
                        style={{
                          color: 'var(--navy)',
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
                            className="h-[54px] w-[72px] shrink-0 rounded-sm border border-[rgba(16,39,66,0.12)] object-cover"
                          />
                        ) : (
                          <div className="h-[54px] w-[72px] shrink-0 bg-[rgba(16,39,66,0.08)]" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="mono-num text-base font-bold">
                            {formatPrice(row.price)}
                          </div>
                          <div className="truncate text-[0.85rem] font-semibold">
                            {row.title}
                          </div>
                          {row.subtitle ? (
                            <div className="text-[0.78rem]" style={{ color: 'var(--navy-70)' }}>
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
                <div className="p-3.5">
                  <Link href={viewAllHref} className="btn alt text-[0.85rem]">
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
                centerLonLat={centerLonLat}
                eyebrow={eyebrow}
                title={title.includes('\n') ? title : `Map\n${title}`}
                subtitle={
                  activeKey
                    ? 'List and map stay linked. Hover a row or tap a pin.'
                    : 'Hover the list or tap a pin. Zoom for photo stamps.'
                }
                countNoun="active listings"
                activeKey={activeKey}
                onActiveKeyChange={onPinSelect}
              />
            </div>
        </div>
      </div>
    </section>
  )
}
