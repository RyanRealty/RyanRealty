'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateGeoPlace } from '@/app/actions/geo-places'
import type { GeoPlaceRow } from '@/app/actions/geo-places'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export default function AssignCommunity({
  cities,
  neighborhoods,
  communities,
}: {
  cities: GeoPlaceRow[]
  neighborhoods: GeoPlaceRow[]
  communities: GeoPlaceRow[]
}) {
  const [communityId, setCommunityId] = useState('')
  const [neighborhoodId, setNeighborhoodId] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleAssign() {
    if (!communityId) return
    setLoading(true)
    try {
      await updateGeoPlace(communityId, { parent_id: neighborhoodId || null })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (communities.length === 0) return null

  return (
    <section className="mt-8 rounded-lg border border-border bg-muted p-4">
      <h2 className="font-semibold text-foreground">Assign community to neighborhood</h2>
      <p className="mt-1 text-sm text-muted-foreground">Set a community&apos;s parent to a neighborhood or leave under city.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Community</span>
          <select
            value={communityId}
            onChange={(e) => setCommunityId(e.target.value)}
            className="rounded border border-border px-3 py-2 text-sm"
          >
            <option value="">Selectâ€¦</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Label>
        <Label className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Neighborhood</span>
          <select
            value={neighborhoodId}
            onChange={(e) => setNeighborhoodId(e.target.value)}
            className="rounded border border-border px-3 py-2 text-sm"
          >
            <option value="">City only (no neighborhood)</option>
            {neighborhoods.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        </Label>
        <Button
          type="button"
          onClick={handleAssign}
          disabled={loading || !communityId}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary disabled:opacity-60"
        >
          {loading ? 'Savingâ€¦' : 'Assign'}
        </Button>
      </div>
    </section>
  )
}
