'use client'

import { useState } from 'react'
import type { generateWeeklyMarketReport } from '../../actions/generate-market-report'

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
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-400 disabled:cursor-not-allowed"
      >
        {loading ? 'Generating…' : 'Generate weekly report'}
      </button>
      {result && (
        <div
          className={`mt-4 rounded-xl border p-4 text-sm ${result.ok ? 'border-zinc-200 bg-zinc-50 text-zinc-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
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
