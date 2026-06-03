'use client'

/**
 * AddressAutocomplete — Google Places address autocomplete for the seller LP.
 *
 * Real-address picker so leads submit a validated street address (clean data →
 * accurate CMA + geocoding + FUB) instead of free-typed text. Uses the repo's
 * Maps loader (GoogleMapsBootstrap + useGoogleMapsReady) — NOT @react-google-maps/api's
 * broken useJsApiLoader. Restricts to US addresses, biased to the Bend / Central
 * Oregon area. Degrades gracefully: if Places is unavailable the field is a plain
 * text input and the funnel never breaks.
 *
 * Input has no forwardRef, so we attach the Autocomplete widget to the DOM node
 * via a wrapper querySelector — robust regardless of React version.
 */

import { useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'

type Props = {
  id?: string
  value: string
  onChange: (value: string) => void
  onPlaceSelected?: (place: { formattedAddress: string; lat?: number; lng?: number }) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  invalid?: boolean
}

// Bias suggestions toward Bend / Central Oregon (not strict — still allows any US address).
const BEND = { lat: 44.0582, lng: -121.3153 }

export default function AddressAutocomplete({
  id,
  value,
  onChange,
  onPlaceSelected,
  placeholder,
  className,
  autoFocus,
  invalid,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const boundRef = useRef(false)
  const { ready } = useGoogleMapsReady({ libraries: ['places'] })

  useEffect(() => {
    if (!ready || boundRef.current) return
    const inputEl = wrapRef.current?.querySelector('input')
    if (!inputEl) return
    let active = true
    ;(async () => {
      try {
        // google.maps is loosely typed in this repo (no @types/google.maps).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g: any = (window as unknown as { google?: any }).google
        if (!g?.maps?.importLibrary) return
        const places = await g.maps.importLibrary('places')
        if (!active) return
        const ac = new places.Autocomplete(inputEl, {
          types: ['address'],
          componentRestrictions: { country: 'us' },
          fields: ['formatted_address', 'geometry'],
          bounds: new g.maps.LatLngBounds(
            new g.maps.LatLng(BEND.lat - 0.7, BEND.lng - 0.9),
            new g.maps.LatLng(BEND.lat + 0.7, BEND.lng + 0.9),
          ),
        })
        boundRef.current = true
        ac.addListener('place_changed', () => {
          const place = ac.getPlace()
          const formatted = place?.formatted_address
          if (formatted) {
            onChange(formatted)
            onPlaceSelected?.({
              formattedAddress: formatted,
              lat: place.geometry?.location?.lat?.(),
              lng: place.geometry?.location?.lng?.(),
            })
          }
        })
      } catch {
        // Places unavailable — plain text input still works; funnel never breaks.
      }
    })()
    return () => {
      active = false
    }
  }, [ready, onChange, onPlaceSelected])

  return (
    <div ref={wrapRef}>
      <Input
        id={id}
        type="text"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        autoFocus={autoFocus}
        aria-invalid={invalid ? 'true' : undefined}
        inputMode="text"
      />
    </div>
  )
}
