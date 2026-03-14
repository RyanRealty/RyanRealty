'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { generateSubdivisionDescription } from '../app/actions/subdivision-descriptions'
import { Button } from "@/components/ui/button"

type Props = {
  generateAction: typeof generateSubdivisionDescription
  city: string
  subdivisionName: string
  hasDescription: boolean
}

export default function SubdivisionDescriptionActions({
  generateAction,
  city,
  subdivisionName,
  hasDescription,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const result = await generateAction(city, subdivisionName)
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
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm hover:bg-muted disabled:opacity-60"
      >
        {loading ? 'Generating…' : hasDescription ? 'Regenerate description' : 'Generate description'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
