'use client'

/**
 * Course-pin map for the Central Oregon Golf LP.
 *
 * Two modes:
 *   - Interactive (preferred): Google Maps JS via useGoogleMapsReady. Each
 *     course renders as a navy/blue/gold pin keyed to access type, hover/
 *     click reveals the course name + community link.
 *   - Static fallback: rendered when the Google Maps JS loader is still
 *     coming up or has failed (maps regression mitigation). The fallback
 *     is a stylized list grouped by access type — same information,
 *     different shape. Better than a blank box.
 *
 * Brand palette per Design System v2 (navy + cream, no gold).
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { GOLF_COURSES, type GolfCourse, type CourseAccess } from '@/data/golf/courses'

const NAVY = '#102742'
const CREAM = '#faf8f4'

const ACCESS_LABEL: Record<CourseAccess, string> = {
  public: 'Public',
  resort: 'Resort guests',
  private: 'Private',
  municipal: 'Municipal',
  'semi-private': 'Semi-private',
}

const ACCESS_COLOR: Record<CourseAccess, string> = {
  public: '#2e6f3f', // green-ish for "play any time"
  resort: '#c98a2a', // amber for "resort access"
  private: NAVY,
  municipal: '#1565c0', // blue for muni
  'semi-private': '#5b6cd6',
}

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
]

export function GolfCourseMap() {
  const { ready, error } = useGoogleMapsReady({ libraries: [] })
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  const center = useMemo(() => {
    const lats = GOLF_COURSES.map((c) => c.lat)
    const lngs = GOLF_COURSES.map((c) => c.lng)
    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    }
  }, [])

  // Static fallback while the map loader is coming up — or permanently if it
  // never resolves. Renders the same info as a structured list.
  if (!ready || error) {
    return <CourseListFallback />
  }

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(16,39,66,0.04), 0 8px 24px rgba(16,39,66,0.1)',
        aspectRatio: '16 / 10',
        minHeight: 520,
      }}
    >
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={9}
        options={{
          styles: MAP_STYLES,
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
          zoomControl: true,
          gestureHandling: 'greedy',
          backgroundColor: CREAM,
        }}
      >
        {GOLF_COURSES.map((c) => (
          <Marker
            key={c.slug}
            position={{ lat: c.lat, lng: c.lng }}
            title={c.name}
            onClick={() => setOpenSlug(c.slug)}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: ACCESS_COLOR[c.access],
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
          />
        ))}
        {openSlug && (() => {
          const c = GOLF_COURSES.find((x) => x.slug === openSlug)
          if (!c) return null
          return (
            <InfoWindow
              position={{ lat: c.lat, lng: c.lng }}
              onCloseClick={() => setOpenSlug(null)}
            >
              <div style={{ fontFamily: 'Geist, system-ui, sans-serif', maxWidth: 240 }}>
                <div style={{ fontWeight: 600, color: NAVY, fontSize: 14 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(16,39,66,0.62)', marginTop: 2 }}>
                  {c.city} · {c.holes} holes · par {c.par}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(16,39,66,0.7)', marginTop: 6 }}>
                  {c.designer}, {c.yearOpened}
                </div>
                {c.communitySlug && (
                  <Link
                    href={`/lp/${c.communitySlug}/`}
                    style={{
                      display: 'inline-block',
                      marginTop: 8,
                      fontSize: 12,
                      color: NAVY,
                      textDecoration: 'underline',
                      fontWeight: 600,
                    }}
                  >
                    Search homes near here →
                  </Link>
                )}
              </div>
            </InfoWindow>
          )
        })()}
      </GoogleMap>

      {/* Access-type legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          background: 'rgba(255,255,255,0.95)',
          padding: '10px 14px',
          borderRadius: 10,
          fontFamily: 'Geist, system-ui, sans-serif',
          fontSize: 12,
          color: NAVY,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          maxWidth: 'calc(100% - 32px)',
          boxShadow: '0 1px 2px rgba(16,39,66,0.06), 0 4px 12px rgba(16,39,66,0.08)',
        }}
      >
        {(Object.keys(ACCESS_COLOR) as CourseAccess[]).map((a) => (
          <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: ACCESS_COLOR[a],
                border: '2px solid #ffffff',
                boxShadow: '0 0 0 1px rgba(16,39,66,0.2)',
              }}
            />
            {ACCESS_LABEL[a]}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Pre-map static list. Same info, different shape. Used when the JS API
 * loader is still warming up or has truly failed.
 */
function CourseListFallback() {
  const grouped = useMemo(() => {
    const acc: Record<CourseAccess, GolfCourse[]> = {
      public: [],
      resort: [],
      private: [],
      municipal: [],
      'semi-private': [],
    }
    for (const c of GOLF_COURSES) acc[c.access].push(c)
    return acc
  }, [])

  return (
    <div
      style={{
        background: 'rgba(16,39,66,0.04)',
        borderRadius: 14,
        padding: '24px 28px',
        fontFamily: 'Geist, system-ui, sans-serif',
        color: NAVY,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.62, marginBottom: 16 }}>
        Interactive map loading. Course list below.
      </div>
      {(Object.keys(grouped) as CourseAccess[]).map((a) => {
        const courses = grouped[a]
        if (!courses.length) return null
        return (
          <div key={a} style={{ marginBottom: 20 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: ACCESS_COLOR[a],
                }}
              />
              {ACCESS_LABEL[a]} ({courses.length})
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, columns: 2, columnGap: 24 }}>
              {courses.map((c) => (
                <li
                  key={c.slug}
                  style={{
                    fontSize: 13,
                    padding: '4px 0',
                    breakInside: 'avoid',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{c.shortName}</span>
                  <span style={{ opacity: 0.62, marginLeft: 6 }}>
                    {c.city} · {c.designer}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

export default GolfCourseMap
