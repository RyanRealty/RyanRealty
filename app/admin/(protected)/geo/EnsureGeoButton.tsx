'use client'

// Migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only: the ensureGeoPlacesFromListings() call, the ok/error
// branches, the exact result and error strings, the router.refresh() and the
// loading label are unchanged. The shadcn Button became the v2 Button in its
// quiet variant — this is the page's maintenance action, not its primary one
// (that is "Create" on the neighborhood form).

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ensureGeoPlacesFromListings } from '@/app/actions/geo-places'
import { Button } from '@/components/admin/v2'

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
    <div>
      <Button type="button" variant="quiet" onClick={handleClick} disabled={loading}>
        {loading ? 'Running…' : 'Ensure geo places from listings'}
      </Button>
      {message && (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '8px 0 0' }}>
          {message}
        </p>
      )}
    </div>
  )
}
