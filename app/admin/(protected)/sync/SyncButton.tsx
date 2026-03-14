'use client'

import { useState } from 'react'
import type { syncSparkListings } from '@/app/actions/sync-spark'
import type { SyncSparkResult } from '@/app/actions/sync-spark'
import { Button } from "@/components/ui/button"

type SyncAction = typeof syncSparkListings

export default function SyncButton({ syncAction }: { syncAction: SyncAction }) {
  const [result, setResult] = useState<SyncSparkResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSync() {
    setLoading(true)
    setResult(null)
    try {
      const res = await syncAction({ maxPages: 999, pageSize: 100 })
      setResult(res)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button
        type="button"
        onClick={handleSync}
        disabled={loading}
      >
        {loading ? 'Syncing…' : 'Sync from Spark'}
      </Button>
      {result && (
        <div className={`mt-5 p-4 rounded-lg text-sm ${result.success ? 'bg-success/10' : 'bg-destructive/10'}`}>

          <strong>{result.success ? 'Done' : 'Error'}</strong>: {result.message}
          {result.totalFetched != null && (
            <div className="mt-2">
              Fetched: {result.totalFetched} · Upserted: {result.totalUpserted} · Pages: {result.pagesProcessed}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
