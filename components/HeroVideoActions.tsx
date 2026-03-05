'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { generateHeroVideoForPage } from '../app/actions/hero-videos'

type Props = {
  generateAction: typeof generateHeroVideoForPage
  entityType: 'city' | 'subdivision'
  entityKey: string
  displayName: string
  city?: string
  hasVideo: boolean
}

export default function HeroVideoActions({
  generateAction,
  entityType,
  entityKey,
  displayName,
  city,
  hasVideo,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const result = await generateAction({
        entityType,
        entityKey,
        displayName,
        city: entityType === 'subdivision' ? city : undefined,
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
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
      >
        {loading ? (
          'Generating video… (may take a few min)'
        ) : hasVideo ? (
          'Refresh hero video'
        ) : (
          'Generate hero video'
        )}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
