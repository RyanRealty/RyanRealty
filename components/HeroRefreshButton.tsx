'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { refreshHeroMedia } from '../app/actions/hero-videos'
import { Button } from "@/components/ui/button"

type Props = {
  refreshAction: typeof refreshHeroMedia
  entityType: 'city' | 'subdivision'
  entityKey: string
  searchQuery: string
}

export default function HeroRefreshButton({
  refreshAction,
  entityType,
  entityKey,
  searchQuery,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRefresh() {
    setLoading(true)
    setError(null)
    try {
      const result = await refreshAction({
        entityType,
        entityKey,
        searchQuery,
      })
      if (result.ok) {
        router.refresh()
      } else {
        setError(result.error)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        onClick={handleRefresh}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm hover:bg-muted disabled:opacity-60"
      >
        {loading ? 'Refreshing… (new image + video, may take a few min)' : 'Refresh'}
      </Button>
      {error && <p className="text-sm text-destructive/60 drop-shadow-md">{error}</p>}
    </div>
  )
}
