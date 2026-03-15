'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ensureGeoPlacesFromListings } from '@/app/actions/geo-places'
import { Button } from "@/components/ui/button"

export default function EnsureGeoButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    setMessage(null)
    try {
      const res = await ensureGeoPlacesFromListings()
      if (res.ok) {
        setMessage(`Cities ensured: ${res.citiesEnsured}.`)
        router.refresh()
      } else {
        setMessage(`Error: ${res.error}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3">
      <Button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary disabled:opacity-60"
      >
        {loading ? 'Runningâ€¦' : 'Ensure geo places from listings'}
      </Button>
      {message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}
    </div>
  )
}
