'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { setDefaultHomeCity } from '@/app/actions/profile'
import { HOME_CITY_COOKIE } from '@/lib/home-city'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { Button } from "@/components/ui/button"

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
      <Button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={updating}
        className="flex items-center gap-2 rounded-lg bg-card/95 px-3 py-2 text-left text-sm font-medium text-foreground shadow-md backdrop-blur-sm transition hover:bg-card disabled:opacity-70"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Change default city"
      >
        <span className="capitalize">{displayCity}</span>
        <HugeiconsIcon icon={ArrowDown01Icon} className="h-4 w-4 text-muted-foreground" aria-hidden />
      </Button>
      {open && (
        <div
          className="absolute bottom-full right-0 z-10 mb-2 max-h-64 w-52 overflow-auto rounded-lg border border-border bg-card py-1 shadow-md"
          role="listbox"
        >
          {cityList.slice(0, 30).map(({ City }) => (
            <Button
              key={City}
              type="button"
              role="option"
              aria-selected={City === displayCity}
              onClick={() => handleSelect(City)}
              className={`w-full px-4 py-2 text-left text-sm capitalize hover:bg-muted ${
                City === displayCity ? 'bg-muted font-medium' : ''
              }`}
            >
              {City}
            </Button>
          ))}
        </div>
      )}
      {signedIn && (
        <p className="mt-1.5 text-xs text-white/80">Saved to your account</p>
      )}
    </div>
  )
}
