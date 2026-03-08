'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ensureGeoPlacesFromListings } from '../../actions/geo-places'

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
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {loading ? 'Running…' : 'Ensure geo places from listings'}
      </button>
      {message && <p className="mt-2 text-sm text-zinc-700">{message}</p>}
    </div>
  )
}
