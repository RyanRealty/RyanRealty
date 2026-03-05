'use client'

import { useState } from 'react'
import type { generateAllMissingBanners } from '../../actions/banners'

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
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-400 disabled:cursor-not-allowed"
      >
        {loading ? 'Generating…' : 'Generate missing banners'}
      </button>
      {result && (
        <div
          className={`mt-4 rounded-xl border p-4 text-sm ${result.failed > 0 ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-zinc-200 bg-zinc-50 text-zinc-800'}`}
        >
          <strong>Done:</strong> generated {result.generated}, failed {result.failed}.
          {result.errors.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-amber-800">
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
