'use client'

import { useState } from 'react'
import type { syncSparkListings } from '../../actions/sync-spark'
import type { SyncSparkResult } from '../../actions/sync-spark'

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
      <button
        type="button"
        onClick={handleSync}
        disabled={loading}
        style={{
          padding: '12px 24px',
          fontSize: '1rem',
          background: loading ? '#ccc' : '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Syncing…' : 'Sync from Spark'}
      </button>
      {result && (
        <div
          style={{
            marginTop: '20px',
            padding: '16px',
            background: result.success ? '#e6f7ed' : '#fde8e8',
            borderRadius: '8px',
            fontSize: '14px',
          }}
        >
          <strong>{result.success ? 'Done' : 'Error'}</strong>: {result.message}
          {result.totalFetched != null && (
            <div style={{ marginTop: '8px' }}>
              Fetched: {result.totalFetched} · Upserted: {result.totalUpserted} · Pages: {result.pagesProcessed}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
