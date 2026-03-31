'use client'

import { useState } from 'react'
import { testListingHistory } from '@/app/actions/sync-spark'
import type { TestListingHistoryResult } from '@/app/actions/sync-spark'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type Props = { defaultListingKey?: string | null }

export default function SyncHistoryTest({ defaultListingKey }: Props) {
  const [listingKey, setListingKey] = useState(defaultListingKey ?? '')
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
    <div className="rounded-lg border-2 border-warning/30 bg-warning/10/50 p-6">
      <h2 className="text-lg font-semibold text-foreground">Test listing &amp; historical data</h2>
      <p className="mt-1 text-sm text-warning">
        One click tests <strong>Listing History</strong> (<code className="rounded bg-warning/15 px-1">/history</code>), <strong>Price history</strong> (<code className="rounded bg-warning/15 px-1">/historical/pricehistory</code>), and <strong>Historical Listings</strong> (<code className="rounded bg-warning/15 px-1">/historical</code> — off-market listings for same property). Use one listing key above.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          type="text"
          placeholder="ListingKey or ListNumber"
          value={listingKey}
          onChange={(e) => setListingKey(e.target.value)}
          className="min-w-[200px] rounded-lg border border-warning/40 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <Button
          type="button"
          onClick={handleTest}
          disabled={loading}
          className="rounded-lg bg-warning px-4 py-2 text-sm font-semibold text-warning-foreground hover:bg-warning/85 disabled:opacity-50"
        >
          {loading ? 'Testing…' : 'Test all 3'}
        </Button>
      </div>
      {result && (
        <div className="mt-4 space-y-3 rounded-lg border border-warning/30 bg-card p-4 text-sm">
          <p className={result.ok ? 'text-success' : 'text-foreground'}>{result.message}</p>
          <div className="grid gap-2 sm:grid-cols-1 lg:grid-cols-3">
            <div className="rounded bg-muted p-2">
              <span className="font-medium text-muted-foreground">GET /listings/.../history</span>
              <p className="mt-1 font-mono text-foreground">
                {result.history.ok ? `${result.history.items} events` : `HTTP ${result.history.status ?? 'error'}`}
              </p>
              {result.history.errorBody && (
                <details className="mt-2" open={!result.history.ok}>
                  <summary className="cursor-pointer text-xs text-muted-foreground">Error response</summary>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-destructive/10 p-2 text-xs text-destructive whitespace-pre-wrap">
                    {result.history.errorBody}
                  </pre>
                </details>
              )}
              {result.history.sampleEvent && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">Sample event</summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs text-foreground">
                    {JSON.stringify(result.history.sampleEvent, null, 2)}
                  </pre>
                </details>
              )}
            </div>
            <div className="rounded bg-muted p-2">
              <span className="font-medium text-muted-foreground">GET /listings/.../historical/pricehistory</span>
              <p className="mt-1 font-mono text-foreground">
                {result.priceHistory.ok ? `${result.priceHistory.items} events` : `HTTP ${result.priceHistory.status ?? 'error'}`}
              </p>
              {result.priceHistory.errorBody && (
                <details className="mt-2" open={!result.priceHistory.ok}>
                  <summary className="cursor-pointer text-xs text-muted-foreground">Error response</summary>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-destructive/10 p-2 text-xs text-destructive whitespace-pre-wrap">
                    {result.priceHistory.errorBody}
                  </pre>
                </details>
              )}
              {result.priceHistory.sampleEvent && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">Sample event</summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs text-foreground">
                    {JSON.stringify(result.priceHistory.sampleEvent, null, 2)}
                  </pre>
                </details>
              )}
            </div>
            <div className="rounded bg-muted p-2">
              <span className="font-medium text-muted-foreground">GET /listings/.../historical</span>
              <p className="mt-1 font-mono text-foreground">
                {result.historical.ok ? `${result.historical.count} off-market` : `HTTP ${result.historical.status ?? 'error'}`}
              </p>
              {result.historical.errorBody && (
                <details className="mt-2" open={!result.historical.ok}>
                  <summary className="cursor-pointer text-xs text-muted-foreground">Error response</summary>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-destructive/10 p-2 text-xs text-destructive whitespace-pre-wrap">
                    {result.historical.errorBody}
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
