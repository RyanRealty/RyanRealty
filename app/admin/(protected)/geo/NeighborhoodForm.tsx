'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createGeoPlace } from '@/app/actions/geo-places'
import type { GeoPlaceRow } from '@/app/actions/geo-places'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

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
    <section className="mt-8 rounded-lg border border-border bg-muted p-4">
      <h2 className="font-semibold text-foreground">Create neighborhood</h2>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-3">
        <Label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">City</span>
          <select
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            className="rounded border border-border px-3 py-2 text-sm"
          >
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Label>
        <Label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Neighborhood name</span>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. West Side"
            className="rounded border border-border px-3 py-2 text-sm"
          />
        </Label>
        <Button
          type="submit"
          disabled={loading || !name.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary disabled:opacity-60"
        >
          {loading ? 'Creatingâ€¦' : 'Create'}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  )
}
