'use client'

import { useState } from 'react'
import type { generateWeeklyMarketReport } from '@/app/actions/generate-market-report'
import { Button } from "@/components/ui/button"

type GenerateAction = typeof generateWeeklyMarketReport

export default function GenerateReportButton({ generateAction }: { generateAction: GenerateAction }) {
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
        {loading ? 'Generating…' : 'Generate weekly report'}
      </Button>
      {result && (
        <div
          className={`mt-4 rounded-lg border p-4 text-sm ${result.ok ? 'border-border bg-muted text-foreground' : 'border-warning/30 bg-warning/10 text-foreground'}`}
        >
          {result.ok ? (
            <>
              <strong>Done.</strong> <a href={result.url} className="underline" target="_blank" rel="noopener noreferrer">{result.url}</a>
            </>
          ) : (
            <><strong>Error:</strong> {result.error}</>
          )}
        </div>
      )}
    </div>
  )
}
