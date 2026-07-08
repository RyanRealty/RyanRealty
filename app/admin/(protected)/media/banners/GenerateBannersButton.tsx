'use client'

import { useState } from 'react'
import type { generateAllMissingBanners } from '@/app/actions/banners'
import { Button } from "@/components/ui/button"

type GenerateAction = typeof generateAllMissingBanners

export default function GenerateBannersButton({ generateAction }: { generateAction: GenerateAction }) {
  const [result, setResult] = useState<Awaited<ReturnType<GenerateAction>> | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    setResult(null)
    try {
      const res = await generateAction()
      setResult(res)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading ? 'Generating…' : 'Generate missing banners'}
      </Button>
      {result && (
        <div
          className={`mt-4 rounded-lg border p-4 text-sm ${result.failed > 0 ? 'border-warning bg-warning/10 text-foreground' : 'border-border bg-muted text-foreground'}`}
        >
          <strong>Done:</strong> generated {result.generated}, failed {result.failed}.
          {result.errors.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-warning">
              {result.errors.slice(0, 10).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {result.errors.length > 10 && <li>… and {result.errors.length - 10} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
