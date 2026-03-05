'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { setDefaultHomeCity } from '@/app/actions/profile'
import { HOME_CITY_COOKIE } from '@/lib/home-city'

const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 // 1 year

type Props = {
  currentCity: string
  cities: { City: string; count: number }[]
  signedIn: boolean
}

export default function HomeCitySelector({ currentCity, cities, signedIn }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [updating, setUpdating] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [open])

  async function handleSelect(city: string) {
    if (city === currentCity) {
      setOpen(false)
      return
    }
    setUpdating(true)
    setOpen(false)
    const result = await setDefaultHomeCity(city)
    if (result.setCookie) {
      document.cookie = `${HOME_CITY_COOKIE}=${encodeURIComponent(result.setCookie)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
    }
    setUpdating(false)
    router.refresh()
  }

  const cityList = cities.length > 0 ? cities : [{ City: 'Bend', count: 0 }]
  const displayCity = cityList.some((c) => c.City === currentCity) ? currentCity : 'Bend'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={updating}
        className="flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-left text-sm font-medium text-zinc-900 shadow-md backdrop-blur-sm transition hover:bg-white disabled:opacity-70"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Change default city"
      >
        <span className="capitalize">{displayCity}</span>
        <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute bottom-full right-0 z-10 mb-2 max-h-64 w-52 overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {cityList.slice(0, 30).map(({ City }) => (
            <button
              key={City}
              type="button"
              role="option"
              aria-selected={City === displayCity}
              onClick={() => handleSelect(City)}
              className={`w-full px-4 py-2 text-left text-sm capitalize hover:bg-zinc-100 ${
                City === displayCity ? 'bg-zinc-100 font-medium' : ''
              }`}
            >
              {City}
            </button>
          ))}
        </div>
      )}
      {signedIn && (
        <p className="mt-1.5 text-xs text-white/80">Saved to your account</p>
      )}
    </div>
  )
}
