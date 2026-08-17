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
 *
 * The suggestion list is position:absolute on document.body. While it is open
 * the wrapper reserves space so Value my home stays below .pac-item rows
 * (fleet /sell overlay). Bind once, destroy on unmount, and ignore a stale
 * empty input event right after place_changed so React cannot wipe a commit.
 * The empty-ignore is a ref flag, not Date.now(), so ci:hydration-safety stays quiet.
 */

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { cn } from '@/lib/utils'

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
  const onChangeRef = useRef(onChange)
  const onPlaceSelectedRef = useRef(onPlaceSelected)
  const ignoreEmptyRef = useRef(false)
  const acRef = useRef<{ unbind: () => void } | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const { ready } = useGoogleMapsReady({ libraries: ['places'] })
  onChangeRef.current = onChange
  onPlaceSelectedRef.current = onPlaceSelected

  useEffect(() => {
    if (!ready || acRef.current) return
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
        if (!active || acRef.current) return
        const before = new Set(document.querySelectorAll('.pac-container'))
        const ac = new places.Autocomplete(inputEl, {
          types: ['address'],
          componentRestrictions: { country: 'us' },
          fields: ['formatted_address', 'geometry'],
          bounds: new g.maps.LatLngBounds(
            new g.maps.LatLng(BEND.lat - 0.7, BEND.lng - 0.9),
            new g.maps.LatLng(BEND.lat + 0.7, BEND.lng + 0.9),
          ),
        })
        const mine = [...document.querySelectorAll('.pac-container')].filter(
          (el) => !before.has(el),
        ) as HTMLElement[]
        const hideMine = () => {
          for (const el of mine) el.style.display = 'none'
        }
        const listener = ac.addListener('place_changed', () => {
          const place = ac.getPlace()
          const formatted = typeof place?.formatted_address === 'string' ? place.formatted_address : ''
          if (formatted) {
            ignoreEmptyRef.current = true
            inputEl.value = formatted
            onChangeRef.current(formatted)
            onPlaceSelectedRef.current?.({
              formattedAddress: formatted,
              lat: place.geometry?.location?.lat?.(),
              lng: place.geometry?.location?.lng?.(),
            })
          }
          setSuggesting(false)
          hideMine()
        })
        acRef.current = {
          unbind: () => {
            try {
              listener?.remove?.()
              g.maps?.event?.clearInstanceListeners?.(ac)
            } catch {
              // widget already gone
            }
            for (const el of mine) el.remove()
          },
        }
      } catch {
        // Places unavailable — plain text input still works; funnel never breaks.
      }
    })()
    return () => {
      active = false
      acRef.current?.unbind()
      acRef.current = null
    }
  }, [ready])

  return (
    <div
      ref={wrapRef}
      className={cn(suggesting && 'pb-48')}
      onFocusCapture={() => {
        if (value.trim()) setSuggesting(true)
      }}
      onBlurCapture={() => {
        window.setTimeout(() => setSuggesting(false), 200)
      }}
    >
      <Input
        id={id}
        type="text"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          const next = e.target.value
          if (!next && ignoreEmptyRef.current) {
            ignoreEmptyRef.current = false
            return
          }
          ignoreEmptyRef.current = false
          setSuggesting(next.trim().length > 0)
          onChange(next)
        }}
        placeholder={placeholder}
        className={className}
        autoFocus={autoFocus}
        aria-invalid={invalid ? 'true' : undefined}
        inputMode="text"
      />
    </div>
  )
}
