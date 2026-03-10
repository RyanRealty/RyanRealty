'use client'

import { useEffect, useRef, useState } from 'react'

function formatPrice(n: number | null | undefined): string {
  if (n == null) return ''
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`
  return `$${n}`
}

type Props = {
  latitude?: number
  longitude?: number
  price?: number
  address?: string
}

export default function ListingMap({ latitude, longitude, price, address }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [scriptLoaded, setScriptLoaded] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setInView(true)
      },
      { rootMargin: '100px', threshold: 0.1 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!inView || scriptLoaded) return
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
    if (!key) {
      setScriptLoaded(true)
      return
    }
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      setScriptLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`
    script.async = true
    script.defer = true
    script.onload = () => setScriptLoaded(true)
    document.head.appendChild(script)
  }, [inView, scriptLoaded])

  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || latitude == null || longitude == null) return
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
    if (!key) return

    const g = (window as unknown as { google?: { maps: { Map: new (el: HTMLElement, opts: Record<string, unknown>) => unknown; Marker: new (opts: Record<string, unknown>) => { setMap: (m: unknown) => void }; LatLng: new (lat: number, lng: number) => unknown } } }).google
    if (!g?.maps) return

    const map = new g.maps.Map(containerRef.current, {
      center: { lat: latitude, lng: longitude },
      zoom: 15,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ],
    })

    const marker = new g.maps.Marker({
      position: new g.maps.LatLng(latitude, longitude),
      map,
      title: address ?? undefined,
      label: price != null ? { text: formatPrice(price).replace('$', ''), color: 'white', fontSize: '11px' } : undefined,
    })
    marker.setMap(map)
  }, [scriptLoaded, latitude, longitude, price, address])

  if (latitude == null || longitude == null) {
    return (
      <div className="rounded-xl bg-[var(--gray-bg)] aspect-video flex items-center justify-center text-[var(--gray-muted)]">
        No map location available
      </div>
    )
  }

  return (
    <section className="space-y-3">
      <div
        ref={containerRef}
        className="rounded-xl overflow-hidden bg-[var(--gray-border)] aspect-video min-h-[200px]"
        aria-label="Property map"
      />
      <p className="text-sm text-[var(--gray-secondary)]">What&apos;s Nearby: schools, walkability — data added later.</p>
    </section>
  )
}
