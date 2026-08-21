'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
import { publishPlaceBrowseHref } from '@/lib/search/publish-place-browse-href'
import type { HoodDChild, HoodDMapRow } from './types'

export function HoodDMap({
  name,
  rows,
  mapGeo,
  polygons,
  totalActive,
  browseHref,
  childrenPlaces,
}: {
  name: string
  rows: HoodDMapRow[]
  mapGeo: KbMapGeo
  polygons?: {
    type: 'FeatureCollection'
    features: Array<{ type: 'Feature'; geometry: unknown; properties: { name: string } }>
  }
  totalActive: number
  browseHref: string
  childrenPlaces: HoodDChild[]
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const onPinSelect = useCallback((key: string | null) => {
    setActiveKey(key)
  }, [])

  if (rows.length === 0 && !polygons) return null

  return (
    <section className="hood-d-section" id="on-the-map">
      <div className="hood-d-wrap">
        <div className="hood-d-section-head">
          <span className="hood-d-eyebrow">On the map</span>
          <h2 className="hood-d-display">Homes in {name}</h2>
        </div>
        <div className="hood-d-map-split hood-d-map">
          {rows.length > 0 ? (
            <ul className="hood-d-map-list">
              {rows.map((row) => {
                const shareKind = publishListingShareKind({
                  propertySubType: row.propertySubType,
                  subdivisionName: row.subdivisionName,
                  city: row.city,
                  listNumber: row.listNumber,
                })
                return (
                  <li key={row.key}>
                    <Link
                      href={row.href}
                      data-active={activeKey === row.key ? 'true' : 'false'}
                      onMouseEnter={() => setActiveKey(row.key)}
                      onFocus={() => setActiveKey(row.key)}
                    >
                      {row.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="hood-d-thumb" src={row.photoUrl} alt="" width={72} height={52} />
                      ) : (
                        <span className="hood-d-thumb" aria-hidden />
                      )}
                      <span>
                        <span className="hood-d-map-name">{formatPublishedAsk(row.price) ?? 'Price on request'}</span>
                        {shareKind ? <span className="hood-d-map-meta">{shareKind}</span> : null}
                        <span className="hood-d-map-meta">
                          {row.title}
                          {row.subtitle ? ` · ${row.subtitle}` : ''}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : null}
          <div className="hood-d-map-canvas">
            <KbListingMap
              geojson={mapGeo}
              totalActive={totalActive}
              fitToFeatures
              showRegionMarkers={false}
              polygons={polygons}
              browseHref={publishPlaceBrowseHref(browseHref)}
              eyebrow={name}
              title={name}
              subtitle=""
              countNoun="homes"
              activeKey={activeKey}
              onActiveKeyChange={onPinSelect}
            />
          </div>
        </div>
        {childrenPlaces.length > 0 ? (
          <ul className="hood-d-chips" aria-label={`Places inside ${name}`}>
            {childrenPlaces.map((child) => (
              <li key={child.href}>
                <Link href={child.href}>{child.name}</Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
