'use client'

// Migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only: the createGeoPlace({ type: 'neighborhood', parentId,
// name }) call with the same trim, the same `cities.length === 0` early
// return, the same initial cityId (selectedCityId, else the first city), the
// same disabled rule, the same error surface and the same router.refresh()
// are unchanged. The raw <select> became SelectField and the raw <h2> became
// SectionHead; "Create" stays the page's one primary action.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createGeoPlace } from '@/app/actions/geo-places'
import type { GeoPlaceRow } from '@/app/actions/geo-places'
import { Button, SectionHead, SelectField, TextField } from '@/components/admin/v2'

export default function NeighborhoodForm({
  cities,
  selectedCityId,
}: {
  cities: GeoPlaceRow[]
  selectedCityId?: string
}) {
  const [cityId, setCityId] = useState(selectedCityId ?? cities[0]?.id ?? '')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await createGeoPlace({
        type: 'neighborhood',
        parentId: cityId || null,
        name: name.trim(),
      })
      if (res.ok) {
        setName('')
        router.refresh()
      } else {
        setError(res.error)
      }
    } finally {
      setLoading(false)
    }
  }

  if (cities.length === 0) return null

  return (
    <section>
      <SectionHead>Create neighborhood</SectionHead>
      <form onSubmit={handleSubmit} className="av2-inline-form">
        <SelectField
          label="City"
          value={cityId}
          onChange={(e) => setCityId(e.target.value)}
        >
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Neighborhood name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. West Side"
        />
        <Button type="submit" disabled={loading || !name.trim()}>
          {loading ? 'Creating…' : 'Create'}
        </Button>
      </form>
      {error && (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)', margin: '8px 0 0' }}>
          {error}
        </p>
      )}
    </section>
  )
}
