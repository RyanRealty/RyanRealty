'use client'

import { useState } from 'react'
import { fetchExpiredFromSpark } from '@/app/actions/expired-listings'
import { Button } from "@/components/ui/button"

export function ExpiredListingsClient() {
  const [loading, setLoading] = useState<'backfill' | 'recent' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runBackfill() {
    setLoading('backfill')
    setMessage(null)
    setError(null)
    try {
      const res = await fetchExpiredFromSpark({ lastDays: 180, maxPages: 100 })
      if (res.ok) {
        setMessage(res.message)
        window.location.reload()
      } else {
        setError(res.error)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(null)
    }
  }

  async function runRecent() {
    setLoading('recent')
    setMessage(null)
    setError(null)
    try {
      const res = await fetchExpiredFromSpark({ lastDays: 30, maxPages: 20 })
      if (res.ok) {
        setMessage(res.message)
        window.location.reload()
      } else {
        setError(res.error)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={runBackfill}
          disabled={!!loading}
        >
          {loading === 'backfill' ? 'Fetching…' : 'Backfill last 6 months from Spark'}
        </Button>
        <Button
          type="button"
          onClick={runRecent}
          disabled={!!loading}
          variant="outline"
        >
          {loading === 'recent' ? 'Fetching…' : 'Fetch last 30 days (ongoing)'}
        </Button>
      </div>
      {message && <p className="text-sm text-success">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
