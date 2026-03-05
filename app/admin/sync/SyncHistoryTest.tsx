'use client'

import { useState } from 'react'
import { testListingHistory } from '../../actions/sync-spark'
import type { TestListingHistoryResult } from '../../actions/sync-spark'

export default function SyncHistoryTest() {
  const [listingKey, setListingKey] = useState('')
  const [result, setResult] = useState<TestListingHistoryResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleTest() {
    setLoading(true)
    setResult(null)
    try {
      const res = await testListingHistory(listingKey.trim() || undefined)
      setResult(res)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-6">
      <h2 className="text-lg font-semibold text-amber-900">Test listing history API</h2>
      <p className="mt-1 text-sm text-amber-800">
        Call Spark&apos;s <code className="rounded bg-amber-100 px-1">/history</code> and{' '}
        <code className="rounded bg-amber-100 px-1">/historical/pricehistory</code> for one listing to verify the API and your key role (Private = full history; IDX/VOW = condensed).
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="ListingKey or ListNumber (optional — uses first in DB)"
          value={listingKey}
          onChange={(e) => setListingKey(e.target.value)}
          className="min-w-[200px] rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500"
        />
        <button
          type="button"
          onClick={handleTest}
          disabled={loading}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {loading ? 'Testing…' : 'Test history API'}
        </button>
      </div>
      {result && (
        <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-white p-4 text-sm">
          <p className={result.ok ? 'text-emerald-800' : 'text-amber-900'}>{result.message}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded bg-zinc-50 p-2">
              <span className="font-medium text-zinc-700">GET /listings/.../history</span>
              <p className="mt-1 font-mono text-zinc-900">
                {result.history.ok ? `${result.history.items} events` : `HTTP ${result.history.status ?? 'error'}`}
              </p>
              {result.history.sampleEvent && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-zinc-500">Sample event</summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-zinc-100 p-2 text-xs text-zinc-800">
                    {JSON.stringify(result.history.sampleEvent, null, 2)}
                  </pre>
                </details>
              )}
            </div>
            <div className="rounded bg-zinc-50 p-2">
              <span className="font-medium text-zinc-700">GET /listings/.../historical/pricehistory</span>
              <p className="mt-1 font-mono text-zinc-900">
                {result.priceHistory.ok ? `${result.priceHistory.items} events` : `HTTP ${result.priceHistory.status ?? 'error'}`}
              </p>
              {result.priceHistory.sampleEvent && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-zinc-500">Sample event</summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-zinc-100 p-2 text-xs text-zinc-800">
                    {JSON.stringify(result.priceHistory.sampleEvent, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
