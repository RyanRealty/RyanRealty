'use client'
// brand-voice:exempt — pure UI component, no user-facing prose

import { Fragment, useCallback, useMemo, useRef, useState } from 'react'
import { GoogleMap, OverlayViewF, OVERLAY_MOUSE_TARGET, Polyline } from '@react-google-maps/api'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { formatPriceLabel, getBaseMapOptions, MAP_BOUNDARY_STYLES } from '@/lib/maps/markers'
import { cn } from '@/lib/utils'

/**
 * VenueMap.client — a point map for a single venue (an event, a landmark, any
 * place with a coordinate but no authoritative boundary polygon). Drops a navy
 * venue marker and renders the nearby active listings as price pills that link
 * to each home.
 *
 * This is the polygon-free sibling of NeighborhoodMap: it never draws or
 * approximates a boundary (CLAUDE.md GIS rule), it only marks a known point and
 * plots the verified home pins around it. Use NeighborhoodMap when an
 * authoritative polygon exists; use this when only a point does.
 */

export type VenuePin = {
  lat: number
  lng: number
  href?: string
  price?: number | null
}

type Props = {
  venue: { lat: number; lng: number; name: string }
  listings?: ReadonlyArray<VenuePin>
  zoom?: number
  height?: number
  /**
   * Optional authoritative route linework (GeoJSON LineString | MultiLineString,
   * from public.trail_lines). When present the map draws the trail as a line and
   * fits to it. Never approximated — null means no verified line, point only.
   */
  line?: GeoJSON.LineString | GeoJSON.MultiLineString | null
}

/** GeoJSON [lng,lat] rings -> Google Maps {lat,lng} paths. */
function lineToPaths(geom: GeoJSON.LineString | GeoJSON.MultiLineString): google.maps.LatLngLiteral[][] {
  const rings = geom.type === 'LineString' ? [geom.coordinates] : geom.coordinates
  return rings.map((ring) => ring.map(([lng, lat]) => ({ lat, lng })))
}

/** Navy price pill that links to the listing. */
function PricePill({ pin }: { pin: VenuePin }) {
  const label = pin.price ? formatPriceLabel(pin.price) : null
  if (!label) return null
  return (
    <OverlayViewF
      position={{ lat: pin.lat, lng: pin.lng }}
      mapPaneName={OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={(w, h) => ({ x: -(w / 2), y: -h })}
    >
      <a
        href={pin.href ?? '#'}
        className="relative flex items-center justify-center rounded-full border-2 border-white px-2.5 py-1 text-xs font-semibold leading-none shadow-md transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        // Inline navy bg + white text: the KB page's `a` color rule overrides the
        // Tailwind text-white utility, so the price must be forced white here or
        // it renders navy-on-navy (invisible). Matches the site's price pills.
        style={{ backgroundColor: '#102742', color: '#ffffff', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
        aria-label={'Home for sale at ' + label}
      >
        {label}
        <span
          aria-hidden
          className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 border-4 border-transparent border-t-primary"
          style={{ borderTopWidth: 7, borderLeftWidth: 5, borderRightWidth: 5 }}
        />
      </a>
    </OverlayViewF>
  )
}

export default function VenueMapClient({ venue, listings, zoom = 13, height = 460, line }: Props) {
  const { ready, error } = useGoogleMapsReady()
  const mapRef = useRef<google.maps.Map | null>(null)
  const [center] = useState(() => ({ lat: venue.lat, lng: venue.lng }))

  const linePaths = useMemo(() => (line ? lineToPaths(line) : []), [line])

  const containerStyle = useMemo(() => ({ width: '100%', height: height + 'px' }), [height])
  const mapOptions = useMemo<google.maps.MapOptions>(
    () => ({ ...getBaseMapOptions(), styles: MAP_BOUNDARY_STYLES, mapTypeControl: false, fullscreenControl: false }),
    [],
  )

  const validPins = useMemo(
    () =>
      (listings ?? [])
        .filter((l) => typeof l.lat === 'number' && typeof l.lng === 'number' && l.price)
        .slice(0, 60),
    [listings],
  )

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map
      // When a route line exists, fit the map to the whole trail (+ trailhead)
      // rather than a fixed zoom on the point.
      if (linePaths.length > 0) {
        const bounds = new google.maps.LatLngBounds()
        bounds.extend({ lat: venue.lat, lng: venue.lng })
        for (const ring of linePaths) for (const pt of ring) bounds.extend(pt)
        map.fitBounds(bounds, 48)
      }
    },
    [linePaths, venue.lat, venue.lng],
  )

  if (error || !ready) {
    return (
      <div
        aria-hidden
        style={{ height: height + 'px' }}
        className="animate-pulse rounded-xl border border-border bg-card"
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-sm">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={zoom}
        options={mapOptions}
        onLoad={onLoad}
      >
        {/* Authoritative trail route (public.trail_lines). White casing under a
            navy line so it stays legible over any map imagery. */}
        {linePaths.map((path, i) => (
          <Fragment key={'ln-' + i}>
            <Polyline path={path} options={{ strokeColor: '#ffffff', strokeOpacity: 0.9, strokeWeight: 7, clickable: false, zIndex: 1 }} />
            <Polyline path={path} options={{ strokeColor: '#102742', strokeOpacity: 1, strokeWeight: 4, clickable: false, zIndex: 2 }} />
          </Fragment>
        ))}

        {/* Venue location marker — a distinct ringed dot, NOT a price pill, so it
            never reads as a listing. The section heading names the venue; this
            just marks the reference point the nearby homes are measured from. */}
        <OverlayViewF
          position={{ lat: venue.lat, lng: venue.lng }}
          mapPaneName={OVERLAY_MOUSE_TARGET}
          getPixelPositionOffset={(w, h) => ({ x: -(w / 2), y: -(h / 2) })}
        >
          <div
            aria-label={venue.name}
            title={venue.name}
            className={cn('flex items-center justify-center rounded-full shadow-md')}
            style={{
              width: 22,
              height: 22,
              backgroundColor: '#102742',
              border: '3px solid #ffffff',
              boxShadow: '0 1px 6px rgba(16,39,66,0.5)',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ffffff' }} />
          </div>
        </OverlayViewF>

        {validPins.map((pin, i) => (
          <PricePill key={pin.lat + '-' + pin.lng + '-' + i} pin={pin} />
        ))}
      </GoogleMap>
    </div>
  )
}
